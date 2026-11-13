from __future__ import annotations

import asyncio
import json
import logging

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from .. import deps

router = APIRouter(prefix="/api", tags=["events"])
logger = logging.getLogger(__name__)

POLL_SECONDS = 1.0


def _event(name: str, payload: object) -> str:
    data = json.dumps(payload, ensure_ascii=False, default=str)
    return f"event: {name}\ndata: {data}\n\n"


@router.get("/events")
async def events(request: Request):
    session = deps.current_session(request)
    is_admin = bool(session.get("is_admin"))

    async def stream():
        last_job_id = 0
        last_log_id = 0
        last_jobs: dict | None = None
        last_queue: dict | None = None
        last_scan: dict | None = None

        try:
            if is_admin:
                last_log_id = deps.db.max_log_id()
            last_jobs = deps.db.jobs_fingerprint()
            last_job_id = int(last_jobs.get("max_id") or 0)
            last_queue = deps.operations.status()
            last_scan = deps.scanner.status()
        except Exception:
            logger.exception("Could not prepare event stream")

        yield "retry: 3000\n\n"
        yield _event("ready", {"ok": True, "admin": is_admin})
        if last_jobs is not None:
            yield _event("jobs_changed", last_jobs)
        if last_queue is not None:
            yield _event("queue", last_queue)
        if last_scan is not None:
            yield _event("scan", last_scan)

        while True:
            if await request.is_disconnected():
                break

            try:
                jobs = await asyncio.to_thread(
                    deps.db.jobs_after, last_job_id, 100
                )
                if jobs:
                    last_job_id = max(int(job["id"]) for job in jobs)
                    for job in jobs:
                        yield _event("job", deps.db.job_json(job))

                jobs_fingerprint = await asyncio.to_thread(
                    deps.db.jobs_fingerprint
                )
                if jobs_fingerprint != last_jobs:
                    last_jobs = jobs_fingerprint
                    yield _event("jobs_changed", jobs_fingerprint)

                if is_admin:
                    logs = await asyncio.to_thread(
                        deps.db.logs_after, last_log_id, 100
                    )
                    if logs:
                        last_log_id = max(int(log["id"]) for log in logs)
                        for log in logs:
                            yield _event("log", log)

                queue = await asyncio.to_thread(deps.operations.status)
                if queue != last_queue:
                    last_queue = queue
                    yield _event("queue", queue)

                scan = deps.scanner.status()
                if scan != last_scan:
                    last_scan = scan
                    yield _event("scan", scan)
            except Exception:
                logger.exception("Event stream loop failed")

            yield ": keep-alive\n\n"
            await asyncio.sleep(POLL_SECONDS)

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
