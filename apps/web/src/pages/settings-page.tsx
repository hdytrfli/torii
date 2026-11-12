import { useEffect, useState } from "react"
import { Save } from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api, ApiError } from "../lib/api"
import type { Settings } from "../lib/types"
import { Divider } from "../components/tremor/divider"
import { DropdownSelect } from "../components/tremor/dropdown-select"
import { Button, Field, Input, Skeleton, Toggle } from "../components/ui"

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
      <div className="space-y-4">
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
    <form onSubmit={submit} className="min-w-0">
      <div className="space-y-10">
        <section className="grid min-w-0 grid-cols-1 gap-x-14 gap-y-8 md:grid-cols-3">
          <div>
            <h2 className="font-semibold text-gray-900">Scanning</h2>
            <p className="mt-1 text-sm leading-6 text-gray-500">
              Control which files are picked up and how quickly.
            </p>
          </div>
          <div className="grid min-w-0 grid-cols-1 gap-4 md:col-span-2">
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
            <SaveRow pending={save.isPending} message={message} error={error} />
          </div>
        </section>

        <Divider />

        <section className="grid min-w-0 grid-cols-1 gap-x-14 gap-y-8 md:grid-cols-3">
          <div>
            <h2 className="font-semibold text-gray-900">Apply</h2>
            <p className="mt-1 text-sm leading-6 text-gray-500">
              Choose the file action and automation boundary.
            </p>
          </div>
          <div className="min-w-0 space-y-4 md:col-span-2">
            <Field label="Action">
              <DropdownSelect
                value={form.action}
                onChange={(value) => update("action", value)}
                options={[
                  { value: "move", label: "Move - source disappears" },
                  { value: "copy", label: "Copy - source stays" },
                  { value: "hardlink", label: "Hardlink - same filesystem" },
                ]}
              />
            </Field>
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
              hint="Calculate the target without touching files."
              checked={form.dry_run}
              onChange={(value) => update("dry_run", value)}
            />
            <Toggle
              label="Auto-apply high-confidence jobs"
              hint="Only jobs at or above the threshold skip review."
              checked={form.auto_apply}
              onChange={(value) => update("auto_apply", value)}
            />
            <SaveRow pending={save.isPending} message={message} error={error} />
          </div>
        </section>
      </div>
    </form>
  )
}

function SaveRow({
  pending,
  message,
  error,
}: {
  pending: boolean
  message: string | null
  error: string | null
}) {
  return (
    <div className="flex items-center justify-end gap-3 pt-1">
      {message ? <span className="text-xs text-gray-500">{message}</span> : null}
      {error ? <span className="text-xs text-red-700">{error}</span> : null}
      <Button type="submit" disabled={pending}>
        <Save size={14} /> {pending ? "Saving…" : "Save changes"}
      </Button>
    </div>
  )
}
