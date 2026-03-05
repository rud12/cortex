from __future__ import annotations

from pathlib import Path

def _backend_root() -> Path:
    return Path(__file__).resolve().parents[3]


def get_data_root() -> Path:
    root = (_backend_root() / 'data').resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def get_dataset_root() -> Path:
    root = get_data_root() / 'dataset'
    root.mkdir(parents=True, exist_ok=True)
    return root


def to_public_data_path(path: Path) -> str:
    root = get_data_root()
    try:
        relative = path.resolve().relative_to(root)
        return f"data/{relative.as_posix()}"
    except ValueError:
        return str(path).replace("\\", "/")
