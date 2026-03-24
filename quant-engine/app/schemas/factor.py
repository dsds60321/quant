from __future__ import annotations

from datetime import date

from pydantic import Field

from app.schemas.common import CamelModel
from app.schemas.backtest import UniverseScope
from app.schemas.strategy import StrategyFactorWeight


class UniverseConfig(CamelModel):
    min_market_cap: float = 0.0
    min_avg_volume: float = 0.0
    min_history_days: int = 20
    max_missing_ratio: float = 1.0
    stale_after_days: int = 30
    allowed_symbols: list[str] | None = None
    preserve_explicit_symbols: bool = False
    force_include_allowed_symbols: bool = False


class FactorCalculationRequest(CamelModel):
    as_of_date: date | None = None
    strategy_id: int | None = None
    stock_count: int = 20
    rebalance: str = "monthly"
    roe: float | None = None
    pbr: float | None = None
    momentum: float | None = None
    factor_weight_mode: str = "AUTO"
    factor_weights: list[StrategyFactorWeight] = Field(default_factory=list)
    universe: UniverseConfig = Field(default_factory=UniverseConfig)
    universe_scope: UniverseScope | None = None


class FactorSnapshot(CamelModel):
    symbol: str
    momentum: float | None = None
    volatility: float | None = None
    value_score: float | None = None
    quality_score: float | None = None
    growth_score: float | None = None
    liquidity_score: float | None = None
    final_score: float | None = None


class CandidateResponse(CamelModel):
    symbol: str
    score: float


class UniverseDiagnostics(CamelModel):
    total_symbols: int = 0
    price_ready_count: int = 0
    fundamentals_ready_count: int = 0
    roe_pass_count: int = 0
    pbr_pass_count: int = 0
    momentum_pass_count: int = 0
    final_selected_count: int = 0


class CandidateAnalysisResponse(CamelModel):
    candidates: list[CandidateResponse] = Field(default_factory=list)
    diagnostics: UniverseDiagnostics = Field(default_factory=UniverseDiagnostics)
