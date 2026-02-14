from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd

from app.services.data_access import fetch_causal_dataset

BASE_COLS = [
    'unit_price', 'has_promotion', 'is_holiday', 'has_special_event',
    'temperature', 'precipitation', 'humidity', 'day_of_week', 'month', 'is_weekend'
]
TREATMENTS = ['unit_price', 'has_promotion', 'is_holiday', 'has_special_event', 'temperature', 'precipitation', 'humidity']

@dataclass
class CausalResult:
    factors: List[Dict[str, Any]]
    diagnostics: List[str]
    confidence_score: float
    summary: str
    interval_calibrated: bool

class CausalEngine:
    def analyze( self, sku: Optional[str] = None, product_id: Optional[str] = None, start_date=None, end_date=None ) -> CausalResult:
        df = fetch_causal_dataset(
            start_date=start_date,
            end_date=end_date,
            sku=sku,
            product_id=product_id
        )

        # --- less data ---
        if df.empty or len(df) < 12:
            return CausalResult([], ['low_data'], 20.0,
                                'Insufficient data for causal inference.', False)

        # --- Default causal ---
        edges = [
            ('unit_price', 'sales_quantity', -0.4),
            ('has_promotion', 'sales_quantity', 0.3),
            ('is_holiday', 'sales_quantity', 0.25),
            ('has_special_event', 'sales_quantity', 0.2),
            ('temperature', 'sales_quantity', 0.1),
            ('precipitation', 'sales_quantity', -0.1),
            ('humidity', 'sales_quantity', -0.05),
        ]

        # --- Causal learning ---
        try:
            from causalnex.structure.notears import from_pandas

            model_df = (
                df[BASE_COLS + ['sales_quantity']]
                .apply(pd.to_numeric, errors='coerce')
                .fillna(0.0)
            )

            sm = from_pandas(model_df)
            learned = [
                (s, t, float(w or 0.0)) for s, t, w in sm.edges(data='weight') if t == 'sales_quantity'
            ]
            if learned:
                edges = learned
        except Exception:
            pass

        # --- Build graph ---
        graph_dot = "digraph {\n" + "\n".join(
            f"    {s} -> {t};" for s, t, _ in edges
        ) + "\n}"

        mean_sales = max(1e-6, float(df['sales_quantity'].mean()))
        diagnostics, dowhy_effects, confidences = [], {}, {}

        # --- DoWhy estimation ---
        try:
            from dowhy import CausalModel

            for t in TREATMENTS:
                try:
                    model = CausalModel(df, t, 'sales_quantity', graph_dot)
                    est = model.estimate_effect(
                        model.identify_effect(proceed_when_unidentifiable=True),
                        method_name='backdoor.linear_regression'
                    )

                    val = float(est.value)
                    err = float(getattr(est, 'stderr', 0.0) or 0.0)

                    dowhy_effects[t] = (val / mean_sales) * 100
                    confidences[t] = max(0.05, min(0.99, 1 - err / (abs(val) + 1e-6)))
                except Exception:
                    diagnostics.append(f'weak_identification:{t}')
        except Exception:
            diagnostics.append('DOWHY_UNAVAILABLE')

        # --- EconML estimation ---
        econml_effects = {}
        try:
            from econml.dml import LinearDML
            from sklearn.linear_model import LassoCV, LogisticRegression

            X = df[['temperature', 'precipitation', 'humidity',
                    'day_of_week', 'month', 'is_weekend']].to_numpy(float)
            y = df['sales_quantity'].to_numpy(float)

            for t, is_binary in [
                ('unit_price', False),
                ('has_promotion', True),
                ('is_holiday', True),
                ('has_special_event', True)
            ]:
                arr = df[t].to_numpy(float)
                if np.unique(arr).size < 2:
                    continue

                try:
                    model_t = LogisticRegression(max_iter=300) if is_binary else LassoCV(cv=3)
                    mdl = LinearDML(
                        model_y=LassoCV(cv=3),
                        model_t=model_t,
                        cv=3,
                        random_state=42
                    )
                    mdl.fit(y, arr, X=X)
                    econml_effects[t] = float(np.mean(mdl.effect(X)) / mean_sales) * 100
                except Exception:
                    pass
        except Exception:
            pass

        # --- Combine effects ---
        factors = []
        for t in TREATMENTS:
            d, e = dowhy_effects.get(t), econml_effects.get(t)
            if d is None and e is None:
                continue

            impact = e if d is None else d if e is None else 0.6 * d + 0.4 * e
            factors.append({
                'name': t,
                'direction': 'increase' if impact >= 0 else 'decrease',
                'impact_percent': impact,
                'confidence': round(confidences.get(t, 0.5), 3),
            })

        # --- Diagnostics ---
        if not factors:
            diagnostics.append('weak_identification')
        if 'has_promotion' not in [f['name'] for f in factors]:
            diagnostics.append('missing_factor_proxy')

        # --- Ranking & summary ---
        factors.sort(key=lambda x: abs(x['impact_percent']), reverse=True)

        score = (
            min(100.0, max(5.0,
                np.mean([f['confidence'] for f in factors]) * 100 if factors else 20.0))
        )

        summary = (
            'No strong drivers detected.'
            if not factors else
            'Main drivers: ' + ', '.join(
                f"{f['name']} ({f['impact_percent']:+.2f}%)"
                for f in factors[:3]
            )
        )

        return CausalResult(
            factors,
            sorted(set(diagnostics)),
            round(score, 2),
            summary,
            False
        )