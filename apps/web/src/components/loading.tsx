import { Loader } from "lucide-react"
import { useLocation } from "react-router-dom"
import { Skeleton } from "./ui"

function HeaderSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-7 w-72 max-w-full" />
      <Skeleton className="h-4 w-[28rem] max-w-full" />
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="mt-8 space-y-3">
      <div className="border-b border-gray-200 pb-3">
        <div className="grid grid-cols-[1fr_7rem_5rem_5rem] gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-3" />
          ))}
        </div>
      </div>
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="grid grid-cols-[1fr_7rem_5rem_5rem] items-center gap-4 border-b border-gray-100 pb-3">
          <Skeleton className="h-4" />
          <Skeleton className="h-4" />
          <Skeleton className="h-4" />
          <Skeleton className="h-5 w-20" />
        </div>
      ))}
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <main>
      <HeaderSkeleton />
      <div className="mt-10 space-y-3">
        <Skeleton className="h-4 w-28" />
        <div className="grid grid-cols-1 gap-14 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="space-y-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-7 w-20" />
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-2 w-5/6" />
              <Skeleton className="h-2 w-4/6" />
              <Skeleton className="h-3 w-48" />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-16 space-y-4">
        <Skeleton className="h-5 w-24" />
        <div className="grid grid-cols-1 gap-14 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="space-y-3">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-6 w-20" />
              <Skeleton className="mt-4 h-32" />
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}

function QueueSkeleton() {
  return (
    <div className="space-y-5">
      <HeaderSkeleton />
      <div className="flex gap-4 border-b border-gray-200 pb-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-4 w-20" />
        ))}
      </div>
      <TableSkeleton />
    </div>
  )
}

function SettingsSkeleton() {
  return (
    <div className="max-w-5xl space-y-8">
      <HeaderSkeleton />
      <div className="flex gap-4 border-b border-gray-200 pb-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-14" />
      </div>
      {Array.from({ length: 2 }).map((_, index) => (
        <div key={index} className="grid gap-8 md:grid-cols-3">
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-48" />
          </div>
          <div className="space-y-4 md:col-span-2">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

function NamingSkeleton() {
  return (
    <div className="max-w-5xl space-y-8">
      <HeaderSkeleton />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-12" />
        ))}
      </div>
      <div className="grid gap-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    </div>
  )
}

export function RouteSkeleton() {
  const location = useLocation()
  if (location.pathname.startsWith("/queue")) return <QueueSkeleton />
  if (location.pathname.startsWith("/settings")) return <SettingsSkeleton />
  if (location.pathname.startsWith("/naming")) return <NamingSkeleton />
  return <DashboardSkeleton />
}

export function AppLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <div className="flex items-center gap-2">
        <Loader className="size-4 animate-spin text-gray-900" aria-hidden="true" />
        <p className="text-sm text-gray-500">Loading Torii</p>
      </div>
    </div>
  )
}
