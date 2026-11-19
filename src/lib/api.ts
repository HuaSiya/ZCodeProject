import type {
  AdminPollDetail,
  AdminPollSummary,
  CreatePollPayload,
  CreatePollResponse,
  DeletePollResponse,
  DuplicatePollResponse,
  OkResponse,
  PollDetail,
  PublicPollSummary,
  SessionResponse,
  UpdatePollPayload,
} from "../../shared/types";

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function extractErrorMessage(data: unknown): string {
  if (typeof data === "object" && data !== null && "error" in data) {
    const error = (data as { error?: unknown }).error;
    if (typeof error === "string") {
      return error;
    }
  }
  return "请求失败，请稍后再试";
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const init: RequestInit = {
    method: options.method ?? "GET",
    credentials: "same-origin",
  };

  if (options.body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(options.body);
  }

  const response = await fetch(path, init);
  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(extractErrorMessage(data), response.status);
  }

  return data as T;
}

export const api = {
  listPolls: () => request<PublicPollSummary[]>("/api/polls"),
  getPoll: (pollId: string) =>
    request<PollDetail>(`/api/polls/${encodeURIComponent(pollId)}`),
  vote: (pollId: string, optionIds: number[]) =>
    request<PollDetail>(
      `/api/polls/${encodeURIComponent(pollId)}/vote`,
      { method: "POST", body: { optionIds } },
    ),
  admin: {
    login: (passcode: string) =>
      request<OkResponse>("/api/admin/login", {
        method: "POST",
        body: { passcode },
      }),
    logout: () =>
      request<OkResponse>("/api/admin/logout", { method: "POST" }),
    session: () => request<SessionResponse>("/api/admin/session"),
    listPolls: () => request<AdminPollSummary[]>("/api/admin/polls"),
    getPoll: (pollId: string) =>
      request<AdminPollDetail>(
        `/api/admin/polls/${encodeURIComponent(pollId)}`,
      ),
    createPoll: (payload: CreatePollPayload) =>
      request<CreatePollResponse>("/api/admin/polls", {
        method: "POST",
        body: payload,
      }),
    updatePoll: (pollId: string, payload: UpdatePollPayload) =>
      request<AdminPollDetail>(
        `/api/admin/polls/${encodeURIComponent(pollId)}`,
        { method: "PATCH", body: payload },
      ),
    closePoll: (pollId: string) =>
      request<AdminPollDetail>(
        `/api/admin/polls/${encodeURIComponent(pollId)}/close`,
        { method: "POST" },
      ),
    deletePoll: (pollId: string) =>
      request<DeletePollResponse>(
        `/api/admin/polls/${encodeURIComponent(pollId)}`,
        { method: "DELETE" },
      ),
    duplicatePoll: (pollId: string) =>
      request<DuplicatePollResponse>(
        `/api/admin/polls/${encodeURIComponent(pollId)}/duplicate`,
        { method: "POST" },
      ),
  },
};
