import {
  ArrowRight,
  BarChart3,
  Clock,
  ListChecks,
  Plus,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { PublicPollSummary } from "../../shared/types";
import {
  Badge,
  Container,
  EmptyState,
  ErrorNotice,
  buttonClass,
} from "../components/ui";
import { api } from "../lib/api";
import { formatDateTime } from "../lib/format";

function PollCard({ poll }: { poll: PublicPollSummary }) {
  return (
    <Link
      to={`/p/${poll.id}`}
      className="group block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-slate-900 transition group-hover:text-indigo-700">
            {poll.title}
          </h3>
          {poll.description && (
            <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-500">
              {poll.description}
            </p>
          )}
        </div>
        <ArrowRight className="mt-1 size-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-500" />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1">
          <ListChecks className="size-3.5" />
          {poll.optionsCount} 个选项
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock className="size-3.5" />
          {poll.deadlineAt
            ? `截止 ${formatDateTime(poll.deadlineAt)}`
            : "长期开放"}
        </span>
        {poll.maxChoices > 1 && (
          <Badge tone="indigo">多选 · 最多 {poll.maxChoices} 项</Badge>
        )}
      </div>
    </Link>
  );
}

export default function HomePage() {
  const [polls, setPolls] = useState<PublicPollSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setPolls(await api.listPolls());
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "加载失败",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Container className="pb-14">
      <section className="py-10 sm:py-14">
        <Badge tone="indigo">
          <Sparkles className="size-3.5" />
          无需登录 · 匿名投票
        </Badge>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          发一个问题，
          <br />
          听听大家的声音
        </h1>
        <p className="mt-3 max-w-xl text-base leading-relaxed text-slate-600">
          创建一个投票，复制链接或二维码分享出去。参与者点开就能投，投完立即看到结果。
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/create" className={buttonClass("primary", "md")}>
            <Plus className="size-4" />
            发起投票
          </Link>
          <a href="#polls" className={buttonClass("secondary", "md")}>
            浏览公开投票
          </a>
        </div>
      </section>

      <section id="polls" className="scroll-mt-24">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              公开投票
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              正在收集意见、且创建者选择公开展示的投票
            </p>
          </div>
          {!loading && polls.length > 0 && (
            <span className="text-sm text-slate-400">
              {polls.length} 场
            </span>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white"
              />
            ))}
          </div>
        ) : error ? (
          <ErrorNotice message={error} onRetry={load} />
        ) : polls.length === 0 ? (
          <EmptyState
            icon={<BarChart3 className="size-6" />}
            title="还没有公开的投票"
            description="创建第一场投票，或把仅链接可见的投票分享给朋友。"
            action={
              <Link to="/create" className={buttonClass()}>
                <Plus className="size-4" />
                发起投票
              </Link>
            }
          />
        ) : (
          <div className="space-y-3">
            {polls.map((poll) => (
              <PollCard key={poll.id} poll={poll} />
            ))}
          </div>
        )}
      </section>
    </Container>
  );
}
