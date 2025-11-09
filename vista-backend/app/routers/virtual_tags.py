"""
API endpoints for managing virtual tags (user tags and calculation tags)
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any, Dict
from app.services.virtual_tag_service import update_user_tag_value, evaluate_calculation_tags
from app.services.config_loader import load_latest_config

router = APIRouter()


class UpdateUserTagRequest(BaseModel):
    tag_name: str
    value: Any


@router.post("/api/user-tags/update")
async def update_user_tag(request: UpdateUserTagRequest):
    """
    Update a user tag value
    
    This allows external systems to write to user tags, which will then
    be reflected in polled values and served over protocol servers
    """
    success = update_user_tag_value(request.tag_name, request.value)
    
    if success:
        return {
            "ok": True,
            "message": f"User tag '{request.tag_name}' updated to {request.value}"
        }
    else:
        raise HTTPException(status_code=404, detail=f"User tag '{request.tag_name}' not found")


@router.post("/api/calculation-tags/evaluate")
async def evaluate_calculations():
    """
    Manually trigger evaluation of all calculation tags
    
    Normally calculation tags are evaluated automatically every second,
    but this endpoint allows manual triggering if needed
    """
    try:
        config = load_latest_config()
        if config is None:
            raise HTTPException(status_code=500, detail="Configuration not loaded")
        
        evaluate_calculation_tags(config)
        
        return {
            "ok": True,
            "message": "Calculation tags evaluated successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error evaluating calculation tags: {str(e)}")


@router.get("/api/virtual-tags/status")
async def get_virtual_tags_status():
    """
    Get status of all virtual tags (user tags + calculation tags)
    """
    from app.services.polling_service import _latest_polled_values, _latest_polled_values_lock
    
    with _latest_polled_values_lock:
        user_tags = _latest_polled_values.get('USER_TAGS', {})
        calc_tags = _latest_polled_values.get('CALC_TAGS', {})
        
        return {
            "ok": True,
            "user_tags_count": len(user_tags),
            "calc_tags_count": len(calc_tags),
            "user_tags": user_tags,
            "calc_tags": calc_tags
        }
