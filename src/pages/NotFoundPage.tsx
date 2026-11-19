import { Link } from "react-router-dom";
import { Container, buttonClass } from "../components/ui";

export default function NotFoundPage() {
  return (
    <Container className="py-20 text-center">
      <p className="text-6xl font-bold text-slate-200">404</p>
      <h1 className="mt-3 text-xl font-semibold text-slate-900">
        页面不存在
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        链接可能已失效，或者投票已被删除。
      </p>
      <div className="mt-6 flex justify-center">
        <Link to="/" className={buttonClass()}>
          返回首页
        </Link>
      </div>
    </Container>
  );
}
