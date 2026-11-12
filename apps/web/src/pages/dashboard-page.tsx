import { useMemo, useState } from "react"
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
  const scan = useMutation({
    mutationFn: api.scan,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["groups"] })
      void queryClient.invalidateQueries({ queryKey: ["stats"] })
    },
  })

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
    { title: "Ready", percentage: total ? (ready / total) * 100 : 0, current: ready, allowed: total },
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
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date()
      date.setDate(date.getDate() - (6 - index))
      return date.toISOString().slice(0, 10)
    })
    return days.map((date) => ({
      date: date.slice(5),
      Matched: filteredJobs.filter((job) => (job.updated_at ?? "").startsWith(date) && job.source !== "guessit").length,
      Review: filteredJobs.filter((job) => (job.updated_at ?? "").startsWith(date) && job.source === "guessit").length,
    }))
  }, [filteredJobs])

  const sourceTrend = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date()
      date.setDate(date.getDate() - (6 - index))
      return date.toISOString().slice(0, 10)
    })
    return days.map((date) => ({
      date: date.slice(5),
      Jellyfin: filteredJobs.filter((job) => (job.updated_at ?? "").startsWith(date) && job.source === "jellyfin").length,
      Filename: filteredJobs.filter((job) => (job.updated_at ?? "").startsWith(date) && job.source === "guessit").length,
    }))
  }, [filteredJobs])

  const filteredGroups =
    sourceFilter === "all"
      ? groups
      : groups.filter((group) => group.jobs.some((job) => (job.source ?? "guessit") === sourceFilter))

  return (
    <main>
      <PageHeader
        eyebrow="Dashboard"
        title="Library overview."
        description="Monitor the queue, match quality, and where each rename decision came from."
      />
      <section aria-label="Current queue" className="mt-10">
        <div className="mt-4 grid grid-cols-1 gap-14 sm:mt-8 sm:grid-cols-2 lg:mt-10 xl:grid-cols-3">
          <div>
            <ProgressBarCard
              title="Queue health"
              change={review ? `${review} waiting` : "clear"}
              value={`${total}`}
              valueDescription="files in the current scan"
              ctaDescription="Files are grouped before review."
              ctaText="Open queue."
              data={statusData}
            />
          </div>
          <div>
            <ProgressBarCard
              title="Match quality"
              change={`${confidence}% strong`}
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
              change="last scan"
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
        <div className="mt-16 flex items-center justify-between">
          <h2 id="usage-overview" className="scroll-mt-8 text-lg font-semibold text-gray-900 sm:text-xl">
            Overview
          </h2>
          <Button variant="secondary" onClick={() => scan.mutate()} disabled={scan.isPending}>
            <RefreshCw size={15} className={scan.isPending ? "animate-spin" : ""} />
            Scan now
          </Button>
        </div>

        <div className="sticky top-16 z-20 flex items-center justify-between border-b border-gray-200 bg-white pb-4 pt-4 sm:pt-6 lg:top-0 lg:pt-8">
          <div className="flex items-center gap-2">
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
            <Link to="/queue">
              <Button variant="light">Review queue</Button>
            </Link>
          </div>
          <p className="hidden text-sm text-gray-500 sm:block">
            {filteredGroups.length} groups - {jobs.length} jobs
          </p>
        </div>

        <dl className="mt-10 grid grid-cols-1 gap-14 md:grid-cols-2 xl:grid-cols-3">
          <MediaChartCard
            title="Scan activity"
            value={`${filteredJobs.length}`}
            previous={`${review}`}
            change="7 days"
            data={trend}
            categories={["Matched", "Review"]}
          />
          <MediaChartCard
            title="Source split"
            value={`${sourceCounts.jellyfin ?? 0}`}
            previous={`${sourceCounts.guessit ?? 0}`}
            change="Jellyfin / filename"
            data={sourceTrend}
            categories={["Jellyfin", "Filename"]}
            colors={[...SOURCE_CHART_COLORS]}
          />
          <MediaChartCard
            title="Queue movement"
            value={`${moved}`}
            previous={`${ready}`}
            change="moved / ready"
            data={trend}
            categories={["Matched", "Review"]}
          />
        </dl>
      </section>
    </main>
  )
}
