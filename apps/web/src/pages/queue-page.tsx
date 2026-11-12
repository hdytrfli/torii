import { ReviewWorkspace } from "../components/review-workspace"

export function QueuePage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-muted">
          Queue
        </div>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
          Review by group, act in bulk.
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">
          Shows are grouped across seasons. Movie folders become collections. Select a group or
          individual files, then approve or reject once.
        </p>
      </div>
      <ReviewWorkspace />
    </div>
  )
}
