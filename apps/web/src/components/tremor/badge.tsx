// Tremor Badge [v0.0.1]
// Vendored from tremorlabs/template-overview. Light presentation only.
import { forwardRef, type ComponentPropsWithoutRef } from "react"
import { tv, type VariantProps } from "tailwind-variants"
import { cn } from "../../lib/format"

const badgeVariants = tv({
  base: "inline-flex items-center gap-x-1 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset",
  variants: {
    variant: {
      default: "bg-gray-900 text-white ring-gray-900",
      neutral: "bg-gray-50 text-gray-900 ring-gray-500/30",
      success: "bg-white text-gray-900 ring-gray-400/50",
      error: "bg-gray-100 text-gray-900 ring-gray-500/40",
      warning: "bg-gray-50 text-gray-700 ring-gray-300",
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
