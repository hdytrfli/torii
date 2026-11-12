import { Check, Undo2, X } from "lucide-react"
import { Button } from "./ui"

export function BulkBar({
  count,
  onClear,
  onApprove,
  onReject,
  onUndo,
  showReview,
  showUndo,
  busy,
}: {
  count: number
  onClear: () => void
  onApprove: () => void
  onReject: () => void
  onUndo: () => void
  showReview: boolean
  showUndo: boolean
  busy?: boolean
}) {
  if (count === 0) return null
  return (
    <div className="sticky bottom-4 z-10 mx-auto flex w-fit items-center gap-2 rounded-full border border-line bg-surface px-3 py-2 shadow-card">
      <span className="pl-1 text-xs font-medium text-ink">{count} selected</span>
      <Button variant="ghost" size="sm" onClick={onClear}>
        Clear
      </Button>
      {showReview ? (
        <>
          <Button variant="secondary" size="sm" onClick={onReject} disabled={busy}>
            <X size={13} /> Reject
          </Button>
          <Button size="sm" onClick={onApprove} disabled={busy}>
            <Check size={13} /> Approve
          </Button>
        </>
      ) : null}
      {showUndo ? (
        <Button variant="secondary" size="sm" onClick={onUndo} disabled={busy}>
          <Undo2 size={13} /> Undo
        </Button>
      ) : null}
    </div>
  )
}
