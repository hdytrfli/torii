import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  createParser,
  parseAsInteger,
  parseAsString,
  useQueryStates,
} from "nuqs"
import {
  flexRender,
  getCoreRowModel,
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
import { api } from "../../lib/api"
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
  { value: "ready", label: "Ready to apply" },
  { value: "moved", label: "Moved" },
  { value: "waiting_revert", label: "Waiting to revert" },
  { value: "rejected", label: "Rejected" },
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
    <button
      type="button"
      onClick={column.getToggleSortingHandler()}
      className={cn(
        "-mx-2 inline-flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1 hover:bg-surface-muted",
        className,
      )}
      aria-label={`Sort by ${title}`}
    >
      <span>{title}</span>
      {column.getIsSorted() === "asc" ? (
        <ChevronUp className="size-3.5 shrink-0 text-ink" aria-hidden="true" />
      ) : column.getIsSorted() === "desc" ? (
        <ChevronDown className="size-3.5 shrink-0 text-ink" aria-hidden="true" />
      ) : null}
    </button>
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
            active ? "" : "border-dashed text-ink-muted",
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
                  active && "rotate-45 hover:text-danger",
                )}
                aria-hidden="true"
              />
            </span>
            {active ? (
              <>
                <span>{title}</span>
                <span className="h-4 w-px bg-line" aria-hidden="true" />
                <span className="truncate font-medium text-ink">{labelText}</span>
              </>
            ) : (
              <span>{title}</span>
            )}
          </span>
          <ChevronDown className="size-4 shrink-0 text-ink-muted/70" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={7}
        className="min-w-[calc(var(--radix-popover-trigger-width))] max-w-[calc(var(--radix-popover-trigger-width))] sm:min-w-56 sm:max-w-56"
      >
        <div className="space-y-2">
          <div>
            <span className="text-base font-medium text-ink sm:text-sm">
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
                  <span className="text-base text-ink sm:text-sm">{option.label}</span>
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
        <div className="px-2 py-2 text-xs font-medium tracking-wide text-ink-muted">
          Display properties
        </div>
        <div className="flex flex-col">
          {columns.map((column) => (
            <label
              key={column.id}
              className="flex cursor-pointer items-center gap-2 rounded py-1.5 pl-2 pr-1 text-sm text-ink hover:bg-surface-muted"
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
  const tone =
    percentage >= 85
      ? "bg-success"
      : percentage >= 60
        ? "bg-warning"
        : percentage >= 35
          ? "bg-caution"
          : "bg-danger"

  return (
    <div
      className="flex items-center gap-2"
      aria-label={`${percentage}% match`}
    >
      <span className="w-8 text-xs font-medium tabular-nums text-ink-muted">
        {percentage}%
      </span>
      <div className="flex gap-0.5" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className={cn(
              "h-3.5 w-1 rounded-sm",
              index < bars ? tone : "bg-line",
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
  selected,
  onSelectionChange,
  onOpen,
  onApprove,
  onReject,
  onUndo,
  onDeleteJob,
  busy = false,
  defaultStatus = "needs_review",
}: {
  selected?: Set<number>
  onSelectionChange?: (selected: Set<number>) => void
  onOpen?: (job: Job) => void
  onApprove?: (ids: number[]) => void
  onReject?: (ids: number[]) => void
  onUndo?: (ids: number[]) => void
  onDeleteJob?: (job: Job) => Promise<void>
  busy?: boolean
  defaultStatus?: string
}) {
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
      page: parseAsInteger.withDefault(1),
      size: parseAsInteger.withDefault(20),
      sort: parseAsString.withDefault("updated_at"),
      dir: parseAsString.withDefault("desc"),
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
  const sort = query.sort
  const direction = query.dir === "asc" ? "asc" : "desc"
  const sorting = useMemo<SortingState>(
    () => [{ id: sort, desc: direction === "desc" }],
    [sort, direction],
  )

  const jobsQuery = useQuery({
    queryKey: [
      "review-jobs",
      query.status,
      query.source,
      query.type,
      query.q,
      sort,
      direction,
      query.page,
      query.size,
    ],
    queryFn: () =>
      api.reviewJobs({
        status: query.status.length ? query.status.join(",") : "all",
        source: query.source.length ? query.source.join(",") : undefined,
        media_type: query.type.length ? query.type.join(",") : undefined,
        q: query.q || undefined,
        sort,
        direction,
        page: query.page,
        page_size: query.size,
      }),
    placeholderData: (previous) => previous,
  })
  const jobs = jobsQuery.data?.items ?? []

  useEffect(() => {
    const pages = jobsQuery.data?.pages
    if (pages && query.page > pages) {
      void setQuery({ page: pages })
    }
  }, [jobsQuery.data?.pages, query.page, setQuery])

  const resetSelection = () => onSelectionChange?.(new Set())

  const updateFilters = (updater: Updater<ColumnFiltersState>) => {
    const next = typeof updater === "function" ? updater(columnFilters) : updater
    resetSelection()
    void setQuery({
      status: filterValues(next, "status"),
      source: filterValues(next, "source"),
      type: filterValues(next, "type"),
      page: 1,
    })
  }

  const updateSearch = (value: string) => {
    resetSelection()
    void setQuery({ q: value, page: 1 })
  }

  const clearFilters = () => {
    resetSelection()
    void setQuery({ status: [], source: [], type: [], q: "", page: 1 })
  }

  const updatePageSize = (value: string) => {
    resetSelection()
    void setQuery({ size: Number(value), page: 1 })
  }

  const updatePage = (page: number) => {
    resetSelection()
    void setQuery({ page: page + 1 })
  }

  const updateSorting = (updater: Updater<SortingState>) => {
    resetSelection()
    const next =
      typeof updater === "function" ? updater(sorting) : updater
    const first = next[0]
    void setQuery({
      sort: first?.id ?? "updated_at",
      dir: first ? (first.desc ? "desc" : "asc") : "desc",
      page: 1,
    })
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
              className="truncate text-left text-ink"
            >
              {job.title ?? job.source_path}
              {job.error ? (
                <span
                  title={blockedReasonLabel(job.blocked_reason) ?? job.error}
                  className="ml-1.5 inline-block size-1.5 rounded-full bg-danger align-middle"
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
            return <span className="text-xs text-ink-muted/70">—</span>
          }
          return (
            <span className="text-xs tabular-nums text-ink-muted">
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
        id: "created_at",
        accessorKey: "created_at",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Created" />
        ),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-xs tabular-nums text-ink-muted">
            {new Date(row.original.created_at).toLocaleString()}
          </span>
        ),
        enableSorting: true,
        meta: { displayName: "Created at" },
      },
      {
        id: "updated_at",
        accessorKey: "updated_at",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Updated" />
        ),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-xs tabular-nums text-ink-muted">
            {new Date(row.original.updated_at).toLocaleString()}
          </span>
        ),
        enableSorting: true,
        meta: { displayName: "Updated at" },
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
                className="size-8 p-0 text-ink-muted hover:text-danger"
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
      rowSelection,
      pagination: { pageIndex: Math.max(0, query.page - 1), pageSize: query.size },
    },
    initialState: {
      columnVisibility: {
        created_at: false,
        updated_at: false,
      },
    },
    pageCount: jobsQuery.data?.pages ?? 1,
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    enableRowSelection: true,
    getRowId: (row) => String(row.id),
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: updateSorting,
    onColumnFiltersChange: updateFilters,
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
    <div className="space-y-5">
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
              <TableRow key={headerGroup.id} className="border-y border-line">
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
                          <div className="text-[11px] font-medium text-ink-muted">
                            Original filename
                          </div>
                          <p className="mt-1 break-all font-mono text-[11px] leading-5 text-ink">
                            {basename(row.original.source_path) || row.original.source_path}
                          </p>
                        </div>
                        <div>
                          <div className="text-[11px] font-medium text-ink-muted">
                            Target path
                          </div>
                          <p className="mt-1 break-all font-mono text-[11px] leading-5 text-ink">
                            {row.original.target_path
                              ? targetSubpath(row.original.target_path, row.original.media_type)
                              : "Not calculated yet"}
                          </p>
                        </div>
                      </div>
                      <div className="border-t border-line bg-surface-muted px-4 py-2 text-[11px] text-ink-muted">
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
                    onClick={() => onOpen?.(row.original)}
                    className="group cursor-pointer select-none hover:bg-surface-muted"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          "relative whitespace-nowrap py-1 text-ink-muted first:w-10",
                          cell.column.columnDef.meta?.className,
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                </HoverPopover>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-ink-muted">
                  {jobsQuery.isLoading
                    ? "Loading jobs…"
                    : jobsQuery.isError
                      ? "Could not load jobs."
                      : "No results."}
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
        page={Math.max(0, query.page - 1)}
        pages={jobsQuery.data?.pages ?? 1}
        total={jobsQuery.data?.total ?? 0}
        pageSize={query.size}
        selectedCount={selectedJobs.length}
        onPage={updatePage}
        onPageSizeChange={updatePageSize}
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
          <DialogHeader className="border-b border-line px-5 py-4">
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
              <div className="text-[11px] font-medium text-ink-muted">
                {deleteCandidate?.status === "moved" ? "Library file" : "Source file"}
              </div>
              <p className="mt-1 break-all font-mono text-[11px] leading-5 text-ink">
                {deleteCandidate?.status === "moved"
                  ? deleteCandidate?.target_path || "No target path"
                  : deleteCandidate?.source_path}
              </p>
            </div>
            {deleteError ? <p className="text-xs text-danger">{deleteError}</p> : null}
          </div>
          <DialogFooter className="border-t border-line bg-surface-muted px-5 py-3">
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
