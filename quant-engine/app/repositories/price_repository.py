from __future__ import annotations

from datetime import date
from decimal import Decimal

import pandas as pd
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.database import ensure_upsert_indexes
from app.models import Price


class PriceRepository:
    _UPSERT_SQL = text(
        """
        INSERT INTO prices (symbol, date, open, high, low, close, adj_close, volume, created_at, updated_at)
        VALUES (:symbol, :date, :open, :high, :low, :close, :adj_close, :volume, NOW(), NOW())
        ON CONFLICT (symbol, date)
        DO UPDATE SET
            open = EXCLUDED.open,
            high = EXCLUDED.high,
            low = EXCLUDED.low,
            close = EXCLUDED.close,
            adj_close = EXCLUDED.adj_close,
            volume = EXCLUDED.volume,
            updated_at = NOW()
        """
    )

    def __init__(self, session: Session) -> None:
        self.session = session

    def get_price_frame(self, end_date: date, lookback_days: int = 400, symbols: list[str] | None = None) -> pd.DataFrame:
        stmt = select(Price).where(Price.date <= end_date)
        if symbols:
            stmt = stmt.where(Price.symbol.in_(symbols))
        rows = self.session.scalars(stmt).all()
        if not rows:
            return pd.DataFrame(columns=["symbol", "date", "close", "adj_close", "volume"])
        frame = pd.DataFrame(
            [
                {
                    "symbol": row.symbol,
                    "date": row.date,
                    "open": float(row.open or 0),
                    "high": float(row.high or 0),
                    "low": float(row.low or 0),
                    "close": float(row.close or 0),
                    "adj_close": float(row.adj_close or row.close or 0),
                    "volume": float(row.volume or 0),
                }
                for row in rows
            ]
        )
        frame = frame.sort_values(["symbol", "date"])
        if lookback_days > 0:
            frame["date"] = pd.to_datetime(frame["date"])
            cutoff = frame["date"].max() - pd.Timedelta(days=lookback_days * 2)
            frame = frame[frame["date"] >= cutoff]
        return frame.reset_index(drop=True)

    def get_latest_prices(self, symbols: list[str] | None = None) -> pd.DataFrame:
        subq = select(Price.symbol, func.max(Price.date).label("max_date")).group_by(Price.symbol)
        if symbols:
            subq = subq.where(Price.symbol.in_(symbols))
        subq = subq.subquery()
        stmt = (
            select(Price)
            .join(subq, (Price.symbol == subq.c.symbol) & (Price.date == subq.c.max_date))
        )
        rows = self.session.scalars(stmt).all()
        return pd.DataFrame(
            [{"symbol": row.symbol, "date": row.date, "close": float(row.close or 0), "volume": float(row.volume or 0)} for row in rows]
        )

    def get_latest_price_date(self) -> date | None:
        return self.session.scalar(select(func.max(Price.date)))

    def get_latest_price_dates(self, symbols: list[str]) -> dict[str, date]:
        if not symbols:
            return {}

        rows = self.session.execute(
            select(Price.symbol, func.max(Price.date))
            .where(Price.symbol.in_(symbols))
            .group_by(Price.symbol)
        ).all()
        return {
            symbol: latest_date
            for symbol, latest_date in rows
            if symbol is not None and latest_date is not None
        }

    def get_symbols(self, symbols: list[str] | None = None) -> list[str]:
        stmt = select(Price.symbol).distinct().order_by(Price.symbol.asc())
        if symbols:
            stmt = stmt.where(Price.symbol.in_(symbols))
        rows = self.session.execute(stmt).all()
        return [symbol for (symbol,) in rows]

    def get_total_count(self) -> int:
        return int(self.session.scalar(select(func.count()).select_from(Price)) or 0)

    def upsert_prices(self, rows: list[dict]) -> int:
        if not rows:
            return 0

        ensure_upsert_indexes(self.session)
        batch_size = 5_000
        for start in range(0, len(rows), batch_size):
            batch = rows[start:start + batch_size]
            self.session.execute(self._UPSERT_SQL, batch)
        self.session.flush()
        return len(rows)
