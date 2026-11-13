export type Source = "guessit" | "jellyfin" | "nfo" | "llm" | "manual" | null
export type MediaType = "movie" | "tv"
export type JobStatus =
  | "needs_review"
  | "ready"
  | "moved"
  | "waiting_revert"
  | "rejected"
  | "failed"
  | "analyzing"

export interface Job {
  id: number
  source: Source
  group_key: string | null
  group_type: "movie" | "collection" | "show" | null
  source_path: string
  status: JobStatus
  media_type: MediaType | null
  title: string | null
  year: number | null
  season: number | null
  episode: number | null
  confidence: number
  reason: string | null
  target_path: string | null
  error: string | null
  blocked_reason?: string | null
  auto_apply_eligible?: number
  created_at: string
  updated_at: string
  candidates_json: Candidate[] | null
  parsed_json: Record<string, unknown> | null
}

export interface Candidate {
  provider: string
  provider_id: string | null
  title: string
  year: number | null
  overview: string
  image: string | null
  kind: string
  score: number
}

export interface Group {
  key: string
  type: "movie" | "collection" | "show"
  label: string
  counts: Partial<Record<JobStatus, number>>
  total: number
  confidence: number
  source: Source
  jobs: Job[]
}

export interface User {
  id: number
  username: string
  is_admin: boolean
  created_at?: string
}

export interface Stats {
  needs_review?: number
  ready?: number
  moved?: number
  rejected?: number
  failed?: number
  total?: number
  [key: string]: number | undefined
}

export interface Settings {
  min_size_mb: number
  extensions: string[]
  movie_template: string
  tv_template: string
  action: "move" | "copy" | "hardlink"
  cleanup_empty_dirs: boolean
  auto_apply: boolean
  auto_apply_confidence: number
  auto_apply_eligible: number
  auto_apply_blocked: number
  auto_apply_below_threshold: number
  poll_interval: number
  stable_seconds: number
  queue_metadata_poll: number
  queue_promotion_poll: number
  queue_execution_poll: number
  queue_revert_poll: number
  movie_preview: string
  tv_preview: string
}

export interface ReviewJobsResponse {
  items: Job[]
  total: number
  page: number
  page_size: number
  pages: number
}

export interface Shortcut {
  id: number
  title: string
  url: string
  admin_only: boolean
  created_at: string
  updated_at: string
}

export interface LogRow {
  id: number
  created_at: string
  level: string
  source: string
  actor: string | null
  message: string
  detail: string | null
  job_id: number | null
  context: string | null
}

export interface LogsResponse {
  items: LogRow[]
  total: number
  page: number
  page_size: number
  pages: number
}

export interface OperationRow {
  id: number
  job_id: number
  kind: string
  source_path: string
  target_path: string
  status:
    | "queued"
    | "running"
    | "committed"
    | "failed"
    | "reversed"
    | "cancelled"
  progress_done: number
  progress_total: number
  message: string | null
  job_title: string | null
  job_status: string
}

export type SettingsInput = Omit<
  Settings,
  | "movie_preview"
  | "tv_preview"
  | "auto_apply_eligible"
  | "auto_apply_blocked"
  | "auto_apply_below_threshold"
>

export interface SessionResponse {
  token: string
  token_type: "bearer"
  expires_at: number
  user: User
}
