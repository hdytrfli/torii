export type TokenName =
  | "title"
  | "year"
  | "folder"
  | "season"
  | "episode"
  | "episode_tag"
  | "quality"
  | "source"
  | "codec"
  | "group"
  | "ext"

export const TOKEN_DRAG_TYPE = "application/x-torii-token"

export const TOKEN_DEFS: Record<TokenName, { label: string; hint: string }> = {
  title: { label: "Title", hint: "Title without the year" },
  year: { label: "Year", hint: "Release year" },
  folder: { label: "Folder", hint: "Title (Year)" },
  season: { label: "Season", hint: "Season number" },
  episode: { label: "Episode", hint: "Episode number" },
  episode_tag: { label: "Episode tag", hint: "S01E01" },
  quality: { label: "Quality", hint: "1080p, 2160p, etc." },
  source: { label: "Source", hint: "BluRay, WEB-DL, etc." },
  codec: { label: "Codec", hint: "x264, x265, etc." },
  group: { label: "Group", hint: "Release group" },
  ext: { label: "Extension", hint: "File extension" },
}

export const TOKEN_GROUPS: Array<{ label: string; tokens: TokenName[] }> = [
  { label: "Metadata", tokens: ["title", "year", "folder"] },
  { label: "Episode", tokens: ["season", "episode", "episode_tag"] },
  { label: "Release", tokens: ["quality", "source", "codec", "group"] },
  { label: "File", tokens: ["ext"] },
]

export function tokenLabel(token: string) {
  const definition = TOKEN_DEFS[token as TokenName]
  if (definition) return definition.label
  return token.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase())
}
