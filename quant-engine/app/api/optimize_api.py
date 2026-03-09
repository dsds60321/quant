from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.schemas.common import ApiResponse
from app.schemas.optimize import OptimizationRequest, WalkForwardRequest
from app.services.optimization_service import OptimizationService

router = APIRouter(prefix="/optimize", tags=["optimize"])


@router.post("")
def optimize(request: OptimizationRequest, db: Session = Depends(get_db)):
    data = OptimizationService(db).optimize(request)
    return ApiResponse(data=data)


@router.post("/walkforward")
def walkforward(request: WalkForwardRequest, db: Session = Depends(get_db)):
    data = OptimizationService(db).walkforward(request)
    return ApiResponse(data=data)
