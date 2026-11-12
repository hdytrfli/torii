import { useEffect, useMemo, useState } from "react"
import { Search } from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "../lib/api"
import type { Group } from "../lib/types"
import { BulkBar } from "./bulk-bar"
import { GroupedJobTable } from "./tremor/job-table"
import { JobDrawer } from "./job-drawer"
import { EmptyState, Input, Skeleton } from "./ui"

const tabs: Array<{ key: string; label: string }> = [
  { key: "needs_review", label: "Needs review" },
  { key: "ready", label: "Ready" },
  { key: "moved", label: "Moved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
]

export function ReviewWorkspace({
  compact = false,
  initialStatus = "needs_review",
}: {
  compact?: boolean
  initialStatus?: string
}) {
  const [status, setStatus] = useState(initialStatus)
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [openJob, setOpenJob] = useState<number | null>(null)
  const queryClient = useQueryClient()

  const groupsQuery = useQuery({
    queryKey: ["groups", status],
    queryFn: () => api.groups(status),
  })

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["groups"] })
    void queryClient.invalidateQueries({ queryKey: ["jobs"] })
    void queryClient.invalidateQueries({ queryKey: ["stats"] })
  }

  const bulk = useMutation({
    mutationFn: ({ ids, action }: { ids: number[]; action: "approve" | "reject" }) =>
      api.bulk(ids, action),
    onSuccess: () => {
      setSelected(new Set())
      invalidate()
    },
  })

  useEffect(() => {
    setSelected(new Set())
  }, [status])

  const groups = useMemo(() => {
    const all = groupsQuery.data ?? []
    const needle = search.trim().toLowerCase()
    const filtered = needle
      ? all.filter(
          (group) =>
            group.label.toLowerCase().includes(needle) ||
            group.jobs.some((job) => (job.title ?? "").toLowerCase().includes(needle)),
        )
      : all
    return compact ? filtered.slice(0, 3) : filtered
  }, [groupsQuery.data, search, compact])

  const toggle = (id: number) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleGroup = (group: Group, checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current)
      for (const job of group.jobs) {
        if (checked) next.add(job.id)
        else next.delete(job.id)
      }
      return next
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {!compact ? (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1 rounded-control border border-line bg-surface p-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStatus(tab.key)}
                className={
                  status === tab.key
                    ? "rounded-[8px] bg-brand px-2.5 py-1.5 text-[11.5px] font-medium text-brand-ink"
                    : "rounded-[8px] px-2.5 py-1.5 text-[11.5px] text-ink-muted hover:bg-surface-muted hover:text-ink"
                }
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="relative ml-auto w-full max-w-xs">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Filter shows, collections, movies…"
              className="pl-8"
            />
          </div>
        </div>
      ) : null}

      {groupsQuery.isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : groups.length === 0 ? (
        <EmptyState
          title={status === "needs_review" ? "Nothing to review" : "No jobs here"}
          description={
            status === "needs_review"
              ? "Drop files into temp/downloads/movies or temp/downloads/shows, then run a scan."
              : "Change the filter or run a scan to pick up new files."
          }
        />
      ) : (
        <GroupedJobTable
          groups={groups}
          selected={selected}
          onToggle={toggle}
          onToggleGroup={toggleGroup}
          onOpen={(job) => setOpenJob(job.id)}
        />
      )}

      <BulkBar
        count={selected.size}
        onClear={() => setSelected(new Set())}
        onApprove={() => bulk.mutate({ ids: [...selected], action: "approve" })}
        onReject={() => bulk.mutate({ ids: [...selected], action: "reject" })}
        busy={bulk.isPending}
      />

      {openJob != null ? <JobDrawer jobId={openJob} onClose={() => setOpenJob(null)} /> : null}
    </div>
  )
}
