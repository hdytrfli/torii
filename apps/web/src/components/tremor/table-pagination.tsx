import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import { Button } from "./button"

export function TablePagination({
  page,
  pages,
  total,
  pageSize,
  selectedCount = 0,
  onPage,
}: {
  page: number
  pages: number
  total: number
  pageSize: number
  selectedCount?: number
  onPage: (page: number) => void
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
    <div className="flex items-center justify-between">
      <p className="text-sm tabular-nums text-gray-500">
        {selectedCount} of {total} row(s) selected.
        <span className="ml-4 hidden sm:inline">
          Showing <span className="font-medium text-gray-900">{first}-{last}</span> of{" "}
          <span className="font-medium text-gray-900">{total}</span>
        </span>
      </p>
      <div className="flex items-center gap-x-1.5">
        {buttons.map((button) => (
          <Button
            key={button.label}
            variant="secondary"
            className={`${button.mobile} p-1.5`}
            onClick={button.onClick}
            disabled={button.disabled}
          >
            <span className="sr-only">{button.label}</span>
            <button.icon className="size-4 shrink-0" aria-hidden="true" />
          </Button>
        ))}
      </div>
    </div>
  )
}
