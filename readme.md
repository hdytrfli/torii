# torii

Self-hosted service for turning manually curated downloads into a clean Jellyfin
library.

Status: **monorepo is working.** FastAPI API in `apps/api` using
`uv`; Vite + React + Tailwind v4 frontend in `apps/web`. Scanner, `guessit`,
local `.nfo` priority, SQLite, grouped review, move/copy/hardlink, and
multi-user bearer auth are working. Jellyfin RemoteSearch is verified; the
OpenCode LLM key still needs Models: Request permission.

See [spec.md](./spec.md) for the design and the later phases.

## What it does

- Watches a folder on a configurable interval.
- Waits until a file has stopped changing.
- Parses it with `guessit`.
- Reads local `.nfo` metadata first, when present.
- Optionally asks Jellyfin for metadata candidates.
- Optionally asks a cheap LLM for ambiguous names.
- Shows a review page with the source, parsed values, candidates, match source,
  and target path.
- Moves, copies, or hardlinks the file only after approval.
- Stores jobs and settings in SQLite.
- Exposes the same operations over JSON for a future mobile client.

## Run

```bash
cp .env.example .env
# fill in Jellyfin and AI provider details
docker compose up -d --build
```

Open `http://127.0.0.1:8090`. Compose seeds a default account:

```text
username: test
password: example
```

Change it after signing in. If `DEFAULT_USERNAME` / `DEFAULT_PASSWORD` are
removed, the first visit shows the setup screen instead.

Behavioral settings live in `config.yaml`. `.env` contains only the Jellyfin
and AI provider details. Compose mounts `./temp` at `/media` and the project root at `/data`. The
container then uses `/media/downloads/movies`, `/media/downloads/shows`,
`/media/library/movies`, and `/media/library/shows`. The SQLite
database is `torii.db` in the project root.

Validate both layers before starting:

```bash
(cd apps/api && uv run python -m app.main --check-config)
docker compose config --quiet
```

See [docs/configuration.md](./docs/configuration.md) for the `apply` rules,
naming layouts, and every YAML section.

The scanner runs in the background. `Scan now` triggers it immediately.
`(cd apps/api && uv run python -m app.main --once)` runs one scan and exits.

## Monorepo

```text
apps/api        FastAPI, uv, SQLite, scanner
apps/web        Vite, React, Tailwind v4
config.yaml     behavior and layout settings
torii.db        SQLite database in the project root
temp/           local test downloads and library
```

## Development

```bash
pnpm install
(cd apps/api && uv sync)
docker compose up -d          # API and built web app on :8090
pnpm dev                       # Vite on :5173, proxying /api to :8090
```

The Vite dev server is only for frontend work. The production image builds the
frontend and serves it from FastAPI.

## Accounts

- Compose seeds `test` / `example` as the first administrator on an empty database.
- Administrators can reset passwords and delete accounts in the React Users page.
- Passwords are hashed with `scrypt`; sessions are random server-side tokens.
- The React app stores a bearer session token and sends it with API requests.
- Sessions expire after `session_days` in `config.yaml` (default 30). Changing a password signs
  out the userâ€™s other sessions.

The setup screen appears only when the database has no users and no default credentials are configured.

## Test data

Renaming does not read the video, so empty files are enough:

```bash
: > "temp/downloads/movies/Spirited.Away.2001.1080p.BluRay.x264-GROUP.mkv"
: > "temp/downloads/shows/Show.Name.S02E05.1080p.WEB.H264-GROUP.mkv"
```

Set `scan.min_size_mb: 0` in `config.yaml` while testing with empty files. In
production, keep a real threshold so samples and junk are ignored.

## Settings

The settings page is stored in SQLite and applies on the next scan:

- minimum file size
- handled extensions
- movie and show layouts
- move, copy, or hardlink
- auto-apply threshold
- poll and stability intervals
- dry run

Layout placeholders:

```
{title} {year} {folder} {season} {episode} {episode_tag}
{quality} {source} {codec} {group} {ext}
```

Movie layouts are relative to `paths.library.movies`, show layouts to
`paths.library.shows`.

The current layouts are:

```text
Movie: {title} ({year})/{title}
Show:  {title} ({year})/Season {season}/{title} - Season {season} Episode {episode}
```

Both parent folders use `Title (Year)`. `{title}` is the name without the year,
and `{season}` / `{episode}` are unpadded. The extension is appended
automatically. If a year is missing, the empty `()` is stripped.

Jellyfin generally expects `S01E01`-style episode tags. This layout may not be
detected as an episode by Jellyfin; use `{episode_tag}` if that becomes a
problem.

## Docker

```bash
cp .env.example .env
# edit the Jellyfin and AI provider details
docker compose up -d --build
```

The default mount is `./temp` at `/media`. For the atlas deployment, mount the
atlas root once at `/media` so hardlinks work across downloads and library.

Open the UI and create the first administrator. The compose file publishes on
`127.0.0.1:8090`. Put it behind NetBird, Cloudflare Tunnel with Access, or a
reverse proxy. Do not expose the bare port publicly.

For hardlink mode, downloads and library must live under the same `/media`
mount; separate bind mounts return `EXDEV`.

## Metadata

Preferred: Jellyfin RemoteSearch. Jellyfin already bundles its own TMDb and OMDb
keys, so you only provide a Jellyfin URL and API key:

```
JELLYFIN_URL=http://nichi:8096
JELLYFIN_API_KEY=...
```

Without that, the service still renames from `guessit` and queues everything for
review.

Local `.nfo` files are read first: a sidecar named after the video, or
`movie.nfo` / `tvshow.nfo` in the release folder. A `<uniqueid>` plus title and
year is enough to force the exact item. Sidecar `.nfo` files move with the
video; folder-level files are read in place.

Optional LLM fallback uses any OpenAI-compatible endpoint. The current setup uses
OpenCode inference with DeepSeek:

```
LLM_BASE_URL=https://opencode.ai/inference/openai/v1
LLM_API_KEY=oc_sk_...
LLM_MODEL=deepseek-v4.1-flash
```

The OpenCode key needs **Models: Request** permission. A key with only
**Models: Read** can list models but returns `permission_error` when called.
Free-tier chat models require the OpenCode client itself; direct calls need a
paid model or OpenCode Go.

### Match source and AI policy

Every job shows where its match came from:

- **Filename (guessit)**: parsed from the release name.
- **Jellyfin**: accepted a provider candidate above the score threshold.
- **Local NFO**: local metadata took priority.
- **AI fallback**: no provider candidates existed, so the LLM was asked.
- **Manual edit**: a human changed the metadata before approving.

AI is the last resort. It is not called when Jellyfin returns candidates, even
weak ones, and it is not called for verification. Weak candidates stay in the
review UI for a human. This keeps AI calls to the cases where there is truly
nothing else to match.

## API

The JSON API uses bearer session tokens. Sign in first:

```bash
curl -s http://127.0.0.1:8090/api/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"alice","password":"..."}'
```

That returns:

```json
{
  "token": "...",
  "token_type": "bearer",
  "expires_at": 1790000000,
  "user": {"id": 1, "username": "alice", "is_admin": true}
}
```

Send the token on every other API call:

```
Authorization: Bearer <token>
```

Routes:

```
GET  /api/health                 (no auth)
POST /api/login                  (no auth)
POST /api/logout
GET  /api/me
GET  /api/stats
GET  /api/jobs?status=needs_review
GET  /api/jobs/{id}
POST /api/scan
POST /api/jobs/{id}/approve
POST /api/jobs/{id}/reject
POST /api/jobs/{id}/retry
```

Approve body:

```json
{
  "title": "Spirited Away",
  "year": 2001,
  "media_type": "movie",
  "season": null,
  "episode": null,
  "action": "move"
}
```

## Tests

```bash
(cd apps/api && uv run pytest -q)
pnpm --filter @torii/web build
```

## Notes

- The service never overwrites an existing target. Conflicts go back to review.
- `move` is the default. `copy` keeps the source, `hardlink` requires the same
  filesystem.
- Post actions: `NOTIFY_URL` sends an ntfy message, `POST_ACTION_CMD` runs a
  configured command with `SOURCE`, `TARGET`, `TITLE`, `YEAR`, `SEASON`, and
  `EPISODE` in the environment.
