// Tremor Raw Input [v1.0.3]
import { Eye, EyeOff, Search } from "lucide-react"
import { forwardRef, useState, type InputHTMLAttributes } from "react"
import { tv, type VariantProps } from "tailwind-variants"
import { cn } from "../../lib/format"

const focusInput = ""
const hasErrorInput = "border-danger ring-2 ring-danger/30"

const inputStyles = tv({
  base: [
    "relative block w-full min-w-0 appearance-none truncate rounded-md border px-2.5 py-2 shadow-card transition sm:text-sm",
    "border-line text-ink placeholder:text-ink-muted/70 bg-surface",
    "disabled:border-line disabled:bg-surface-muted disabled:text-ink-muted/70",
    "file:-my-2 file:-ml-2.5 file:cursor-pointer file:rounded-l-[5px] file:rounded-r-none file:border-0 file:px-3 file:py-2 file:outline-none file:border-solid file:border-line file:bg-surface-muted file:text-ink-muted file:hover:bg-surface-muted",
    focusInput,
    "[&::--webkit-search-cancel-button]:hidden [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden",
  ],
  variants: {
    hasError: { true: hasErrorInput },
    enableStepper: {
      false: "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
    },
  },
})

type InputProps = InputHTMLAttributes<HTMLInputElement> &
  VariantProps<typeof inputStyles> & { inputClassName?: string }

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, inputClassName, hasError, enableStepper = true, type, ...props }, ref) => {
    const [typeState, setTypeState] = useState(type)
    const isPassword = type === "password"
    const isSearch = type === "search"
    return (
      <div className={cn("relative w-full", className)}>
        <input
          ref={ref}
          type={isPassword ? typeState : type}
          className={cn(
            inputStyles({ hasError, enableStepper }),
            { "pl-8": isSearch, "pr-10": isPassword },
            inputClassName,
          )}
          {...props}
        />
        {isSearch ? (
          <div className="pointer-events-none absolute bottom-0 left-2 flex h-full items-center justify-center text-ink-muted/70">
            <Search className="size-[1.125rem] shrink-0" aria-hidden="true" />
          </div>
        ) : null}
        {isPassword ? (
          <div className="absolute bottom-0 right-0 flex h-full items-center justify-center px-3">
            <button
              aria-label="Change password visibility"
              className="h-fit w-fit rounded-sm text-ink-muted/70 transition-all hover:text-ink-muted"
              type="button"
              onClick={() => setTypeState(typeState === "password" ? "text" : "password")}
            >
              <span className="sr-only">{typeState === "password" ? "Show password" : "Hide password"}</span>
              {typeState === "password" ? (
                <Eye aria-hidden="true" className="size-5 shrink-0" />
              ) : (
                <EyeOff aria-hidden="true" className="size-5 shrink-0" />
              )}
            </button>
          </div>
        ) : null}
      </div>
    )
  },
)
Input.displayName = "Input"
