from __future__ import annotations
import uuid, cv2, numpy as np
from pathlib import Path
from typing import Optional

def save_upload_bytes(base_dir: str, content: bytes, filename: Optional[str] = None) -> str:
    Path(base_dir).mkdir(parents=True, exist_ok=True)
    p = str(Path(base_dir) / f"{uuid.uuid4().hex}{(Path(filename or '').suffix or '.jpg').lower()}")
    with open(p, "wb") as f: f.write(content)
    return p

def save_image_array(base_dir: str, image: np.ndarray, ext: str = ".jpg") -> str:
    Path(base_dir).mkdir(parents=True, exist_ok=True)
    if not cv2.imwrite(p := str(Path(base_dir) / f"{uuid.uuid4().hex}{ext}"), image): raise RuntimeError("Failed to write image")
    return p