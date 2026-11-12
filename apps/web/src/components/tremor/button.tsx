// Tremor Button [v0.2.0]
// Vendored from tremorlabs/template-overview, light presentation.
import { Slot } from "@radix-ui/react-slot"
import { RiLoader2Fill } from "@remixicon/react"
import { forwardRef, type ComponentPropsWithoutRef } from "react"
import { tv, type VariantProps } from "tailwind-variants"
import { cn } from "../../lib/format"

const buttonVariants = tv({
  base: "relative inline-flex items-center justify-center whitespace-nowrap rounded-md border px-3 py-2 text-center text-sm font-medium shadow-sm outline outline-offset-2 outline-0 transition-all duration-100 ease-in-out focus-visible:outline-2 focus-visible:outline-gray-900 disabled:pointer-events-none disabled:shadow-none",
  variants: {
    variant: {
      primary: "border-transparent bg-brand text-brand-ink hover:bg-brand/90 disabled:bg-gray-300",
      secondary: "border-gray-300 text-gray-900 bg-white hover:bg-gray-50 disabled:text-gray-400",
      light: "border-transparent text-gray-900 bg-gray-200 shadow-none hover:bg-gray-300/70 disabled:bg-gray-100 disabled:text-gray-400",
      ghost: "border-transparent text-gray-900 bg-transparent shadow-none hover:bg-gray-100 disabled:text-gray-400",
      destructive: "border-transparent bg-gray-700 text-white hover:bg-gray-800 disabled:bg-gray-300",
      danger: "border-transparent bg-gray-700 text-white hover:bg-gray-800 disabled:bg-gray-300",
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
            <RiLoader2Fill className="mr-2 size-4 shrink-0 animate-spin" aria-hidden="true" />
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
