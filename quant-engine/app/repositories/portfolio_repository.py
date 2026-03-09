from __future__ import annotations

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.exceptions import NotFoundError
from app.models import Portfolio, Position


class PortfolioRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def get_portfolio(self, portfolio_id: int) -> Portfolio:
        portfolio = self.session.scalar(select(Portfolio).where(Portfolio.id == portfolio_id))
        if portfolio is None:
            raise NotFoundError(f"portfolio not found: {portfolio_id}")
        return portfolio

    def get_positions_frame(self, portfolio_id: int) -> pd.DataFrame:
        rows = self.session.scalars(select(Position).where(Position.portfolio_id == portfolio_id)).all()
        return pd.DataFrame(
            [
                {
                    "symbol": row.symbol,
                    "quantity": float(row.quantity or 0),
                    "avg_price": float(row.avg_price or 0),
                    "current_price": float(row.current_price or 0),
                    "market_value": float(row.market_value or 0),
                    "unrealized_pnl": float(row.unrealized_pnl or 0),
                }
                for row in rows
            ]
        )
