from __future__ import annotations

import re
from collections.abc import Iterable

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.models import Stock
from app.schemas.news import NewsEntity


class EntityService:
    def __init__(self, session: Session) -> None:
        self.session = session

    def extract(self, text: str, primary_symbol: str | None = None) -> list[NewsEntity]:
        normalized = text.lower()
        entities: dict[str, float] = {}

        if primary_symbol:
            primary = primary_symbol.upper()
            self._ensure_stock(primary)
            entities[primary] = 1.0

        ticker_candidates = {match.upper() for match in re.findall(r"\b[A-Z]{1,5}\b", text)}
        for stock in self._find_matching_stocks(normalized, ticker_candidates):
            current = entities.get(stock.symbol.upper(), 0.0)
            entities[stock.symbol.upper()] = max(current, self._relevance_from_name(normalized, stock.name))

        return [
            NewsEntity(symbol=symbol, relevance_score=round(score, 4))
            for symbol, score in sorted(entities.items(), key=lambda item: item[1], reverse=True)
        ]

    def _find_matching_stocks(self, normalized_text: str, ticker_candidates: set[str]) -> Iterable[Stock]:
        stocks = self.session.scalars(select(Stock)).all()
        for stock in stocks:
            symbol = stock.symbol.upper()
            name = stock.name.lower()
            if symbol in ticker_candidates or (name and name in normalized_text):
                yield stock

    def _stock_exists(self, symbol: str) -> bool:
        return self.session.scalar(
            select(Stock.id).where(Stock.symbol == symbol).limit(1)
        ) is not None

    def _ensure_stock(self, symbol: str) -> None:
        self.session.execute(
            text(
                """
                INSERT INTO stocks (symbol, name, exchange, currency, created_at, updated_at)
                VALUES (:symbol, :name, 'UNKNOWN', 'USD', NOW(), NOW())
                ON CONFLICT (symbol) DO NOTHING
                """
            ),
            {"symbol": symbol, "name": symbol},
        )

    @staticmethod
    def _relevance_from_name(normalized_text: str, name: str) -> float:
        name_lower = name.lower()
        if not name_lower:
            return 0.5
        if name_lower in normalized_text:
            return 0.9
        token_hits = sum(token in normalized_text for token in name_lower.split())
        return min(0.85, 0.55 + token_hits * 0.1)
