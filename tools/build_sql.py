"""產生匯入 D1 的 SQL：CACHE/build/import.sql。

做法：依 migrations/0001_init.sql 建 *_new 新表 → 寫入 → 最後一段才把舊表刪掉、新表換名。
任何一段失敗，網站仍用舊表（失敗保留舊資料）。
用法：python tools/build_sql.py [--only items|archives]   之後 tools/import.sh 上傳
"""
import argparse
import json
import re
import sys

from common import CACHE, ROOT, load_list
from tokens import index_tokens

MAX_STMT = 90_000  # D1 單一 SQL 敘述上限 100KB，留點空間

# 清代年號元年（西元）。檔案日期寫「雍正12年06月20日」→ 1723 + 12 - 1
REIGN_START = {
    "天命": 1616, "天聰": 1627, "崇德": 1636, "順治": 1644, "康熙": 1662, "雍正": 1723, "乾隆": 1736,
    "嘉慶": 1796, "道光": 1821, "咸豐": 1851, "祺祥": 1861, "同治": 1862, "光緒": 1875, "宣統": 1909,
    "洪武": 1368, "永樂": 1403, "萬曆": 1573, "天啟": 1621, "崇禎": 1628,
}
CN_NUM = {"元": 1, "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9, "十": 10}


def cn_to_int(s: str):
    if s.isdigit():
        return int(s)
    if s in ("元", "一"):
        return 1
    n = 0
    if "十" in s:
        a, _, b = s.partition("十")
        n = (CN_NUM.get(a, 1) if a else 1) * 10 + (CN_NUM.get(b, 0) if b else 0)
        return n
    return CN_NUM.get(s)


def reign_year(date_raw: str):
    m = re.match(r"\s*(\S{2})\s*(\d+|[元一二三四五六七八九十]+)\s*年", date_raw or "")
    if not m or m.group(1) not in REIGN_START:
        return None
    n = cn_to_int(m.group(2))
    return REIGN_START[m.group(1)] + n - 1 if n else None


def split_person(s: str):
    """「[具奏人]常安@浙江巡撫」→（常安, 浙江巡撫）；多人取第一位。"""
    s = re.sub(r"\[[^\]]*\]", "", s or "").strip()
    first = re.split(r"[;；,，]", s)[0]
    name, _, office = first.partition("@")
    return name.strip() or None, office.strip() or None


def q(v):
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "1" if v else "0"
    if isinstance(v, (int, float)):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


def inserts(table, cols, rows):
    """把多列塞進多個 INSERT，每個敘述不超過 MAX_STMT。"""
    head = f"INSERT INTO {table} ({','.join(cols)}) VALUES "
    buf, size = [], len(head.encode())
    for r in rows:
        v = "(" + ",".join(q(x) for x in r) + ")"
        vb = len(v.encode())  # D1 上限是 100KB「位元組」，中文一字 3 bytes，不能用字數算
        if buf and size + vb + 2 > MAX_STMT:
            yield head + ",".join(buf) + ";"
            buf, size = [], len(head.encode())
        buf.append(v)
        size += vb + 1
    if buf:
        yield head + ",".join(buf) + ";"


def schema_for(t):
    """從 migration 取出表 t 的敘述：(建 t_new 與 t_new_fts 的 CREATE, 原名的 CREATE INDEX)。
    索引在換名「之後」才用原名建：舊索引隨舊表刪掉，不會撞名被 IF NOT EXISTS 安靜跳過。"""
    sql = re.sub(r"--[^\n]*", "", (ROOT / "migrations" / "0001_init.sql").read_text("utf-8"))
    tables, indexes = [], []
    for stmt in (s.strip() for s in sql.split(";")):
        if re.search(rf"TABLE IF NOT EXISTS {t}\b", stmt):
            tables.append(re.sub(rf"\b{t}\b", f"{t}_new", stmt, count=1) + ";")
        elif re.search(rf"TABLE IF NOT EXISTS {t}_fts\b", stmt):
            tables.append(stmt.replace(f"{t}_fts", f"{t}_new_fts", 1) + ";")
        elif re.search(rf"INDEX IF NOT EXISTS \w+ ON {t}\b", stmt):
            indexes.append(stmt + ";")
    return tables, indexes


def items_rows():
    with open(CACHE / "build" / "items.jsonl", encoding="utf-8") as f:
        for n, line in enumerate(f, 1):
            r = json.loads(line)
            yield n, r


def archives_rows():
    n = 0
    for p in sorted((CACHE / "raw" / "archives").glob("*.json")):
        for x in load_list(p):
            iid = (x.get("統一編號") or "").strip()
            title = (x.get("品名／事由") or "").strip()
            if not iid or not title:
                continue
            n += 1
            person, office = split_person(x.get("產生者（具奏人、官職）"))
            date_raw = (x.get("形成日期") or "").strip()
            yield n, {
                "id": iid, "docno": (x.get("文獻編號") or "").strip(), "kind": p.stem, "title": title,
                "author": (x.get("著撰者") or "").strip() or None, "person": person, "office": office,
                "date_raw": date_raw or None, "year": reign_year(date_raw),
                "form": (x.get("形制") or "").strip() or None, "size": (x.get("尺寸") or "").strip() or None,
            }


ITEM_COLS = ["n", "id", "name", "cat", "size", "era", "dyn", "grp", "emperor", "reign", "year", "y0", "y1",
             "era_quiz", "descr", "url", "img", "pool", "photo"]
ARCH_COLS = ["n", "id", "docno", "kind", "title", "author", "person", "office", "date_raw", "year", "form", "size"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", choices=["items", "archives"])
    ap.add_argument("--photos", help="已上傳到 R2 的圖片代號清單檔（每行一個），標 photo=1")
    a = ap.parse_args()
    which = [a.only] if a.only else ["items", "archives"]
    photos = set()
    if a.photos:
        photos = set(open(a.photos, encoding="utf-8").read().split())
    out = CACHE / "build"
    files = []
    for t in which:
        path = out / f"import_{t}.sql"
        cnt = 0
        seen = set()
        with open(path, "w", encoding="utf-8") as f:
            f.write(f"DROP TABLE IF EXISTS {t}_new_fts;\nDROP TABLE IF EXISTS {t}_new;\n")
            tables, indexes = schema_for(t)
            for s in tables:
                f.write(s + "\n")
            if t == "items":
                rows, fts = [], []
                for n, r in items_rows():
                    rows.append([n, r["id"], r["name"], r["cat"], r["size"], r["era"], r["dyn"], r["grp"], r["emperor"],
                                 r["reign"], r["year"], r["y0"], r["y1"], r["era_quiz"], r["desc"], r["url"], r["img"],
                                 r["pool"], r["img"] in photos])
                    fts.append([n, index_tokens(" ".join(filter(None, [r["name"], r["desc"], r["era"], r["dyn"], r["reign"]])))])
                cols = ITEM_COLS
            else:
                rows, fts = [], []
                for n, r in archives_rows():
                    if r["id"] in seen:
                        continue
                    seen.add(r["id"])
                    rows.append([n] + [r[c] for c in ARCH_COLS[1:]])
                    fts.append([n, index_tokens(" ".join(filter(None, [r["title"], r["person"], r["office"], r["author"]])))])
                cols = ARCH_COLS
            for s in inserts(f"{t}_new", cols, rows):
                f.write(s + "\n")
            for s in inserts(f"{t}_new_fts", ["rowid", "tok"], fts):
                f.write(s + "\n")
            # 換名：全部寫完才動舊表
            f.write(f"DROP TABLE IF EXISTS {t}_fts;\nDROP TABLE IF EXISTS {t};\n")
            f.write(f"ALTER TABLE {t}_new RENAME TO {t};\nALTER TABLE {t}_new_fts RENAME TO {t}_fts;\n")
            for s in indexes:
                f.write(s + "\n")
            f.write(f"INSERT OR REPLACE INTO meta (k, v) VALUES ('{t}_count', '{len(rows)}'), ('{t}_imported_at', datetime('now'));\n")
            cnt = len(rows)
        files.append(path)
        print(f"{t}：{cnt} 筆 → {path}（{path.stat().st_size / 1e6:.0f} MB）")


if __name__ == "__main__":
    sys.exit(main())
