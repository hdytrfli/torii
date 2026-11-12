FROM node:22-alpine AS web

RUN corepack enable && corepack prepare pnpm@11.5.1 --activate
WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile

COPY apps/web apps/web
RUN pnpm --filter @torii/web build

FROM python:3.12-slim AS api

COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv
ENV UV_NO_CACHE=1 UV_LINK_MODE=copy

WORKDIR /app/apps/api

COPY apps/api/pyproject.toml apps/api/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1

RUN useradd --uid 1000 --create-home --shell /usr/sbin/nologin app

WORKDIR /app/apps/api

COPY --from=api --chown=app:app /app/apps/api/.venv ./.venv
COPY --chown=app:app apps/api/app ./app
COPY --chown=app:app config.yaml /app/config.yaml
COPY --chown=app:app --from=web /repo/apps/web/dist /app/apps/web/dist

USER app
EXPOSE 8000

CMD [".venv/bin/python", "-m", "app.main"]
