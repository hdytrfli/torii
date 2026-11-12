import { useEffect, useState } from "react"
import { Plus, Save } from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api, ApiError } from "../lib/api"
import type { Settings } from "../lib/types"
import { Divider } from "../components/tremor/divider"
import { DropdownSelect } from "../components/tremor/dropdown-select"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/tremor/dialog"
import { Button, Card, Checkbox, Field, Input, Skeleton, Toggle } from "../components/ui"

type SettingsSection = "scanning" | "apply"

export function SettingsPage() {
  const queryClient = useQueryClient()
  const settingsQuery = useQuery({ queryKey: ["settings"], queryFn: api.settings })
  const [form, setForm] = useState<Settings | null>(null)
  const [extensions, setExtensions] = useState<string[]>([])
  const [feedback, setFeedback] = useState<{
    section: SettingsSection
    message?: string
    error?: string
  } | null>(null)

  useEffect(() => {
    if (!settingsQuery.data) return
    setForm(settingsQuery.data)
    setExtensions(settingsQuery.data.extensions)
  }, [settingsQuery.data])

  const save = useMutation({
    mutationFn: ({
      data,
    }: {
      data: Settings
      section: SettingsSection
    }) =>
      api.saveSettings({
        min_size_mb: data.min_size_mb,
        extensions: data.extensions,
        movie_template: data.movie_template,
        tv_template: data.tv_template,
        action: data.action,
        cleanup_empty_dirs: data.cleanup_empty_dirs,
        auto_apply: data.auto_apply,
        auto_apply_confidence: data.auto_apply_confidence,
        poll_interval: data.poll_interval,
        stable_seconds: data.stable_seconds,
      }),
    onSuccess: (saved, { section }) => {
      setForm(saved)
      setExtensions(saved.extensions)
      setFeedback({
        section,
        message: saved.auto_apply
          ? saved.auto_apply_eligible > 0
            ? `Settings saved. Auto-apply queued for ${saved.auto_apply_eligible} eligible job${saved.auto_apply_eligible === 1 ? "" : "s"}.`
            : `Settings saved. Auto-apply is on, but no jobs are currently eligible (${saved.auto_apply_blocked} blocked, ${saved.auto_apply_excluded} manually handled, ${saved.auto_apply_below_threshold} below threshold).`
          : "Settings saved.",
      })
      void queryClient.invalidateQueries({ queryKey: ["settings"] })
    },
    onError: (err, { section }) => {
      setFeedback({
        section,
        error: err instanceof ApiError ? err.message : "Could not save settings.",
      })
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

  function submit(event: React.FormEvent, section: SettingsSection) {
    event.preventDefault()
    if (!form) return
    if (extensions.length === 0) {
      setFeedback({ section, error: "At least one extension is required." })
      return
    }
    save.mutate({ data: { ...form, extensions }, section })
  }

  return (
    <div className="min-w-0">
      <div className="space-y-10">
        <form
          onSubmit={(event) => submit(event, "scanning")}
          className="grid min-w-0 grid-cols-1 gap-x-14 gap-y-8 md:grid-cols-3"
        >
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
            <ExtensionsPicker
              value={extensions}
              onChange={(next) => {
                setExtensions(next)
                setFeedback((current) =>
                  current?.section === "scanning" ? null : current,
                )
              }}
            />
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
            <SaveRow
              pending={save.isPending && save.variables?.section === "scanning"}
              message={
                feedback?.section === "scanning" ? feedback.message ?? null : null
              }
              error={
                feedback?.section === "scanning" ? feedback.error ?? null : null
              }
            />
          </div>
        </form>

        <Divider />

        <form
          onSubmit={(event) => submit(event, "apply")}
          className="grid min-w-0 grid-cols-1 gap-x-14 gap-y-8 md:grid-cols-3"
        >
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
              label="Clean up empty folders"
              hint="Runs after any successful apply."
              checked={form.cleanup_empty_dirs}
              onChange={(value) => update("cleanup_empty_dirs", value)}
            />
            <Toggle
              label="Auto-apply high-confidence jobs"
              hint="Only jobs at or above the threshold skip review."
              checked={form.auto_apply}
              onChange={(value) => update("auto_apply", value)}
            />
            <AutoApplySummary form={form} />
            <SaveRow
              pending={save.isPending && save.variables?.section === "apply"}
              message={
                feedback?.section === "apply" ? feedback.message ?? null : null
              }
              error={
                feedback?.section === "apply" ? feedback.error ?? null : null
              }
            />
          </div>
        </form>
      </div>
    </div>
  )
}

function AutoApplySummary({ form }: { form: Settings }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
      <span>
        {form.auto_apply ? "Auto-apply" : "If enabled"}:{" "}
        <span className="font-medium text-gray-700">
          {form.auto_apply_eligible}
        </span>{" "}
        eligible
      </span>
      {form.auto_apply_blocked > 0 ? (
        <span>
          <span className="font-medium text-gray-700">
            {form.auto_apply_blocked}
          </span>{" "}
          blocked
        </span>
      ) : null}
      {form.auto_apply_excluded > 0 ? (
        <span>
          <span className="font-medium text-gray-700">
            {form.auto_apply_excluded}
          </span>{" "}
          manually handled
        </span>
      ) : null}
      {form.auto_apply_below_threshold > 0 ? (
        <span>
          <span className="font-medium text-gray-700">
            {form.auto_apply_below_threshold}
          </span>{" "}
          below threshold
        </span>
      ) : null}
    </div>
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

const EXTENSION_GROUPS = [
  {
    label: "Video",
    extensions: ["mkv", "mp4", "avi", "mov", "m4v", "webm", "ts", "m2ts"],
  },
  {
    label: "Other",
    extensions: ["wmv", "flv", "mpg", "mpeg", "3gp", "ogv"],
  },
]

function ExtensionsPicker({
  value,
  onChange,
}: {
  value: string[]
  onChange: (next: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState<string[]>(value)
  const [custom, setCustom] = useState("")
  const [customError, setCustomError] = useState<string | null>(null)

  const start = () => {
    setPending(value)
    setCustom("")
    setCustomError(null)
    setOpen(true)
  }

  const toggle = (extension: string) => {
    setPending((current) =>
      current.includes(extension)
        ? current.filter((item) => item !== extension)
        : [...current, extension],
    )
  }

  const addCustom = () => {
    const next = custom
      .split(",")
      .map((item) => item.trim().toLowerCase().replace(/^\./, ""))
      .filter(Boolean)
    if (!next.length) return
    if (next.some((item) => !/^[a-z0-9]+$/.test(item))) {
      setCustomError("Use letters and numbers only.")
      return
    }
    setPending((current) => [...new Set([...current, ...next])])
    setCustom("")
    setCustomError(null)
  }

  const apply = () => {
    onChange(pending)
    setOpen(false)
  }

  return (
    <>
      <Card className="overflow-hidden p-0">
        <div className="px-4 pb-4 pt-4">
          <div className="text-sm font-medium text-gray-900">File extensions</div>
          <p className="mt-0.5 text-xs text-gray-500">
            Choose which file types the scanner should pick up.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {value.length ? (
              value.map((extension) => (
                <span
                  key={extension}
                  className="rounded border border-gray-200 bg-gray-50 px-2 py-1 font-mono text-[11px] text-gray-700"
                >
                  {extension}
                </span>
              ))
            ) : (
              <span className="text-xs text-gray-400">No extensions selected.</span>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-4 py-2">
          <span className="text-xs text-gray-500">
            {value.length} format{value.length === 1 ? "" : "s"} selected
          </span>
          <Button
            type="button"
            variant="secondary"
            onClick={start}
            aria-haspopup="dialog"
            aria-expanded={open}
          >
            Edit extensions
          </Button>
        </div>
      </Card>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) {
            setCustom("")
            setCustomError(null)
          }
        }}
      >
        <DialogContent className="max-w-xl p-0">
          <DialogHeader className="border-b border-gray-200 px-5 py-4">
            <DialogTitle className="text-base">File extensions</DialogTitle>
            <DialogDescription className="text-sm">
              Choose which file types the scanner should pick up.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] space-y-5 overflow-y-auto px-5 py-4">
            {EXTENSION_GROUPS.map((group) => (
              <div key={group.label}>
                <div className="text-xs font-medium text-gray-500">{group.label}</div>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                  {group.extensions.map((extension) => {
                    const id = `extension-${extension}`
                    return (
                      <div key={extension} className="flex items-center gap-2">
                        <Checkbox
                          id={id}
                          checked={pending.includes(extension)}
                          onCheckedChange={() => toggle(extension)}
                        />
                        <label
                          htmlFor={id}
                          className="cursor-pointer font-mono text-xs text-gray-700"
                        >
                          {extension}
                        </label>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}

            <div className="border-t border-gray-200 pt-4">
              <label htmlFor="custom-extension" className="text-xs font-medium text-gray-500">
                Add custom extension
              </label>
              <div className="mt-2 flex items-start gap-2">
                <Input
                  id="custom-extension"
                  value={custom}
                  onChange={(event) => {
                    setCustom(event.target.value)
                    setCustomError(null)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault()
                      addCustom()
                    }
                  }}
                  placeholder="e.g. mkv, mp4"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={addCustom}
                  disabled={!custom.trim()}
                >
                  <Plus className="size-4" aria-hidden="true" />
                  Add
                </Button>
              </div>
              {customError ? (
                <p className="mt-1.5 text-xs text-red-700">{customError}</p>
              ) : null}
            </div>

          </div>

          <DialogFooter className="border-t border-gray-200 bg-gray-50 px-5 py-3">
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" onClick={apply} disabled={pending.length === 0}>
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
