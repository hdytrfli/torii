# media-renamer

Status: **design only. No implementation yet.**

A small self-hosted service for turning manually curated downloads into a clean
Jellyfin library.

- Watches a folder on a schedule.
- Parses release names with `guessit`.
- Optionally asks Jellyfin for metadata candidates, so no separate TMDb key is needed.
- Optionally asks a cheap LLM when the parse is ambiguous.
- Queues uncertain files for review in a web UI.
- Moves, copies, or hardlinks approved files into the library.
- Keeps progress in SQLite.
- Exposes a JSON API so a mobile client can be added later.

See [SPEC.md](./SPEC.md) for the architecture, data model, API, and open questions.
