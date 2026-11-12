import axios from "axios"
import { tokenStore } from "./token-store"

const API_BASE = import.meta.env.VITE_API_BASE ?? ""

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

export const http = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
})

http.interceptors.request.use((config) => {
  const token = tokenStore.get()
  if (token) config.headers.set("Authorization", `Bearer ${token}`)
  return config
})

http.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status ?? 0
    if (status === 401) {
      tokenStore.clear()
      window.dispatchEvent(new Event("torii:unauthorized"))
    }
    const payload = error.response?.data
    const detail =
      (typeof payload === "object" && payload?.detail) ||
      error.message ||
      "Request failed"
    return Promise.reject(new ApiError(status, String(detail)))
  },
)
