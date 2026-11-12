import { useEffect, useMemo, useState } from "react"
import { RiArrowDownSLine, RiArrowRightSLine } from "@remixicon/react"
import type { Group, Job } from "../../lib/types"
import { basename, episodeLabel, pct } from "../../lib/format"
import { Button, Checkbox, SourceBadge, StatusBadge } from "../ui"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "./table"
import { TablePagination } from "./table-pagination"

export function GroupedJobTable({
  groups,
  selected,
  onToggle,
  onToggleGroup,
  onOpen,
  onApprove,
  onApproveGroup,
  onReject,
  busy,
  readOnly = false,
  pageSize = 8,
}: {
  groups: Group[]
  selected?: Set<number>
  onToggle?: (id: number) => void
  onToggleGroup?: (group: Group, checked: boolean) => void
  onOpen?: (job: Job) => void
  onApprove?: (job: Job) => void
  onApproveGroup?: (group: Group) => void
  onReject?: (job: Job) => void
  busy?: boolean
  readOnly?: boolean
  pageSize?: number
}) {
  const [page, setPage] = useState(0)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const pages = Math.max(1, Math.ceil(groups.length / pageSize))
  const visible = useMemo(
    () => groups.slice(page * pageSize, (page + 1) * pageSize),
    [groups, page, pageSize],
  )

  useEffect(() => {
    setPage(0)
  }, [groups.length])

  const toggleExpanded = (key: string) => {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="mt-8 space-y-3">
      <div className="relative overflow-hidden overflow-x-auto">
        <Table>
          <TableHead>
            <TableRow>
              {!readOnly ? <TableHeaderCell className="w-8 px-2" /> : null}
              <TableHeaderCell>Group / File</TableHeaderCell>
              <TableHeaderCell>Type</TableHeaderCell>
              <TableHeaderCell>Source</TableHeaderCell>
              <TableHeaderCell>Match</TableHeaderCell>
              <TableHeaderCell>Target</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              {!readOnly ? <TableHeaderCell className="text-right">Actions</TableHeaderCell> : null}
            </TableRow>
          </TableHead>
          <TableBody>
            {visible.map((group) => {
              const isOpen = expanded.has(group.key)
              const ids = group.jobs.map((job) => job.id)
              const allSelected = selected ? ids.every((id) => selected.has(id)) : false
              const someSelected = selected ? ids.some((id) => selected.has(id)) : false
              const reviewCount = group.counts.needs_review ?? 0

              return (
                <GroupRows
                  key={group.key}
                  group={group}
                  isOpen={isOpen}
                  onToggleExpanded={() => toggleExpanded(group.key)}
                  selected={selected}
                  allSelected={allSelected}
                  someSelected={someSelected}
                  onToggle={onToggle}
                  onToggleGroup={onToggleGroup}
                  onOpen={onOpen}
                  onApprove={onApprove}
                  onApproveGroup={onApproveGroup}
                  onReject={onReject}
                  busy={busy}
                  readOnly={readOnly}
                  reviewCount={reviewCount}
                />
              )
            })}
          </TableBody>
        </Table>
      </div>
      <TablePagination
        page={page}
        pages={pages}
        total={groups.length}
        pageSize={pageSize}
        onPage={setPage}
      />
    </div>
  )
}

function GroupRows({
  group,
  isOpen,
  onToggleExpanded,
  selected,
  allSelected,
  someSelected,
  onToggle,
  onToggleGroup,
  onOpen,
  onApprove,
  onApproveGroup,
  onReject,
  busy,
  readOnly,
  reviewCount,
}: {
  group: Group
  isOpen: boolean
  onToggleExpanded: () => void
  selected?: Set<number>
  allSelected: boolean
  someSelected: boolean
  onToggle?: (id: number) => void
  onToggleGroup?: (group: Group, checked: boolean) => void
  onOpen?: (job: Job) => void
  onApprove?: (job: Job) => void
  onApproveGroup?: (group: Group) => void
  onReject?: (job: Job) => void
  busy?: boolean
  readOnly?: boolean
  reviewCount: number
}) {
  const firstTarget = group.jobs.find((job) => job.target_path)?.target_path

  return (
    <>
      <TableRow className="bg-gray-50/70 font-medium">
        {!readOnly ? (
          <TableCell className="w-8 px-2">
            <Checkbox
              checked={allSelected}
              ref={(node) => {
                if (node) node.indeterminate = someSelected && !allSelected
              }}
              onChange={(event) => onToggleGroup?.(group, event.target.checked)}
              aria-label={`Select ${group.label}`}
            />
          </TableCell>
        ) : null}
        <TableCell className="text-gray-900">
          <button
            type="button"
            onClick={onToggleExpanded}
            className="flex items-center gap-2 text-left"
          >
            {isOpen ? (
              <RiArrowDownSLine className="size-4 shrink-0 text-gray-500" />
            ) : (
              <RiArrowRightSLine className="size-4 shrink-0 text-gray-500" />
            )}
            <span>{group.label}</span>
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-normal text-gray-500 ring-1 ring-inset ring-gray-200">
              {group.total}
            </span>
          </button>
        </TableCell>
        <TableCell className="capitalize">{group.type}</TableCell>
        <TableCell><SourceBadge source={group.source} /></TableCell>
        <TableCell>{pct(group.confidence)}</TableCell>
        <TableCell className="max-w-[300px] truncate font-mono text-[11px] text-gray-500">
          {firstTarget ?? "—"}
        </TableCell>
        <TableCell>
          {reviewCount > 0 ? (
            <span className="text-xs text-gray-500">{reviewCount} to review</span>
          ) : (
            <span className="text-xs text-gray-400">clear</span>
          )}
        </TableCell>
        {!readOnly ? (
          <TableCell className="text-right">
            <div className="flex justify-end gap-1">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => group.jobs[0] && onOpen?.(group.jobs[0])}
              >
                Review
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => (onApproveGroup ? onApproveGroup(group) : group.jobs.forEach((job) => onApprove?.(job)))}
              >
                Approve
              </Button>
            </div>
          </TableCell>
        ) : null}
      </TableRow>

      {isOpen
        ? group.jobs.map((job) => {
            const episode = episodeLabel(job)
            return (
              <TableRow key={job.id} className="odd:bg-gray-50/40">
                {!readOnly ? (
                  <TableCell className="w-8 px-2">
                    <Checkbox
                      checked={selected?.has(job.id) ?? false}
                      onChange={() => onToggle?.(job.id)}
                      aria-label={`Select ${job.title}`}
                    />
                  </TableCell>
                ) : null}
                <TableCell className="max-w-[300px] truncate font-medium text-gray-900">
                  <button className="truncate text-left hover:underline" onClick={() => onOpen?.(job)}>
                    {job.title || basename(job.source_path)}
                    {job.year ? <span className="ml-1 font-normal text-gray-500">({job.year})</span> : null}
                    {episode ? <span className="ml-2 text-[10px] font-normal text-gray-400">{episode}</span> : null}
                  </button>
                </TableCell>
                <TableCell className="capitalize">{job.media_type ?? "movie"}</TableCell>
                <TableCell><SourceBadge source={job.source} /></TableCell>
                <TableCell>{pct(job.confidence)}</TableCell>
                <TableCell className="max-w-[300px] truncate font-mono text-[11px] text-gray-500">
                  {job.target_path ?? "—"}
                </TableCell>
                <TableCell><StatusBadge status={job.status} /></TableCell>
                {!readOnly ? (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => onOpen?.(job)}>
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" disabled={busy} onClick={() => onApprove?.(job)}>
                        Approve
                      </Button>
                      <Button variant="ghost" size="sm" disabled={busy} onClick={() => onReject?.(job)}>
                        Reject
                      </Button>
                    </div>
                  </TableCell>
                ) : null}
              </TableRow>
            )
          })
        : null}
    </>
  )
}
