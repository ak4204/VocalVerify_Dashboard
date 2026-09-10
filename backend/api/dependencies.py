"""
dependencies.py
───────────────
Shared FastAPI dependencies: device validation, DB session helper.
"""
from fastapi import Header, HTTPException
from typing import Optional


async def validate_device_id(device_id: str) -> str:
    """
    Validates that device_id is non-empty and well-formed.
    Extend this to check against an enrolled device registry.
    """
    if not device_id or len(device_id) < 4:
        raise HTTPException(status_code=400, detail="Invalid device_id")
    return device_id
