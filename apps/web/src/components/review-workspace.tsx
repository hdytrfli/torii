import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "../lib/api"
import type { Group } from "../lib/types"
import { BulkBar } from "./bulk-bar"
import { MediaDataTable } from "./tremor/media-data-table"
import { JobDrawer } from "./job-drawer"
import { EmptyState, Skeleton } from "./ui"
import { TabNavigation, TabNavigationLink } from "./tremor/tab-navigation"

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
    mutationFn: ({ ids, action }: { ids: number[]; action: "approve" | "reject" | "undo" }) =>
      api.bulk(ids, action),
    onSuccess: () => {
      setSelected(new Set())
      invalidate()
    },
  })

  useEffect(() => {
    setSelected(new Set())
  }, [status])

  const groups = groupsQuery.data ?? []

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
          <TabNavigation className="flex-1">
            {tabs.map((tab) => (
              <TabNavigationLink
                key={tab.key}
                active={status === tab.key}
                asChild
              >
                <button type="button" onClick={() => setStatus(tab.key)}>
                  {tab.label}
                </button>
              </TabNavigationLink>
            ))}
          </TabNavigation>
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
        <MediaDataTable
          groups={groups}
          selected={selected}
          onToggle={toggle}
          onToggleGroup={toggleGroup}
          onOpen={(job) => setOpenJob(job.id)}
        />
      )}

      {(() => {
        const selectedJobs = groups
          .flatMap((group) => group.jobs)
          .filter((job) => selected.has(job.id))
        const reviewable = selectedJobs.every(
          (job) => job.status === "needs_review" || job.status === "ready",
        )
        const movable = selectedJobs.every((job) => job.status === "moved")
        return (
          <BulkBar
            count={selected.size}
            onClear={() => setSelected(new Set())}
            onApprove={() => bulk.mutate({ ids: [...selected], action: "approve" })}
            onReject={() => bulk.mutate({ ids: [...selected], action: "reject" })}
            onUndo={() => bulk.mutate({ ids: [...selected], action: "undo" })}
            showReview={selectedJobs.length > 0 && reviewable}
            showUndo={selectedJobs.length > 0 && movable}
            busy={bulk.isPending}
          />
        )
      })()}

      {openJob != null ? <JobDrawer jobId={openJob} onClose={() => setOpenJob(null)} /> : null}
    </div>
  )
}
