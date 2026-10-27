/* 首頁（歡迎頁）：引導入口、捲動放大切換、捲到才浮現、數字跳動、今天的展櫃。
   捲動切換照搬動物探險家 p-home.js（原本參考 www.hunglun.com landing.js 的 tour-zoom）。樣式在 css/style.css 的「首頁」段。 */
(function () {
  "use strict";
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---- 引導入口：身分 → 年級 → 推薦。身分記在這台裝置，年級就是全站難度（Mu.setLevel） ----
  const GKEY = "mu-guide";
  const R = (href, ico, name, why) => ({ href, ico, name, why });
  const RECS = {
    student: {
      e: [R("/artifact", "📖", "文物小百科", "有白話介紹，先挑一件最喜歡的"), R("/era", "🏺", "猜猜哪個朝代", "三選一，猜猜看是哪個朝代")],
      j: [R("/era", "🏺", "猜猜哪個朝代", "四選一，還有 60 秒挑戰"), R("/timeline", "📏", "朝代排排站", "把文物依先後排好，複習歷史課"), R("/classify", "🧩", "分類闖關", "從照片分出陶瓷、玉器、銅器")],
      s: [R("/era", "🏺", "猜猜哪個朝代", "明清文物要答出皇帝年號")],
    },
    teacher: {
      e: [R("/teacher#guide", "📚", "課程包「認識朝代」", "40 分鐘流程，一鍵帶入學習單"), R("/era", "🏺", "猜猜哪個朝代", "投影全班搶答，不用每人一台"), R("/help", "📘", "使用說明", "三分鐘看懂每個工具怎麼用")],
      j: [R("/teacher#guide", "📚", "課程包「文物分類」「看圖認寶物」", "40 分鐘流程，一鍵帶入學習單"), R("/timeline", "📏", "朝代排排站", "兩人一組排時間軸")],
      s: [R("/teacher#guide", "📚", "課程包「文物分類」「看圖認寶物」", "40 分鐘流程，一鍵帶入學習單"), R("/era", "🏺", "猜猜哪個朝代", "投影全班搶答，不用每人一台")],
    },
  };
  const WHO = { student: "學生", teacher: "老師" };
  const guide = document.getElementById("start");
  const steps = guide ? [...guide.querySelectorAll(".g-step")] : [];
  let who = null;
  try { who = (JSON.parse(localStorage.getItem(GKEY) || "{}").who) || null; } catch (e) { /* 無痕模式 */ }
  if (!WHO[who]) who = null;

  function show(name) {
    steps.forEach((s) => (s.hidden = s.dataset.step !== name));
  }
  function done() {
    const lv = Mu.level();
    document.getElementById("g-who").textContent = WHO[who] + "・" + Mu.LEVELS[lv].name;
    const box = document.getElementById("g-recs");
    box.innerHTML = RECS[who][lv].map((r) =>
      '<a class="tool" href="' + r.href + '"><div class="ico">' + r.ico + "</div><h3>" + Mu.esc(r.name) + '</h3><span class="why">' + Mu.esc(r.why) + "</span></a>").join("");
    show("done");
  }
  if (guide) {
    const pick = (w) => {
      who = w;
      try { localStorage.setItem(GKEY, JSON.stringify({ who })); } catch (e) { /* 忽略 */ }
      document.getElementById("g-lvq").textContent = who === "teacher" ? "你教幾年級？" : "你幾年級？";
      guide.querySelectorAll("[data-lv]").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.lv === Mu.level())));
      show("lv");
    };
    guide.querySelectorAll("[data-who]").forEach((b) => (b.onclick = () => pick(b.dataset.who)));
    // 開場的「我是學生」「我是老師」：直接選好身分，捲到引導區問年級（沒有 JS 時就只是連到 #start）
    document.querySelectorAll("[data-pick]").forEach((a) => (a.onclick = (e) => {
      e.preventDefault();
      pick(a.dataset.pick);
      guide.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    }));
    guide.querySelectorAll("[data-lv]").forEach((b) => (b.onclick = () => {
      Mu.setLevel(b.dataset.lv);
      const sel = document.getElementById("lvl");
      if (sel) sel.value = b.dataset.lv; // 頁首的難度選單跟著換
      done();
    }));
    guide.querySelector("[data-back]").onclick = () => show("who");
    guide.querySelector("[data-reset]").onclick = () => {
      who = null;
      try { localStorage.removeItem(GKEY); } catch (e) { /* 忽略 */ }
      show("who");
    };
    document.addEventListener("mu-level", () => { if (who && !guide.querySelector('[data-step="done"]').hidden) done(); });
    if (who) done();
  }

  // ---- 捲動放大切換：區塊高度＝張數 × 85vh，畫面固定，捲動進度決定現在顯示哪一個展櫃 ----
  const tour = document.getElementById("tour");
  const panels = tour ? [...tour.querySelectorAll(".w-panel")] : [];
  const n = panels.length;
  const dotsBox = tour && tour.querySelector(".w-dots");
  const dots = panels.map((p, i) => {
    const b = document.createElement("button");
    b.setAttribute("aria-label", "跳到第 " + (i + 1) + " 個");
    b.tabIndex = -1; // 鍵盤使用者直接用每個展櫃的按鈕，不用跳過一排圓點
    b.onclick = () => {
      const top = tour.getBoundingClientRect().top + scrollY;
      scrollTo({ top: top + (tour.offsetHeight - innerHeight) * (i / Math.max(n - 1, 1)), behavior: reduce ? "auto" : "smooth" });
    };
    if (dotsBox) dotsBox.appendChild(b);
    return b;
  });
  if (tour) tour.style.setProperty("--n", n);
  const parts = panels.map((el) => ({ txt: el.querySelector(".w-panel-text"), links: [...el.querySelectorAll("a")], img: el.querySelector("img") }));
  // 圖延後載入：8 個展櫃疊在同一個固定畫面裡，瀏覽器的懶載入會以為都在畫面上而一次全抓；
  // 改成只載入目前這個和前後各一個（index.html 用 data-src 先不給網址）
  function loadImg(i) {
    const im = parts[i] && parts[i].img;
    if (!im || !im.dataset.src) return;
    im.src = im.dataset.src;
    delete im.dataset.src;
  }
  if (reduce) panels.forEach((_, i) => { parts[i].img.loading = "lazy"; loadImg(i); }); // 靜態排列時交給瀏覽器懶載入

  function drawTour() {
    if (!tour || reduce) return;
    const rect = tour.getBoundingClientRect();
    const progress = clamp(-rect.top / Math.max(rect.height - innerHeight, 1), 0, 1);
    const cur = progress * Math.max(n - 1, 1);
    const index = Math.min(n - 1, Math.round(cur));
    if (rect.top < innerHeight * 1.5) [index - 1, index, index + 1, index + 2].forEach(loadImg); // 快捲到時才開始抓
    panels.forEach((el, i) => {
      const off = i - cur; // 負的＝已經看過（放大淡出），正的＝還沒輪到
      const opacity = off < 0 ? clamp(1 + 1.3 * off, 0, 1) : clamp(2 * (1 - off), 0, 1);
      const scale = off < 0 ? 1 - 0.4 * off : 1 - 0.1 * Math.min(off, 1);
      el.style.opacity = opacity;
      el.style.transform = "scale(" + scale + ")";
      el.style.zIndex = off >= 0 ? 10 - Math.ceil(off) : 20;
      el.style.pointerEvents = opacity > 0.85 ? "auto" : "none";
      parts[i].links.forEach((a) => (a.tabIndex = opacity > 0.85 ? 0 : -1));
      const txt = parts[i].txt;
      txt.style.transform = "translateY(" + 8 * off + "vh)";
      txt.style.opacity = clamp(1 - 1.7 * Math.abs(off), 0, 1);
    });
    dots.forEach((d, i) => d.classList.toggle("active", i === index));
  }
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; drawTour(); });
  };
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll);
  drawTour();

  // ---- 捲到才浮現 ----
  const reveals = document.querySelectorAll(".w-reveal");
  if (reduce || !("IntersectionObserver" in window)) reveals.forEach((el) => el.classList.add("in-view"));
  else {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("in-view"); io.unobserve(e.target); }
    }), { threshold: 0.15 });
    reveals.forEach((el) => io.observe(el));
  }

  // ---- 數字：等資料載入後換成真實數字，捲到時從 0 跳上去 ----
  function countUp(el, target) {
    if (reduce) { el.textContent = target.toLocaleString(); return; }
    const start = performance.now();
    const tick = (now) => {
      const t = clamp((now - start) / 1400, 0, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - t, 3))).toLocaleString();
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  Mu.boot(async function (meta) {
    const stats = { items: meta.items, archives: meta.archives, photos: meta.photos, groups: Object.keys(meta.pool).length };
    const nums = [...document.querySelectorAll("[data-w]")];
    nums.forEach((el) => (el.dataset.target = stats[el.dataset.w]));
    const box = document.querySelector(".w-stats");
    const run = () => nums.forEach((el) => countUp(el, +el.dataset.target));
    if (!box || reduce || !("IntersectionObserver" in window)) run();
    else {
      const io = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) { run(); io.disconnect(); }
      }, { threshold: 0.4 });
      io.observe(box);
    }
    await today(meta);
  });

  // ---- 今天的展櫃：從幾個朝代各抽一件有照片的文物 ----
  async function today(meta) {
    const { esc, el, shuffle } = Mu;
    const box = document.getElementById("today");
    const groups = shuffle(Mu.GROUPS.map((g) => g.id).filter((g) => meta.pool[g] >= 5)).slice(0, 8);
    try {
      const lists = await Promise.all(groups.map((g) => Mu.pool({ grp: g, k: 4 })));
      lists.map((l) => shuffle(l)[0]).filter(Boolean)
        .sort((a, b) => Mu.GROUP[a.grp].order - Mu.GROUP[b.grp].order)
        .forEach((it) => {
          const a = el('<a class="acard" href="' + Mu.artifactPage(it) + '"><span class="pic"></span><div class="info"><b>' + esc(it.name) + "</b><small>" +
            esc(Mu.gname(it.grp) + "・" + it.catInfo.name) + "</small></div></a>");
          a.querySelector(".pic").replaceWith(Mu.photo(it));
          box.appendChild(a);
        });
    } catch (e) {
      console.error(e);
      box.replaceWith(el('<p class="lead">展櫃暫時打不開，請到<a href="/artifact">文物小百科</a>看看。</p>'));
    }
  }
})();
