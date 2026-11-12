from __future__ import annotations

import argparse
import logging

import uvicorn

from .config import Config


def main() -> None:
    parser = argparse.ArgumentParser(description="media-renamer")
    parser.add_argument("--once", action="store_true", help="run one scan and exit")
    parser.add_argument("--host", default=None)
    parser.add_argument("--port", type=int, default=None)
    args = parser.parse_args()

    cfg = Config.from_env()
    logging.basicConfig(
        level=getattr(logging, cfg.log_level, logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    from .web import db, jellyfin, llm, scanner

    if args.once:
        count = scanner.scan_once()
        print(f"processed {count} file(s)")
        return

    uvicorn.run(
        "app.web:app",
        host=args.host or cfg.host,
        port=args.port or cfg.port,
        log_level=cfg.log_level.lower(),
    )


if __name__ == "__main__":
    main()
