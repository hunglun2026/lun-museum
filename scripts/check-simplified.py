"""掃簡體字：網站程式與頁面（有就離場碼 1）＋出題池文物資料（只列出來給人看，故宮原文照錄不改）。
判斷方式：用 zhconv 逐字轉成繁體，跟原字不同就是簡體字（不手寫字表，避免誤列兩岸共用字）。
「一簡對多繁」但繁體本來合法的字放白名單。需要：pip install zhconv"""
import sys
from pathlib import Path

from zhconv import convert

ROOT = Path(__file__).resolve().parent.parent
ALWAYS_OK = set("准划占栗虱郁台里后干范")  # 核准、划算、占用、苗栗、虱目魚、濃郁、台、里、后、干、范


def in_big5(ch: str) -> bool:
    try:
        ch.encode("cp950")
        return True
    except UnicodeEncodeError:
        return False


def bad_chars(text: str) -> dict:
    """zhconv 說不同、而且不在台灣用的 Big5 字集裡，才算簡體字。
    只靠 zhconv 會把岩、游、泄、祕、污、凶、苧…這些繁體本來就合法的一簡對多繁字誤報。"""
    out = {}
    for ch in set(text):
        if ord(ch) > 0x2E80 and ch not in ALWAYS_OK and convert(ch, "zh-tw") != ch and not in_big5(ch):
            out[ch] = convert(ch, "zh-tw")
    return out


def main() -> int:
    bad = 0
    for p in list((ROOT / "public").rglob("*")) + list((ROOT / "src").rglob("*.ts")):
        if p.suffix in (".html", ".js", ".css", ".ts"):
            b = bad_chars(p.read_text(encoding="utf-8"))
            if b:
                bad += 1
                print(f"[簡體] {p.relative_to(ROOT)}: {b}")
    # 故宮資料：只報告不算失敗。文物名稱、銘文是原文照錄，網站不改故宮的資料
    import json, os
    path = Path(os.environ.get("LUN_MUSEUM_CACHE", r"D:\lun-museum-cache")) / "build" / "items.jsonl"
    if path.exists():
        hits = {}
        for line in path.read_text(encoding="utf-8").splitlines():
            r = json.loads(line)
            if r["pool"]:
                for ch in bad_chars(r["name"] + r["desc"]):
                    hits.setdefault(ch, []).append(r["name"])
        for ch, names in sorted(hits.items(), key=lambda x: -len(x[1]))[:15]:
            print(f"[故宮資料含簡體字「{ch}」，照錄不改] {len(names)} 件，例：{names[:2]}")
    print("沒有發現簡體字" if not bad else f"共 {bad} 處需要看")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
