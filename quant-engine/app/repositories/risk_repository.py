from __future__ import annotations

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import RiskMetric


class RiskRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def store_portfolio_risk(self, portfolio_id: int, metrics: dict[str, float | None], as_of_date) -> RiskMetric:
        row = RiskMetric(
            portfolio_id=portfolio_id,
            date=as_of_date,
            var=Decimal(str(metrics.get("var", 0) or 0)),
            beta=Decimal(str(metrics.get("beta", 0) or 0)),
            volatility=Decimal(str(metrics.get("volatility", 0) or 0)),
            max_drawdown=Decimal(str(metrics.get("max_drawdown", 0) or 0)),
        )
        self.session.add(row)
        self.session.flush()
        return row

    def latest_for_portfolio(self, portfolio_id: int) -> RiskMetric | None:
        stmt = select(RiskMetric).where(RiskMetric.portfolio_id == portfolio_id).order_by(RiskMetric.date.desc())
        return self.session.scalars(stmt).first()
