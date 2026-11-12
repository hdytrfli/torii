// Tremor Badge [v0.0.1]
// Vendored from tremorlabs/template-overview. Light presentation only.
import { forwardRef, type ComponentPropsWithoutRef } from "react"
import { tv, type VariantProps } from "tailwind-variants"
import { cn } from "../../lib/format"

const badgeVariants = tv({
  base: "inline-flex items-center gap-x-1 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset",
  variants: {
    variant: {
      default: "bg-blue-50 text-blue-900 ring-blue-500/30",
      neutral: "bg-gray-50 text-gray-900 ring-gray-500/30",
      success: "bg-emerald-50 text-emerald-900 ring-emerald-600/30",
      error: "bg-red-50 text-red-900 ring-red-600/20",
      warning: "bg-yellow-50 text-yellow-900 ring-yellow-600/30",
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
