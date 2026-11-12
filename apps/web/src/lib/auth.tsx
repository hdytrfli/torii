import { useEffect, type ReactNode } from "react"
import { useAuthStore } from "../stores/auth-store"

export function AuthProvider({ children }: { children: ReactNode }) {
  const hydrate = useAuthStore((state) => state.hydrate)
  const clear = useAuthStore((state) => state.clear)

  useEffect(() => {
    void hydrate()
    const onUnauthorized = () => clear()
    window.addEventListener("torii:unauthorized", onUnauthorized)
    return () => window.removeEventListener("torii:unauthorized", onUnauthorized)
  }, [hydrate, clear])

  return <>{children}</>
}

export function useAuth() {
  return useAuthStore()
}
