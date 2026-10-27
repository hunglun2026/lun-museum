/* 教師專區：分頁切換、學習單產生與列印、出題投影（含 10 秒倒數）、課程包一鍵帶入。計分板在 p-board.js。
   題目難度跟著頁首的難度；範圍選單也依難度列出可選的朝代。 */
Mu.boot(function (meta) {
  const { esc, el } = Mu;
  const $ = (id) => document.getElementById(id);
  $("gen").disabled = false; // 資料載入完才能按（HTML 裡預設停用）
  $("gen2").disabled = false;

  // ---- 分頁 ----
  const tabs = document.querySelectorAll(".tab");
  const showTab = (name) => {
    tabs.forEach((x) => x.setAttribute("aria-selected", String(x.dataset.tab === name)));
    document.querySelectorAll("main > section").forEach((s) => (s.hidden = s.id !== "tab-" + name));
  };
  tabs.forEach((t) => (t.onclick = () => showTab(t.dataset.tab)));
  // 網址 #guide、#board 這類可以直接打開那個分頁（首頁引導入口、使用說明會連過來）
  const fromHash = () => { const h = location.hash.slice(1); if ([...tabs].some((t) => t.dataset.tab === h)) showTab(h); };
  window.addEventListener("hashchange", fromHash);
  fromHash();
  Board.init($("tab-board"));

  // ---- 範圍與題型（依難度重畫）----
  function fillSelects() {
    const lv = Mu.level();
    const keep = { grp: $("grp").value, kind: $("kind").value };
    $("grp").innerHTML = '<option value="">' + esc(Mu.LEVELS[lv].name) + "範圍的全部朝代</option>" +
      Mu.LEVELS[lv].groups.filter((g) => meta.pool[g]).map((g) => '<option value="' + esc(g) + '">' + esc(Mu.gname(g)) + "</option>").join("");
    $("cat").innerHTML = '<option value="">全部分類</option>' +
      Mu.CATS.filter((c) => meta.cats[c.id]).map((c) => '<option value="' + c.id + '">' + c.emoji + " " + esc(c.name) + "</option>").join("");
    const kinds = [["mix", "混合題型"]].concat(Object.entries(Qgen.KINDS).filter(([k]) => k !== "reign" || lv === "s").map(([k, v]) => [k, v.name]));
    $("kind").innerHTML = kinds.map((k) => '<option value="' + k[0] + '">' + esc(k[1]) + "</option>").join("");
    if ([...$("grp").options].some((o) => o.value === keep.grp)) $("grp").value = keep.grp;
    if ([...$("kind").options].some((o) => o.value === keep.kind)) $("kind").value = keep.kind;
  }
  fillSelects();
  document.addEventListener("mu-level", fillSelects);

  async function questions() {
    const lv = Mu.level();
    const n = +$("num").value;
    const kind = $("kind").value;
    const types = kind === "mix" ? Object.keys(Qgen.KINDS).filter((k) => k !== "reign" || lv === "s") : [kind];
    const pool = await Qgen.fetchPool({ lv, grp: $("grp").value, cat: $("cat").value, n, reign: types.includes("reign"), onlyReign: kind === "reign" });
    return Qgen.make(pool, types, n, lv);
  }
  const scopeName = () => Mu.LEVELS[Mu.level()].name + "・" + $("grp").selectedOptions[0].textContent + "・" + $("cat").selectedOptions[0].textContent;

  async function getQs(btn) {
    btn.disabled = true;
    try { return await questions(); } catch (e) { console.error(e); await Mu.dialog("題目載入失敗，請檢查網路後再試一次。"); return []; } finally { btn.disabled = false; }
  }

  // ---- 學習單 ----
  let sheetQs = [];
  $("gen").onclick = async () => {
    sheetQs = await getQs($("gen"));
    if (!sheetQs.length) { await Mu.dialog("這個範圍找不到足夠的題目，請換一個朝代、分類或題型。"); return; }
    // 範圍太小湊不滿題數時要講，不然老師會以為印出來的是完整份
    if (sheetQs.length < +$("num").value) await Mu.dialog("這個範圍和題型只湊得到 " + sheetQs.length + " 題（你選了 " + $("num").value + " 題）。可以換成「混合題型」或放寬範圍來湊滿。");
    const head = (ans) =>
      "<h2>🏛️ 故宮探險家學習單" + (ans ? "（答案）" : "") + "</h2><p>範圍：" + esc(scopeName()) + "　班級：<span class='blank' style='min-width:4em'></span>　座號：<span class='blank' style='min-width:3em'></span>　姓名：<span class='blank'></span></p>";
    const body = (ans) => sheetQs.map((q, i) => {
      let h = '<div class="q"><b>' + (i + 1) + ".</b> " + esc(q.q);
      if (q.pic && q.item.photo) h += '<br><img class="qimg" src="' + esc(Mu.imgUrl(q.item)) + '" alt="第 ' + (i + 1) + ' 題的文物照片">';
      h += "<br>" + q.choices.map((c) => (ans && c === q.answer ? '<span class="ans">● ' : "○ <span>") + esc(c) + "</span>").join("　　");
      return h + "</div>";
    }).join("");
    $("sheet").innerHTML =
      head(false) + body(false) +
      '<p style="font-size:.8rem">文物資料：國立故宮博物院，臺北，CC BY 4.0 @ www.npm.gov.tw。圖片：故宮開放低階圖像（CC0）。故宮探險家 museum.hunglun.com</p>' +
      ($("withAns").checked ? '<div class="pb"></div>' + head(true) + body(true) : "");
    $("sheet").hidden = false;
    $("print").disabled = false;
    $("sheet").scrollIntoView({ behavior: "smooth", block: "start" });
  };
  // 等學習單上的照片都載完才列印，不然網路慢時會印出空白框
  $("print").onclick = async () => {
    const imgs = [...$("sheet").querySelectorAll("img")].filter((i) => !i.complete);
    await Promise.all(imgs.map((i) => new Promise((r) => { i.addEventListener("load", r); i.addEventListener("error", r); })));
    window.print();
  };

  // ---- 出題投影 ----
  let cd = null; // 10 秒倒數；放外層，重新出題時才停得掉上一輪的
  $("gen2").onclick = async () => {
    const qs = await getQs($("gen2"));
    if (!qs.length) { await Mu.dialog("這個範圍找不到足夠的題目，請換一個朝代、分類或題型。"); return; }
    clearInterval(cd);
    let i = 0, showAns = false;
    const box = $("slide");
    box.hidden = false;
    const draw = () => {
      clearInterval(cd); // 換題就停掉倒數
      const q = qs[i];
      box.replaceChildren(el(
        "<div><p>第 " + (i + 1) + " / " + qs.length + " 題</p>" +
        '<div id="pic"></div><h2 style="font-size:2rem">' + esc(q.q) + "</h2>" +
        '<div class="opts">' + q.choices.map((c) => '<div class="opt' + (showAns && c === q.answer ? " right" : "") + '">' + esc(c) + "</div>").join("") + "</div>" +
        '<div class="feedback ok" style="font-size:2rem">' + (showAns ? "答案：" + esc(q.answer) : "") + "</div>" +
        '<div class="timer" id="cd" aria-live="polite"></div>' +
        '<p class="noprint"><button class="btn big" id="prev">◀ 上一題</button> <button class="btn big" id="ten">⏱️ 10 秒</button> <button class="btn primary big" id="show">' + (showAns ? "隱藏答案" : "顯示答案") + '</button> <button class="btn big" id="next">下一題 ▶</button></p></div>'
      ));
      box.querySelector("#pic").appendChild(Mu.photo(q.item, true));
      box.querySelector("#prev").onclick = () => { i = Math.max(0, i - 1); showAns = false; draw(); };
      box.querySelector("#next").onclick = () => { i = Math.min(qs.length - 1, i + 1); showAns = false; draw(); };
      box.querySelector("#show").onclick = () => { showAns = !showAns; draw(); };
      // 10 秒倒數：給全班想一想再舉手，時間到響三聲
      box.querySelector("#ten").onclick = () => {
        let left = 10;
        const t = box.querySelector("#cd");
        clearInterval(cd);
        t.textContent = left;
        cd = setInterval(() => {
          left--;
          t.textContent = left > 0 ? left : "時間到！";
          if (left > 0 && left <= 3) Fx.tick();
          if (left <= 0) { clearInterval(cd); Fx.ding(); }
        }, 1000);
      };
    };
    draw();
    box.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // ---- 課程包：一鍵帶入難度、朝代、分類、題型、題數，直接產生 ----
  document.querySelectorAll("[data-pack]").forEach((b) => (b.onclick = () => {
    const [lv, grp, cat, kind, num] = b.dataset.pack.split(",");
    if (lv) { Mu.setLevel(lv); document.getElementById("lvl").value = lv; }
    $("grp").value = grp; $("cat").value = cat; $("kind").value = kind; $("num").value = num;
    showTab("sheet");
    $("gen").click();
  }));
});
