from typing import Any, Dict
from fastapi import APIRouter
from app.services.causal_engine import CausalEngine
from app.utils.response import success_response

router = APIRouter(prefix='/api/v1/causal')

@router.post('/analyze')
def analyze(payload: Dict[str, Any]):
    filters = payload.get('filters') or {}
    res = CausalEngine().analyze(
        sku=filters.get('sku'),
        product_id=filters.get('product_id'),
        start_date=filters.get('start_date'),
        end_date=filters.get('end_date'),
    )

    return success_response({
        'factors': res.factors,
        'diagnostics': res.diagnostics,
        'confidence_score': res.confidence_score,
        'summary': res.summary,
        'interval_calibrated': res.interval_calibrated,
        'trace_id': payload.get('trace_id'),
    }, 'Causal analysis generated')
