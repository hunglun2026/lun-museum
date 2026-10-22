"""拍使用說明頁（help.html）的畫面截圖：1100×760 拍、縮成 880 寬 webp，存 public/img/help/。

功能或畫面改了就重拍：先開本機 `npx wrangler dev --remote --port 8813`，再跑
  python scripts/help-shots.py [網址，預設 http://127.0.0.1:8813]
瀏覽器是自己開的獨立無頭 Chrome，跑完就關。檔名要跟 help.html 裡的 <img src> 一致。
"""
import io
import sys
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8813").rstrip("/")
OUT = Path(__file__).resolve().parent.parent / "public" / "img" / "help"
DETAIL_N = 5887  # 文王鼎：有 AI 白話版，拿來拍白話介紹

# 小展覽的示範資料：三件文物，第一件寫好解說牌
EXHIBIT = {"title": "我們班的青銅器展", "items": [
    {"n": 5887, "name": "文王鼎", "cat": "bronze", "grp": "周", "img": "", "photo": 1,
     "note": "這是一個用來煮肉、祭祀祖先的鼎。三隻腳站得很穩，肚子上有一圈花紋，我最喜歡它的兩個耳朵。"},
]}


def ready(page):
    page.wait_for_function("document.documentElement.dataset.ready", timeout=30000)


def photos_loaded(page):
    # 畫面上看得到的圖都載完才拍
    page.wait_for_function("[...document.querySelectorAll('main img')].filter(i=>{const r=i.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight}).every(i=>i.complete)", timeout=20000)
    page.wait_for_timeout(400)


def shot(page, name):
    png = page.screenshot()
    im = Image.open(io.BytesIO(png)).convert("RGB")
    im = im.resize((880, round(im.height * 880 / im.width)), Image.LANCZOS)
    im.save(OUT / f"{name}.webp", "WEBP", quality=80)
    print(f"  {name}.webp {im.size} {(OUT / f'{name}.webp').stat().st_size // 1024} KB", flush=True)


def go(page, path, level="e"):
    page.goto(BASE + "/")
    page.evaluate(f"localStorage.setItem('mu-level','{level}')")
    page.goto(BASE + path)
    ready(page)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome", headless=True)
        ctx = b.new_context(viewport={"width": 1100, "height": 760}, reduced_motion="reduce")
        page = ctx.new_page()

        # 首頁引導入口：老師 → 國中
        go(page, "/", "j")
        page.evaluate("localStorage.removeItem('mu-guide')")
        page.reload(); ready(page)
        page.click("[data-who=teacher]")
        page.click("[data-lv=j]")
        page.evaluate("document.getElementById('start').scrollIntoView()")
        page.evaluate("scrollBy(0,-12)")
        page.wait_for_timeout(300)
        shot(page, "guide")

        go(page, "/artifact"); photos_loaded(page); shot(page, "artifact")

        go(page, f"/artifact#{DETAIL_N}", "j")
        page.wait_for_selector("dialog[open] .plain")
        photos_loaded(page); shot(page, "detail")

        go(page, "/search?t=items&q=" + "青花"); page.wait_for_selector("#out .acard"); photos_loaded(page); shot(page, "search")

        for name, start in (("era", "#go10"), ("classify", "#go10"), ("timeline", "#go"), ("memory", "#go")):
            go(page, "/" + name)
            page.click(start)
            page.wait_for_selector({"era": ".stage", "classify": ".stage", "timeline": ".tl-card", "memory": ".mcard"}[name])
            page.wait_for_timeout(500)
            photos_loaded(page)
            if name in ("era", "classify"):
                page.evaluate("document.querySelector('.stage').scrollIntoView({block:'start'});scrollBy(0,-12)")
                page.wait_for_timeout(200)
            shot(page, name)

        go(page, "/")
        it = page.evaluate(f"fetch('/api/item/{DETAIL_N}').then(r=>r.json())")
        EXHIBIT["items"][0]["img"] = (it.get("item") or it)["img"]
        page.evaluate("ex => localStorage.setItem('mu-exhibit-v1', JSON.stringify(ex))", EXHIBIT)
        go(page, "/exhibit"); photos_loaded(page); shot(page, "exhibit")

        go(page, "/archives?q=" + "臺灣", "s"); page.wait_for_selector(".hbar"); page.wait_for_timeout(400); shot(page, "archives")

        go(page, "/passport"); shot(page, "passport")

        go(page, "/teacher#guide"); shot(page, "teacher-pack")
        go(page, "/teacher")
        page.click("#gen"); page.wait_for_selector("#sheet .q"); photos_loaded(page)
        page.evaluate("document.getElementById('sheet').scrollIntoView({block:'start'});scrollBy(0,-12)")
        page.wait_for_timeout(300); shot(page, "teacher-sheet")
        go(page, "/teacher#slides")
        page.click("#gen2"); page.wait_for_timeout(1200); photos_loaded(page)
        page.evaluate("document.getElementById('slide').scrollIntoView({block:'start'});scrollBy(0,-12)")
        page.wait_for_timeout(300); shot(page, "teacher-slide")
        go(page, "/teacher#board"); shot(page, "teacher-board")
        b.close()


if __name__ == "__main__":
    main()
