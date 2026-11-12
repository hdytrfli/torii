import { useEffect, useRef, useState, type RefObject } from "react"
import { useQuery } from "@tanstack/react-query"
import { ChevronRight } from "lucide-react"
import { api } from "../lib/api"
import { cn } from "../lib/format"
import { Card, Field, Input } from "./ui"
import { Divider } from "./tremor/divider"

const TOKEN_GROUPS = [
  { label: "Metadata", tokens: ["{title}", "{year}", "{folder}"] },
  { label: "Episode", tokens: ["{season}", "{episode}", "{episode_tag}"] },
  { label: "Release", tokens: ["{quality}", "{source}", "{codec}", "{group}"] },
  { label: "File", tokens: ["{ext}"] },
]

export function LayoutBuilder({
  movie,
  shows,
  onChange,
}: {
  movie: string
  shows: string
  onChange: (next: { movie: string; shows: string }) => void
}) {
  const [active, setActive] = useState<"movie" | "shows">("movie")
  const movieRef = useRef<HTMLInputElement>(null)
  const showRef = useRef<HTMLInputElement>(null)
  const [debounced, setDebounced] = useState({ movie, shows })

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced({ movie, shows }), 250)
    return () => window.clearTimeout(timer)
  }, [movie, shows])

  const preview = useQuery({
    queryKey: ["layout-preview", debounced.movie, debounced.shows],
    queryFn: () =>
      api.previewLayout({
        movie_template: debounced.movie,
        tv_template: debounced.shows,
      }),
    retry: false,
  })

  const chooseActive = (next: "movie" | "shows") => {
    setActive(next)
    const input = next === "movie" ? movieRef.current : showRef.current
    if (!input) return
    input.focus()
    const end = input.value.length
    input.setSelectionRange(end, end)
  }

  const insert = (token: string) => {
    const target: RefObject<HTMLInputElement | null> = active === "movie" ? movieRef : showRef
    const input = target.current
    if (!input) return
    const start = input.selectionStart ?? input.value.length
    const end = input.selectionEnd ?? start
    const value = active === "movie" ? movie : shows
    const next = value.slice(0, start) + token + value.slice(end)
    onChange(active === "movie" ? { movie: next, shows } : { movie, shows: next })
    requestAnimationFrame(() => {
      input.focus()
      input.setSelectionRange(start + token.length, start + token.length)
    })
  }

  return (
    <div className="min-w-0 space-y-10">
      <section className="grid min-w-0 grid-cols-1 gap-x-14 gap-y-8 md:grid-cols-3">
        <div>
          <h2 className="font-semibold text-gray-900">Tokens</h2>
          <p className="mt-1 text-sm leading-6 text-gray-500">
            Insert reusable values at the cursor. Tokens target the layout you are editing.
          </p>
        </div>
        <div className="md:col-span-2">
          <Card className="overflow-hidden p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
              <div>
                <div className="text-sm font-medium text-gray-900">Token palette</div>
                <p className="mt-0.5 text-xs text-gray-500">
                  Click a token to add it to the active layout.
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500">Insert into</span>
                <button
                  type="button"
                  onClick={() => chooseActive("movie")}
                  className={cn(
                    "rounded-md px-2 py-1 text-xs font-medium transition",
                    active === "movie"
                      ? "bg-brand text-brand-ink"
                      : "text-gray-500 hover:bg-gray-100 hover:text-gray-900",
                  )}
                >
                  Movies
                </button>
                <button
                  type="button"
                  onClick={() => chooseActive("shows")}
                  className={cn(
                    "rounded-md px-2 py-1 text-xs font-medium transition",
                    active === "shows"
                      ? "bg-brand text-brand-ink"
                      : "text-gray-500 hover:bg-gray-100 hover:text-gray-900",
                  )}
                >
                  Shows
                </button>
              </div>
            </div>

            <div className="space-y-4 px-4 py-4">
              {TOKEN_GROUPS.map((group) => (
                <div key={group.label}>
                  <div className="mb-2 text-[11px] font-medium text-gray-500">{group.label}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {group.tokens.map((token) => (
                      <button
                        key={token}
                        type="button"
                        onClick={() => insert(token)}
                        className="rounded-md border border-gray-200 bg-white px-2 py-1 font-mono text-xs text-gray-600 transition hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900"
                      >
                        {token}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-200 bg-gray-50 px-4 py-2 text-[11px] text-gray-500">
              Adding to {active === "movie" ? "Movie layout" : "Show layout"}
            </div>
          </Card>
        </div>
      </section>

      <Divider />

      <section className="grid min-w-0 grid-cols-1 gap-x-14 gap-y-8 md:grid-cols-3">
        <div>
          <h2 className="font-semibold text-gray-900">Movie layout</h2>
          <p className="mt-1 text-sm leading-6 text-gray-500">
            Folder and filename pattern for movies.
          </p>
        </div>
        <div className="min-w-0 space-y-4 md:col-span-2">
          <Field
            label="Movie path template"
            hint={
              <span className="font-mono">
                {"{folder} = Title (Year) · {title} = title only · {ext} is optional"}
              </span>
            }
          >
            <Input
              ref={movieRef}
              value={movie}
              onFocus={() => setActive("movie")}
              onChange={(event) => onChange({ movie: event.target.value, shows })}
              inputClassName="font-mono text-xs"
            />
          </Field>
          <Preview
            label="Movie preview"
            example="Spirited Away (2001)"
            path={preview.data?.movie}
            error={preview.error}
            pending={preview.isFetching}
          />
        </div>
      </section>

      <Divider />

      <section className="grid min-w-0 grid-cols-1 gap-x-14 gap-y-8 md:grid-cols-3">
        <div>
          <h2 className="font-semibold text-gray-900">Show layout</h2>
          <p className="mt-1 text-sm leading-6 text-gray-500">
            Folder and filename pattern for episodes.
          </p>
        </div>
        <div className="min-w-0 space-y-4 md:col-span-2">
          <Field
            label="Show path template"
            hint={
              <span className="font-mono">
                {"{episode_tag} = S01E01 · {folder} = Title (Year) · {ext} is optional"}
              </span>
            }
          >
            <Input
              ref={showRef}
              value={shows}
              onFocus={() => setActive("shows")}
              onChange={(event) => onChange({ movie, shows: event.target.value })}
              inputClassName="font-mono text-xs"
            />
          </Field>
          <Preview
            label="Show preview"
            example="Dark (2017) - S01E01"
            path={preview.data?.shows}
            error={preview.error}
            pending={preview.isFetching}
          />
        </div>
      </section>
    </div>
  )
}

function Preview({
  label,
  example,
  path,
  error,
  pending,
}: {
  label: string
  example: string
  path?: string
  error: Error | null
  pending: boolean
}) {
  const parts = path?.replaceAll("\\", "/").split("/").filter(Boolean) ?? []
  return (
    <Card className="min-w-0 overflow-hidden p-0">
      <div className="px-4 pb-4 pt-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-gray-500">{label}</span>
          {pending ? <span className="text-[11px] text-gray-400">Updating…</span> : null}
        </div>
        {error ? (
          <p className="mt-3 text-xs text-red-700">{error.message}</p>
        ) : parts.length ? (
          <div className="mt-3 flex flex-wrap items-center gap-x-1 gap-y-1 font-mono text-xs leading-5">
            {parts.map((part, index) => (
              <span key={`${part}-${index}`} className="inline-flex min-w-0 items-center gap-x-1">
                {index > 0 ? (
                  <ChevronRight className="size-3 shrink-0 text-gray-300" aria-hidden="true" />
                ) : null}
                <span
                  className={cn(
                    "break-all",
                    index === parts.length - 1
                      ? "font-medium text-gray-900"
                      : "text-gray-500",
                  )}
                >
                  {part}
                </span>
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-xs text-gray-400">Waiting for a valid layout…</p>
        )}
      </div>
      <div className="border-t border-gray-200 bg-gray-50 px-4 py-2 text-xs text-gray-500">
        Example: {example}
      </div>
    </Card>
  )
}
