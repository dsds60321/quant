from __future__ import annotations

from datetime import timedelta

from sqlalchemy.orm import Session

from app.exceptions import ValidationError
from app.engines.backtest_engine import BacktestEngine
from app.repositories.price_repository import PriceRepository
from app.repositories.strategy_repository import StrategyRepository
from app.schemas.compare import CompareRequest, CompareResponse, CompareStrategyResult


class CompareService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.strategy_repository = StrategyRepository(session)
        self.price_repository = PriceRepository(session)
        self.backtest_engine = BacktestEngine(session)

    def compare(self, request: CompareRequest) -> CompareResponse:
        latest_date = request.end_date or self.price_repository.get_latest_price_date()
        if latest_date is None:
            raise ValidationError("price data unavailable")
        start_date = request.start_date or (latest_date - timedelta(days=365 * 5))
        end_date = latest_date
        results: list[CompareStrategyResult] = []
        benchmark_curve = []
        for strategy_id in request.strategy_ids:
            strategy = self.strategy_repository.get_strategy_snapshot(strategy_id)
            result, _ = self.backtest_engine.run(
                strategy,
                start_date=start_date,
                end_date=end_date,
                benchmark_symbol=request.benchmark_symbol,
                commission_rate=0.001,
                slippage_rate=0.0005,
                tax_rate=0.0,
                initial_cash=1_000_000.0,
            )
            benchmark_curve = result.benchmark_curve
            results.append(
                CompareStrategyResult(
                    strategy_id=strategy_id,
                    equity_curve=result.equity_curve,
                    metrics=result.metrics.model_dump(),
                    rank={},
                )
            )
        for metric in ["sharpe", "cagr", "max_drawdown"]:
            ordered = sorted(
                results,
                key=lambda item: (item.metrics.get(metric) is None, -(item.metrics.get(metric) or float("-inf"))),
            )
            for rank, item in enumerate(ordered, start=1):
                item.rank[metric] = rank
        return CompareResponse(benchmark_symbol=request.benchmark_symbol, strategies=results, benchmark_curve=benchmark_curve)
