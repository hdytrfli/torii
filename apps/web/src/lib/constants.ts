import type { Source } from "./types"

type SourceKey = Exclude<Source, null>

export const SOURCE_META: Record<
  SourceKey,
  { label: string; level: "high" | "medium" | "low" | "none"; bar: string; dot: string }
> = {
  jellyfin: { label: "Jellyfin", level: "medium", bar: "bg-success", dot: "bg-success" },
  guessit: { label: "Filename", level: "none", bar: "bg-ink-muted/60", dot: "bg-ink-muted/40" },
  nfo: { label: "Local NFO", level: "high", bar: "bg-info", dot: "bg-info" },
  llm: { label: "AI fallback", level: "low", bar: "bg-warning", dot: "bg-warning" },
  manual: { label: "Manual", level: "medium", bar: "bg-ink-muted/60", dot: "bg-ink-muted/60" },
}

export const SOURCE_CHART_COLORS = ["blue", "gray"] as const
