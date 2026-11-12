FROM node:22-alpine AS web

RUN corepack enable && corepack prepare pnpm@11.5.1 --activate
WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile

COPY apps/web apps/web
RUN pnpm --filter @torii/web build

FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

ENV PYTHONUNBUFFERED=1 UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy

WORKDIR /app/apps/api

COPY apps/api/pyproject.toml apps/api/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY apps/api/app ./app
COPY config.yaml /app/config.yaml
COPY --from=web /repo/apps/web/dist /app/apps/web/dist

RUN useradd --uid 1000 --create-home --shell /usr/sbin/nologin app && chown -R app:app /app

USER app
EXPOSE 8000

CMD ["uv", "run", "--no-dev", "python", "-m", "app.main"]
