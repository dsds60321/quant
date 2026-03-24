from __future__ import annotations

import logging
from datetime import date, timedelta

import numpy as np
import pandas as pd
import yfinance as yf
from sqlalchemy.orm import Session

from app.repositories.benchmark_repository import BenchmarkRepository

logger = logging.getLogger(__name__)


class BenchmarkService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.repository = BenchmarkRepository(session)

    def _empty_series(self, symbol: str) -> pd.Series:
        return pd.Series(dtype=float, name=symbol)

    def _normalize_downloaded_close(self, history: pd.DataFrame, symbol: str) -> pd.Series:
        if history.empty:
            return self._empty_series(symbol)

        close = None
        if isinstance(history.columns, pd.MultiIndex):
            if ("Close", symbol) in history.columns:
                close = history[("Close", symbol)]
            elif (symbol, "Close") in history.columns:
                close = history[(symbol, "Close")]
            else:
                close_columns = [column for column in history.columns if isinstance(column, tuple) and "Close" in column]
                if close_columns:
                    close = history[close_columns[0]]
        elif "Close" in history.columns:
            close = history["Close"]
        elif len(history.columns) == 1:
            close = history.iloc[:, 0]

        if close is None:
            return self._empty_series(symbol)
        if isinstance(close, pd.DataFrame):
            close = close.iloc[:, 0]

        series = pd.to_numeric(close, errors="coerce").dropna()
        if series.empty:
            return self._empty_series(symbol)

        index = pd.to_datetime(series.index)
        timezone = getattr(index, "tz", None)
        if timezone is not None:
            index = index.tz_convert(None)
        else:
            try:
                index = index.tz_localize(None)
            except (TypeError, AttributeError):
                pass
        series.index = index
        series.name = symbol
        return series.sort_index()

    def get_benchmark_series(self, symbol: str, start_date: date, end_date: date) -> pd.Series:
        series = self.repository.get_series(symbol, start_date, end_date)
        if not series.empty:
            return series.sort_index()
        logger.info("benchmark series missing in db, fallback to yfinance", extra={"symbol": symbol})
        try:
            history = yf.download(
                symbol,
                start=start_date.isoformat(),
                end=(end_date + timedelta(days=1)).isoformat(),
                progress=False,
                auto_adjust=True,
            )
        except Exception as exc:
            logger.warning(
                "benchmark yfinance fallback failed; continue without benchmark series",
                extra={"symbol": symbol, "error": str(exc)},
                exc_info=exc,
            )
            return self._empty_series(symbol)

        close_series = self._normalize_downloaded_close(history, symbol)
        if close_series.empty:
            logger.warning("benchmark download returned no usable close series", extra={"symbol": symbol})
            return close_series

        rows = [{"symbol": symbol, "date": idx.date(), "price": float(value)} for idx, value in close_series.items()]
        try:
            self.repository.upsert_rows(rows)
            self.session.commit()
        except Exception as exc:
            self.session.rollback()
            logger.warning(
                "benchmark cache upsert failed; continue with in-memory benchmark series",
                extra={"symbol": symbol, "error": str(exc)},
                exc_info=exc,
            )
        return close_series

    def compute_relative_metrics(self, portfolio_returns: pd.Series, benchmark_returns: pd.Series) -> dict[str, float | None]:
        aligned = pd.concat([portfolio_returns.rename("p"), benchmark_returns.rename("b")], axis=1).dropna()
        if aligned.empty:
            return {"alpha": None, "beta": None, "tracking_error": None, "information_ratio": None, "excess_return": None}
        cov = np.cov(aligned["p"], aligned["b"])
        beta = float(cov[0, 1] / cov[1, 1]) if cov[1, 1] != 0 else None
        alpha = float((aligned["p"].mean() - (beta or 0) * aligned["b"].mean()) * 252)
        diff = aligned["p"] - aligned["b"]
        tracking_error = float(diff.std(ddof=0) * np.sqrt(252)) if len(diff) > 1 else None
        diff_std = diff.std(ddof=0)
        information_ratio = float(diff.mean() / diff_std * np.sqrt(252)) if diff_std and not np.isnan(diff_std) else None
        excess_return = float((1 + aligned["p"]).prod() - (1 + aligned["b"]).prod())
        return {
            "alpha": alpha,
            "beta": beta,
            "tracking_error": tracking_error,
            "information_ratio": information_ratio,
            "excess_return": excess_return,
        }
