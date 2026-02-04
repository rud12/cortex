from __future__ import annotations
import threading, uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
from app.core.paths import get_dataset_root, to_public_data_path
from app.services.inventory import list_root_products_with_variants, resolve_owner_key

_DATASET_ROOT = get_dataset_root()
_lock = threading.Lock()
_sessions: Dict[str, Dict[str, Any]] = {}

def _now_iso() -> str: return datetime.now(timezone.utc).isoformat()
def _is_image(p: Path) -> bool: return p.suffix.lower() in {'.jpg', '.jpeg', '.png', '.webp'}
def _list_images(f: Path) -> List[Path]:
    if not f.exists() or not f.is_dir(): return []
    return sorted([p for p in f.iterdir() if p.is_file() and _is_image(p)], key=lambda p: p.stat().st_mtime, reverse=True)

def _image_to_row(path: Path, product_id: str, variant_id: Optional[str]) -> Dict[str, Any]:
    c = datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc).isoformat()
    return {'id': uuid.uuid5(uuid.NAMESPACE_URL, str(path.resolve())).hex, 'product_id': product_id, 'variant_id': variant_id, 'file_path': to_public_data_path(path), 'status': 'ACTIVE', 'source': 'manual_upload', 'created_at': c, 'updated_at': c}

def _get_product_folders(product_id: str) -> List[Path]:
    f = _DATASET_ROOT / resolve_owner_key() / product_id
    return [f] if f.exists() and f.is_dir() else []

def _iter_product_images(product_id: str, variant_id: Optional[str]):
    for r in _get_product_folders(product_id):
        if variant_id: yield variant_id, r / variant_id
        else:
            yield None, r
            for i in r.iterdir():
                if i.is_dir(): yield i.name, i

def add_product_reference_image(product_id: str, file_path: str, variant_id: Optional[str] = None) -> Dict[str, Any]:
    return _image_to_row(Path(file_path), product_id, variant_id)

def list_product_reference_images(product_id: str, variant_id: Optional[str] = None, limit: int = 300) -> List[Dict[str, Any]]:
    rows, seen = [], set()
    for vid, f in _iter_product_images(product_id, variant_id):
        for p in _list_images(f):
            k = str(p.resolve())
            if k not in seen:
                seen.add(k); rows.append(_image_to_row(p, product_id, vid))
    return sorted(rows, key=lambda r: r.get('updated_at') or '', reverse=True)[:limit]

def delete_product_reference_image(product_id: str, image_id: str, variant_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
    for vid, f in _iter_product_images(product_id, variant_id):
        for p in _list_images(f):
            r = _image_to_row(p, product_id, vid)
            if str(r['id']) == str(image_id):
                try: p.unlink(); return r
                except FileNotFoundError: return None
    return None

def _count_product_images(product_id: str) -> Dict[str, Any]:
    rc, vc = 0, {}
    for r in _get_product_folders(product_id):
        rc += len(_list_images(r))
        for i in r.iterdir():
            if i.is_dir(): vc[i.name] = vc.get(i.name, 0) + len(_list_images(i))
    return {'root_count': rc, 'variant_counts': vc}

def list_product_reference_status() -> List[Dict[str, Any]]:
    rows = []
    for p in list_root_products_with_variants():
        pid, vs = str(p['id']), p.get('variants') or []
        counts = _count_product_images(pid)
        if vs:
            tot, all_ready, v_stat = 0, True, []
            for v in vs:
                vid = str(v['id'])
                c = counts['variant_counts'].get(vid, 0)
                tot += c; all_ready = all_ready and (c >= 10)
                v_stat.append({'variant_id': vid, 'variant_name': v.get('variant_name'), 'reference_images_uploaded': c, 'vision_ready': c >= 10})
            rows.append({'product_id': pid, 'sku': p.get('sku'), 'name': p.get('name'), 'has_variants': True, 'reference_images_uploaded': tot, 'vision_ready': all_ready and len(vs) > 0, 'variant_status': v_stat})
        else:
            c = counts['root_count']
            rows.append({'product_id': pid, 'sku': p.get('sku'), 'name': p.get('name'), 'has_variants': False, 'reference_images_uploaded': c, 'vision_ready': c >= 10, 'variant_status': []})
    return rows

def create_vision_session(camera_key: Optional[str], rtsp_url: Optional[str]) -> Dict[str, Any]:
    sid, now = str(uuid.uuid4()), _now_iso()
    s = {'id': sid, 'camera_key': camera_key, 'rtsp_url': rtsp_url, 'status': 'ACTIVE', 'started_at': now, 'ended_at': None, 'summary': {}, 'roi': None, 'roi_confirmed': False, 'created_at': now, 'updated_at': now}
    with _lock: _sessions[sid] = dict(s)
    return s

def get_vision_session(session_id: str) -> Optional[Dict[str, Any]]:
    with _lock: return dict(i) if (i := _sessions.get(session_id)) else None

def update_vision_session_roi(session_id: str, roi: Optional[Dict[str, float]], roi_confirmed: bool = True) -> Optional[Dict[str, Any]]:
    with _lock:
        if not (i := _sessions.get(session_id)): return None
        i['roi'], i['roi_confirmed'], i['updated_at'] = dict(roi) if roi else None, bool(roi_confirmed and roi), _now_iso()
        return dict(i)

def stop_vision_session(session_id: str, summary: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
    with _lock:
        if not (i := _sessions.get(session_id)): return None
        i['status'], i['ended_at'], i['updated_at'], i['summary'] = 'STOPPED', _now_iso(), _now_iso(), dict(summary or {})
        return dict(i)
