const TOKEN_KEY = "torii_token"

let current = localStorage.getItem(TOKEN_KEY)

export const tokenStore = {
  get: () => current,
  set: (token: string) => {
    current = token
    localStorage.setItem(TOKEN_KEY, token)
  },
  clear: () => {
    current = null
    localStorage.removeItem(TOKEN_KEY)
  },
}
