from __future__ import annotations

import json
import logging
import re
from contextvars import ContextVar


JOB_ID_PATTERN = re.compile(r"\bjob\s+#?(\d+)\b", re.IGNORECASE)
current_actor: ContextVar[str] = ContextVar("current_actor", default="system")


def set_actor(actor: str | None) -> object:
    return current_actor.set(actor or "system")


def reset_actor(token: object) -> None:
    current_actor.reset(token)


class DatabaseLogHandler(logging.Handler):
    def __init__(self, db):
        super().__init__(level=logging.INFO)
        self.db = db

    def emit(self, record: logging.LogRecord) -> None:
        try:
            message = record.getMessage()
            detail_value = getattr(record, "detail", None)
            if detail_value is None:
                detail_value = {"message": message}
            if record.exc_info:
                detail_value = {
                    "message": message,
                    "traceback": self.formatException(record.exc_info),
                }
            if isinstance(detail_value, str):
                try:
                    detail_value = json.loads(detail_value)
                except ValueError:
                    detail_value = {"message": detail_value}
            detail = json.dumps(
                detail_value, ensure_ascii=False, indent=2, default=str
            )
            context = getattr(record, "context", None)
            actor = getattr(record, "actor", None)
            if not actor and isinstance(context, dict):
                actor = context.get("actor") or context.get("username")
            if not actor:
                actor = current_actor.get()
            job_id = getattr(record, "job_id", None)
            if job_id is None:
                match = JOB_ID_PATTERN.search(message)
                if match:
                    job_id = int(match.group(1))
            if context is not None:
                if isinstance(context, str):
                    try:
                        context = json.loads(context)
                    except ValueError:
                        context = {"message": context}
                context = json.dumps(
                    context, ensure_ascii=False, indent=2, default=str
                )
            self.db.add_log(
                level=record.levelname,
                source=record.name,
                message=message,
                detail=detail,
                job_id=job_id,
                actor=actor,
                context=context,
            )
        except Exception:
            self.handleError(record)
