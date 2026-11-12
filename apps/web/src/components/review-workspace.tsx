import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "../lib/api"
import { MediaDataTable } from "./tremor/media-data-table"
import { JobDrawer } from "./job-drawer"
import { EmptyState, Skeleton } from "./ui"

export function ReviewWorkspace({
  initialStatus = "needs_review",
}: {
  initialStatus?: string
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [openJob, setOpenJob] = useState<number | null>(null)
  const queryClient = useQueryClient()

  const groupsQuery = useQuery({
    queryKey: ["groups", "all"],
    queryFn: () => api.groups("all"),
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
  }, [initialStatus])

  const jobs = useMemo(
    () => (groupsQuery.data ?? []).flatMap((group) => group.jobs),
    [groupsQuery.data],
  )

  return (
    <div className="flex flex-col gap-4">
      {groupsQuery.isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : jobs.length === 0 ? (
        <EmptyState
          title="Nothing to review"
          description="Drop files into temp/downloads/movies or temp/downloads/shows, then run a scan."
        />
      ) : (
        <MediaDataTable
          jobs={jobs}
          selected={selected}
          onSelectionChange={setSelected}
          onOpen={(job) => setOpenJob(job.id)}
          onApprove={(ids) => bulk.mutate({ ids, action: "approve" })}
          onReject={(ids) => bulk.mutate({ ids, action: "reject" })}
          onUndo={(ids) => bulk.mutate({ ids, action: "undo" })}
          busy={bulk.isPending}
          defaultStatus={initialStatus}
        />
      )}

      {openJob != null ? <JobDrawer jobId={openJob} onClose={() => setOpenJob(null)} /> : null}
    </div>
  )
}
