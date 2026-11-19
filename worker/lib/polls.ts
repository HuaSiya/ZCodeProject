import type {
  AdminPollDetail,
  AdminPollSummary,
  PollDetail,
  PollOption,
  PollResults,
  PublicPollSummary,
} from "../../shared/types";

export interface PollRow {
  id: string;
  title: string;
  description: string;
  max_choices: number;
  is_listed: number;
  deadline_at: number | null;
  closed_at: number | null;
  created_at: number;
}

interface PollSummaryRow extends PollRow {
  options_count: number;
}

interface AdminPollRow extends PollSummaryRow {
  total_voters: number;
}

interface OptionRow {
  id: number;
  label: string;
  position: number;
}

interface OptionCountRow extends OptionRow {
  count: number;
}

export function isPollClosed(poll: PollRow, now: number): boolean {
  return (
    poll.closed_at !== null ||
    (poll.deadline_at !== null && poll.deadline_at <= now)
  );
}

function toPublicSummary(
  row: PollSummaryRow,
  now: number,
): PublicPollSummary {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    optionsCount: row.options_count,
    maxChoices: row.max_choices,
    deadlineAt: row.deadline_at,
    closedAt: row.closed_at,
    isClosed: isPollClosed(row, now),
    isListed: row.is_listed === 1,
    createdAt: row.created_at,
  };
}

function toAdminSummary(row: AdminPollRow, now: number): AdminPollSummary {
  return {
    ...toPublicSummary(row, now),
    totalVoters: row.total_voters,
  };
}

export async function listPublicPolls(
  db: D1Database,
  now: number,
): Promise<PublicPollSummary[]> {
  const { results } = await db
    .prepare(
      `SELECT p.*,
        (SELECT COUNT(*) FROM options o WHERE o.poll_id = p.id) AS options_count
       FROM polls p
       WHERE p.is_listed = 1
         AND p.closed_at IS NULL
         AND (p.deadline_at IS NULL OR p.deadline_at > ?)
       ORDER BY p.created_at DESC
       LIMIT 100`,
    )
    .bind(now)
    .all<PollSummaryRow>();

  return (results ?? []).map((row) => toPublicSummary(row, now));
}

export async function listAdminPolls(
  db: D1Database,
  now: number,
): Promise<AdminPollSummary[]> {
  const { results } = await db
    .prepare(
      `SELECT p.*,
        (SELECT COUNT(*) FROM options o WHERE o.poll_id = p.id) AS options_count,
        (SELECT COUNT(*) FROM poll_voters v WHERE v.poll_id = p.id) AS total_voters
       FROM polls p
       ORDER BY p.created_at DESC
       LIMIT 200`,
    )
    .all<AdminPollRow>();

  return (results ?? []).map((row) => toAdminSummary(row, now));
}

export function getPollRow(
  db: D1Database,
  pollId: string,
): Promise<PollRow | null> {
  return db
    .prepare("SELECT * FROM polls WHERE id = ?")
    .bind(pollId)
    .first<PollRow>();
}

export async function getOptions(
  db: D1Database,
  pollId: string,
): Promise<OptionRow[]> {
  const { results } = await db
    .prepare(
      "SELECT id, label, position FROM options WHERE poll_id = ? ORDER BY position ASC",
    )
    .bind(pollId)
    .all<OptionRow>();
  return results ?? [];
}

export async function getTotalVoters(
  db: D1Database,
  pollId: string,
): Promise<number> {
  const row = await db
    .prepare("SELECT COUNT(*) AS count FROM poll_voters WHERE poll_id = ?")
    .bind(pollId)
    .first<{ count: number }>();
  return row?.count ?? 0;
}

export async function hasVoted(
  db: D1Database,
  pollId: string,
  voterKey: string,
): Promise<boolean> {
  const row = await db
    .prepare(
      "SELECT 1 AS found FROM poll_voters WHERE poll_id = ? AND voter_key = ?",
    )
    .bind(pollId, voterKey)
    .first<{ found: number }>();
  return Boolean(row);
}

export async function getResults(
  db: D1Database,
  pollId: string,
): Promise<PollResults> {
  const [{ results }, totalVoters] = await Promise.all([
    db
      .prepare(
        `SELECT o.id, o.label, o.position, COUNT(v.id) AS count
         FROM options o
         LEFT JOIN votes v ON v.option_id = o.id AND v.poll_id = o.poll_id
         WHERE o.poll_id = ?
         GROUP BY o.id, o.label, o.position
         ORDER BY o.position ASC`,
      )
      .bind(pollId)
      .all<OptionCountRow>(),
    getTotalVoters(db, pollId),
  ]);

  const options = (results ?? []).map((row) => ({
    id: row.id,
    label: row.label,
    count: row.count,
    percent:
      totalVoters > 0
        ? Math.round((row.count / totalVoters) * 1000) / 10
        : 0,
  }));

  return { totalVoters, options };
}

function toOptions(options: OptionRow[]): PollOption[] {
  return options.map((option) => ({ id: option.id, label: option.label }));
}

export async function buildPollDetail(
  db: D1Database,
  poll: PollRow,
  voterKey: string,
  now: number,
): Promise<PollDetail> {
  const [options, voted] = await Promise.all([
    getOptions(db, poll.id),
    hasVoted(db, poll.id, voterKey),
  ]);
  const isClosed = isPollClosed(poll, now);
  const results =
    voted || isClosed ? await getResults(db, poll.id) : null;

  return {
    id: poll.id,
    title: poll.title,
    description: poll.description,
    maxChoices: poll.max_choices,
    options: toOptions(options),
    deadlineAt: poll.deadline_at,
    closedAt: poll.closed_at,
    isClosed,
    isListed: poll.is_listed === 1,
    createdAt: poll.created_at,
    hasVoted: voted,
    results,
  };
}

export async function buildAdminPollDetail(
  db: D1Database,
  poll: PollRow,
  now: number,
): Promise<AdminPollDetail> {
  const [options, totalVoters, results] = await Promise.all([
    getOptions(db, poll.id),
    getTotalVoters(db, poll.id),
    getResults(db, poll.id),
  ]);

  return {
    id: poll.id,
    title: poll.title,
    description: poll.description,
    maxChoices: poll.max_choices,
    options: toOptions(options),
    deadlineAt: poll.deadline_at,
    closedAt: poll.closed_at,
    isClosed: isPollClosed(poll, now),
    isListed: poll.is_listed === 1,
    createdAt: poll.created_at,
    hasVoted: false,
    results,
    totalVoters,
  };
}
