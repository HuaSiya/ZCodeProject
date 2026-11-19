import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type {
  AdminPollDetail,
  CreatePollPayload,
  UpdatePollPayload,
} from "../../shared/types";
import { AdminGate } from "../components/AdminGate";
import { PollForm } from "../components/PollForm";
import { useToast } from "../components/Toast";
import {
  Badge,
  Button,
  Card,
  Container,
  Spinner,
  buttonClass,
} from "../components/ui";
import { api } from "../lib/api";

export default function EditPollPage() {
  return (
    <AdminGate>
      <EditPollScreen />
    </AdminGate>
  );
}

function EditPollScreen() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [poll, setPoll] = useState<AdminPollDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setPoll(await api.admin.getPoll(id));
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "加载失败",
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

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
          to="/admin"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-800"
        >
          <ArrowLeft className="size-4" />
          返回管理后台
        </Link>
        <Card className="mt-4 p-8 text-center">
          <h1 className="text-lg font-semibold text-slate-900">
            无法加载这场投票
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {error || "投票不存在或已被删除"}
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Button onClick={load}>重试</Button>
            <Link to="/admin" className={buttonClass("secondary", "md")}>
              返回管理后台
            </Link>
          </div>
        </Card>
      </Container>
    );
  }

  const currentPoll = poll;
  const locked = currentPoll.totalVoters > 0;

  async function handleSubmit(payload: CreatePollPayload) {
    if (locked) {
      await api.admin.updatePoll(currentPoll.id, {
        isListed: payload.isListed,
      });
    } else {
      const update: UpdatePollPayload = {
        title: payload.title,
        description: payload.description,
        options: payload.options,
        maxChoices: payload.maxChoices,
        isListed: payload.isListed,
      };
      if (payload.deadlineAt !== currentPoll.deadlineAt) {
        update.deadlineAt = payload.deadlineAt;
      }
      await api.admin.updatePoll(currentPoll.id, update);
    }
    toast.show("修改已保存", "success");
    navigate("/admin");
  }

  return (
    <Container className="py-8 sm:py-10">
      <Link
        to="/admin"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-800"
      >
        <ArrowLeft className="size-4" />
        返回管理后台
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            编辑投票
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            修改标题、选项和公开设置。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={currentPoll.isClosed ? "slate" : "green"}>
            {currentPoll.isClosed ? "已截止" : "进行中"}
          </Badge>
          <Link
            to={`/p/${currentPoll.id}`}
            className="text-sm font-medium text-indigo-600 transition hover:text-indigo-700"
          >
            查看投票页 →
          </Link>
        </div>
      </div>

      <div className="mt-6">
        <PollForm
          initial={{
            title: currentPoll.title,
            description: currentPoll.description,
            options: currentPoll.options.map((option) => option.label),
            maxChoices: currentPoll.maxChoices,
            deadlineAt: currentPoll.deadlineAt,
            isListed: currentPoll.isListed,
          }}
          submitLabel={locked ? "保存公开设置" : "保存修改"}
          contentLocked={locked}
          lockedNote={`已有 ${currentPoll.totalVoters} 人参与，标题、选项、截止时间等内容已锁定；你仍然可以调整是否公开到首页。`}
          onSubmit={handleSubmit}
        />
      </div>
    </Container>
  );
}
