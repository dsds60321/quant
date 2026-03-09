from fastapi import APIRouter
from app.schemas.backtest import BacktestRequest
from app.schemas.common import ApiResponse
from app.services.backtest_dispatcher import BacktestDispatcher

router = APIRouter(tags=["backtest"])


@router.post("/backtest")
def backtest(request: BacktestRequest):
    data = BacktestDispatcher.enqueue(request)
    return ApiResponse(data=data)
