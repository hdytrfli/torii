import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react"
import { cn, sourceLabel, sourceTone, statusLabel } from "../lib/format"
import type { Source } from "../lib/types"
import { Badge } from "./tremor/badge"
import { Card } from "./tremor/card"

export { Badge, Card }

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger"
  size?: "sm" | "md"
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-control border font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
        size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm",
        variant === "primary" && "border-brand bg-brand text-brand-ink hover:bg-brand/90",
        variant === "secondary" && "border-line bg-surface text-ink hover:bg-surface-muted",
        variant === "ghost" && "border-transparent bg-transparent text-ink-muted hover:bg-surface-muted hover:text-ink",
        variant === "danger" && "border-danger/20 bg-danger-soft text-danger hover:bg-danger/10",
        className,
      )}
      {...props}
    />
  )
}

export function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "ready"
      ? "success"
      : status === "failed" || status === "rejected"
        ? "danger"
        : status === "needs_review"
          ? "warning"
          : "neutral"
  return <Badge tone={tone}>{statusLabel(status)}</Badge>
}

export function SourceBadge({ source }: { source: Source }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        sourceTone(source),
      )}
    >
      {sourceLabel(source)}
    </span>
  )
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-control border border-line bg-surface px-3 text-sm text-ink outline-none transition placeholder:text-ink-muted/70 focus:border-ink focus:ring-2 focus:ring-ink/10",
        className,
      )}
      {...props}
    />
  )
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-10 w-full rounded-control border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-ink focus:ring-2 focus:ring-ink/10",
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
      <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-muted">{label}</div>
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

export function SourceLegend() {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-muted">
      <span>Match source:</span>
      {(["jellyfin", "guessit", "nfo", "llm", "manual"] as Source[]).map((source) => (
        <SourceBadge key={source} source={source} />
      ))}
    </div>
  )
}
