/* 朝代排排站：每回合幾件不同朝代的文物，依「最早到最晚」點下去排順序。
   用點的不用拖：平板上拖曳容易誤觸。低年級 3 件、中年級 4 件、高年級 5 件，共 5 回合。 */
Mu.boot(function () {
  const { esc, el, shuffle } = Mu;
  const root = document.getElementById("game");
  const SIZE = { e: 3, j: 4, s: 5 };
  const ROUNDS = 5;

  async function fetchRound(lv) {
    const groups = shuffle(Mu.LEVELS[lv].groups.filter((g) => Mu.meta.pool[g])).slice(0, SIZE[lv]);
    const lists = await Promise.all(groups.map((g) => Mu.pool({ grp: g, k: 4 })));
    return lists.map((l) => shuffle(l)[0]).filter(Boolean);
  }

  function menu() {
    const lv = Mu.level();
    document.getElementById("intro").textContent = "每回合有 " + SIZE[lv] + " 件不同朝代的文物，從最早的開始，依序點下去。共 " + ROUNDS + " 回合。";
    root.replaceChildren(el('<div class="stage"><h2>目前年級：' + esc(Mu.LEVELS[lv].name) + '</h2><p>可以在右上角換年級。</p><p><button class="btn primary big" id="go">開始排排站</button></p></div>'));
    root.querySelector("#go").onclick = () => play(lv);
  }

  async function play(lv) {
    let r = 0, right = 0;
    const wrongs = [];
    async function round() {
      root.replaceChildren(el('<div class="loading">正在挑文物…</div>'));
      let items;
      try { items = await fetchRound(lv); } catch (e) {
        root.replaceChildren(el('<div class="err">題目載入失敗，請檢查網路後再試一次。<br><button class="btn" id="re">再試一次</button></div>'));
        root.querySelector("#re").onclick = round;
        return;
      }
      const order = items.slice().sort((a, b) => Mu.GROUP[a.grp].order - Mu.GROUP[b.grp].order);
      const picked = [];
      const cardOf = new Map(); // 文物 → 它的卡片
      const stage = el('<div class="stage"><div class="bar"><i style="width:' + (r / ROUNDS) * 100 + '%"></i></div><p>第 ' + (r + 1) + " / " + ROUNDS +
        ' 回合　⭐ 答對 ' + right + ' 回合</p><h2 style="margin:.3em 0">從<b>最早</b>的開始，依序點下去</h2><div class="tl-pick" id="pick"></div>' +
        '<div class="feedback" id="fb" role="status" aria-live="polite"></div><div id="nx"></div></div>');
      const pick = stage.querySelector("#pick");
      items.forEach((it) => {
        const b = el('<button class="tl-card"><span class="pic"></span><b>' + esc(it.name) + "</b></button>");
        b.querySelector(".pic").replaceWith(Mu.photo(it));
        cardOf.set(it, b);
        b.onclick = () => {
          if (b.disabled) return;
          picked.push(it);
          b.disabled = true;
          b.insertAdjacentHTML("afterbegin", '<span class="no">' + picked.length + "</span>");
          if (picked.length === items.length) check(stage, picked, order, cardOf);
        };
        pick.appendChild(b);
      });
      root.replaceChildren(stage);
    }
    function check(stage, picked, order, cardOf) {
      const ok = picked.every((it, i) => it.grp === order[i].grp);
      ok ? (right++, Fx.right()) : (Fx.wrong(), wrongs.push(...picked.filter((it, i) => it.grp !== order[i].grp).map((it) => ({ item: it, answer: Mu.gname(it.grp) }))));
      // 卡片依學生點的順序重新排，第 i 張跟正確順序的第 i 個朝代比，標對錯與朝代
      const pick = stage.querySelector("#pick");
      picked.forEach((it, i) => {
        const c = cardOf.get(it);
        c.classList.add(it.grp === order[i].grp ? "right" : "wrong");
        c.querySelector("b").innerHTML = esc(it.name) + "<br><small>" + esc(Mu.gname(it.grp)) + "</small>";
        pick.appendChild(c);
      });
      const fb = stage.querySelector("#fb");
      fb.className = "feedback " + (ok ? "ok" : "no");
      fb.innerHTML = (ok ? "全部排對了！🎉" : "有幾件順序不對，正確順序是：") +
        '<div class="tl-line">' + order.map((it) => '<span style="background:' + Mu.GROUP[it.grp].color + '">' + esc(Mu.gname(it.grp)) + "</span>").join("→") + "</div>";
      const last = r === ROUNDS - 1;
      const next = el('<button class="btn primary big">' + (last ? "看成績 🏆" : "下一回合 ➜") + "</button>");
      next.onclick = () => { r++; last ? finish() : round(); };
      stage.querySelector("#nx").appendChild(next);
      next.focus();
    }
    function finish() {
      const stars = right >= 5 ? 3 : right >= 3 ? 2 : right > 0 ? 1 : 0;
      Progress.stars("timeline-" + lv, stars);
      if (stars === 3) Fx.confetti();
      const box = el('<div class="stage"><h2>朝代排排站（' + esc(Mu.LEVELS[lv].name) + '）完成！</h2><div class="stars" aria-label="' + stars + ' 顆星">' +
        "⭐".repeat(stars) + "☆".repeat(3 - stars) + '</div><div class="score">' + right + " / " + ROUNDS + "</div>" +
        "<p>" + (stars === 3 ? "時間軸完全在你腦袋裡！" : stars === 2 ? "很不錯，再玩一次可以拿到三顆星！" : "沒關係，多排幾次就記住朝代的順序了。") + "</p>" +
        '<div id="rv"></div><p><button class="btn primary big" id="again">再玩一次</button> <a class="btn big" href="/passport">看我的護照</a></p></div>');
      box.querySelector("#rv").appendChild(Quiz.review(wrongs));
      box.querySelector("#again").onclick = () => play(lv);
      root.replaceChildren(box);
    }
    round();
  }
  document.addEventListener("mu-level", menu);
  menu();
});
