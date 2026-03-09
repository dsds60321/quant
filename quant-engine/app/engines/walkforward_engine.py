from __future__ import annotations

from dateutil.relativedelta import relativedelta
from sqlalchemy.orm import Session

from app.engines.backtest_engine import BacktestEngine
from app.schemas.common import SeriesPoint
from app.schemas.optimize import WalkForwardRequest, WalkForwardResult, WalkForwardWindow
from app.schemas.strategy import StrategySnapshot


class WalkForwardEngine:
    def __init__(self, session: Session) -> None:
        self.backtest_engine = BacktestEngine(session)

    @staticmethod
    def _is_better(current: float | None, best: float | None) -> bool:
        if current is None:
            return False
        if best is None:
            return True
        return current > best

    def run(self, request: WalkForwardRequest, strategy: StrategySnapshot) -> WalkForwardResult:
        cursor = request.start_date
        windows: list[WalkForwardWindow] = []
        combined_points: list[SeriesPoint] = []
        total_returns: list[float] = []
        while True:
            train_start = cursor
            train_end = train_start + relativedelta(months=request.train_months) - relativedelta(days=1)
            test_start = train_end + relativedelta(days=1)
            test_end = test_start + relativedelta(months=request.test_months) - relativedelta(days=1)
            if test_end > request.end_date:
                break
            best_value = None
            best_metric = None
            for value in request.search_values:
                candidate = strategy.model_copy(deep=True)
                setattr(candidate, request.parameter, value)
                train_result, _ = self.backtest_engine.run(
                    candidate,
                    start_date=train_start,
                    end_date=train_end,
                    benchmark_symbol=request.benchmark_symbol,
                    commission_rate=0.001,
                    slippage_rate=0.0005,
                    tax_rate=0.0,
                    initial_cash=1_000_000.0,
                )
                metric = train_result.metrics.model_dump().get(request.objective)
                if self._is_better(metric, best_metric):
                    best_metric = metric
                    best_value = value
            out_strategy = strategy.model_copy(deep=True)
            if best_value is not None:
                setattr(out_strategy, request.parameter, best_value)
            test_result, _ = self.backtest_engine.run(
                out_strategy,
                start_date=test_start,
                end_date=test_end,
                benchmark_symbol=request.benchmark_symbol,
                commission_rate=0.001,
                slippage_rate=0.0005,
                tax_rate=0.0,
                initial_cash=1_000_000.0,
            )
            total_returns.append(test_result.metrics.total_return or 0)
            combined_points.extend(test_result.equity_curve)
            windows.append(
                WalkForwardWindow(
                    train_start=train_start,
                    train_end=train_end,
                    test_start=test_start,
                    test_end=test_end,
                    best_parameters={request.parameter: best_value},
                    metrics=test_result.metrics.model_dump(),
                )
            )
            cursor = cursor + relativedelta(months=request.test_months)
        summary = {
            "window_count": float(len(windows)),
            "average_total_return": float(sum(total_returns) / len(total_returns)) if windows else None,
        }
        return WalkForwardResult(strategy_id=strategy.id, windows=windows, summary=summary, combined_equity_curve=combined_points)
