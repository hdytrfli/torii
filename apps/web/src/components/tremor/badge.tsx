// Ported from tremorlabs/template-overview, MIT.
// Tokenized for torii's light-first CSS variables.
import { forwardRef, type HTMLAttributes, type ReactNode } from "react"
import { cn } from "../../lib/format"

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info"

const tones: Record<BadgeTone, string> = {
  neutral: "bg-surface-muted text-ink-muted ring-line",
  success: "bg-success-soft text-success ring-success/20",
  warning: "bg-warning-soft text-warning ring-warning/25",
  danger: "bg-danger-soft text-danger ring-danger/20",
  info: "bg-info-soft text-info ring-info/20",
}

export const Badge = forwardRef<
  HTMLSpanElement,
  HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone; children: ReactNode }
>(({ className, tone = "neutral", ...props }, ref) => (
  <span
    ref={ref}
    className={cn(
      "inline-flex items-center gap-x-1 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset",
      tones[tone],
      className,
    )}
    tremor-id="tremor-raw"
    {...props}
  />
))
Badge.displayName = "Badge"
