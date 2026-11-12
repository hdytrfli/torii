# Torii

Torii is a self-hosted media renamer for curated downloads. It watches incoming
files, enriches them with metadata, keeps uncertain matches in a review queue,
and moves, copies, or hardlinks approved files into a Jellyfin-compatible
library.

Built with FastAPI, React, SQLite, and Docker.

## Features

- Watches movie and TV download folders on a configurable interval.
- Resolves metadata through Jellyfin RemoteSearch, local `.nfo` files, filename
  parsing, and optional AI fallback.
- Keeps uncertain matches in a review queue with filtering, sorting, bulk
  actions, row previews, and undo.
- Supports manual identification by TMDb, IMDb, or TVDB ID.
- Provides naming layouts with draggable tokens and live previews.
- Moves, copies, or hardlinks approved files into a Jellyfin library.
- Cleans up empty source folders after successful applies.
- Includes multi-user authentication with administrator controls.
- Stores jobs, users, and settings in SQLite.
- Runs as a single Docker container with Docker Compose.

## Deploy

```bash
cp .env.example .env
# Add your Jellyfin and optional AI provider credentials.
docker compose up -d --build
```

Open <http://localhost:8090>. Compose mounts `./temp` at `/media` and the project
root at `/data`; adjust those mounts for your download and library paths.

## License

GPL-3.0-only. See [LICENSE](LICENSE).
