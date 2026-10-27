/* 分類闖關：看文物照片選它是哪一類。
   國小：外觀差很多的五類，三選一；國中：十類，四選一；高中：干擾選項專挑容易混的（玉器配雕刻、陶瓷配琺瑯配漆器…）。
   「雜項」不考：鼻煙壺、印章、珊瑚都在裡面，本身沒有固定樣子，當答案會有爭議；件數太少的分類也不考。 */
Mu.boot(function () {
  const { esc, el, shuffle } = Mu;
  const root = document.getElementById("game");
  const CATS = {
    e: ["ceramic", "jade", "bronze", "coin", "painting"],
    j: ["ceramic", "jade", "bronze", "coin", "painting", "enamel", "lacquer", "carving", "studio", "calligraphy"],
  };
  CATS.s = CATS.j;
  // 高中的干擾選項：材質或外觀容易搞混的組
  const CONFUSE = [["jade", "carving", "studio"], ["ceramic", "enamel", "lacquer"], ["painting", "calligraphy"], ["bronze", "coin", "enamel"]];
  const INTRO = {
    e: "看照片，猜猜它是陶瓷、玉器、銅器、錢幣還是繪畫。",
    j: "再加上琺瑯、漆器、雕刻、文具和法書，四選一。",
    s: "選項都是很容易搞混的材質，要看清楚光澤、顏色和做法。",
  };

  function options(cat, lv) {
    const all = CATS[lv];
    const k = Mu.LEVELS[lv].choices - 1;
    let others = shuffle(all.filter((c) => c !== cat));
    if (lv === "__off__") {
      const near = new Set(CONFUSE.filter((g) => g.includes(cat)).flat());
      others = shuffle(others.filter((c) => near.has(c))).concat(shuffle(others.filter((c) => !near.has(c))));
    }
    return shuffle([cat].concat(others.slice(0, k)));
  }

  // 每一類平均抽，不然陶瓷佔一半
  async function fetchRounds(n, lv) {
    const cats = CATS[lv].filter((c) => (Mu.meta.cats[c] || 0) >= 2);
    const per = Math.max(2, Math.ceil(n / cats.length) + 1);
    const lists = await Promise.all(cats.map((c) => Mu.pool({ cat: c, k: per })));
    const items = shuffle([].concat(...lists.map((l) => shuffle(l).slice(0, per)))).slice(0, n);
    return items.map((it) => ({
      item: it,
      prompt: "這件「" + esc(it.name) + "」是哪一類文物？",
      options: options(it.cat, lv).map((c) => ({ id: c, label: Mu.CAT[c].emoji + " " + Mu.CAT[c].name, sub: lv === "e" ? Mu.CAT[c].hint : "" })),
      answer: it.cat,
      explain: "是" + esc(it.catInfo.name) + "：" + esc(it.catInfo.hint) + "。",
    }));
  }

  function menu() {
    const lv = Mu.level();
    document.getElementById("intro").textContent = INTRO[lv];
    root.replaceChildren(el(
      '<div class="stage"><h2>目前年級：' + esc(Mu.LEVELS[lv].name) + '</h2><p>可以在右上角換年級。</p>' +
      '<p><button class="btn primary big" id="go10">開始（10 題）</button> <button class="btn big" id="go60">⏱️ 60 秒挑戰</button></p></div>'
    ));
    root.querySelector("#go10").onclick = () => start(false);
    root.querySelector("#go60").onclick = () => start(true);
  }

  async function start(timed) {
    const lv = Mu.level();
    root.replaceChildren(el('<div class="loading">正在挑文物…</div>'));
    try {
      const rounds = await fetchRounds(timed ? 40 : 10, lv);
      if (!rounds.length) throw new Error("沒有題目");
      Quiz.run(root, {
        key: (timed ? "classify-timed-" : "classify-") + lv,
        title: "分類闖關（" + Mu.LEVELS[lv].name + "）",
        rounds, timed: timed ? 60 : 0,
        onAgain: () => start(timed),
      });
    } catch (e) {
      console.error(e);
      root.replaceChildren(el('<div class="err">題目載入失敗，請檢查網路後再試一次。<br><button class="btn" id="re">再試一次</button></div>'));
      root.querySelector("#re").onclick = () => start(timed);
    }
  }
  document.addEventListener("mu-level", menu);
  menu();
});
