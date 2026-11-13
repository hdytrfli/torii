import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import { AlertCircle, Check, Info, X } from "lucide-react"

type ToastVariant = "success" | "error" | "default"
type ToastInput = {
  title: string
  description?: string
  variant?: ToastVariant
}
type Toast = ToastInput & { id: number }

const ToastContext = createContext<(toast: ToastInput) => void>(() => {})

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null)

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3500)
    return () => window.clearTimeout(timer)
  }, [toast])

  return (
    <ToastContext.Provider
      value={(next) => setToast({ ...next, id: Date.now() })}
    >
      {children}
      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className="torii-toast fixed inset-x-0 bottom-8 z-[70] mx-auto flex w-fit max-w-[calc(100vw-2rem)] items-center gap-2.5 rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink shadow-lg shadow-black/10"
        >
          <span className="shrink-0">
            {toast.variant === "success" ? (
              <Check className="size-4 text-success" aria-hidden="true" />
            ) : toast.variant === "error" ? (
              <AlertCircle className="size-4 text-danger" aria-hidden="true" />
            ) : (
              <Info className="size-4 text-ink-muted" aria-hidden="true" />
            )}
          </span>
          <span className="min-w-0">
            <span className="block font-medium">{toast.title}</span>
            {toast.description ? (
              <span className="mt-0.5 block text-xs text-ink-muted">
                {toast.description}
              </span>
            ) : null}
          </span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="ml-2 rounded p-0.5 text-ink-muted transition hover:bg-surface-muted hover:text-ink"
            aria-label="Dismiss notification"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </ToastContext.Provider>
  )
}
