from __future__ import annotations

from datetime import date
from hashlib import sha1

import pandas as pd
import yfinance as yf
from sqlalchemy.orm import Session

from app.repositories.earnings_event_repository import EarningsEventRepository
from app.repositories.insider_trade_repository import InsiderTradeRepository


class StructuredEventService:
    earnings_limit = 32

    def __init__(self, session: Session) -> None:
        self.session = session
        self.earnings_repository = EarningsEventRepository(session)
        self.insider_repository = InsiderTradeRepository(session)

    @staticmethod
    def _safe_float(value) -> float | None:
        if value is None:
            return None
        try:
            if pd.isna(value):
                return None
        except TypeError:
            pass
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _to_date(value) -> date | None:
        if value is None:
            return None
        try:
            timestamp = pd.Timestamp(value)
        except (TypeError, ValueError):
            return None
        if pd.isna(timestamp):
            return None
        return timestamp.date()

    @staticmethod
    def _classify_direction(transaction_type: str | None, transaction_text: str | None) -> int:
        text = f"{transaction_type or ''} {transaction_text or ''}".lower()
        positive_tokens = ("purchase", "buy", "acquire", "acquired", "exercise", "grant")
        negative_tokens = ("sale", "sell", "sold", "dispose", "disposed", "sell to cover")
        if any(token in text for token in negative_tokens):
            return -1
        if any(token in text for token in positive_tokens):
            return 1
        return 0

    def build_earnings_event_rows(self, symbol: str, ticker: yf.Ticker) -> list[dict]:
        try:
            frame = ticker.get_earnings_dates(limit=self.earnings_limit)
        except Exception:
            return []
        if frame is None or frame.empty:
            return []

        normalized = frame.reset_index()
        if "Earnings Date" not in normalized.columns:
            first_column = normalized.columns[0]
            normalized = normalized.rename(columns={first_column: "Earnings Date"})

        rows: list[dict] = []
        for record in normalized.to_dict(orient="records"):
            earnings_date = self._to_date(record.get("Earnings Date"))
            if earnings_date is None:
                continue
            rows.append(
                {
                    "symbol": symbol,
                    "earnings_date": earnings_date,
                    "eps_estimate": self._safe_float(record.get("EPS Estimate")),
                    "reported_eps": self._safe_float(record.get("Reported EPS")),
                    "surprise_percent": self._safe_float(record.get("Surprise(%)")),
                    "source": "yfinance",
                }
            )
        return rows

    def build_insider_trade_rows(self, symbol: str, ticker: yf.Ticker) -> list[dict]:
        try:
            frame = ticker.get_insider_transactions()
        except Exception:
            return []
        if frame is None or frame.empty:
            return []

        rows: list[dict] = []
        for record in frame.to_dict(orient="records"):
            transaction_date = self._to_date(record.get("Start Date"))
            if transaction_date is None:
                continue
            insider = str(record.get("Insider") or "").strip() or None
            transaction_type = str(record.get("Transaction") or "").strip() or None
            transaction_text = str(record.get("Text") or "").strip() or None
            shares = self._safe_float(record.get("Shares"))
            value = self._safe_float(record.get("Value"))
            ownership = str(record.get("Ownership") or "").strip() or None
            trade_key_source = "|".join(
                [
                    symbol,
                    transaction_date.isoformat(),
                    insider or "",
                    transaction_type or "",
                    transaction_text or "",
                    f"{shares or 0:.6f}",
                    f"{value or 0:.6f}",
                ]
            )
            rows.append(
                {
                    "trade_key": sha1(trade_key_source.encode("utf-8")).hexdigest(),
                    "symbol": symbol,
                    "transaction_date": transaction_date,
                    "insider": insider,
                    "position": str(record.get("Position") or "").strip() or None,
                    "transaction_type": transaction_type,
                    "transaction_text": transaction_text,
                    "shares": shares,
                    "value": value,
                    "ownership": ownership,
                    "direction": self._classify_direction(transaction_type, transaction_text),
                    "source": "yfinance",
                }
            )
        return rows

    def sync_symbol(self, symbol: str, ticker: yf.Ticker | None = None) -> dict[str, int]:
        ticker = ticker or yf.Ticker(symbol)
        earnings_rows = self.build_earnings_event_rows(symbol, ticker)
        insider_rows = self.build_insider_trade_rows(symbol, ticker)
        return {
            "earnings_events_updated": self.earnings_repository.upsert_events(earnings_rows),
            "insider_trades_updated": self.insider_repository.upsert_trades(insider_rows),
        }
