from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
import json

import pandas as pd
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.models import Backtest, BacktestEquity


class BacktestRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    @staticmethod
    def _make_json_safe(value):
        if isinstance(value, (date, datetime)):
            return value.isoformat()
        if isinstance(value, Decimal):
            return float(value)
        if isinstance(value, dict):
            return {str(key): BacktestRepository._make_json_safe(item) for key, item in value.items()}
        if isinstance(value, (list, tuple, set)):
            return [BacktestRepository._make_json_safe(item) for item in value]
        return value

    @classmethod
    def _serialize_payload(cls, value) -> str:
        return json.dumps(cls._make_json_safe(value), ensure_ascii=False)

    def create_backtest(
        self,
        strategy_id: int,
        start_date: date,
        end_date: date,
        metrics: dict[str, float | None],
        snapshot_id: int | None = None,
        stock_breakdown: list[dict] | None = None,
        pattern_breakdown: list[dict] | None = None,
        trade_log: list[dict] | None = None,
        signal_timeline: list[dict] | None = None,
        research_config: dict | None = None,
        universe_scope: dict | None = None,
    ) -> Backtest:
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
            stock_breakdown_json=self._serialize_payload(stock_breakdown or []),
            pattern_breakdown_json=self._serialize_payload(pattern_breakdown or []),
            trade_log_json=self._serialize_payload(trade_log or []),
            signal_timeline_json=self._serialize_payload(signal_timeline or []),
            research_config_json=self._serialize_payload(research_config) if research_config is not None else None,
            universe_scope_json=self._serialize_payload(universe_scope) if universe_scope is not None else None,
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
