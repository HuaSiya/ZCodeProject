import { Hono } from "hono";
import adminRoutes from "./routes/admin";
import publicRoutes from "./routes/public";
import type { AppEnv } from "./types";

const app = new Hono<AppEnv>();

app.use("/api/*", async (c, next) => {
  if (!c.env.SESSION_SECRET) {
    return c.json(
      { error: "服务端缺少 SESSION_SECRET 配置，请检查部署设置" },
      500,
    );
  }
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "same-origin");
  c.header("Cache-Control", "no-store");
});

app.get("/api/health", (c) => c.json({ ok: true }));
app.route("/api", publicRoutes);
app.route("/api/admin", adminRoutes);

app.notFound((c) => c.json({ error: "接口不存在" }, 404));

app.onError((error, c) => {
  console.error(error);
  return c.json({ error: "服务器开小差了，请稍后再试" }, 500);
});

export default app;
