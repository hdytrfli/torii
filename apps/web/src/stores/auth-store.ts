import { create } from "zustand"
import { api } from "../lib/api"
import { tokenStore } from "../lib/token-store"
import type { User } from "../lib/types"

interface AuthState {
  user: User | null
  loading: boolean
  hydrate: () => Promise<void>
  login: (username: string, password: string) => Promise<void>
  setup: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  clear: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,

  hydrate: async () => {
    if (!tokenStore.get()) {
      set({ user: null, loading: false })
      return
    }
    try {
      const user = await api.me()
      set({ user, loading: false })
    } catch {
      tokenStore.clear()
      set({ user: null, loading: false })
    }
  },

  login: async (username, password) => {
    const session = await api.login(username, password)
    tokenStore.set(session.token)
    set({ user: session.user })
  },

  setup: async (username, password) => {
    const session = await api.setup(username, password)
    tokenStore.set(session.token)
    set({ user: session.user })
  },

  logout: async () => {
    try {
      await api.logout()
    } finally {
      tokenStore.clear()
      set({ user: null })
    }
  },

  clear: () => {
    tokenStore.clear()
    set({ user: null })
  },
}))
