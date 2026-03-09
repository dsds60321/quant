from __future__ import annotations

from datetime import date, timedelta

import numpy as np
import pandas as pd
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.database import ensure_upsert_indexes
from app.models import InsiderTrade


class InsiderTradeRepository:
    _UPSERT_SQL = text(
        """
        INSERT INTO insider_trades (
            trade_key, symbol, transaction_date, insider, position, transaction_type, transaction_text,
            shares, value, ownership, direction, source, created_at, updated_at
        )
        VALUES (
            :trade_key, :symbol, :transaction_date, :insider, :position, :transaction_type, :transaction_text,
            :shares, :value, :ownership, :direction, :source, NOW(), NOW()
        )
        ON CONFLICT (trade_key)
        DO UPDATE SET
            symbol = EXCLUDED.symbol,
            transaction_date = EXCLUDED.transaction_date,
            insider = EXCLUDED.insider,
            position = EXCLUDED.position,
            transaction_type = EXCLUDED.transaction_type,
            transaction_text = EXCLUDED.transaction_text,
            shares = EXCLUDED.shares,
            value = EXCLUDED.value,
            ownership = EXCLUDED.ownership,
            direction = EXCLUDED.direction,
            source = EXCLUDED.source,
            updated_at = NOW()
        """
    )

    def __init__(self, session: Session) -> None:
        self.session = session

    def get_recent_activity_scores(
        self,
        end_date: date,
        lookback_days: int = 180,
        symbols: list[str] | None = None,
    ) -> pd.DataFrame:
        ensure_upsert_indexes(self.session)
        start_date = end_date - timedelta(days=lookback_days)
        stmt = select(InsiderTrade).where(
            InsiderTrade.transaction_date >= start_date,
            InsiderTrade.transaction_date <= end_date,
        )
        if symbols:
            stmt = stmt.where(InsiderTrade.symbol.in_(symbols))
        rows = self.session.scalars(stmt).all()
        if not rows:
            return pd.DataFrame(columns=["symbol", "insider_activity_score", "insider_trade_count"])

        frame = pd.DataFrame(
            [
                {
                    "symbol": row.symbol,
                    "transaction_date": row.transaction_date,
                    "direction": row.direction,
                    "shares": float(row.shares) if row.shares is not None else None,
                    "value": float(row.value) if row.value is not None else None,
                }
                for row in rows
            ]
        )
        frame["transaction_date"] = pd.to_datetime(frame["transaction_date"])
        frame["direction"] = pd.to_numeric(frame["direction"], errors="coerce").fillna(0.0)
        frame = frame[frame["direction"] != 0]
        if frame.empty:
            return pd.DataFrame(columns=["symbol", "insider_activity_score", "insider_trade_count"])

        magnitude = pd.to_numeric(frame["value"], errors="coerce").abs()
        missing_value = magnitude.isna() | (magnitude <= 0)
        magnitude.loc[missing_value] = pd.to_numeric(frame.loc[missing_value, "shares"], errors="coerce").abs()
        magnitude = magnitude.fillna(1.0)

        frame["days_since"] = (pd.Timestamp(end_date) - frame["transaction_date"]).dt.days.clip(lower=0)
        frame["decay"] = np.exp(-frame["days_since"] / 60.0)
        frame["weighted_signal"] = frame["direction"] * np.log1p(magnitude) * frame["decay"]

        grouped = frame.groupby("symbol", as_index=False).agg(
            insider_activity_score=("weighted_signal", "sum"),
            insider_trade_count=("symbol", "size"),
        )
        return grouped[["symbol", "insider_activity_score", "insider_trade_count"]]

    def get_latest_trade_date(self) -> date | None:
        ensure_upsert_indexes(self.session)
        return self.session.scalar(select(func.max(InsiderTrade.transaction_date)))

    def get_total_count(self) -> int:
        ensure_upsert_indexes(self.session)
        return int(self.session.scalar(select(func.count()).select_from(InsiderTrade)) or 0)

    def upsert_trades(self, rows: list[dict]) -> int:
        if not rows:
            return 0

        ensure_upsert_indexes(self.session)
        self.session.execute(self._UPSERT_SQL, rows)
        self.session.flush()
        return len(rows)
