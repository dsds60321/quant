from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.schemas.common import ApiResponse
from app.services.market_service import MarketService

router = APIRouter(prefix="/market", tags=["market"])


@router.get("/indices")
def get_indices(db: Session = Depends(get_db)):
    data = MarketService(db).get_indices()
    return ApiResponse(data=data)
