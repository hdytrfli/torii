import {
  Clapperboard,
  LayoutDashboard,
  Layers3,
  LogOut,
  RefreshCw,
  Settings,
  Users,
} from "lucide-react"
import { NavLink, Outlet, useLocation } from "react-router-dom"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "../lib/api"
import { useAuth } from "../lib/auth"
import { cn } from "../lib/format"
import { Button } from "./ui"

const nav = [
  { to: "/", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/queue", label: "Review queue", icon: Layers3 },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/users", label: "Users", icon: Users, admin: true },
]

const titles: Record<string, string> = {
  "/": "Overview",
  "/queue": "Review queue",
  "/settings": "Settings",
  "/users": "Users",
}

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

  return (
    <div className="min-h-screen bg-canvas">
      <aside className="fixed inset-y-0 left-0 hidden w-sidebar flex-col border-r border-line bg-surface px-3 py-4 lg:flex">
        <div className="flex items-center gap-2 px-2 pb-6">
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

        <nav className="flex flex-1 flex-col gap-1">
          {nav
            .filter((item) => !item.admin || user?.is_admin)
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2.5 rounded-control px-2.5 py-2 text-[13px] font-medium transition-colors",
                    isActive
                      ? "bg-brand text-brand-ink"
                      : "text-ink-muted hover:bg-surface-muted hover:text-ink",
                  )
                }
              >
                <item.icon size={16} strokeWidth={1.8} />
                {item.label}
              </NavLink>
            ))}
        </nav>

        <div className="mt-4 border-t border-line pt-3">
          <div className="px-2.5 pb-2">
            <div className="truncate text-xs font-medium text-ink">{user?.username}</div>
            <div className="text-[10px] text-ink-muted">
              {user?.is_admin ? "Administrator" : "Reviewer"}
            </div>
          </div>
          <button
            onClick={() => void logout()}
            className="flex w-full items-center gap-2.5 rounded-control px-2.5 py-2 text-[13px] text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
          >
            <LogOut size={16} strokeWidth={1.8} />
            Sign out
          </button>
        </div>
      </aside>

      <div className="lg:pl-sidebar">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-line bg-canvas/90 px-4 backdrop-blur lg:px-8">
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-ink-muted">
              Torii
            </div>
            <h1 className="text-base font-semibold tracking-tight text-ink">
              {titles[location.pathname] ?? "Review"}
            </h1>
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
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={() => void logout()}
            >
              <LogOut size={14} />
            </Button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
