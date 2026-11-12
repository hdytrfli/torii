import { useEffect, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ChevronRight, GripVertical } from "lucide-react"
import { api } from "../lib/api"
import { cn } from "../lib/format"
import {
  TOKEN_DEFS,
  TOKEN_DRAG_TYPE,
  TOKEN_GROUPS,
  tokenLabel,
  type TokenName,
} from "../lib/naming-tokens"
import { Card, Field } from "./ui"
import { InlineTokenEditor, type InlineTokenEditorHandle } from "./inline-token-editor"
import { Divider } from "./tremor/divider"
import { Popover, PopoverContent, PopoverTrigger } from "./tremor/popover"

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
  const movieRef = useRef<InlineTokenEditorHandle>(null)
  const showRef = useRef<InlineTokenEditorHandle>(null)
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
    const editor = active === "movie" ? movieRef.current : showRef.current
    editor?.insertToken(token)
  }

  return (
    <div className="min-w-0 space-y-10">
      <section className="grid min-w-0 grid-cols-1 gap-x-14 gap-y-8 md:grid-cols-3">
        <div>
          <h2 className="font-semibold text-gray-900">Tokens</h2>
          <p className="mt-1 text-sm leading-6 text-gray-500">
            Drag a token into a layout, or click to insert it into the last focused template.
          </p>
        </div>
        <div className="md:col-span-2">
          <Card className="overflow-hidden p-0">
            <div className="border-b border-gray-200 px-4 py-3">
              <div className="text-sm font-medium text-gray-900">Token palette</div>
              <p className="mt-0.5 text-xs text-gray-500">
                Chips become real values in the preview.
              </p>
            </div>

            <div className="space-y-4 px-4 py-4">
              {TOKEN_GROUPS.map((group) => (
                <div key={group.label}>
                  <div className="mb-2 text-[11px] font-medium text-gray-500">{group.label}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {group.tokens.map((token) => (
                      <TokenButton key={token} token={token} onInsert={() => insert(token)} />
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
            Folder and filename pattern for movies. Type separators and drag tokens into place.
          </p>
        </div>
        <div className="min-w-0 space-y-4 md:col-span-2">
          <Field label="Movie path template">
            <InlineTokenEditor
              ref={movieRef}
              value={movie}
              onFocus={() => setActive("movie")}
              onChange={(next) => onChange({ movie: next, shows })}
              placeholder="Drag tokens here, or type a path…"
              ariaLabel="Movie path template"
            />
          </Field>
          <Preview
            label="Movie output"
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
            Folder and filename pattern for episodes. Type separators and drag tokens into place.
          </p>
        </div>
        <div className="min-w-0 space-y-4 md:col-span-2">
          <Field label="Show path template">
            <InlineTokenEditor
              ref={showRef}
              value={shows}
              onFocus={() => setActive("shows")}
              onChange={(next) => onChange({ movie, shows: next })}
              placeholder="Drag tokens here, or type a path…"
              ariaLabel="Show path template"
            />
          </Field>
          <Preview
            label="Show output"
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

function TokenButton({ token, onInsert }: { token: TokenName; onInsert: () => void }) {
  const [open, setOpen] = useState(false)
  const closeTimer = useRef<number | null>(null)
  const definition = TOKEN_DEFS[token]

  useEffect(() => {
    return () => {
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current)
    }
  }, [])

  const openNow = () => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
    setOpen(true)
  }

  const closeSoon = () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => {
      setOpen(false)
      closeTimer.current = null
    }, 120)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          draggable
          onDragStart={(event) => {
            event.dataTransfer.setData(TOKEN_DRAG_TYPE, token)
            event.dataTransfer.effectAllowed = "copy"
          }}
          onClick={() => {
            onInsert()
            setOpen(false)
          }}
          onMouseEnter={openNow}
          onMouseLeave={closeSoon}
          onFocus={openNow}
          onBlur={closeSoon}
          className="group inline-flex cursor-grab items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-600 transition hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900 active:cursor-grabbing"
        >
          <GripVertical
            className="size-3 text-gray-300 transition group-hover:text-gray-400"
            aria-hidden="true"
          />
          {tokenLabel(token)}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={6}
        className="w-60 p-3"
        onMouseEnter={openNow}
        onMouseLeave={closeSoon}
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div className="text-xs font-medium text-gray-900">{definition.label}</div>
        <p className="mt-1 text-xs leading-5 text-gray-500">{definition.hint}</p>
        <p className="mt-2 font-mono text-[10px] text-gray-400">{`{${token}}`}</p>
      </PopoverContent>
    </Popover>
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
          <span className="text-xs font-medium text-gray-500">Generated path</span>
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
          <p className="mt-3 text-xs text-gray-400">Output appears when the layout is valid.</p>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-gray-200 bg-gray-50 px-4 py-2">
        <span className="text-[11px] font-medium text-gray-500">{label}</span>
        <span className="truncate text-[11px] text-gray-500">Input example: {example}</span>
      </div>
    </Card>
  )
}
