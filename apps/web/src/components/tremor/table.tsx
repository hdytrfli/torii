// Tremor Table [v0.0.3]
// Vendored from tremorlabs/template-overview.
import { forwardRef, type ComponentPropsWithoutRef } from "react"
import { cn } from "../../lib/format"

export const Table = forwardRef<HTMLTableElement, ComponentPropsWithoutRef<"table">>(
  ({ className, ...props }, ref) => (
    <table
      ref={ref}
      tremor-id="tremor-raw"
      className={cn("w-full caption-bottom border-b border-line", className)}
      {...props}
    />
  ),
)
Table.displayName = "Table"

export const TableHead = forwardRef<HTMLTableSectionElement, ComponentPropsWithoutRef<"thead">>(
  ({ className, ...props }, ref) => <thead ref={ref} className={cn(className)} {...props} />,
)
TableHead.displayName = "TableHead"

export const TableBody = forwardRef<HTMLTableSectionElement, ComponentPropsWithoutRef<"tbody">>(
  ({ className, ...props }, ref) => (
    <tbody ref={ref} className={cn("divide-y divide-line", className)} {...props} />
  ),
)
TableBody.displayName = "TableBody"

export const TableRow = forwardRef<HTMLTableRowElement, ComponentPropsWithoutRef<"tr">>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        "h-10 [&_td:last-child]:pr-2 [&_th:last-child]:pr-2 [&_td:first-child]:pl-2 [&_th:first-child]:pl-2",
        className,
      )}
      {...props}
    />
  ),
)
TableRow.displayName = "TableRow"

export const TableHeaderCell = forwardRef<HTMLTableCellElement, ComponentPropsWithoutRef<"th">>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={cn("h-10 border-b border-line px-4 py-0 text-left text-sm font-semibold text-ink sm:text-xs", className)}
      {...props}
    />
  ),
)
TableHeaderCell.displayName = "TableHeaderCell"

export const TableCell = forwardRef<HTMLTableCellElement, ComponentPropsWithoutRef<"td">>(
  ({ className, ...props }, ref) => (
    <td ref={ref} className={cn("h-10 px-4 py-0 text-sm text-ink-muted", className)} {...props} />
  ),
)
TableCell.displayName = "TableCell"
