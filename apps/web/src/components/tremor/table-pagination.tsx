import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import { Button } from "./button"
import { DropdownSelect } from "./dropdown-select"

export function TablePagination({
  page,
  pages,
  total,
  pageSize,
  selectedCount = 0,
  onPage,
  onPageSizeChange,
}: {
  page: number
  pages: number
  total: number
  pageSize: number
  selectedCount?: number
  onPage: (page: number) => void
  onPageSizeChange?: (value: string) => void
}) {
  const first = total === 0 ? 0 : page * pageSize + 1
  const last = Math.min(total, (page + 1) * pageSize)

  const buttons = [
    { icon: ChevronsLeft, onClick: () => onPage(0), disabled: page === 0, label: "First page", mobile: "hidden sm:flex" },
    { icon: ChevronLeft, onClick: () => onPage(Math.max(0, page - 1)), disabled: page === 0, label: "Previous page", mobile: "flex" },
    { icon: ChevronRight, onClick: () => onPage(Math.min(pages - 1, page + 1)), disabled: page >= pages - 1, label: "Next page", mobile: "flex" },
    { icon: ChevronsRight, onClick: () => onPage(pages - 1), disabled: page >= pages - 1, label: "Last page", mobile: "hidden sm:flex" },
  ]

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm tabular-nums text-ink-muted">
        {selectedCount} of {total} row(s) selected.
        <span className="ml-4 hidden sm:inline">
          Showing <span className="font-medium text-ink">{first}-{last}</span> of{" "}
          <span className="font-medium text-ink">{total}</span>
        </span>
      </p>
      <div className="flex items-center gap-4">
        {onPageSizeChange ? (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-ink-muted">Rows</span>
            <DropdownSelect
              value={String(pageSize)}
              onChange={onPageSizeChange}
              className="w-20"
              options={[10, 20, 50, 100].map((value) => ({
                value: String(value),
                label: String(value),
              }))}
            />
          </div>
        ) : null}
        <div className="flex items-center gap-x-1.5">
          {buttons.map((button) => (
            <Button
              key={button.label}
              variant="secondary"
              className={button.mobile}
              onClick={button.onClick}
              disabled={button.disabled}
            >
              <span className="sr-only">{button.label}</span>
              <button.icon className="size-4 shrink-0" aria-hidden="true" />
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
