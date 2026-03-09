from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import delete, select
from sqlalchemy.orm import Session, joinedload

from app.models import News, NewsSymbol


class NewsRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def upsert_article(
        self,
        title: str,
        content: str,
        source: str,
        url: str,
        published_at: datetime,
        sentiment_score: float | None,
    ) -> News:
        existing = self.session.scalar(select(News).where(News.url == url))
        if existing is None:
            existing = News(title=title, source=source, url=url, published_at=published_at)
            self.session.add(existing)
            self.session.flush()
        existing.title = title
        existing.content = content
        existing.source = source
        existing.published_at = published_at
        existing.sentiment_score = Decimal(str(sentiment_score)) if sentiment_score is not None else None
        self.session.flush()
        return existing

    def replace_symbols(self, news_id: int, symbol_scores: list[tuple[str, float]]) -> None:
        self.session.execute(delete(NewsSymbol).where(NewsSymbol.news_id == news_id))
        for symbol, relevance_score in symbol_scores:
            self.session.add(
                NewsSymbol(
                    news_id=news_id,
                    symbol=symbol,
                    relevance_score=Decimal(str(relevance_score)),
                )
            )
        self.session.flush()

    def get_articles(self, symbol: str | None = None, limit: int = 20) -> list[News]:
        stmt = (
            select(News)
            .options(joinedload(News.symbols))
            .order_by(News.published_at.desc())
            .limit(limit)
        )
        if symbol:
            stmt = (
                select(News)
                .join(NewsSymbol, NewsSymbol.news_id == News.id)
                .options(joinedload(News.symbols))
                .where(NewsSymbol.symbol == symbol)
                .order_by(News.published_at.desc())
                .limit(limit)
            )
        return self.session.scalars(stmt).unique().all()

    def get_recent_articles(self, symbol: str, limit: int, lookback_days: int) -> list[News]:
        since = datetime.now(timezone.utc) - timedelta(days=lookback_days)
        stmt = (
            select(News)
            .join(NewsSymbol, NewsSymbol.news_id == News.id)
            .options(joinedload(News.symbols))
            .where(NewsSymbol.symbol == symbol, News.published_at >= since)
            .order_by(News.published_at.desc())
            .limit(limit)
        )
        return self.session.scalars(stmt).unique().all()
