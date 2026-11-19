export interface PollOption {
  id: number;
  label: string;
}

export interface PublicPollSummary {
  id: string;
  title: string;
  description: string;
  optionsCount: number;
  maxChoices: number;
  deadlineAt: number | null;
  closedAt: number | null;
  isClosed: boolean;
  isListed: boolean;
  createdAt: number;
}

export interface PollResultOption extends PollOption {
  count: number;
  percent: number;
}

export interface PollResults {
  totalVoters: number;
  options: PollResultOption[];
}

export interface PollDetail {
  id: string;
  title: string;
  description: string;
  maxChoices: number;
  options: PollOption[];
  deadlineAt: number | null;
  closedAt: number | null;
  isClosed: boolean;
  isListed: boolean;
  createdAt: number;
  hasVoted: boolean;
  /** 仅当已投票或投票已截止时返回。 */
  results: PollResults | null;
}

export interface AdminPollSummary extends PublicPollSummary {
  totalVoters: number;
}

export interface AdminPollDetail extends PollDetail {
  totalVoters: number;
}

export interface CreatePollPayload {
  title: string;
  description: string;
  options: string[];
  maxChoices: number;
  deadlineAt: number | null;
  isListed: boolean;
}

export interface UpdatePollPayload {
  title?: string;
  description?: string;
  options?: string[];
  maxChoices?: number;
  deadlineAt?: number | null;
  isListed?: boolean;
}

export interface SessionResponse {
  authenticated: boolean;
}

export interface OkResponse {
  ok: true;
}

export interface CreatePollResponse {
  id: string;
}

export interface DeletePollResponse {
  ok: true;
  deletedId: string;
}

export interface DuplicatePollResponse {
  id: string;
}
