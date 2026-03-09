from __future__ import annotations

from datetime import date
from typing import Any

from pydantic import Field

from app.schemas.common import CamelModel, SeriesPoint


class OptimizationRequest(CamelModel):
    strategy_id: int
    parameter: str = "roe_filter"
    start: float = 5.0
    end: float = 25.0
    step: float = 5.0
    objective: str = "sharpe"
    start_date: date | None = None
    end_date: date | None = None
    benchmark_symbol: str = "SPY"


class OptimizationTrial(CamelModel):
    parameters: dict[str, Any]
    objective_value: float | None = None
    metrics: dict[str, float | None] = Field(default_factory=dict)


class OptimizationResult(CamelModel):
    strategy_id: int
    objective: str
    best_parameters: dict[str, Any]
    trials: list[OptimizationTrial]


class WalkForwardRequest(CamelModel):
    strategy_id: int
    train_months: int = 24
    test_months: int = 6
    start_date: date
    end_date: date
    parameter: str = "roe_filter"
    search_values: list[float] = Field(default_factory=lambda: [5.0, 10.0, 15.0, 20.0, 25.0])
    objective: str = "sharpe"
    benchmark_symbol: str = "SPY"


class WalkForwardWindow(CamelModel):
    train_start: date
    train_end: date
    test_start: date
    test_end: date
    best_parameters: dict[str, Any]
    metrics: dict[str, float | None]


class WalkForwardResult(CamelModel):
    strategy_id: int
    windows: list[WalkForwardWindow]
    summary: dict[str, float | None]
    combined_equity_curve: list[SeriesPoint]
