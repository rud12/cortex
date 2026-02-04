from __future__ import annotations

import base64
import threading
from typing import Any, Dict, Optional

_lock = threading.Lock()
_state: Dict[str, Dict[str, Any]] = {}


def set_latest_frame(session_id: str, frame_bytes: bytes, timestamp: str) -> None:
    with _lock:
        _state[session_id] = {
            "timestamp": timestamp,
            "frame_bytes": bytes(frame_bytes),
            "frame_base64": base64.b64encode(frame_bytes).decode("utf-8"),
        }


def get_latest_frame(session_id: str) -> Optional[Dict[str, Any]]:
    with _lock:
        item = _state.get(session_id)
        if item is None:
            return None
        return {
            "timestamp": item.get("timestamp"),
            "frame_base64": item.get("frame_base64"),
        }


def get_latest_frame_bytes(session_id: str) -> Optional[bytes]:
    with _lock:
        item = _state.get(session_id)
        frame_bytes = item.get("frame_bytes") if item else None
        return bytes(frame_bytes) if frame_bytes is not None else None


def get_latest_frame_timestamp(session_id: str) -> Optional[str]:
    with _lock:
        item = _state.get(session_id)
        value = item.get("timestamp") if item else None
        return str(value) if value is not None else None


def clear_latest_frame(session_id: str) -> None:
    with _lock:
        _state.pop(session_id, None)
