from __future__ import annotations

import pandas as pd
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.models import Stock


class StockRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def upsert_rows(self, rows: list[dict]) -> int:
        if not rows:
            return 0

        self.session.execute(
            text(
                """
                INSERT INTO stocks (symbol, name, exchange, sector, industry, currency, market_cap, created_at, updated_at)
                VALUES (:symbol, :name, :exchange, :sector, :industry, :currency, :market_cap, NOW(), NOW())
                ON CONFLICT (symbol)
                DO UPDATE SET
                    name = EXCLUDED.name,
                    exchange = EXCLUDED.exchange,
                    sector = EXCLUDED.sector,
                    industry = EXCLUDED.industry,
                    currency = EXCLUDED.currency,
                    market_cap = EXCLUDED.market_cap,
                    updated_at = NOW()
                """
            ),
            rows,
        )
        self.session.flush()
        return len(rows)

    def get_metadata_frame(self, symbols: list[str] | None = None) -> pd.DataFrame:
        stmt = select(Stock)
        if symbols:
            stmt = stmt.where(Stock.symbol.in_(symbols))
        rows = self.session.scalars(stmt).all()
        return pd.DataFrame(
            [
                {
                    "symbol": row.symbol,
                    "name": row.name,
                    "exchange": row.exchange,
                    "sector": row.sector,
                    "industry": row.industry,
                    "currency": row.currency,
                    "market_cap": float(row.market_cap) if row.market_cap is not None else None,
                }
                for row in rows
            ]
        )

    def get_symbols(self, symbols: list[str] | None = None) -> list[str]:
        stmt = select(Stock.symbol).order_by(Stock.symbol.asc())
        if symbols:
            stmt = stmt.where(Stock.symbol.in_(symbols))
        rows = self.session.execute(stmt).all()
        return [symbol for (symbol,) in rows]
