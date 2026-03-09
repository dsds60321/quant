from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.schemas.common import ApiResponse
from app.schemas.compare import CompareRequest
from app.services.compare_service import CompareService

router = APIRouter(tags=["compare"])


@router.post("/compare")
def compare(request: CompareRequest, db: Session = Depends(get_db)):
    data = CompareService(db).compare(request)
    return ApiResponse(data=data)


@router.post("/strategy/compare")
def compare_legacy(request: CompareRequest, db: Session = Depends(get_db)):
    data = CompareService(db).compare(request)
    return ApiResponse(data=data)
