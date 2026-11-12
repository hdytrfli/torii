import { PageHeader } from "../components/page-header"
import { ReviewWorkspace } from "../components/review-workspace"

export function QueuePage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Queue"
        title="Review by group, act in bulk."
        description="Shows are grouped across seasons. Movie folders become collections. Select a group or individual files, then approve or reject once."
      />
      <ReviewWorkspace />
    </div>
  )
}
