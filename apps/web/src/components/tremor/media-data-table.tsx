import { useEffect, useMemo, useState } from "react"
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
} from "@tanstack/react-table"
import { ChevronDown, ChevronUp, Download, MoreHorizontal, Plus, SlidersHorizontal } from "lucide-react"
import type { Job } from "../../lib/types"
import { cn, episodeLabel, pct } from "../../lib/format"
import { BulkBar } from "../bulk-bar"
import { Button, Checkbox, Input, SourceBadge, StatusBadge } from "../ui"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./dropdown"
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
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-x-1.5 whitespace-nowrap rounded-md border border-gray-300 px-2 py-1.5 font-medium text-gray-600 hover:bg-gray-50 sm:w-fit sm:text-xs",
            active ? "" : "border-dashed",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900",
          )}
        >
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
                "-ml-px size-5 shrink-0 transition sm:size-4",
                active && "rotate-45 hover:text-red-500",
              )}
              aria-hidden="true"
            />
          </span>
          {active ? (
            <>
              <span>{title}</span>
              <span className="h-4 w-px bg-gray-300" aria-hidden="true" />
              <span className="w-full truncate text-left font-semibold text-gray-900 sm:w-fit">
                {labelText}
              </span>
            </>
          ) : (
            <span className="w-full text-left sm:w-fit">{title}</span>
          )}
          <ChevronDown className="size-5 shrink-0 text-gray-500 sm:size-4" aria-hidden="true" />
        </button>
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
              className="w-full sm:py-1"
              onClick={() => column?.setFilterValue(selected.length ? selected : undefined)}
            >
              Apply
            </Button>
          </PopoverClose>
          {active ? (
            <Button
              variant="secondary"
              className="w-full sm:py-1"
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
        <Button
          variant="secondary"
          className="ml-auto hidden gap-x-2 px-2 py-1.5 text-sm sm:text-xs lg:flex"
        >
          <SlidersHorizontal className="size-4 shrink-0" aria-hidden="true" />
          View
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={7} className="z-50 w-fit space-y-2">
        <span className="font-medium text-gray-900">Display properties</span>
        <div className="flex flex-col gap-2">
          {columns.map((column) => (
            <label key={column.id} className="flex items-center gap-2">
              <Checkbox
                checked={column.getIsVisible()}
                onCheckedChange={() => column.toggleVisibility()}
              />
              <span className="text-sm text-gray-900">
                {(column.columnDef.meta?.displayName as string | undefined) ?? column.id}
              </span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function Filterbar({ table }: { table: TanStackTable<Job> }) {
  const [searchTerm, setSearchTerm] = useState("")
  const isFiltered = table.getState().columnFilters.length > 0

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      table.getColumn("search")?.setFilterValue(searchTerm || undefined)
    }, 300)
    return () => window.clearTimeout(timeout)
  }, [searchTerm, table])

  const exportFiltered = () => {
    const rows = table.getFilteredRowModel().rows.map((row) => row.original)
    const header = ["Title", "Year", "Type", "Source", "Match", "Status", "Source path"]
    const body = rows.map((job) => [
      job.title ?? "",
      job.year ?? "",
      job.media_type === "tv" ? "Shows" : "Movie",
      job.source,
      Math.round(job.confidence * 100),
      job.status,
      job.source_path,
    ])
    const csv = [header, ...body]
      .map((row) =>
        row
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "torii-queue.csv"
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

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
          onChange={(event) => setSearchTerm(event.target.value)}
          className="w-full sm:max-w-[250px]"
          inputClassName="h-[30px] border-transparent bg-gray-100"
        />
        {isFiltered ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              table.resetColumnFilters()
              setSearchTerm("")
            }}
          >
            Clear filters
          </Button>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          className="hidden gap-x-2 px-2 py-1.5 text-sm sm:text-xs lg:flex"
          onClick={exportFiltered}
        >
          <Download className="size-4 shrink-0" aria-hidden="true" />
          Export
        </Button>
        <ViewOptions table={table} />
      </div>
    </div>
  )
}

function JobRowActions({ job, onOpen }: { job: Job; onOpen?: (job: Job) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="group aspect-square p-1.5 hover:border hover:border-gray-300 data-[state=open]:border-gray-300 data-[state=open]:bg-gray-50"
          onClick={(event) => event.stopPropagation()}
        >
          <MoreHorizontal
            className="size-4 shrink-0 text-gray-500 group-hover:text-gray-700 group-data-[state=open]:text-gray-700"
            aria-hidden="true"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuItem onClick={() => onOpen?.(job)}>Open</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function MediaDataTable({
  jobs,
  selected,
  onSelectionChange,
  onOpen,
  onApprove,
  onReject,
  onUndo,
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
  busy?: boolean
  defaultStatus?: string
  pageSize?: number
}) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(() =>
    defaultStatus && defaultStatus !== "all"
      ? [{ id: "status", value: [defaultStatus] }]
      : [],
  )
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize })

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
        cell: ({ row }) => <span>{mediaTypeLabel(row.original.media_type)}</span>,
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
            return <span className="text-gray-400">—</span>
          }
          return (
            <span className="tabular-nums text-gray-600">
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
        cell: ({ row }) => <span>{pct(row.original.confidence)}</span>,
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
        id: "search",
        accessorFn: (row) => `${row.title ?? ""} ${row.source_path}`,
        enableSorting: false,
        enableHiding: false,
        meta: { displayName: "Search" },
      },
      {
        id: "edit",
        header: "Edit",
        cell: ({ row }) => <JobRowActions job={row.original} onOpen={onOpen} />,
        enableSorting: false,
        enableHiding: false,
        meta: { className: "text-right", displayName: "Edit" },
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
      pagination,
    },
    initialState: {
      columnVisibility: { search: false },
    },
    enableRowSelection: true,
    getRowId: (row) => String(row.id),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
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
  const reviewable =
    selectedJobs.length > 0 &&
    selectedJobs.every(
      (job) => job.status === "needs_review" || job.status === "ready",
    )
  const movable =
    selectedJobs.length > 0 && selectedJobs.every((job) => job.status === "moved")

  return (
    <div className="space-y-3">
      <Filterbar table={table} />

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
                <TableRow
                  key={row.id}
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
    </div>
  )
}
