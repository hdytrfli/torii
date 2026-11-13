import { useEffect, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "../lib/api"
import { MediaDataTable } from "./tremor/media-data-table"
import { JobDrawer } from "./job-drawer"

export function ReviewWorkspace({
  initialStatus = "needs_review",
}: {
  initialStatus?: string
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [openJob, setOpenJob] = useState<number | null>(null)
  const queryClient = useQueryClient()

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["review-jobs"] })
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
  const remove = useMutation({
    mutationFn: (id: number) => api.deleteJob(id),
    onSuccess: () => {
      setSelected(new Set())
      invalidate()
    },
  })

  useEffect(() => {
    setSelected(new Set())
  }, [initialStatus])

  return (
    <div className="flex flex-col gap-4">
      <MediaDataTable
        selected={selected}
        onSelectionChange={setSelected}
        onOpen={(job) => setOpenJob(job.id)}
        onApprove={(ids) => bulk.mutate({ ids, action: "approve" })}
        onReject={(ids) => bulk.mutate({ ids, action: "reject" })}
        onUndo={(ids) => bulk.mutate({ ids, action: "undo" })}
        onDeleteJob={async (job) => {
          await remove.mutateAsync(job.id)
        }}
        busy={bulk.isPending || remove.isPending}
        defaultStatus={initialStatus}
      />

      {openJob != null ? <JobDrawer jobId={openJob} onClose={() => setOpenJob(null)} /> : null}
    </div>
  )
}
