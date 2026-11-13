import { type ReactNode } from "react"
import { AlertCircle, CircleCheck, Info, TriangleAlert } from "lucide-react"
import { cn, sourceLabel, statusLabel } from "../lib/format"
import type { Source } from "../lib/types"
import { Badge } from "./tremor/badge"
import { Checkbox } from "./tremor/checkbox"
import { Input } from "./tremor/input"
import { Button } from "./tremor/button"
import { Card, CardBody, CardFooter } from "./tremor/card"

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
      ? "bg-danger"
      : level === "medium"
        ? "bg-success"
        : level === "low"
          ? "bg-warning"
          : "bg-ink-muted"
  return (
    <Badge variant="neutral" className="gap-1.5 font-normal capitalize text-ink">
      <span className={`size-2 shrink-0 rounded-sm ${dot}`} aria-hidden="true" />
      {label}
    </Badge>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const dot =
    status === "ready"
      ? "bg-success"
      : status === "needs_review"
        ? "bg-warning"
        : status === "waiting_revert"
          ? "bg-pending"
          : status === "failed" || status === "rejected"
            ? "bg-danger"
            : "bg-ink-muted"
  return (
    <span className="inline-flex items-center gap-1.5 text-xs capitalize text-ink-muted">
      <span className={`size-2 shrink-0 rounded-sm ${dot}`} aria-hidden="true" />
      {statusLabel(status)}
    </span>
  )
}

export function SourceBadge({ source }: { source: Source }) {
  const dot =
    source === "jellyfin"
      ? "bg-success"
      : source === "nfo"
        ? "bg-info"
        : source === "llm"
          ? "bg-warning"
          : "bg-ink-muted"
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
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
    <Card className="overflow-hidden border-0 p-0">
      <CardBody className="px-4 pb-5 pt-4">
        <div className="text-sm font-semibold text-ink">{label}</div>
        {hint ? <p className="mt-1 text-sm leading-6 text-ink-muted">{hint}</p> : null}
      </CardBody>
      <CardFooter className="flex items-center justify-between bg-surface-muted px-4 py-3">
        <span className="text-xs font-medium text-ink-muted">
          {checked ? "Enabled" : "Disabled"}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          className={cn(
            "relative h-5 w-9 shrink-0 rounded-full border transition-colors duration-150 ease-in-out",
            checked ? "border-brand bg-brand" : "border-line bg-line",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all duration-150 ease-in-out",
              checked ? "left-[18px] bg-brand-ink shadow-none" : "left-0.5 bg-surface shadow-card",
            )}
          />
        </button>
      </CardFooter>
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
        "relative h-5 w-9 shrink-0 rounded-full border transition-colors duration-150 ease-in-out disabled:pointer-events-none disabled:opacity-50",
        checked ? "border-brand bg-brand" : "border-line bg-line",
        className,
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all duration-150 ease-in-out",
          checked ? "left-[18px] bg-brand-ink shadow-none" : "left-0.5 bg-surface shadow-card",
        )}
      />
    </button>
  )
}

export function Alert({
  variant = "neutral",
  title,
  children,
  className,
}: {
  variant?: "neutral" | "error" | "warning" | "info" | "success"
  title?: ReactNode
  children: ReactNode
  className?: string
}) {
  const Icon =
    variant === "success"
      ? CircleCheck
      : variant === "warning"
        ? TriangleAlert
        : variant === "info" || variant === "neutral"
          ? Info
          : AlertCircle
  const footer =
    variant === "success"
      ? "border-success/40 bg-success-soft text-success"
      : variant === "warning"
        ? "border-warning/40 bg-warning-soft text-warning"
        : variant === "info"
          ? "border-info/40 bg-info-soft text-info"
          : variant === "neutral"
            ? "border-line bg-surface-muted text-ink-muted"
            : "border-danger/40 bg-danger-soft text-danger"
  const label =
    variant === "success"
      ? "Success"
      : variant === "warning"
        ? "Warning"
        : variant === "info"
          ? "Info"
          : variant === "neutral"
            ? "Notice"
            : "Error"

  return (
    <div
      role="alert"
      className={cn(
        "overflow-hidden rounded-card bg-surface text-left shadow-card",
        className,
      )}
    >
      <div className="rounded-t-card border border-b-0 border-line px-4 py-3 text-xs">
        {title ? (
          <div className="font-medium text-ink">{title}</div>
        ) : null}
        <div className={cn("text-ink-muted", title && "mt-1")}>{children}</div>
      </div>
      <div
        className={cn(
          "flex items-center gap-1.5 rounded-b-card border px-4 py-2 text-xs font-medium",
          footer,
        )}
      >
        <Icon className="size-3.5 shrink-0" aria-hidden="true" />
        {label}
      </div>
    </div>
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
      <div className="text-xs font-medium text-ink-muted">{label}</div>
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
