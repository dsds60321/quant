from __future__ import annotations

import logging
from datetime import date

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

    def get_benchmark_series(self, symbol: str, start_date: date, end_date: date) -> pd.Series:
        series = self.repository.get_series(symbol, start_date, end_date)
        if not series.empty:
            return series.sort_index()
        logger.info("benchmark series missing in db, fallback to yfinance", extra={"symbol": symbol})
        history = yf.download(symbol, start=start_date.isoformat(), end=(end_date + pd.Timedelta(days=1)).date().isoformat(), progress=False, auto_adjust=True)
        if history.empty:
            return pd.Series(dtype=float)
        history.index = pd.to_datetime(history.index).tz_localize(None)
        rows = [{"symbol": symbol, "date": idx.date(), "price": float(value)} for idx, value in history["Close"].items()]
        self.repository.upsert_rows(rows)
        self.session.commit()
        return pd.Series(history["Close"].astype(float), index=history.index, name=symbol)

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
