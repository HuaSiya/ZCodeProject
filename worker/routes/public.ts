import { Hono } from "hono";
import { getVoterKey } from "../lib/auth";
import {
  buildPollDetail,
  getOptions,
  getPollRow,
  hasVoted,
  isPollClosed,
  listPublicPolls,
} from "../lib/polls";
import { enforceRateLimit } from "../lib/rate-limit";
import { isRecord, isValidPollId } from "../lib/validation";
import type { AppEnv } from "../types";

const publicRoutes = new Hono<AppEnv>();

publicRoutes.get("/polls", async (c) => {
  const polls = await listPublicPolls(c.env.DB, Date.now());
  return c.json(polls);
});

publicRoutes.get("/polls/:id", async (c) => {
  const pollId = c.req.param("id");
  if (!isValidPollId(pollId)) {
    return c.json({ error: "投票不存在或已被删除" }, 404);
  }

  const poll = await getPollRow(c.env.DB, pollId);
  if (!poll) {
    return c.json({ error: "投票不存在或已被删除" }, 404);
  }

  const voterKey = await getVoterKey(c);
  const detail = await buildPollDetail(c.env.DB, poll, voterKey, Date.now());
  return c.json(detail);
});

publicRoutes.post("/polls/:id/vote", async (c) => {
  const pollId = c.req.param("id");
  if (!isValidPollId(pollId)) {
    return c.json({ error: "投票不存在或已被删除" }, 404);
  }

  const poll = await getPollRow(c.env.DB, pollId);
  if (!poll) {
    return c.json({ error: "投票不存在或已被删除" }, 404);
  }

  const now = Date.now();
  if (isPollClosed(poll, now)) {
    return c.json({ error: "投票已截止" }, 409);
  }

  const voterKey = await getVoterKey(c);
  const withinLimit = await enforceRateLimit(c, "vote", 60_000, 60);
  if (!withinLimit) {
    return c.json({ error: "操作太频繁，请稍后再试" }, 429);
  }

  const body = await c.req.json().catch(() => null);
  if (!isRecord(body) || !Array.isArray(body.optionIds)) {
    return c.json({ error: "请求格式不正确" }, 400);
  }

  const optionIds: number[] = [];
  for (const rawId of body.optionIds) {
    if (typeof rawId !== "number" || !Number.isInteger(rawId) || rawId <= 0) {
      return c.json({ error: "选项格式不正确" }, 400);
    }
    optionIds.push(rawId);
  }

  const uniqueIds = [...new Set(optionIds)];
  if (uniqueIds.length !== optionIds.length) {
    return c.json({ error: "选项不能重复选择" }, 400);
  }
  if (uniqueIds.length === 0) {
    return c.json({ error: "请至少选择一个选项" }, 400);
  }
  if (uniqueIds.length > poll.max_choices) {
    return c.json(
      { error: `最多只能选择 ${poll.max_choices} 项` },
      400,
    );
  }

  const options = await getOptions(c.env.DB, pollId);
  const validOptionIds = new Set(options.map((option) => option.id));
  if (uniqueIds.some((optionId) => !validOptionIds.has(optionId))) {
    return c.json({ error: "包含无效的选项" }, 400);
  }

  if (await hasVoted(c.env.DB, pollId, voterKey)) {
    return c.json({ error: "你已经投过票了" }, 409);
  }

  const statements = [
    c.env.DB.prepare(
      "INSERT INTO poll_voters (poll_id, voter_key, created_at) VALUES (?, ?, ?)",
    ).bind(pollId, voterKey, now),
    ...uniqueIds.map((optionId) =>
      c.env.DB.prepare(
        "INSERT INTO votes (poll_id, option_id, voter_key, created_at) VALUES (?, ?, ?, ?)",
      ).bind(pollId, optionId, voterKey, now),
    ),
  ];

  try {
    await c.env.DB.batch(statements);
  } catch (error) {
    const message = String(error).toUpperCase();
    if (message.includes("UNIQUE")) {
      return c.json({ error: "你已经投过票了" }, 409);
    }
    if (message.includes("POLL_CLOSED")) {
      return c.json({ error: "投票已截止" }, 409);
    }
    if (message.includes("INVALID_OPTION")) {
      return c.json({ error: "包含无效的选项" }, 400);
    }
    throw error;
  }

  const detail = await buildPollDetail(
    c.env.DB,
    poll,
    voterKey,
    Date.now(),
  );
  return c.json(detail);
});

export default publicRoutes;
