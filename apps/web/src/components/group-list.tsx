import {
  Check,
  ChevronRight,
  Film,
  Folder,
  Sparkles,
  Tv,
  X,
} from "lucide-react"
import type { Group, Job } from "../lib/types"
import {
  basename,
  cn,
  episodeLabel,
  pct,
  sourceLabel,
  statusTone,
  totalCounts,
} from "../lib/format"
import { Badge, Button, Card, Checkbox, SourceBadge, StatusBadge } from "./ui"

export function GroupList({
  groups,
  selected,
  onToggle,
  onToggleGroup,
  onOpen,
  onApprove,
  onReject,
  busy,
}: {
  groups: Group[]
  selected: Set<number>
  onToggle: (id: number) => void
  onToggleGroup: (group: Group, checked: boolean) => void
  onOpen: (job: Job) => void
  onApprove: (job: Job) => void
  onReject: (job: Job) => void
  busy?: boolean
}) {
  return (
    <div className="flex flex-col gap-3">
      {groups.map((group) => {
        const ids = group.jobs.map((job) => job.id)
        const allSelected = ids.length > 0 && ids.every((id) => selected.has(id))
        const someSelected = ids.some((id) => selected.has(id))
        const Icon = group.type === "show" ? Tv : group.type === "collection" ? Folder : Film
        const reviewCount = group.counts.needs_review ?? 0

        return (
          <Card key={group.key} className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
              <Checkbox
                checked={allSelected}
                ref={(node) => {
                  if (node) node.indeterminate = someSelected && !allSelected
                }}
                onChange={(event) => onToggleGroup(group, event.target.checked)}
                aria-label={`Select ${group.label}`}
              />
              <span className="flex h-8 w-8 items-center justify-center rounded-control bg-surface-muted text-ink-muted">
                <Icon size={15} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-ink">{group.label}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-ink-muted">
                  <span className="capitalize">{group.type}</span>
                  <span>·</span>
                  <span>{totalCounts(group.counts)} item{totalCounts(group.counts) === 1 ? "" : "s"}</span>
                  {reviewCount > 0 ? (
                    <>
                      <span>·</span>
                      <span>{reviewCount} to review</span>
                    </>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <SourceBadge source={group.source} />
                <Badge tone={group.confidence >= 0.85 ? "success" : "warning"}>
                  {pct(group.confidence)}
                </Badge>
              </div>
            </div>

            <div className="divide-y divide-line">
              {group.jobs.map((job) => {
                const episode = episodeLabel(job)
                const checked = selected.has(job.id)
                return (
                  <div
                    key={job.id}
                    className={cn(
                      "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-muted/60",
                      checked && "bg-warning-soft/30",
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onChange={() => onToggle(job.id)}
                      aria-label={`Select ${job.title}`}
                    />
                    <button
                      type="button"
                      onClick={() => onOpen(job)}
                      className="min-w-0 text-left"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-[13px] font-medium text-ink">
                          {job.title || basename(job.source_path)}
                        </span>
                        {job.year ? (
                          <span className="text-[11px] text-ink-muted">({job.year})</span>
                        ) : null}
                        {episode ? (
                          <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-medium text-ink-muted">
                            {episode}
                          </span>
                        ) : null}
                        <SourceBadge source={job.source} />
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-ink-muted">
                        <span className="truncate font-mono text-[10.5px]">
                          {basename(job.source_path)}
                        </span>
                        {job.target_path ? (
                          <>
                            <ChevronRight size={11} />
                            <span className="truncate">{job.target_path}</span>
                          </>
                        ) : null}
                      </div>
                    </button>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "hidden rounded-full px-2 py-0.5 text-[10.5px] font-medium capitalize sm:inline-flex",
                          statusTone(job.status),
                        )}
                      >
                        {job.status.replaceAll("_", " ")}
                      </span>
                      <span className="w-9 text-right text-[10.5px] text-ink-muted">
                        {pct(job.confidence)}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Open ${job.title}`}
                        onClick={() => onOpen(job)}
                      >
                        <ChevronRight size={14} />
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={busy}
                        onClick={() => onApprove(job)}
                        className="hidden sm:inline-flex"
                      >
                        <Check size={13} /> Approve
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => onReject(job)}
                        className="hidden sm:inline-flex"
                        aria-label="Reject"
                      >
                        <X size={13} />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        )
      })}
    </div>
  )
}

export function BulkBar({
  count,
  onClear,
  onApprove,
  onReject,
  busy,
}: {
  count: number
  onClear: () => void
  onApprove: () => void
  onReject: () => void
  busy?: boolean
}) {
  if (count === 0) return null
  return (
    <div className="sticky bottom-4 z-10 mx-auto flex w-fit items-center gap-2 rounded-full border border-line bg-surface px-3 py-2 shadow-card">
      <span className="pl-1 text-xs font-medium text-ink">{count} selected</span>
      <Button variant="ghost" size="sm" onClick={onClear}>
        Clear
      </Button>
      <Button variant="secondary" size="sm" onClick={onReject} disabled={busy}>
        <X size={13} /> Reject
      </Button>
      <Button size="sm" onClick={onApprove} disabled={busy}>
        <Check size={13} /> Approve
      </Button>
    </div>
  )
}

export function SourceSummary({ groups }: { groups: Group[] }) {
  const counts: Record<string, number> = {}
  for (const group of groups) {
    for (const job of group.jobs) {
      const label = sourceLabel(job.source)
      counts[label] = (counts[label] ?? 0) + 1
    }
  }
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-ink-muted">
        <Sparkles size={13} /> Match sources
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .map(([label, value]) => (
            <div key={label} className="flex items-center justify-between text-xs">
              <span className="text-ink-muted">{label}</span>
              <span className="font-medium text-ink">{value}</span>
            </div>
          ))}
        {Object.keys(counts).length === 0 ? (
          <div className="text-xs text-ink-muted">No jobs yet.</div>
        ) : null}
      </div>
    </Card>
  )
}

export { StatusBadge }
