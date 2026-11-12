import { useEffect, useRef, useState, type RefObject } from "react"
import { useQuery } from "@tanstack/react-query"
import { api } from "../lib/api"
import { Badge, Field, Input } from "./ui"

const TOKENS = [
  "{title}",
  "{year}",
  "{folder}",
  "{season}",
  "{episode}",
  "{episode_tag}",
  "{quality}",
  "{source}",
  "{codec}",
  "{group}",
  "{ext}",
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
    <div className="grid grid-cols-1 gap-x-14 gap-y-8 md:grid-cols-3">
      <div>
        <h2 className="font-semibold text-gray-900">Naming layouts</h2>
        <p className="mt-1 text-sm leading-6 text-gray-500">
          Build the folder and file pattern. The preview updates as you type.
        </p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {TOKENS.map((token) => (
            <button
              key={token}
              type="button"
              onClick={() => insert(token)}
              className="rounded-md border border-gray-200 bg-white px-1.5 py-0.5 font-mono text-[11px] text-gray-600 transition hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900"
            >
              {token}
            </button>
          ))}
        </div>
        <p className="mt-3 text-[11px] leading-5 text-gray-500">
          Click a token to insert it into the active layout. Use <code>{`{folder}`}</code> for{" "}
          <code>Title (Year)</code>, or <code>{`{title}`}</code> without the year.
        </p>
      </div>

      <div className="space-y-6 md:col-span-2">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Movie layout">
            <Input
              ref={movieRef}
              value={movie}
              onFocus={() => setActive("movie")}
              onChange={(event) => onChange({ movie: event.target.value, shows })}
              className="font-mono text-xs"
            />
          </Field>
          <Field label="Show layout">
            <Input
              ref={showRef}
              value={shows}
              onFocus={() => setActive("shows")}
              onChange={(event) => onChange({ movie, shows: event.target.value })}
              className="font-mono text-xs"
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Preview label="Movie preview" example="Spirited Away (2001)" path={preview.data?.movie} error={preview.error} />
          <Preview label="Show preview" example="Dark (2017) · S01E01" path={preview.data?.shows} error={preview.error} />
        </div>
      </div>
    </div>
  )
}

function Preview({
  label,
  example,
  path,
  error,
}: {
  label: string
  example: string
  path?: string
  error: Error | null
}) {
  const parts = path?.replaceAll("\\", "/").split("/").filter(Boolean) ?? []
  return (
    <div className="rounded-md border border-gray-200 bg-gray-50/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-gray-500">{label}</span>
        <Badge variant="neutral">{example}</Badge>
      </div>
      {error ? (
        <p className="mt-2 text-xs text-red-700">{error.message}</p>
      ) : (
        <div className="mt-2 space-y-1 font-mono text-[11px] leading-5">
          {parts.length ? (
            parts.map((part, index) => (
              <div key={`${part}-${index}`} className="flex items-center gap-1.5 text-gray-600">
                <span className="text-gray-300">{index === 0 ? "/" : "└"}</span>
                <span className={index === parts.length - 1 ? "text-gray-900" : ""}>{part}</span>
              </div>
            ))
          ) : (
            <span className="text-gray-400">Waiting for a valid layout…</span>
          )}
        </div>
      )}
    </div>
  )
}
