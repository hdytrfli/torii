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
  })

  const running = operations.data?.running ?? null
  const queued = operations.data?.queued ?? 0
  const activeCount = (running ? 1 : 0) + queued

  useEffect(() => {
    if (previousActive.current > 0 && activeCount === 0) {
      void queryClient.invalidateQueries({ queryKey: ["review-jobs"] })
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
  const queueState =
    running || queued > 0
      ? {
          label: "Processing",
          dot: running
            ? "bg-info animate-pulse"
            : "bg-warning",
        }
      : last?.status === "failed"
        ? { label: "Error", dot: "bg-danger" }
        : { label: "Idle", dot: "bg-ink-muted" }

  return (
    <Card className="overflow-hidden p-0">
      <div className="px-3 pb-3 pt-3">
        <div className="text-xs font-medium text-ink">Queue status</div>
        <p className="mt-1 text-[11px] leading-4 text-ink-muted">
          {running
            ? `${running.kind === "copy" ? "Copying" : "Applying"} ${running.job_title ?? basename(running.source_path)}`
            : queued > 0
              ? `${queued} job${queued === 1 ? "" : "s"} waiting.`
              : last?.status === "failed"
                ? "The last operation failed."
                : "No active work."}
        </p>
        {running ? (
          <>
            <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-ink-muted">
              <span className="capitalize">{running.kind}</span>
              <span className="tabular-nums">{percent}%</span>
            </div>
            <ProgressBar value={percent} className="mt-1.5 h-1.5" />
            <div className="mt-1 text-[10px] tabular-nums text-ink-muted/70">
              {formatBytes(running.progress_done)} /{" "}
              {formatBytes(running.progress_total)}
            </div>
          </>
        ) : null}
      </div>

      <div className="flex items-center justify-between border-t border-line bg-surface-muted px-3 py-2 text-[10px] text-ink-muted">
        <span className="inline-flex items-center gap-1.5">
          <span
            className={`size-1.5 rounded-full ${queueState.dot}`}
            aria-hidden="true"
          />
          {queueState.label}
        </span>
        <span>
          {running
            ? `${percent}%`
            : queued > 0
              ? `${queued} waiting`
              : null}
        </span>
      </div>
    </Card>
  )
}
