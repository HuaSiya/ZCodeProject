import { ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { AdminGate } from "../components/AdminGate";
import { PollForm } from "../components/PollForm";
import { Container } from "../components/ui";
import { api } from "../lib/api";

export default function CreatePollPage() {
  const navigate = useNavigate();

  return (
    <AdminGate>
      <Container className="py-8 sm:py-10">
        <Link
          to="/admin"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-800"
        >
          <ArrowLeft className="size-4" />
          返回管理后台
        </Link>

        <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          发起投票
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          创建后会得到一个投票链接，复制或生成二维码分享即可。
        </p>

        <div className="mt-6">
          <PollForm
            submitLabel="创建并获取链接"
            onSubmit={async (payload) => {
              const result = await api.admin.createPoll(payload);
              navigate(`/p/${result.id}?created=1`);
            }}
          />
        </div>
      </Container>
    </AdminGate>
  );
}
