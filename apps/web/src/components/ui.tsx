import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react"
import { cn, sourceLabel, statusLabel } from "../lib/format"
import type { Source } from "../lib/types"
import { Badge } from "./tremor/badge"
import { Button } from "./tremor/button"
import { Card } from "./tremor/card"

export { Badge, Button, Card }

export function AssessedBadge({
  label,
  level = "medium",
}: {
  label: string
  level?: "high" | "medium" | "low" | "none"
}) {
  const dot =
    level === "high"
      ? "bg-red-500"
      : level === "medium"
        ? "bg-emerald-500"
        : level === "low"
          ? "bg-yellow-500"
          : "bg-gray-400"
  return (
    <Badge variant="neutral" className="gap-1.5 font-normal capitalize text-gray-700">
      <span className={`size-2 shrink-0 rounded-sm ${dot}`} aria-hidden="true" />
      {label}
    </Badge>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const dot =
    status === "ready"
      ? "bg-emerald-500"
      : status === "needs_review"
        ? "bg-yellow-500"
        : status === "failed" || status === "rejected"
          ? "bg-red-500"
          : "bg-gray-400"
  return (
    <span className="inline-flex items-center gap-1.5 text-xs capitalize text-gray-600">
      <span className={`size-2 shrink-0 rounded-sm ${dot}`} aria-hidden="true" />
      {statusLabel(status)}
    </span>
  )
}

export function SourceBadge({ source }: { source: Source }) {
  const level =
    source === "jellyfin" ? "medium" : source === "nfo" ? "high" : source === "llm" ? "low" : "none"
  return <AssessedBadge label={sourceLabel(source)} level={level} />
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-10 min-w-0 w-full rounded-control border border-line bg-surface px-3 text-sm text-ink outline-none transition placeholder:text-ink-muted/70 focus:border-ink focus:ring-2 focus:ring-ink/10",
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = "Input"

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-10 min-w-0 w-full rounded-control border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-ink focus:ring-2 focus:ring-ink/10",
        className,
      )}
      {...props}
    />
  )
}

export const Checkbox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      type="checkbox"
      className={cn(
        "h-4 w-4 rounded border-line text-brand accent-[rgb(var(--color-brand))]",
        className,
      )}
      {...props}
    />
  ),
)
Checkbox.displayName = "Checkbox"

export function Field({
  label,
  hint,
  children,
}: {
  label: ReactNode
  hint?: ReactNode
  children: ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-ink">{label}</span>
      {children}
      {hint ? <span className="text-[11px] leading-4 text-ink-muted">{hint}</span> : null}
    </label>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  hint?: string
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-control border border-line bg-surface px-3 py-3">
      <span>
        <span className="block text-sm font-medium text-ink">{label}</span>
        {hint ? <span className="mt-0.5 block text-[11px] text-ink-muted">{hint}</span> : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 h-5 w-9 shrink-0 rounded-full border transition-colors",
          checked ? "border-brand bg-brand" : "border-line bg-surface-muted",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-3.5 w-3.5 rounded-full bg-surface shadow-sm transition-transform",
            checked ? "left-[18px]" : "left-0.5",
          )}
        />
      </button>
    </label>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-line bg-surface px-6 py-16 text-center">
      <div className="text-base font-semibold text-ink">{title}</div>
      <p className="max-w-md text-sm text-ink-muted">{description}</p>
      {action}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-control bg-surface-muted", className)} />
}

export function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string
  value: number | string
  hint?: string
  accent?: "neutral" | "success" | "warning" | "danger"
}) {
  return (
    <Card className="p-4">
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div
        className={cn(
          "mt-2 text-3xl font-semibold tracking-tight",
          accent === "success" && "text-success",
          accent === "warning" && "text-warning",
          accent === "danger" && "text-danger",
          (!accent || accent === "neutral") && "text-ink",
        )}
      >
        {value}
      </div>
      {hint ? <div className="mt-1 text-xs text-ink-muted">{hint}</div> : null}
    </Card>
  )
}
