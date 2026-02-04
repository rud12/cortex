from __future__ import annotations
import os, re
from typing import Dict, List, Optional
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from sqlalchemy import create_engine, text

_ENGINE = None

def _parse_db_url(url: str, schema: str = 'inventory'):
    p = urlsplit(url)
    q = parse_qsl(p.query, keep_blank_values=True)
    schema = next((v for k, v in q if k.lower() == 'schema' and v), schema)
    return urlunsplit((p.scheme, p.netloc, p.path, urlencode([(k, v) for k, v in q if k.lower() != 'schema'], doseq=True), p.fragment)), schema

def get_engine():
    global _ENGINE
    u = str(os.getenv('DATABASE_URL', '')).strip()
    if not u: raise RuntimeError('DATABASE_URL is not configured')
    if _ENGINE is None:
        url, schema = _parse_db_url(u)
        _ENGINE = create_engine(url, pool_pre_ping=True, connect_args={'options': f'-csearch_path={schema}'})
    return _ENGINE

def _safe_path_segment(v: Optional[str], fallback: str = 'business_root') -> str:
    return re.sub(r'[^A-Za-z0-9_-]', '_', str(v or '').strip()) or fallback

def resolve_owner_key() -> str:
    if v := os.getenv('BUSINESS_ADMIN_USER_ID'): return _safe_path_segment(v)
    try:
        with get_engine().connect() as c:
            for q in [
                'SELECT "businessAdminUserId" AS id FROM "AppSettings" WHERE id = \'default\' LIMIT 1',
                'SELECT u.id FROM auth."User" u JOIN auth."UserRole" ur ON ur."userId" = u.id JOIN auth."Role" r ON r.id = ur."roleId" WHERE r.name = \'Administrator\' ORDER BY u."createdAt" ASC LIMIT 1'
            ]:
                try:
                    if r := c.execute(text(q)).fetchone(): return _safe_path_segment(str(r._mapping.get('id')))
                except: pass
    except: pass
    return 'business_root'

def get_product_by_id(pid: str) -> Optional[Dict[str, object]]:
    with get_engine().connect() as c:
        return dict(r._mapping) if (r := c.execute(text('SELECT id, sku, name, barcode, "imageUrl" AS image_url, "hasVariants" AS has_variants, "parentProductId" AS parent_product_id, "variantName" AS variant_name FROM "Product" WHERE id = :id'), {'id': pid}).fetchone()) else None

def list_root_products_with_variants() -> List[Dict[str, object]]:
    with get_engine().connect() as c:
        rs = c.execute(text('SELECT p.id, p.sku, p.name, p."hasVariants" AS has_variants, p."createdAt" AS created_at, v.id AS variant_id, v."variantName" AS variant_name FROM "Product" p LEFT JOIN "Product" v ON v."parentProductId" = p.id WHERE p."parentProductId" IS NULL ORDER BY p."createdAt" DESC, v."createdAt" ASC')).fetchall()
        d, out = {}, []
        for r in rs:
            r = dict(r._mapping)
            pid = str(r['id'])
            if pid not in d: d[pid] = {'id': pid, 'sku': r.get('sku'), 'name': r.get('name'), 'has_variants': bool(r.get('has_variants')), 'created_at': r.get('created_at'), 'variants': []}; out.append(d[pid])
            if r.get('variant_id'): d[pid]['variants'].append({'id': str(r['variant_id']), 'variant_name': r.get('variant_name')})
        return out
