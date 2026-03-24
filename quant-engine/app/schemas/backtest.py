from __future__ import annotations

from datetime import date

from pydantic import Field

from app.schemas.common import CamelModel, SeriesPoint, WeightItem
from app.schemas.strategy import StrategyFactorWeight


class PatternDefinition(CamelModel):
    id: str
    name: str
    short_label: str | None = None
    category: str
    thesis: str | None = None
    rule_summary: str | None = None
    lookback_days: int = 55
    breakout_percent: float = 1.0
    holding_days: int = 30
    momentum_threshold: float = 10.0
    slope_threshold: float = 0.2
    volume_surge_percent: float = 12.0
    sweep_buffer_percent: float = 0.4
    max_reentry_bars: int = 2
    wick_ratio_threshold: float = 1.8
    close_recovery_percent: float = 55.0
    min_gap_percent: float = 0.6
    min_fill_percent: float = 45.0
    max_confirmation_bars: int = 12
    stop_loss_percent: float = 8.0
    target1_percent: float = 12.0
    target2_percent: float = 20.0
    entry_mode: str = "SIGNAL_CLOSE"
    exit_mode: str = "TRAILING_STOP"
    enabled: bool = True
    source: str = "preset"


class SignalPlan(CamelModel):
    buy_mode: str
    sell_mode: str
    hold_mode: str
    max_holding_days: int
    stop_loss_percent: float
    take_profit_percent: float
    rebalance_guard: str


class BacktestResearchConfig(CamelModel):
    pattern_definitions: list[PatternDefinition] = Field(default_factory=list)
    signal_plan: SignalPlan | None = None


class UniverseStock(CamelModel):
    symbol: str
    name: str
    exchange: str | None = None
    market_type: str | None = None
    asset_group: str | None = None


class UniverseScope(CamelModel):
    override_mode: str = "STRATEGY_DEFAULT"
    mode: str = "FULL_MARKET"
    market_scope: str = "STRATEGY_DEFAULT"
    asset_scope: str = "STRATEGY_DEFAULT"
    selected_stocks: list[UniverseStock] = Field(default_factory=list)
    selected_sectors: list[str] = Field(default_factory=list)
    selected_themes: list[str] = Field(default_factory=list)
    portfolio_source: str = "SAVED_PORTFOLIO"
    portfolio_key: str | None = None
    portfolio_id: int | None = None
    portfolio_name: str | None = None
    estimated_stock_count: int | None = None
    last_updated_at: str | None = None


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
    universe_scope: UniverseScope | None = None
    pattern_definitions: list[PatternDefinition] = Field(default_factory=list)
    signal_plan: SignalPlan | None = None


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


class BacktestStockBreakdown(CamelModel):
    symbol: str
    weight: float
    return_percent: float
    contribution_percent: float
    win_rate_percent: float | None = None
    drawdown_percent: float | None = None
    signal: str | None = None
    entry_date: date | None = None
    exit_date: date | None = None
    holding_days: int | None = None
    active_patterns: list[str] = Field(default_factory=list)
    note: str | None = None


class BacktestPatternBreakdown(CamelModel):
    name: str
    sample_size: int
    avg_return_percent: float
    sharpe: float | None = None
    max_drawdown_percent: float | None = None
    win_rate_percent: float | None = None
    avg_holding_days: int | None = None
    turnover_percent: float | None = None
    status: str | None = None


class BacktestTradeLogItem(CamelModel):
    date: date
    symbol: str
    action: str
    pattern_id: str | None = None
    pattern: str | None = None
    signal_date: date | None = None
    signal_price: float | None = None
    trigger_price: float | None = None
    recommended_buy_price: float | None = None
    entry_range_low: float | None = None
    entry_range_high: float | None = None
    entry_distance_percent: float | None = None
    entry_allowed: bool | None = None
    stop_price: float | None = None
    trailing_stop_price: float | None = None
    target_price1: float | None = None
    target_price2: float | None = None
    recommended_sell_price: float | None = None
    expected_exit_price: float | None = None
    expected_return_percent: float | None = None
    expected_return_percent2: float | None = None
    risk_reward: float | None = None
    execution_label: str | None = None
    signal_reason: str | None = None
    exit_reason: str | None = None
    current_state: str | None = None
    current_price: float | None = None
    open_position: bool | None = None
    entry_date: date | None = None
    entry_price: float | None = None
    exit_date: date | None = None
    exit_price: float | None = None
    note: str | None = None
    return_percent: float | None = None
    holding_days: int | None = None
    mfe_percent: float | None = None
    mae_percent: float | None = None
    detection_start_date: date | None = None
    detection_end_date: date | None = None


class BacktestSignalTimelineItem(CamelModel):
    date: date
    symbol: str
    signal: str
    pattern_id: str | None = None
    pattern: str | None = None
    signal_price: float | None = None
    trigger_price: float | None = None
    recommended_buy_price: float | None = None
    entry_range_low: float | None = None
    entry_range_high: float | None = None
    entry_distance_percent: float | None = None
    entry_allowed: bool | None = None
    stop_price: float | None = None
    trailing_stop_price: float | None = None
    target_price1: float | None = None
    target_price2: float | None = None
    recommended_sell_price: float | None = None
    expected_exit_price: float | None = None
    expected_return_percent: float | None = None
    expected_return_percent2: float | None = None
    risk_reward: float | None = None
    execution_label: str | None = None
    signal_reason: str | None = None
    exit_reason: str | None = None
    current_state: str | None = None
    current_price: float | None = None
    open_position: bool | None = None
    entry_date: date | None = None
    entry_price: float | None = None
    exit_date: date | None = None
    exit_price: float | None = None
    status: str | None = None
    note: str | None = None
    return_percent: float | None = None
    holding_days: int | None = None
    mfe_percent: float | None = None
    mae_percent: float | None = None
    detection_start_date: date | None = None
    detection_end_date: date | None = None


class BacktestResult(CamelModel):
    backtest_id: int | None = None
    strategy_id: int
    benchmark_symbol: str
    metrics: BacktestMetrics
    universe_scope: UniverseScope | None = None
    equity_curve: list[SeriesPoint]
    benchmark_curve: list[SeriesPoint] = Field(default_factory=list)
    drawdown_curve: list[SeriesPoint] = Field(default_factory=list)
    rebalances: list[RebalanceRecord] = Field(default_factory=list)
    stock_breakdown: list[BacktestStockBreakdown] = Field(default_factory=list)
    pattern_breakdown: list[BacktestPatternBreakdown] = Field(default_factory=list)
    trade_log: list[BacktestTradeLogItem] = Field(default_factory=list)
    signal_timeline: list[BacktestSignalTimelineItem] = Field(default_factory=list)
    research_config: BacktestResearchConfig | None = None


class BacktestQueueResult(CamelModel):
    accepted: bool
    job_id: int | None = None
    status: str
    message: str
