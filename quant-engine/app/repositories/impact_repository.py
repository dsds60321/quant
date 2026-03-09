from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import delete, select
from sqlalchemy.orm import Session, joinedload

from app.models import News, NewsImpact


class ImpactRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def replace_for_symbol(self, symbol: str, items: list[dict]) -> None:
        self.session.execute(delete(NewsImpact).where(NewsImpact.symbol == symbol))
        for item in items:
            self.session.add(
                NewsImpact(
                    symbol=symbol,
                    news_id=item["news_id"],
                    impact_score=Decimal(str(item["impact_score"])),
                    distance=Decimal(str(item["distance"])),
                    node_color=item["node_color"],
                )
            )
        self.session.flush()

    def get_recent_impacts(self, symbol: str, limit: int, lookback_days: int) -> list[NewsImpact]:
        since = datetime.now(timezone.utc) - timedelta(days=lookback_days)
        stmt = (
            select(NewsImpact)
            .join(News, News.id == NewsImpact.news_id)
            .options(joinedload(NewsImpact.news))
            .where(NewsImpact.symbol == symbol, News.published_at >= since)
            .order_by(NewsImpact.impact_score.desc(), News.published_at.desc())
            .limit(limit)
        )
        return self.session.scalars(stmt).unique().all()
