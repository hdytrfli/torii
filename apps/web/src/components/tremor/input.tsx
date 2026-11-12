// Tremor Raw Input [v1.0.3]
import { Eye, EyeOff, Search } from "lucide-react"
import { forwardRef, useState, type InputHTMLAttributes } from "react"
import { tv, type VariantProps } from "tailwind-variants"
import { cn } from "../../lib/format"

const focusInput = "focus:border-gray-900 focus:ring-2 focus:ring-gray-200"
const hasErrorInput = "border-red-500 ring-2 ring-red-200"

const inputStyles = tv({
  base: [
    "relative block w-full min-w-0 appearance-none truncate rounded-md border px-2.5 py-2 shadow-sm outline-none transition sm:text-sm",
    "border-gray-300 text-gray-900 placeholder-gray-400 bg-white",
    "disabled:border-gray-300 disabled:bg-gray-100 disabled:text-gray-400",
    "file:-my-2 file:-ml-2.5 file:cursor-pointer file:rounded-l-[5px] file:rounded-r-none file:border-0 file:px-3 file:py-2 file:outline-none file:border-solid file:border-gray-300 file:bg-gray-50 file:text-gray-500 file:hover:bg-gray-100",
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
          <div className="pointer-events-none absolute bottom-0 left-2 flex h-full items-center justify-center text-gray-400">
            <Search className="size-[1.125rem] shrink-0" aria-hidden="true" />
          </div>
        ) : null}
        {isPassword ? (
          <div className="absolute bottom-0 right-0 flex h-full items-center justify-center px-3">
            <button
              aria-label="Change password visibility"
              className="h-fit w-fit rounded-sm text-gray-400 outline-none transition-all hover:text-gray-500 focus-visible:outline-2 focus-visible:outline-gray-900"
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
