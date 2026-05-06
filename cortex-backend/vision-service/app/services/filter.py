import os, cv2, torch, numpy as np, shutil, ssl, urllib.request
from pathlib import Path
from collections import defaultdict, Counter
from torchvision import models, transforms
import torch.serialization
from ultralytics.nn.tasks import DetectionModel
torch.serialization.add_safe_globals([DetectionModel])
from ultralytics import YOLO

MOBILENET_WEIGHTS_PATH = os.getenv("MOBILENET_WEIGHTS_PATH", "").strip()
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
YOLO_CONF, EMBED_THRESHOLD, MIN_FRAMES_CONFIRM, MIN_LABEL_VOTES, IOU_THRESHOLD, MAX_MISSED, COUNT_COOLDOWN, FRAME_SKIP, BATCH_SIZE = 0.20, 0.30, 4, 3, 0.30, 10, 15, 2, 8
BOX_MAX_AREA, BOX_MAX_ASPECT, BOX_MIN_SIDE = 0.35, 4.0, 40
MOBILENET_WEIGHTS_URL = "https://download.pytorch.org/models/mobilenet_v2-b0353104.pth"
MOBILENET_WEIGHTS_FILE = "mobilenet_v2-b0353104.pth"

state = {}

def _find_yolo_model() -> str:
    path = Path.cwd() / "yolov8n.pt"
    if path.resolve().exists() and path.resolve().is_file(): return str(path.resolve())
    raise FileNotFoundError("yolov8n.pt not found.")

def _mobilenet_cache_path() -> Path: 
    return Path(__file__).resolve().parents[3] / "data" / "models" / MOBILENET_WEIGHTS_FILE

def _load_mobilenet_weights(path: Path):
    loaded = torch.load(str(path), map_location="cpu")
    if isinstance(loaded, dict) and isinstance(loaded.get("state_dict"), dict): loaded = loaded["state_dict"]
    model = models.mobilenet_v2(weights=None)
    model.load_state_dict(loaded)
    return model

def _download_mobilenet_weights(dest: Path) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    for ctx in [ssl.create_default_context(), ssl._create_unverified_context()]:
        try:
            with urllib.request.urlopen(MOBILENET_WEIGHTS_URL, context=ctx, timeout=60) as resp, open(dest, "wb") as out: shutil.copyfileobj(resp, out)
            return dest
        except: pass
    raise RuntimeError("MobileNet download failed")

def init(root_dir: str, roi: tuple):
    root_dir = os.path.abspath(root_dir)
    os.makedirs(root_dir, exist_ok=True)
    if not state.get("ready"):
        state["yolo"], state["embedder"] = YOLO(_find_yolo_model()), _Embedder()
    elif state.get("root_dir") == root_dir and state.get("roi") == roi: return

    state.update({"root_dir": root_dir, "cache_file": os.path.join(root_dir, "embeddings.npz"), "tracker": _Tracker(), "roi": roi, "counts": defaultdict(int), "cooldown": {}, "frame": 0, "frame_h": 0, "frame_w": 0})
    try: db_emb, db_labels = _load_or_build_embeddings(state["embedder"], root_dir, state["cache_file"])
    except: db_emb, db_labels = np.empty((0, 0), dtype=np.float32), []

    db_emb = np.asarray(db_emb, dtype=np.float32)
    if db_emb.ndim == 1: db_emb = db_emb.reshape(1, -1) if db_emb.size > 0 else np.empty((0, 0), dtype=np.float32)
    if db_emb.ndim != 2: db_emb = np.empty((0, 0), dtype=np.float32)

    if db_emb.shape[0] == 0 or len(db_labels) == 0:
        state.update({"db_T": np.empty((0, 0), dtype=np.float32), "labels": [], "label_index": defaultdict(list), "has_db": False})
    else:
        idx = defaultdict(list)
        for i, l in enumerate(db_labels): idx[l].append(i)
        state.update({"db_T": db_emb.T.astype(np.float32), "labels": db_labels, "label_index": idx, "has_db": True})
    state["ready"] = True

def process_frame(frame: np.ndarray) -> np.ndarray:
    if not state.get("ready"): 
        return frame
    if state["frame_h"] == 0: 
        state["frame_h"], state["frame_w"] = frame.shape[:2]
    state["frame"] += 1
    if state["frame"] % FRAME_SKIP != 0: 
        _age_tracks()
        return _draw(frame)

    try:
        boxes = [b for b in state["yolo"](frame, conf=YOLO_CONF, verbose=False)[0].boxes.xyxy.cpu().numpy().astype(int) if _is_valid_box(b)]
    except: 
        _age_tracks(); return _draw(frame)

    try: 
        embeddings = state["embedder"].batch([frame[b[1]:b[3], b[0]:b[2]] for b in boxes])
    except: 
        embeddings = [None] * len(boxes)

    detections = []
    for b, e in zip(boxes, embeddings):
        v = None
        if e is not None and state.get("has_db") and state["db_T"].size > 0:
            s = e @ state["db_T"]
            if np.isfinite(s).all() and len(state["labels"]) > 0: v = state["labels"][int(np.argmax(s))]
        detections.append({"box": b.tolist(), "emb": e, "vote": v})
    state["tracker"].update(detections)

    x1, y1, x2, y2 = state["roi"]
    for tid, t in state["tracker"].tracks.items():
        if t["counted"] or t["frames"] < MIN_FRAMES_CONFIRM: continue
        cx, cy = (t["box"][0] + t["box"][2]) // 2, (t["box"][1] + t["box"][3]) // 2
        if not (x1 <= cx <= x2 and y1 <= cy <= y2): continue
        rv = [v for v in t["votes"][-MIN_FRAMES_CONFIRM:] if v]
        if not rv: continue
        tl, tv = Counter(rv).most_common(1)[0]
        if tv < MIN_LABEL_VOTES: continue
        lc = state["cooldown"].get(tl)
        if lc is not None and state["frame"] - lc < COUNT_COOLDOWN: t["counted"] = True; continue
        if not state.get("has_db"): continue
        ve = [e for e in t["embs"][-MIN_FRAMES_CONFIRM:] if e is not None]
        if not ve: continue
        avg = np.mean(ve, axis=0)
        norm = np.linalg.norm(avg)
        if norm < 1e-6: continue
        sim = float(np.mean(((avg / norm) @ state["db_T"])[state["label_index"][tl]]))
        if sim >= EMBED_THRESHOLD:
            state["counts"][tl] += 1
            state["cooldown"][tl] = state["frame"]
            t["counted"], t["label"] = True, tl
    return _draw(frame)

def get_data() -> dict: return {"counts": dict(state.get("counts", {})), "total": sum(state.get("counts", {}).values())}

def reset():
    state["counts"].clear(); state["cooldown"].clear()
    state["frame"], state["frame_h"], state["frame_w"], state["tracker"] = 0, 0, 0, _Tracker()

def _age_tracks():
    for t in state["tracker"].tracks.values(): t["missed"] += 1
    state["tracker"].tracks = {k: v for k, v in state["tracker"].tracks.items() if v["missed"] <= MAX_MISSED}

def _is_valid_box(b):
    w, h = b[2] - b[0], b[3] - b[1]
    return False if w < BOX_MIN_SIDE or h < BOX_MIN_SIDE or (w * h) / max(state["frame_h"] * state["frame_w"], 1) > BOX_MAX_AREA else max(h / max(w, 1), w / max(h, 1)) <= BOX_MAX_ASPECT

def _draw(frame: np.ndarray) -> np.ndarray:
    o = frame.copy()
    x1, y1, x2, y2 = state["roi"]
    cv2.rectangle(o, (x1, y1), (x2, y2), (255, 0, 255), 3)
    cv2.putText(o, "COUNT ZONE", (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 0, 255), 2)
    for tid, t in state["tracker"].tracks.items():
        c = (0, 255, 0) if t["counted"] else (0, 165, 255)
        cv2.rectangle(o, (t["box"][0], t["box"][1]), (t["box"][2], t["box"][3]), c, 2)
        cv2.putText(o, f"ID{tid}: {t['label'] or 'tracking…'}", (t["box"][0], t["box"][1] - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.45, c, 1)
    counts = state.get("counts", {})
    ov = o.copy()
    cv2.rectangle(ov, (10, 10), (320, 90 + len(counts) * 35), (0, 0, 0), -1)
    cv2.addWeighted(ov, 0.6, o, 0.4, 0, o)
    cv2.putText(o, f"Frame: {state['frame']}", (20, 38), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)
    r = 68
    for l, c in sorted(counts.items()):
        cv2.putText(o, f"{l}: {c}", (20, r), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        r += 35
    return o

def _load_or_build_embeddings(embedder, root_dir, cache_file):
    if os.path.exists(cache_file):
        d = np.load(cache_file, allow_pickle=True)
        lbls, emb = list(d["labels"]), _parse_embedding_array(d["embeddings"])
        if emb.shape[0] == 0: return emb, []
        if len(lbls) != emb.shape[0]: emb, lbls = emb[:min(len(lbls), emb.shape[0])], lbls[:min(len(lbls), emb.shape[0])]
        ok = np.isfinite(emb).all(axis=1)
        return emb[ok], [lbls[i] for i in np.where(ok)[0]]

    all_cr, all_lbl = [], []
    for l in sorted(os.listdir(root_dir)):
        f = Path(root_dir) / l
        if not f.is_dir(): continue
        for p in sorted([x for x in f.rglob('*') if x.is_file() and x.suffix.lower() in {'.jpg', '.jpeg', '.png', '.webp'}], key=lambda x: x.name):
            img = cv2.imread(str(p))
            if img is not None:
                all_cr.extend([img, cv2.flip(img, 1)])
                all_lbl.extend([l, l])
    el, ll = [], []
    for s in range(0, len(all_cr), BATCH_SIZE):
        for v, l in zip(embedder.batch(all_cr[s: s + BATCH_SIZE]), all_lbl[s: s + BATCH_SIZE]):
            if v is not None: el.append(v); ll.append(l)
    emp = np.array(el, dtype=np.float32)
    np.savez_compressed(cache_file, embeddings=emp, labels=np.array(ll))
    return emp, ll

def _parse_embedding_array(raw) -> np.ndarray:
    try: emb = np.asarray(raw, dtype=np.float32)
    except: emb = np.asarray(raw)
    if emb.ndim == 1:
        if emb.size == 0: return np.empty((0, 0), dtype=np.float32)
        if emb.dtype == object:
            v = [np.asarray(r, dtype=np.float32).ravel() for r in emb.tolist() if np.asarray(r, dtype=np.float32).ravel().size > 0 and np.isfinite(np.asarray(r, dtype=np.float32).ravel()).all()]
            if not v: return np.empty((0, 0), dtype=np.float32)
            w = max(len(r) for r in v)
            return np.vstack([np.pad(r, (0, w - len(r))) if len(r) < w else r for r in v]).astype(np.float32)
        return emb.reshape(1, -1).astype(np.float32)
    return emb if emb.ndim == 2 else np.empty((0, 0), dtype=np.float32)

class _Embedder:
    def __init__(self):
        self.model = self._load_model().features.to(DEVICE).eval()
        self.pool = torch.nn.AdaptiveAvgPool2d((1, 1))
        self.transform = transforms.Compose([transforms.ToPILImage(), transforms.Resize((224, 224)), transforms.ToTensor(), transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])])

    def _load_model(self):
        cp = _mobilenet_cache_path()
        cands = [Path(MOBILENET_WEIGHTS_PATH).expanduser(), cp, Path.home() / ".cache" / "torch" / "hub" / "checkpoints" / MOBILENET_WEIGHTS_FILE] if MOBILENET_WEIGHTS_PATH else [cp, Path.home() / ".cache" / "torch" / "hub" / "checkpoints" / MOBILENET_WEIGHTS_FILE]
        for p in cands:
            r = p.expanduser().resolve()
            if r.exists() and r.is_file():
                try: return _load_mobilenet_weights(r)
                except: pass
        try:
            m = models.mobilenet_v2(weights=models.MobileNet_V2_Weights.DEFAULT)
            cp.parent.mkdir(parents=True, exist_ok=True)
            if not cp.exists(): torch.save(m.state_dict(), str(cp))
            return m
        except: pass
        try: return _load_mobilenet_weights(_download_mobilenet_weights(cp))
        except: return models.mobilenet_v2(weights=None)
    @torch.no_grad()
    def batch(self, crops: list) -> list:
        t, vt = [], []
        for i, c in enumerate(crops):
            if c is not None and c.shape[0] >= 10 and c.shape[1] >= 10:
                try: t.append(self.transform(cv2.cvtColor(c, cv2.COLOR_BGR2RGB))); vt.append(i)
                except: pass
        res = [None] * len(crops)
        if not t: return res
        n = torch.nn.functional.normalize(self.pool(self.model(torch.stack(t).to(DEVICE)).float()).view(len(t), -1), dim=1).cpu().numpy()
        for i, v in enumerate(vt):
            if np.isfinite(n[i]).all() and np.linalg.norm(n[i]) > 1e-6: res[v] = n[i]
        return res

class _Tracker:
    def __init__(self): self.next_id, self.tracks = 1, {}
    def update(self, det: list):
        used = set()
        for tid, t in list(self.tracks.items()):
            best_iou, best_i = 0.0, -1
            for i, d in enumerate(det):
                if i in used: continue
                iou = self._iou(t["box"], d["box"])
                if iou > best_iou: best_iou, best_i = iou, i
            if best_iou > IOU_THRESHOLD:
                d = det[best_i]
                t.update({"box": d["box"], "missed": 0, "frames": t["frames"] + 1})
                t["embs"].append(d["emb"]); t["votes"].append(d["vote"])
                used.add(best_i)
            else:
                t["missed"] += 1
                if t["missed"] > MAX_MISSED: del self.tracks[tid]
        for i, d in enumerate(det):
            if i not in used:
                self.tracks[self.next_id] = {"box": d["box"], "embs": [d["emb"]], "votes": [d["vote"]], "frames": 1, "missed": 0, "counted": False, "label": None}
                self.next_id += 1

    def _iou(self, a, b):
        xA, yA, xB, yB = max(a[0], b[0]), max(a[1], b[1]), min(a[2], b[2]), min(a[3], b[3])
        i = max(0, xB - xA) * max(0, yB - yA)
        u = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - i
        return i / u if u > 0 else 0.0
