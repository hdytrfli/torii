import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"

export type Theme = "light" | "dark"

const THEME_KEY = "torii_theme"

const ThemeContext = createContext<{
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}>({
  theme: "light",
  setTheme: () => {},
  toggleTheme: () => {},
})

function initialTheme(): Theme {
  if (typeof document === "undefined") return "light"
  const current = document.documentElement.dataset.theme
  return current === "dark" ? "dark" : "light"
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(initialTheme)
  const transitionTimer = useRef<number | null>(null)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    return () => {
      if (transitionTimer.current !== null) {
        window.clearTimeout(transitionTimer.current)
      }
      document.documentElement.classList.remove("theme-switching")
    }
  }, [])

  const setTheme = (next: Theme) => {
    const root = document.documentElement
    root.classList.add("theme-switching")
    void root.offsetWidth
    if (transitionTimer.current !== null) {
      window.clearTimeout(transitionTimer.current)
    }
    transitionTimer.current = window.setTimeout(() => {
      transitionTimer.current = null
      root.classList.remove("theme-switching")
    }, 550)
    root.dataset.theme = next
    root.style.colorScheme = next
    localStorage.setItem(THEME_KEY, next)
    setThemeState(next)
  }

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        toggleTheme: () =>
          setTheme(theme === "dark" ? "light" : "dark"),
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
