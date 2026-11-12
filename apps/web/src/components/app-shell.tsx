import { Clapperboard, LogOut, RefreshCw } from "lucide-react"
import { NavLink, Outlet, useLocation } from "react-router-dom"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "../lib/api"
import { useAuth } from "../lib/auth"
import { cn } from "../lib/format"
import { Button } from "./ui"

const tabs = [
  { to: "/", label: "Overview", end: true },
  { to: "/queue", label: "Review queue" },
  { to: "/settings", label: "Settings" },
  { to: "/users", label: "Users", admin: true },
]

export function AppShell() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const queryClient = useQueryClient()
  const scan = useMutation({
    mutationFn: api.scan,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["groups"] })
      void queryClient.invalidateQueries({ queryKey: ["jobs"] })
      void queryClient.invalidateQueries({ queryKey: ["stats"] })
    },
  })

  const current = tabs.find((tab) => tab.to === location.pathname)?.label ?? "Review"

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 shadow-card backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 pt-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-control bg-brand text-brand-ink">
              <Clapperboard size={16} />
            </span>
            <div>
              <div className="text-sm font-semibold tracking-tight text-ink">torii</div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-ink-muted">
                media gateway
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => scan.mutate()}
              disabled={scan.isPending}
            >
              <RefreshCw size={14} className={scan.isPending ? "animate-spin" : ""} />
              Scan now
            </Button>
            <div className="hidden items-center gap-2 border-l border-line pl-3 sm:flex">
              <div className="text-right">
                <div className="text-xs font-medium text-ink">{user?.username}</div>
                <div className="text-[10px] text-ink-muted">
                  {user?.is_admin ? "Administrator" : "Reviewer"}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => void logout()}>
                <LogOut size={14} />
              </Button>
            </div>
          </div>
        </div>

        <div className="mx-auto mt-4 flex max-w-7xl items-center gap-1 overflow-x-auto px-4 sm:px-6">
          <nav className="flex min-w-max items-center">
            {tabs
              .filter((tab) => !tab.admin || user?.is_admin)
              .map((tab) => (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  end={tab.end}
                  className={({ isActive }) =>
                    cn(
                      "relative flex shrink-0 items-center justify-center border-b-2 px-3 pb-2 text-sm font-medium transition-colors",
                      isActive
                        ? "border-brand text-ink"
                        : "border-transparent text-ink-muted hover:border-line hover:text-ink",
                    )
                  }
                >
                  {tab.label}
                </NavLink>
              ))}
          </nav>
          <div className="ml-auto hidden pb-2 text-[11px] text-ink-muted sm:block">
            {current}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
        <Outlet />
      </main>
    </div>
  )
}
