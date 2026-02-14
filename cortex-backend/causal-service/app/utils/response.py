from typing import Any, Dict, Optional


def success_response(data: Any, message: str) -> Dict[str, Any]:
    return {'success': True, 'data': data, 'message': message}


def error_response(message: str, code: str = 'INTERNAL_ERROR', details: Optional[Any] = None) -> Dict[str, Any]:
    payload: Dict[str, Any] = {'success': False, 'error': {'code': code, 'message': message}}
    if details is not None:
        payload['error']['details'] = details
    return payload
