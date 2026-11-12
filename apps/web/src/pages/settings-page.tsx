import { useEffect, useState } from "react"
import { Save } from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api, ApiError } from "../lib/api"
import type { Settings } from "../lib/types"
import {
  Button,
  Card,
  Field,
  Input,
  Select,
  Skeleton,
  Toggle,
} from "../components/ui"

export function SettingsPage() {
  const queryClient = useQueryClient()
  const settingsQuery = useQuery({ queryKey: ["settings"], queryFn: api.settings })
  const [form, setForm] = useState<Settings | null>(null)
  const [extensions, setExtensions] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!settingsQuery.data) return
    setForm(settingsQuery.data)
    setExtensions(settingsQuery.data.extensions.join(", "))
  }, [settingsQuery.data])

  const save = useMutation({
    mutationFn: (data: Settings) =>
      api.saveSettings({
        min_size_mb: data.min_size_mb,
        extensions: data.extensions,
        movie_template: data.movie_template,
        tv_template: data.tv_template,
        action: data.action,
        delete_source: data.delete_source,
        cleanup_empty_dirs: data.cleanup_empty_dirs,
        auto_apply: data.auto_apply,
        auto_apply_confidence: data.auto_apply_confidence,
        poll_interval: data.poll_interval,
        stable_seconds: data.stable_seconds,
        dry_run: data.dry_run,
      }),
    onSuccess: (saved) => {
      setForm(saved)
      setExtensions(saved.extensions.join(", "))
      setMessage("Settings saved.")
      setError(null)
      void queryClient.invalidateQueries({ queryKey: ["settings"] })
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Could not save settings.")
      setMessage(null)
    },
  })

  if (!form) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-40" />
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
      </div>
    )
  }

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setForm((current) => (current ? { ...current, [key]: value } : current))
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!form) return
    const parsedExtensions = extensions
      .split(",")
      .map((item) => item.trim().toLowerCase().replace(/^\./, ""))
      .filter(Boolean)
    if (parsedExtensions.length === 0) {
      setError("At least one extension is required.")
      return
    }
    save.mutate({ ...form, extensions: parsedExtensions })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 pb-20">
      <div>
        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-muted">
          Configuration
        </div>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
          Scan less, decide once.
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">
          These values live in SQLite and override the YAML defaults. Host paths and provider
          details stay out of the database.
        </p>
      </div>

      <Card className="p-5">
        <div className="mb-4 text-sm font-semibold text-ink">Scanning</div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Minimum file size (MB)" hint="Use 0 for empty test files.">
            <Input
              type="number"
              min={0}
              step="0.1"
              value={form.min_size_mb}
              onChange={(event) => update("min_size_mb", Number(event.target.value))}
            />
          </Field>
          <Field label="File extensions" hint="Comma separated. Dots are optional.">
            <Input value={extensions} onChange={(event) => setExtensions(event.target.value)} />
          </Field>
          <Field label="Poll interval (seconds)">
            <Input
              type="number"
              min={1}
              value={form.poll_interval}
              onChange={(event) => update("poll_interval", Number(event.target.value))}
            />
          </Field>
          <Field label="Stable for (seconds)" hint="Size and mtime must stay unchanged.">
            <Input
              type="number"
              min={0}
              value={form.stable_seconds}
              onChange={(event) => update("stable_seconds", Number(event.target.value))}
            />
          </Field>
        </div>
      </Card>

      <Card className="p-5">
        <div className="mb-4 text-sm font-semibold text-ink">Naming layouts</div>
        <div className="flex flex-col gap-4">
          <Field
            label="Movie layout"
            hint={
              <>
                Relative to <code className="font-mono">paths.library.movies</code>. Preview:{" "}
                <code className="font-mono">{settingsQuery.data?.movie_preview}</code>
              </>
            }
          >
            <Input
              value={form.movie_template}
              onChange={(event) => update("movie_template", event.target.value)}
            />
          </Field>
          <Field
            label="Show layout"
            hint={
              <>
                Relative to <code className="font-mono">paths.library.shows</code>. Preview:{" "}
                <code className="font-mono">{settingsQuery.data?.tv_preview}</code>
              </>
            }
          >
            <Input
              value={form.tv_template}
              onChange={(event) => update("tv_template", event.target.value)}
            />
          </Field>
          <p className="text-[11px] leading-5 text-ink-muted">
            Placeholders: <code className="font-mono">{"{title} {year} {folder} {season} {episode} {episode_tag} {quality} {source} {codec} {group} {ext}"}</code>.
          </p>
        </div>
      </Card>

      <Card className="p-5">
        <div className="mb-1 text-sm font-semibold text-ink">Apply</div>
        <p className="mb-4 text-[11px] text-ink-muted">
          Grouped by scope so action-specific options are obvious.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Action">
            <Select
              value={form.action}
              onChange={(event) =>
                update("action", event.target.value as Settings["action"])
              }
            >
              <option value="move">Move — source disappears</option>
              <option value="copy">Copy — source stays</option>
              <option value="hardlink">Hardlink — same filesystem</option>
            </Select>
          </Field>
          <Toggle
            label="Delete source after copy"
            hint="Only applies when the action is copy."
            checked={form.delete_source}
            onChange={(value) => update("delete_source", value)}
          />
          <Toggle
            label="Clean up empty folders"
            hint="Runs after any successful apply."
            checked={form.cleanup_empty_dirs}
            onChange={(value) => update("cleanup_empty_dirs", value)}
          />
          <Toggle
            label="Dry run"
            hint="Calculate and show the target without touching files."
            checked={form.dry_run}
            onChange={(value) => update("dry_run", value)}
          />
          <Toggle
            label="Auto-apply high-confidence jobs"
            hint="Only jobs at or above the threshold skip review."
            checked={form.auto_apply}
            onChange={(value) => update("auto_apply", value)}
          />
          <Field label="Auto-apply confidence" hint="0 to 1. Higher means fewer auto moves.">
            <Input
              type="number"
              min={0}
              max={1}
              step="0.01"
              value={form.auto_apply_confidence}
              onChange={(event) => update("auto_apply_confidence", Number(event.target.value))}
            />
          </Field>
        </div>
      </Card>

      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-line bg-canvas/90 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <Button type="submit" disabled={save.isPending}>
            <Save size={14} /> {save.isPending ? "Saving…" : "Save settings"}
          </Button>
          {message ? <span className="text-xs text-success">{message}</span> : null}
          {error ? <span className="text-xs text-danger">{error}</span> : null}
        </div>
      </div>
    </form>
  )
}
