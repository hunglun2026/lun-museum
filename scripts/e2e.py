"""端對端測試：用無頭瀏覽器走學生與老師會按的路徑，收 JS 錯誤、失敗請求、橫向溢出。

用法：python scripts/e2e.py [網址，預設 http://127.0.0.1:8813] [--shots 截圖資料夾]
離場碼：有任何一項失敗就是 1。瀏覽器是自己開的獨立無頭 Chrome，跑完就關。
"""
import argparse
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

PAGES = ["/", "/artifact", "/search", "/era", "/timeline", "/classify", "/memory", "/exhibit", "/archives", "/teacher", "/passport", "/help"]
fails = []


def check(cond, msg):
    print(("  [OK] " if cond else "  [失敗] ") + msg, flush=True)
    if not cond:
        fails.append(msg)


def watch(page):
    errs = []
    page.on("pageerror", lambda e: errs.append("JS 錯誤：" + str(e)[:200]))
    page.on("console", lambda m: m.type == "error" and errs.append("console：" + m.text[:200]))
    page.on("requestfailed", lambda r: errs.append("請求失敗：" + r.url[:120]))
    page.on("response", lambda r: r.status >= 400 and "/img/" not in r.url and errs.append(f"HTTP {r.status}：{r.url[:120]}"))
    return errs


def ready(page, timeout=30000):
    page.wait_for_function("document.documentElement.dataset.ready", timeout=timeout)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("base", nargs="?", default="http://127.0.0.1:8813")
    ap.add_argument("--shots")
    a = ap.parse_args()
    base = a.base.rstrip("/")
    shots = Path(a.shots) if a.shots else None
    if shots:
        shots.mkdir(parents=True, exist_ok=True)
    cb = str(int(time.time()))
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome", headless=True)
        for name, vp in (("桌機", {"width": 1280, "height": 900}), ("手機", {"width": 390, "height": 844})):
            print(f"== {name} 各頁載入", flush=True)
            ctx = b.new_context(viewport=vp)
            for path in PAGES:
                pg = ctx.new_page()
                errs = watch(pg)
                pg.goto(base + path + ("&" if "?" in path else "?") + "cb=" + cb)
                try:
                    ready(pg)
                    pg.wait_for_timeout(1500)
                except Exception as e:  # noqa: BLE001
                    errs.append("頁面沒有就緒：" + str(e)[:100])
                over = pg.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
                check(not errs and over <= 0, f"{name} {path}" + (f"：{errs[:3]}" if errs else "") + (f"：橫向溢出 {over}px" if over > 0 else ""))
                if shots:
                    pg.screenshot(path=str(shots / f"{name}{path.replace('/', '_') or '_home'}.png"), full_page=False)
                pg.close()
            ctx.close()

        print("== 操作流程", flush=True)
        ctx = b.new_context(viewport={"width": 1280, "height": 900})
        pg = ctx.new_page()
        errs = watch(pg)

        # 首頁今日展櫃有照片
        pg.goto(base + "/?cb=" + cb); ready(pg)
        pg.evaluate("document.getElementById('today').scrollIntoView()"); pg.wait_for_timeout(2500)  # 展櫃在開場與展櫃動畫下面，照片捲到才載入
        n = pg.evaluate("[...document.querySelectorAll('#today img.photo')].filter(i=>i.naturalWidth>0).length")
        check(n >= 4, f"首頁今日展櫃顯示 {n} 張照片")

        # 小百科：篩選玉器、開詳情
        pg.goto(base + "/artifact?cb=" + cb); ready(pg)
        pg.get_by_role("button", name="💚 玉器").click(); pg.wait_for_timeout(2000)
        cats = pg.evaluate("[...document.querySelectorAll('#grid .tag2:not(.era)')].map(e=>e.textContent)")
        check(cats and all(c == "玉器" for c in cats), f"小百科篩選玉器：{len(cats)} 件都是玉器")
        pg.locator("#grid .acard").first.click(); pg.wait_for_timeout(2000)
        title = pg.locator("#dlg h2").inner_text()
        big = pg.evaluate("(()=>{const i=document.querySelector('#dlg img.photo');return i?i.naturalWidth:0})()")
        check(bool(title) and big > 0, f"詳情對話框：{title}，大圖寬 {big}px")
        check(pg.locator("#dlg .plain").count() == 1, "國小難度有白話介紹")
        pg.locator("#dlg #x").click()

        # 搜尋文物與清代檔案
        pg.goto(base + "/search?q=%E9%9D%92%E8%8A%B1&cb=" + cb); ready(pg); pg.wait_for_timeout(2500)
        txt = pg.locator("#count").inner_text()
        check("11,407" in txt, f"搜尋青花：{txt[:40]}")
        pg.get_by_role("tab", name="📜 清代檔案").click()
        pg.fill("#q", "臺灣"); pg.get_by_role("button", name="搜尋").click(); pg.wait_for_timeout(2500)
        txt = pg.locator("#count").inner_text()
        years = pg.evaluate("[...document.querySelectorAll('.arow .y')].map(e=>+e.textContent).filter(Boolean)")
        check("1,609" in txt and years == sorted(years), f"清代檔案臺灣：{txt[:30]}，年代由早到晚 {years[:3]}")
        href = pg.locator(".arow").first.get_attribute("href")
        check(href.startswith("https://qingarchives.npm.edu.tw/"), "檔案連到故宮原件頁")

        # 猜朝代：三種難度各答第一題
        for lv, name in (("e", "國小"), ("j", "國中"), ("s", "高中")):
            pg.goto(base + "/era?cb=" + cb); ready(pg)
            pg.select_option("#lvl", lv); pg.wait_for_timeout(300)
            pg.get_by_role("button", name="開始（10 題）").click()
            pg.wait_for_selector(".opt", timeout=20000)
            nopt = pg.locator(".opt").count()
            prompt = pg.locator(".stage h2").inner_text()
            pg.locator(".opt").first.click(); pg.wait_for_timeout(500)
            fb = pg.locator("#fb").inner_text()
            check(nopt == (3 if lv == "e" else 4) and fb, f"猜朝代 {name}：{nopt} 個選項，題目「{prompt[:30]}」，回饋「{fb[:24]}」")

        # 朝代排排站：國小 4 件點完
        pg.goto(base + "/timeline?cb=" + cb); ready(pg)
        pg.select_option("#lvl", "e"); pg.wait_for_timeout(300)
        pg.get_by_role("button", name="開始排排站").click()
        pg.wait_for_selector(".tl-card", timeout=20000)
        k = pg.locator(".tl-card").count()
        for i in range(k):
            pg.locator(".tl-card:not([disabled])").first.click()
        pg.wait_for_timeout(500)
        marked = pg.locator(".tl-card.right, .tl-card.wrong").count()
        check(k == 4 and marked == 4 and pg.locator(".tl-line span").count() == 4, f"排排站國小：{k} 件、標記 {marked} 件、正確順序列出")

        # 老師專區：學習單
        pg.goto(base + "/teacher?cb=" + cb); ready(pg)
        pg.click("#gen"); pg.wait_for_selector("#sheet .q", timeout=30000); pg.wait_for_timeout(2000)
        qn = pg.locator("#sheet .q").count()
        imgs = pg.evaluate("[...document.querySelectorAll('#sheet img')].filter(i=>i.naturalWidth>0).length")
        check(qn == 16, f"學習單 8 題＋答案頁：共 {qn} 題區塊、{imgs} 張圖")
        check("CC BY 4.0" in pg.locator("#sheet").inner_text(), "學習單附故宮授權標示")
        pg.get_by_role("tab", name="📚 課程包").click()
        pg.get_by_role("button", name="一鍵帶入學習單").nth(3).click()
        pg.wait_for_timeout(4000)
        lvl = pg.eval_on_selector("#lvl", "e=>e.value")
        rq = pg.evaluate("[...document.querySelectorAll('#sheet .q')].filter(q=>q.textContent.includes('年號')).length")
        check(lvl == "s" and rq > 0, f"明清年號課程包：難度切到高中、{rq} 題年號題")

        # ---- 第二階段 ----
        # 分類闖關：三種難度選項數
        for lv, k in (("e", 3), ("j", 4), ("s", 4)):
            pg.goto(base + "/classify?cb=" + cb); ready(pg)
            pg.select_option("#lvl", lv); pg.wait_for_timeout(300)
            pg.get_by_role("button", name="開始（10 題）").click()
            pg.wait_for_selector(".opt", timeout=20000)
            n = pg.locator(".opt").count()
            labels = pg.evaluate("[...document.querySelectorAll('.opt')].map(o=>o.firstChild.textContent)")
            pg.locator(".opt").first.click(); pg.wait_for_timeout(400)
            check(n == k and not any("雜項" in x for x in labels) and pg.locator("#fb").inner_text(), f"分類闖關 {lv}：{n} 個選項 {labels}")

        # 翻牌配對：國小 6 對，作弊把每對翻開，確認能配完
        pg.goto(base + "/memory?cb=" + cb); ready(pg)
        pg.select_option("#lvl", "e"); pg.wait_for_timeout(300)
        pg.get_by_role("button", name="開始翻牌").click()
        pg.wait_for_selector(".mcard", timeout=20000)
        cards = pg.locator(".mcard").count()
        names = pg.evaluate("[...document.querySelectorAll('.mcard')].map(c=>c.querySelector('.front b')?c.querySelector('.front b').textContent:c.querySelector('.front img,.front .ph').getAttribute('alt')||c.querySelector('.front .ph').getAttribute('aria-label'))")
        for name in dict.fromkeys(names):
            idx = [i for i, x in enumerate(names) if x == name]
            for i in idx[:2]:
                pg.locator(".mcard").nth(i).click(); pg.wait_for_timeout(150)
            pg.wait_for_timeout(250)
        pg.wait_for_timeout(1200)
        check(cards == 12 and "全部配對完成" in pg.locator("main").inner_text(), f"翻牌配對國小：{cards} 張牌，配完出現完成畫面")

        # 小展覽：從小百科加入 → 展覽頁寫解說牌 → 投影
        pg.goto(base + "/artifact?cb=" + cb); ready(pg); pg.wait_for_timeout(1500)
        for i in range(2):
            pg.locator("#grid .acard").nth(i).click(); pg.wait_for_selector("#dlg #ex", timeout=15000); pg.wait_for_timeout(500)
            pg.locator("#dlg #ex").click(); pg.wait_for_timeout(300)
            pg.locator("#dlg #x").click(); pg.wait_for_timeout(300)
        pg.goto(base + "/exhibit?cb=" + cb); ready(pg)
        rows = pg.locator(".ex-item").count()
        pg.locator(".ex-item textarea").first.fill("這是我最喜歡的文物，因為它的顏色很漂亮。")
        pg.reload(); ready(pg)
        kept = pg.locator(".ex-item textarea").first.input_value()
        pg.get_by_role("button", name="📽️ 投影發表").click(); pg.wait_for_timeout(800)
        slide = pg.locator(".show h2").inner_text()
        pg.keyboard.press("ArrowRight"); pg.wait_for_timeout(300)
        pg_no = pg.locator("#pg").inner_text()
        pg.locator(".show #cl").click()
        check(rows >= 2 and "最喜歡" in kept and slide and pg_no.startswith("2"), f"小展覽：{rows} 件、解說牌重新整理後還在、投影第 {pg_no}")

        # 史料探究：主題 → 長條圖 → 點一個十年列出檔案
        pg.goto(base + "/archives?cb=" + cb); ready(pg)
        pg.locator("#topics .chip", has_text="鐵路").click()
        pg.wait_for_selector(".hbar", timeout=20000)
        bars = pg.locator(".hbar").count()
        people = pg.locator(".alist").first.inner_text()
        pg.locator(".hbar").last.click(); pg.wait_for_selector("#docs .arow", timeout=20000)
        yrs = pg.evaluate("[...document.querySelectorAll('#docs .arow .y')].map(e=>+e.textContent)")
        check(bars >= 3 and "袁世凱" in people and yrs and all(1910 <= y <= 1919 for y in yrs), f"史料探究鐵路：{bars} 個年代、官員含袁世凱、1910 年代 {len(yrs)} 份")

        # 白話版：有 AI 改寫的文物，國小顯示改寫與標示，高中不顯示
        # 同名的護法獅有好幾件，只有一件有白話版：逐件查，挑有 ai_text 的
        n = pg.evaluate("""async () => {
          const d = await (await fetch('/api/search?q=%E8%AD%B7%E6%B3%95%E7%8D%85')).json();
          for (const it of d.items) { const r = await (await fetch('/api/item/' + it.n)).json(); if (r.item.ai_text) return it.n; }
          return 0; }""")
        for lv, want in (("e", True), ("s", False)):
            pg.goto(base + "/artifact?cb=" + cb + "#" + str(n)); ready(pg)
            pg.select_option("#lvl", lv); pg.wait_for_timeout(1500)
            has = "AI 改寫" in pg.locator("#dlg").inner_text()
            check(has == want, f"白話版 {lv}：{'有' if has else '沒有'}顯示 AI 改寫")

        # ---- 0.3.0 歡迎頁、引導入口、使用說明 ----
        # 歡迎頁：8 個展櫃、統計數字換成真實值、捲到最後一個時它的圖有載入
        pg.goto(base + "/?cb=" + cb); ready(pg)
        npanel = pg.locator("#tour .w-panel").count()
        pg.evaluate("document.querySelector('.w-stats').scrollIntoView({block:'center'})"); pg.wait_for_timeout(2000)
        nums = pg.evaluate("[...document.querySelectorAll('[data-w]')].map(e=>+e.textContent.replace(/,/g,''))")
        meta = pg.evaluate("fetch('/api/meta').then(r=>r.json())")
        want = [meta["items"], meta["archives"], meta["photos"], len(meta["pool"])]
        pg.evaluate("(()=>{const t=document.getElementById('tour');scrollTo(0,t.getBoundingClientRect().top+scrollY+t.offsetHeight-innerHeight)})()")
        pg.wait_for_timeout(2500)
        last = pg.evaluate("(()=>{const i=[...document.querySelectorAll('#tour img')].pop();return i.naturalWidth})()")
        check(npanel == 8 and nums == want and last > 0, f"歡迎頁：{npanel} 個展櫃、數字 {nums}（應為 {want}）、最後一張圖寬 {last}px")

        # 引導入口：學生 → 國中 → 推薦 3 個、難度變國中；重新整理後直接顯示推薦；重新選擇回第 1 題
        pg.evaluate("localStorage.removeItem('mu-guide')"); pg.goto(base + "/?cb=" + cb); ready(pg)
        pg.click("[data-who=student]"); pg.click("[data-lv=j]"); pg.wait_for_timeout(300)
        recs = pg.locator("#g-recs .tool").count()
        lvl = pg.eval_on_selector("#lvl", "e=>e.value")
        who = pg.locator("#g-who").inner_text()
        pg.reload(); ready(pg)
        kept = pg.locator('[data-step="done"]').is_visible()
        pg.click("[data-reset]")
        back = pg.locator('[data-step="who"]').is_visible()
        check(recs == 3 and lvl == "j" and who == "學生・國中" and kept and back, f"引導入口：推薦 {recs} 個、難度 {lvl}、{who}、重新整理後記得 {kept}、重新選擇 {back}")

        # 老師推薦的課程包連結直接打開課程包分頁
        pg.goto(base + "/teacher?cb=" + cb + "#guide"); ready(pg)
        check(pg.locator("#tab-guide").is_visible() and not pg.locator("#tab-sheet").is_visible(), "老師專區 #guide 直接打開課程包")

        # 使用說明：截圖全部載入、目錄連結都對得到、導覽有連結
        pg.goto(base + "/help?cb=" + cb); ready(pg)
        r = pg.evaluate("""(async()=>{const w=ms=>new Promise(r=>setTimeout(r,ms));const imgs=[...document.querySelectorAll('main img')];
          imgs.forEach(i=>i.loading='eager');for(let k=0;k<60&&!imgs.every(i=>i.complete);k++)await w(200);
          return {n:imgs.length,bad:imgs.filter(i=>!i.naturalWidth).length,
            toc:[...document.querySelectorAll('.toc a')].filter(a=>!document.querySelector(a.getAttribute('href'))).length,
            nav:!!document.querySelector('header nav a[href="/help"]'),faq:document.querySelectorAll('.faq').length}})()""")
        check(r["n"] == 15 and r["bad"] == 0 and r["toc"] == 0 and r["nav"] and r["faq"] >= 10, f"使用說明：截圖 {r['n']} 張、壞 {r['bad']}、目錄對不到 {r['toc']}、導覽有連結 {r['nav']}、常見問題 {r['faq']} 題")

        # 護照
        pg.goto(base + "/passport?cb=" + cb); ready(pg)
        seen = pg.locator("#seen .acard").count()
        check(seen >= 1, f"護照記到看過的文物 {seen} 件")
        check(not errs, "操作流程沒有 JS 錯誤" + (f"：{errs[:3]}" if errs else ""))
        b.close()
    print(f"\n結果：{'全部通過' if not fails else f'失敗 {len(fails)} 項'}")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
