import { Hono } from "hono";
import { POLL_LIMITS } from "../../shared/constants";
import {
  clearAdminSessionCookie,
  isAdminRequest,
  isSameOrigin,
  requireAdmin,
  setAdminSessionCookie,
  verifyPasscode,
} from "../lib/auth";
import { randomPollId } from "../lib/crypto";
import {
  buildAdminPollDetail,
  getOptions,
  getPollRow,
  getTotalVoters,
  listAdminPolls,
} from "../lib/polls";
import { enforceRateLimit } from "../lib/rate-limit";
import {
  isRecord,
  isValidPollId,
  validatePollContent,
} from "../lib/validation";
import type { PollContent } from "../lib/validation";
import type { AppEnv } from "../types";

const adminRoutes = new Hono<AppEnv>();

adminRoutes.post("/login", async (c) => {
  if (!isSameOrigin(c)) {
    return c.json({ error: "请求来源不合法" }, 403);
  }
  if (!c.env.ADMIN_PASSCODE || !c.env.SESSION_SECRET) {
    return c.json({ error: "服务端尚未配置管理员口令" }, 500);
  }

  const withinLimit = await enforceRateLimit(
    c,
    "admin_login",
    5 * 60_000,
    10,
  );
  if (!withinLimit) {
    return c.json({ error: "尝试次数过多，请稍后再试" }, 429);
  }

  const body = await c.req.json().catch(() => null);
  if (
    !isRecord(body) ||
    typeof body.passcode !== "string" ||
    !body.passcode.trim()
  ) {
    return c.json({ error: "请输入管理员口令" }, 400);
  }

  const valid = await verifyPasscode(c, body.passcode);
  if (!valid) {
    return c.json({ error: "口令不正确" }, 401);
  }

  await setAdminSessionCookie(c);
  return c.json({ ok: true });
});

adminRoutes.get("/session", async (c) => {
  return c.json({ authenticated: await isAdminRequest(c) });
});

adminRoutes.post("/logout", (c) => {
  if (!isSameOrigin(c)) {
    return c.json({ error: "请求来源不合法" }, 403);
  }
  clearAdminSessionCookie(c);
  return c.json({ ok: true });
});

const protectedRoutes = new Hono<AppEnv>();
protectedRoutes.use("*", requireAdmin);

protectedRoutes.get("/polls", async (c) => {
  return c.json(await listAdminPolls(c.env.DB, Date.now()));
});

protectedRoutes.get("/polls/:id", async (c) => {
  const pollId = c.req.param("id");
  if (!isValidPollId(pollId)) {
    return c.json({ error: "投票不存在或已被删除" }, 404);
  }
  const poll = await getPollRow(c.env.DB, pollId);
  if (!poll) {
    return c.json({ error: "投票不存在或已被删除" }, 404);
  }
  return c.json(
    await buildAdminPollDetail(c.env.DB, poll, Date.now()),
  );
});

protectedRoutes.post("/polls", async (c) => {
  const body = await c.req.json().catch(() => null);
  const validation = validatePollContent(body, {
    now: Date.now(),
    requireFutureDeadline: true,
  });
  if (!validation.ok) {
    return c.json({ error: validation.error }, 400);
  }

  const content = validation.value;
  const pollId = randomPollId();
  const now = Date.now();

  const statements = [
    c.env.DB.prepare(
      `INSERT INTO polls
        (id, title, description, max_choices, is_listed, deadline_at, closed_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`,
    ).bind(
      pollId,
      content.title,
      content.description,
      content.maxChoices,
      content.isListed ? 1 : 0,
      content.deadlineAt,
      now,
    ),
    ...content.options.map((label, index) =>
      c.env.DB.prepare(
        "INSERT INTO options (poll_id, label, position) VALUES (?, ?, ?)",
      ).bind(pollId, label, index),
    ),
  ];

  await c.env.DB.batch(statements);
  return c.json({ id: pollId }, 201);
});

protectedRoutes.patch("/polls/:id", async (c) => {
  const pollId = c.req.param("id");
  if (!isValidPollId(pollId)) {
    return c.json({ error: "投票不存在或已被删除" }, 404);
  }

  const poll = await getPollRow(c.env.DB, pollId);
  if (!poll) {
    return c.json({ error: "投票不存在或已被删除" }, 404);
  }

  const body = await c.req.json().catch(() => null);
  if (!isRecord(body)) {
    return c.json({ error: "请求格式不正确" }, 400);
  }

  const contentFields = [
    "title",
    "description",
    "options",
    "maxChoices",
    "deadlineAt",
  ];
  const hasContentChanges = contentFields.some((field) => field in body);
  const hasListedChange = "isListed" in body;

  if (!hasContentChanges && !hasListedChange) {
    return c.json({ error: "没有可更新的内容" }, 400);
  }

  let content: PollContent | null = null;

  if (hasContentChanges) {
    const totalVoters = await getTotalVoters(c.env.DB, pollId);
    if (totalVoters > 0) {
      return c.json(
        { error: "已有投票，不能再修改投票内容" },
        409,
      );
    }

    const existingOptions = await getOptions(c.env.DB, pollId);
    const deadlineProvided = "deadlineAt" in body;
    const merged = {
      title: "title" in body ? body.title : poll.title,
      description:
        "description" in body ? body.description : poll.description,
      options:
        "options" in body
          ? body.options
          : existingOptions.map((option) => option.label),
      maxChoices:
        "maxChoices" in body ? body.maxChoices : poll.max_choices,
      deadlineAt: deadlineProvided
        ? body.deadlineAt
        : poll.deadline_at,
      isListed:
        "isListed" in body ? body.isListed : poll.is_listed === 1,
    };

    const validation = validatePollContent(merged, {
      now: Date.now(),
      requireFutureDeadline: deadlineProvided,
    });
    if (!validation.ok) {
      return c.json({ error: validation.error }, 400);
    }
    content = validation.value;
  } else if (typeof body.isListed !== "boolean") {
    return c.json({ error: "公开状态格式不正确" }, 400);
  }

  const statements: D1PreparedStatement[] = [];

  if (content) {
    statements.push(
      c.env.DB.prepare(
        `UPDATE polls
         SET title = ?, description = ?, max_choices = ?, deadline_at = ?, is_listed = ?
         WHERE id = ?`,
      ).bind(
        content.title,
        content.description,
        content.maxChoices,
        content.deadlineAt,
        content.isListed ? 1 : 0,
        pollId,
      ),
    );

    if ("options" in body) {
      statements.push(
        c.env.DB.prepare("DELETE FROM options WHERE poll_id = ?").bind(
          pollId,
        ),
      );
      statements.push(
        ...content.options.map((label, index) =>
          c.env.DB.prepare(
            "INSERT INTO options (poll_id, label, position) VALUES (?, ?, ?)",
          ).bind(pollId, label, index),
        ),
      );
    }
  } else {
    statements.push(
      c.env.DB.prepare(
        "UPDATE polls SET is_listed = ? WHERE id = ?",
      ).bind((body.isListed as boolean) ? 1 : 0, pollId),
    );
  }

  try {
    await c.env.DB.batch(statements);
  } catch (error) {
    if (String(error).toUpperCase().includes("OPTION_HAS_VOTES")) {
      return c.json(
        { error: "已有投票，不能再修改投票内容" },
        409,
      );
    }
    throw error;
  }

  const updated = await getPollRow(c.env.DB, pollId);
  if (!updated) {
    return c.json({ error: "投票不存在或已被删除" }, 404);
  }
  return c.json(
    await buildAdminPollDetail(c.env.DB, updated, Date.now()),
  );
});

protectedRoutes.post("/polls/:id/close", async (c) => {
  const pollId = c.req.param("id");
  if (!isValidPollId(pollId)) {
    return c.json({ error: "投票不存在或已被删除" }, 404);
  }

  const poll = await getPollRow(c.env.DB, pollId);
  if (!poll) {
    return c.json({ error: "投票不存在或已被删除" }, 404);
  }

  if (poll.closed_at === null) {
    await c.env.DB.prepare(
      "UPDATE polls SET closed_at = ? WHERE id = ? AND closed_at IS NULL",
    )
      .bind(Date.now(), pollId)
      .run();
  }

  const updated = await getPollRow(c.env.DB, pollId);
  if (!updated) {
    return c.json({ error: "投票不存在或已被删除" }, 404);
  }
  return c.json(
    await buildAdminPollDetail(c.env.DB, updated, Date.now()),
  );
});

protectedRoutes.delete("/polls/:id", async (c) => {
  const pollId = c.req.param("id");
  if (!isValidPollId(pollId)) {
    return c.json({ error: "投票不存在或已被删除" }, 404);
  }

  const poll = await getPollRow(c.env.DB, pollId);
  if (!poll) {
    return c.json({ error: "投票不存在或已被删除" }, 404);
  }

  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM votes WHERE poll_id = ?").bind(pollId),
    c.env.DB.prepare("DELETE FROM poll_voters WHERE poll_id = ?").bind(
      pollId,
    ),
    c.env.DB.prepare("DELETE FROM options WHERE poll_id = ?").bind(pollId),
    c.env.DB.prepare("DELETE FROM polls WHERE id = ?").bind(pollId),
  ]);

  return c.json({ ok: true, deletedId: pollId });
});

protectedRoutes.post("/polls/:id/duplicate", async (c) => {
  const sourceId = c.req.param("id");
  if (!isValidPollId(sourceId)) {
    return c.json({ error: "投票不存在或已被删除" }, 404);
  }

  const source = await getPollRow(c.env.DB, sourceId);
  if (!source) {
    return c.json({ error: "投票不存在或已被删除" }, 404);
  }

  const sourceOptions = await getOptions(c.env.DB, sourceId);
  const newId = randomPollId();
  const now = Date.now();
  const title = Array.from(`${source.title}（副本）`)
    .slice(0, POLL_LIMITS.title)
    .join("");

  const statements = [
    c.env.DB.prepare(
      `INSERT INTO polls
        (id, title, description, max_choices, is_listed, deadline_at, closed_at, created_at)
       VALUES (?, ?, ?, ?, 0, NULL, NULL, ?)`,
    ).bind(
      newId,
      title,
      source.description,
      source.max_choices,
      now,
    ),
    ...sourceOptions.map((option, index) =>
      c.env.DB.prepare(
        "INSERT INTO options (poll_id, label, position) VALUES (?, ?, ?)",
      ).bind(newId, option.label, index),
    ),
  ];

  await c.env.DB.batch(statements);
  return c.json({ id: newId }, 201);
});

adminRoutes.route("/", protectedRoutes);

export default adminRoutes;
