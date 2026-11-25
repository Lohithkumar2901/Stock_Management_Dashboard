"""Thread-safe JSON-Lines logger for login events.

Each successful Microsoft SSO login appends one JSON object to login_log.jsonl:

    {"timestamp": "2026-04-28T10:15:23", "user": "karthik.m@wheelsindia.com"}
"""

from __future__ import annotations

import json
import os
import threading
from datetime import datetime
from pathlib import Path

LOG_DIR = Path(os.getenv("LOGIN_LOG_DIR", Path(__file__).parent / "logs"))
LOG_FILE = LOG_DIR / "login_log.jsonl"

_lock = threading.Lock()


def _user_from_claims(claims: dict | None) -> str:
    if not claims:
        return "anonymous"
    return (
        claims.get("preferred_username")
        or claims.get("upn")
        or claims.get("email")
        or claims.get("name")
        or claims.get("oid")
        or "unknown"
    )


def log_login(claims: dict | None) -> None:
    """Append one JSON record to login_log.jsonl. Never raises."""
    try:
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        record = {
            "timestamp": datetime.now().isoformat(timespec="seconds"),
            "user": _user_from_claims(claims),
        }
        line = json.dumps(record, ensure_ascii=False)
        with _lock:
            with LOG_FILE.open("a", encoding="utf-8") as f:
                f.write(line + "\n")
    except Exception:
        pass


def read_logs() -> list[dict]:
    """Read all login records as a list of dicts. Skips malformed lines."""
    if not LOG_FILE.exists():
        return []
    rows: list[dict] = []
    with LOG_FILE.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return rows
