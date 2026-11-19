import type { Context } from "hono";
import type { AppEnv } from "../types";
import { hmacHex } from "./crypto";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function enforceRateLimit(
  c: Context<AppEnv>,
  kind: string,
  windowMs: number,
  maxRequests: number,
): Promise<boolean> {
  const ip =
    c.req.header("CF-Connecting-IP") ??
    c.req.header("X-Forwarded-For")?.split(",")[0]?.trim() ??
    "local";
  const ipHash = await hmacHex(c.env.SESSION_SECRET, `ip:${ip}`);
  const now = Date.now();
  const since = now - windowMs;

  const row = await c.env.DB.prepare(
    "SELECT COUNT(*) AS count FROM rate_limits WHERE ip_hash = ? AND kind = ? AND created_at >= ?",
  )
    .bind(ipHash, kind, since)
    .first<{ count: number }>();

  if ((row?.count ?? 0) >= maxRequests) {
    return false;
  }

  await c.env.DB.prepare(
    "INSERT INTO rate_limits (ip_hash, kind, created_at) VALUES (?, ?, ?)",
  )
    .bind(ipHash, kind, now)
    .run();

  if (Math.random() < 0.02) {
    c.executionCtx.waitUntil(
      c.env.DB.prepare("DELETE FROM rate_limits WHERE created_at < ?")
        .bind(now - DAY_MS)
        .run(),
    );
  }

  return true;
}
