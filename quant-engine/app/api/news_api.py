from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.schemas.common import ApiResponse
from app.schemas.news import NewsImpactQuery, NewsSentimentQuery
from app.services.news_service import NewsService

router = APIRouter(prefix="/news", tags=["news"])


@router.get("/sentiment")
def sentiment(
    symbol: str | None = Query(default=None),
    keyword: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    data = NewsService(db).get_sentiment(NewsSentimentQuery(symbol=symbol, keyword=keyword, limit=limit))
    db.commit()
    return ApiResponse(data=data)


@router.get("/impact/{symbol}")
def impact(
    symbol: str = Path(..., min_length=1),
    limit: int = Query(default=100, ge=1, le=100),
    lookback_days: int = Query(default=7, ge=1, le=30),
    db: Session = Depends(get_db),
):
    data = NewsService(db).get_impact_graph(NewsImpactQuery(symbol=symbol, limit=limit, lookback_days=lookback_days))
    return ApiResponse(data=data)
