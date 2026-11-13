import {
  ChevronDown,
  Home,
  Landmark,
  Link2,
  ListChecks,
  LogOut,
  Moon,
  ScrollText,
  Settings,
  Sun,
  Tags,
  type LucideIcon,
} from "lucide-react"
import { Suspense, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom"
import { useAuth } from "../lib/auth"
import { api } from "../lib/api"
import { cn } from "../lib/format"
import { useServerEvents } from "../lib/server-events"
import { useTheme } from "../lib/theme"
import { RouteSkeleton } from "./loading"
import { QueueStatus } from "./queue-status"
import { Switch } from "./ui"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./tremor/dropdown"

const navigation: Array<{
  name: string
  href: string
  icon: LucideIcon
  end?: boolean
  admin?: boolean
}> = [
  { name: "Overview", href: "/", icon: Home, end: true },
  { name: "Review queue", href: "/review", icon: ListChecks },
  { name: "Naming rules", href: "/naming", icon: Tags },
  { name: "Activity log", href: "/logs", icon: ScrollText, admin: true },
  { name: "Settings", href: "/settings", icon: Settings, admin: true },
]

export function AppShell() {
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  useServerEvents()
  const shortcutsQuery = useQuery({
    queryKey: ["shortcuts"],
    queryFn: api.shortcuts,
  })
  const shortcuts = (
    Array.isArray(shortcutsQuery.data) ? shortcutsQuery.data : []
  ).filter((shortcut) => !shortcut.admin_only || user?.is_admin)
  useEffect(() => {
    const title =
      location.pathname === "/" ? "Overview"
      : location.pathname.startsWith("/review") || location.pathname.startsWith("/queue")
        ? "Review queue"
      : location.pathname.startsWith("/naming") ? "Naming rules"
      : location.pathname.startsWith("/settings/shortcuts") ? "Shortcuts"
      : location.pathname.startsWith("/settings/users") ? "Users"
      : location.pathname.startsWith("/settings") ? "Settings"
      : location.pathname.startsWith("/logs") ? "Activity log"
      : "Torii"
    document.title = `${title} - Torii`
  }, [location.pathname])

  return (
    <div className="mx-auto min-h-screen max-w-screen-2xl">
      <nav className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
        <aside className="flex grow flex-col gap-y-6 overflow-y-auto border-r border-line bg-canvas p-4">
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <span className="flex size-9 items-center justify-center rounded-md bg-canvas text-ink">
              <Landmark className="size-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-ink">Torii</span>
              <span className="block text-xs text-ink-muted">media workspace</span>
            </span>
          </div>

          <nav aria-label="core navigation links" className="flex flex-1 flex-col space-y-10">
            <ul role="list" className="space-y-0.5">
              {navigation
                .filter((item) => !item.admin || user?.is_admin)
                .map((item) => (
                  <li key={item.name}>
                    <NavLink
                      to={item.href}
                      end={item.end}
                      className={({ isActive }) =>
                        cn(
                          isActive ? "text-ink" : "text-ink hover:text-ink",
                          "flex items-center gap-x-2.5 rounded-md px-2 py-1.5 text-sm font-medium transition hover:bg-surface-muted",
                        )
                      }
                    >
                      <item.icon className="size-4 shrink-0" aria-hidden="true" />
                      {item.name}
                    </NavLink>
                  </li>
                ))}
            </ul>
            <div>
              <span className="px-2 text-xs font-medium leading-6 text-ink-muted">Shortcuts</span>
              <ul aria-label="shortcuts" role="list" className="mt-1 space-y-0.5">
                {shortcuts.map((item) => {
                  const external =
                    item.url.startsWith("http://") ||
                    item.url.startsWith("https://")
                  const content = (
                    <>
                      <Link2 className="size-4 shrink-0" aria-hidden="true" />
                      {item.title}
                    </>
                  )
                  const className =
                    "flex items-center gap-x-2.5 rounded-md px-2 py-1.5 text-sm font-medium text-ink transition hover:bg-surface-muted hover:text-ink"
                  return (
                    <li key={item.id}>
                      {external ? (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className={className}
                        >
                          {content}
                        </a>
                      ) : (
                        <NavLink to={item.url} className={className}>
                          {content}
                        </NavLink>
                      )}
                    </li>
                  )
                })}
                {shortcuts.length === 0 ? (
                  <li className="px-2 py-1.5 text-xs text-ink-muted/70">
                    No shortcuts configured.
                  </li>
                ) : null}
              </ul>
            </div>
            <div>
              <span className="px-2 text-xs font-medium leading-6 text-ink-muted">
                Actions
              </span>
              <div className="mt-1 flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-ink">
                <span className="flex items-center gap-x-2.5">
                  {theme === "dark" ? (
                    <Moon className="size-4 shrink-0" aria-hidden="true" />
                  ) : (
                    <Sun className="size-4 shrink-0" aria-hidden="true" />
                  )}
                  Dark mode
                </span>
                <Switch
                  checked={theme === "dark"}
                  onChange={(checked) => setTheme(checked ? "dark" : "light")}
                />
              </div>
            </div>
          </nav>

          <div className="mt-auto space-y-3">
            <QueueStatus />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-surface-muted">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-xs font-medium uppercase text-ink">
                    {user?.username.slice(0, 2)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">
                      {user?.username}
                    </span>
                    <span className="block text-xs text-ink-muted">
                      {user?.is_admin ? "Administrator" : "Reviewer"}
                    </span>
                  </span>
                  <ChevronDown className="size-4 text-ink-muted/70" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Signed in as {user?.username}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {user?.is_admin ? (
                  <DropdownMenuItem onSelect={() => navigate("/settings")}>
                    Settings
                  </DropdownMenuItem>
                ) : null}
                {user?.is_admin ? (
                  <DropdownMenuItem onSelect={() => navigate("/users")}>
                    Users
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void logout()}>
                  <LogOut className="mr-2 size-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </aside>
      </nav>

      <div className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-line bg-canvas px-4 shadow-card lg:hidden">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-md bg-canvas text-xs font-semibold text-ink">
            T
          </span>
          <span className="text-sm font-semibold text-ink">torii</span>
        </div>
        <nav className="flex items-center gap-2">
          {navigation
            .filter((item) => !item.admin || user?.is_admin)
            .map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                end={item.end}
                className={({ isActive }) =>
                  cn("rounded-md px-2 py-1 text-xs font-medium", isActive ? "text-ink" : "text-ink-muted")
                }
              >
                {item.name}
              </NavLink>
            ))}
        </nav>
      </div>

      <main className="lg:pl-72">
        <div className="p-4 sm:px-6 sm:pb-10 sm:pt-10 lg:px-10 lg:pt-7">
          <Suspense fallback={<RouteSkeleton />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
    </div>
  )
}
