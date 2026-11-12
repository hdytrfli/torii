import type {
  Group,
  Job,
  SessionResponse,
  Settings,
  Stats,
  User,
} from "./types"

const TOKEN_KEY = "torii_token"
const API_BASE = import.meta.env.VITE_API_BASE ?? ""

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token)
  } else {
    localStorage.removeItem(TOKEN_KEY)
  }
  window.dispatchEvent(new Event("torii:token"))
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers = new Headers(init.headers)
  headers.set("Content-Type", "application/json")
  if (token) headers.set("Authorization", `Bearer ${token}`)

  const response = await fetch(`${API_BASE}${path}`, { ...init, headers })
  if (response.status === 401) {
    setToken(null)
  }
  if (!response.ok) {
    let message = response.statusText
    try {
      const payload = await response.json()
      message = payload.detail ?? message
    } catch {
      // Keep the status text.
    }
    throw new ApiError(response.status, message)
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

function body(data: unknown): RequestInit {
  return { method: "POST", body: JSON.stringify(data) }
}

export const api = {
  setupStatus: () => request<{ needs_setup: boolean }>("/api/setup/status"),
  setup: (username: string, password: string) =>
    request<SessionResponse>("/api/setup", body({ username, password })),
  login: (username: string, password: string) =>
    request<SessionResponse>("/api/login", body({ username, password })),
  logout: () => request<{ ok: boolean }>("/api/logout", { method: "POST" }),
  me: () => request<User>("/api/me"),

  stats: () => request<Stats>("/api/stats"),
  jobs: (status = "all") => request<Job[]>(`/api/jobs?status=${status}&limit=1000`),
  groups: (status = "needs_review") =>
    request<Group[]>(`/api/groups?status=${status}&limit=2000`),
  job: (id: number) => request<Job>(`/api/jobs/${id}`),
  scan: () => request<{ ok: boolean }>("/api/scan", { method: "POST" }),
  approve: (
    id: number,
    data: {
      title: string
      year: number | null
      media_type: "movie" | "tv"
      season: number | null
      episode: number | null
      action?: "move" | "copy" | "hardlink"
    },
  ) => request<{ ok: boolean; message: string; target: string | null }>(`/api/jobs/${id}/approve`, body(data)),
  preview: (
    id: number,
    data: {
      title: string
      year: number | null
      media_type: "movie" | "tv"
      season: number | null
      episode: number | null
    },
  ) => request<{ target: string }>(`/api/jobs/${id}/preview`, body(data)),
  reject: (id: number) => request<{ ok: boolean }>(`/api/jobs/${id}/reject`, { method: "POST" }),
  retry: (id: number) => request<{ ok: boolean; job: Job }>(`/api/jobs/${id}/retry`, { method: "POST" }),
  bulk: (ids: number[], action: "approve" | "reject") =>
    request<{ results: Array<{ id: number; ok: boolean; message: string; target?: string | null }> }>(
      "/api/jobs/bulk",
      body({ ids, action }),
    ),

  settings: () => request<Settings>("/api/settings"),
  saveSettings: (data: Omit<Settings, "movie_preview" | "tv_preview">) =>
    request<Settings>("/api/settings", { method: "PUT", body: JSON.stringify(data) }),

  users: () => request<User[]>("/api/users"),
  createUser: (username: string, password: string, isAdmin: boolean) =>
    request<User>("/api/users", body({ username, password, is_admin: isAdmin })),
  resetPassword: (id: number, password: string) =>
    request<{ ok: boolean }>(`/api/users/${id}/password`, body({ password })),
  deleteUser: (id: number) =>
    request<{ ok: boolean }>(`/api/users/${id}`, { method: "DELETE" }),
  changePassword: (password: string) =>
    request<SessionResponse>("/api/account/password", body({ password })),
}
