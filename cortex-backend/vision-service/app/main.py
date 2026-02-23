import os
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from app.api.dataset import router as dataset_router
from app.api.mobile import router as mobile_router
from app.api.sessions import router as sessions_router
from app.core.paths import get_data_root
from app.utils.response import error_response, success_response

app = FastAPI()

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_origin_regex=".*", allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.mount("/vision-data", StaticFiles(directory=str(get_data_root())), name="vision-data")

@app.on_event("startup")
def validate_settings():
    if not str(os.getenv("DATABASE_URL", "")).strip(): raise RuntimeError("DATABASE_URL is required")

@app.get("/health")
def health(): return success_response({"status": "ok"}, "Vision service healthy")

@app.exception_handler(HTTPException)
def http_exception_handler(req: Request, exc: HTTPException): return JSONResponse(exc.status_code, error_response(str(exc.detail), "HTTP_ERROR"))

@app.exception_handler(Exception)
def unhandled_exception_handler(req: Request, exc: Exception): return JSONResponse(500, error_response("Internal server error"))


app.include_router(mobile_router)
app.include_router(dataset_router)
app.include_router(sessions_router)
