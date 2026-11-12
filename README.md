# media-renamer

Self-hosted service for turning manually curated downloads into a clean Jellyfin
library.

Status: **M1 is working.** Scanner, `guessit`, SQLite, settings, review UI,
move/copy/hardlink, and a JSON API. Jellyfin RemoteSearch and the optional LLM
are wired but need credentials.

See [SPEC.md](./SPEC.md) for the design and the later phases.

## What it does

- Watches a folder on a configurable interval.
- Waits until a file has stopped changing.
- Parses it with `guessit`.
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

Open `http://127.0.0.1:8090`.

The scanner runs in the background. `Scan now` triggers it immediately.
`python -m app.main --once` runs one scan and exits.

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
# edit WATCH_HOST, LIBRARY_HOST, APP_TOKEN
docker compose up -d --build
```

The compose file publishes on `127.0.0.1:8090`. Put it behind NetBird or a
reverse proxy. Do not expose it publicly.

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

Optional LLM fallback uses any OpenAI-compatible endpoint:

```
LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
LLM_API_KEY=...
LLM_MODEL=gemini-2.5-flash
```

## API

All routes return JSON. If `APP_TOKEN` is set, send
`Authorization: Bearer <token>`.

```
GET  /api/health
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
