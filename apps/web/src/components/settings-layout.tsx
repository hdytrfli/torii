import { Link, Outlet, useLocation } from "react-router-dom"
import { TabNavigation, TabNavigationLink } from "./tremor/tab-navigation"
import { useAuth } from "../lib/auth"
import { PageHeader } from "./page-header"

const tabs = [
  { to: "/settings", label: "General", end: true },
  { to: "/settings/users", label: "Users" },
]

export function SettingsLayout() {
  const { user } = useAuth()
  const location = useLocation()

  return (
    <div className="max-w-5xl">
      <PageHeader
        eyebrow="Settings"
        title="Configure torii."
        description="Scanning, apply behavior, and account access."
      />
      <TabNavigation className="mt-6" aria-label="Settings sections">
        {tabs
          .filter((tab) => tab.label !== "Users" || user?.is_admin)
          .map((tab) => (
            <TabNavigationLink
              key={tab.to}
              active={location.pathname === tab.to}
              asChild
            >
              <Link to={tab.to}>{tab.label}</Link>
            </TabNavigationLink>
          ))}
      </TabNavigation>
      <div className="pt-8">
        <Outlet />
      </div>
    </div>
  )
}
