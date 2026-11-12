import { useEffect, useMemo, useState } from "react"
import { RiArrowDownSLine, RiArrowRightSLine } from "@remixicon/react"
import type { Group, Job } from "../../lib/types"
import { episodeLabel, pct } from "../../lib/format"
import { Checkbox, SourceBadge, StatusBadge } from "../ui"
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
  readOnly = false,
  pageSize = 10,
}: {
  groups: Group[]
  selected?: Set<number>
  onToggle?: (id: number) => void
  onToggleGroup?: (group: Group, checked: boolean) => void
  onOpen?: (job: Job) => void
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

  useEffect(() => setPage(0), [groups.length])

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
              {!readOnly ? <TableHeaderCell className="w-8" /> : null}
              <TableHeaderCell>Group / File</TableHeaderCell>
              <TableHeaderCell>Type</TableHeaderCell>
              <TableHeaderCell>Source</TableHeaderCell>
              <TableHeaderCell>Match</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
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
                  reviewCount={reviewCount}
                  readOnly={readOnly}
                />
              )
            })}
          </TableBody>
        </Table>
      </div>
      <TablePagination page={page} pages={pages} total={groups.length} pageSize={pageSize} onPage={setPage} />
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
  reviewCount,
  readOnly,
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
  reviewCount: number
  readOnly: boolean
}) {
  return (
    <>
      <TableRow className="bg-gray-50/70">
        {!readOnly ? (
          <TableCell>
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
        <TableCell className="font-medium text-gray-900">
          <button type="button" onClick={onToggleExpanded} className="flex items-center gap-2 text-left">
            {isOpen ? (
              <RiArrowDownSLine className="size-4 shrink-0 text-gray-500" />
            ) : (
              <RiArrowRightSLine className="size-4 shrink-0 text-gray-500" />
            )}
            <span>{group.label}</span>
            <span className="text-[10px] font-normal text-gray-400">{group.total}</span>
          </button>
        </TableCell>
        <TableCell className="capitalize">{group.type}</TableCell>
        <TableCell><SourceBadge source={group.source} /></TableCell>
        <TableCell>{pct(group.confidence)}</TableCell>
        <TableCell className="text-xs text-gray-500">
          {reviewCount > 0 ? `${reviewCount} to review` : "clear"}
        </TableCell>
      </TableRow>

      {isOpen
        ? group.jobs.map((job) => (
            <TableRow
              key={job.id}
              className="cursor-pointer hover:bg-gray-50"
              onClick={() => onOpen?.(job)}
            >
              {!readOnly ? (
                <TableCell onClick={(event) => event.stopPropagation()}>
                  <Checkbox
                    checked={selected?.has(job.id) ?? false}
                    onChange={() => onToggle?.(job.id)}
                    aria-label={`Select ${job.title}`}
                  />
                </TableCell>
              ) : null}
              <TableCell className="max-w-[360px] truncate text-gray-900">
                {job.title}
                {job.year ? <span className="ml-1 font-normal text-gray-400">({job.year})</span> : null}
                {episodeLabel(job) ? (
                  <span className="ml-2 text-[10px] text-gray-400">{episodeLabel(job)}</span>
                ) : null}
              </TableCell>
              <TableCell className="capitalize">{job.media_type ?? "movie"}</TableCell>
              <TableCell><SourceBadge source={job.source} /></TableCell>
              <TableCell>{pct(job.confidence)}</TableCell>
              <TableCell><StatusBadge status={job.status} /></TableCell>
            </TableRow>
          ))
        : null}
    </>
  )
}
