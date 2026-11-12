from __future__ import annotations

import base64
import hashlib
import hmac
import re
import secrets
import time
from typing import Any

from .db import DB

SESSION_COOKIE = "renamer_session"
SCRYPT_N = 2**14
SCRYPT_R = 8
SCRYPT_P = 1
SCRYPT_DKLEN = 32
PASSWORD_MIN = 8
PASSWORD_MAX = 200

USERNAME_RE = re.compile(r"^[a-z0-9][a-z0-9_.-]{2,31}$")


def _b64encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def _b64decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def normalize_username(username: str) -> str:
    return username.strip().lower()


def validate_username(username: str) -> str | None:
    if not USERNAME_RE.fullmatch(normalize_username(username)):
        return "Username must be 3-32 characters: letters, numbers, dot, dash, underscore."
    return None


def validate_password(password: str) -> str | None:
    if len(password) < PASSWORD_MIN:
        return f"Password must be at least {PASSWORD_MIN} characters."
    if len(password) > PASSWORD_MAX:
        return f"Password must be at most {PASSWORD_MAX} characters."
    return None


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        n=SCRYPT_N,
        r=SCRYPT_R,
        p=SCRYPT_P,
        dklen=SCRYPT_DKLEN,
    )
    return (
        f"scrypt${SCRYPT_N}${SCRYPT_R}${SCRYPT_P}"
        f"${_b64encode(salt)}${_b64encode(digest)}"
    )


def verify_password(password: str, encoded: str) -> bool:
    try:
        scheme, n, r, p, salt_b64, digest_b64 = encoded.split("$")
        if scheme != "scrypt":
            return False
        salt = _b64decode(salt_b64)
        expected = _b64decode(digest_b64)
        actual = hashlib.scrypt(
            password.encode("utf-8"),
            salt=salt,
            n=int(n),
            r=int(r),
            p=int(p),
            dklen=len(expected),
        )
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(actual, expected)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def public_user(user: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": user["id"],
        "username": user["username"],
        "is_admin": bool(user["is_admin"]),
    }


def authenticate(db: DB, username: str, password: str) -> dict[str, Any] | None:
    user = db.get_user_by_username(normalize_username(username))
    if user is None:
        return None
    if not verify_password(password, user["password_hash"]):
        return None
    return public_user(user)


def start_session(
    db: DB, user: dict[str, Any], session_days: int
) -> tuple[str, dict[str, Any]]:
    raw_token = secrets.token_urlsafe(32)
    csrf_token = secrets.token_urlsafe(24)
    expires_at = int(time.time()) + max(1, session_days) * 86400
    db.create_session(
        user_id=int(user["id"]),
        token_hash=hash_token(raw_token),
        csrf_token=csrf_token,
        expires_at=expires_at,
    )
    session = db.get_session(hash_token(raw_token))
    if session is None:
        raise RuntimeError("Created session could not be read back")
    return raw_token, session


def get_session(db: DB, raw_token: str | None) -> dict[str, Any] | None:
    if not raw_token:
        return None
    return db.get_session(hash_token(raw_token))
