/* 文物小百科：分類／朝代篩選、依編號往後翻頁、#編號 開詳情對話框（國小難度顯示範本白話句）。 */
Mu.boot(function (meta) {
  const { esc, el } = Mu;
  const $ = (id) => document.getElementById(id);
  const st = { cat: "", grp: "", after: 0, done: false, seq: 0 };

  // 篩選按鈕：只列有照片可看的分類與朝代（meta.cats／meta.pool 是有照片的件數）
  function chips(box, list, key, label) {
    box.innerHTML = '<span class="lab">' + label + "</span>";
    [["", "全部"]].concat(list).forEach(([id, name]) => {
      const b = el('<button class="chip" aria-pressed="' + (st[key] === id) + '">' + esc(name) + "</button>");
      b.onclick = () => { st[key] = id; box.querySelectorAll(".chip").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); reset(); };
      box.appendChild(b);
    });
  }
  chips($("cats"), Mu.CATS.filter((c) => meta.cats[c.id]).map((c) => [c.id, c.emoji + " " + c.name]), "cat", "分類");
  chips($("grps"), Mu.GROUPS.filter((g) => meta.pool[g.id]).map((g) => [g.id, Mu.gname(g.id)]), "grp", "朝代");
  $("all").onchange = reset;

  function card(it) {
    const g = it.grpInfo;
    const c = el('<button class="acard"><span class="pic"></span><div class="info"><b>' + esc(it.name) + '</b><div class="meta">' +
      (g ? '<span class="tag2 era" style="background:' + g.color + '">' + esc(Mu.gname(it.grp)) + "</span>" : "") +
      '<span class="tag2">' + esc(it.catInfo.name) + "</span></div></div></button>");
    c.querySelector(".pic").replaceWith(Mu.photo(it));
    c.onclick = () => (location.hash = it.n);
    return c;
  }

  async function load() {
    $("more").disabled = true;
    const seq = ++st.seq; // 換篩選時舊請求可能比較晚回來，回來時已經不是最新的就丟掉
    const r = await Mu.api("/api/items", { cat: st.cat, grp: st.grp, photo: $("all").checked ? "" : "1", after: st.after, limit: 30 });
    if (seq !== st.seq) return;
    const items = r.items.map(Mu.enrich);
    items.forEach((it) => $("grid").appendChild(card(it)));
    if (items.length) st.after = items[items.length - 1].n;
    st.done = items.length < 30;
    $("more").hidden = st.done;
    $("more").disabled = false;
    $("count").textContent = $("grid").children.length ? "目前顯示 " + $("grid").children.length + " 件" + (st.done ? "（已經全部列出）" : "") : "這個條件沒有文物，換一個試試看。";
  }
  function reset() { st.after = 0; $("grid").replaceChildren(); load(); }
  $("more").onclick = load;

  // ---- 詳情 ----
  async function open(n) {
    const r = await Mu.api("/api/item/" + n);
    const it = Mu.enrich(r.item);
    if (!it) return;
    Progress.seen(it);
    const lv = Mu.level();
    const facts = [
      ["分類", it.catInfo.emoji + " " + it.catInfo.name],
      ["時代（故宮寫法）", it.era || "未標示"],
      it.grp ? ["朝代", Mu.gname(it.grp) + "（" + it.grpInfo.y + "）"] : null,
      it.reign ? ["年號", (it.emperor ? it.emperor + "・" : "") + it.reign + (it.year ? "，" + Mu.yearText(it.year) : "")] : null,
      it.size ? ["尺寸", it.size] : null,
    ].filter(Boolean);
    const box = el(
      '<div><div class="dlg-bar"><button class="btn" id="x">關閉 ✕</button></div><div class="detail"><div id="big"></div><div>' +
      '<h2 style="margin-top:0">' + esc(it.name) + "</h2>" +
      (lv === "e" ? '<p class="plain">' + esc(Mu.plain(it)) + "</p>" : "") +
      '<div class="facts">' + facts.map((f) => '<div class="fact"><h4>' + esc(f[0]) + "</h4><p>" + esc(f[1]) + "</p></div>").join("") + "</div>" +
      (it.descr ? "<h3>故宮的說明</h3><p class=\"orig\">" + esc(it.descr) + "</p>" : "") +
      (it.url ? '<p><a class="btn" href="' + esc(it.url) + '" target="_blank" rel="noopener">到故宮網站看這件 ↗</a></p>' : "") +
      '<p class="credit">文字：國立故宮博物院，臺北，CC BY 4.0 @ www.npm.gov.tw。圖片：故宮開放低階圖像（CC0）。</p>' +
      "</div></div></div>"
    );
    box.querySelector("#big").appendChild(Mu.photo(it, true));
    $("dlgIn").replaceChildren(box);
    box.querySelector("#x").onclick = () => $("dlg").close();
    if (!$("dlg").open) $("dlg").showModal();
  }
  $("dlg").addEventListener("close", () => { if (location.hash) history.replaceState(null, "", location.pathname); });
  const fromHash = () => { const n = parseInt(location.hash.slice(1), 10); if (n) open(n); };
  window.addEventListener("hashchange", fromHash);
  document.addEventListener("mu-level", fromHash);

  load();
  fromHash();
});
