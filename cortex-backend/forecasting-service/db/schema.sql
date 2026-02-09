CREATE SCHEMA IF NOT EXISTS forecasting;

CREATE TABLE IF NOT EXISTS forecasting.forecast_models (
    model_id SERIAL PRIMARY KEY,
    model_name TEXT NOT NULL,
    version TEXT NOT NULL,
    trained_at TIMESTAMP NOT NULL,
    metrics_json JSONB,
    status TEXT NOT NULL,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS forecasting.demand_forecasts (
    forecast_id SERIAL PRIMARY KEY,
    product_id UUID NOT NULL,
    forecast_week_start DATE NOT NULL,
    predicted_demand NUMERIC(12, 2) NOT NULL,
    confidence_lower NUMERIC(12, 2),
    confidence_upper NUMERIC(12, 2),
    scenario TEXT NOT NULL,
    model_version TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (product_id, forecast_week_start, scenario)
);

CREATE TABLE IF NOT EXISTS forecasting.external_factors (
    factor_date DATE PRIMARY KEY,
    temperature NUMERIC(6, 2),
    precipitation NUMERIC(6, 2),
    humidity NUMERIC(6, 2),
    is_holiday BOOLEAN DEFAULT FALSE,
    holiday_name TEXT,
    special_event TEXT
);

CREATE TABLE IF NOT EXISTS forecasting.forecast_metrics (
    metric_id SERIAL PRIMARY KEY,
    product_id UUID NOT NULL,
    metric_date DATE NOT NULL,
    mape NUMERIC(8, 2),
    rmse NUMERIC(12, 4),
    forecast_bias NUMERIC(12, 4),
    notes TEXT
);

CREATE TABLE IF NOT EXISTS forecasting.product_attributes (
    product_id UUID PRIMARY KEY,
    product_type TEXT DEFAULT 'non_necessary',
    lead_time_days INTEGER DEFAULT 7,
    service_level NUMERIC(4, 2) DEFAULT 0.95
);
