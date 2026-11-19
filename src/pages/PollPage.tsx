import {
  ArrowLeft,
  Check,
  Clock,
  ListChecks,
  Lock,
  Send,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import type { PollDetail } from "../../shared/types";
import { PollResultsBars } from "../components/PollResultsBars";
import { ShareBar } from "../components/ShareBar";
import { useToast } from "../components/Toast";
import {
  Badge,
  Button,
  Card,
  Container,
  Spinner,
  buttonClass,
  cn,
} from "../components/ui";
import { ApiError, api } from "../lib/api";
import { formatDateTime } from "../lib/format";

function ResultsCard({ poll }: { poll: PollDetail }) {
  const results = poll.results;
  if (!results) {
    return null;
  }

  const hasVoters = results.totalVoters > 0;

  return (
    <Card className="mt-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold text-slate-900">
            投票结果
          </h2>
          {poll.hasVoted && (
            <Badge tone="green">
              <Check className="size-3.5" />
              已投票
            </Badge>
          )}
          {poll.isClosed && <Badge tone="slate">已截止</Badge>}
        </div>
        <span className="text-sm text-slate-500">
          共{" "}
          <strong className="font-semibold text-slate-900">
            {results.totalVoters}
          </strong>{" "}
          人参与
        </span>
      </div>

      <div className="mt-5">
        <PollResultsBars
          results={results}
          emptyMessage="还没有人投票，分享出去让大家来投第一票吧。"
        />
      </div>

      {poll.maxChoices > 1 && hasVoters && (
        <p className="mt-5 text-xs text-slate-400">
          百分比按参与人数计算，多选时各项之和可能超过 100%。
        </p>
      )}
    </Card>
  );
}

export default function PollPage() {
  const { id = "" } = useParams();
  const [searchParams] = useSearchParams();
  const justCreated = searchParams.get("created") === "1";
  const toast = useToast();

  const [poll, setPoll] = useState<PollDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    setSelected([]);
    try {
      setPoll(await api.getPoll(id));
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "加载失败",
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function refreshSilently() {
    try {
      setPoll(await api.getPoll(id));
    } catch {
      // Keep the current view; the user can refresh manually if needed.
    }
  }

  function toggleOption(optionId: number) {
    if (!poll) {
      return;
    }
    if (poll.maxChoices === 1) {
      setSelected([optionId]);
      return;
    }
    if (selected.includes(optionId)) {
      setSelected(selected.filter((idValue) => idValue !== optionId));
      return;
    }
    if (selected.length >= poll.maxChoices) {
      toast.show(`最多只能选择 ${poll.maxChoices} 项`, "error");
      return;
    }
    setSelected([...selected, optionId]);
  }

  async function handleVote() {
    if (!poll || selected.length === 0 || submitting) {
      return;
    }
    setSubmitting(true);
    try {
      const updated = await api.vote(poll.id, selected);
      setPoll(updated);
      setSelected([]);
      toast.show("投票成功", "success");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        toast.show(error.message, "error");
        await refreshSilently();
      } else {
        toast.show(
          error instanceof Error ? error.message : "投票失败",
          "error",
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <Container className="py-20">
        <div className="flex justify-center">
          <Spinner className="size-6 text-indigo-600" />
        </div>
      </Container>
    );
  }

  if (!poll) {
    return (
      <Container className="py-10">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-800"
        >
          <ArrowLeft className="size-4" />
          返回首页
        </Link>
        <Card className="mt-4 p-8 text-center">
          <h1 className="text-lg font-semibold text-slate-900">
            无法打开这场投票
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {loadError || "投票不存在或已被删除"}
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Button onClick={load}>重试</Button>
            <Link to="/" className={buttonClass("secondary", "md")}>
              返回首页
            </Link>
          </div>
        </Card>
      </Container>
    );
  }

  const isMulti = poll.maxChoices > 1;

  return (
    <Container className="py-8 sm:py-10">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-800"
      >
        <ArrowLeft className="size-4" />
        返回首页
      </Link>

      {justCreated && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          投票已创建。把下面的链接或二维码分享给大家吧。
        </div>
      )}

      <Card className="mt-4 p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-2">
          {poll.isClosed ? (
            <Badge tone="slate">已截止</Badge>
          ) : (
            <Badge tone="green">进行中</Badge>
          )}
          {isMulti ? (
            <Badge tone="indigo">多选 · 最多 {poll.maxChoices} 项</Badge>
          ) : (
            <Badge tone="slate">单选</Badge>
          )}
        </div>

        <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {poll.title}
        </h1>

        {poll.description && (
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600">
            {poll.description}
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <ListChecks className="size-3.5" />
            {poll.options.length} 个选项
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" />
            {poll.deadlineAt
              ? `截止 ${formatDateTime(poll.deadlineAt)}`
              : "长期开放"}
          </span>
        </div>
      </Card>

      <div className="mt-4">
        <ShareBar pollId={poll.id} />
      </div>

      {poll.results ? (
        <ResultsCard poll={poll} />
      ) : (
        <Card className="mt-4 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                {isMulti
                  ? `最多选择 ${poll.maxChoices} 项`
                  : "选择一个选项"}
              </h2>
              <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                <Lock className="size-3.5" />
                投票后不可修改，提交后即可查看结果
              </p>
            </div>
            <span className="shrink-0 text-xs tabular-nums text-slate-400">
              已选 {selected.length}
              {isMulti ? `/${poll.maxChoices}` : ""}
            </span>
          </div>

          <div className="mt-4 space-y-2.5">
            {poll.options.map((option) => {
              const checked = selected.includes(option.id);
              return (
                <label
                  key={option.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition focus-within:ring-2 focus-within:ring-indigo-400 focus-within:ring-offset-2",
                    checked
                      ? "border-indigo-500 bg-indigo-50/70 ring-4 ring-indigo-100"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
                  )}
                >
                  <input
                    type={isMulti ? "checkbox" : "radio"}
                    name="poll-option"
                    className="sr-only"
                    checked={checked}
                    onChange={() => toggleOption(option.id)}
                  />
                  <span
                    className={cn(
                      "grid size-5 shrink-0 place-items-center border transition",
                      isMulti ? "rounded-md" : "rounded-full",
                      checked
                        ? "border-indigo-600 bg-indigo-600 text-white"
                        : "border-slate-300 bg-white text-transparent",
                    )}
                  >
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                  <span className="text-sm font-medium text-slate-800">
                    {option.label}
                  </span>
                </label>
              );
            })}
          </div>

          <Button
            className="mt-5 w-full"
            size="lg"
            disabled={selected.length === 0 || submitting}
            onClick={handleVote}
          >
            {submitting ? (
              <>
                <Spinner className="size-4 text-white" />
                提交中
              </>
            ) : (
              <>
                <Send className="size-4" />
                提交投票
              </>
            )}
          </Button>
        </Card>
      )}
    </Container>
  );
}
