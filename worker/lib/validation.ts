import { POLL_LIMITS } from "../../shared/constants";

export interface PollContent {
  title: string;
  description: string;
  options: string[];
  maxChoices: number;
  deadlineAt: number | null;
  isListed: boolean;
}

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isValidPollId(id: string): boolean {
  return /^[a-z0-9]{6,32}$/i.test(id);
}

export function validatePollContent(
  input: unknown,
  options: { now: number; requireFutureDeadline: boolean },
): ValidationResult<PollContent> {
  if (!isRecord(input)) {
    return { ok: false, error: "请求格式不正确" };
  }

  if (typeof input.title !== "string") {
    return { ok: false, error: "请填写投票标题" };
  }
  const title = input.title.trim();
  if (!title) {
    return { ok: false, error: "请填写投票标题" };
  }
  if (title.length > POLL_LIMITS.title) {
    return {
      ok: false,
      error: `标题不能超过 ${POLL_LIMITS.title} 个字`,
    };
  }

  if (input.description !== undefined && typeof input.description !== "string") {
    return { ok: false, error: "描述格式不正确" };
  }
  const description =
    typeof input.description === "string" ? input.description.trim() : "";
  if (description.length > POLL_LIMITS.description) {
    return {
      ok: false,
      error: `描述不能超过 ${POLL_LIMITS.description} 个字`,
    };
  }

  if (!Array.isArray(input.options)) {
    return { ok: false, error: "请添加投票选项" };
  }
  if (
    input.options.length < POLL_LIMITS.minOptions ||
    input.options.length > POLL_LIMITS.maxOptions
  ) {
    return {
      ok: false,
      error: `选项数量需要在 ${POLL_LIMITS.minOptions} 到 ${POLL_LIMITS.maxOptions} 个之间`,
    };
  }

  const labels: string[] = [];
  for (const rawLabel of input.options) {
    if (typeof rawLabel !== "string") {
      return { ok: false, error: "选项格式不正确" };
    }
    const label = rawLabel.trim();
    if (!label) {
      return { ok: false, error: "选项不能为空" };
    }
    if (label.length > POLL_LIMITS.optionLabel) {
      return {
        ok: false,
        error: `单个选项不能超过 ${POLL_LIMITS.optionLabel} 个字`,
      };
    }
    labels.push(label);
  }

  const seen = new Set<string>();
  for (const label of labels) {
    const key = label.toLowerCase();
    if (seen.has(key)) {
      return { ok: false, error: `选项「${label}」重复了` };
    }
    seen.add(key);
  }

  const maxChoices = input.maxChoices;
  if (
    typeof maxChoices !== "number" ||
    !Number.isInteger(maxChoices) ||
    maxChoices < 1 ||
    maxChoices > labels.length
  ) {
    return {
      ok: false,
      error: `最多可选数需要在 1 到 ${labels.length} 之间`,
    };
  }

  let deadlineAt: number | null = null;
  if (input.deadlineAt !== undefined && input.deadlineAt !== null) {
    if (typeof input.deadlineAt !== "number" || !Number.isFinite(input.deadlineAt)) {
      return { ok: false, error: "截止时间格式不正确" };
    }
    const value = Math.trunc(input.deadlineAt);
    if (options.requireFutureDeadline && value <= options.now + 30_000) {
      return { ok: false, error: "截止时间至少要在 30 秒之后" };
    }
    deadlineAt = value;
  }

  let isListed = false;
  if (input.isListed !== undefined) {
    if (typeof input.isListed !== "boolean") {
      return { ok: false, error: "公开状态格式不正确" };
    }
    isListed = input.isListed;
  }

  return {
    ok: true,
    value: {
      title,
      description,
      options: labels,
      maxChoices,
      deadlineAt,
      isListed,
    },
  };
}
