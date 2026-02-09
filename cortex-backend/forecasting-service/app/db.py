import os, json
import pandas as pd
from typing import List, Dict, Any, Optional
from datetime import date, timedelta
from sqlalchemy import create_engine, text

_ENGINE = None

def get_engine():
    global _ENGINE
    if not _ENGINE:
        # Strip schema query param if present
        url = os.getenv("DATABASE_URL", "")
        if "?schema=" in url.lower():
            url = url[:url.lower().index("?schema=")]
        _ENGINE = create_engine(url, connect_args={"options": "-csearch_path=forecasting,inventory,pos"})
    return _ENGINE

def query_dicts(sql: str, params: dict = None) -> List[Dict[str, Any]]:
    with get_engine().connect() as c:
        return [dict(r._mapping) for r in c.execute(text(sql), params or {})]

def query_df(sql: str, params: dict = None, date_cols=None) -> pd.DataFrame:
    with get_engine().connect() as c:
        df = pd.DataFrame([dict(r._mapping) for r in c.execute(text(sql), params or {})])
    if date_cols and not df.empty:
        for col in date_cols:
            if col in df: df[col] = pd.to_datetime(df[col])
    return df

def execute(sql: str, records: list | dict = None):
    with get_engine().begin() as c:
        c.execute(text(sql), records or {})

def fetch_sales(pids: list, start: date, end: date) -> pd.DataFrame:
    if not pids: return pd.DataFrame()
    q = "SELECT DATE(t.\"createdAt\") as sale_date, ti.\"productId\" as product_id, SUM(ti.quantity) as quantity FROM pos.\"TransactionItem\" ti JOIN pos.\"Transaction\" t ON t.id = ti.\"transactionId\" WHERE ti.\"productId\" IN :pids AND t.\"createdAt\" BETWEEN :s AND :e GROUP BY DATE(t.\"createdAt\"), ti.\"productId\""
    from sqlalchemy import bindparam
    with get_engine().connect() as c:
        df = pd.DataFrame([dict(r._mapping) for r in c.execute(text(q).bindparams(bindparam("pids", expanding=True)), {"pids": pids, "s": start, "e": end + timedelta(days=1)})])
    if not df.empty: df["sale_date"] = pd.to_datetime(df["sale_date"])
    return df

def fetch_products(skus: list = None, offset: int = 0, limit: int = 200):
    q = "SELECT id as product_id, sku, name FROM inventory.\"Product\""
    if skus:
        from sqlalchemy import bindparam
        with get_engine().connect() as c:
            return [dict(r._mapping) for r in c.execute(text(f"{q} WHERE LOWER(sku) IN :skus").bindparams(bindparam("skus", expanding=True)), {"skus": [s.lower() for s in skus]})]
    return query_dicts(f"{q} OFFSET :o LIMIT :l", {"o": offset, "l": limit})

def fetch_inventory(pids: list) -> dict:
    if not pids: return {}
    from sqlalchemy import bindparam
    with get_engine().connect() as c:
        res = c.execute(text("SELECT \"productId\" as pid, \"quantityOnHand\" as q FROM inventory.\"InventoryItem\" WHERE \"productId\" IN :pids").bindparams(bindparam("pids", expanding=True)), {"pids": pids})
        return {r._mapping["pid"]: int(r._mapping["q"]) for r in res}

def fetch_attrs(pids: list) -> dict:
    if not pids: return {}
    from sqlalchemy import bindparam
    with get_engine().connect() as c:
        res = c.execute(text("SELECT * FROM forecasting.product_attributes WHERE product_id IN :pids").bindparams(bindparam("pids", expanding=True)), {"pids": pids})
        return {r._mapping["product_id"]: dict(r._mapping) for r in res}

def fetch_forecasts(pid: str = None, s: date = None, e: date = None):
    ws = [f"{k} = :{k}" for k, v in [("product_id", pid)] if v]
    ws += [f"forecast_week_start >= :s"] if s else []
    ws += [f"forecast_week_start <= :e"] if e else []
    w = "WHERE " + " AND ".join(ws) if ws else ""
    return query_dicts(f"SELECT * FROM forecasting.demand_forecasts {w} ORDER BY forecast_week_start", {"product_id": pid, "s": s, "e": e})

def fetch_bundle(pid: str, weeks: int):
    st = date.today() + timedelta(days=1)
    res = query_dicts("SELECT * FROM forecasting.demand_forecasts WHERE product_id = :p AND scenario IN ('realistic','optimistic','pessimistic') AND forecast_week_start >= :s ORDER BY forecast_week_start", {"p": pid, "s": st})
    grp = {}
    for r in res:
        wk = r["forecast_week_start"]
        grp.setdefault(wk, {"forecast_week_start": wk, "confidence_lower": float(r["confidence_lower"] or 0), "confidence_upper": float(r["confidence_upper"] or 0), "model_version": r["model_version"]})
        grp[wk][r["scenario"]] = float(r["predicted_demand"] or 0)
    return [grp[k] for k in sorted(grp.keys())][:weeks]

def fetch_metrics(pid: str = None, s: date = None, e: date = None):
    ws = [f"{k} = :{k}" for k, v in [("product_id", pid)] if v]
    if s: ws.append("metric_date >= :s")
    if e: ws.append("metric_date <= :e")
    return query_dicts(f"SELECT * FROM forecasting.forecast_metrics {'WHERE ' + ' AND '.join(ws) if ws else ''} ORDER BY metric_date DESC", {"product_id": pid, "s": s, "e": e})

def fetch_registry(pid: str = None):
    w = "WHERE notes ILIKE :n" if pid else ""
    res = query_dicts(f"SELECT * FROM forecasting.forecast_models {w} ORDER BY trained_at DESC LIMIT 1", {"n": f"%product_id={pid}%"})
    if not res: return None
    r = res[0]
    r["metrics_json"] = json.loads(r["metrics_json"]) if isinstance(r["metrics_json"], str) else (r["metrics_json"] or {})
    return r

def fetch_factors(s: date, e: date) -> pd.DataFrame:
    df = query_df("SELECT * FROM forecasting.external_factors WHERE factor_date BETWEEN :s AND :e ORDER BY factor_date", {"s": s, "e": e}, ["factor_date"])
    if df.empty: return df
    df["factor_date"] = df["factor_date"].dt.normalize()
    for c in ["temperature", "precipitation", "humidity"]: df[c] = pd.to_numeric(df[c], errors="coerce").fillna(0)
    df["is_holiday"] = pd.to_numeric(df["is_holiday"], errors="coerce").fillna(0).astype(int)
    for c in ["holiday_name", "special_event"]: df[c] = df[c].fillna("")
    return df

def save_factors(recs: list):
    q = "INSERT INTO forecasting.external_factors (factor_date,temperature,precipitation,humidity,is_holiday,holiday_name,special_event) VALUES (:factor_date,:temperature,:precipitation,:humidity,:is_holiday,:holiday_name,:special_event) ON CONFLICT (factor_date) DO UPDATE SET temperature=EXCLUDED.temperature, precipitation=EXCLUDED.precipitation, humidity=EXCLUDED.humidity, is_holiday=EXCLUDED.is_holiday, holiday_name=EXCLUDED.holiday_name, special_event=EXCLUDED.special_event"
    execute(q, recs)

def save_forecasts(recs: list):
    q = "INSERT INTO forecasting.demand_forecasts (product_id,forecast_week_start,predicted_demand,confidence_lower,confidence_upper,scenario,model_version,created_at) VALUES (:product_id,:forecast_week_start,:predicted_demand,:confidence_lower,:confidence_upper,:scenario,:model_version,:created_at) ON CONFLICT (product_id,forecast_week_start,scenario) DO UPDATE SET predicted_demand=EXCLUDED.predicted_demand, confidence_lower=EXCLUDED.confidence_lower, confidence_upper=EXCLUDED.confidence_upper, model_version=EXCLUDED.model_version, created_at=EXCLUDED.created_at"
    execute(q, recs)

def save_metrics(recs: list):
    execute("INSERT INTO forecasting.forecast_metrics (product_id,metric_date,mape,rmse,forecast_bias,notes) VALUES (:product_id,:metric_date,:mape,:rmse,:forecast_bias,:notes)", recs)

def save_registry(r: dict):
    r["metrics_json"] = json.dumps(r["metrics_json"]) if isinstance(r.get("metrics_json"), dict) else r.get("metrics_json")
    execute("INSERT INTO forecasting.forecast_models (model_name,version,trained_at,metrics_json,status,notes) VALUES (:model_name,:version,:trained_at,:metrics_json,:status,:notes)", r)
