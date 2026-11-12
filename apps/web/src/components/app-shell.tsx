import {
  RiHome2Line,
  RiListCheck,
  RiSettings5Line,
  RiTeamLine,
  RiLogoutBoxRLine,
  RiArrowDownSLine,
} from "@remixicon/react"
import { NavLink, Outlet, useNavigate } from "react-router-dom"
import { useAuth } from "../lib/auth"
import { cn } from "../lib/format"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./tremor/dropdown"

const navigation = [
  { name: "Overview", href: "/", icon: RiHome2Line, end: true },
  { name: "Review queue", href: "/queue", icon: RiListCheck },
  { name: "Settings", href: "/settings", icon: RiSettings5Line },
  { name: "Users", href: "/users", icon: RiTeamLine, admin: true },
]

const shortcuts = [
  { name: "Review queue", href: "/queue", icon: RiListCheck },
  { name: "Add new user", href: "/users", icon: RiTeamLine, admin: true },
  { name: "Naming layouts", href: "/settings", icon: RiSettings5Line },
]

export function AppShell() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="mx-auto min-h-screen max-w-screen-2xl bg-white">
      <nav className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
        <aside className="flex grow flex-col gap-y-6 overflow-y-auto border-r border-gray-200 bg-white p-4">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-gray-100"
          >
            <span className="flex size-9 items-center justify-center rounded-md bg-gray-900 text-sm font-semibold text-white">
              T
            </span>
            <span>
              <span className="block text-sm font-semibold text-gray-900">torii</span>
              <span className="block text-xs text-gray-500">media workspace</span>
            </span>
            <RiArrowDownSLine className="ml-auto size-4 text-gray-400" />
          </button>

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
                          isActive ? "text-indigo-600" : "text-gray-700 hover:text-gray-900",
                          "flex items-center gap-x-2.5 rounded-md px-2 py-1.5 text-sm font-medium transition hover:bg-gray-100",
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
              <span className="px-2 text-xs font-medium leading-6 text-gray-500">Shortcuts</span>
              <ul aria-label="shortcuts" role="list" className="mt-1 space-y-0.5">
                {shortcuts
                  .filter((item) => !item.admin || user?.is_admin)
                  .map((item) => (
                    <li key={item.name}>
                      <NavLink
                        to={item.href}
                        className="flex items-center gap-x-2.5 rounded-md px-2 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100 hover:text-gray-900"
                      >
                        <item.icon className="size-4 shrink-0" aria-hidden="true" />
                        {item.name}
                      </NavLink>
                    </li>
                  ))}
              </ul>
            </div>
          </nav>

          <div className="mt-auto border-t border-gray-200 pt-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-gray-100">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-white text-xs font-medium uppercase text-gray-700">
                    {user?.username.slice(0, 2)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-gray-900">
                      {user?.username}
                    </span>
                    <span className="block text-xs text-gray-500">
                      {user?.is_admin ? "Administrator" : "Reviewer"}
                    </span>
                  </span>
                  <RiArrowDownSLine className="size-4 text-gray-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Signed in as {user?.username}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => navigate("/settings")}>Settings</DropdownMenuItem>
                {user?.is_admin ? (
                  <DropdownMenuItem onSelect={() => navigate("/users")}>Users</DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void logout()}>
                  <RiLogoutBoxRLine className="mr-2 size-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </aside>
      </nav>

      <div className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 shadow-sm lg:hidden">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-md bg-gray-900 text-xs font-semibold text-white">
            T
          </span>
          <span className="text-sm font-semibold text-gray-900">torii</span>
        </div>
        <nav className="flex items-center gap-2">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              end={item.end}
              className={({ isActive }) =>
                cn("rounded-md px-2 py-1 text-xs font-medium", isActive ? "text-indigo-600" : "text-gray-600")
              }
            >
              {item.name}
            </NavLink>
          ))}
        </nav>
      </div>

      <main className="lg:pl-72">
        <div className="p-4 sm:px-6 sm:pb-10 sm:pt-10 lg:px-10 lg:pt-7">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
