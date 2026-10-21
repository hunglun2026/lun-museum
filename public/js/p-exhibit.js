/* 我的小展覽：改展覽名稱、寫解說牌（依難度給提示）、調整順序、移除；列印解說牌、全螢幕投影發表。
   資料在 exhibit.js（localStorage）。 */
Mu.boot(function () {
  const { esc, el } = Mu;
  const root = document.getElementById("game");
  const HINT = {
    e: "它是什麼？用來做什麼？你最喜歡它哪裡？",
    j: "它是什麼朝代、什麼材質？當時的人怎麼用它？它有什麼特別的地方？",
    s: "它反映了那個時代的什麼工藝、生活或政治？跟同類文物比，它有什麼特色？",
  };
  let st = Exhibit.get();
  const save = () => Exhibit.save(st);
  const item = (x) => Mu.enrich({ n: x.n, name: x.name, cat: x.cat, grp: x.grp, img: x.img, photo: x.photo });
  const sub = (x) => [x.grp && Mu.gname(x.grp), (Mu.CAT[x.cat] || {}).name].filter(Boolean).join("・");

  function draw() {
    const lv = Mu.level();
    if (!st.items.length) {
      root.replaceChildren(el('<div class="stage"><h2>展覽還是空的</h2><p>到文物小百科挑幾件喜歡的文物，按「加入我的展覽」。</p><p><a class="btn primary big" href="/artifact">去挑文物 📖</a></p></div>'));
      return;
    }
    const box = el(
      '<div><div class="ex-edit"><div class="form-row"><label style="flex:1">展覽名稱<input type="text" id="title" maxlength="30"></label></div>' +
      '<p><button class="btn primary" id="show">📽️ 投影發表</button> <button class="btn" id="print">🖨️ 列印解說牌</button> <button class="btn danger" id="clear">清空展覽</button></p>' +
      '<p class="lead">解說牌提示（' + esc(Mu.LEVELS[lv].name) + "）：" + esc(HINT[lv]) + '</p><div class="ex-list" id="list"></div></div>' +
      '<div class="ex-print" id="prt"></div></div>'
    );
    const title = box.querySelector("#title");
    title.value = st.title;
    title.oninput = () => { st.title = title.value; save(); };
    const list = box.querySelector("#list");
    st.items.forEach((x, i) => {
      const row = el('<div class="ex-item"><span class="pic"></span><div><b>' + (i + 1) + ". " + esc(x.name) + "</b> <small>" + esc(sub(x)) + "</small>" +
        '<textarea aria-label="' + esc(x.name) + ' 的解說牌" placeholder="' + esc(HINT[lv]) + '"></textarea>' +
        '<div class="row"><button class="btn" data-a="up" aria-label="往前移">⬆</button><button class="btn" data-a="down" aria-label="往後移">⬇</button>' +
        '<a class="btn" href="' + Mu.artifactPage(x) + '" target="_blank" rel="noopener">看介紹</a><button class="btn danger" data-a="del">移除</button></div></div></div>');
      row.querySelector(".pic").replaceWith(Mu.photo(item(x)));
      const ta = row.querySelector("textarea");
      ta.value = x.note || "";
      ta.oninput = () => { x.note = ta.value; save(); };
      row.querySelectorAll("[data-a]").forEach((b) => (b.onclick = async () => {
        const a = b.dataset.a;
        if (a === "up" && i > 0) [st.items[i - 1], st.items[i]] = [st.items[i], st.items[i - 1]];
        else if (a === "down" && i < st.items.length - 1) [st.items[i + 1], st.items[i]] = [st.items[i], st.items[i + 1]];
        else if (a === "del") {
          if (x.note && !(await Mu.dialog("「" + x.name + "」的解說牌已經寫了字，確定要移除嗎？", [{ label: "取消", value: false }, { label: "移除", value: true, danger: true }]))) return;
          st.items.splice(i, 1);
        } else return;
        save(); draw();
      }));
      list.appendChild(row);
    });
    box.querySelector("#show").onclick = () => show(0);
    box.querySelector("#print").onclick = () => printCards(box.querySelector("#prt"));
    box.querySelector("#clear").onclick = async () => {
      if (await Mu.dialog("確定要清空整個展覽嗎？寫好的解說牌也會一起刪除，無法復原。", [{ label: "取消", value: false }, { label: "清空", value: true, danger: true }])) {
        st = { title: "我的小展覽", items: [] }; save(); draw();
      }
    };
    root.replaceChildren(box);
  }

  // 列印：每件一張解說牌（照片、名稱、朝代分類、學生寫的內容），等照片載完才印
  async function printCards(prt) {
    prt.innerHTML = '<h2 style="grid-column:1/-1">' + esc(st.title) + "</h2>" + st.items.map((x) =>
      '<div class="ex-card">' + (x.photo && x.img ? '<img src="' + esc(Mu.imgUrl(item(x), true)) + '" alt="">' : "") + "<h3>" + esc(x.name) + "</h3><small>" + esc(sub(x)) + "</small>" +
      '<p style="white-space:pre-line">' + esc(x.note || "") + '</p><small>策展人：＿＿＿＿＿＿　圖文：國立故宮博物院，臺北，CC BY 4.0 @ www.npm.gov.tw</small></div>').join("");
    const imgs = [...prt.querySelectorAll("img")].filter((i) => !i.complete);
    await Promise.all(imgs.map((i) => new Promise((r) => { i.addEventListener("load", r); i.addEventListener("error", r); })));
    window.print();
  }

  // 投影發表：全螢幕一件一頁，← → 鍵或按鈕換頁，Esc 離開
  function show(i) {
    const ov = el('<div class="show" role="dialog" aria-label="投影發表"><div class="slide" id="sl"></div><div class="bar2"><button class="btn" id="pv">◀ 上一件</button><span id="pg"></span><button class="btn" id="nx">下一件 ▶</button><button class="btn" id="cl">離開 ✕</button></div></div>');
    document.body.appendChild(ov);
    const drawSlide = () => {
      const x = st.items[i];
      const s = el('<div class="slide" id="sl"><span class="pic"></span><div><p style="font-size:1.1rem;opacity:.7;margin:0">' + esc(st.title) + "</p><h2>" + esc(x.name) + '</h2><p style="opacity:.8">' + esc(sub(x)) + "</p><p>" + esc(x.note || "（還沒寫解說牌）") + "</p></div></div>");
      s.querySelector(".pic").replaceWith(Mu.photo(item(x), true));
      ov.querySelector("#sl").replaceWith(s);
      ov.querySelector("#pg").textContent = i + 1 + " / " + st.items.length;
    };
    const go = (d) => { i = Math.max(0, Math.min(st.items.length - 1, i + d)); drawSlide(); };
    const key = (e) => { if (e.key === "ArrowRight") go(1); else if (e.key === "ArrowLeft") go(-1); else if (e.key === "Escape") close(); };
    function close() {
      document.removeEventListener("keydown", key);
      ov.remove();
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    }
    ov.querySelector("#pv").onclick = () => go(-1);
    ov.querySelector("#nx").onclick = () => go(1);
    ov.querySelector("#cl").onclick = close;
    document.addEventListener("keydown", key);
    if (ov.requestFullscreen) ov.requestFullscreen().catch(() => {});
    drawSlide();
  }

  document.addEventListener("mu-level", draw);
  draw();
});
