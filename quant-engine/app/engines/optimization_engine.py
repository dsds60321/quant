from __future__ import annotations

import numpy as np
from sqlalchemy.orm import Session

from app.engines.backtest_engine import BacktestEngine
from app.schemas.optimize import OptimizationRequest, OptimizationResult, OptimizationTrial
from app.schemas.strategy import StrategySnapshot


class OptimizationEngine:
    def __init__(self, session: Session) -> None:
        self.backtest_engine = BacktestEngine(session)

    @staticmethod
    def _is_better(current: float | None, best: float | None) -> bool:
        if current is None:
            return False
        if best is None:
            return True
        return current > best

    def optimize(self, request: OptimizationRequest, strategy: StrategySnapshot) -> OptimizationResult:
        values = np.arange(request.start, request.end + request.step, request.step)
        trials: list[OptimizationTrial] = []
        best_trial: OptimizationTrial | None = None
        for value in values:
            override = strategy.model_copy(deep=True)
            setattr(override, request.parameter, value)
            result, _ = self.backtest_engine.run(
                override,
                start_date=request.start_date,
                end_date=request.end_date,
                benchmark_symbol=request.benchmark_symbol,
                commission_rate=0.001,
                slippage_rate=0.0005,
                tax_rate=0.0,
                initial_cash=1_000_000.0,
            )
            metric_map = result.metrics.model_dump()
            trial = OptimizationTrial(parameters={request.parameter: float(value)}, objective_value=metric_map.get(request.objective), metrics=metric_map)
            trials.append(trial)
            if best_trial is None:
                best_trial = trial
                continue
            current = trial.objective_value
            best = best_trial.objective_value
            if self._is_better(current, best):
                best_trial = trial
        return OptimizationResult(
            strategy_id=strategy.id,
            objective=request.objective,
            best_parameters=best_trial.parameters if best_trial else {},
            trials=trials,
        )
