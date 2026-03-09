from __future__ import annotations

from datetime import date

from pydantic import Field

from app.schemas.common import CamelModel, SeriesPoint, WeightItem
from app.schemas.strategy import StrategyFactorWeight


class BacktestRequest(CamelModel):
    strategy_id: int
    start_date: date
    end_date: date
    snapshot_id: int | None = None
    benchmark_symbol: str = "SPY"
    commission_rate: float = 0.001
    slippage_rate: float = 0.0005
    tax_rate: float = 0.0
    initial_cash: float = 1_000_000.0
    factor_weight_mode: str = "AUTO"
    factor_weights: list[StrategyFactorWeight] = Field(default_factory=list)


class BacktestMetrics(CamelModel):
    cagr: float | None = None
    total_return: float | None = None
    annualized_return: float | None = None
    annualized_volatility: float | None = None
    sharpe: float | None = None
    sortino: float | None = None
    calmar: float | None = None
    max_drawdown: float | None = None
    win_rate: float | None = None
    turnover: float | None = None
    alpha: float | None = None
    beta: float | None = None
    information_ratio: float | None = None
    tracking_error: float | None = None


class RebalanceRecord(CamelModel):
    date: date
    selections: list[str]
    target_weights: list[WeightItem]
    turnover: float
    cost: float


class BacktestResult(CamelModel):
    backtest_id: int | None = None
    strategy_id: int
    benchmark_symbol: str
    metrics: BacktestMetrics
    equity_curve: list[SeriesPoint]
    benchmark_curve: list[SeriesPoint] = Field(default_factory=list)
    drawdown_curve: list[SeriesPoint] = Field(default_factory=list)
    rebalances: list[RebalanceRecord] = Field(default_factory=list)


class BacktestQueueResult(CamelModel):
    accepted: bool
    job_id: int | None = None
    status: str
    message: str
