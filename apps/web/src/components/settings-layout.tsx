import { NavLink, Outlet } from "react-router-dom"
import { cn } from "../lib/format"
import { useAuth } from "../lib/auth"

const tabs = [
  { to: "/settings", label: "General", end: true },
  { to: "/settings/users", label: "Users" },
]

export function SettingsLayout() {
  const { user } = useAuth()

  return (
    <div className="max-w-5xl">
      <h1 className="text-lg font-semibold text-gray-900 sm:text-xl">Settings</h1>
      <nav className="mt-4 flex items-center gap-1 border-b border-gray-200 sm:mt-6" aria-label="Settings sections">
        {tabs
          .filter((tab) => tab.label !== "Users" || user?.is_admin)
          .map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                cn(
                  "border-b-2 px-3 pb-2 text-sm font-medium transition-colors",
                  isActive
                    ? "border-gray-900 text-gray-900"
                    : "border-transparent text-gray-500 hover:text-gray-900",
                )
              }
            >
              {tab.label}
            </NavLink>
          ))}
      </nav>
      <div className="pt-8">
        <Outlet />
      </div>
    </div>
  )
}
