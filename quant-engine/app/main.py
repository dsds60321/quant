from datetime import datetime, timezone

from fastapi import FastAPI

from app.api.backtest_api import router as backtest_router
from app.api.compare_api import router as compare_router
from app.api.data_api import router as data_router
from app.api.factor_api import router as factor_router
from app.api.market_api import router as market_router
from app.api.news_api import router as news_router
from app.api.optimize_api import router as optimize_router
from app.api.risk_api import router as risk_router
from app.api.stock_api import router as stock_router
from app.config import get_settings
from app.exceptions import register_exception_handlers
from app.logging_config import configure_logging
from app.schemas.common import ApiResponse, HealthResponse
from app.services.backtest_dispatcher import BacktestDispatcher

configure_logging()
settings = get_settings()
app = FastAPI(title=settings.app_name, debug=settings.debug)
register_exception_handlers(app)
app.include_router(market_router)
app.include_router(factor_router)
app.include_router(backtest_router)
app.include_router(optimize_router)
app.include_router(compare_router)
app.include_router(risk_router)
app.include_router(data_router)
app.include_router(news_router)
app.include_router(stock_router)


@app.on_event("startup")
def startup_recovery():
    BacktestDispatcher.recover_orphaned_jobs("quant-engine 재시작으로 이전 백테스트 작업을 자동 실패 처리했습니다.")


@app.get("/health")
def health():
    return ApiResponse(data=HealthResponse(status="ok", app=settings.app_name, timestamp=datetime.now(timezone.utc)))
