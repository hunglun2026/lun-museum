/* 探險護照的紀錄：看過哪些文物、各遊戲最好幾顆星、徽章。只存在這台裝置的 localStorage，不上傳、不蒐集個資。
   Progress.seen(item)、Progress.stars(key, n)、Progress.badges()、Progress.get()、Progress.clear()
   文物有 10 萬件，不能像動物探險家拿全部資料來算，所以看過的文物把分類與朝代群一起記下來。 */
window.Progress = (function () {
  "use strict";
  const KEY = "mu-progress-v1";
  function get() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || "null");
      if (s && s.seen) return s;
    } catch (e) { /* 無痕模式 */ }
    return { seen: {}, stars: {} };
  }
  function update(fn) {
    const s = get();
    fn(s);
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* 存不了就算了，不影響遊戲 */ }
  }
  // seen：{ n: [分類, 朝代群, 名稱, 圖片代號] }，護照頁直接拿來畫，不必再查 API
  const seen = (it) => update((s) => { if (!s.seen[it.n]) s.seen[it.n] = [it.cat, it.grp || "", it.name, it.photo ? it.img : ""]; });
  const stars = (key, n) => update((s) => { s.stars[key] = Math.max(s.stars[key] || 0, n); });
  const clear = () => { try { localStorage.removeItem(KEY); } catch (e) { /* 忽略 */ } };

  // 各遊戲在護照上顯示的名字（key 要跟各遊戲存星數用的一樣；難度另外記，例如 era-e）
  const GAMES = [
    ["era", "猜猜哪個朝代"], ["era-timed", "猜朝代・60 秒"], ["timeline", "朝代排排站"],
    ["classify", "分類闖關"], ["classify-timed", "分類闖關・60 秒"], ["memory", "翻牌配對"],
  ];
  const LV = { e: "國小", j: "國中", s: "高中" };

  // 小展覽的資料在 exhibit.js（護照頁有載入）；沒載入的頁面不算這個徽章
  function exhibitDone() {
    if (!window.Exhibit) return false;
    const e = Exhibit.get();
    return e.items.length >= 5 && e.items.every((x) => (x.note || "").trim().length >= 10);
  }

  // 徽章：有沒有拿到從紀錄算出來，不另外存，規則改了舊紀錄也會跟著對
  function badges() {
    const s = get();
    const list = Object.values(s.seen);
    const cats = new Set(list.map((x) => x[0]));
    const grps = new Set(list.map((x) => x[1]).filter(Boolean));
    const st = (k) => Math.max(...["e", "j", "s"].map((l) => s.stars[k + "-" + l] || 0));
    const stLv = (k, l) => s.stars[k + "-" + l] || 0;
    const badge = [
      ["👣", "第一步", "在小百科看第 1 件文物", list.length >= 1],
      ["📖", "小小鑑賞家", "在小百科看過 30 件文物", list.length >= 30],
      ["🗂️", "分類通", "看過 8 種不同分類的文物", cats.size >= 8],
      ["⏳", "穿越時空", "看過 8 個不同朝代的文物", grps.size >= 8],
      ["🏺", "猜朝代高手", "猜猜哪個朝代拿到三顆星", st("era") >= 3],
      ["📏", "時間軸達人", "朝代排排站拿到三顆星", st("timeline") >= 3],
      ["⚡", "閃電快手", "任一個 60 秒挑戰拿到三顆星", st("era-timed") >= 3 || st("classify-timed") >= 3],
      ["🧩", "材質偵探", "分類闖關拿到三顆星", st("classify") >= 3],
      ["🃏", "過目不忘", "翻牌配對拿到三顆星", st("memory") >= 3],
      ["🖼️", "小小策展人", "我的小展覽放了 5 件以上，而且每件都寫了解說牌", exhibitDone()],
      ["🎓", "高中挑戰者", "用高中難度在任一遊戲拿到三顆星", GAMES.some(([k]) => stLv(k, "s") >= 3)],
    ];
    return badge.map(([icon, name, how, got]) => ({ icon, name, how, got }));
  }
  return { get, seen, stars, clear, badges, GAMES, LV };
})();
