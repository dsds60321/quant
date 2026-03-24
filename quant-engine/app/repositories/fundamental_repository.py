from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

import pandas as pd
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.database import ensure_upsert_indexes
from app.models import Fundamental


class FundamentalRepository:
    _FRAME_COLUMNS = [
        "symbol",
        "date",
        "per",
        "pbr",
        "roe",
        "eps",
        "dividend_yield",
        "market_cap",
        "revenue",
        "net_income",
    ]
    _UPSERT_SQL = text(
        """
        INSERT INTO fundamentals (
            symbol, date, per, pbr, roe, eps, dividend_yield, market_cap, revenue, net_income, created_at, updated_at
        )
        VALUES (
            :symbol, :date, :per, :pbr, :roe, :eps, :dividend_yield, :market_cap, :revenue, :net_income, NOW(), NOW()
        )
        ON CONFLICT (symbol, date)
        DO UPDATE SET
            per = EXCLUDED.per,
            pbr = EXCLUDED.pbr,
            roe = EXCLUDED.roe,
            eps = EXCLUDED.eps,
            dividend_yield = EXCLUDED.dividend_yield,
            market_cap = EXCLUDED.market_cap,
            revenue = EXCLUDED.revenue,
            net_income = EXCLUDED.net_income,
            updated_at = NOW()
        """
    )

    def __init__(self, session: Session) -> None:
        self.session = session

    def get_latest_fundamentals(self, end_date: date, symbols: list[str] | None = None) -> pd.DataFrame:
        subq = select(Fundamental.symbol, func.max(Fundamental.date).label("max_date")).where(Fundamental.date <= end_date)
        if symbols:
            subq = subq.where(Fundamental.symbol.in_(symbols))
        subq = subq.group_by(Fundamental.symbol).subquery()
        stmt = select(Fundamental).join(
            subq,
            (Fundamental.symbol == subq.c.symbol) & (Fundamental.date == subq.c.max_date),
        )
        rows = self.session.scalars(stmt).all()
        if not rows:
            return pd.DataFrame(columns=self._FRAME_COLUMNS)
        return pd.DataFrame(
            [
                {
                    "symbol": row.symbol,
                    "date": row.date,
                    "per": float(row.per) if row.per is not None else None,
                    "pbr": float(row.pbr) if row.pbr is not None else None,
                    "roe": float(row.roe) if row.roe is not None else None,
                    "eps": float(row.eps) if row.eps is not None else None,
                    "dividend_yield": float(row.dividend_yield) if row.dividend_yield is not None else None,
                    "market_cap": float(row.market_cap) if row.market_cap is not None else None,
                    "revenue": float(row.revenue) if row.revenue is not None else None,
                    "net_income": float(row.net_income) if row.net_income is not None else None,
                }
                for row in rows
            ]
        )

    def get_fundamental_history(
        self,
        end_date: date,
        symbols: list[str] | None = None,
        lookback_days: int | None = None,
        start_date: date | None = None,
    ) -> pd.DataFrame:
        stmt = select(
            Fundamental.symbol,
            Fundamental.date,
            Fundamental.per,
            Fundamental.pbr,
            Fundamental.roe,
            Fundamental.eps,
            Fundamental.dividend_yield,
            Fundamental.market_cap,
            Fundamental.revenue,
            Fundamental.net_income,
        ).where(Fundamental.date <= end_date)
        if start_date is not None:
            stmt = stmt.where(Fundamental.date >= start_date)
        elif lookback_days is not None and lookback_days > 0:
            stmt = stmt.where(Fundamental.date >= (end_date - timedelta(days=lookback_days)))
        if symbols:
            stmt = stmt.where(Fundamental.symbol.in_(symbols))
        rows = self.session.execute(stmt.order_by(Fundamental.symbol.asc(), Fundamental.date.asc())).all()
        if not rows:
            return pd.DataFrame(columns=self._FRAME_COLUMNS)
        return pd.DataFrame(
            [
                {
                    "symbol": symbol,
                    "date": fundamental_date,
                    "per": float(per) if per is not None else None,
                    "pbr": float(pbr) if pbr is not None else None,
                    "roe": float(roe) if roe is not None else None,
                    "eps": float(eps) if eps is not None else None,
                    "dividend_yield": float(dividend_yield) if dividend_yield is not None else None,
                    "market_cap": float(market_cap) if market_cap is not None else None,
                    "revenue": float(revenue) if revenue is not None else None,
                    "net_income": float(net_income) if net_income is not None else None,
                }
                for symbol, fundamental_date, per, pbr, roe, eps, dividend_yield, market_cap, revenue, net_income in rows
            ]
        )

    def get_latest_fundamental_date(self) -> date | None:
        return self.session.scalar(select(func.max(Fundamental.date)))

    def get_earliest_fundamental_date(self) -> date | None:
        return self.session.scalar(select(func.min(Fundamental.date)))

    def get_total_count(self) -> int:
        return int(self.session.scalar(select(func.count()).select_from(Fundamental)) or 0)

    def upsert_fundamentals(self, rows: list[dict]) -> int:
        if not rows:
            return 0

        ensure_upsert_indexes(self.session)
        batch_size = 5_000
        for start in range(0, len(rows), batch_size):
            batch = rows[start:start + batch_size]
            self.session.execute(self._UPSERT_SQL, batch)
        self.session.flush()
        return len(rows)
