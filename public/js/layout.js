/* 頁首（導覽列＋難度切換）、頁尾（授權標示）與頁面啟動器。每頁 <body data-page="..."> 決定導覽列亮哪一個。 */
(function () {
  "use strict";
  const NAV = [
    ["artifact", "小百科", "/artifact"],
    ["era", "猜朝代", "/era"],
    ["timeline", "排排站", "/timeline"],
    ["classify", "分類闖關", "/classify"],
    ["passport", "護照", "/passport"],
    ["teacher", "教師專區", "/teacher"],
  ];
  const page = document.body.dataset.page || "";
  const wrap = document.createElement("div");
  wrap.className = "wrap";
  const main = document.querySelector("main");
  main.before(wrap);
  const lv = Mu.level();
  wrap.innerHTML =
    '<header class="top"><a class="logo" href="/">🏛️ 故宮探險家</a><nav aria-label="主選單">' +
    NAV.map((n) => '<a href="' + n[2] + '"' + (n[0] === page ? ' aria-current="page"' : "") + ">" + n[1] + "</a>").join("") +
    '</nav><label class="lvl">難度<select id="lvl" aria-label="題目難度">' +
    Object.entries(Mu.LEVELS).map(([k, v]) => '<option value="' + k + '"' + (k === lv ? " selected" : "") + ">" + v.name + "</option>").join("") +
    "</select></label></header>";
  wrap.appendChild(main);
  wrap.querySelector("#lvl").onchange = (e) => Mu.setLevel(e.target.value);

  // 授權標示：照故宮「網站資料開放宣告」的要求，文字 CC BY 4.0 要標中文姓名標示；低階圖 CC0 不必標，但仍註明來源
  const foot = document.createElement("footer");
  foot.className = "foot";
  foot.innerHTML =
    "<div class=\"foot-brand\"><img src=\"/img/hunglun-logo.webp\" alt=\"鴻綸科技\" width=\"282\" height=\"56\"></div>" +
    "<p class=\"foot-copy\">本站資料主要為政府單位開放資料，資料版權屬原資料提供單位，由鴻綸科技整理製作。本站程式、介面設計與整理編排 © 2026 鴻綸科技股份有限公司 版權所有，未經書面同意，不得轉載、複製、改作或仿製。</p>" +
    '<p id="data-stamp" hidden></p>';
  wrap.appendChild(foot);

  // Mu.boot(fn)：載入 meta 後呼叫 fn(meta)，處理載入中與失敗畫面
  window.Mu.boot = async function (fn) {
    main.insertAdjacentHTML("beforeend", '<div class="loading" id="boot">正在打開展櫃…🏛️</div>');
    try {
      const meta = await Mu.loadMeta();
      document.getElementById("boot").remove();
      document.getElementById("data-stamp").textContent =
        "目前收錄文物 " + meta.items.toLocaleString() + " 件、清代檔案 " + meta.archives.toLocaleString() + " 件，其中 " +
        meta.photos.toLocaleString() + " 件有照片可以玩遊戲。資料匯入日期：" + String(meta.importedAt || "").slice(0, 10) + "。";
      document.querySelectorAll("[data-stat]").forEach((e) => {
        const v = meta[e.dataset.stat];
        if (v != null) e.textContent = Number(v).toLocaleString();
      });
      await fn(meta);
      // 量「畫面可以操作」的時間用：測試腳本讀 <html data-ready>（毫秒）
      performance.mark("mu-ready");
      document.documentElement.dataset.ready = Math.round(performance.now());
    } catch (e) {
      console.error(e);
      const b = document.getElementById("boot");
      if (b) { b.className = "err"; b.innerHTML = '資料載入失敗了。請檢查網路後重新整理。<br><button class="btn" onclick="location.reload()">重新整理</button>'; }
    }
  };
})();
