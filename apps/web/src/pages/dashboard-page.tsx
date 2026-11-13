import { useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { RefreshCw } from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "../lib/api"
import { SOURCE_CHART_COLORS, SOURCE_META } from "../lib/constants"
import { Button } from "../components/ui"
import { DropdownSelect } from "../components/tremor/dropdown-select"
import { PageHeader } from "../components/page-header"
import { CategoryBarCard, ProgressBarCard } from "../components/tremor/dashboard-cards"
import { MediaChartCard } from "../components/tremor/media-chart-card"

export function DashboardPage() {
  const stats = useQuery({ queryKey: ["stats"], queryFn: api.stats })
  const groupsQuery = useQuery({ queryKey: ["groups", "all"], queryFn: () => api.groups("all") })
  const queryClient = useQueryClient()
  const [sourceFilter, setSourceFilter] = useState("all")
  const [rangeFilter, setRangeFilter] = useState("7d")
  const [scanAnimating, setScanAnimating] = useState(false)
  const scanTimer = useRef<number | null>(null)
  useEffect(() => {
    return () => {
      if (scanTimer.current !== null) window.clearTimeout(scanTimer.current)
    }
  }, [])
  const scan = useMutation({
    mutationFn: api.scan,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["groups"] })
      void queryClient.invalidateQueries({ queryKey: ["stats"] })
    },
  })

  const runScan = async () => {
    if (scanAnimating) return
    setScanAnimating(true)
    const started = performance.now()
    try {
      await scan.mutateAsync()
    } finally {
      const remaining = Math.max(0, 650 - (performance.now() - started))
      if (scanTimer.current !== null) window.clearTimeout(scanTimer.current)
      if (remaining === 0) {
        setScanAnimating(false)
      } else {
        scanTimer.current = window.setTimeout(() => {
          scanTimer.current = null
          setScanAnimating(false)
        }, remaining)
      }
    }
  }

  const groups = groupsQuery.data ?? []
  const jobs = groups.flatMap((group) => group.jobs)
  const filteredJobs = useMemo(
    () =>
      sourceFilter === "all"
        ? jobs
        : jobs.filter((job) => (job.source ?? "guessit") === sourceFilter),
    [jobs, sourceFilter],
  )
  const total = jobs.length
  const review = stats.data?.needs_review ?? 0
  const ready = stats.data?.ready ?? 0
  const moved = stats.data?.moved ?? 0
  const confidence = total
    ? Math.round((jobs.filter((job) => job.confidence >= 0.85).length / total) * 100)
    : 0

  const sourceCounts = jobs.reduce<Record<string, number>>((counts, job) => {
    const key = job.source ?? "guessit"
    counts[key] = (counts[key] ?? 0) + 1
    return counts
  }, {})

  const statusData = [
    { title: "Needs review", percentage: total ? (review / total) * 100 : 0, current: review, allowed: total },
    { title: "Ready to apply", percentage: total ? (ready / total) * 100 : 0, current: ready, allowed: total },
    { title: "Moved / linked", percentage: total ? (moved / total) * 100 : 0, current: moved, allowed: total },
  ]

  const qualityData = [
    {
      title: "85% and above",
      percentage: confidence,
      current: jobs.filter((job) => job.confidence >= 0.85).length,
      allowed: total,
    },
    {
      title: "60–84%",
      percentage: total
        ? (jobs.filter((job) => job.confidence >= 0.6 && job.confidence < 0.85).length / total) * 100
        : 0,
      current: jobs.filter((job) => job.confidence >= 0.6 && job.confidence < 0.85).length,
      allowed: total,
    },
    {
      title: "Below 60%",
      percentage: total ? (jobs.filter((job) => job.confidence < 0.6).length / total) * 100 : 0,
      current: jobs.filter((job) => job.confidence < 0.6).length,
      allowed: total,
    },
  ]

  const sourceData = (Object.entries(SOURCE_META) as Array<
    [keyof typeof SOURCE_META, (typeof SOURCE_META)[keyof typeof SOURCE_META]]
  >).map(([key, meta]) => {
    const count = sourceCounts[key] ?? 0
    return {
      title: meta.label,
      percentage: total ? (count / total) * 100 : 0,
      value: String(count),
      color: meta.bar,
    }
  })

  const trend = useMemo(() => {
    const days = rangeFilter === "90d" ? 90 : rangeFilter === "30d" ? 30 : 7
    const dates = Array.from({ length: days }, (_, index) => {
      const date = new Date()
      date.setDate(date.getDate() - (days - 1 - index))
      return date.toISOString().slice(0, 10)
    })
    return dates.map((date) => ({
      date: date.slice(5),
      Matched: filteredJobs.filter((job) => (job.updated_at ?? "").startsWith(date) && job.source !== "guessit").length,
      Review: filteredJobs.filter((job) => (job.updated_at ?? "").startsWith(date) && job.source === "guessit").length,
    }))
  }, [filteredJobs, rangeFilter])

  const sourceTrend = useMemo(() => {
    const days = rangeFilter === "90d" ? 90 : rangeFilter === "30d" ? 30 : 7
    const dates = Array.from({ length: days }, (_, index) => {
      const date = new Date()
      date.setDate(date.getDate() - (days - 1 - index))
      return date.toISOString().slice(0, 10)
    })
    return dates.map((date) => ({
      date: date.slice(5),
      Jellyfin: filteredJobs.filter((job) => (job.updated_at ?? "").startsWith(date) && job.source === "jellyfin").length,
      Filename: filteredJobs.filter((job) => (job.updated_at ?? "").startsWith(date) && job.source === "guessit").length,
    }))
  }, [filteredJobs, rangeFilter])

  return (
    <main>
      <PageHeader
        eyebrow="Dashboard"
        title="Library overview."
        description="Monitor reviews, match quality, and where each rename decision came from."
      />
      <section aria-label="Current pipeline" className="mt-10">
        <div className="mt-4 grid grid-cols-1 gap-14 sm:mt-8 sm:grid-cols-2 lg:mt-10 xl:grid-cols-3">
          <div>
            <ProgressBarCard
              title="Review health"
              value={`${total}`}
              valueDescription="files in the current scan"
              ctaDescription="Files are grouped before review."
              ctaText="Open review table."
              data={statusData}
            />
          </div>
          <div>
            <ProgressBarCard
              title="Match quality"
              value={`${confidence}%`}
              valueDescription="at or above 85% confidence"
              ctaDescription="Jellyfin and NFO are preferred."
              ctaText="Review weak matches."
              data={qualityData}
            />
          </div>
          <div>
            <CategoryBarCard
              title="Match sources"
              value={`${total}`}
              valueDescription="matched jobs"
              subtitle="Where the metadata came from"
              ctaDescription="AI runs only when there are no candidates."
              ctaText="Ask AI manually."
              data={sourceData}
            />
          </div>
        </div>
      </section>

      <section aria-labelledby="usage-overview">
        <div className="mt-16">
          <div className="text-xs font-medium text-ink-muted">Overview</div>
          <h2
            id="usage-overview"
            className="mt-1 scroll-mt-8 text-lg font-semibold text-ink sm:text-xl"
          >
            Activity at a glance.
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            Compare scan activity, source mix, and apply progress across the selected range.
          </p>
        </div>

        <div className="sticky top-16 z-20 flex items-center justify-between bg-canvas pb-4 pt-4 sm:pt-6 lg:top-0 lg:pt-8">
          <div className="flex flex-wrap items-center gap-2">
            <DropdownSelect
              value={sourceFilter}
              onChange={setSourceFilter}
              className="w-44"
              options={[
                { value: "all", label: "All sources" },
                { value: "jellyfin", label: "Jellyfin" },
                { value: "guessit", label: "Filename" },
                { value: "nfo", label: "Local NFO" },
                { value: "llm", label: "AI fallback" },
              ]}
            />
            <DropdownSelect
              value={rangeFilter}
              onChange={setRangeFilter}
              className="w-32"
              options={[
                { value: "7d", label: "Last 7 days" },
                { value: "30d", label: "Last 30 days" },
                { value: "90d", label: "Last 90 days" },
              ]}
            />
            <Button asChild variant="primary">
              <Link to="/review">Review table</Link>
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <p className="hidden text-sm text-ink-muted sm:block">
              {filteredJobs.length} job{filteredJobs.length === 1 ? "" : "s"}
            </p>
            <Button
              variant="secondary"
              onClick={() => void runScan()}
              disabled={scanAnimating}
              className="disabled:bg-surface disabled:text-ink"
            >
              <RefreshCw size={15} className={scanAnimating ? "animate-spin" : ""} />
              Scan now
            </Button>
          </div>
        </div>

        <dl className="mt-10 grid grid-cols-1 gap-14 md:grid-cols-2 xl:grid-cols-3">
          <MediaChartCard
            title="Scan activity"
            value={`${filteredJobs.length}`}
            previous={`${review}`}
            data={trend}
            categories={["Matched", "Review"]}
          />
          <MediaChartCard
            title="Source split"
            value={`${sourceCounts.jellyfin ?? 0}`}
            previous={`${sourceCounts.guessit ?? 0}`}
            data={sourceTrend}
            categories={["Jellyfin", "Filename"]}
            colors={[...SOURCE_CHART_COLORS]}
          />
          <MediaChartCard
            title="Apply progress"
            value={`${moved}`}
            previous={`${ready}`}
            data={trend}
            categories={["Matched", "Review"]}
          />
        </dl>
      </section>
    </main>
  )
}
