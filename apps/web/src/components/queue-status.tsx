import { useEffect, useRef } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "../lib/api"
import { basename, formatBytes } from "../lib/format"
import { Card } from "./ui"
import { ProgressBar } from "./tremor/progress-bar"

export function QueueStatus() {
  const queryClient = useQueryClient()
  const previousActive = useRef(0)
  const operations = useQuery({
    queryKey: ["operations"],
    queryFn: api.operations,
    refetchInterval: (query) =>
      query.state.data?.running || (query.state.data?.queued ?? 0) > 0
        ? 1200
        : 4000,
  })

  const running = operations.data?.running ?? null
  const queued = operations.data?.queued ?? 0
  const activeCount = (running ? 1 : 0) + queued

  useEffect(() => {
    if (previousActive.current > 0 && activeCount === 0) {
      void queryClient.invalidateQueries({ queryKey: ["groups"] })
      void queryClient.invalidateQueries({ queryKey: ["jobs"] })
      void queryClient.invalidateQueries({ queryKey: ["stats"] })
      void queryClient.invalidateQueries({ queryKey: ["settings"] })
    }
    previousActive.current = activeCount
  }, [activeCount, queryClient])

  const percent =
    running && running.progress_total > 0
      ? Math.min(
          100,
          Math.round((running.progress_done / running.progress_total) * 100),
        )
      : 0

  const last = operations.data?.recent?.[0] ?? null
  const queueState = running
    ? { label: "Running", dot: "bg-blue-500 animate-pulse" }
    : queued > 0
      ? { label: "Queued", dot: "bg-yellow-500" }
      : last?.status === "failed"
        ? { label: "Failed", dot: "bg-red-500" }
        : last
          ? { label: "Finished", dot: "bg-emerald-500" }
          : { label: "Idle", dot: "bg-gray-400" }

  return (
    <Card className="overflow-hidden p-0">
      <div className="px-3 pb-3 pt-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium text-gray-500">Queue</span>
          <span className="inline-flex items-center gap-1.5 text-[10px] text-gray-500">
            <span
              className={`size-1.5 rounded-full ${queueState.dot}`}
              aria-hidden="true"
            />
            {queueState.label}
          </span>
        </div>

        {running ? (
          <>
            <div className="mt-2 truncate text-xs font-medium text-gray-900">
              {running.job_title ?? basename(running.source_path)}
            </div>
            <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-gray-500">
              <span className="capitalize">{running.kind}</span>
              <span className="tabular-nums">{percent}%</span>
            </div>
            <ProgressBar value={percent} className="mt-1.5 h-1.5" />
            <div className="mt-1 text-[10px] tabular-nums text-gray-400">
              {formatBytes(running.progress_done)} /{" "}
              {formatBytes(running.progress_total)}
            </div>
          </>
        ) : (
          <p className="mt-2 text-[11px] text-gray-500">
            No active file operations.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-3 py-2 text-[10px] text-gray-500">
        <span className="capitalize">{running ? running.kind : "Idle"}</span>
        <span>
          {queued > 0
            ? `${queued} waiting`
            : running
              ? "In progress"
              : "Ready"}
        </span>
      </div>
    </Card>
  )
}
