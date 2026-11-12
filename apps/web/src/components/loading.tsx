import { Skeleton } from "./ui"

export function PageLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-52" />
        <Skeleton className="h-52" />
        <Skeleton className="h-52" />
      </div>
      <Skeleton className="h-80" />
    </div>
  )
}

export function AppLoading() {
  return (
    <div className="mx-auto min-h-screen max-w-screen-2xl bg-white">
      <div className="fixed inset-y-0 left-0 hidden w-72 border-r border-gray-200 bg-white p-4 lg:block">
        <div className="flex items-center gap-2">
          <Skeleton className="size-9" />
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-2.5 w-24" />
          </div>
        </div>
        <div className="mt-8 space-y-2">
          <Skeleton className="h-7 w-full" />
          <Skeleton className="h-7 w-full" />
          <Skeleton className="h-7 w-full" />
        </div>
      </div>
      <main className="p-4 sm:p-10 lg:pl-[19rem]">
        <PageLoading />
      </main>
    </div>
  )
}
