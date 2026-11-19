import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Context, Next } from "hono";
import { ADMIN_COOKIE, VOTER_COOKIE } from "../../shared/constants";
import type { AppEnv } from "../types";
import { hmacHex, randomHex, safeEqual } from "./crypto";

const ADMIN_TTL_SECONDS = 7 * 24 * 60 * 60;
const VOTER_TTL_SECONDS = 365 * 24 * 60 * 60;
const VOTER_COOKIE_PATTERN = /^[a-f0-9]{48}$/;

function useSecureCookies(c: Context<AppEnv>): boolean {
  return new URL(c.req.url).protocol === "https:";
}

export function isSameOrigin(c: Context<AppEnv>): boolean {
  const origin = c.req.header("Origin");
  if (!origin) {
    return true;
  }
  return origin === new URL(c.req.url).origin;
}

export async function verifyPasscode(
  c: Context<AppEnv>,
  input: string,
): Promise<boolean> {
  const expected = c.env.ADMIN_PASSCODE;
  if (!expected || !c.env.SESSION_SECRET) {
    return false;
  }
  const [inputHash, expectedHash] = await Promise.all([
    hmacHex(c.env.SESSION_SECRET, `passcode:${input}`),
    hmacHex(c.env.SESSION_SECRET, `passcode:${expected}`),
  ]);
  return safeEqual(inputHash, expectedHash);
}

export async function setAdminSessionCookie(c: Context<AppEnv>): Promise<void> {
  const expiresAt = Math.floor(Date.now() / 1000) + ADMIN_TTL_SECONDS;
  const signature = await hmacHex(c.env.SESSION_SECRET, `admin:${expiresAt}`);
  setCookie(c, ADMIN_COOKIE, `${expiresAt}.${signature}`, {
    httpOnly: true,
    sameSite: "Lax",
    secure: useSecureCookies(c),
    path: "/",
    maxAge: ADMIN_TTL_SECONDS,
  });
}

export function clearAdminSessionCookie(c: Context<AppEnv>): void {
  deleteCookie(c, ADMIN_COOKIE, {
    path: "/",
    secure: useSecureCookies(c),
  });
}

export async function isAdminRequest(c: Context<AppEnv>): Promise<boolean> {
  const token = getCookie(c, ADMIN_COOKIE);
  if (!token || !c.env.SESSION_SECRET) {
    return false;
  }
  const separator = token.indexOf(".");
  if (separator === -1) {
    return false;
  }
  const expiresAt = Number(token.slice(0, separator));
  const signature = token.slice(separator + 1);
  if (!Number.isFinite(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) {
    return false;
  }
  const expected = await hmacHex(c.env.SESSION_SECRET, `admin:${expiresAt}`);
  return safeEqual(signature, expected);
}

export async function requireAdmin(
  c: Context<AppEnv>,
  next: Next,
): Promise<Response | void> {
  if (!(await isAdminRequest(c))) {
    return c.json({ error: "请先登录管理后台" }, 401);
  }
  if (c.req.method !== "GET" && !isSameOrigin(c)) {
    return c.json({ error: "请求来源不合法" }, 403);
  }
  await next();
}

export async function getVoterKey(c: Context<AppEnv>): Promise<string> {
  if (!c.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET is not configured");
  }
  let token = getCookie(c, VOTER_COOKIE);
  if (!token || !VOTER_COOKIE_PATTERN.test(token)) {
    token = randomHex(24);
    setCookie(c, VOTER_COOKIE, token, {
      httpOnly: true,
      sameSite: "Lax",
      secure: useSecureCookies(c),
      path: "/",
      maxAge: VOTER_TTL_SECONDS,
    });
  }
  return hmacHex(c.env.SESSION_SECRET, `voter:${token}`);
}
