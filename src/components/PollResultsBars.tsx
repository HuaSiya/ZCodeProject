import type { PollResults } from "../../shared/types";
import { formatPercent } from "../lib/format";

export function PollResultsBars({
  results,
  emptyMessage = "还没有人投票",
}: {
  results: PollResults;
  emptyMessage?: string;
}) {
  if (results.totalVoters === 0) {
    return (
      <p className="py-4 text-center text-sm text-slate-500">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {results.options.map((option) => (
        <div key={option.id}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium text-slate-700">
              {option.label}
            </span>
            <span className="shrink-0 tabular-nums text-slate-500">
              {option.count} 票 · {formatPercent(option.percent)}
            </span>
          </div>
          <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-indigo-500 transition-[width] duration-700 ease-out"
              style={{ width: `${Math.min(100, option.percent)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
