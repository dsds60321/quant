from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.schemas.common import ApiResponse
from app.schemas.data import StockRegisterRequest
from app.services.data_ingestion_service import DataIngestionService

router = APIRouter(prefix="/stocks", tags=["stocks"])


@router.get("/search")
def search_stocks(
    q: str = Query(..., min_length=1),
    market_type: str | None = Query(default=None, alias="marketType"),
    asset_group: str | None = Query(default=None, alias="assetGroup"),
    limit: int = Query(default=20, ge=1, le=20),
    db: Session = Depends(get_db),
):
    data = DataIngestionService(db).search_symbols(q, market_type, asset_group, limit)
    return ApiResponse(data=data)


@router.post("/register")
def register_stock(request: StockRegisterRequest, db: Session = Depends(get_db)):
    data = DataIngestionService(db).ensure_symbol(request)
    return ApiResponse(data=data)
