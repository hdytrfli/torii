import { type ReactNode } from "react"
import { cn, sourceLabel, statusLabel } from "../lib/format"
import type { Source } from "../lib/types"
import { Badge } from "./tremor/badge"
import { Checkbox } from "./tremor/checkbox"
import { Input } from "./tremor/input"
import { Button } from "./tremor/button"
import { Card } from "./tremor/card"

export { Badge, Button, Card, Checkbox, Input }

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
        : status === "waiting_revert"
          ? "bg-violet-500"
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
  const dot =
    source === "jellyfin"
      ? "bg-emerald-500"
      : source === "nfo"
        ? "bg-blue-500"
        : source === "llm"
          ? "bg-yellow-500"
          : "bg-gray-400"
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
      <span className={`size-2 shrink-0 rounded-sm ${dot}`} aria-hidden="true" />
      {sourceLabel(source)}
    </span>
  )
}

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
    <Card className="overflow-hidden p-0">
      <div className="px-4 pb-5 pt-4">
        <div className="text-sm font-semibold text-gray-900">{label}</div>
        {hint ? <p className="mt-1 text-sm leading-6 text-gray-500">{hint}</p> : null}
      </div>
      <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-4 py-3">
        <span className="text-xs font-medium text-gray-600">
          {checked ? "Enabled" : "Disabled"}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          className={cn(
            "relative h-5 w-9 shrink-0 rounded-full border transition-colors",
            checked ? "border-gray-900 bg-gray-900" : "border-gray-300 bg-gray-200",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow-card transition-transform",
              checked ? "left-[18px]" : "left-0.5",
            )}
          />
        </button>
      </div>
    </Card>
  )
}

export function Switch({
  checked,
  onChange,
  disabled = false,
  className,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-5 w-9 shrink-0 rounded-full border transition-colors disabled:pointer-events-none disabled:opacity-50",
        checked ? "border-gray-900 bg-gray-900" : "border-gray-300 bg-gray-200",
        className,
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow-card transition-transform",
          checked ? "left-[18px]" : "left-0.5",
        )}
      />
    </button>
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
