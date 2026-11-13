import { cn } from "../../lib/format"

export function Divider({ className }: { className?: string }) {
  return (
    <div
      className={cn("mx-auto my-6 flex w-full items-center justify-between gap-3 text-sm text-ink-muted", className)}
      tremor-id="tremor-raw"
    >
      <span className="h-px w-full bg-line" />
    </div>
  )
}
