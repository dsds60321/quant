from __future__ import annotations

from datetime import date

from app.schemas.common import CamelModel, SeriesPoint


class CompareRequest(CamelModel):
    strategy_ids: list[int]
    start_date: date | None = None
    end_date: date | None = None
    benchmark_symbol: str = "SPY"


class CompareStrategyResult(CamelModel):
    strategy_id: int
    equity_curve: list[SeriesPoint]
    metrics: dict[str, float | None]
    rank: dict[str, int]


class CompareResponse(CamelModel):
    benchmark_symbol: str
    strategies: list[CompareStrategyResult]
    benchmark_curve: list[SeriesPoint]
