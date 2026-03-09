from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.schemas.common import ApiResponse
from app.schemas.risk import RiskRequest
from app.services.risk_service import RiskService

router = APIRouter(tags=["risk"])


@router.get("/risk")
def get_risk(
    portfolio_id: int | None = Query(default=None),
    strategy_id: int | None = Query(default=None),
    backtest_id: int | None = Query(default=None),
    benchmark_symbol: str = Query(default="SPY"),
    db: Session = Depends(get_db),
):
    data = RiskService(db).get_risk(
        RiskRequest(portfolio_id=portfolio_id, strategy_id=strategy_id, backtest_id=backtest_id, benchmark_symbol=benchmark_symbol)
    )
    return ApiResponse(data=data)
