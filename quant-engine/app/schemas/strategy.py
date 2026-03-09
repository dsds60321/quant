from __future__ import annotations

from decimal import Decimal

from pydantic import Field

from app.schemas.common import CamelModel


class StrategyFactorWeight(CamelModel):
    factor_name: str
    factor_weight: float


class StrategySnapshot(CamelModel):
    id: int
    name: str
    description: str | None = None
    roe_filter: Decimal | None = None
    pbr_filter: Decimal | None = None
    momentum_filter: Decimal | None = None
    stock_count: int = 20
    rebalance_period: str = "monthly"
    weighting_method: str = "equal_weight"
    status: str = "DRAFT"
    factor_weights: dict[str, float] = Field(default_factory=dict)
