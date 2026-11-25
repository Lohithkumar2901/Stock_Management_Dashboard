"""Thread-safe JSON-Lines logger for chatbot interactions.

Each /chat request appends one JSON object (one line) to chat_log.jsonl:

    {"timestamp": "...", "user": "...", "question": "...", "status": "..."}

JSON Lines is used (instead of a single JSON array) because it's safe to
append to under concurrent writes and easy to stream/tail.
"""

from __future__ import annotations

import json
import os
import threading
from datetime import datetime
from pathlib import Path

LOG_DIR = Path(os.getenv("CHAT_LOG_DIR", Path(__file__).parent / "logs"))
LOG_FILE = LOG_DIR / "chat_log.jsonl"

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


def log_chat(claims: dict | None, question: str, status: str) -> None:
    """Append one JSON record to chat_log.jsonl. Never raises — logging must not break the request."""
    try:
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        record = {
            "timestamp": datetime.now().isoformat(timespec="seconds"),
            "user": _user_from_claims(claims),
            "question": (question or "").replace("\n", " ").strip(),
            "status": status,
        }
        line = json.dumps(record, ensure_ascii=False)
        with _lock:
            with LOG_FILE.open("a", encoding="utf-8") as f:
                f.write(line + "\n")
    except Exception:
        # Don't let logging failures bubble up to the user.
        pass


def read_logs() -> list[dict]:
    """Read all log records as a list of dicts. Skips malformed lines."""
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
