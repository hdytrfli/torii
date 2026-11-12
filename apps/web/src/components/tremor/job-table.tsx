import { useEffect, useMemo, useState } from "react"
import type { Group, Job } from "../../lib/types"
import { jobMeta, pct } from "../../lib/format"
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
        <Table className="table-fixed">
          <TableHead>
            <TableRow>
              {!readOnly ? <TableHeaderCell className="w-10" /> : null}
              <TableHeaderCell className="w-[46%]">Group / File</TableHeaderCell>
              <TableHeaderCell className="w-24">Type</TableHeaderCell>
              <TableHeaderCell className="w-36">Source</TableHeaderCell>
              <TableHeaderCell className="w-20">Match</TableHeaderCell>
              <TableHeaderCell className="w-32">Status</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visible.map((group) => {
              const isOpen = expanded.has(group.key)
              const ids = group.jobs.map((job) => job.id)
              const allSelected = selected ? ids.every((id) => selected.has(id)) : false
              const someSelected = selected ? ids.some((id) => selected.has(id)) : false
              const reviewCount = group.counts.needs_review ?? 0

              if (group.total === 1) {
                return (
                  <SingleJobRow
                    key={group.key}
                    job={group.jobs[0]}
                    selected={selected}
                    onToggle={onToggle}
                    onOpen={onOpen}
                    readOnly={readOnly}
                  />
                )
              }

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

function SingleJobRow({
  job,
  selected,
  onToggle,
  onOpen,
  readOnly,
}: {
  job: Job
  selected?: Set<number>
  onToggle?: (id: number) => void
  onOpen?: (job: Job) => void
  readOnly: boolean
}) {
  return (
    <TableRow
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
        <span className="ml-1.5 text-xs font-normal text-gray-400">{jobMeta(job)}</span>
      </TableCell>
      <TableCell className="capitalize">{job.media_type ?? "movie"}</TableCell>
      <TableCell><SourceBadge source={job.source} /></TableCell>
      <TableCell>{pct(job.confidence)}</TableCell>
      <TableCell><StatusBadge status={job.status} /></TableCell>
    </TableRow>
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
      <TableRow
        className="cursor-pointer bg-gray-50/70"
        onClick={onToggleExpanded}
        aria-expanded={isOpen}
        title={isOpen ? "Collapse group" : "Expand group"}
      >
        {!readOnly ? (
          <TableCell onClick={(event) => event.stopPropagation()}>
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
          <span>{group.label}</span>
          <span className="ml-1.5 text-xs font-normal text-gray-400">{group.total}</span>
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
                <span className="ml-1.5 text-xs font-normal text-gray-400">{jobMeta(job)}</span>
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
