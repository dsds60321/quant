from __future__ import annotations

import pandas as pd
from sqlalchemy.orm import Session

from app.engines.risk_engine import RiskEngine
from app.exceptions import ValidationError
from app.repositories.backtest_repository import BacktestRepository
from app.repositories.benchmark_repository import BenchmarkRepository
from app.repositories.portfolio_repository import PortfolioRepository
from app.repositories.price_repository import PriceRepository
from app.schemas.risk import RiskRequest, RiskResponse
from app.services.benchmark_service import BenchmarkService


class RiskService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.backtest_repository = BacktestRepository(session)
        self.portfolio_repository = PortfolioRepository(session)
        self.price_repository = PriceRepository(session)
        self.benchmark_service = BenchmarkService(session)
        self.risk_engine = RiskEngine(self.benchmark_service)

    def _portfolio_equity_curve(self, portfolio_id: int) -> pd.Series:
        positions = self.portfolio_repository.get_positions_frame(portfolio_id)
        if positions.empty:
            return pd.Series(dtype=float)
        latest_prices = self.price_repository.get_latest_prices(positions["symbol"].tolist())
        merged = positions.merge(latest_prices[["symbol", "close"]], on="symbol", how="left")
        total_value = float((merged["quantity"] * merged["close"].fillna(merged["current_price"])).sum())
        idx = pd.date_range(end=pd.Timestamp.utcnow().normalize(), periods=30, freq="B")
        return pd.Series([total_value] * len(idx), index=idx)

    def get_risk(self, request: RiskRequest) -> RiskResponse:
        if request.backtest_id is not None:
            equity_curve = self.backtest_repository.get_equity_curve(request.backtest_id)
        elif request.portfolio_id is not None:
            equity_curve = self._portfolio_equity_curve(request.portfolio_id)
        else:
            raise ValidationError("portfolio_id or backtest_id is required")
        benchmark_curve = None
        if not equity_curve.empty:
            benchmark_curve = self.benchmark_service.get_benchmark_series(
                request.benchmark_symbol,
                equity_curve.index.min().date(),
                equity_curve.index.max().date(),
            )
        return self.risk_engine.evaluate(equity_curve, benchmark_curve)
