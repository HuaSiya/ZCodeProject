import { LockKeyhole } from "lucide-react";
import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useAdminAuth } from "../context/AdminAuth";
import { Button, Card, Container, Field, Input, Spinner } from "./ui";

export function AdminLoginCard({
  title = "管理员登录",
  description = "输入管理员口令后，即可创建和管理投票。",
}: {
  title?: string;
  description?: string;
}) {
  const { login } = useAdminAuth();
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!passcode.trim()) {
      setError("请输入管理员口令");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await login(passcode);
    } catch (loginError) {
      setError(
        loginError instanceof Error ? loginError.message : "登录失败",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="mx-auto w-full max-w-sm p-6">
      <div className="mb-5 grid size-11 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
        <LockKeyhole className="size-5" />
      </div>
      <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
      <p className="mt-1 text-sm text-slate-500">{description}</p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <Field label="管理员口令" htmlFor="admin-passcode">
          <Input
            id="admin-passcode"
            type="password"
            value={passcode}
            onChange={(event) => setPasscode(event.target.value)}
            autoComplete="current-password"
            placeholder="请输入口令"
            autoFocus
          />
        </Field>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? (
            <>
              <Spinner className="size-4 text-white" />
              验证中
            </>
          ) : (
            "进入管理后台"
          )}
        </Button>
      </form>

      <p className="mt-4 text-center text-xs text-slate-400">
        口令由部署者在 Cloudflare Secret 中设置
      </p>
    </Card>
  );
}

export function AdminGate({ children }: { children: ReactNode }) {
  const { loading, authenticated } = useAdminAuth();

  if (loading) {
    return (
      <Container className="py-20">
        <div className="flex justify-center">
          <Spinner className="size-6 text-indigo-600" />
        </div>
      </Container>
    );
  }

  if (!authenticated) {
    return (
      <Container className="py-12 sm:py-16">
        <AdminLoginCard />
      </Container>
    );
  }

  return <>{children}</>;
}
