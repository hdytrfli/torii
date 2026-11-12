// Ported from tremorlabs/template-overview, MIT.
// Tokenized for torii's light-first CSS variables.
import { forwardRef, type HTMLAttributes } from "react"
import { cn } from "../../lib/format"

export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "relative w-full rounded-card border border-line bg-surface p-6 text-left shadow-card",
        className,
      )}
      tremor-id="tremor-raw"
      {...props}
    />
  ),
)
Card.displayName = "Card"
