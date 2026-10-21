/* 猜猜哪個朝代：看文物照片選朝代。
   國小：漢、唐、宋、明、清與新石器時代，三選一；國中：全部朝代，四選一（干擾選項挑時間相近的，比較需要想）；
   高中：明清文物問「哪個皇帝年號」，其他朝代同國中。題庫依朝代平均抽，不然清朝佔一半以上。 */
Mu.boot(function () {
  const { esc, el, shuffle } = Mu;
  const root = document.getElementById("game");
  const INTRO = {
    e: "看照片和名字，猜猜它是哪個朝代做的。從漢、唐、宋、明、清和新石器時代裡選。",
    j: "所有朝代都會出現，選項裡的朝代時間很接近，要仔細想。",
    s: "明朝和清朝的文物要答出是哪個皇帝的年號，其他朝代答朝代。",
  };

  // 依朝代平均抽題：每個朝代群各要 per 件
  async function fetchRounds(n) {
    const lv = Mu.level();
    const groups = Mu.LEVELS[lv].groups.filter((g) => Mu.meta.pool[g]);
    const per = Math.max(2, Math.ceil(n / groups.length) + 1);
    const lists = await Promise.all(groups.map((g) => Mu.pool({ grp: g, k: per, reign: lv === "s" && (g === "明" || g === "清") ? "1" : "" })));
    const items = shuffle([].concat(...lists.map((l) => shuffle(l).slice(0, per)))).slice(0, n);
    return items.map((it) => build(it, lv, groups));
  }

  function build(it, lv, groups) {
    const head = '這件<b>' + esc(it.catInfo.name) + "</b>「" + esc(Mu.maskName(it)) + "」";
    const ri = lv === "s" ? Mu.reignInfo(it.dyn, it.reign) : null;
    if (ri) {
      const opts = Qgen.reignChoices(ri);
      return {
        item: it,
        prompt: head + "是" + esc(Mu.gname(it.grp)) + "哪個皇帝年號做的？",
        options: opts.map((r) => ({ id: r, label: r })),
        answer: ri.name,
        explain: "是「" + esc(ri.name) + "」，大約西元 " + ri.y0 + "～" + ri.y1 + " 年。故宮寫的時代是：" + esc(it.era) + "。",
      };
    }
    const k = Mu.LEVELS[lv].choices - 1;
    const opts = shuffle([it.grp].concat(Qgen.nearGroups(it.grp, groups, k, lv !== "e")));
    return {
      item: it,
      prompt: head + "是哪個朝代做的？",
      options: opts.map((g) => ({ id: g, label: Mu.gname(g), sub: lv === "e" ? Mu.GROUP[g].y : "" })),
      answer: it.grp,
      explain: "是" + esc(Mu.gname(it.grp)) + "（" + esc(Mu.GROUP[it.grp].y) + "）。故宮寫的時代是：" + esc(it.era) + "。",
    };
  }

  function menu() {
    const lv = Mu.level();
    document.getElementById("intro").textContent = INTRO[lv];
    root.replaceChildren(el(
      '<div class="stage"><h2>目前難度：' + esc(Mu.LEVELS[lv].name) + '</h2><p>可以在右上角換難度。</p>' +
      '<p><button class="btn primary big" id="go10">開始（10 題）</button> <button class="btn big" id="go60">⏱️ 60 秒挑戰</button></p></div>'
    ));
    root.querySelector("#go10").onclick = () => start(false);
    root.querySelector("#go60").onclick = () => start(true);
  }

  async function start(timed) {
    const lv = Mu.level();
    root.replaceChildren(el('<div class="loading">正在挑文物…</div>'));
    try {
      const rounds = await fetchRounds(timed ? 40 : 10);
      if (!rounds.length) throw new Error("沒有題目");
      Quiz.run(root, {
        key: (timed ? "era-timed-" : "era-") + lv,
        title: "猜猜哪個朝代（" + Mu.LEVELS[lv].name + "）",
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
