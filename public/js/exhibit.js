/* 我的小展覽的資料：只存在這台裝置的 localStorage。小百科（加入）與展覽頁共用。
   Exhibit.get() → { title, items:[{ n, name, cat, grp, img, photo, note }] }；add(item)、has(n)、save(state) */
window.Exhibit = (function () {
  "use strict";
  const KEY = "mu-exhibit-v1";
  const MAX = 12;
  function get() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || "null");
      if (s && Array.isArray(s.items)) return s;
    } catch (e) { /* 無痕模式 */ }
    return { title: "我的小展覽", items: [] };
  }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); return true; } catch (e) { return false; } }
  const has = (n) => get().items.some((x) => x.n === n);
  // 回傳 "added"、"exists"、"full"
  function add(it) {
    const s = get();
    if (s.items.some((x) => x.n === it.n)) return "exists";
    if (s.items.length >= MAX) return "full";
    s.items.push({ n: it.n, name: it.name, cat: it.cat, grp: it.grp || "", img: it.img || "", photo: it.photo ? 1 : 0, note: "" });
    save(s);
    return "added";
  }
  return { get, save, add, has, MAX };
})();
