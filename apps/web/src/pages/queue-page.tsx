import { PageHeader } from "../components/page-header"
import { ReviewWorkspace } from "../components/review-workspace"

export function QueuePage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Queue"
        title="Review files, act in bulk."
        description="Select individual files, then approve or reject once. Use the file name or row menu to edit details, match metadata, or undo an applied job."
      />
      <ReviewWorkspace />
    </div>
  )
}
