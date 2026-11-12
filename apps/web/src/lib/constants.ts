import type { Source } from "./types"

type SourceKey = Exclude<Source, null>

export const SOURCE_META: Record<
  SourceKey,
  { label: string; level: "high" | "medium" | "low" | "none"; bar: string; dot: string }
> = {
  jellyfin: { label: "Jellyfin", level: "medium", bar: "bg-emerald-500", dot: "bg-emerald-500" },
  guessit: { label: "Filename", level: "none", bar: "bg-gray-500", dot: "bg-gray-400" },
  nfo: { label: "Local NFO", level: "high", bar: "bg-blue-500", dot: "bg-blue-500" },
  llm: { label: "AI fallback", level: "low", bar: "bg-yellow-500", dot: "bg-yellow-500" },
  manual: { label: "Manual", level: "medium", bar: "bg-gray-500", dot: "bg-gray-500" },
}

export const SOURCE_CHART_COLORS = ["blue", "gray"] as const
