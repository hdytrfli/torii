import { Link } from "react-router-dom"
import { RefreshCw } from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "../lib/api"
import { Button, Card, Skeleton } from "../components/ui"
import { CategoryBar } from "../components/tremor/category-bar"
import { Divider } from "../components/tremor/divider"
import { GroupedJobTable } from "../components/tremor/job-table"
import { ProgressCircle } from "../components/tremor/progress-circle"
import { Sparkline } from "../components/tremor/sparkline"

export function DashboardPage() {
  const stats = useQuery({ queryKey: ["stats"], queryFn: api.stats })
  const groupsQuery = useQuery({ queryKey: ["groups", "all"], queryFn: () => api.groups("all") })
  const queryClient = useQueryClient()
  const scan = useMutation({
    mutationFn: api.scan,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["stats"] })
      void queryClient.invalidateQueries({ queryKey: ["groups"] })
    },
  })

  const groups = groupsQuery.data ?? []
  const jobs = groups.flatMap((group) => group.jobs)
  const total = stats.data?.total ?? jobs.length
  const review = stats.data?.needs_review ?? 0
  const ready = stats.data?.ready ?? 0
  const moved = stats.data?.moved ?? 0
  const confidence = total
    ? Math.round((jobs.filter((job) => job.confidence >= 0.85).length / total) * 100)
    : 0

  const sourceCounts = jobs.reduce<Record<string, number>>((counts, job) => {
    const label = job.source ?? "guessit"
    counts[label] = (counts[label] ?? 0) + 1
    return counts
  }, {})
  const sourceValues = [
    sourceCounts.jellyfin ?? 0,
    sourceCounts.guessit ?? 0,
    sourceCounts.nfo ?? 0,
    sourceCounts.llm ?? 0,
  ]

  return (
    <main>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Library Overview</h1>
          <p className="text-gray-500 sm:text-sm/6">
            Real-time monitoring of the rename queue and metadata matches
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => scan.mutate()} disabled={scan.isPending}>
            <RefreshCw size={15} className={scan.isPending ? "animate-spin" : ""} />
            Scan now
          </Button>
          <Link to="/queue">
            <Button>Review queue</Button>
          </Link>
        </div>
      </div>

      <Divider />

      <dl className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <dt className="text-sm font-medium text-gray-900">Current Queue</dt>
          <dd className="mt-1 text-3xl font-semibold text-gray-900">{review}</dd>
          <CategoryBar
            values={[review, ready, moved]}
            className="mt-6"
            colors={["blue", "lightGray", "red"]}
          />
          <ul role="list" className="mt-4 flex flex-wrap gap-x-10 gap-y-4 text-sm">
            <li>
              <span className="text-base font-semibold text-gray-900">{review}</span>
              <div className="flex items-center gap-2">
                <span className="size-2.5 shrink-0 rounded-sm bg-gray-900" aria-hidden="true" />
                <span className="text-sm">Needs review</span>
              </div>
            </li>
            <li>
              <span className="text-base font-semibold text-gray-900">{ready}</span>
              <div className="flex items-center gap-2">
                <span className="size-2.5 shrink-0 rounded-sm bg-gray-400" aria-hidden="true" />
                <span className="text-sm">Ready</span>
              </div>
            </li>
            <li>
              <span className="text-base font-semibold text-gray-900">{moved}</span>
              <div className="flex items-center gap-2">
                <span className="size-2.5 shrink-0 rounded-sm bg-gray-300" aria-hidden="true" />
                <span className="text-sm">Moved</span>
              </div>
            </li>
          </ul>
        </Card>

        <Card>
          <dt className="text-sm font-medium text-gray-900">Match Confidence</dt>
          <div className="mt-4 flex flex-nowrap items-center justify-between gap-y-4">
            <dd className="space-y-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="size-2.5 shrink-0 rounded-sm bg-gray-900" aria-hidden="true" />
                  <span className="text-sm">At or above 85%</span>
                </div>
                <span className="mt-1 block text-2xl font-semibold text-gray-900">{confidence}%</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="size-2.5 shrink-0 rounded-sm bg-gray-300" aria-hidden="true" />
                  <span className="text-sm text-gray-900">Below threshold</span>
                </div>
                <span className="mt-1 block text-2xl font-semibold text-gray-900">
                  {100 - confidence}%
                </span>
              </div>
            </dd>
            <ProgressCircle value={confidence} radius={45} strokeWidth={7} />
          </div>
        </Card>

        <Card>
          <dt className="text-sm font-medium text-gray-900">Match Sources</dt>
          <div className="mt-4 flex items-center gap-x-8 gap-y-4">
            <dd className="space-y-3 whitespace-nowrap">
              <div>
                <div className="flex items-center gap-2">
                  <span className="size-2.5 shrink-0 rounded-sm bg-gray-900" aria-hidden="true" />
                  <span className="text-sm">Jellyfin</span>
                </div>
                <span className="mt-1 block text-2xl font-semibold text-gray-900">
                  {sourceCounts.jellyfin ?? 0}
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="size-2.5 shrink-0 rounded-sm bg-gray-400" aria-hidden="true" />
                  <span className="text-sm">Filename</span>
                </div>
                <span className="mt-1 block text-2xl font-semibold text-gray-900">
                  {sourceCounts.guessit ?? 0}
                </span>
              </div>
            </dd>
            <Sparkline values={sourceValues} />
          </div>
        </Card>
      </dl>

      {groupsQuery.isLoading ? (
        <Skeleton className="mt-8 h-72" />
      ) : (
        <GroupedJobTable groups={groups} readOnly pageSize={6} />
      )}
    </main>
  )
}
