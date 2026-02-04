from __future__ import annotations
import socket, time, shutil
from typing import Any, Dict, Optional
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.services.mobile_stream_state import clear_latest_frame, get_latest_frame, get_latest_frame_bytes, get_latest_frame_timestamp
from app.api.mobile import clear_filter_state_for_session, revoke_tokens_for_session
from app.services.filter import get_data, reset
from app.services.vision_repository import create_vision_session, get_vision_session, stop_vision_session, update_vision_session_roi
from app.core.paths import get_data_root
from app.utils.response import success_response

router = APIRouter()

class StartSessionPayload(BaseModel): cameraId: Optional[str] = None
class StopSessionPayload(BaseModel): summary: Optional[Dict[str, Any]] = None
class SessionRoiPayload(BaseModel):
    x1: float = Field(..., ge=0, le=1)
    y1: float = Field(..., ge=0, le=1)
    x2: float = Field(..., ge=0, le=1)
    y2: float = Field(..., ge=0, le=1)

def _get_lan_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except: return '127.0.0.1'

@router.get('/api/v1/vision/network/lan-ip')
def get_lan_ip(): return success_response({'lan_ip': _get_lan_ip()}, 'LAN IP fetched')

@router.post('/api/v1/vision/sessions/start')
def start_session(payload: StartSessionPayload):
    return success_response({'session': create_vision_session(payload.cameraId or 'mobile', None)}, 'Session started')

@router.get('/api/v1/vision/sessions/{session_id}')
def get_session(session_id: str):
    if not (s := get_vision_session(session_id)): raise HTTPException(404, 'Session not found')
    return success_response(s, 'Session fetched')

@router.patch('/api/v1/vision/sessions/{session_id}/roi')
def set_session_roi(session_id: str, payload: SessionRoiPayload):
    s = get_vision_session(session_id)
    if not s: raise HTTPException(404, 'Session not found')
    if str(s.get('status') or '').upper() != 'ACTIVE': raise HTTPException(409, 'Session not active')
    if payload.x2 <= payload.x1 or payload.y2 <= payload.y1: raise HTTPException(400, 'Invalid ROI')
    updated = update_vision_session_roi(session_id, {'x1': payload.x1, 'y1': payload.y1, 'x2': payload.x2, 'y2': payload.y2}, True)
    if not updated: raise HTTPException(404, 'Session not found')
    clear_filter_state_for_session(session_id)
    try: reset()
    except: pass
    return success_response(updated, 'ROI updated')

@router.get('/api/v1/vision/sessions/{session_id}/latest-frame')
def get_session_latest_frame(session_id: str):
    if not get_vision_session(session_id): raise HTTPException(404, 'Session not found')
    return success_response({'session_id': session_id, 'frame': get_latest_frame(session_id)}, 'Latest frame fetched')

@router.get('/api/v1/vision/sessions/{session_id}/stream.mjpeg')
def stream_session_mjpeg(session_id: str):
    if not get_vision_session(session_id): raise HTTPException(404, 'Session not found')
    def gen():
        last_ts = None
        while (curr := get_vision_session(session_id)) and str(curr.get('status') or '').upper() != 'STOPPED':
            fb, ts = get_latest_frame_bytes(session_id), get_latest_frame_timestamp(session_id)
            if not fb: time.sleep(0.06); continue
            if ts == last_ts: time.sleep(0.03); continue
            last_ts = ts
            yield b'--frame\r\nContent-Type: image/jpeg\r\n' + f'Content-Length: {len(fb)}\r\n\r\n'.encode('utf-8') + fb + b'\r\n'
    return StreamingResponse(gen(), media_type='multipart/x-mixed-replace; boundary=frame', headers={'Cache-Control': 'no-cache, no-store, must-revalidate'})

@router.post('/api/v1/vision/sessions/{session_id}/stop')
def stop_session(session_id: str, payload: Optional[StopSessionPayload] = None):
    if not get_vision_session(session_id): raise HTTPException(404, 'Session not found')
    summary = payload.summary if payload and isinstance(payload.summary, dict) else {}
    if not summary:
        try: summary = get_data()
        except: summary = {}
    stopped = stop_vision_session(session_id, summary)
    clear_latest_frame(session_id)
    revoke_tokens_for_session(session_id)
    clear_filter_state_for_session(session_id)
    try: shutil.rmtree(get_data_root() / session_id, ignore_errors=True)
    except: pass
    try: reset()
    except: pass
    return success_response({'session': stopped, 'summary': summary, 'mobile_message': 'Session stopped'}, 'Session stopped')
