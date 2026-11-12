# Deployment

Torii can run from a local build or from the published container image.

## Prerequisites

- Docker with the Compose plugin for the Compose options.
- A `.env` file with your provider credentials:

```bash
cp .env.example .env
```

- A writable media directory. The container runs as UID `1000`.

## Compose from source

Use the repository's `docker-compose.yml`:

```bash
docker compose up -d --build
```

The app is available at <http://localhost:8090>.

## Compose with the published image

Replace the `build: .` line in `docker-compose.yml` with:

```yaml
image: ghcr.io/hdytrfli/torii:latest
```

Then run:

```bash
docker compose pull
docker compose up -d
```

Pin a release instead of `latest` for stable deployments:

```yaml
image: ghcr.io/hdytrfli/torii:0.1.0
```

## Standalone Docker

```bash
docker run -d \
  --name torii \
  --restart unless-stopped \
  -p 8090:8000 \
  --env-file .env \
  -v "$PWD/temp:/media" \
  -v "$PWD:/data" \
  ghcr.io/hdytrfli/torii:latest
```

## Volumes and hardlinks

- Mount one shared media root at `/media` when using hardlinks. The download
  and library folders must be on the same filesystem.
- Mount a persistent directory at `/data` so `torii.db` survives restarts.
- The default Compose file uses `./temp` for `/media` and the project root for
  `/data`. Replace these with real paths in production.

## Security

Do not expose port `8090` directly to the public internet. Use a reverse proxy
or VPN, and configure TLS and access control there.
