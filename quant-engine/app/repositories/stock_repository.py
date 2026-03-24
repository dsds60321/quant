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
                    name = COALESCE(NULLIF(EXCLUDED.name, ''), stocks.name),
                    exchange = COALESCE(NULLIF(EXCLUDED.exchange, ''), stocks.exchange),
                    sector = COALESCE(NULLIF(EXCLUDED.sector, ''), stocks.sector),
                    industry = COALESCE(NULLIF(EXCLUDED.industry, ''), stocks.industry),
                    currency = COALESCE(NULLIF(EXCLUDED.currency, ''), stocks.currency),
                    market_cap = COALESCE(EXCLUDED.market_cap, stocks.market_cap),
                    updated_at = NOW()
                """
            ),
            rows,
        )
        self.session.flush()
        return len(rows)

    def get_snapshot_by_symbol(self, symbol: str) -> dict | None:
        stmt = (
            select(Stock.name, Stock.exchange, Stock.sector, Stock.industry, Stock.currency, Stock.market_cap)
            .where(Stock.symbol == symbol)
            .limit(1)
        )
        row = self.session.execute(stmt).first()
        if row is None:
            return None
        name, exchange, sector, industry, currency, market_cap = row
        return {
            "name": name,
            "exchange": exchange,
            "sector": sector,
            "industry": industry,
            "currency": currency,
            "market_cap": float(market_cap) if market_cap is not None else None,
        }

    def get_name_by_symbol(self, symbol: str) -> str | None:
        stmt = select(Stock.name).where(Stock.symbol == symbol).limit(1)
        name = self.session.execute(stmt).scalar_one_or_none()
        if name is None:
            return None
        return str(name)

    def get_metadata_frame(self, symbols: list[str] | None = None) -> pd.DataFrame:
        stmt = select(Stock.symbol, Stock.name, Stock.exchange, Stock.sector, Stock.industry, Stock.currency, Stock.market_cap)
        if symbols:
            stmt = stmt.where(Stock.symbol.in_(symbols))
        rows = self.session.execute(stmt).all()
        return pd.DataFrame(
            [
                {
                    "symbol": symbol,
                    "name": name,
                    "exchange": exchange,
                    "sector": sector,
                    "industry": industry,
                    "currency": currency,
                    "market_cap": float(market_cap) if market_cap is not None else None,
                }
                for symbol, name, exchange, sector, industry, currency, market_cap in rows
            ]
        )

    def get_symbols(self, symbols: list[str] | None = None) -> list[str]:
        stmt = select(Stock.symbol).order_by(Stock.symbol.asc())
        if symbols:
            stmt = stmt.where(Stock.symbol.in_(symbols))
        rows = self.session.execute(stmt).all()
        return [symbol for (symbol,) in rows]
