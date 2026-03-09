from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pandas as pd
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import News, NewsSymbol


class NewsSignalRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def get_recent_sentiment_scores(self, end_date, lookback_days: int = 30, symbols: list[str] | None = None) -> pd.DataFrame:
        end_dt = datetime.combine(end_date + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc)
        start_dt = end_dt - timedelta(days=lookback_days)
        stmt = (
            select(
                NewsSymbol.symbol.label("symbol"),
                func.avg(func.coalesce(News.sentiment_score, 0)).label("news_score"),
            )
            .join(News, News.id == NewsSymbol.news_id)
            .where(News.published_at >= start_dt, News.published_at <= end_dt)
            .group_by(NewsSymbol.symbol)
        )
        if symbols:
            stmt = stmt.where(NewsSymbol.symbol.in_(symbols))
        rows = self.session.execute(stmt).all()
        return pd.DataFrame(
            [{"symbol": row.symbol, "news_score": float(row.news_score) if row.news_score is not None else None} for row in rows]
        )
