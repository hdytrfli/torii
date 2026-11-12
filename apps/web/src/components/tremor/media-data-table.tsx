// @ts-nocheck
import { useMemo, useState } from "react"
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table"
import { Search } from "lucide-react"
import type { Group, Job } from "../../lib/types"
import { cn, jobMeta, pct } from "../../lib/format"
import { Checkbox, Input, SourceBadge, StatusBadge } from "../ui"
import { DropdownSelect } from "./dropdown-select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "./table"
import { TablePagination } from "./table-pagination"

type GroupRow = Group & { subRows: Job[] }

const SOURCE_OPTIONS = [
  { value: "all", label: "All sources" },
  { value: "jellyfin", label: "Jellyfin" },
  { value: "guessit", label: "Filename" },
  { value: "nfo", label: "Local NFO" },
  { value: "llm", label: "AI fallback" },
]

export function MediaDataTable({
  groups,
  selected,
  onToggle,
  onToggleGroup,
  onOpen,
  pageSize = 10,
}: {
  groups: Group[]
  selected?: Set<number>
  onToggle?: (id: number) => void
  onToggleGroup?: (group: Group, checked: boolean) => void
  onOpen?: (job: Job) => void
  pageSize?: number
}) {
  const [sourceFilter, setSourceFilter] = useState("all")
  const [globalFilter, setGlobalFilter] = useState("")
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize })

  const data = useMemo(
    () => groups.map((group) => ({ ...group, subRows: group.jobs })),
    [groups],
  )

  const columns = useMemo<ColumnDef<GroupRow>[]>(
    () => [
      {
        id: "select",
        header: () => null,
        cell: ({ row }) => {
          const isGroup = row.depth === 0
          const group = row.original
          const job = row.original as unknown as Job
          const checked = isGroup
            ? group.jobs.every((item) => selected?.has(item.id))
            : selected?.has(job.id)
          return (
            <Checkbox
              checked={checked ?? false}
              onCheckedChange={(value) => {
                if (isGroup) onToggleGroup?.(group, value === true)
                else onToggle?.(job.id)
              }}
              onClick={(event) => event.stopPropagation()}
              aria-label={isGroup ? `Select ${group.label}` : `Select ${job.title}`}
            />
          )
        },
        size: 32,
      },
      {
        id: "name",
        header: "Group / File",
        cell: ({ row }) => {
          if (row.depth === 0) {
            const group = row.original
            return (
              <button
                type="button"
                onClick={() => row.toggleExpanded()}
                className="text-left text-gray-900"
              >
                {group.label}
                <span className="ml-2 text-xs text-gray-400">{group.total}</span>
              </button>
            )
          }
          const job = row.original as unknown as Job
          return (
            <button type="button" onClick={() => onOpen?.(job)} className="truncate text-left text-gray-900">
              {job.title}
              <span className="ml-1.5 text-xs text-gray-400">{jobMeta(job)}</span>
            </button>
          )
        },
        size: 420,
      },
      {
        id: "type",
        header: "Type",
        cell: ({ row }) =>
          row.depth === 0 ? null : (
            <span className="capitalize">{(row.original as unknown as Job).media_type ?? "movie"}</span>
          ),
        size: 80,
      },
      {
        id: "source",
        header: "Source",
        cell: ({ row }) =>
          row.depth === 0 ? null : (
            <SourceBadge source={(row.original as unknown as Job).source} />
          ),
        size: 130,
      },
      {
        id: "confidence",
        header: "Match",
        cell: ({ row }) =>
          row.depth === 0 ? null : <span>{pct((row.original as unknown as Job).confidence)}</span>,
        size: 70,
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) =>
          row.depth === 0 ? null : <StatusBadge status={(row.original as unknown as Job).status} />,
        size: 120,
      },
    ],
    [onOpen, onToggle, onToggleGroup, selected],
  )

  const table = useReactTable({
    data,
    columns,
    state: {
      globalFilter,
      columnFilters: sourceFilter === "all" ? [] : [{ id: "source", value: sourceFilter }],
      pagination,
    },
    getRowId: (row) => String(row.key ?? `job-${(row as unknown as Job).id}`),
    getSubRows: (row) => row.subRows,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    globalFilterFn: (row, _id, value) => {
      const needle = String(value).toLowerCase()
      if (!needle) return true
      if (row.depth === 0) {
        return (
          row.original.label.toLowerCase().includes(needle) ||
          row.original.jobs.some((job) => (job.title ?? "").toLowerCase().includes(needle))
        )
      }
      return String((row.original as unknown as Job).title ?? "").toLowerCase().includes(needle)
    },
    filterFns: {
      source: (row, _id, value) => {
        if (value === "all") return true
        const source = row.depth === 0 ? row.original.source : (row.original as unknown as Job).source
        return (source ?? "guessit") === value
      },
    },
  })

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-x-6">
        <div className="flex w-full flex-col gap-2 sm:w-fit sm:flex-row sm:items-center">
          <div className="w-44">
            <DropdownSelect value={sourceFilter} onChange={setSourceFilter} options={SOURCE_OPTIONS} />
          </div>
          <div className="relative w-full sm:max-w-[250px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
            <Input
              type="search"
              value={globalFilter}
              onChange={(event) => setGlobalFilter(event.target.value)}
              placeholder="Search groups and files..."
              className="[&>input]:h-[30px] [&>input]:border-transparent [&>input]:bg-gray-100 [&>input]:pl-8"
            />
          </div>
        </div>
        <p className="text-sm text-gray-500">{groups.length} groups</p>
      </div>

      <div className="relative overflow-hidden overflow-x-auto">
        <Table>
          <TableHead>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="border-y border-gray-200">
                {headerGroup.headers.map((header) => (
                  <TableHeaderCell
                    key={header.id}
                    className="whitespace-nowrap py-1 text-sm sm:text-xs"
                    style={{ width: header.getSize() }}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHeaderCell>
                ))}
              </TableRow>
            ))}
          </TableHead>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => {
                const isGroup = row.depth === 0
                const group = row.original
                const job = row.original as unknown as Job
                const checked = isGroup
                  ? group.jobs.every((item) => selected?.has(item.id))
                  : selected?.has(job.id)
                return (
                  <TableRow
                    key={row.id}
                    onClick={() => {
                      if (isGroup) row.toggleExpanded()
                      else onOpen?.(job)
                    }}
                    className={cn(
                      "group cursor-pointer select-none hover:bg-gray-50",
                      checked && "bg-gray-50",
                    )}
                  >
                    {row.getVisibleCells().map((cell, index) => (
                      <TableCell
                        key={cell.id}
                        className="relative whitespace-nowrap py-1 text-gray-600"
                        style={{ width: cell.column.getSize() }}
                      >
                        {index === 0 && checked ? (
                          <div className="absolute inset-y-0 left-0 w-0.5 bg-gray-900" />
                        ) : null}
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                )
              })
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-gray-500">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <TablePagination
        page={table.getState().pagination.pageIndex}
        pages={Math.max(1, table.getPageCount())}
        total={table.getFilteredRowModel().rows.length}
        pageSize={table.getState().pagination.pageSize}
        selectedCount={selected?.size ?? 0}
        onPage={(page) => table.setPageIndex(page)}
      />
    </div>
  )
}
