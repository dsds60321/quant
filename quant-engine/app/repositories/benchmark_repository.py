from __future__ import annotations

from datetime import date
from decimal import Decimal

import pandas as pd
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.database import ensure_upsert_indexes
from app.models import BenchmarkData


class BenchmarkRepository:
    _UPSERT_SQL = text(
        """
        INSERT INTO benchmark_data (symbol, date, price, created_at, updated_at)
        VALUES (:symbol, :date, :price, NOW(), NOW())
        ON CONFLICT (symbol, date)
        DO UPDATE SET
            price = EXCLUDED.price,
            updated_at = NOW()
        """
    )

    def __init__(self, session: Session) -> None:
        self.session = session

    def get_series(self, symbol: str, start_date: date, end_date: date) -> pd.Series:
        rows = self.session.scalars(
            select(BenchmarkData)
            .where(BenchmarkData.symbol == symbol, BenchmarkData.date >= start_date, BenchmarkData.date <= end_date)
            .order_by(BenchmarkData.date)
        ).all()
        if not rows:
            return pd.Series(dtype=float)
        return pd.Series([float(row.price) for row in rows], index=pd.to_datetime([row.date for row in rows]), name=symbol)

    def get_latest_date(self) -> date | None:
        return self.session.scalar(select(func.max(BenchmarkData.date)))

    def get_latest_dates(self, symbols: list[str]) -> dict[str, date]:
        if not symbols:
            return {}

        rows = self.session.execute(
            select(BenchmarkData.symbol, func.max(BenchmarkData.date))
            .where(BenchmarkData.symbol.in_(symbols))
            .group_by(BenchmarkData.symbol)
        ).all()
        return {
            symbol: latest_date
            for symbol, latest_date in rows
            if symbol is not None and latest_date is not None
        }

    def get_total_count(self) -> int:
        return int(self.session.scalar(select(func.count()).select_from(BenchmarkData)) or 0)

    def get_symbols(self) -> list[str]:
        rows = self.session.execute(
            select(BenchmarkData.symbol).distinct().order_by(BenchmarkData.symbol.asc())
        ).all()
        return [symbol for (symbol,) in rows]

    def upsert_rows(self, rows: list[dict]) -> int:
        if not rows:
            return 0

        ensure_upsert_indexes(self.session)
        batch_size = 5_000
        for start in range(0, len(rows), batch_size):
            batch = rows[start:start + batch_size]
            self.session.execute(self._UPSERT_SQL, batch)
        self.session.flush()
        return len(rows)
