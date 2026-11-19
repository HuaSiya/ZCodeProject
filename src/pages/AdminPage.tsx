import {
  BarChart3,
  Clock,
  Copy,
  ListChecks,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import type {
  AdminPollDetail,
  AdminPollSummary,
} from "../../shared/types";
import { AdminGate } from "../components/AdminGate";
import { PollResultsBars } from "../components/PollResultsBars";
import { useToast } from "../components/Toast";
import {
  Badge,
  Button,
  Card,
  Container,
  EmptyState,
  ErrorNotice,
  Modal,
  Spinner,
  buttonClass,
} from "../components/ui";
import { useAdminAuth } from "../context/AdminAuth";
import { api } from "../lib/api";
import { formatDate, formatDateTime } from "../lib/format";

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: ReactNode;
}) {
  return (
    <Card className="p-3.5 sm:p-4">
      <div className="flex items-center gap-2 text-slate-400">
        {icon}
        <span className="text-xs font-medium text-slate-500">{label}</span>
      </div>
      <p className="mt-2 text-xl font-bold tabular-nums text-slate-900">
        {value}
      </p>
    </Card>
  );
}

export default function AdminPage() {
  return (
    <AdminGate>
      <AdminDashboard />
    </AdminGate>
  );
}

function AdminDashboard() {
  const { logout } = useAdminAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [polls, setPolls] = useState<AdminPollSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{
    type: "close" | "delete";
    poll: AdminPollSummary;
  } | null>(null);
  const [resultsLoadingId, setResultsLoadingId] = useState<string | null>(
    null,
  );
  const [resultsView, setResultsView] = useState<{
    poll: AdminPollSummary;
    detail: AdminPollDetail;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setPolls(await api.admin.listPolls());
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

  const openCount = polls.filter((poll) => !poll.isClosed).length;
  const totalVoters = polls.reduce(
    (sum, poll) => sum + poll.totalVoters,
    0,
  );

  async function handleDuplicate(poll: AdminPollSummary) {
    setBusyId(poll.id);
    try {
      const result = await api.admin.duplicatePoll(poll.id);
      toast.show(
        "已创建副本（默认不公开），正在打开编辑页",
        "success",
      );
      navigate(`/admin/polls/${result.id}/edit`);
    } catch (duplicateError) {
      toast.show(
        duplicateError instanceof Error
          ? duplicateError.message
          : "复制失败",
        "error",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleConfirm() {
    if (!confirm) {
      return;
    }
    const { type, poll } = confirm;
    setBusyId(poll.id);
    try {
      if (type === "delete") {
        await api.admin.deletePoll(poll.id);
        toast.show("投票已删除", "success");
      } else {
        await api.admin.closePoll(poll.id);
        toast.show("投票已截止", "success");
      }
      setConfirm(null);
      await load();
    } catch (actionError) {
      toast.show(
        actionError instanceof Error ? actionError.message : "操作失败",
        "error",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleViewResults(poll: AdminPollSummary) {
    setResultsLoadingId(poll.id);
    try {
      const detail = await api.admin.getPoll(poll.id);
      setResultsView({ poll, detail });
    } catch (resultsError) {
      toast.show(
        resultsError instanceof Error
          ? resultsError.message
          : "加载结果失败",
        "error",
      );
    } finally {
      setResultsLoadingId(null);
    }
  }

  async function handleLogout() {
    try {
      await logout();
    } catch {
      toast.show("退出失败，请稍后再试", "error");
    }
  }

  const confirmTitle = confirm
    ? confirm.type === "delete"
      ? "删除这场投票？"
      : "提前截止这场投票？"
    : "";

  return (
    <Container wide className="py-8 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-indigo-600">管理后台</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            我的投票
          </h1>
          <p className="mt-2 max-w-md text-sm text-slate-500">
            创建、分享和管理投票。未公开的投票只有拿到链接的人可以访问。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/create"
            className={buttonClass("primary", "md")}
          >
            <Plus className="size-4" />
            新建投票
          </Link>
          <Button
            variant="secondary"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw
              className={loading ? "size-4 animate-spin" : "size-4"}
            />
            刷新
          </Button>
          <Button variant="ghost" onClick={handleLogout}>
            <LogOut className="size-4" />
            退出
          </Button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3">
        <Stat
          label="全部投票"
          value={polls.length}
          icon={<BarChart3 className="size-4" />}
        />
        <Stat
          label="进行中"
          value={openCount}
          icon={<Clock className="size-4" />}
        />
        <Stat
          label="总参与"
          value={totalVoters}
          icon={<Users className="size-4" />}
        />
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-end justify-between gap-4">
          <h2 className="text-base font-semibold text-slate-900">
            全部投票
          </h2>
          {!loading && polls.length > 0 && (
            <span className="text-sm text-slate-400">
              {polls.length} 场
            </span>
          )}
        </div>

        {error ? (
          <ErrorNotice message={error} onRetry={load} />
        ) : loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-white"
              />
            ))}
          </div>
        ) : polls.length === 0 ? (
          <EmptyState
            icon={<BarChart3 className="size-6" />}
            title="还没有创建投票"
            description="点击「新建投票」，设置问题和选项，然后把链接分享出去。"
            action={
              <Link to="/create" className={buttonClass()}>
                <Plus className="size-4" />
                新建投票
              </Link>
            }
          />
        ) : (
          <div className="space-y-3">
            {polls.map((poll) => {
              const busy = busyId === poll.id;
              return (
                <Card key={poll.id} className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/p/${poll.id}`}
                          className="truncate text-base font-semibold text-slate-900 transition hover:text-indigo-700"
                        >
                          {poll.title}
                        </Link>
                        {poll.isClosed ? (
                          <Badge tone="slate">已截止</Badge>
                        ) : (
                          <Badge tone="green">进行中</Badge>
                        )}
                        <Badge
                          tone={poll.isListed ? "indigo" : "slate"}
                        >
                          {poll.isListed ? "公开" : "仅链接"}
                        </Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <Users className="size-3.5" />
                          {poll.totalVoters} 人参与
                        </span>
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
                        <span>
                          创建于 {formatDate(poll.createdAt)}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={
                          busy || resultsLoadingId === poll.id
                        }
                        onClick={() => void handleViewResults(poll)}
                      >
                        {resultsLoadingId === poll.id ? (
                          <Spinner className="size-3.5 text-indigo-600" />
                        ) : (
                          <BarChart3 className="size-3.5" />
                        )}
                        结果
                      </Button>
                      <Link
                        to={`/admin/polls/${poll.id}/edit`}
                        className={buttonClass("secondary", "sm")}
                      >
                        <Pencil className="size-3.5" />
                        编辑
                      </Link>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={busy}
                        onClick={() => void handleDuplicate(poll)}
                      >
                        <Copy className="size-3.5" />
                        复制
                      </Button>
                      {!poll.isClosed && (
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            setConfirm({ type: "close", poll })
                          }
                        >
                          <Clock className="size-3.5" />
                          截止
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                        disabled={busy}
                        onClick={() =>
                          setConfirm({ type: "delete", poll })
                        }
                      >
                        <Trash2 className="size-3.5" />
                        删除
                      </Button>
                      {busy && (
                        <Spinner className="size-4 text-indigo-600" />
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <Modal
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirmTitle}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setConfirm(null)}
              disabled={busyId !== null}
            >
              取消
            </Button>
            <Button
              variant={confirm?.type === "delete" ? "danger" : "primary"}
              onClick={() => void handleConfirm()}
              disabled={busyId !== null}
            >
              {busyId !== null
                ? "处理中…"
                : confirm?.type === "delete"
                  ? "确认删除"
                  : "确认截止"}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-slate-600">
          {confirm?.type === "delete"
            ? "投票、选项和所有已投的票都会被永久删除，无法恢复。"
            : "截止后将立即停止接收新投票，结果对所有人公开，此操作不可撤销。"}
        </p>
        {confirm && (
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800">
            {confirm.poll.title}
          </p>
        )}
      </Modal>

      <Modal
        open={resultsView !== null}
        onClose={() => setResultsView(null)}
        title="投票结果"
        footer={
          <Button
            variant="secondary"
            onClick={() => setResultsView(null)}
          >
            关闭
          </Button>
        }
      >
        {resultsView && (
          <>
            <div className="flex items-center justify-between gap-3 text-sm">
              <p className="min-w-0 truncate font-medium text-slate-800">
                {resultsView.poll.title}
              </p>
              <span className="shrink-0 text-slate-500">
                共 {resultsView.detail.results?.totalVoters ?? 0} 人参与
              </span>
            </div>
            <div className="mt-4">
              {resultsView.detail.results ? (
                <PollResultsBars results={resultsView.detail.results} />
              ) : (
                <p className="text-sm text-slate-500">暂时没有结果</p>
              )}
            </div>
            {resultsView.detail.maxChoices > 1 &&
              (resultsView.detail.results?.totalVoters ?? 0) > 0 && (
                <p className="mt-4 text-xs text-slate-400">
                  百分比按参与人数计算，多选时各项之和可能超过 100%。
                </p>
              )}
          </>
        )}
      </Modal>
    </Container>
  );
}
