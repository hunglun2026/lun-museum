/* 故宮探險家：共用資料層。所有頁面先載入這支，再各自畫畫面。
   負責：向 API 拿資料（文物太多，不能像動物探險家一次全載）、分類與朝代表、三級難度、照片、範本白話句、小工具與自製對話框。 */
(function () {
  "use strict";

  // ---- 文物分類（鍵要跟 tools/normalize.py 的 CATS 一致）----
  const CATS = [
    { id: "ceramic", name: "陶瓷器", emoji: "🏺", hint: "用泥土捏好再用高溫燒成的碗、瓶、盤" },
    { id: "jade", name: "玉器", emoji: "💚", hint: "用玉石慢慢磨出來的器物或裝飾" },
    { id: "bronze", name: "銅器", emoji: "🔔", hint: "用青銅鑄造的鼎、鐘、鏡子、兵器" },
    { id: "painting", name: "繪畫", emoji: "🖼️", hint: "畫在紙或絹上的山水、花鳥、人物" },
    { id: "calligraphy", name: "法書", emoji: "✒️", hint: "書法家親手寫的字" },
    { id: "modelbook", name: "法帖", emoji: "📜", hint: "把名家書法刻版印出來給人臨摹" },
    { id: "enamel", name: "琺瑯器", emoji: "🎨", hint: "金屬表面燒上彩色釉料，顏色很鮮豔" },
    { id: "carving", name: "雕刻", emoji: "🪵", hint: "用竹、木、象牙、果核雕出來的小東西" },
    { id: "lacquer", name: "漆器", emoji: "🧧", hint: "一層一層塗上漆再雕花或描金" },
    { id: "coin", name: "錢幣", emoji: "🪙", hint: "古代人買東西用的錢" },
    { id: "studio", name: "文具", emoji: "🖌️", hint: "筆、墨、紙、硯，讀書寫字的用具" },
    { id: "misc", name: "雜項", emoji: "📦", hint: "鼻煙壺、印章、珊瑚、多寶格等各種寶物" },
    { id: "textile", name: "織品", emoji: "🧵", hint: "用絲線織成的布料與衣物" },
    { id: "embroidery", name: "絲繡", emoji: "🪡", hint: "用針線在布上繡出圖案" },
    { id: "rubbing", name: "拓片", emoji: "🪨", hint: "把石碑上的字用紙和墨拓印下來" },
    { id: "fan", name: "成扇", emoji: "🪭", hint: "扇面上有書畫的扇子" },
  ];
  const CAT = Object.fromEntries(CATS.map((c) => [c.id, c]));

  // ---- 朝代群（順序＝時間先後，跟 tools/era.py 的 GROUP_ORDER 一致）----
  const GROUPS = [
    { id: "新石器時代", y: "距今 10000～4000 年前", y0: -8000, color: "#8a6d4b" },
    { id: "商", y: "西元前 1600～1046 年", y0: -1600, color: "#6b5a3a" },
    { id: "周", y: "西元前 1046～256 年", y0: -1046, color: "#5d6b3a" },
    { id: "秦", y: "西元前 221～207 年", y0: -221, color: "#3a4a5d" },
    { id: "漢", y: "西元前 202～西元 220 年", y0: -202, color: "#a8322b" },
    { id: "魏晉南北朝", y: "西元 220～589 年", y0: 220, color: "#6b4a6b" },
    { id: "隋", y: "西元 581～618 年", y0: 581, color: "#4a6b6b" },
    { id: "唐", y: "西元 618～907 年", y0: 618, color: "#c2862b" },
    { id: "五代", y: "西元 907～960 年", y0: 907, color: "#7a6b4a" },
    { id: "遼", y: "西元 916～1125 年", y0: 916, color: "#5a6b7a" },
    { id: "宋", y: "西元 960～1279 年", y0: 960, color: "#3f7f74" },
    { id: "金", y: "西元 1115～1234 年", y0: 1115, color: "#8a7a2b" },
    { id: "元", y: "西元 1271～1368 年", y0: 1271, color: "#3a5d8a" },
    { id: "明", y: "西元 1368～1644 年", y0: 1368, color: "#b0552b" },
    { id: "清", y: "西元 1644～1912 年", y0: 1644, color: "#2b5d8a" },
    { id: "民國", y: "西元 1912 年以後", y0: 1912, color: "#5a5a5a" },
  ];
  const GROUP = Object.fromEntries(GROUPS.map((g, i) => [g.id, Object.assign({ order: i }, g)]));

  // ---- 明清年號（高中題用）：[年號, 元年]，下一個年號的元年減一就是最後一年 ----
  const REIGNS = {
    明: [["洪武", 1368], ["建文", 1399], ["永樂", 1403], ["洪熙", 1425], ["宣德", 1426], ["正統", 1436], ["景泰", 1450], ["天順", 1457],
      ["成化", 1465], ["弘治", 1488], ["正德", 1506], ["嘉靖", 1522], ["隆慶", 1567], ["萬曆", 1573], ["泰昌", 1620], ["天啟", 1621], ["崇禎", 1628], ["", 1645]],
    清: [["順治", 1644], ["康熙", 1662], ["雍正", 1723], ["乾隆", 1736], ["嘉慶", 1796], ["道光", 1821], ["咸豐", 1851], ["同治", 1862],
      ["光緒", 1875], ["宣統", 1909], ["", 1912]],
  };
  function reignInfo(dyn, name) {
    const list = REIGNS[dyn] || [];
    const i = list.findIndex((r) => r[0] === name);
    return i >= 0 && i < list.length - 1 ? { name, y0: list[i][1], y1: list[i + 1][1] - 1, list: list.slice(0, -1).map((r) => r[0]) } : null;
  }

  // ---- 三級難度（GrillMe 第 6 題）。存在 localStorage，頁首可切換 ----
  const LEVELS = {
    e: { name: "國小", groups: ["新石器時代", "漢", "唐", "宋", "明", "清"], choices: 3 },
    j: { name: "國中", groups: GROUPS.map((g) => g.id).filter((g) => g !== "民國"), choices: 4 },
    s: { name: "高中", groups: GROUPS.map((g) => g.id), choices: 4 },
  };
  const LKEY = "mu-level";
  function level() {
    try { const v = localStorage.getItem(LKEY); if (LEVELS[v]) return v; } catch (e) { /* 無痕模式 */ }
    return "e";
  }
  function setLevel(v) {
    try { localStorage.setItem(LKEY, v); } catch (e) { /* 忽略 */ }
    document.dispatchEvent(new CustomEvent("mu-level", { detail: v }));
  }

  // ---- API：同一頁面同一網址只抓一次；m 帶 meta 的照片數，照片上傳後快取鍵就換新 ----
  const memo = new Map();
  let meta = null;
  async function api(path, params) {
    const q = new URLSearchParams(params || {});
    for (const [k, v] of [...q]) if (v === "" || v == null) q.delete(k);
    if (meta && path !== "/api/meta" && path !== "/api/pool") q.set("m", meta.photos);
    const url = path + (q.toString() ? "?" + q : "");
    if (path !== "/api/pool" && memo.has(url)) return memo.get(url);
    const p = fetch(url).then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
    memo.set(url, p);
    p.catch(() => memo.delete(url));
    return p;
  }
  async function loadMeta() {
    meta = await api("/api/meta");
    return meta;
  }
  // 遊戲題庫：依難度限定朝代群；opts 可再指定 grp、cat、k
  async function pool(opts) {
    const o = Object.assign({ k: 24 }, opts);
    return (await api("/api/pool", o)).items.map(enrich);
  }

  // 朝代群的口語名稱：「唐」→「唐朝」，「新石器時代」「五代」「民國」不加
  const gname = (g) => (/[代朝國]$/.test(g) ? g : g + "朝");

  // 列表項目補上顯示用欄位
  function enrich(it) {
    if (!it || it._ok) return it;
    it._ok = true;
    it.catInfo = CAT[it.cat] || { name: it.cat, emoji: "🏛️" };
    it.grpInfo = GROUP[it.grp] || null;
    it.dynName = it.dyn === "新石器時代" ? "新石器時代" : it.dyn ? it.dyn + (/[代朝]$/.test(it.dyn) ? "" : "朝") : "";
    return it;
  }

  // ---- 照片：本站 R2（故宮低階圖 CC0，縮成 600／240）；沒有就畫分類圖示 ----
  function placeholder(it, cls) {
    const d = document.createElement("div");
    d.className = "ph " + (cls || "");
    d.innerHTML = '<span aria-hidden="true">' + (it.catInfo ? it.catInfo.emoji : "🏛️") + "</span><small>圖片整理中</small>";
    d.setAttribute("role", "img");
    d.setAttribute("aria-label", it.name || "文物");
    return d;
  }
  function photo(it, big, cls) {
    if (!it.photo || !it.img) return placeholder(it, cls);
    const img = new Image();
    img.className = "photo " + (cls || "");
    img.loading = "lazy";
    img.decoding = "async";
    img.alt = it.name;
    img.src = "/img/" + (big ? 600 : 240) + "/" + it.img + ".webp";
    img.onerror = () => img.replaceWith(placeholder(it, cls));
    return img;
  }
  const imgUrl = (it, big) => (it.photo && it.img ? "/img/" + (big ? 600 : 240) + "/" + it.img + ".webp" : "");

  // 出朝代題、年號題時遮住名稱裡的答案：「中國 明代 洪武二十九年 佛坐像」→「中國 ○○ ○○二十九年 佛坐像」
  // 約 2% 的文物名稱直接寫了朝代或年號（2026-10-21 統計出題池 832／42,589 件）
  function maskName(it) {
    const words = [it.reign, it.dyn && it.dyn + "代", it.dyn && it.dyn + "朝", it.dyn, it.grp].filter((w) => w && w.length);
    let n = it.name;
    for (const w of words.sort((a, b) => b.length - a.length)) n = n.split(w).join("○".repeat(Math.min(w.length, 2)));
    return n.replace(/[（(]\s*-?\d{3,4}\s*[)）]/g, "（○○○○）"); // 括號裡的西元年也會洩漏答案
  }

  // ---- 範本白話句（國小版；不用 AI，不編造內容，只把資料欄位接成句子）----
  function plain(it) {
    const parts = [];
    const c = it.catInfo ? it.catInfo.name : "文物";
    if (it.grpInfo) parts.push("這是" + it.dynName + "的" + c + "，名字叫「" + it.name + "」。");
    else parts.push("這件" + c + "叫做「" + it.name + "」。");
    if (it.grpInfo) parts.push(gname(it.grp) + "大約在" + it.grpInfo.y + "。");
    if (it.reign) parts.push("上面的年代寫著「" + it.reign + "」，這是當時皇帝的年號。");
    if (it.catInfo && it.catInfo.hint) parts.push(c + "是" + it.catInfo.hint + "。");
    return parts.join("");
  }

  // ---- 清代檔案：故宮原件網址由統一編號算出（PHP json_encode 會把中文寫成 \uXXXX 再 base64）----
  function archiveUrl(id) {
    const v = Array.from(id).map((ch) => {
      const c = ch.codePointAt(0);
      return c < 128 ? ch : "\\u" + c.toString(16).padStart(4, "0");
    }).join("");
    const json = '{"search":[{"field":"accession_id","value":"' + v + '"}]}';
    return "https://qingarchives.npm.edu.tw/index.php?act=Archive/search/1-20/" + btoa(json);
  }
  const artifactPage = (it) => "/artifact#" + it.n;

  // ---- 小工具 ----
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  const pick = (arr, n) => shuffle(arr).slice(0, n);
  // el(html)：HTML 字串轉成「單一」元素。多個頂層元素要自己包一層 <div>
  const el = (html) => {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    if (t.content.children.length > 1) console.warn("Mu.el：HTML 有多個頂層元素，只會用第一個", html.slice(0, 60));
    return t.content.firstElementChild;
  };
  const yearText = (y) => (y == null ? "" : y < 0 ? "西元前 " + -y + " 年" : "西元 " + y + " 年");

  // 自製確認對話框（不用瀏覽器內建的 alert／confirm）
  function dialog(message, buttons) {
    return new Promise((resolve) => {
      const d = document.createElement("dialog");
      d.className = "zdlg";
      d.innerHTML = "<p>" + esc(message) + '</p><div class="row"></div>';
      (buttons || [{ label: "好", value: true, primary: true }]).forEach((b) => {
        const btn = document.createElement("button");
        btn.className = "btn" + (b.primary ? " primary" : "") + (b.danger ? " danger" : "");
        btn.textContent = b.label;
        btn.onclick = () => { d.close(); d.remove(); resolve(b.value); };
        d.lastChild.appendChild(btn);
      });
      document.body.appendChild(d);
      d.showModal();
    });
  }

  window.Mu = {
    CATS, CAT, GROUPS, GROUP, LEVELS, level, setLevel, api, loadMeta, pool, enrich,
    photo, imgUrl, placeholder, plain, gname, maskName, REIGNS, reignInfo, archiveUrl, artifactPage, esc, shuffle, pick, el, yearText, dialog,
    get meta() { return meta; },
  };
})();
