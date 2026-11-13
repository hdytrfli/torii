import { Link, Outlet, useLocation } from "react-router-dom"
import { TabNavigation, TabNavigationLink } from "./tremor/tab-navigation"
import { useAuth } from "../lib/auth"
import { PageHeader } from "./page-header"

const tabs: Array<{
  to: string
  label: string
  end?: boolean
  admin?: boolean
}> = [
  { to: "/settings", label: "General", end: true, admin: true },
  { to: "/settings/shortcuts", label: "Shortcuts", admin: true },
  { to: "/settings/users", label: "Users", admin: true },
]

export function SettingsLayout() {
  const { user } = useAuth()
  const location = useLocation()

  return (
    <div className="max-w-5xl">
      <PageHeader
        eyebrow="Settings"
        title="Configure torii."
        description="Scanning, apply behavior, shortcuts, and account access."
      />
      <TabNavigation className="mt-6" aria-label="Settings sections">
        {tabs
          .filter((tab) => !tab.admin || user?.is_admin)
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
