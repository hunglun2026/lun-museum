import type { Env } from "./env";
import { notifyError } from "./notify";

// 每月檢查：data.gov.tw 上故宮資料集的 modifiedDate 有沒有比上次匯入新。
// 匯入本身在本機跑（陶瓷一類就 17MB、清代檔案上百 MB，Worker 排程的記憶體與 CPU 吃不下），
// 這裡只負責發現更新並 ntfy 提醒，內容不動，網站繼續用舊資料。
const DATASETS = [
  "169459", "169547", "169548", "169549", "169550", "169551", "169552", "169554", "169555",
  "169556", "169557", "169558", "169559", "169560", "169561", "169562",
  "170165", "170271", "170272", "170273", "170274", "170275", "170276", "170583", "170584",
];

export async function runCheck(env: Env): Promise<{ status: string; message: string }> {
  let res: { status: string; message: string };
  try {
    const known = await env.DB.prepare("SELECT v FROM meta WHERE k = 'source_modified'").first<{ v: string }>();
    const old: Record<string, string> = known ? JSON.parse(known.v) : {};
    const changed: string[] = [];
    for (const id of DATASETS) {
      const r = await fetch(`https://data.gov.tw/api/v2/rest/dataset/${id}`, { signal: AbortSignal.timeout(20000) });
      if (!r.ok) throw new Error(`查 data.gov.tw ${id} 失敗：HTTP ${r.status}`);
      const m: any = await r.json();
      const mod = (m.result ?? m).modifiedDate;
      if (mod && old[id] && mod > old[id]) changed.push(`${(m.result ?? m).title}（${mod}）`);
    }
    if (changed.length) {
      res = { status: "update", message: `有 ${changed.length} 個資料集更新，請在本機跑 tools/update.sh：` + changed.join("、") };
      await notifyError(env, "故宮探險家：資料有更新", res.message);
    } else {
      res = { status: "same", message: "資料沒有更新" };
    }
  } catch (e) {
    res = { status: "error", message: e instanceof Error ? e.message : String(e) };
    await notifyError(env, "故宮探險家：每月檢查失敗", res.message);
  }
  await env.DB.prepare("INSERT INTO check_log (ran_at, status, message) VALUES (?,?,?)").bind(new Date().toISOString(), res.status, res.message).run();
  return res;
}
