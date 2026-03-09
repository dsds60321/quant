from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.exceptions import NotFoundError
from app.models import Strategy, StrategyFactor
from app.schemas.strategy import StrategySnapshot


class StrategyRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def get_strategy(self, strategy_id: int) -> Strategy:
        strategy = self.session.scalar(select(Strategy).where(Strategy.id == strategy_id))
        if strategy is None:
            raise NotFoundError(f"strategy not found: {strategy_id}")
        return strategy

    def get_strategy_snapshot(self, strategy_id: int) -> StrategySnapshot:
        strategy = self.get_strategy(strategy_id)
        factors = self.session.scalars(select(StrategyFactor).where(StrategyFactor.strategy_id == strategy_id)).all()
        weights = {factor.factor_name: float(factor.factor_weight) for factor in factors}
        return StrategySnapshot(
            id=strategy.id,
            name=strategy.name,
            description=strategy.description,
            roe_filter=strategy.roe_filter,
            pbr_filter=strategy.pbr_filter,
            momentum_filter=strategy.momentum_filter,
            stock_count=strategy.stock_count or 20,
            rebalance_period=(strategy.rebalance_period or "monthly").lower(),
            weighting_method=(strategy.weighting_method or "equal_weight").lower(),
            status=strategy.status,
            factor_weights=weights,
        )
