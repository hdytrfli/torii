import {
  CommandBar,
  CommandBarBar,
  CommandBarCommand,
  CommandBarSeperator,
  CommandBarValue,
} from "./tremor/command-bar"

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
  return (
    <CommandBar open={count > 0}>
      <CommandBarBar>
        <CommandBarValue>{count} selected</CommandBarValue>
        <CommandBarSeperator />
        {showReview ? (
          <>
            <CommandBarCommand
              label="Reject"
              action={onReject}
              shortcut={{ shortcut: "r" }}
              disabled={busy}
            />
            <CommandBarSeperator />
            <CommandBarCommand
              label="Approve"
              action={onApprove}
              shortcut={{ shortcut: "a" }}
              disabled={busy}
            />
            <CommandBarSeperator />
          </>
        ) : null}
        {showUndo ? (
          <>
            <CommandBarCommand
              label="Undo"
              action={onUndo}
              shortcut={{ shortcut: "u" }}
              disabled={busy}
            />
            <CommandBarSeperator />
          </>
        ) : null}
        <CommandBarCommand
          label="Reset"
          action={onClear}
          shortcut={{ shortcut: "Escape", label: "esc" }}
        />
      </CommandBarBar>
    </CommandBar>
  )
}
