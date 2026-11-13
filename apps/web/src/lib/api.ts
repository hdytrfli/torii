import { http } from "./http"
import type {
  Group,
  Job,
  LogsResponse,
  OperationRow,
  ReviewJobsResponse,
  SessionResponse,
  Settings,
  SettingsInput,
  Shortcut,
  Stats,
  User,
} from "./types"

export { ApiError } from "./http"

export const api = {
  setupStatus: async () => (await http.get<{ needs_setup: boolean }>("/api/setup/status")).data,
  setup: async (username: string, password: string) =>
    (await http.post<SessionResponse>("/api/setup", { username, password })).data,
  login: async (username: string, password: string) =>
    (await http.post<SessionResponse>("/api/login", { username, password })).data,
  logout: async () => (await http.post<{ ok: boolean }>("/api/logout")).data,
  me: async () => (await http.get<User>("/api/me")).data,

  stats: async () => (await http.get<Stats>("/api/stats")).data,
  jobs: async (status = "all") =>
    (await http.get<Job[]>("/api/jobs", { params: { status, limit: 1000 } })).data,
  groups: async (status = "needs_review") =>
    (await http.get<Group[]>("/api/groups", { params: { status, limit: 2000 } })).data,
  logs: async (params: {
    level?: string
    q?: string
    sort?: string
    direction?: "asc" | "desc"
    page?: number
    page_size?: number
  }) => (await http.get<LogsResponse>("/api/logs", { params })).data,
  deleteLogs: async (ids: number[]) =>
    (await http.post<{ ok: boolean; deleted: number }>("/api/logs/delete", { ids })).data,
  reviewJobs: async (params: {
    status?: string
    source?: string
    media_type?: string
    q?: string
    sort?: string
    direction?: "asc" | "desc"
    page?: number
    page_size?: number
  }) => (await http.get<ReviewJobsResponse>("/api/jobs/page", { params })).data,
  job: async (id: number) => (await http.get<Job>(`/api/jobs/${id}`)).data,
  scan: async () => (await http.post<{ ok: boolean }>("/api/scan")).data,
  scanStatus: async () =>
    (
      await http.get<{
        running: boolean
        stage: string
        started_at: number | null
        finished_at: number | null
        processed: number
        total: number
        current: string | null
        error: string | null
      }>("/api/scan/status")
    ).data,
  approve: async (
    id: number,
    data: {
      title: string
      year: number | null
      media_type: "movie" | "tv"
      season: number | null
      episode: number | null
      action?: "move" | "copy" | "hardlink"
    },
  ) =>
    (
      await http.post<{
        ok: boolean
        message: string
        target: string | null
        queued?: boolean
        operation_id?: number
      }>(`/api/jobs/${id}/approve`, data)
    ).data,
  updateJob: async (
    id: number,
    data: {
      title: string
      year: number | null
      media_type: "movie" | "tv"
      season: number | null
      episode: number | null
    },
  ) => (await http.patch<Job>(`/api/jobs/${id}`, data)).data,
  preview: async (
    id: number,
    data: {
      title: string
      year: number | null
      media_type: "movie" | "tv"
      season: number | null
      episode: number | null
    },
  ) => (await http.post<{ target: string }>(`/api/jobs/${id}/preview`, data)).data,
  undo: async (id: number) =>
    (await http.post<{ ok: boolean; message: string; job: Job }>(`/api/jobs/${id}/undo`)).data,
  reject: async (id: number) =>
    (await http.post<{ ok: boolean }>(`/api/jobs/${id}/reject`)).data,
  deleteJob: async (id: number) =>
    (await http.delete<{ ok: boolean; message: string }>(`/api/jobs/${id}`)).data,
  retry: async (id: number) =>
    (await http.post<{ ok: boolean; job: Job }>(`/api/jobs/${id}/retry`)).data,
  askAi: async (id: number) => (await http.post<Job>(`/api/jobs/${id}/ai`)).data,
  identify: async (
    id: number,
    provider: "tmdb" | "imdb" | "tvdb",
    externalId: string,
    mediaType?: "movie" | "tv",
  ) =>
    (await http.post<Job>(`/api/jobs/${id}/identify`, {
      provider,
      id: externalId,
      media_type: mediaType,
    })).data,
  bulk: async (ids: number[], action: "approve" | "reject" | "undo") =>
    (
      await http.post<{
        results: Array<{
          id: number
          ok: boolean
          message: string
          target?: string | null
          queued?: boolean
          operation_id?: number
        }>
      }>("/api/jobs/bulk", { ids, action })
    ).data,
  operations: async () =>
    (
      await http.get<{
        running: OperationRow | null
        queued: number
        ready?: number
        metadata?: number
        promotion?: number
        execution?: number
        revert?: number
        active: OperationRow[]
        recent: OperationRow[]
      }>("/api/operations")
    ).data,

  previewLayout: async (data: {
    movie_template: string
    tv_template: string
    movie_title?: string
    movie_year?: number | null
    show_title?: string
    show_year?: number | null
    season?: number
    episode?: number
  }) => (await http.post<{ movie: string; shows: string }>("/api/layout/preview", data)).data,
  settings: async () => (await http.get<Settings>("/api/settings")).data,
  saveSettings: async (data: SettingsInput) =>
    (await http.put<Settings>("/api/settings", data)).data,

  shortcuts: async () => {
    const data = (await http.get<Shortcut[] | { items?: Shortcut[] }>(
      "/api/shortcuts",
    )).data
    if (Array.isArray(data)) return data
    if (data && Array.isArray(data.items)) return data.items
    return []
  },
  createShortcut: async (data: {
    title: string
    url: string
    admin_only: boolean
  }) => (await http.post<Shortcut>("/api/shortcuts", data)).data,
  updateShortcut: async (
    id: number,
    data: {
      title: string
      url: string
      admin_only: boolean
    },
  ) => (await http.put<Shortcut>(`/api/shortcuts/${id}`, data)).data,
  deleteShortcut: async (id: number) =>
    (await http.delete<{ ok: boolean }>(`/api/shortcuts/${id}`)).data,

  users: async () => (await http.get<User[]>("/api/users")).data,
  createUser: async (username: string, password: string, isAdmin: boolean) =>
    (await http.post<User>("/api/users", { username, password, is_admin: isAdmin })).data,
  resetPassword: async (id: number, password: string) =>
    (await http.post<{ ok: boolean }>(`/api/users/${id}/password`, { password })).data,
  deleteUser: async (id: number) =>
    (await http.delete<{ ok: boolean }>(`/api/users/${id}`)).data,
  changePassword: async (password: string) =>
    (await http.post<SessionResponse>("/api/account/password", { password })).data,
}
