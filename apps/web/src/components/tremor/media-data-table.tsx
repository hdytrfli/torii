import { useEffect, useMemo, useState } from "react"
import { createParser, parseAsString, useQueryStates } from "nuqs"
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type Column,
  type ColumnDef,
  type ColumnFiltersState,
  type FilterFn,
  type RowSelectionState,
  type SortingState,
  type Table as TanStackTable,
  type Updater,
} from "@tanstack/react-table"
import { ChevronDown, ChevronUp, Plus, SlidersHorizontal, Trash2 } from "lucide-react"
import type { Job } from "../../lib/types"
import { basename, cn, episodeLabel, statusLabel } from "../../lib/format"
import { blockedReasonLabel, isReviewable } from "../../lib/job-state"
import { BulkBar } from "../bulk-bar"
import { Button, Checkbox, Input, SourceBadge, StatusBadge } from "../ui"
import { HoverPopover } from "./hover-popover"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog"
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "./popover"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "./table"
import { TablePagination } from "./table-pagination"

type FilterOption = { value: string; label: string }

const STATUS_OPTIONS: FilterOption[] = [
  { value: "needs_review", label: "Needs review" },
  { value: "ready", label: "Ready" },
  { value: "moved", label: "Moved" },
  { value: "rejected", label: "Rejected" },
  { value: "applying", label: "Applying" },
  { value: "failed", label: "Failed" },
]

const SOURCE_OPTIONS: FilterOption[] = [
  { value: "jellyfin", label: "Jellyfin" },
  { value: "guessit", label: "Filename" },
  { value: "nfo", label: "Local NFO" },
  { value: "llm", label: "AI fallback" },
  { value: "manual", label: "Manual" },
]

const TYPE_OPTIONS: FilterOption[] = [
  { value: "movie", label: "Movie" },
  { value: "tv", label: "Shows" },
]

function mediaTypeLabel(value: Job["media_type"]) {
  return value === "tv" ? "Shows" : "Movie"
}

function targetSubpath(path: string | null, mediaType: Job["media_type"]) {
  if (!path) return ""
  const normalized = path.replaceAll("\\", "/")
  const markers =
    mediaType === "tv" ? ["/shows/"] : mediaType === "movie" ? ["/movies/"] : ["/movies/", "/shows/"]
  for (const marker of markers) {
    const index = normalized.lastIndexOf(marker)
    if (index >= 0) return normalized.slice(index + marker.length)
  }
  return normalized
}

const arrayFilter: FilterFn<Job> = (row, columnId, filterValue) => {
  const values = Array.isArray(filterValue) ? (filterValue as string[]) : []
  if (!values.length) return true
  return values.includes(String(row.getValue(columnId)))
}

function DataTableColumnHeader({
  column,
  title,
  className,
}: {
  column: Column<Job, unknown>
  title: string
  className?: string
}) {
  if (!column.getCanSort()) {
    return <div className={className}>{title}</div>
  }

  return (
    <div
      onClick={column.getToggleSortingHandler()}
      className={cn(
        column.columnDef.enableSorting === true
          ? "-mx-2 inline-flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1 hover:bg-gray-50"
          : "",
        className,
      )}
    >
      <span>{title}</span>
      {column.getIsSorted() === "asc" ? (
        <ChevronUp className="size-3.5 shrink-0 text-gray-900" aria-hidden="true" />
      ) : column.getIsSorted() === "desc" ? (
        <ChevronDown className="size-3.5 shrink-0 text-gray-900" aria-hidden="true" />
      ) : null}
    </div>
  )
}

function DataTableFilter({
  column,
  title,
  options,
}: {
  column: Column<Job, unknown> | undefined
  title: string
  options: FilterOption[]
}) {
  const rawValue = column?.getFilterValue()
  const current = Array.isArray(rawValue) ? (rawValue as string[]) : []
  const [selected, setSelected] = useState<string[]>(current)

  useEffect(() => {
    setSelected(current)
  }, [rawValue])

  const active = selected.length > 0
  const labels = selected.map(
    (value) => options.find((option) => option.value === value)?.label ?? value,
  )
  const labelText =
    labels.length < 3
      ? labels.join(", ")
      : `${labels[0]} and ${labels.length - 1} more`

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          className={cn(
            "w-full justify-between gap-x-1.5 font-normal sm:w-fit",
            active ? "" : "border-dashed text-gray-600",
          )}
        >
          <span className="flex min-w-0 items-center gap-x-1.5">
            <span
              aria-hidden="true"
              onClick={(event) => {
                if (active) {
                  event.stopPropagation()
                  column?.setFilterValue(undefined)
                  setSelected([])
                }
              }}
            >
              <Plus
                className={cn(
                  "size-4 shrink-0 transition",
                  active && "rotate-45 hover:text-red-500",
                )}
                aria-hidden="true"
              />
            </span>
            {active ? (
              <>
                <span>{title}</span>
                <span className="h-4 w-px bg-gray-300" aria-hidden="true" />
                <span className="truncate font-medium text-gray-900">{labelText}</span>
              </>
            ) : (
              <span>{title}</span>
            )}
          </span>
          <ChevronDown className="size-4 shrink-0 text-gray-400" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={7}
        className="min-w-[calc(var(--radix-popover-trigger-width))] max-w-[calc(var(--radix-popover-trigger-width))] sm:min-w-56 sm:max-w-56"
      >
        <div className="space-y-2">
          <div>
            <span className="text-base font-medium text-gray-900 sm:text-sm">
              Filter by {title}
            </span>
            <div className="mt-2 space-y-2 overflow-y-auto sm:max-h-36">
              {options.map((option) => (
                <label key={option.value} className="flex items-center gap-2">
                  <Checkbox
                    checked={selected.includes(option.value)}
                    onCheckedChange={(checked) => {
                      setSelected((previous) =>
                        checked
                          ? [...previous, option.value]
                          : previous.filter((value) => value !== option.value),
                      )
                    }}
                  />
                  <span className="text-base text-gray-900 sm:text-sm">{option.label}</span>
                </label>
              ))}
            </div>
          </div>
          <PopoverClose asChild>
            <Button
              type="button"
              className="w-full"
              onClick={() => column?.setFilterValue(selected.length ? selected : undefined)}
            >
              Apply
            </Button>
          </PopoverClose>
          {active ? (
            <Button
              variant="secondary"
              className="w-full"
              type="button"
              onClick={() => {
                setSelected([])
                column?.setFilterValue(undefined)
              }}
            >
              Reset
            </Button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function ViewOptions({ table }: { table: TanStackTable<Job> }) {
  const columns = table.getAllColumns().filter((column) => column.getCanHide())

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="secondary" className="ml-auto hidden lg:flex">
          <SlidersHorizontal className="size-4 shrink-0" aria-hidden="true" />
          View
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={7} className="z-50 w-60 p-1">
        <div className="px-2 py-2 text-xs font-medium tracking-wide text-gray-500">
          Display properties
        </div>
        <div className="flex flex-col">
          {columns.map((column) => (
            <label
              key={column.id}
              className="flex cursor-pointer items-center gap-2 rounded py-1.5 pl-2 pr-1 text-sm text-gray-900 hover:bg-gray-100"
            >
              <Checkbox
                checked={column.getIsVisible()}
                onCheckedChange={() => column.toggleVisibility()}
              />
              <span>
                {(column.columnDef.meta?.displayName as string | undefined) ?? column.id}
              </span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function Filterbar({
  table,
  searchTerm,
  onSearchChange,
  onClear,
  isFiltered,
}: {
  table: TanStackTable<Job>
  searchTerm: string
  onSearchChange: (value: string) => void
  onClear: () => void
  isFiltered: boolean
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-x-6">
      <div className="flex w-full flex-col gap-2 sm:w-fit sm:flex-row sm:items-center">
        <DataTableFilter
          column={table.getColumn("status")}
          title="Status"
          options={STATUS_OPTIONS}
        />
        <DataTableFilter
          column={table.getColumn("source")}
          title="Source"
          options={SOURCE_OPTIONS}
        />
        <DataTableFilter
          column={table.getColumn("type")}
          title="Type"
          options={TYPE_OPTIONS}
        />
        <Input
          type="search"
          placeholder="Search files..."
          value={searchTerm}
          onChange={(event) => onSearchChange(event.target.value)}
          className="w-full sm:max-w-[250px]"
        />
        {isFiltered ? (
          <Button variant="secondary" onClick={onClear}>
            Clear filters
          </Button>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <ViewOptions table={table} />
      </div>
    </div>
  )
}

function MatchIndicator({ value }: { value: number }) {
  const percentage = Math.round((value ?? 0) * 100)
  const bars = percentage >= 85 ? 3 : percentage >= 60 ? 2 : percentage > 0 ? 1 : 0

  return (
    <div
      className="flex items-center gap-2"
      aria-label={`${percentage}% match`}
    >
      <span className="w-8 text-xs font-medium tabular-nums text-gray-600">
        {percentage}%
      </span>
      <div className="flex gap-0.5" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className={cn(
              "h-3.5 w-1 rounded-sm",
              index < bars ? "bg-brand" : "bg-gray-300",
            )}
          />
        ))}
      </div>
    </div>
  )
}

function parseAsCommaList(defaultValue: string[] = []) {
  return createParser<string[]>({
    parse(value) {
      if (!value) return null
      if (value === "all") return []
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    },
    serialize(value) {
      return value.length ? value.join(",") : "all"
    },
  }).withDefault(defaultValue)
}

function filterValues(filters: ColumnFiltersState, id: string) {
  const value = filters.find((filter) => filter.id === id)?.value
  return Array.isArray(value) ? value.map(String) : []
}

export function MediaDataTable({
  jobs,
  selected,
  onSelectionChange,
  onOpen,
  onApprove,
  onReject,
  onUndo,
  onDeleteJob,
  busy = false,
  defaultStatus = "needs_review",
  pageSize = 20,
}: {
  jobs: Job[]
  selected?: Set<number>
  onSelectionChange?: (selected: Set<number>) => void
  onOpen?: (job: Job) => void
  onApprove?: (ids: number[]) => void
  onReject?: (ids: number[]) => void
  onUndo?: (ids: number[]) => void
  onDeleteJob?: (job: Job) => Promise<void>
  busy?: boolean
  defaultStatus?: string
  pageSize?: number
}) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize })
  const [deleteCandidate, setDeleteCandidate] = useState<Job | null>(null)
  const [deletePending, setDeletePending] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const confirmDelete = async () => {
    if (!deleteCandidate || !onDeleteJob) return
    setDeletePending(true)
    setDeleteError(null)
    try {
      await onDeleteJob(deleteCandidate)
      setDeleteCandidate(null)
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Could not delete job.")
    } finally {
      setDeletePending(false)
    }
  }

  const parsers = useMemo(
    () => ({
      status: parseAsCommaList(
        defaultStatus && defaultStatus !== "all" ? [defaultStatus] : [],
      ),
      source: parseAsCommaList(),
      type: parseAsCommaList(),
      q: parseAsString.withDefault(""),
    }),
    [defaultStatus],
  )
  const [query, setQuery] = useQueryStates(parsers, {
    history: "replace",
    scroll: false,
  })

  const columnFilters = useMemo<ColumnFiltersState>(() => {
    const filters: ColumnFiltersState = []
    if (query.status.length) filters.push({ id: "status", value: query.status })
    if (query.source.length) filters.push({ id: "source", value: query.source })
    if (query.type.length) filters.push({ id: "type", value: query.type })
    return filters
  }, [query.status, query.source, query.type])

  const searchTerm = query.q

  const updateFilters = (updater: Updater<ColumnFiltersState>) => {
    const next = typeof updater === "function" ? updater(columnFilters) : updater
    setPagination((current) => ({ ...current, pageIndex: 0 }))
    void setQuery({
      status: filterValues(next, "status"),
      source: filterValues(next, "source"),
      type: filterValues(next, "type"),
    })
  }

  const updateSearch = (value: string) => {
    setPagination((current) => ({ ...current, pageIndex: 0 }))
    void setQuery({ q: value })
  }

  const clearFilters = () => {
    setPagination((current) => ({ ...current, pageIndex: 0 }))
    void setQuery({ status: [], source: [], type: [], q: "" })
  }

  const isFiltered =
    query.status.length > 0 ||
    query.source.length > 0 ||
    query.type.length > 0 ||
    query.q !== ""

  const rowSelection = useMemo<RowSelectionState>(() => {
    const state: RowSelectionState = {}
    for (const id of selected ?? []) state[String(id)] = true
    return state
  }, [selected])

  const columns = useMemo<ColumnDef<Job>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected()
                ? true
                : table.getIsSomeRowsSelected()
                  ? "indeterminate"
                  : false
            }
            onCheckedChange={() => table.toggleAllPageRowsSelected()}
            className="translate-y-0.5"
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={() => row.toggleSelected()}
            onClick={(event) => event.stopPropagation()}
            className="translate-y-0.5"
            aria-label="Select row"
          />
        ),
        enableSorting: false,
        enableHiding: false,
        meta: { className: "w-10", displayName: "Select" },
      },
      {
        id: "title",
        accessorFn: (row) => row.title ?? row.source_path,
        header: ({ column }) => <DataTableColumnHeader column={column} title="File" />,
        cell: ({ row }) => {
          const job = row.original
          return (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onOpen?.(job)
              }}
              className="truncate text-left text-gray-900"
            >
              {job.title ?? job.source_path}
              {job.error ? (
                <span
                  title={blockedReasonLabel(job.blocked_reason) ?? job.error}
                  className="ml-1.5 inline-block size-1.5 rounded-full bg-red-500 align-middle"
                  aria-label={blockedReasonLabel(job.blocked_reason) ?? job.error}
                />
              ) : null}
            </button>
          )
        },
        enableSorting: true,
        enableHiding: false,
        meta: { displayName: "File" },
      },
      {
        id: "type",
        accessorFn: (row) => row.media_type ?? "movie",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
        cell: ({ row }) => (
          <span className="text-xs">{mediaTypeLabel(row.original.media_type)}</span>
        ),
        filterFn: arrayFilter,
        enableSorting: true,
        meta: { displayName: "Type" },
      },
      {
        id: "year_episode",
        accessorFn: (row) => [row.year, episodeLabel(row)].filter(Boolean).join(" "),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Year / Episode" />
        ),
        cell: ({ row }) => {
          const year = row.original.year
          const episode = episodeLabel(row.original)
          if (!year && !episode) {
            return <span className="text-xs text-gray-400">—</span>
          }
          return (
            <span className="text-xs tabular-nums text-gray-600">
              {[year, episode].filter(Boolean).join(" · ")}
            </span>
          )
        },
        enableSorting: true,
        meta: { displayName: "Year / Episode" },
      },
      {
        id: "source",
        accessorKey: "source",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Source" />,
        cell: ({ row }) => <SourceBadge source={row.original.source} />,
        filterFn: arrayFilter,
        enableSorting: true,
        meta: { displayName: "Source" },
      },
      {
        id: "confidence",
        accessorKey: "confidence",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Match" />,
        cell: ({ row }) => <MatchIndicator value={row.original.confidence} />,
        enableSorting: true,
        meta: { displayName: "Match" },
      },
      {
        id: "status",
        accessorKey: "status",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
        filterFn: arrayFilter,
        enableSorting: true,
        meta: { displayName: "Status" },
      },
      {
        id: "edit",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={(event) => {
                event.stopPropagation()
                onOpen?.(row.original)
              }}
            >
              Open
            </Button>
            {onDeleteJob ? (
              <Button
                variant="ghost"
                className="size-8 p-0 text-gray-500 hover:text-red-700"
                aria-label={`Delete ${row.original.title ?? "job"}`}
                onClick={(event) => {
                  event.stopPropagation()
                  setDeleteError(null)
                  setDeleteCandidate(row.original)
                }}
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            ) : null}
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
        meta: { className: "text-right", displayName: "Actions" },
      },
    ],
    [onOpen],
  )

  const table = useReactTable({
    data: jobs,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter: searchTerm,
      rowSelection,
      pagination,
    },
    enableRowSelection: true,
    getRowId: (row) => String(row.id),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: (row, _columnId, value) => {
      const needle = String(value ?? "").toLowerCase()
      if (!needle) return true
      return `${row.original.title ?? ""} ${row.original.source_path}`
        .toLowerCase()
        .includes(needle)
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: updateFilters,
    onPaginationChange: setPagination,
    onRowSelectionChange: (updater) => {
      const next = typeof updater === "function" ? updater(rowSelection) : updater
      onSelectionChange?.(
        new Set(
          Object.entries(next)
            .filter(([, value]) => value)
            .map(([key]) => Number(key)),
        ),
      )
    },
  })

  const selectedJobs = useMemo(
    () => jobs.filter((job) => selected?.has(job.id)),
    [jobs, selected],
  )
  const reviewable = selectedJobs.length > 0 && selectedJobs.every(isReviewable)
  const movable =
    selectedJobs.length > 0 && selectedJobs.every((job) => job.status === "moved")

  return (
    <div className="space-y-3">
      <Filterbar
        table={table}
        searchTerm={searchTerm}
        onSearchChange={updateSearch}
        onClear={clearFilters}
        isFiltered={isFiltered}
      />

      <div className="relative overflow-hidden overflow-x-auto">
        <Table>
          <TableHead>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="border-y border-gray-200">
                {headerGroup.headers.map((header) => (
                  <TableHeaderCell
                    key={header.id}
                    className={cn(
                      "whitespace-nowrap py-1 text-sm sm:text-xs",
                      header.column.columnDef.meta?.className,
                    )}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHeaderCell>
                ))}
              </TableRow>
            ))}
          </TableHead>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <HoverPopover
                  key={row.id}
                  id={`job-${row.id}`}
                  delay={350}
                  closeDelay={0}
                  contentClassName="w-96"
                  content={
                    <>
                      <div className="space-y-3 p-4">
                        <div>
                          <div className="text-[11px] font-medium text-gray-500">
                            Original filename
                          </div>
                          <p className="mt-1 break-all font-mono text-[11px] leading-5 text-gray-700">
                            {basename(row.original.source_path) || row.original.source_path}
                          </p>
                        </div>
                        <div>
                          <div className="text-[11px] font-medium text-gray-500">
                            Target path
                          </div>
                          <p className="mt-1 break-all font-mono text-[11px] leading-5 text-gray-700">
                            {row.original.target_path
                              ? targetSubpath(row.original.target_path, row.original.media_type)
                              : "Not calculated yet"}
                          </p>
                        </div>
                      </div>
                      <div className="border-t border-gray-200 bg-gray-50 px-4 py-2 text-[11px] text-gray-500">
                        {mediaTypeLabel(row.original.media_type)} ·{" "}
                        {statusLabel(row.original.status)}
                        {row.original.blocked_reason
                          ? ` · ${blockedReasonLabel(row.original.blocked_reason)}`
                          : ""}
                      </div>
                    </>
                  }
                >
                  <TableRow
                    onClick={() => row.toggleSelected(!row.getIsSelected())}
                    className="group select-none hover:bg-gray-50"
                  >
                    {row.getVisibleCells().map((cell, index) => (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          row.getIsSelected() ? "bg-gray-50" : "",
                          "relative whitespace-nowrap py-1 text-gray-600 first:w-10",
                          cell.column.columnDef.meta?.className,
                        )}
                      >
                        {index === 0 && row.getIsSelected() ? (
                          <div className="absolute inset-y-0 left-0 w-0.5 bg-gray-900" />
                        ) : null}
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                </HoverPopover>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <BulkBar
          count={selectedJobs.length}
          onClear={() => onSelectionChange?.(new Set())}
          onApprove={() => onApprove?.(selectedJobs.map((job) => job.id))}
          onReject={() => onReject?.(selectedJobs.map((job) => job.id))}
          onUndo={() => onUndo?.(selectedJobs.map((job) => job.id))}
          showReview={reviewable}
          showUndo={movable}
          busy={busy}
        />
      </div>

      <TablePagination
        page={table.getState().pagination.pageIndex}
        pages={Math.max(1, table.getPageCount())}
        total={table.getFilteredRowModel().rows.length}
        pageSize={table.getState().pagination.pageSize}
        selectedCount={selectedJobs.length}
        onPage={(page) => {
          onSelectionChange?.(new Set())
          table.setPageIndex(page)
        }}
      />

      <Dialog
        open={deleteCandidate !== null}
        onOpenChange={(open) => {
          if (!open && !deletePending) {
            setDeleteCandidate(null)
            setDeleteError(null)
          }
        }}
      >
        <DialogContent className="max-w-md p-0">
          <DialogHeader className="border-b border-gray-200 px-5 py-4">
            <DialogTitle className="text-base">
              {deleteCandidate?.status === "moved" ? "Remove job" : "Delete job"}
            </DialogTitle>
            <DialogDescription className="text-sm">
              {deleteCandidate?.status === "moved"
                ? "This removes the job from history. The library file is kept."
                : "This deletes the downloaded source file and removes the job."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 px-5 py-4">
            <div>
              <div className="text-[11px] font-medium text-gray-500">
                {deleteCandidate?.status === "moved" ? "Library file" : "Source file"}
              </div>
              <p className="mt-1 break-all font-mono text-[11px] leading-5 text-gray-700">
                {deleteCandidate?.status === "moved"
                  ? deleteCandidate?.target_path || "No target path"
                  : deleteCandidate?.source_path}
              </p>
            </div>
            {deleteError ? <p className="text-xs text-red-700">{deleteError}</p> : null}
          </div>
          <DialogFooter className="border-t border-gray-200 bg-gray-50 px-5 py-3">
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={deletePending}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="button"
              variant="danger"
              onClick={() => void confirmDelete()}
              disabled={deletePending}
            >
              {deletePending
                ? "Deleting…"
                : deleteCandidate?.status === "moved"
                  ? "Remove job"
                  : "Delete source"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
