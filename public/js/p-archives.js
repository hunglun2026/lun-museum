/* 史料探究：主題 → 每十年幾份奏摺（橫條圖）、寫最多份的官員、點一個十年列出那段時間的檔案；可列印探究學習單。
   探究問題只寫開放式提問，不在題目裡放歷史事實當答案（避免網站寫錯的內容被當成標準答案）。 */
Mu.boot(function () {
  const { esc, el } = Mu;
  const $ = (id) => document.getElementById(id);
  // 主題：檔案裡實際查得到、件數夠的詞（2026-10-21 用匯入資料確認過）
  const TOPICS = ["臺灣", "海防", "鴉片", "鐵路", "教案", "林爽文", "地震", "蝗", "水災", "米價", "日本", "法國"];
  const QUESTIONS = [
    "這個主題的奏摺在哪一個十年最多？那段時間發生了什麼事？請查課本或其他資料，說說你的推測。",
    "奏摺最早出現在哪一年？為什麼在那之前很少（或沒有）人寫？",
    "寫最多份的官員是誰？他的官職跟這個主題有什麼關係？",
    "挑一份奏摺，從標題猜猜看官員想向皇帝報告或請求什麼。點進故宮原件頁，看看猜得對不對。",
  ];
  const st = { q: "", seq: 0 };

  $("topics").innerHTML = '<span class="lab">主題</span>' + TOPICS.map((t) => '<button class="chip" type="button">' + esc(t) + "</button>").join("");
  $("topics").querySelectorAll(".chip").forEach((b) => (b.onclick = () => { $("q").value = b.textContent; go(); }));
  $("f").onsubmit = (e) => { e.preventDefault(); go(); };

  async function go() {
    st.q = $("q").value.trim();
    if (!st.q) return;
    $("topics").querySelectorAll(".chip").forEach((b) => b.setAttribute("aria-pressed", String(b.textContent === st.q)));
    history.replaceState(null, "", "?q=" + encodeURIComponent(st.q));
    const seq = ++st.seq;
    $("out").replaceChildren(el('<div class="loading">正在翻檔案…</div>'));
    let h;
    try { h = await Mu.api("/api/archives/hist", { q: st.q }); } catch (e) {
      $("out").replaceChildren(el('<div class="err">載入失敗，請檢查網路後再試一次。</div>'));
      return;
    }
    if (seq !== st.seq) return; // 連續換主題時只畫最新的
    if (!h.total) { $("out").replaceChildren(el('<p class="lead">檔案裡找不到「' + esc(st.q) + "」，換個詞試試看。</p>")); return; }
    const max = Math.max(...h.decades.map((d) => d.n), 1);
    const peak = h.decades.reduce((a, b) => (b.n > a.n ? b : a), { n: 0 });
    const box = el(
      '<div><p class="count">「' + esc(st.q) + "」共 " + h.total.toLocaleString() + " 份檔案" + (peak.n ? "，最多的是 " + peak.decade + " 年代（" + peak.n + " 份）" : "") + "。點長條看那十年的檔案。</p>" +
      '<div class="hist" id="hist"></div>' +
      "<h2>寫最多份的官員</h2><div class=\"alist\">" + h.people.map((p) => '<div class="arow"><span class="y">' + p.n + ' 份</span><span><b>' + esc(p.person) + "</b><br><small>" + esc(p.office || "官職未載") + "</small></span></div>").join("") + "</div>" +
      '<h2 id="decTitle" hidden></h2><div class="alist" id="docs"></div><p class="more"><button class="btn" id="more" hidden>載入更多</button></p>' +
      '<h2>探究問題</h2><div class="panel"><ol>' + QUESTIONS.map((q) => "<li>" + esc(q) + "</li>").join("") + "</ol>" +
      '<p class="noprint"><button class="btn" id="print">🖨️ 列印探究學習單</button></p></div></div>'
    );
    const hist = box.querySelector("#hist");
    h.decades.forEach((d) => {
      const b = el('<button class="hbar"><span class="hl">' + d.decade + ' 年代</span><span class="ht"><i style="width:' + Math.max(2, (d.n / max) * 100) + '%"></i></span><span class="hn">' + d.n + "</span></button>");
      b.onclick = () => { hist.querySelectorAll(".hbar").forEach((x) => x.classList.toggle("on", x === b)); docs(box, d.decade); };
      hist.appendChild(b);
    });
    box.querySelector("#print").onclick = () => window.print();
    $("out").replaceChildren(box);
  }

  // 某個十年的檔案，依年代排，30 份一頁
  async function docs(box, decade) {
    let page = 0;
    const list = box.querySelector("#docs");
    const more = box.querySelector("#more");
    const title = box.querySelector("#decTitle");
    title.hidden = false;
    title.textContent = decade + "～" + (decade + 9) + " 年的「" + st.q + "」檔案";
    list.replaceChildren();
    const load = async () => {
      more.disabled = true;
      const r = await Mu.api("/api/archives", { q: st.q, from: decade, to: decade + 9, page });
      r.items.forEach((a) => {
        const who = [a.person, a.office].filter(Boolean).join("・");
        list.appendChild(el('<a class="arow" href="' + esc(Mu.archiveUrl(a.id)) + '" target="_blank" rel="noopener"><span class="y">' + esc(a.year) +
          '</span><span><b>' + esc(a.title) + "</b><br><small>" + esc([a.date_raw, who].filter(Boolean).join("｜")) + "</small></span></a>"));
      });
      more.hidden = r.items.length < 30;
      more.disabled = false;
      page++;
    };
    more.onclick = load;
    await load();
    title.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const q0 = new URLSearchParams(location.search).get("q");
  if (q0) { $("q").value = q0; go(); }
});
