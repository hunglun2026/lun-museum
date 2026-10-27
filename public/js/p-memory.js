/* 翻牌配對：照片牌對名稱牌，記翻牌次數與秒數。
   國小 6 對、各類混合；國中 8 對、各類混合；高中 8 對、整盤同一類（名稱很像，要看紋飾才配得出來）。
   名稱太長的牌面放不下，只挑短的。 */
Mu.boot(function () {
  const { esc, el, shuffle } = Mu;
  const root = document.getElementById("game");
  const PAIRS = { e: 6, j: 8, s: 8 };
  const MAXLEN = { e: 7, j: 9, s: 10 };
  const BOARD_CATS = ["ceramic", "jade", "bronze", "enamel", "coin", "lacquer", "carving", "studio", "painting"];
  const INTRO = {
    e: "把文物的照片和名字配成一對。一次翻兩張，一樣的就留著，不一樣的會蓋回去。",
    j: "8 對，各種文物混在一起。",
    s: "整盤都是同一類文物，名字很像，要仔細看紋飾和形狀。",
  };
  const bestKey = (lv) => "mu-best-memory-" + lv;
  const getBest = (lv) => { try { return +localStorage.getItem(bestKey(lv)) || 0; } catch (e) { return 0; } };

  // 挑 n 件名稱不重複、夠短的文物
  async function pickItems(lv, n) {
    const ok = (it) => it.name.length <= MAXLEN[lv] && it.photo;
    let lists;
    if (lv === "s") {
      const cat = shuffle(BOARD_CATS.filter((c) => (Mu.meta.cats[c] || 0) >= 30))[0];
      lists = [await Mu.pool({ cat, k: 60 })];
    } else {
      const cats = shuffle(BOARD_CATS.filter((c) => (Mu.meta.cats[c] || 0) >= 5)).slice(0, n);
      lists = await Promise.all(cats.map((c) => Mu.pool({ cat: c, k: 8 })));
    }
    const seen = new Set(), out = [];
    for (let k = 0; out.length < n && k < 60; k++) {
      for (const l of lists) {
        const it = l[k];
        if (it && ok(it) && !seen.has(it.name) && out.length < n) { seen.add(it.name); out.push(it); }
      }
    }
    return out;
  }

  function menu() {
    const lv = Mu.level();
    document.getElementById("intro").textContent = INTRO[lv];
    root.replaceChildren(el('<div class="stage"><h2>目前年級：' + esc(Mu.LEVELS[lv].name) + "（" + PAIRS[lv] + ' 對）</h2><p>可以在右上角換年級。</p><p><button class="btn primary big" id="go">開始翻牌</button></p></div>'));
    root.querySelector("#go").onclick = () => play(lv);
  }

  async function play(lv) {
    root.replaceChildren(el('<div class="loading">正在洗牌…</div>'));
    let picked;
    try { picked = await pickItems(lv, PAIRS[lv]); } catch (e) { console.error(e); picked = []; }
    if (picked.length < 4) {
      root.replaceChildren(el('<div class="err">題目載入失敗，請檢查網路後再試一次。<br><button class="btn" id="re">再試一次</button></div>'));
      root.querySelector("#re").onclick = () => play(lv);
      return;
    }
    const n = picked.length;
    const cards = shuffle(picked.flatMap((it) => [{ it, kind: "pic" }, { it, kind: "name" }]));
    let first = null, lock = false, flips = 0, found = 0;
    const t0 = Date.now();
    const head = el('<p class="lead" style="text-align:center">翻牌 <b id="flips">0</b> 次　配對 <b id="found">0</b> / ' + n + (lv === "s" ? "　這盤都是 " + esc(picked[0].catInfo.name) : "") + "</p>");
    const board = el('<div class="memory"></div>');
    root.replaceChildren(head, board);

    cards.forEach((c) => {
      const b = el('<button class="mcard" aria-label="蓋著的牌"><span class="back" aria-hidden="true">🏛️</span><span class="front"></span></button>');
      const front = b.querySelector(".front");
      if (c.kind === "pic") {
        const p = Mu.photo(c.it);
        p.loading = "eager"; // 牌蓋著時也先載好，翻開才不會空白
        front.appendChild(p);
      } else front.innerHTML = "<b>" + esc(c.it.name) + "</b>";
      c.btn = b;
      b.onclick = () => flip(c);
      board.appendChild(b);
    });

    function open(c, show) {
      c.btn.classList.toggle("up", show);
      c.btn.setAttribute("aria-label", show ? (c.kind === "pic" ? "照片：" : "名字：") + c.it.name : "蓋著的牌");
    }
    function flip(c) {
      if (lock || c.done || c === first) return;
      open(c, true);
      flips++;
      head.querySelector("#flips").textContent = flips;
      if (!first) { first = c; return; }
      const a = first;
      first = null;
      if (a.it === c.it) {
        a.done = c.done = true;
        a.btn.classList.add("ok"); c.btn.classList.add("ok");
        found++;
        head.querySelector("#found").textContent = found;
        Fx.right();
        if (found === n) setTimeout(done, 600);
      } else {
        lock = true;
        setTimeout(() => { open(a, false); open(c, false); lock = false; }, 1000);
      }
    }

    function done() {
      const sec = Math.round((Date.now() - t0) / 1000);
      // 最少要翻 2n 次；多翻幾次還算很棒
      const stars = flips <= n * 2 + 4 ? 3 : flips <= n * 2 + 12 ? 2 : 1;
      const prev = getBest(lv);
      try { if (!prev || flips < prev) localStorage.setItem(bestKey(lv), flips); } catch (e) { /* 忽略 */ }
      Progress.stars("memory-" + lv, stars);
      if (stars === 3) Fx.confetti();
      const box = el(
        '<div class="stage"><h2>全部配對完成！</h2><div class="stars" aria-label="' + stars + ' 顆星">' + "⭐".repeat(stars) + "☆".repeat(3 - stars) + "</div>" +
        "<p>翻了 <b>" + flips + "</b> 次，花了 <b>" + sec + "</b> 秒。" +
        (prev && flips < prev ? "🎊 打破紀錄！（上次 " + prev + " 次）" : prev ? "最佳紀錄：" + Math.min(prev, flips) + " 次" : "") + "</p>" +
        '<h3>這次認識的文物</h3><div class="chips" style="justify-content:center">' +
        picked.map((it) => '<a class="chip" style="text-decoration:none;color:inherit" href="' + Mu.artifactPage(it) + '" target="_blank" rel="noopener">' + it.catInfo.emoji + " " + esc(it.name) + "</a>").join("") +
        '</div><p><button class="btn primary big" id="again">再玩一次</button> <a class="btn big" href="/passport">看我的護照</a></p></div>'
      );
      root.replaceChildren(box);
      root.querySelector("#again").onclick = () => play(lv);
    }
  }
  document.addEventListener("mu-level", menu);
  menu();
});
