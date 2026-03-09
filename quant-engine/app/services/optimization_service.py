from __future__ import annotations

from datetime import timedelta

from sqlalchemy.orm import Session

from app.exceptions import ValidationError
from app.engines.optimization_engine import OptimizationEngine
from app.engines.walkforward_engine import WalkForwardEngine
from app.repositories.price_repository import PriceRepository
from app.repositories.strategy_repository import StrategyRepository
from app.schemas.optimize import OptimizationRequest, OptimizationResult, WalkForwardRequest, WalkForwardResult


class OptimizationService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.strategy_repository = StrategyRepository(session)
        self.price_repository = PriceRepository(session)
        self.optimization_engine = OptimizationEngine(session)
        self.walkforward_engine = WalkForwardEngine(session)

    def _default_dates(self):
        latest_date = self.price_repository.get_latest_price_date()
        if latest_date is None:
            raise ValidationError("price data unavailable")
        return latest_date - timedelta(days=365 * 5), latest_date

    def optimize(self, request: OptimizationRequest) -> OptimizationResult:
        strategy = self.strategy_repository.get_strategy_snapshot(request.strategy_id)
        if request.start_date is None or request.end_date is None:
            start_date, end_date = self._default_dates()
            request = request.model_copy(update={"start_date": request.start_date or start_date, "end_date": request.end_date or end_date})
        return self.optimization_engine.optimize(request, strategy)

    def walkforward(self, request: WalkForwardRequest) -> WalkForwardResult:
        strategy = self.strategy_repository.get_strategy_snapshot(request.strategy_id)
        return self.walkforward_engine.run(request, strategy)
