from datetime import date, timedelta
from typing import Optional
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
import pandas as pd
from sqlalchemy import create_engine, text

from app.core.settings import get_settings

_ENGINE = None

def get_engine():
    global _ENGINE
    s = get_settings()
    if not s.database_url: 
        raise RuntimeError('DATABASE_URL is not configured')
    
    p = urlsplit(s.database_url)
    q = [(k, v) for k, v in parse_qsl(p.query, keep_blank_values=True) if k.lower() != 'schema']

    _ENGINE = create_engine(
        urlunsplit((p.scheme, p.netloc, p.path, urlencode(q, doseq=True), p.fragment)),
        pool_pre_ping=True,
        connect_args={'options': '-csearch_path=forecasting,inventory,pos'}
    )

    return _ENGINE

def fetch_causal_dataset(start_date=None, end_date=None, sku=None, product_id=None):
    end_date = end_date or date.today()
    start_date = start_date or end_date - timedelta(days=180)

    params = {
        "start": start_date,
        "end": end_date + timedelta(days=1),
        "sku": sku,
        "pid": product_id,
    }

    conditions = [
        't."createdAt" >= :start',
        't."createdAt" < :end',
        '(:sku IS NULL OR LOWER(p.sku) = LOWER(:sku))',
        '(:pid IS NULL OR ti."productId" = :pid)',
    ]

    query = text(f"""
        SELECT
            DATE(t."createdAt") AS event_date,
            ti."productId" AS product_id,
            p.sku,
            SUM(ti.quantity)::float AS sales_quantity,
            AVG(ti."unitPrice")::float AS unit_price,
            MAX((COALESCE(t."discountTotal", 0) > 0)::int) AS has_promotion,
            COALESCE(MAX(ef.is_holiday::int), 0) AS is_holiday,
            COALESCE(MAX((ef.special_event IS NOT NULL AND TRIM(ef.special_event) <> '')::int), 0) AS has_special_event,
            COALESCE(MAX(ef.temperature), 0)::float AS temperature,
            COALESCE(MAX(ef.precipitation), 0)::float AS precipitation,
            COALESCE(MAX(ef.humidity), 0)::float AS humidity
        FROM pos."TransactionItem" ti
        JOIN pos."Transaction" t ON t.id = ti."transactionId"
        JOIN inventory."Product" p ON p.id = ti."productId"
        LEFT JOIN forecasting.external_factors ef
            ON ef.factor_date = DATE(t."createdAt")
        WHERE {" AND ".join(conditions)}
        GROUP BY 1, 2, 3
        ORDER BY 1
    """)

    with get_engine().connect() as conn:
        df = pd.DataFrame(conn.execute(query, params).mappings().all())

    if df.empty:
        return df

    df["event_date"] = pd.to_datetime(df["event_date"], errors="coerce").dt.normalize()
    df = df.dropna(subset=["event_date"]).fillna(0)

    df["day_of_week"] = df["event_date"].dt.dayofweek.astype(float)
    df["month"] = df["event_date"].dt.month.astype(float)
    df["is_weekend"] = (df["day_of_week"] >= 5).astype(float)

    return df