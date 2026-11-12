from pathlib import Path

import pytest

from app import auth
from app.db import DB


def test_password_hash_roundtrip():
    encoded = auth.hash_password("correct horse battery staple")
    assert encoded.startswith("scrypt$")
    assert auth.verify_password("correct horse battery staple", encoded)
    assert not auth.verify_password("wrong", encoded)


def test_username_and_password_validation():
    assert auth.validate_username("alice") is None
    assert auth.validate_username("a") is not None
    assert auth.validate_username("bad name") is not None
    assert auth.validate_password("longenough") is None
    assert auth.validate_password("short") is not None


def test_user_and_session_lifecycle(tmp_path: Path):
    db = DB(tmp_path / "state.db")
    user = db.create_user("alice", auth.hash_password("password123"), is_admin=True)

    assert db.count_users() == 1
    assert db.count_admins() == 1
    assert auth.authenticate(db, "ALICE", "password123")["username"] == "alice"
    assert auth.authenticate(db, "alice", "wrong") is None

    raw_token, session = auth.start_session(db, user, 30)
    assert session["username"] == "alice"
    assert session["is_admin"] == 1
    assert auth.get_session(db, raw_token) is not None

    db.delete_session(auth.hash_token(raw_token))
    assert auth.get_session(db, raw_token) is None


def test_duplicate_username_is_rejected(tmp_path: Path):
    db = DB(tmp_path / "state.db")
    db.create_user("alice", auth.hash_password("password123"))
    with pytest.raises(Exception):
        db.create_user("alice", auth.hash_password("password123"))
