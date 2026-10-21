import type { Env } from "./env";
import { handleApi } from "./api";
import { serveImage, uploadImages } from "./img";
import { runCheck } from "./check";

const authed = (req: Request, env: Env) => !!env.ADMIN_TOKEN && req.headers.get("authorization") === `Bearer ${env.ADMIN_TOKEN}`;

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/api/")) return handleApi(url, env, ctx);
    if (url.pathname.startsWith("/img/")) return serveImage(url, env, ctx);
    if (url.pathname.startsWith("/admin/")) {
      // 管理端點一律要 Authorization: Bearer <ADMIN_TOKEN>
      if (!authed(req, env)) return new Response("unauthorized", { status: 401 });
      if (url.pathname === "/admin/img" && req.method === "POST") return uploadImages(req, env);
      if (url.pathname === "/admin/check" && req.method === "POST") return Response.json(await runCheck(env));
      return new Response("not found", { status: 404 });
    }
    return env.ASSETS.fetch(req);
  },
  async scheduled(_e: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runCheck(env));
  },
};
