import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { tokenStore } from "./token-store"

export function useServerEvents() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const token = tokenStore.get()
    if (!token) return

    let source: EventSource | null = null
    let refreshTimer: number | null = null
    let closed = false

    const refreshReview = () => {
      if (refreshTimer !== null) window.clearTimeout(refreshTimer)
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null
        void queryClient.refetchQueries({
          queryKey: ["review-jobs"],
          type: "active",
        })
        void queryClient.refetchQueries({ queryKey: ["groups"], type: "active" })
        void queryClient.refetchQueries({ queryKey: ["jobs"], type: "active" })
        void queryClient.refetchQueries({ queryKey: ["stats"], type: "active" })
        void queryClient.refetchQueries({
          queryKey: ["settings"],
          type: "active",
        })
      }, 200)
    }

    const refreshLogs = () => {
      void queryClient.refetchQueries({ queryKey: ["logs"], type: "active" })
    }

    const connect = () => {
      if (closed) return
      source = new EventSource(
        `/api/events?token=${encodeURIComponent(token)}`,
      )

      source.onopen = () => {
        void queryClient.refetchQueries({
          queryKey: ["review-jobs"],
          type: "active",
        })
        void queryClient.refetchQueries({ queryKey: ["logs"], type: "active" })
        void queryClient.refetchQueries({
          queryKey: ["operations"],
          type: "active",
        })
      }
      source.addEventListener("job", refreshReview)
      source.addEventListener("jobs_changed", refreshReview)
      source.addEventListener("log", refreshLogs)
      source.addEventListener("queue", (event) => {
        try {
          queryClient.setQueryData(
            ["operations"],
            JSON.parse((event as MessageEvent).data),
          )
        } catch {
          void queryClient.invalidateQueries({ queryKey: ["operations"] })
        }
      })
      source.addEventListener("scan", (event) => {
        try {
          queryClient.setQueryData(
            ["scan-status"],
            JSON.parse((event as MessageEvent).data),
          )
        } catch {
          void queryClient.invalidateQueries({ queryKey: ["scan-status"] })
        }
      })
      source.addEventListener("ready", () => {
        void queryClient.invalidateQueries({ queryKey: ["operations"] })
      })
    }

    connect()

    return () => {
      closed = true
      source?.close()
      if (refreshTimer !== null) window.clearTimeout(refreshTimer)
    }
  }, [queryClient])
}
