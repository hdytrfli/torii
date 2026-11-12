import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Job, Source } from "./types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const SOURCE_LABELS: Record<string, string> = {
  guessit: "Filename",
  jellyfin: "Jellyfin",
  nfo: "Local NFO",
  llm: "AI fallback",
  manual: "Manual",
}

export function sourceLabel(source: Source) {
  return source ? SOURCE_LABELS[source] ?? source : "Unknown"
}

export function sourceTone(source: Source) {
  switch (source) {
    case "jellyfin":
      return "bg-success-soft text-success"
    case "nfo":
      return "bg-info-soft text-info"
    case "llm":
      return "bg-warning-soft text-warning"
    case "manual":
      return "bg-surface-muted text-ink-muted"
    default:
      return "bg-surface-muted text-ink-muted"
  }
}

export function statusLabel(status: string) {
  return status.replaceAll("_", " ")
}

export function statusTone(status: string) {
  switch (status) {
    case "ready":
      return "bg-success-soft text-success"
    case "moved":
      return "bg-surface-muted text-ink-muted"
    case "rejected":
    case "failed":
      return "bg-danger-soft text-danger"
    case "needs_review":
    default:
      return "bg-warning-soft text-warning"
  }
}

export function pct(value: number | null | undefined) {
  return `${Math.round((value ?? 0) * 100)}%`
}

export function basename(path: string | null | undefined) {
  if (!path) return ""
  return path.replaceAll("\\", "/").split("/").pop() ?? path
}

export function episodeLabel(job: Job) {
  if (job.media_type !== "tv" || job.season == null || job.episode == null) return null
  return `S${job.season}E${job.episode}`
}

export function totalCounts(counts: Partial<Record<string, number>>) {
  return Object.values(counts).reduce<number>((total, value) => total + (value ?? 0), 0)
}
