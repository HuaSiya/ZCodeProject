import { BarChart3 } from "lucide-react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { SITE_NAME } from "../../shared/constants";
import { cn } from "./ui";

function navClass({ isActive }: { isActive: boolean }): string {
  return cn(
    "rounded-lg px-3 py-2 text-sm font-medium transition",
    isActive
      ? "bg-indigo-50 text-indigo-700"
      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  );
}

export function Layout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-indigo-600 text-white shadow-sm">
              <BarChart3 className="size-5" />
            </span>
            <span className="text-lg font-bold tracking-tight text-slate-900">
              {SITE_NAME}
            </span>
          </Link>
          <nav className="flex items-center gap-1">
            <NavLink to="/" end className={navClass}>
              首页
            </NavLink>
            <NavLink to="/admin" className={navClass}>
              管理
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200/70 py-6 text-center text-xs text-slate-400">
        {SITE_NAME} · 发一个问题，听听大家的声音
      </footer>
    </div>
  );
}
