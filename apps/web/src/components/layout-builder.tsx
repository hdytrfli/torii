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
import { HoverPopover } from "./tremor/hover-popover"

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
          <h2 className="font-semibold text-ink">Tokens</h2>
          <p className="mt-1 text-sm leading-6 text-ink-muted">
            Drag a token into a layout, or click to insert it into the last focused template.
          </p>
        </div>
        <div className="md:col-span-2">
          <Card className="overflow-hidden p-0">
            <div className="border-b border-line px-4 py-3">
              <div className="text-sm font-medium text-ink">Token palette</div>
              <p className="mt-0.5 text-xs text-ink-muted">
                Chips become real values in the preview.
              </p>
            </div>

            <div className="space-y-4 px-4 py-4">
              {TOKEN_GROUPS.map((group) => (
                <div key={group.label}>
                  <div className="mb-2 text-[11px] font-medium text-ink-muted">{group.label}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {group.tokens.map((token) => (
                      <TokenButton key={token} token={token} onInsert={() => insert(token)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-line bg-surface-muted px-4 py-2 text-[11px] text-ink-muted">
              Adding to {active === "movie" ? "Movie layout" : "Show layout"}
            </div>
          </Card>
        </div>
      </section>

      <Divider />

      <section className="grid min-w-0 grid-cols-1 gap-x-14 gap-y-8 md:grid-cols-3">
        <div>
          <h2 className="font-semibold text-ink">Movie layout</h2>
          <p className="mt-1 text-sm leading-6 text-ink-muted">
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
          <h2 className="font-semibold text-ink">Show layout</h2>
          <p className="mt-1 text-sm leading-6 text-ink-muted">
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
  const definition = TOKEN_DEFS[token]

  return (
    <HoverPopover
      id={`token-${token}`}
      side="top"
      align="start"
      delay={120}
      closeDelay={120}
      contentClassName="w-72"
      content={
        <>
          <div className="p-3">
            <div className="text-xs font-medium text-ink">{definition.label}</div>
            <p className="mt-1 text-xs leading-5 text-ink-muted">{definition.hint}</p>
          </div>
          <div className="border-t border-line bg-surface-muted px-3 py-2 font-mono text-[10px] text-ink-muted">
            {`{${token}}`}
          </div>
        </>
      }
    >
      <button
        type="button"
        draggable
        onDragStart={(event) => {
          event.dataTransfer.setData(TOKEN_DRAG_TYPE, token)
          event.dataTransfer.effectAllowed = "copy"
        }}
        onClick={onInsert}
        className="group inline-flex cursor-grab items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1 text-xs font-medium text-ink-muted transition hover:border-line hover:bg-surface-muted hover:text-ink active:cursor-grabbing"
      >
        <GripVertical
          className="size-3 text-ink-muted/50 transition group-hover:text-ink-muted/70"
          aria-hidden="true"
        />
        {tokenLabel(token)}
      </button>
    </HoverPopover>
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
          <span className="text-xs font-medium text-ink-muted">Generated path</span>
          {pending ? <span className="text-[11px] text-ink-muted/70">Updating…</span> : null}
        </div>
        {error ? (
          <p className="mt-3 text-xs text-danger">{error.message}</p>
        ) : parts.length ? (
          <div className="mt-3 flex flex-wrap items-center gap-x-1 gap-y-1 font-mono text-xs leading-5">
            {parts.map((part, index) => (
              <span key={`${part}-${index}`} className="inline-flex min-w-0 items-center gap-x-1">
                {index > 0 ? (
                  <ChevronRight className="size-3 shrink-0 text-ink-muted/50" aria-hidden="true" />
                ) : null}
                <span
                  className={cn(
                    "break-all",
                    index === parts.length - 1
                      ? "font-medium text-ink"
                      : "text-ink-muted",
                  )}
                >
                  {part}
                </span>
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-xs text-ink-muted/70">Output appears when the layout is valid.</p>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-line bg-surface-muted px-4 py-2">
        <span className="text-[11px] font-medium text-ink-muted">{label}</span>
        <span className="truncate text-[11px] text-ink-muted">Input example: {example}</span>
      </div>
    </Card>
  )
}
