from __future__ import annotations
from typing import List, Optional
from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
from app.core.paths import get_dataset_root
from app.services.dataset_storage import save_upload_bytes
from app.services.inventory import get_product_by_id, resolve_owner_key
from app.services.vision_repository import (
    add_product_reference_image, delete_product_reference_image,
    list_product_reference_images, list_product_reference_status
)
from app.utils.response import success_response

router = APIRouter()

def _resolve_product_and_variant(product_id: str, variant_id: Optional[str]) -> tuple[str, Optional[str], dict]:
    product = get_product_by_id(product_id)
    if not product: raise HTTPException(404, 'Product not found')
    pid, vid = product_id, variant_id
    if product.get('parent_product_id') and not vid:
        pid, vid = str(product['parent_product_id']), product_id
        product = get_product_by_id(pid)
        if not product: raise HTTPException(404, 'Parent product not found')
    if vid:
        variant = get_product_by_id(vid)
        if not variant: raise HTTPException(404, 'Variant not found')
        if str(variant.get('parent_product_id') or '') != pid: raise HTTPException(400, 'variantId does not belong to selected product')
    return pid, vid, product

@router.post('/api/v1/vision/products/{product_id}/reference-images')
async def upload_product_reference_images(product_id: str, files: List[UploadFile] = File(...), variantId: Optional[str] = Form(None)):
    pid, vid, product = _resolve_product_and_variant(product_id, variantId)
    if not files: raise HTTPException(400, 'At least one image is required')
    base_path = get_dataset_root() / resolve_owner_key() / pid
    if vid: base_path /= vid
    
    created = [add_product_reference_image(pid, save_upload_bytes(str(base_path), await fu.read(), fu.filename), vid) for fu in files]
    status_rows = [r for r in list_product_reference_status() if r.get('product_id') == pid]
    
    return success_response({'created': created, 'product': product, 'product_id': pid, 'variant_id': vid, 'readiness': status_rows[0] if status_rows else None}, 'Reference images uploaded')

@router.get('/api/v1/vision/products/reference-status')
def get_product_reference_status():
    return success_response({'items': list_product_reference_status()}, 'Reference status fetched')

@router.get('/api/v1/vision/products/{product_id}/reference-images')
def get_product_reference_images(product_id: str, limit: int = Query(300, ge=1, le=1000), variantId: Optional[str] = Query(None)):
    pid, vid, product = _resolve_product_and_variant(product_id, variantId)
    return success_response({'items': list_product_reference_images(pid, vid, limit), 'product': product, 'product_id': pid, 'variant_id': vid}, 'Reference images fetched')

@router.delete('/api/v1/vision/products/{product_id}/reference-images/{image_id}')
def delete_product_reference_image_route(product_id: str, image_id: str, variantId: Optional[str] = Query(None)):
    pid, vid, product = _resolve_product_and_variant(product_id, variantId)
    removed = delete_product_reference_image(pid, image_id, vid)
    if not removed: raise HTTPException(404, 'Image not found')
    return success_response({'deleted': removed, 'product': product, 'product_id': pid, 'variant_id': vid}, 'Reference image deleted')
