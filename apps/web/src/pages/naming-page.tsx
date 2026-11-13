import { useEffect, useState } from "react"
import { Save } from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api, ApiError } from "../lib/api"
import type { Settings } from "../lib/types"
import { LayoutBuilder } from "../components/layout-builder"
import { PageHeader } from "../components/page-header"
import { Button, Skeleton } from "../components/ui"

export function NamingPage() {
  const queryClient = useQueryClient()
  const settingsQuery = useQuery({ queryKey: ["settings"], queryFn: api.settings })
  const [settings, setSettings] = useState<Settings | null>(null)
  const [movie, setMovie] = useState("")
  const [shows, setShows] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!settingsQuery.data) return
    setSettings(settingsQuery.data)
    setMovie(settingsQuery.data.movie_template)
    setShows(settingsQuery.data.tv_template)
  }, [settingsQuery.data])

  const save = useMutation({
    mutationFn: () => {
      if (!settings) throw new Error("Settings not loaded")
      return api.saveSettings({
        min_size_mb: settings.min_size_mb,
        extensions: settings.extensions,
        movie_template: movie,
        tv_template: shows,
        action: settings.action,
        cleanup_empty_dirs: settings.cleanup_empty_dirs,
        auto_apply: settings.auto_apply,
        auto_apply_confidence: settings.auto_apply_confidence,
        poll_interval: settings.poll_interval,
        stable_seconds: settings.stable_seconds,
        queue_metadata_poll: settings.queue_metadata_poll,
        queue_promotion_poll: settings.queue_promotion_poll,
        queue_execution_poll: settings.queue_execution_poll,
        queue_revert_poll: settings.queue_revert_poll,
      })
    },
    onSuccess: (saved) => {
      setSettings(saved)
      setMessage("Naming layouts saved.")
      setError(null)
      void queryClient.invalidateQueries({ queryKey: ["settings"] })
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Could not save layouts.")
      setMessage(null)
    },
  })

  if (!settings) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl">
      <PageHeader
        eyebrow="Naming"
        title="Shape the library paths."
        description="Drag tokens into place, type the separators, and watch the generated path update."
      />

      <div className="mt-12">
        <LayoutBuilder
          movie={movie}
          shows={shows}
          onChange={({ movie: nextMovie, shows: nextShows }) => {
            setMovie(nextMovie)
            setShows(nextShows)
            setMessage(null)
          }}
        />
      </div>

      <div className="mt-10 flex items-center justify-end gap-3">
        {message ? <span className="text-xs text-ink-muted">{message}</span> : null}
        {error ? <span className="text-xs text-danger">{error}</span> : null}
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          <Save size={14} /> {save.isPending ? "Saving…" : "Save layouts"}
        </Button>
      </div>
    </div>
  )
}
