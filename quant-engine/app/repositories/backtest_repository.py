from __future__ import annotations

from datetime import date
from decimal import Decimal

import pandas as pd
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.models import Backtest, BacktestEquity


class BacktestRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def create_backtest(self, strategy_id: int, start_date: date, end_date: date, metrics: dict[str, float | None], snapshot_id: int | None = None) -> Backtest:
        backtest = Backtest(
            strategy_id=strategy_id,
            snapshot_id=snapshot_id,
            start_date=start_date,
            end_date=end_date,
            cagr=Decimal(str(metrics.get("cagr", 0) or 0)),
            sharpe=Decimal(str(metrics.get("sharpe", 0) or 0)),
            max_drawdown=Decimal(str(metrics.get("max_drawdown", 0) or 0)),
            volatility=Decimal(str(metrics.get("annualized_volatility", 0) or 0)),
            win_rate=Decimal(str(metrics.get("win_rate", 0) or 0)),
        )
        self.session.add(backtest)
        self.session.flush()
        return backtest

    def replace_equity_curve(self, backtest_id: int, equity_curve: pd.Series) -> int:
        self.session.execute(delete(BacktestEquity).where(BacktestEquity.backtest_id == backtest_id))
        count = 0
        for dt, value in equity_curve.items():
            self.session.add(
                BacktestEquity(
                    backtest_id=backtest_id,
                    date=dt.date() if hasattr(dt, "date") else dt,
                    equity_value=Decimal(str(value)),
                )
            )
            count += 1
        return count

    def get_latest_by_strategy(self, strategy_id: int) -> Backtest | None:
        stmt = select(Backtest).where(Backtest.strategy_id == strategy_id).order_by(Backtest.created_at.desc())
        return self.session.scalars(stmt).first()

    def get_equity_curve(self, backtest_id: int) -> pd.Series:
        rows = self.session.scalars(
            select(BacktestEquity).where(BacktestEquity.backtest_id == backtest_id).order_by(BacktestEquity.date)
        ).all()
        if not rows:
            return pd.Series(dtype=float)
        return pd.Series(
            data=[float(row.equity_value) for row in rows],
            index=pd.to_datetime([row.date for row in rows]),
            name="equity",
        )
