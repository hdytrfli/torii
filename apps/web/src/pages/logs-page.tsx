import { useDeferredValue, useState } from "react"
import { parseAsInteger, parseAsString, useQueryStates } from "nuqs"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ChevronDown, ChevronUp } from "lucide-react"
import type { LogRow } from "../lib/types"
import { api } from "../lib/api"
import { cn } from "../lib/format"
import { PageHeader } from "../components/page-header"
import { Button, Card, Checkbox, Input } from "../components/ui"
import { CardBody, CardFooter } from "../components/tremor/card"
import {
  CommandBar,
  CommandBarBar,
  CommandBarCommand,
  CommandBarSeperator,
  CommandBarValue,
} from "../components/tremor/command-bar"
import { DropdownSelect } from "../components/tremor/dropdown-select"
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "../components/tremor/drawer"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "../components/tremor/table"
import { TablePagination } from "../components/tremor/table-pagination"

const LEVEL_OPTIONS = [
  { value: "all", label: "All levels" },
  { value: "DEBUG", label: "Debug" },
  { value: "INFO", label: "Info" },
  { value: "WARNING", label: "Warning" },
  { value: "ERROR", label: "Error" },
]

function levelDot(level: string) {
  if (level === "ERROR") return "bg-danger"
  if (level === "WARNING") return "bg-warning"
  if (level === "INFO") return "bg-info"
  return "bg-ink-muted"
}

function formatContext(context: string | null) {
  if (!context) return null
  try {
    return JSON.stringify(JSON.parse(context), null, 2)
  } catch {
    return context
  }
}

function messagePreview(message: string) {
  const firstLine = message.split("\n")[0]
  return firstLine.length > 160 ? `${firstLine.slice(0, 160)}…` : firstLine
}

export function LogsPage() {
  const [query, setQuery] = useQueryStates({
    level: parseAsString.withDefault("all"),
    q: parseAsString.withDefault(""),
    page: parseAsInteger.withDefault(1),
    size: parseAsInteger.withDefault(20),
    sort: parseAsString.withDefault("created_at"),
    dir: parseAsString.withDefault("desc"),
  }, { history: "replace", scroll: false })
  const [selectedLog, setSelectedLog] = useState<LogRow | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [wrapDetail, setWrapDetail] = useState(true)
  const queryClient = useQueryClient()
  const deferredSearch = useDeferredValue(query.q)
  const { level, page, size: pageSize, sort } = query
  const direction = query.dir === "asc" ? "asc" : "desc"
  const search = query.q

  const logsQuery = useQuery({
    queryKey: ["logs", level, deferredSearch, page, pageSize, sort, direction],
    queryFn: () =>
      api.logs({
        level,
        q: deferredSearch || undefined,
        sort,
        direction,
        page,
        page_size: pageSize,
      }),
    placeholderData: (previous) => previous,
  })

  const items = logsQuery.data?.items ?? []
  const isFiltered = level !== "all" || search !== ""

  const deleteSelected = useMutation({
    mutationFn: () => api.deleteLogs([...selected]),
    onSuccess: () => {
      setSelected(new Set())
      void queryClient.invalidateQueries({ queryKey: ["logs"] })
    },
  })

  const toggle = (id: number) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const updateSort = (column: string) => {
    const nextDirection =
      sort === column && direction === "asc" ? "desc" : "asc"
    void setQuery({ sort: column, dir: nextDirection, page: 1 })
    setSelected(new Set())
  }

  const sortHeader = (label: string, column: string) => (
    <button
      type="button"
      onClick={() => updateSort(column)}
      className={cn(
        "-mx-2 inline-flex cursor-pointer select-none items-center gap-1.5 rounded-md px-2 py-1 hover:bg-surface-muted",
        sort === column && "text-ink",
      )}
      aria-label={`Sort by ${label}`}
    >
      <span>{label}</span>
      {sort === column ? (
        direction === "asc" ? (
          <ChevronUp className="size-3.5 shrink-0" aria-hidden="true" />
        ) : (
          <ChevronDown className="size-3.5 shrink-0" aria-hidden="true" />
        )
      ) : null}
    </button>
  )

  const allSelected =
    items.length > 0 && items.every((log) => selected.has(log.id))
  const someSelected = items.some((log) => selected.has(log.id))
  const selectedDetail = selectedLog?.detail || selectedLog?.message || ""

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Activity"
        title="Every action, accounted for."
        description="Follow scans, metadata decisions, queue processing, file operations, and admin changes in one timeline. Open any event to inspect its full JSON context."
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex w-full flex-col gap-2 sm:w-fit sm:flex-row sm:items-center">
          <div className="w-40">
            <DropdownSelect
              value={level}
              onChange={(value) => {
                void setQuery({ level: value, page: 1 })
                setSelected(new Set())
              }}
              options={LEVEL_OPTIONS}
            />
          </div>
          <Input
            type="search"
            placeholder="Search events..."
            value={search}
            onChange={(event) => {
              void setQuery({ q: event.target.value, page: 1 })
              setSelected(new Set())
            }}
            className="w-full sm:max-w-[280px]"
          />
          {isFiltered ? (
            <Button
              variant="secondary"
              onClick={() => {
                void setQuery({ level: "all", q: "", page: 1 })
                setSelected(new Set())
              }}
            >
              Clear filters
            </Button>
          ) : null}
        </div>
      </div>

      <div className="relative overflow-hidden overflow-x-auto">
        <Table>
          <TableHead>
            <TableRow className="border-y border-line">
              <TableHeaderCell className="w-10 whitespace-nowrap py-1 sm:text-xs">
                <Checkbox
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  onCheckedChange={() =>
                    setSelected(
                      allSelected
                        ? new Set()
                        : new Set(items.map((log) => log.id)),
                    )
                  }
                  className="translate-y-0.5"
                  aria-label="Select all logs"
                />
              </TableHeaderCell>
              <TableHeaderCell className="whitespace-nowrap py-1 sm:text-xs">
                {sortHeader("Time", "created_at")}
              </TableHeaderCell>
              <TableHeaderCell className="whitespace-nowrap py-1 sm:text-xs">
                {sortHeader("Level", "level")}
              </TableHeaderCell>
              <TableHeaderCell className="whitespace-nowrap py-1 sm:text-xs">
                {sortHeader("Source", "source")}
              </TableHeaderCell>
              <TableHeaderCell className="whitespace-nowrap py-1 sm:text-xs">
                {sortHeader("Actor", "actor")}
              </TableHeaderCell>
              <TableHeaderCell className="whitespace-nowrap py-1 sm:text-xs">
                {sortHeader("Job", "job_id")}
              </TableHeaderCell>
              <TableHeaderCell className="whitespace-nowrap py-1 sm:text-xs">
                {sortHeader("Message", "message")}
              </TableHeaderCell>
              <TableHeaderCell className="whitespace-nowrap py-1 text-right sm:text-xs">
                Details
              </TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.length ? (
              items.map((log: LogRow) => (
                <TableRow
                  key={log.id}
                  onClick={() => setSelectedLog(log)}
                  className="group cursor-pointer hover:bg-surface-muted"
                >
                  <TableCell className="relative w-10 py-1">
                    <Checkbox
                      checked={selected.has(log.id)}
                      onCheckedChange={() => toggle(log.id)}
                      onClick={(event) => event.stopPropagation()}
                      className="translate-y-0.5"
                      aria-label={`Select log ${log.id}`}
                    />
                  </TableCell>
                  <TableCell className="whitespace-nowrap py-1 text-xs tabular-nums text-ink-muted">
                    {new Date(log.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="whitespace-nowrap py-1">
                    <span className="inline-flex items-center gap-1.5 text-xs capitalize text-ink-muted">
                      <span
                        className={`size-2 shrink-0 rounded-sm ${levelDot(log.level)}`}
                        aria-hidden="true"
                      />
                      {log.level.toLowerCase()}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-56 truncate py-1 font-mono text-xs text-ink-muted">
                    {log.source}
                  </TableCell>
                  <TableCell className="whitespace-nowrap py-1 text-xs text-ink-muted">
                    {log.actor ?? "system"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap py-1 font-mono text-xs text-ink-muted">
                    {log.job_id ? `#${log.job_id}` : "—"}
                  </TableCell>
                  <TableCell className="py-1 text-xs text-ink">
                    <span
                      className="block max-w-[40rem] truncate"
                      title={log.detail ?? log.message}
                    >
                      {messagePreview(log.message)}
                    </span>
                  </TableCell>
                  <TableCell className="py-1 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation()
                        setSelectedLog(log)
                      }}
                    >
                      Open
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-ink-muted">
                  {logsQuery.isLoading ? "Loading events…" : "No events match these filters."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <TablePagination
        page={page - 1}
        pages={logsQuery.data?.pages ?? 1}
        total={logsQuery.data?.total ?? 0}
        pageSize={pageSize}
        selectedCount={selected.size}
        onPage={(next) => {
          void setQuery({ page: next + 1 })
          setSelected(new Set())
        }}
        onPageSizeChange={(value) => {
          void setQuery({ size: Number(value), page: 1 })
          setSelected(new Set())
        }}
      />

      <CommandBar open={selected.size > 0}>
        <CommandBarBar>
          <CommandBarValue>{selected.size} selected</CommandBarValue>
          <CommandBarSeperator />
          <CommandBarCommand
            label="Delete"
            action={() => deleteSelected.mutate()}
            shortcut={{ shortcut: "d" }}
            disabled={deleteSelected.isPending}
          />
          <CommandBarSeperator />
          <CommandBarCommand
            label="Reset"
            action={() => setSelected(new Set())}
            shortcut={{ shortcut: "Escape", label: "esc" }}
          />
        </CommandBarBar>
      </CommandBar>

      <Drawer
        open={selectedLog !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedLog(null)
        }}
      >
        <DrawerContent className="sm:max-w-2xl">
          <DrawerHeader>
            <DrawerTitle>Log #{selectedLog?.id}</DrawerTitle>
          </DrawerHeader>
          <DrawerBody className="-mx-6 space-y-4 overflow-y-auto border-t border-line px-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="text-[11px] font-medium text-ink-muted">Time</div>
                <p className="mt-1 text-xs text-ink">
                  {selectedLog ? new Date(selectedLog.created_at).toLocaleString() : ""}
                </p>
              </div>
              <div>
                <div className="text-[11px] font-medium text-ink-muted">Level</div>
                <p className="mt-1 inline-flex items-center gap-1.5 text-xs capitalize text-ink">
                  {selectedLog ? (
                    <>
                      <span
                        className={`size-2 rounded-sm ${levelDot(selectedLog.level)}`}
                        aria-hidden="true"
                      />
                      {selectedLog.level.toLowerCase()}
                    </>
                  ) : null}
                </p>
              </div>
              <div>
                <div className="text-[11px] font-medium text-ink-muted">Source</div>
                <p className="mt-1 break-all font-mono text-xs text-ink">
                  {selectedLog?.source}
                </p>
              </div>
              <div>
                <div className="text-[11px] font-medium text-ink-muted">
                  Dispatched by
                </div>
                <p className="mt-1 text-xs text-ink">
                  {selectedLog?.actor ?? "system"}
                </p>
              </div>
              <div>
                <div className="text-[11px] font-medium text-ink-muted">Job</div>
                <p className="mt-1 font-mono text-xs text-ink">
                  {selectedLog?.job_id ? `#${selectedLog.job_id}` : "—"}
                </p>
              </div>
            </div>

            <Card className="flex max-h-[min(80rem,80vh)] min-w-0 flex-col overflow-hidden border-0 p-0">
              <CardBody className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-4">
                <pre
                  className={cn(
                    "min-h-0 flex-1 overflow-y-auto font-mono text-xs leading-5 text-ink",
                    wrapDetail
                      ? "whitespace-pre-wrap break-words"
                      : "whitespace-pre overflow-x-auto",
                  )}
                >
                  {formatContext(selectedDetail) ?? selectedDetail}
                </pre>
              </CardBody>
              <CardFooter className="flex items-center justify-between gap-3 bg-surface-muted px-4 py-2 text-xs font-medium text-ink-muted">
                <span>Message</span>
                <label className="flex items-center gap-2">
                  <span>Wrap</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={wrapDetail}
                    aria-label="Toggle text wrapping"
                    onClick={() => setWrapDetail((current) => !current)}
                    className={cn(
                      "relative h-5 w-9 shrink-0 rounded-full border transition-colors duration-150 ease-in-out",
                      wrapDetail
                        ? "border-brand bg-brand"
                        : "border-line bg-line",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all duration-150 ease-in-out",
                        wrapDetail
                          ? "left-[18px] bg-brand-ink shadow-none"
                          : "left-0.5 bg-surface shadow-card",
                      )}
                    />
                  </button>
                </label>
              </CardFooter>
            </Card>

            {selectedLog?.context ? (
              <Card className="flex max-h-[min(80rem,80vh)] min-w-0 flex-col overflow-hidden border-0 p-0">
                <CardBody className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-4">
                  <pre className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap break-words font-mono text-xs leading-5 text-ink">
                    {formatContext(selectedLog.context)}
                  </pre>
                </CardBody>
                <CardFooter className="bg-surface-muted px-4 py-2 text-xs font-medium text-ink-muted">
                  Context
                </CardFooter>
              </Card>
            ) : null}
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </div>
  )
}
