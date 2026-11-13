import type { Theme } from "./theme"

const ICON_PATHS = `
  <path d="M10 18v-7" />
  <path d="M11.119 2.205a2 2 0 0 1 1.762 0l7.84 3.846A.5.5 0 0 1 20.5 7h-17a.5.5 0 0 1-.22-.949z" />
  <path d="M14 18v-7" />
  <path d="M18 18v-7" />
  <path d="M3 22h18" />
  <path d="M6 18v-7" />
`

function faviconHref(theme: Theme) {
  const stroke = theme === "dark" ? "#ffffff" : "#1b1b1b"
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" transform="translate(2.4 2.4) scale(0.8)">${ICON_PATHS}</g></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

export function applyFavicon(theme: Theme) {
  let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']")
  if (!link) {
    link = document.createElement("link")
    link.rel = "icon"
    document.head.appendChild(link)
  }
  link.type = "image/svg+xml"
  link.href = faviconHref(theme)
}
