import { cn } from "../../lib/format"

export function ProgressBar({
  value,
  max = 100,
  className,
}: {
  value: number
  max?: number
  className?: string
}) {
  const safe = Math.min(max, Math.max(0, value))
  return (
    <div className={cn("relative flex h-2 w-full items-center rounded-full bg-line", className)}>
      <div
        className="h-full rounded-full bg-brand transition-all duration-300"
        style={{ width: `${max ? (safe / max) * 100 : safe}%` }}
      />
    </div>
  )
}
