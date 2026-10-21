"""16 類文物 → CACHE/build/items.jsonl（統一欄位＋朝代正規化＋是否進出題池）。

出題池（pool）：有照片、朝代可出題（era.norm quiz=True）、說明 ≥ 20 字。照片只自架出題池的。
用法：python tools/normalize.py
"""
import collections
import json
import re
import sys
from urllib.parse import parse_qs, urlsplit

from common import CACHE, load_list
from era import norm

# 檔名 → (分類鍵, 中文名, 圖示)。分類鍵也是網址參數，不要改。
CATS = {
    "bronzes": ("bronze", "銅器", "🔔"), "ceramics": ("ceramic", "陶瓷器", "🏺"), "jades": ("jade", "玉器", "💚"),
    "enamelWares": ("enamel", "琺瑯器", "🎨"), "carvings": ("carving", "雕刻", "🪵"), "lacquerWares": ("lacquer", "漆器", "🧧"),
    "coins": ("coin", "錢幣", "🪙"), "studioImplements": ("studio", "文具", "🖌️"), "miscellaneousObjects": ("misc", "雜項", "📦"),
    "textiles": ("textile", "織品", "🧵"), "tapestriesAndEmbroideries": ("embroidery", "絲繡", "🪡"),
    "paintings": ("painting", "繪畫", "🖼️"), "calligraphicWorks": ("calligraphy", "法書", "✒️"),
    "calligraphicModelBooks": ("modelbook", "法帖", "📜"), "rubbings": ("rubbing", "拓片", "🪨"), "fans": ("fan", "成扇", "🪭"),
}
MIN_DESC = 20


def clean(s) -> str:
    s = re.sub(r"<[^>]+>", "", str(s or ""))
    return re.sub(r"\s+", " ", s.replace("　", " ")).strip()


def image_key(url: str):
    """imageUrl_m 的 ImageId＋randomCode；ImageId=0 代表沒有圖。"""
    q = parse_qs(urlsplit(url or "").query)
    iid, code = q.get("ImageId", ["0"])[0], q.get("randomCode", ["0"])[0]
    return None if iid in ("", "0") else f"{iid}_{code}"


def main():
    out = CACHE / "build"
    out.mkdir(parents=True, exist_ok=True)
    seen, rows = set(), []
    stat = collections.Counter()
    for fname, (cat, cat_name, _) in CATS.items():
        for x in load_list(CACHE / "raw" / "items" / f"{fname}.json"):
            iid = clean(x.get("identifier"))
            if not iid or iid in seen:
                stat["重複或無編號"] += 1
                continue
            seen.add(iid)
            e = norm(x.get("era"))
            desc = clean(x.get("desc"))
            img = image_key(x.get("imageUrl_m"))
            pool = bool(img and e["quiz"] and len(desc) >= MIN_DESC)
            rows.append({
                "id": iid, "name": clean(x.get("name")), "cat": cat, "size": clean(x.get("size")),
                "era": e["raw"], "dyn": e["dyn"], "grp": e["group"], "emperor": e["emperor"], "reign": e["reign"],
                "year": e["year"], "y0": e["y0"], "y1": e["y1"], "era_quiz": e["quiz"],
                "desc": desc, "url": clean(x.get("url")), "img": img, "pool": pool,
            })
            stat["全部"] += 1
            stat["有圖"] += bool(img)
            stat["出題池"] += pool
    with open(out / "items.jsonl", "w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(dict(stat))
    by = collections.Counter(r["grp"] for r in rows if r["pool"])
    print("出題池各朝代：", by.most_common())


if __name__ == "__main__":
    sys.exit(main())
