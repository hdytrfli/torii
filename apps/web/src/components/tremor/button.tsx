// Tremor Button [v0.2.0]
// Vendored from tremorlabs/template-overview, light presentation.
import { Slot } from "@radix-ui/react-slot"
import { Loader } from "lucide-react"
import { forwardRef, type ComponentPropsWithoutRef } from "react"
import { tv, type VariantProps } from "tailwind-variants"
import { cn } from "../../lib/format"

const buttonVariants = tv({
  base: "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border px-3 py-2 text-center text-sm font-medium shadow-card transition-colors duration-100 ease-in-out disabled:pointer-events-none disabled:shadow-none",
  variants: {
    variant: {
      primary: "border-transparent bg-brand text-brand-ink hover:bg-brand/90 disabled:bg-line",
      secondary: "border-line text-ink bg-surface hover:bg-surface-muted disabled:text-ink-muted/70",
      light: "border-transparent text-ink bg-line shadow-none hover:bg-line/70 disabled:bg-surface-muted disabled:text-ink-muted/70",
      ghost: "border-transparent text-ink bg-transparent shadow-none hover:bg-surface-muted disabled:text-ink-muted/70",
      destructive: "border-transparent bg-danger text-brand-ink hover:bg-danger/90 disabled:bg-line",
      danger: "border-transparent bg-danger text-brand-ink hover:bg-danger/90 disabled:bg-line",
    },
    size: {
      md: "",
      sm: "px-2 py-1 text-xs",
    },
  },
  defaultVariants: {
    variant: "primary",
    size: "md",
  },
})

type ButtonProps = ComponentPropsWithoutRef<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    isLoading?: boolean
    loadingText?: string
  }

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      asChild,
      isLoading = false,
      loadingText,
      className,
      disabled,
      variant,
      size,
      children,
      ...props
    },
    ref,
  ) => {
    const Component = asChild ? Slot : "button"
    return (
      <Component
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || isLoading}
        tremor-id="tremor-raw"
        {...props}
      >
        {isLoading ? (
          <>
            <Loader className="size-4 shrink-0 animate-spin" aria-hidden="true" />
            {loadingText ?? "Loading..."}
          </>
        ) : (
          children
        )}
      </Component>
    )
  },
)
Button.displayName = "Button"
export { buttonVariants }
