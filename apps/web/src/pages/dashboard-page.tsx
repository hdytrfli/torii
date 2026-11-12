import { Link } from "react-router-dom"
import { ArrowUpRight, ScanLine } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { api } from "../lib/api"
import { ReviewWorkspace } from "../components/review-workspace"
import { SourceSummary } from "../components/group-list"
import { Button, Card, StatCard, Skeleton } from "../components/ui"

export function DashboardPage() {
  const stats = useQuery({ queryKey: ["stats"], queryFn: api.stats })
  const groups = useQuery({ queryKey: ["groups", "all"], queryFn: () => api.groups("all") })

  const review = stats.data?.needs_review ?? 0
  const moved = stats.data?.moved ?? 0
  const total = stats.data?.total ?? 0

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-muted">
            Library operations
          </div>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
            Keep the queue moving.
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            Grouped by show, collection, and individual movie so a season pack or a batch folder
            is one decision instead of twenty.
          </p>
        </div>
        <Link to="/queue">
          <Button variant="secondary">
            Open full queue <ArrowUpRight size={14} />
          </Button>
        </Link>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.isLoading ? (
          Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-28" />)
        ) : (
          <>
            <StatCard label="Needs review" value={review} accent="warning" hint="Waiting for a decision" />
            <StatCard label="Moved" value={moved} accent="success" hint="Cleaned and filed" />
            <StatCard label="Total jobs" value={total} hint="All time" />
            <StatCard
              label="Reviewed"
              value={Math.max(0, total - review)}
              hint={`${total ? Math.round(((total - review) / total) * 100) : 0}% of jobs`}
            />
          </>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <section className="min-w-0">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-muted">
                Review queue
              </div>
              <div className="mt-0.5 text-sm font-semibold text-ink">Recent groups</div>
            </div>
            <Link to="/queue" className="text-xs font-medium text-ink-muted hover:text-ink">
              View all →
            </Link>
          </div>
          <ReviewWorkspace compact />
        </section>

        <aside className="flex flex-col gap-3">
          <SourceSummary groups={groups.data ?? []} />
          <Card className="p-4">
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-ink-muted">
              <ScanLine size={13} /> Workflow
            </div>
            <ol className="mt-3 flex list-decimal flex-col gap-2 pl-4 text-xs leading-5 text-ink-muted">
              <li>Stable files are scanned from movies or shows.</li>
              <li>NFO, Jellyfin, then guessit decide the match.</li>
              <li>AI runs only when there are no candidates.</li>
              <li>You approve; sidecars follow the file.</li>
            </ol>
          </Card>
        </aside>
      </div>
    </div>
  )
}
