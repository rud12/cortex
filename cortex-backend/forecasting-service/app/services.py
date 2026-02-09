import os, math, joblib, requests, logging
from datetime import date, timedelta, datetime
import numpy as np
import pandas as pd
from statsmodels.tsa.statespace.sarimax import SARIMAX
import holidays
from app import db

log = logging.getLogger("forecasting-service.services")

def build_factors(start: date, end: date) -> pd.DataFrame:
    df = pd.DataFrame({"factor_date": pd.date_range(start, end, freq="D").normalize()})
    w_api, w_key, loc = os.getenv("USE_WEATHER_API") == "true", os.getenv("WEATHER_API_KEY"), os.getenv("FORECAST_LOCATION", "Chennai, IN")
    w_data = []
    if w_api and w_key:
        curr = start
        while curr <= end:
            try:
                r = requests.get(f"https://api.weatherapi.com/v1/history.json?key={w_key}&q={loc}&dt={curr.strftime('%Y-%m-%d')}", timeout=5)
                if r.status_code == 200:
                    d = r.json().get("forecast", {}).get("forecastday", [{}])[0].get("day", {})
                    w_data.append({"factor_date": curr, "temperature": d.get("avgtemp_c", 0), "precipitation": d.get("totalprecip_mm", 0), "humidity": d.get("avghumidity", 0)})
            except Exception: pass
            curr += timedelta(days=1)
    
    wd = pd.DataFrame(w_data) if w_data else pd.DataFrame(columns=["factor_date", "temperature", "precipitation", "humidity"])
    if not wd.empty: wd["factor_date"] = pd.to_datetime(wd["factor_date"]).dt.normalize()
    df = df.merge(wd, on="factor_date", how="left").fillna({"temperature": 0, "precipitation": 0, "humidity": 0})
    
    hols = [{"factor_date": dt, "holiday_name": n, "is_holiday": 1} for y in range(start.year, end.year + 1) for dt, n in holidays.country_holidays("IN", years=y).items() if start <= dt <= end]
    hd = pd.DataFrame(hols) if hols else pd.DataFrame(columns=["factor_date", "holiday_name", "is_holiday"])
    if not hd.empty: hd["factor_date"] = pd.to_datetime(hd["factor_date"]).dt.normalize()
    df = df.merge(hd, on="factor_date", how="left").fillna({"is_holiday": 0, "holiday_name": ""})
    
    evts = pd.DataFrame([{"factor_date": date(y, m, d), "special_event": n} for y in range(start.year, end.year + 1) for m, d, n in [(10, 24, "Diwali"), (12, 25, "Christmas")] if start <= date(y, m, d) <= end])
    if not evts.empty: evts["factor_date"] = pd.to_datetime(evts["factor_date"]).dt.normalize()
    df = df.merge(evts, on="factor_date", how="left").fillna({"special_event": ""})
    
    return df.sort_values("factor_date")

def get_factors(s: date, e: date) -> pd.DataFrame:
    df = db.fetch_factors(s, e)
    if df.empty or len(df) < (e - s).days + 1:
        built = build_factors(s, e)
        if not built.empty:
            db.save_factors(built.to_dict(orient="records"))
            df = db.fetch_factors(s, e)
    if df.empty:
        return pd.DataFrame({"factor_date": pd.date_range(s, e, freq="D").normalize()}).assign(temperature=0, precipitation=0, humidity=0, is_holiday=0)
    for c in ["temperature", "precipitation", "humidity"]: df[c] = df[c].ffill().bfill().fillna(0)
    return df

def generate_forecast(sku: str, horiz: int = 4, scen: str = None):
    pids = db.fetch_products([sku])
    if not pids: return {"error": f"SKU {sku} not found"}
    pid = pids[0]["product_id"]
    e = date.today()
    s = e - timedelta(days=260)
    fs, hd = e + timedelta(days=1), max(1, horiz * 7)
    
    sales = db.fetch_sales([pid], s, e)
    y = sales.groupby("sale_date")["quantity"].sum().reindex(pd.date_range(s, e, freq="D"), fill_value=0).astype(float)
    
    fallback, ex_cols = None, ["temperature", "precipitation", "humidity", "is_holiday"]
    if float(y.sum()) <= 0:
        fallback = "baseline_mean"
        m, std = float(y.tail(28).mean() if len(y) else 0), float(max(1, y.std() if len(y) else 1))
        fcst, l80, u80 = np.full(hd, max(0, m)), np.full(hd, max(0, m - 1.28*std)), np.full(hd, m + 1.28*std)
    else:
        try:
            ex_train = get_factors(s, e)[ex_cols].to_numpy()
            ex_fut = get_factors(fs, fs + timedelta(days=hd - 1))[ex_cols].to_numpy()
            m = SARIMAX(y.to_numpy(), exog=ex_train, order=(1,1,1), seasonal_order=(1,1,1,7), enforce_stationarity=False, enforce_invertibility=False).fit(disp=False)
            p = m.get_forecast(steps=hd, exog=ex_fut)
            fcst = np.maximum(0, p.predicted_mean)
            ci = p.conf_int(alpha=0.2)
            l80, u80 = np.maximum(0, ci[:,0]), np.maximum(0, ci[:,1])
        except Exception:
            fallback = "baseline_mean"
            m_val, std = float(y.tail(28).mean()), float(max(1, y.std()))
            fcst, l80, u80 = np.full(hd, max(0, m_val)), np.full(hd, max(0, m_val - 1.28*std)), np.full(hd, m_val + 1.28*std)
    
    records, now, ver = [], datetime.utcnow(), datetime.utcnow().strftime("%Y%m%d_%H%M%S_sarimax")
    for i in range(0, hd, 7):
        ws = fs + timedelta(days=i)
        v = float(np.sum(fcst[i:i+7]))
        lo, up = max(0, min(float(np.sum(l80[i:i+7])), v)), max(v, float(np.sum(u80[i:i+7])))
        vars = {"realistic": (v, lo, up), "optimistic": (up, v, up), "pessimistic": (lo, lo, v)}
        for n, (pred, low, high) in vars.items():
            if not scen or n == scen:
                records.append({"product_id": pid, "forecast_week_start": ws, "predicted_demand": pred, "confidence_lower": low, "confidence_upper": high, "scenario": n, "model_version": ver, "created_at": now})
    db.save_forecasts(records)
    return {"sku": sku, "product_id": pid, "horizon_weeks": horiz, "scenarios": records, "selected_model": "sarimax_111_111_7", "confidence_score": 50 if fallback else 88, "fallback_mode": fallback}

def get_recs(bundle: list, curr: int, lt: int, sl: float, sales_act_mean: float):
    qf = np.clip((sl - 0.8) / 0.19, 0, 1)
    q_vals = [max(0, float(i.get("realistic", 0)) + qf * max(0, float(i.get("optimistic", i.get("confidence_upper", i.get("realistic", 0)))) - float(i.get("realistic", 0)))) for i in bundle]
    rm = np.mean([max(0, float(i.get("realistic", 0))) for i in bundle]) if bundle else 0
    eoqd = min(rm, sales_act_mean) if sales_act_mean > 0 else 0
    
    awd = float(np.mean(q_vals)) if q_vals else 0
    wu = float(np.std(q_vals)) if q_vals else 0
    du = wu / math.sqrt(7) if wu > 0 else 0
    ss = int(max({0.9: 1.28, 0.95: 1.645, 0.99: 2.33}.get(sl, 1.645) * du * math.sqrt(max(lt, 1)), 0))
    roq = max((awd * (1 + (wu/awd) if awd > 0 else 1)) - curr + ss, 0)
    
    eoq = int(max(math.sqrt((2 * (max(0, eoqd)*52) * 100) / 10), 0))
    rp = ((awd/7) * lt) + ss
    return {"eoq": eoq, "safety_stock": ss, "reorder_point": rp, "current_stock": curr, "recommended_order_quantity": roq, "alert": "critical" if curr <= rp else "warning" if curr <= rp*1.5 else None, "q_factor": float(qf)}

def train_skus(skus: list):
    prods = db.fetch_products(skus)
    if not prods: return 0
    pids = [p["product_id"] for p in prods]
    e = date.today()
    s = e - timedelta(days=260)
    sales = db.fetch_sales(pids, s, e)
    if sales.empty: return 0
    exog = get_factors(s, e)[["temperature", "precipitation", "humidity", "is_holiday"]].to_numpy()
    
    t = 0
    path = os.getenv("MODEL_BASE_PATH", "data/model_versions")
    os.makedirs(path, exist_ok=True)
    
    for p in pids:
        ps = sales[sales["product_id"] == p]
        if ps.empty: continue
        try:
            y = ps.groupby("sale_date")["quantity"].sum().reindex(pd.date_range(s, e, freq="D"), fill_value=0).to_numpy(dtype=float)
            m = SARIMAX(y, exog=exog, order=(1,1,1), seasonal_order=(1,1,1,7), enforce_stationarity=False, enforce_invertibility=False).fit(disp=False)
            v = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            joblib.dump({"version": v, "model_type": "sarimax", "trained_at": datetime.utcnow().isoformat(), "state": m.params.to_dict() if hasattr(m, "params") else None}, f"{path}/{p}_{v}.pkl")
            
            p_val = np.maximum(0, m.fittedvalues)
            n_y = np.where(np.abs(y)==0, 1, y)
            mape_v = float(np.mean(np.clip(np.abs((y - p_val)/n_y), 0, 1000)) * 100) if len(y) else 0
            rmse_v = float(np.sqrt(np.mean((y - p_val)**2))) if len(y) else 0
            bias_v = float(np.mean(p_val - y)) if len(y) else 0
            
            db.save_registry({"model_name": "sarimax", "version": v, "trained_at": datetime.utcnow(), "metrics_json": {"mape": mape_v, "rmse": rmse_v, "forecast_bias": bias_v, "model": "sarimax"}, "status": "active", "notes": f"product_id={p}"})
            db.save_metrics([{"product_id": p, "metric_date": date.today(), "mape": mape_v, "rmse": rmse_v, "forecast_bias": bias_v, "notes": "sarimax"}])
            t += 1
        except Exception as ex:
            log.exception(f"Training failed for {p}: {ex}")
    return t

def train_all():
    o, t = 0, 0
    while True:
        b = db.fetch_products(offset=o, limit=200)
        if not b: break
        t += train_skus([p["sku"] for p in b])
        o += 200
    return {"trained": t}
