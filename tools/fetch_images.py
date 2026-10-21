"""抓出題池文物的照片（故宮低階圖 CC0）到 CACHE/img/src/<img>.jpg。

故宮圖片網址有 Cloudflare 機器人驗證：curl 與 Playwright 內建瀏覽器都 403。
真 Chrome 新版無頭模式先進首頁通過驗證，再在「同一個頁面裡」fetch 同站圖片才拿得到。
- 依朝代輪流抓：中途上線時各朝代都有圖
- 可中斷續抓：檔案已存在就跳過
- 對故宮客氣：一次最多 CONC 張、每批間隔 PAUSE 秒；遇到驗證頁或 403 就退避 1→2→4 分鐘，連續失敗就停並通知
用法：python tools/fetch_images.py [--limit N] [--conc 3]
"""
import argparse
import base64
import collections
import itertools
import json
import os
import sys
import time
import urllib.request

from playwright.sync_api import sync_playwright

from common import CACHE

HOME = "https://digitalarchive.npm.gov.tw/"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36"
SRC = CACHE / "img" / "src"
LOG = CACHE / "img" / "fetch.log"

# 頁內抓圖：回傳 [{key, ok, type, b64}]，b64 只在成功時有
JS = """async (keys) => Promise.all(keys.map(async (k) => {
  const [id, code] = k.split('_');
  try {
    const r = await fetch('/Image/GetImage?ImageId=' + id + '&randomCode=' + code, {credentials: 'include'});
    const t = r.headers.get('content-type') || '';
    if (!r.ok || !t.startsWith('image')) return {key: k, ok: false, type: r.status + ' ' + t};
    const b = new Uint8Array(await r.arrayBuffer());
    let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    return {key: k, ok: true, type: t, b64: btoa(s)};
  } catch (e) { return {key: k, ok: false, type: String(e)}; }
}))"""


def log(msg):
    line = time.strftime("%m-%d %H:%M:%S ") + msg
    print(line, flush=True)
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def ntfy(msg):
    topic = os.environ.get("NTFY_TOPIC")
    if not topic:
        return
    try:
        urllib.request.urlopen(urllib.request.Request("https://ntfy.sh/" + topic, data=msg.encode(), headers={"Title": "lun-museum fetch_images"}), timeout=10)
    except Exception:  # noqa: BLE001  通知失敗不影響主流程
        pass


def todo_keys():
    """出題池裡還沒抓的圖，依朝代輪流排。"""
    by = collections.defaultdict(list)
    with open(CACHE / "build" / "items.jsonl", encoding="utf-8") as f:
        for line in f:
            r = json.loads(line)
            if r["pool"] and not (SRC / f"{r['img']}.jpg").exists():
                by[r["grp"]].append(r["img"])
    out = []
    for group in itertools.zip_longest(*by.values()):
        out.extend(k for k in group if k)
    return list(dict.fromkeys(out))


def open_page(p):
    b = p.chromium.launch(channel="chrome", headless=True, args=["--headless=new", "--disable-blink-features=AutomationControlled"])
    pg = b.new_context(user_agent=UA).new_page()
    pg.goto(HOME, timeout=90000)
    pg.wait_for_timeout(10000)
    if "故宮" not in pg.title():
        b.close()
        raise RuntimeError("首頁沒通過驗證：" + pg.title())
    return b, pg


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--conc", type=int, default=3)
    ap.add_argument("--pause", type=float, default=1.0)
    a = ap.parse_args()
    SRC.mkdir(parents=True, exist_ok=True)
    keys = todo_keys()
    if a.limit:
        keys = keys[: a.limit]
    log(f"開始：待抓 {len(keys)} 張，一次 {a.conc} 張，間隔 {a.pause} 秒")
    done = fail_streak = 0
    t0 = time.time()
    with sync_playwright() as p:
        b = pg = None
        i = 0
        try:
            while i < len(keys):
                batch = keys[i: i + a.conc]
                # 開瀏覽器、頁內抓圖的任何錯誤（520、驗證頁、瀏覽器被關）都走同一套退避重試
                try:
                    if pg is None:
                        b, pg = open_page(p)
                    res = pg.evaluate(JS, batch)
                    bad = [r for r in res if not r["ok"]]
                    whole_fail = bool(bad) and len(bad) == len(res)
                    err = bad[0]["type"] if bad else ""
                except Exception as e:  # noqa: BLE001
                    res, bad, whole_fail, err = [], [], True, f"{type(e).__name__}: {str(e)[:120]}"
                for r in res:
                    if r["ok"]:
                        (SRC / f"{r['key']}.jpg").write_bytes(base64.b64decode(r["b64"]))
                        done += 1
                if whole_fail:
                    fail_streak += 1
                    if fail_streak > 6:
                        msg = f"連續失敗 {fail_streak - 1} 次，停止。最後錯誤：{err}；這次已抓 {done} 張，重跑會續抓"
                        log(msg)
                        ntfy(msg)
                        return 1
                    wait = 60 * 2 ** min(fail_streak - 1, 3)  # 1→2→4→8 分鐘
                    log(f"整批失敗（{err}），等 {wait} 秒後重開瀏覽器")
                    try:
                        if b:
                            b.close()
                    except Exception:  # noqa: BLE001  已經壞掉的瀏覽器關不掉也沒關係
                        pass
                    b = pg = None
                    time.sleep(wait)
                    continue  # 同一批重試
                fail_streak = 0
                for r in bad:  # 個別失敗（例如原圖不存在）記下來，不重試
                    log(f"略過 {r['key']}：{r['type']}")
                i += a.conc
                if done and done % 300 < a.conc:
                    rate = done / (time.time() - t0)
                    log(f"進度 {i}/{len(keys)}，成功 {done}，每秒 {rate:.2f} 張，預估剩 {(len(keys) - i) / max(rate, 0.01) / 3600:.1f} 小時")
                time.sleep(a.pause)
        finally:
            try:
                if b:
                    b.close()
            except Exception:  # noqa: BLE001
                pass
    log(f"完成：成功 {done} 張，用時 {(time.time() - t0) / 60:.0f} 分")
    return 0


if __name__ == "__main__":
    sys.exit(main())
