"""下載故宮開放資料到快取資料夾（預設 D:\\lun-museum-cache\\raw）。

資料集清單寫死在 DATASETS；下載網址每次向 data.gov.tw 查，來源改網址也不會壞。
同時寫 raw/meta.json（每個資料集的 modifiedDate），月檢查與匯入都用它判斷有沒有更新。
用法：python tools/fetch_data.py [--only items|archives|persons] [--force]
"""
import argparse
import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

from common import CACHE

UA = {"User-Agent": "Mozilla/5.0 lun-museum"}

# (data.gov.tw 資料集 id, 種類, 存檔名)
DATASETS = [
    ("169459", "items", "bronzes"), ("169547", "items", "fans"), ("169548", "items", "rubbings"),
    ("169549", "items", "calligraphicModelBooks"), ("169550", "items", "calligraphicWorks"),
    ("169551", "items", "paintings"), ("169552", "items", "tapestriesAndEmbroideries"),
    ("169554", "items", "textiles"), ("169555", "items", "miscellaneousObjects"),
    ("169556", "items", "studioImplements"), ("169557", "items", "coins"), ("169558", "items", "lacquerWares"),
    ("169559", "items", "carvings"), ("169560", "items", "enamelWares"), ("169561", "items", "jades"),
    ("169562", "items", "ceramics"),
    ("170165", "archives", "雜檔"), ("170271", "archives", "購獻"), ("170272", "archives", "傳稿包"),
    ("170273", "archives", "內閣部院檔案"), ("170274", "archives", "史館檔"), ("170275", "archives", "官書"),
    ("170276", "archives", "軍機處檔冊"), ("170583", "archives", "軍機處檔摺件"), ("170584", "archives", "宮中檔奏摺"),
    ("9776", "persons", "bio1"), ("9777", "persons", "bio2"), ("9778", "persons", "bio3"),
    ("9779", "persons", "bio4"), ("9780", "persons", "bio5"),
]


def get(url: str, timeout=300) -> bytes:
    # 中文檔名要先編碼，否則來源回 400
    parts = urllib.parse.urlsplit(url)
    url = urllib.parse.urlunsplit(parts._replace(path=urllib.parse.quote(urllib.parse.unquote(parts.path))))
    for wait in (0, 5, 20, 60):
        time.sleep(wait)
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
                return r.read()
        except Exception as e:  # noqa: BLE001  網路錯誤一律重試，最後一次照樣丟出
            err = e
    raise RuntimeError(f"下載失敗 {url}：{err}")


def meta(ds_id: str) -> dict:
    r = json.loads(get(f"https://data.gov.tw/api/v2/rest/dataset/{ds_id}", 60))
    return r.get("result", r)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", choices=["items", "archives", "persons"])
    ap.add_argument("--force", action="store_true", help="日期沒變也重抓")
    a = ap.parse_args()
    mpath = CACHE / "raw" / "meta.json"
    old = json.loads(mpath.read_text("utf-8")) if mpath.exists() else {}
    new = dict(old)
    for ds_id, kind, name in DATASETS:
        if a.only and kind != a.only:
            continue
        m = meta(ds_id)
        mod = m.get("modifiedDate", "")
        ext = "csv" if kind == "persons" else "json"
        out = CACHE / "raw" / kind / f"{name}.{ext}"
        if out.exists() and not a.force and old.get(ds_id, {}).get("modified") == mod:
            print(f"[略過] {name}（{mod} 沒變）")
            continue
        url = m["distribution"][0]["resourceDownloadUrl"]
        data = get(url)
        if len(data) < 1000 or data.lstrip()[:1] == b"<":
            raise RuntimeError(f"{name} 下載內容異常（{len(data)} bytes），已停止，舊檔保留")
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(data)
        new[ds_id] = {"kind": kind, "name": name, "modified": mod, "title": m.get("title", "")}
        print(f"[完成] {name} {len(data) / 1e6:.1f} MB（{mod}）")
    mpath.write_text(json.dumps(new, ensure_ascii=False, indent=1), "utf-8")


if __name__ == "__main__":
    sys.exit(main())
