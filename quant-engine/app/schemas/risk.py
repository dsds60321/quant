from __future__ import annotations

from app.schemas.common import CamelModel, SeriesPoint


class RiskRequest(CamelModel):
    portfolio_id: int | None = None
    strategy_id: int | None = None
    backtest_id: int | None = None
    benchmark_symbol: str = "SPY"


class RiskResponse(CamelModel):
    var: float | None = None
    parametric_var: float | None = None
    expected_shortfall: float | None = None
    beta: float | None = None
    volatility: float | None = None
    max_drawdown: float | None = None
    rolling_volatility: list[SeriesPoint]
    rolling_sharpe: list[SeriesPoint]
    drawdown_series: list[SeriesPoint]
