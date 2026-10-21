/* 典藏搜尋：文物與清代檔案兩個分頁。網址帶 ?t=&q= 可以分享或從別頁連過來。 */
Mu.boot(function () {
  const { esc, el } = Mu;
  const $ = (id) => document.getElementById(id);
  const u = new URLSearchParams(location.search);
  const st = { t: u.get("t") === "archives" ? "archives" : "items", q: u.get("q") || "", page: 0, seq: 0 };
  const HOT = { items: ["青花", "玉璧", "翠玉", "鼎", "乾隆", "鼻煙壺", "汝窯", "龍"], archives: ["臺灣", "海防", "鴉片", "鐵路", "林爽文", "地震", "米價", "教案"] };

  const tabs = document.querySelectorAll(".tab");
  function setTab(t) {
    st.t = t;
    tabs.forEach((x) => x.setAttribute("aria-selected", String(x.dataset.t === t)));
    $("hot").innerHTML = '<span class="lab">試試看</span>' + HOT[t].map((w) => '<button class="chip" type="button">' + esc(w) + "</button>").join("");
    $("hot").querySelectorAll(".chip").forEach((b) => (b.onclick = () => { $("q").value = b.textContent; go(); }));
  }
  tabs.forEach((b) => (b.onclick = () => { setTab(b.dataset.t); if ($("q").value.trim()) go(); }));

  function itemCard(it) {
    const g = it.grpInfo;
    const a = el('<a class="acard" href="' + Mu.artifactPage(it) + '"><span class="pic"></span><div class="info"><b>' + esc(it.name) + '</b><div class="meta">' +
      (g ? '<span class="tag2 era" style="background:' + g.color + '">' + esc(Mu.gname(it.grp)) + "</span>" : it.era ? '<span class="tag2">' + esc(it.era) + "</span>" : "") +
      '<span class="tag2">' + esc(it.catInfo.name) + "</span></div></div></a>");
    a.querySelector(".pic").replaceWith(Mu.photo(it));
    return a;
  }
  function archRow(a) {
    const who = [a.person, a.office].filter(Boolean).join("・");
    return el('<a class="arow" href="' + esc(Mu.archiveUrl(a.id)) + '" target="_blank" rel="noopener"><span class="y">' + (a.year ? esc(a.year) : "年代未詳") +
      '</span><span><b>' + esc(a.title) + "</b><br><small>" + esc([a.kind, a.date_raw, who].filter(Boolean).join("｜")) + "</small></span></a>");
  }

  async function load() {
    $("more").disabled = true;
    const seq = ++st.seq; // 連續搜尋時舊請求可能比較晚回來，回來時已經不是最新的就丟掉
    const r = await Mu.api("/api/search", { t: st.t, q: st.q, page: st.page });
    if (seq !== st.seq) return;
    let box = $("out").firstElementChild;
    if (!box) { box = el('<div class="' + (st.t === "items" ? "grid" : "alist") + '"></div>'); $("out").appendChild(box); }
    r.items.forEach((x) => box.appendChild(st.t === "items" ? itemCard(Mu.enrich(x)) : archRow(x)));
    const shown = box.children.length;
    $("count").textContent = r.total
      ? "找到 " + r.total.toLocaleString() + " 筆，" + (st.t === "items" ? "有照片的排前面" : "依年代排列，點一下到故宮看原件") + "（目前顯示 " + shown + " 筆）"
      : "找不到「" + st.q + "」，換個詞試試看。";
    $("more").hidden = shown >= r.total;
    $("more").disabled = false;
  }
  function go() {
    st.q = $("q").value.trim();
    st.page = 0;
    $("out").replaceChildren();
    history.replaceState(null, "", "?t=" + st.t + "&q=" + encodeURIComponent(st.q));
    if (st.q) load(); else $("count").textContent = "";
  }
  $("f").onsubmit = (e) => { e.preventDefault(); go(); };
  $("more").onclick = () => { st.page++; load(); };

  setTab(st.t);
  $("q").value = st.q;
  if (st.q) go();
});
