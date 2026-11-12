import { lazy } from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom"
import { NuqsAdapter } from "nuqs/adapters/react-router/v7"
import { AppShell } from "./components/app-shell"
import { AppLoading } from "./components/loading"
import { HoverPopoverProvider } from "./components/tremor/hover-popover"
import { ToastProvider } from "./components/toast"
import { AuthProvider, useAuth } from "./lib/auth"
import { queryClient } from "./lib/query-client"
import { LoginPage } from "./pages/login-page"



const DashboardPage = lazy(() => import("./pages/dashboard-page").then((m) => ({ default: m.DashboardPage })))
const ReviewPage = lazy(() => import("./pages/review-page").then((m) => ({ default: m.ReviewPage })))
const NamingPage = lazy(() => import("./pages/naming-page").then((m) => ({ default: m.NamingPage })))
const SettingsLayout = lazy(() => import("./components/settings-layout").then((m) => ({ default: m.SettingsLayout })))
const SettingsPage = lazy(() => import("./pages/settings-page").then((m) => ({ default: m.SettingsPage })))
const UsersPage = lazy(() => import("./pages/users-page").then((m) => ({ default: m.UsersPage })))

function LegacyQueueRedirect() {
  const location = useLocation()
  return (
    <Navigate
      to={{ pathname: "/review", search: location.search }}
      replace
    />
  )
}

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) return <AppLoading />

  if (!user) return <LoginPage />

  return (
      <Routes>
        <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="review" element={<ReviewPage />} />
        <Route path="queue" element={<LegacyQueueRedirect />} />
        <Route path="naming" element={<NamingPage />} />
        <Route path="settings" element={<SettingsLayout />}>
          <Route index element={<SettingsPage />} />
          <Route path="users" element={<UsersPage />} />
        </Route>
        <Route path="users" element={<Navigate to="/settings/users" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <NuqsAdapter>
            <HoverPopoverProvider>
              <ToastProvider>
                <AppRoutes />
              </ToastProvider>
            </HoverPopoverProvider>
          </NuqsAdapter>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
