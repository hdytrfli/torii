import { useState } from "react"
import { Link2, MoreHorizontal, Save } from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "../lib/api"
import { useAuth } from "../lib/auth"
import type { Shortcut } from "../lib/types"
import { useToast } from "../components/toast"
import { Divider } from "../components/tremor/divider"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/tremor/dropdown"
import { Badge, Button, Field, Input, Skeleton, Switch } from "../components/ui"

type FormState = {
  title: string
  url: string
  adminOnly: boolean
}

const emptyForm: FormState = {
  title: "",
  url: "",
  adminOnly: false,
}

function isExternal(url: string) {
  return url.startsWith("http://") || url.startsWith("https://")
}

export function ShortcutsPage() {
  const { user } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()
  const shortcutsQuery = useQuery({
    queryKey: ["shortcuts"],
    queryFn: api.shortcuts,
  })
  const [editing, setEditing] = useState<Shortcut | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [error, setError] = useState<string | null>(null)

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ["shortcuts"] })

  const reset = () => {
    setEditing(null)
    setForm(emptyForm)
    setError(null)
  }

  const save = useMutation({
    mutationFn: () => {
      const data = {
        title: form.title.trim(),
        url: form.url.trim(),
        admin_only: form.adminOnly,
      }
      return editing === null
        ? api.createShortcut(data)
        : api.updateShortcut(editing.id, data)
    },
    onSuccess: (shortcut) => {
      const wasEditing = editing !== null
      invalidate()
      reset()
      toast({
        title: wasEditing ? "Shortcut updated" : "Shortcut created",
        description: shortcut.title,
        variant: "success",
      })
    },
    onError: (err: Error) => setError(err.message),
  })

  const remove = useMutation({
    mutationFn: (id: number) => api.deleteShortcut(id),
    onSuccess: () => {
      invalidate()
      toast({ title: "Shortcut deleted", variant: "success" })
    },
    onError: (err: Error) =>
      toast({
        title: "Could not delete shortcut",
        description: err.message,
        variant: "error",
      }),
  })

  const startEdit = (shortcut: Shortcut) => {
    setEditing(shortcut)
    setForm({
      title: shortcut.title,
      url: shortcut.url,
      adminOnly: shortcut.admin_only,
    })
    setError(null)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  if (!user?.is_admin) {
    return <p className="text-sm text-gray-500">Administrator access required.</p>
  }

  const shortcuts = Array.isArray(shortcutsQuery.data)
    ? shortcutsQuery.data
    : []

  return (
    <div className="min-w-0">
      <div className="space-y-10">
        <form
          onSubmit={(event) => {
            event.preventDefault()
            save.mutate()
          }}
          className="grid min-w-0 grid-cols-1 gap-x-14 gap-y-8 md:grid-cols-3"
        >
          <div>
            <h2 className="font-semibold text-gray-900">
              {editing === null ? "Add a shortcut" : "Edit shortcut"}
            </h2>
            <p className="mt-1 text-sm leading-6 text-gray-500">
              Links shown in the sidebar for quick access.
            </p>
          </div>
          <div className="grid min-w-0 grid-cols-1 gap-4 md:col-span-2">
            <Field label="Title">
              <Input
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                placeholder="Needs review"
                required
              />
            </Field>
            <Field
              label="URL"
              hint="Use an https:// URL or an app-relative path like /review."
            >
              <Input
                value={form.url}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    url: event.target.value,
                  }))
                }
                placeholder="https://example.com or /review?status=ready"
                required
              />
            </Field>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <Switch
                checked={form.adminOnly}
                onChange={(checked) =>
                  setForm((current) => ({
                    ...current,
                    adminOnly: checked,
                  }))
                }
              />
              Administrators only
            </label>
            {error ? <p className="text-xs text-red-600">{error}</p> : null}
            <div className="flex items-center justify-end gap-3 pt-1">
              {editing !== null ? (
                <Button type="button" variant="secondary" onClick={reset}>
                  Cancel
                </Button>
              ) : null}
              <Button type="submit" disabled={save.isPending}>
                <Save size={14} aria-hidden="true" />
                {save.isPending
                  ? "Saving…"
                  : editing === null
                    ? "Create shortcut"
                    : "Save changes"}
              </Button>
            </div>
          </div>
        </form>

        <Divider />

        <section className="grid min-w-0 grid-cols-1 gap-x-14 gap-y-8 md:grid-cols-3">
          <div>
            <h2 className="font-semibold text-gray-900">Sidebar links</h2>
            <p className="mt-1 text-sm leading-6 text-gray-500">
              These shortcuts appear in the sidebar for everyone allowed to see
              them.
            </p>
          </div>
          <div className="min-w-0 md:col-span-2">
            {shortcutsQuery.isLoading ? (
              <Skeleton className="h-40" />
            ) : shortcuts.length === 0 ? (
              <div className="rounded-card border border-dashed border-line bg-surface px-6 py-12 text-center text-sm text-ink-muted">
                No shortcuts yet. Add one above to place it in the sidebar.
              </div>
            ) : (
              <ul role="list" className="divide-y divide-gray-200">
                {shortcuts.map((shortcut) => (
                  <li
                    key={shortcut.id}
                    className="flex items-center justify-between gap-x-6 py-2.5"
                  >
                    <div className="flex min-w-0 items-center gap-x-4">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-500">
                        <Link2 className="size-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 truncate text-sm font-medium text-gray-900">
                          <a
                            href={shortcut.url}
                            target={
                              isExternal(shortcut.url) ? "_blank" : undefined
                            }
                            rel={
                              isExternal(shortcut.url)
                                ? "noreferrer"
                                : undefined
                            }
                            className="truncate hover:underline"
                          >
                            {shortcut.title}
                          </a>
                        </p>
                        <p className="truncate font-mono text-xs text-gray-500">
                          {shortcut.url}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {shortcut.admin_only ? (
                        <Badge variant="neutral">Admin</Badge>
                      ) : null}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            className="group size-8 p-0 hover:border hover:border-gray-300 hover:bg-gray-50 data-[state=open]:border-gray-300 data-[state=open]:bg-gray-50"
                          >
                            <MoreHorizontal className="size-4 shrink-0 text-gray-500 group-hover:text-gray-700" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem onSelect={() => startEdit(shortcut)}>
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => {
                              if (
                                window.confirm(
                                  `Delete shortcut “${shortcut.title}”?`,
                                )
                              ) {
                                remove.mutate(shortcut.id)
                              }
                            }}
                            className="text-red-600"
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

