/* 出題產生器：學習單與「出題投影」共用。
   Qgen.fetchPool({ lv, grp, cat, n }) → 依朝代平均抽的文物（有照片、可出題）
   Qgen.make(pool, types, n, lv) → [{ kind, item, q, choices[], answer, pic }]
   所有題目都是選擇題、答案唯一；choices 是顯示文字，answer 是正確答案文字。 */
(function () {
  "use strict";
  const { shuffle } = Mu;

  const KINDS = {
    era: { name: "哪個朝代", ok: (it) => !!it.grp },
    cat: { name: "屬於哪一類", ok: () => true },
    picture: { name: "看圖選名稱", ok: (it) => !!it.photo },
    reign: { name: "哪個年號（高中）", ok: (it, lv) => lv === "__off__" && !!Mu.reignInfo(it.dyn, it.reign) },
  };

  // 時間上離 ans 最近的 k 個朝代群（國小隨機）
  function nearGroups(ans, groups, k, near) {
    const others = groups.filter((g) => g !== ans);
    if (!near) return shuffle(others).slice(0, k);
    const o = Mu.GROUP[ans].order;
    return others.sort((a, b) => Math.abs(Mu.GROUP[a].order - o) - Math.abs(Mu.GROUP[b].order - o)).slice(0, k);
  }

  // 年號選項：正確年號＋前後三個以內的年號（離太遠的一看就排除）
  function reignChoices(ri) {
    const at = ri.list.indexOf(ri.name);
    return shuffle([ri.name].concat(shuffle(ri.list.filter((r, i) => r !== ri.name && Math.abs(i - at) <= 3)).slice(0, 3)));
  }

  function build(kind, it, pool, lv) {
    const k = Mu.LEVELS[lv].choices - 1;
    const name = "「" + (kind === "era" || kind === "reign" ? Mu.maskName(it) : it.name) + "」";
    if (kind === "era") {
      const groups = Mu.LEVELS[lv].groups;
      const ch = shuffle([it.grp].concat(nearGroups(it.grp, groups, k, lv !== "e"))).map(Mu.gname);
      return { q: name + "是哪個朝代做的？", choices: ch, answer: Mu.gname(it.grp), pic: true };
    }
    if (kind === "cat") {
      const others = shuffle(Mu.CATS.filter((c) => c.id !== it.cat)).slice(0, k);
      const ch = shuffle([it.catInfo].concat(others)).map((c) => c.name);
      return { q: name + "屬於哪一類文物？", choices: ch, answer: it.catInfo.name, pic: true };
    }
    if (kind === "reign") {
      const ri = Mu.reignInfo(it.dyn, it.reign);
      const ch = reignChoices(ri);
      return { q: Mu.gname(it.grp) + "的" + name + "是哪個皇帝年號做的？", choices: ch, answer: ri.name, pic: true };
    }
    // 看圖選名稱：干擾選項用同一類的其他文物，不然一看類別就知道答案
    const names = new Set([it.name]);
    for (const x of shuffle(pool.filter((x) => x.cat === it.cat)).concat(shuffle(pool))) {
      if (names.size > k) break;
      names.add(x.name);
    }
    return { q: "照片裡的是哪一件文物？", choices: shuffle([...names]), answer: it.name, pic: true };
  }

  function make(pool, types, n, lv) {
    const out = [];
    let t = 0;
    for (const it of shuffle(pool)) {
      if (out.length >= n) break;
      for (let j = 0; j < types.length; j++) {
        const kind = types[(t + j) % types.length];
        if (KINDS[kind].ok(it, lv)) {
          out.push(Object.assign({ kind, item: it }, build(kind, it, pool, lv)));
          t = (t + j + 1) % types.length;
          break;
        }
      }
    }
    return out;
  }

  // 依朝代平均抽：指定 grp 就只抽那個朝代；高中多抽有年號的明清文物，年號題才湊得到
  async function fetchPool(o) {
    let groups = o.grp ? [o.grp] : Mu.LEVELS[o.lv].groups.filter((g) => Mu.meta.pool[g]);
    // 只出年號題：只有明清文物出得了，平均抽全部朝代會湊不滿題數
    if (o.onlyReign) groups = groups.filter((g) => g === "明" || g === "清");
    const per = Math.max(4, Math.ceil((o.n * 2) / groups.length));
    const lists = await Promise.all(groups.map((g) => Mu.pool({ grp: g, cat: o.cat || "", k: Math.min(per, 60), reign: o.reign && (g === "明" || g === "清") ? "1" : "" })));
    return [].concat(...lists);
  }

  window.Qgen = { make, fetchPool, nearGroups, reignChoices, KINDS };
})();
