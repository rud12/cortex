import os, glob, logging, joblib
from datetime import date, timedelta
from typing import Optional, List
from fastapi import FastAPI, HTTPException, Request, Query
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from pydantic import BaseModel, Field

from app import db, services

app = FastAPI()

log = logging.getLogger("forecasting-service")

scheduler = BackgroundScheduler()
is_prod = os.getenv("NODE_ENV", "").lower() == "production"

def success(d, m=""): return {"success": True, "data": d, "message": m}
def error(m, c="INTERNAL_ERROR"): return {"success": False, "error": {"code": c, "message": m}}

origins = [o.strip().rstrip("/") for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
if web := os.getenv("WEB_URL"): origins.append(web.strip().rstrip("/"))
origins = list(dict.fromkeys(origins))

if is_prod and not origins: raise RuntimeError("WEB_URL or CORS_ORIGINS required in production")

app.add_middleware(CORSMiddleware, allow_origins=origins if is_prod else ["*"], allow_origin_regex=None if is_prod else ".*", allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

@app.on_event("startup")
def on_startup():
    scheduler.add_job(lambda: services.get_factors(date.today()-timedelta(days=450), date.today()+timedelta(days=56)) and services.train_all(), CronTrigger(hour=0, minute=0), id="daily", replace_existing=True)
    scheduler.start()

@app.on_event("shutdown")
def on_shutdown(): scheduler.shutdown(wait=False)

@app.exception_handler(HTTPException)
def http_exc(req: Request, exc: HTTPException): return JSONResponse(exc.status_code, error(str(exc.detail), "HTTP_ERROR"))

@app.exception_handler(Exception)
def exc_hnd(req: Request, exc: Exception):
    log.exception("Unhandled error", exc_info=exc)
    return JSONResponse(500, error("Internal server error" if is_prod else str(exc)))

@app.get("/health")
def health(): return success({"status": "ok"}, "Forecasting service healthy")

class ForecastReq(BaseModel):
    sku: str = Field(..., min_length=1)
    horizon_weeks: int = Field(4, ge=1, le=12)
    scenario: Optional[str] = Field(None, pattern="^(optimistic|realistic|pessimistic)$")

@app.post("/forecast")
def forecast(p: ForecastReq):
    res = services.generate_forecast(p.sku, p.horizon_weeks, p.scenario)
    if "error" in res: raise HTTPException(400, res["error"])
    return success(res, "Forecast generated")

@app.get("/forecasts")
def forecasts(sku: str = None, start_date: date = Query(None), end_date: date = Query(None)):
    pid = db.fetch_products([sku])[0]["product_id"] if sku and db.fetch_products([sku]) else None
    return success(db.fetch_forecasts(pid, start_date, end_date), "Forecasts fetched")

@app.get("/forecast/diagnostics")
def obj(sku: str = Query(...), horizon_weeks: int = Query(12)):
    ps = db.fetch_products([sku])
    if not ps: raise HTTPException(404, "SKU not found")
    pid, lm = ps[0]["product_id"], db.fetch_registry(ps[0]["product_id"]) or {}
    
    mp = os.getenv("MODEL_BASE_PATH", "data/model_versions")
    cds = sorted(glob.glob(f"{mp}/{pid}_*.pkl"))
    pay = joblib.load(cds[-1]) if cds else {}
    
    bun = db.fetch_bundle(pid, horizon_weeks)
    if not bun:
        s, bun, sm = date.today() + timedelta(days=1), [], {}
        for r in db.fetch_forecasts(pid, s, s + timedelta(days=horizon_weeks*7)):
            w = r["forecast_week_start"]
            sm.setdefault(w, {"forecast_week_start": w, "model_version": r.get("model_version"), "confidence_lower": float(r.get("confidence_lower") or 0), "confidence_upper": float(r.get("confidence_upper") or 0)})
            sm[w][r["scenario"]] = float(r.get("predicted_demand") or 0)
        bun = [sm[w] for w in sorted(sm.keys())][:horizon_weeks]
        
    return success({"sku": sku, "product_id": pid, "selected_model": lm.get("model_name"), "model_version": lm.get("version"), "trained_at": lm.get("trained_at"), "status": lm.get("status"), "model_metrics": lm.get("metrics_json") or {}, "selection_reason": pay.get("diagnostics", {}).get("selection") or {}, "candidate_metrics": pay.get("diagnostics", {}).get("metrics_by_model") or {}, "calibration": {"residual_abs_q80": pay.get("calibration", {}).get("residual_abs_q80"), "residual_abs_q95": pay.get("calibration", {}).get("residual_abs_q95"), "coverage_80": pay.get("calibration", {}).get("coverage_80")}, "forecast_bundle": bun}, "Forecast diagnostics fetched")

@app.get("/metrics")
def metrics(sku: str = None, start_date: date = Query(None), end_date: date = Query(None)):
    pid = db.fetch_products([sku])[0]["product_id"] if sku and db.fetch_products([sku]) else None
    met = db.fetch_metrics(pid, start_date, end_date)
    kpi, mq = {}, {}
    if pid:
        e = end_date or date.today()
        s = start_date or e - timedelta(days=30)
        sdf = db.fetch_sales([pid], s, e)
        ts, avg_inv = float(sdf["quantity"].sum()) if not sdf.empty else 0, float(db.fetch_inventory([pid]).get(pid, 0))
        kpi = {"inventory_turnover": ts / max(avg_inv, 1), "stockout_rate": 1 if avg_inv == 0 and ts > 0 else 0, "carrying_cost_proxy": avg_inv * 10}
        
        lr = db.fetch_registry(pid)
        mj = (lr or {}).get("metrics_json") or {}
        lb = float(met[0]["forecast_bias"]) if met else 0
        mq = {"selected_model": (lr or {}).get("model_name"), "model_version": (lr or {}).get("version"), "mase": mj.get("mase"), "wape": mj.get("wape"), "interval_coverage_80": mj.get("coverage_80"), "bias_direction": "OVER_FORECAST" if lb > 0.25 else "UNDER_FORECAST" if lb < -0.25 else "BALANCED"}
    return success({"model_metrics": met, "kpis": kpi, "model_quality": mq}, "Metrics fetched")

class RecReq(BaseModel):
    sku: str = Field(...)
    horizon_weeks: int = Field(4, ge=1, le=12)
    service_level: Optional[float] = Field(None, ge=0.8, le=0.99)

@app.post("/recommendations")
def recs(p: RecReq):
    ps = db.fetch_products([p.sku])
    if not ps: raise HTTPException(404, "SKU not found")
    pid = ps[0]["product_id"]
    bun = db.fetch_bundle(pid, p.horizon_weeks)
    if len(bun) < p.horizon_weeks:
        er = services.generate_forecast(p.sku, p.horizon_weeks)
        if "error" in er: raise HTTPException(400, er["error"])
        bun = db.fetch_bundle(pid, p.horizon_weeks)
        
    ats = db.fetch_attrs([pid]).get(pid, {})
    lt = ats.get("lead_time_days", int(os.getenv("DEFAULT_LEAD_TIME_DAYS", 7)))
    sl = p.service_level or ats.get("service_level", float(os.getenv("SERVICE_LEVEL_DEFAULT", 0.95)))
    e = date.today()
    am = float(db.fetch_sales([pid], e - timedelta(days=84), e)["quantity"].sum()) / 12 if not db.fetch_sales([pid], e - timedelta(days=84), e).empty else 0
    curr = db.fetch_inventory([pid]).get(pid, 0)
    
    rec = services.get_recs(bun, curr, lt, sl, am)
    qf = rec.pop("q_factor")
    return success({"sku": p.sku, "product_id": pid, "forecast_horizon_weeks": p.horizon_weeks, "forecast_quantile_factor": qf, "recommendation": rec}, "Recommendations generated")

class TrReq(BaseModel):
    skus: Optional[List[str]] = Field(None)

@app.post("/train")
def train(p: TrReq):
    return success(services.train_skus(p.skus) if p.skus else services.train_all(), "Training completed")
