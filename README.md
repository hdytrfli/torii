# media-renamer

Self-hosted service for turning manually curated downloads into a clean Jellyfin
library.

Status: **M1 is working, plus accounts.** Scanner, `guessit`, local `.nfo`
priority, SQLite, settings, review UI, move/copy/hardlink, multi-user login,
and a JSON API. Jellyfin RemoteSearch and the optional LLM are wired but need
credentials.

See [SPEC.md](./SPEC.md) for the design and the later phases.

## What it does

- Watches a folder on a configurable interval.
- Waits until a file has stopped changing.
- Parses it with `guessit`.
- Reads local `.nfo` metadata first, when present.
- Optionally asks Jellyfin for metadata candidates.
- Optionally asks a cheap LLM for ambiguous names.
- Shows a review page with the source, parsed values, candidates, and target path.
- Moves, copies, or hardlinks the file only after approval.
- Stores jobs and settings in SQLite.
- Exposes the same operations over JSON for a future mobile client.

## Run locally

```bash
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements-dev.txt

export WATCH_DIR="C:/Users/ESI/Downloads/Temporary"
export LIBRARY_DIR="C:/Users/ESI/Downloads/Temporary-library"
export STATE_DIR="C:/Users/ESI/Downloads/Temporary-state"
export MIN_SIZE_MB=0
export STABLE_SECONDS=0

.venv/Scripts/python.exe -m uvicorn app.web:app --host 127.0.0.1 --port 8090
```

Open `http://127.0.0.1:8090`. On a new database, the first visit asks you to
create the initial administrator account.

The scanner runs in the background. `Scan now` triggers it immediately.
`python -m app.main --once` runs one scan and exits.

## Accounts

- The first account created at `/setup` is an administrator.
- Administrators can create users, reset passwords, and delete users at `/users`.
- Every user can change their own password at `/account`.
- Passwords are hashed with `scrypt`; sessions are random server-side tokens.
- UI sessions use an HttpOnly, SameSite=Lax cookie plus CSRF tokens on forms.
- Sessions expire after `SESSION_DAYS` (default 30). Changing a password signs
  out the user’s other sessions.

The setup page is only available while the database has no users.

## Test data

Renaming does not read the video, so empty files are enough:

```bash
: > "Temporary/Spirited.Away.2001.1080p.BluRay.x264-GROUP.mkv"
: > "Temporary/Show.Name.S02E05.1080p.WEB.H264-GROUP.mkv"
```

Set `MIN_SIZE_MB=0` while testing with empty files. In production, keep a real
threshold so samples and junk are ignored.

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

Movie layouts are relative to `LIBRARY_DIR/movies`, show layouts to
`LIBRARY_DIR/shows`.

## Docker

```bash
cp .env.example .env
# edit WATCH_HOST and LIBRARY_HOST
docker compose up -d --build
```

Open the UI and create the first administrator. The compose file publishes on
`127.0.0.1:8090`. Put it behind NetBird, Cloudflare Tunnel with Access, or a
reverse proxy. Do not expose the bare port publicly.

For hardlink mode, the download and library mounts must be on the same
filesystem.

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

Optional LLM fallback uses any OpenAI-compatible endpoint:

```
LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
LLM_API_KEY=...
LLM_MODEL=gemini-2.5-flash
```

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
.venv/Scripts/python.exe -m pytest -q
```

## Notes

- The service never overwrites an existing target. Conflicts go back to review.
- `move` is the default. `copy` keeps the source, `hardlink` requires the same
  filesystem.
- Post actions: `NOTIFY_URL` sends an ntfy message, `POST_ACTION_CMD` runs a
  configured command with `SOURCE`, `TARGET`, `TITLE`, `YEAR`, `SEASON`, and
  `EPISODE` in the environment.
