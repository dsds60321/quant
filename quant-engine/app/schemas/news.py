from __future__ import annotations

from datetime import datetime

from app.schemas.common import CamelModel


class NewsSentimentQuery(CamelModel):
    symbol: str | None = None
    keyword: str | None = None
    limit: int = 20


class NewsImpactQuery(CamelModel):
    symbol: str
    limit: int = 100
    lookback_days: int = 7


class NewsEntity(CamelModel):
    symbol: str
    relevance_score: float


class NewsArticle(CamelModel):
    title: str
    source: str
    url: str
    published_at: datetime
    sentiment_score: float | None = None
    symbols: list[str]
    content: str | None = None


class NewsSentimentResponse(CamelModel):
    query: str
    average_sentiment: float | None = None
    article_count: int
    articles: list[NewsArticle]


class NewsImpactNode(CamelModel):
    id: int
    title: str
    summary: str | None = None
    translated_title: str | None = None
    translated_summary: str | None = None
    sentiment: str
    impact: float
    distance: float
    color: str
    source: str
    url: str
    published_at: datetime


class NewsImpactLink(CamelModel):
    source: str
    target: str
    distance: float


class NewsImpactResponse(CamelModel):
    center: str
    sentiment_score: float
    generated_at: datetime
    nodes: list[NewsImpactNode]
    links: list[NewsImpactLink]
