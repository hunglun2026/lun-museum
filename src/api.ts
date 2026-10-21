import type { Env } from "./env";
import { ftsQuery } from "./tokens";

const json = (data: unknown, cache: string) =>
  new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": cache },
  });

// 邊緣快取：同機房的相同請求直接回存好的結果，不查 D1。
// 鍵帶 APP_VERSION（部署新版自動換新）與完整查詢字串；照片上傳後前端 meta 的 photos 會變，前端把它帶在 m 參數。
async function edge(url: URL, env: Env, ctx: ExecutionContext, cache: string, build: () => Promise<unknown>) {
  const key = new Request(`${url.origin}${url.pathname}?app=${encodeURIComponent(env.APP_VERSION)}&${url.searchParams}`);
  const hit = await caches.default.match(key);
  if (hit) return hit;
  const res = json(await build(), cache);
  ctx.waitUntil(caches.default.put(key, res.clone()));
  return res;
}

const int = (v: string | null, d: number, lo: number, hi: number) => {
  const n = parseInt(v ?? "", 10);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};

// 列表用的精簡欄位（說明只取前 80 字，詳情頁再抓全文）
const card = (a = "") =>
  ["n", "id", "name", "cat", "grp", "dyn", "reign", "year", "era", "era_quiz", "img", "photo", "pool"].map((c) => a + c).join(", ") +
  `, substr(${a}descr, 1, 80) AS brief`;
const CARD = card();

// 篩選條件：分類、朝代群、只要有照片。回傳 [SQL 片段, 參數]
function filters(p: URLSearchParams, alias = ""): [string, unknown[]] {
  const w: string[] = [];
  const args: unknown[] = [];
  const a = alias ? alias + "." : "";
  if (p.get("cat")) { w.push(`${a}cat = ?`); args.push(p.get("cat")); }
  if (p.get("grp")) { w.push(`${a}grp = ?`); args.push(p.get("grp")); }
  if (p.get("photo") === "1") w.push(`${a}photo = 1`);
  return [w.length ? w.join(" AND ") : "1=1", args];
}

export async function handleApi(url: URL, env: Env, ctx: ExecutionContext): Promise<Response> {
  const p = url.searchParams;
  const path = url.pathname;

  if (path === "/api/meta") {
    return edge(url, env, ctx, "public, max-age=60, s-maxage=300", async () => {
      const m = await env.DB.prepare("SELECT k, v FROM meta").all<{ k: string; v: string }>();
      const meta = Object.fromEntries(m.results.map((r) => [r.k, r.v]));
      // 各朝代、各分類「可出題且有照片」的件數：遊戲依這個決定能選哪些範圍
      const g = await env.DB.prepare("SELECT grp, count(*) AS n FROM items WHERE pool=1 AND photo=1 GROUP BY grp").all();
      const c = await env.DB.prepare("SELECT cat, count(*) AS n FROM items WHERE pool=1 AND photo=1 GROUP BY cat").all();
      const photos = g.results.reduce((s: number, r: any) => s + r.n, 0);
      return {
        version: env.APP_VERSION, items: +(meta.items_count ?? 0), archives: +(meta.archives_count ?? 0),
        importedAt: meta.items_imported_at ?? null, photos,
        pool: Object.fromEntries(g.results.map((r: any) => [r.grp, r.n])),
        cats: Object.fromEntries(c.results.map((r: any) => [r.cat, r.n])),
      };
    });
  }

  // 遊戲題庫：可出題且有照片的文物，隨機取 k 件。
  // 不用 ORDER BY RANDOM()（會讀整張表），改成「隨機起點往後取」分 4 段，每次只讀幾十列。
  if (path === "/api/pool") {
    const k = int(p.get("k"), 24, 4, 60);
    const [w, args] = filters(new URLSearchParams({ cat: p.get("cat") ?? "", grp: p.get("grp") ?? "", photo: "1" }));
    const range = await env.DB.prepare(`SELECT min(n) AS lo, max(n) AS hi FROM items WHERE pool=1 AND ${w}`).bind(...args).first<{ lo: number; hi: number }>();
    if (!range?.hi) return json({ items: [] }, "no-store");
    const per = Math.ceil(k / 4);
    const seen = new Map<number, unknown>();
    for (let i = 0; i < 4; i++) {
      const start = range.lo + Math.floor(Math.random() * (range.hi - range.lo + 1));
      let r = await env.DB.prepare(`SELECT ${CARD} FROM items WHERE pool=1 AND ${w} AND n >= ? ORDER BY n LIMIT ?`).bind(...args, start, per).all();
      if (r.results.length < per) r = await env.DB.prepare(`SELECT ${CARD} FROM items WHERE pool=1 AND ${w} ORDER BY n LIMIT ?`).bind(...args, per).all();
      for (const it of r.results as any[]) seen.set(it.n, it);
    }
    return json({ items: [...seen.values()] }, "no-store");
  }

  // 瀏覽：依編號往後翻頁（after＝上一頁最後一件的 n），不用 OFFSET，翻再深都只讀一頁
  if (path === "/api/items") {
    return edge(url, env, ctx, "public, max-age=600, s-maxage=86400", async () => {
      const [w, args] = filters(p);
      const after = int(p.get("after"), 0, 0, 1e9);
      const limit = int(p.get("limit"), 30, 1, 60);
      const order = p.get("photo") === "1" ? "" : "photo DESC,";
      const r = await env.DB.prepare(`SELECT ${CARD} FROM items WHERE ${w} AND n > ? ORDER BY ${order} n LIMIT ?`).bind(...args, after, limit).all();
      return { items: r.results };
    });
  }

  const one = path.match(/^\/api\/item\/(\d+)$/);
  if (one) {
    return edge(url, env, ctx, "public, max-age=3600, s-maxage=86400", async () => {
      const it = await env.DB.prepare("SELECT * FROM items WHERE n = ?").bind(+one[1]).first();
      return { item: it ?? null };
    });
  }

  // 搜尋：t=items（文物）或 archives（清代檔案）。有照片、可出題的排前面
  if (path === "/api/search") {
    return edge(url, env, ctx, "public, max-age=600, s-maxage=86400", async () => {
      const q = ftsQuery(p.get("q") ?? "");
      if (!q) return { total: 0, items: [] };
      const page = int(p.get("page"), 0, 0, 200);
      const limit = 30;
      if (p.get("t") === "archives") {
        const total = await env.DB.prepare("SELECT count(*) AS n FROM archives_fts WHERE archives_fts MATCH ?").bind(q).first<{ n: number }>();
        const r = await env.DB.prepare(
          "SELECT a.* FROM archives_fts f JOIN archives a ON a.n = f.rowid WHERE archives_fts MATCH ? ORDER BY a.year IS NULL, a.year, a.n LIMIT ? OFFSET ?",
        ).bind(q, limit, page * limit).all();
        return { total: total?.n ?? 0, items: r.results };
      }
      const [w, args] = filters(p, "i");
      const total = await env.DB.prepare(`SELECT count(*) AS n FROM items_fts f JOIN items i ON i.n = f.rowid WHERE items_fts MATCH ? AND ${w}`).bind(q, ...args).first<{ n: number }>();
      const r = await env.DB.prepare(
        `SELECT ${card("i.")}
         FROM items_fts f JOIN items i ON i.n = f.rowid WHERE items_fts MATCH ? AND ${w}
         ORDER BY i.photo DESC, i.pool DESC, i.n LIMIT ? OFFSET ?`,
      ).bind(q, ...args, limit, page * limit).all();
      return { total: total?.n ?? 0, items: r.results };
    });
  }

  // 清代檔案依年代瀏覽（史料探究）：from／to 是西元年
  if (path === "/api/archives") {
    return edge(url, env, ctx, "public, max-age=600, s-maxage=86400", async () => {
      const from = int(p.get("from"), 1644, 1500, 1950);
      const to = int(p.get("to"), 1911, 1500, 1950);
      const page = int(p.get("page"), 0, 0, 500);
      const q = ftsQuery(p.get("q") ?? "");
      const sql = q
        ? "SELECT a.* FROM archives_fts f JOIN archives a ON a.n = f.rowid WHERE archives_fts MATCH ? AND a.year BETWEEN ? AND ? ORDER BY a.year, a.n LIMIT 30 OFFSET ?"
        : "SELECT * FROM archives WHERE year BETWEEN ? AND ? ORDER BY year, n LIMIT 30 OFFSET ?";
      const r = await env.DB.prepare(sql).bind(...(q ? [q] : []), from, to, page * 30).all();
      return { items: r.results };
    });
  }

  return json({ error: "not found" }, "no-store");
}
