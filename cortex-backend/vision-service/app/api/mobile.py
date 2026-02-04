from __future__ import annotations
import json, os, socket, time, uuid, cv2, numpy as np
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Optional
from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from app.core.paths import get_dataset_root
from app.services.filter import get_data, init, process_frame
from app.services.inventory import resolve_owner_key
from app.services.mobile_stream_state import set_latest_frame
from app.services.vision_repository import get_vision_session
from app.utils.response import success_response

router = APIRouter()
_tokens: Dict[str, Dict[str, object]] = {}
_filter_ready: Dict[str, bool] = {}
_filter_error: Dict[str, str] = {}
_filter_roi: Dict[str, tuple] = {}

def _env_int(name: str, default: int) -> int:
    try: return int(str(os.getenv(name, default)))
    except: return default

def _reference_root() -> Path:
    r = get_dataset_root() / resolve_owner_key()
    r.mkdir(parents=True, exist_ok=True)
    return r

def _count_images(path: Path) -> int:
    return sum(1 for f in path.rglob('*') if f.is_file() and f.suffix.lower() in {'.jpg', '.jpeg', '.png', '.webp'}) if path.exists() and path.is_dir() else 0

def _ready_reference_dirs() -> list:
    res = [(p.name, _count_images(p)) for p in _reference_root().iterdir() if p.is_dir() and _count_images(p) >= 10]
    return sorted(res, key=lambda i: i[0])

def _cleanup_expired_tokens():
    now = time.time()
    for t in [t for t, i in _tokens.items() if float(i.get('expiresAt') or 0) <= now]: _tokens.pop(t, None)

def _get_lan_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except: return '127.0.0.1'

def _build_mobile_url(token: str, request: Optional[Request] = None) -> str:
    host = str(os.getenv('MOBILE_PUBLIC_HOST', '')).strip()
    if not host and request:
        h = request.headers.get('x-forwarded-host') or request.url.hostname or ''
        h = str(h).split(':')[0].strip()
        host = '' if h in {'', 'localhost', '127.0.0.1', '0.0.0.0', '::1'} else h
    host = host or _get_lan_ip()
    return f"{str(os.getenv('MOBILE_PUBLIC_SCHEME', 'https') or 'https')}://{host}:{_env_int('MOBILE_PUBLIC_PORT', 3004)}/mobile/{token}"

def _get_valid_token(token: str) -> Dict[str, object]:
    _cleanup_expired_tokens()
    i = _tokens.get(token)
    if not i or i.get('revoked'): raise HTTPException(403, 'Invalid or expired token')
    return i

def revoke_tokens_for_session(session_id: str):
    _cleanup_expired_tokens()
    for i in _tokens.values():
        if str(i.get('sessionId') or '') == str(session_id): i['revoked'] = True

def clear_filter_state_for_session(session_id: str):
    for d in (_filter_ready, _filter_error, _filter_roi): d.pop(session_id, None)

def _token_status(token: str) -> Dict[str, object]:
    _cleanup_expired_tokens()
    i = _tokens.get(token)
    if not i: return {'active': False, 'reason': 'INVALID_TOKEN'}
    if i.get('revoked'): return {'active': False, 'reason': 'REVOKED'}
    sid = str(i.get('sessionId') or '')
    if not sid: return {'active': False, 'reason': 'MISSING_SESSION'}
    session = get_vision_session(sid)
    if not session: return {'active': False, 'reason': 'SESSION_NOT_FOUND', 'session_id': sid}
    status = str(session.get('status') or '').upper()
    return {'active': status == 'ACTIVE', 'reason': 'ACTIVE' if status == 'ACTIVE' else f'SESSION_{status}', 'session_id': sid, 'session_status': status}

def _normalize_roi(roi: tuple) -> tuple:
    x1, y1, x2, y2 = roi
    return int(min(x1, x2)), int(min(y1, y2)), int(max(x1, x2)), int(max(y1, y2))

def _init_filter(session_id: str, roi: tuple) -> tuple:
    n = _normalize_roi(roi)
    if _filter_ready.get(session_id) and _filter_roi.get(session_id) == n: return _reference_root(), True, None
    try:
        init(str(_reference_root()), roi=n)
        _filter_ready[session_id], _filter_roi[session_id] = True, n
        _filter_error.pop(session_id, None)
        return _reference_root(), True, None
    except Exception as exc:
        _filter_ready[session_id], _filter_roi[session_id], _filter_error[session_id] = False, n, str(exc)
        return _reference_root(), False, str(exc)

def _resolve_roi(session: Dict, frame_w: int, frame_h: int) -> tuple:
    d = (0, 0, max(1, frame_w - 1), max(1, frame_h - 1))
    roi = session.get('roi')
    if not isinstance(roi, dict): return d
    try:
        x1, y1 = max(0.0, min(1.0, float(roi.get('x1', 0)))), max(0.0, min(1.0, float(roi.get('y1', 0))))
        x2, y2 = max(0.0, min(1.0, float(roi.get('x2', 1)))), max(0.0, min(1.0, float(roi.get('y2', 1))))
    except: return d
    px1, py1 = max(0, min(frame_w - 1, int(round(x1 * frame_w)))), max(0, min(frame_h - 1, int(round(y1 * frame_h))))
    px2, py2 = max(0, min(frame_w - 1, int(round(x2 * frame_w)))), max(0, min(frame_h - 1, int(round(y2 * frame_h))))
    if px2 <= px1: px2 = min(frame_w - 1, px1 + 1)
    if py2 <= py1: py2 = min(frame_h - 1, py1 + 1)
    return _normalize_roi((px1, py1, px2, py2))

def _mobile_page_html(token: str, session_id: str) -> str:
    html = """<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Mobile Capture</title><style>body{margin:0;font-family:sans-serif;background:#0f1115;color:#f6f7fb}.wrap{max-width:560px;margin:0 auto;padding:18px}.card{background:#171a22;border:1px solid #2a2f3d;border-radius:14px;padding:16px;display:grid;gap:12px}button{width:100%;border:0;border-radius:10px;padding:14px 12px;font-size:16px;font-weight:700}.primary{background:#3f6fff;color:white}.secondary{background:#252b38;color:white;border:1px solid #3d4455}.danger{background:#ff5c7b;color:white}.disabled{opacity:.5;pointer-events:none}.status{margin-top:12px;color:#c8ccd8;font-size:13px}</style></head><body><div class="wrap"><div class="card"><button id="startBtn" class="primary">Start Capture</button> <button id="sendBtn" class="secondary">Send Image</button> <button id="stopBtn" class="danger">Stop Capture</button></div><div id="status" class="status">Ready</div><video id="video" playsinline muted style="display:none"></video><canvas id="canvas" style="display:none"></canvas></div><script>const t=TOKEN_JS,sid=SESSION_JS,v=document.getElementById('video'),c=document.getElementById('canvas'),stB=document.getElementById('startBtn'),seB=document.getElementById('sendBtn'),spB=document.getElementById('stopBtn'),sEl=document.getElementById('status');let st=null,tm=null,stm=null,stp=false,inf=false;const setS=(v)=>sEl.textContent=v,setD=(e,v)=>{e.disabled=v;if(v)e.classList.add('disabled');else e.classList.remove('disabled');},sendF=async()=>{if(stp||!st||inf)return;inf=true;try{const w=v.videoWidth||640,h=v.videoHeight||480,s=Math.min(1,960/Math.max(w,h));c.width=Math.max(1,Math.round(w*s));c.height=Math.max(1,Math.round(h*s));c.getContext('2d').drawImage(v,0,0,c.width,c.height);const b=await new Promise(r=>c.toBlob(r,'image/jpeg',.75));if(b){const fd=new FormData();fd.append('file',b,`m-${Date.now()}.jpg`);fd.append('session_id',sid);await fetch(`/api/v1/vision/mobile/${encodeURIComponent(t)}`,{method:'POST',body:fd});}}catch(e){}finally{inf=false;}},pS=(u,b)=>{if(b&&navigator.sendBeacon)navigator.sendBeacon(u,new Blob(['{}'],{type:'application/json'}));else fetch(u,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',keepalive:true}).catch(()=>{});},stopI=async(b,m)=>{if(stp)return;stp=true;if(tm)clearInterval(tm);if(stm)clearInterval(stm);if(st)st.getTracks().forEach(tr=>tr.stop());setD(stB,true);setD(seB,true);setD(spB,true);setS(m||'Stopped');pS(`/api/v1/vision/sessions/${encodeURIComponent(sid)}/stop`,b);pS(`/api/v1/vision/mobile/${encodeURIComponent(t)}/revoke`,b);},pol=async()=>{if(stp)return;try{const r=await fetch(`/api/v1/vision/mobile/${encodeURIComponent(t)}/status`,{cache:'no-store'});if(r.ok){const b=await r.json();if(!b?.data?.active)stopI(false,'Stopped by rx');}}catch(e){}};stB.onclick=async()=>{if(stp)return;try{st=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:false});v.srcObject=st;await v.play();setD(stB,true);setS('Capturing');tm=setInterval(sendF,90);}catch(e){setS('No camera access');}};seB.onclick=async()=>sendF();spB.onclick=async()=>stopI(false,'Stopped');stm=setInterval(pol,2000);pol();window.onpagehide=()=>stopI(true,'Stopped');window.onbeforeunload=()=>stopI(true,'Stopped');</script></body></html>"""
    return html.replace("TOKEN_JS", json.dumps(token)).replace("SESSION_JS", json.dumps(session_id))

class MobileTokenPayload(BaseModel): sessionId: Optional[str] = None

@router.post('/api/v1/vision/mobile/token')
def mobile_token(request: Request, payload: Optional[MobileTokenPayload] = None):
    _cleanup_expired_tokens()
    if not payload or not payload.sessionId: raise HTTPException(400, 'sessionId is required')
    session = get_vision_session(payload.sessionId)
    if not session: raise HTTPException(404, 'Session not found')
    t, ttl = uuid.uuid4().hex, _env_int('MOBILE_TOKEN_TTL', 15)
    _tokens[t] = {'expiresAt': time.time() + ttl * 60, 'revoked': False, 'sessionId': payload.sessionId}
    ready_dirs = _ready_reference_dirs()
    return success_response({'token': t, 'expires_in': ttl * 60, 'session_id': payload.sessionId, 'mobile_url': _build_mobile_url(t, request), 'session_data_path': str(_reference_root()), 'dataset_reference_path': str(_reference_root()), 'ready_products_count': len(ready_dirs), 'ready_reference_labels': [l for l, _ in ready_dirs], 'roi_confirmed': bool(session.get('roi_confirmed')), 'roi': session.get('roi')}, 'Mobile token generated')

@router.get('/api/v1/vision/mobile/{token}/status')
def mobile_token_status(token: str): return success_response(_token_status(token), 'Mobile token status fetched')

@router.get('/mobile/{token}', response_class=HTMLResponse)
def mobile_page(token: str):
    sid = str(_get_valid_token(token).get('sessionId') or '')
    if not sid: raise HTTPException(400, 'sessionId missing')
    return HTMLResponse(_mobile_page_html(token, sid), 200)

@router.post('/api/v1/vision/mobile/{token}')
async def mobile_upload(token: str, file: UploadFile = File(...), session_id: Optional[str] = Form(None)):
    i = _get_valid_token(token)
    sid = str(session_id or i.get('sessionId') or '')
    if not sid: raise HTTPException(400, 'session_id required')
    session = get_vision_session(sid)
    if not session: raise HTTPException(404, 'Session not found')
    if str(session.get('status') or '').upper() != 'ACTIVE': raise HTTPException(409, 'Session not active')
    await file.seek(0)
    raw = await file.read()
    if not raw: raise HTTPException(400, 'Empty upload')
    frame = cv2.imdecode(np.frombuffer(raw, dtype=np.uint8), cv2.IMREAD_COLOR)
    if frame is None: raise HTTPException(400, 'Invalid image')
    
    roi = _resolve_roi(session, frame.shape[1], frame.shape[0])
    _, filter_ready, filter_error = _init_filter(sid, roi=roi)
    
    processed = frame
    if filter_ready:
        try:
            res = process_frame(frame)
            if res is not None: processed = res
        except Exception as exc:
            filter_ready, filter_error = False, str(exc)
            cv2.rectangle(processed, (roi[0], roi[1]), (roi[2], roi[3]), (0, 0, 255), 2)
            cv2.putText(processed, "Filter error", (roi[0], max(20, roi[1] - 8)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
    else:
        cv2.rectangle(processed, (roi[0], roi[1]), (roi[2], roi[3]), (0, 0, 255), 2)
        cv2.putText(processed, "Filter unavailable", (roi[0], max(20, roi[1] - 8)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)

    if not bool(session.get('roi_confirmed')):
        try:
            from app.services.filter import reset as filter_reset; filter_reset()
        except: pass

    ok, encoded = cv2.imencode('.jpg', processed, [int(cv2.IMWRITE_JPEG_QUALITY), 70])
    if not ok: raise HTTPException(500, 'Encode failed')
    ts = datetime.now(timezone.utc).isoformat()
    set_latest_frame(sid, encoded.tobytes(), ts)
    roi_confirmed = bool(session.get('roi_confirmed'))
    return success_response({'session_id': sid, 'timestamp': ts, 'uploaded': True, 'summary': get_data() if roi_confirmed and filter_ready else {'counts': {}, 'total': 0}, 'filter_ready': bool(filter_ready), 'filter_warning': filter_error or _filter_error.get(sid), 'roi_confirmed': roi_confirmed, 'roi_pending': not roi_confirmed}, 'Frame streamed')

@router.post('/api/v1/vision/mobile/{token}/revoke')
def revoke_mobile_token(token: str):
    _cleanup_expired_tokens()
    i = _tokens.get(token)
    if i: i['revoked'] = True
    return success_response({'token': token, 'revoked': True, 'alreadyMissing': i is None}, 'Token revoked')
