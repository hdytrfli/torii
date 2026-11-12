# Configuration

There are three places to look:

- `.env`: Jellyfin and AI provider details only. Gitignored.
- `config.yaml`: application behavior. Committed and validated.
- `compose.yaml`: host mount paths and container wiring.

The SQLite database is `torii.db` in the project root.

## `.env`

```dotenv
JELLYFIN_URL=https://jellyfin.nichi.my.id
JELLYFIN_API_KEY=...

LLM_BASE_URL=https://opencode.ai/inference/openai/v1
LLM_API_KEY=...
LLM_MODEL=deepseek-v4.1-flash
```

These values are read as environment variables by the app. Jellyfin is enabled
when both URL and key are present. The LLM is enabled when base URL, key, and
model are present.

The LLM is only called when Jellyfin returns no candidates at all. It is not
used to verify Jellyfin matches. The UI labels each job with its match source:
filename/guessit, Jellyfin, local NFO, AI fallback, or manual edit.

## `config.yaml`

### `paths`

Container paths. The host side is configured by `compose.yaml`.

```yaml
paths:
  watch:
    movies: /downloads/movies
    shows: /downloads/shows
  library:
    movies: /library/movies
    shows: /library/shows
  state: /data
```

The default Compose mounts are:

| Container | Host |
| --- | --- |
| `/downloads/movies` | `./temp/downloads/movies` |
| `/downloads/shows` | `./temp/downloads/shows` |
| `/library/movies` | `./temp/library/movies` |
| `/library/shows` | `./temp/library/shows` |
| `/data` | `.` |

The last mount is why `torii.db` appears in the project root.

### `server`

```yaml
server:
  host: 0.0.0.0
  port: 8000
  log_level: INFO
```

### `session_days`

How long browser and API sessions stay valid. Password changes revoke the
user's other sessions.

### `scan`

```yaml
scan:
  min_size_mb: 0
  extensions: [mkv, mp4]
  poll_interval: 5
  stable_seconds: 0
```

- `min_size_mb`: ignore files smaller than this. Use `0` for empty test files.
- `extensions`: handled file types.
- `poll_interval`: seconds between scans.
- `stable_seconds`: file size and mtime must stay unchanged this long before it
  is analyzed. Use `0` for tests.

### `layout`

```yaml
layout:
  movie: "{title} ({year})/{title}"
  shows: "{title} ({year})/Season {season}/{title} - Season {season} Episode {episode}"
```

- `{folder}`: `Title (Year)`, used for both parent folders.
- `{title}`: title without the year.
- `{season}`, `{episode}`: integers, unpadded.
- `{episode_tag}`: padded tag such as `S02E05`.
- Other placeholders: `{year}`, `{quality}`, `{source}`, `{codec}`, `{group}`.
- The source extension is appended automatically.

The layouts produce:

```text
Spirited Away (2001)/Spirited Away.mkv
Dark (2017)/Season 1/Dark - Season 1 Episode 1.mkv
```

Jellyfin normally expects `SxxExx` tags for episodes. The layout above is the
requested human-readable format, but Jellyfin may not detect those files as
episodes. Use `{episode_tag}` if that happens.

### `apply`

```yaml
apply:
  action: move

  # only used when action is copy
  copy:
    delete_source: false

  # runs after any successful apply
  cleanup_empty_dirs: true

  # unattended decisions
  automation:
    auto_apply: false
    auto_apply_confidence: 0.85

  # calculate the target without touching files
  dry_run: false
```

The block is grouped by when each option applies.

**Action**

- `action: move`: source disappears; target gets the data. No extra options.
- `action: copy`: source stays; target gets a second copy. Only this action
  reads `copy.delete_source`.
- `action: hardlink`: source stays; target shares the same data blocks. The
  download and library paths must be on the same filesystem. No extra options.

**Copy only**

- `copy.delete_source`: if true, delete the source after the copy succeeds.
  This makes copy behave like a controlled move.

**After any successful apply**

- `cleanup_empty_dirs`: remove empty parent folders up to the watch root. It
  never removes the watch root itself.

**Automation**

- `automation.auto_apply`: when false, every job waits for human approval. When
  true, jobs at or above the confidence threshold are applied without review.
- `automation.auto_apply_confidence`: number from `0` to `1`. Only used when
  `auto_apply` is true. Higher means fewer automatic moves.

**Preview**

- `dry_run`: when true, calculate and report the target without modifying
  files.

The service never overwrites an existing target. A conflict returns the job to
review with an error. Matching subtitle and sidecar `.nfo` files follow the
video according to the same action.

## Runtime overrides

`config.yaml` seeds the settings table when the database is first created. The
web Settings page stores runtime overrides in SQLite. Changing `config.yaml`
later does not overwrite those existing overrides. Either update the Settings
page or remove `torii.db` to start from the YAML defaults again.

## Validation

```bash
python -m app.main --check-config
docker compose config --quiet
```

The first command validates types, required keys, known keys, extensions,
actions, naming templates, and provider environment details. The second
validates the Compose file and mount syntax.
