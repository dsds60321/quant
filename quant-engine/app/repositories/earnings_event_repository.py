from __future__ import annotations

from datetime import date, timedelta

import numpy as np
import pandas as pd
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.database import ensure_upsert_indexes
from app.models import EarningsEvent


class EarningsEventRepository:
    _UPSERT_SQL = text(
        """
        INSERT INTO earnings_events (
            symbol, earnings_date, eps_estimate, reported_eps, surprise_percent, source, created_at, updated_at
        )
        VALUES (
            :symbol, :earnings_date, :eps_estimate, :reported_eps, :surprise_percent, :source, NOW(), NOW()
        )
        ON CONFLICT (symbol, earnings_date)
        DO UPDATE SET
            eps_estimate = EXCLUDED.eps_estimate,
            reported_eps = EXCLUDED.reported_eps,
            surprise_percent = EXCLUDED.surprise_percent,
            source = EXCLUDED.source,
            updated_at = NOW()
        """
    )

    def __init__(self, session: Session) -> None:
        self.session = session

    def get_recent_surprise_scores(
        self,
        end_date: date,
        lookback_days: int = 370,
        symbols: list[str] | None = None,
    ) -> pd.DataFrame:
        ensure_upsert_indexes(self.session)
        start_date = end_date - timedelta(days=lookback_days)
        stmt = select(EarningsEvent).where(
            EarningsEvent.earnings_date >= start_date,
            EarningsEvent.earnings_date <= end_date,
        )
        if symbols:
            stmt = stmt.where(EarningsEvent.symbol.in_(symbols))
        rows = self.session.scalars(stmt).all()
        if not rows:
            return pd.DataFrame(columns=["symbol", "earnings_surprise_score", "earnings_event_count"])

        frame = pd.DataFrame(
            [
                {
                    "symbol": row.symbol,
                    "earnings_date": row.earnings_date,
                    "eps_estimate": float(row.eps_estimate) if row.eps_estimate is not None else None,
                    "reported_eps": float(row.reported_eps) if row.reported_eps is not None else None,
                    "surprise_percent": float(row.surprise_percent) if row.surprise_percent is not None else None,
                }
                for row in rows
            ]
        )
        frame["earnings_date"] = pd.to_datetime(frame["earnings_date"])
        frame["surprise_raw"] = pd.to_numeric(frame["surprise_percent"], errors="coerce") / 100.0

        missing_mask = frame["surprise_raw"].isna() & frame["eps_estimate"].notna() & frame["reported_eps"].notna()
        safe_estimate = frame.loc[missing_mask, "eps_estimate"].replace(0, np.nan)
        frame.loc[missing_mask, "surprise_raw"] = (
            (frame.loc[missing_mask, "reported_eps"] - frame.loc[missing_mask, "eps_estimate"]) / safe_estimate.abs()
        )

        frame = frame.dropna(subset=["surprise_raw"])
        if frame.empty:
            return pd.DataFrame(columns=["symbol", "earnings_surprise_score", "earnings_event_count"])

        frame["surprise_raw"] = frame["surprise_raw"].clip(-1.0, 1.0)
        frame["days_since"] = (pd.Timestamp(end_date) - frame["earnings_date"]).dt.days.clip(lower=0)
        frame["decay"] = np.exp(-frame["days_since"] / 90.0)
        frame["weighted_surprise"] = frame["surprise_raw"] * frame["decay"]

        grouped = frame.groupby("symbol", as_index=False).agg(
            weighted_surprise_sum=("weighted_surprise", "sum"),
            decay_sum=("decay", "sum"),
            earnings_event_count=("symbol", "size"),
        )
        grouped["earnings_surprise_score"] = grouped["weighted_surprise_sum"] / grouped["decay_sum"].replace(0, np.nan)
        return grouped[["symbol", "earnings_surprise_score", "earnings_event_count"]]

    def get_latest_event_date(self) -> date | None:
        ensure_upsert_indexes(self.session)
        return self.session.scalar(select(func.max(EarningsEvent.earnings_date)))

    def get_total_count(self) -> int:
        ensure_upsert_indexes(self.session)
        return int(self.session.scalar(select(func.count()).select_from(EarningsEvent)) or 0)

    def upsert_events(self, rows: list[dict]) -> int:
        if not rows:
            return 0

        ensure_upsert_indexes(self.session)
        self.session.execute(self._UPSERT_SQL, rows)
        self.session.flush()
        return len(rows)
