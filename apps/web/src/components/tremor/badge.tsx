// Tremor Badge [v0.0.1]
// Vendored from tremorlabs/template-overview. Light presentation only.
import { forwardRef, type ComponentPropsWithoutRef } from "react"
import { tv, type VariantProps } from "tailwind-variants"
import { cn } from "../../lib/format"

const badgeVariants = tv({
  base: "inline-flex items-center gap-x-1 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset",
  variants: {
    variant: {
      default: "bg-brand/10 text-ink ring-brand/20",
      primary: "bg-brand text-brand-ink ring-brand/30",
      neutral: "bg-surface-muted text-ink ring-line",
      success: "bg-success-soft text-success ring-success/30",
      error: "bg-danger-soft text-danger ring-danger/20",
      warning: "bg-warning-soft text-warning ring-warning/30",
    },
  },
  defaultVariants: {
    variant: "default",
  },
})

type BadgeProps = ComponentPropsWithoutRef<"span"> &
  VariantProps<typeof badgeVariants>

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(badgeVariants({ variant }), className)}
      tremor-id="tremor-raw"
      {...props}
    />
  ),
)
Badge.displayName = "Badge"
export { badgeVariants }
