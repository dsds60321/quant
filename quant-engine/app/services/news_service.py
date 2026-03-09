from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.exceptions import ExternalDependencyError
from app.exceptions import ValidationError
from app.repositories.impact_repository import ImpactRepository
from app.repositories.news_repository import NewsRepository
from app.schemas.news import NewsArticle, NewsImpactLink, NewsImpactNode, NewsImpactQuery, NewsImpactResponse, NewsSentimentQuery, NewsSentimentResponse
from app.services.entity_service import EntityService
from app.services.impact_service import ImpactService
from app.services.news_client import NewsClient
from app.services.sentiment_service import SentimentService
from app.services.translation_service import TranslationService


class NewsService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.repository = NewsRepository(session)
        self.impact_repository = ImpactRepository(session)
        self.client = NewsClient()
        self.sentiment_service = SentimentService()
        self.entity_service = EntityService(session)
        self.impact_service = ImpactService()
        self.translation_service = TranslationService()

    def get_sentiment(self, query: NewsSentimentQuery) -> NewsSentimentResponse:
        search_query = query.symbol or query.keyword
        if not search_query:
            raise ValidationError("symbol or keyword is required")
        self._ingest_symbol_news(search_query, query.limit)
        try:
            articles = self.repository.get_articles(symbol=query.symbol, limit=query.limit)
        except SQLAlchemyError as exc:
            raise ExternalDependencyError("뉴스 데이터를 조회할 수 없습니다. 데이터베이스 연결을 확인하세요.") from exc
        payload = [self._to_article(item) for item in articles]
        scores = [article.sentiment_score for article in payload if article.sentiment_score is not None]
        return NewsSentimentResponse(
            query=search_query,
            average_sentiment=float(sum(scores) / len(scores)) if scores else None,
            article_count=len(payload),
            articles=payload,
        )

    def get_impact_graph(self, query: NewsImpactQuery) -> NewsImpactResponse:
        if not query.symbol:
            raise ValidationError("symbol is required")

        symbol = query.symbol.upper()
        self._ingest_symbol_news(symbol, query.limit)
        try:
            self.session.commit()
            impacts = self.impact_repository.get_recent_impacts(symbol=symbol, limit=query.limit, lookback_days=query.lookback_days)
        except SQLAlchemyError as exc:
            raise ExternalDependencyError("뉴스 영향 데이터를 조회할 수 없습니다. 데이터베이스 연결을 확인하세요.") from exc

        nodes: list[NewsImpactNode] = []
        links: list[NewsImpactLink] = []
        sentiment_values: list[float] = []

        for index, impact in enumerate(impacts, start=1):
            news = impact.news
            if news is None:
                continue
            sentiment = self.sentiment_service.analyze(f"{news.title} {news.content or ''}")
            sentiment_values.append(sentiment.score)
            nodes.append(
                NewsImpactNode(
                    id=index,
                    title=news.title,
                    summary=(news.content or news.title)[:180],
                    translated_title=self.translation_service.translate(news.title),
                    translated_summary=self.translation_service.translate((news.content or news.title)[:180]),
                    sentiment=sentiment.label,
                    impact=float(impact.impact_score),
                    distance=float(impact.distance),
                    color=impact.node_color,
                    source=news.source,
                    url=news.url,
                    published_at=news.published_at,
                )
            )
            links.append(
                NewsImpactLink(
                    source=symbol,
                    target=str(index),
                    distance=float(impact.distance),
                )
            )

        average_sentiment = 0.0 if not sentiment_values else round(sum(sentiment_values) / len(sentiment_values), 4)
        return NewsImpactResponse(
            center=symbol,
            sentiment_score=average_sentiment,
            generated_at=datetime.now(timezone.utc),
            nodes=nodes,
            links=links,
        )

    def _ingest_symbol_news(self, symbol: str, limit: int) -> None:
        try:
            fetched = self.client.fetch(symbol, min(limit, 100))
        except ExternalDependencyError as exc:
            try:
                cached_articles = self.repository.get_recent_articles(symbol=symbol, limit=limit, lookback_days=7)
            except SQLAlchemyError as db_exc:
                raise ExternalDependencyError(
                    "뉴스 API 키가 없고 캐시 데이터도 조회할 수 없습니다. NEWS_API_KEY와 데이터베이스 연결을 확인하세요."
                ) from db_exc
            if cached_articles:
                return
            raise exc
        impact_rows: list[dict] = []

        for article in fetched:
            content = " ".join(filter(None, [article["title"], article.get("description", ""), article.get("content", "")])).strip()
            sentiment = self.sentiment_service.analyze(content)
            try:
                news = self.repository.upsert_article(
                    title=article["title"],
                    content=content,
                    source=article["source"],
                    url=article["url"],
                    published_at=article["published_at"],
                    sentiment_score=sentiment.score,
                )
                entities = self.entity_service.extract(content, primary_symbol=symbol)
                self.repository.replace_symbols(news.id, [(entity.symbol, entity.relevance_score) for entity in entities])
            except SQLAlchemyError as exc:
                raise ExternalDependencyError("뉴스 데이터를 저장할 수 없습니다. 데이터베이스 연결을 확인하세요.") from exc

            for entity in entities:
                if entity.symbol != symbol:
                    continue
                impact = self.impact_service.calculate(
                    sentiment_score=sentiment.score,
                    relevance_score=entity.relevance_score,
                    source=article["source"],
                    published_at=article["published_at"],
                )
                impact_rows.append(
                    {
                        "news_id": news.id,
                        "impact_score": impact.impact_score,
                        "distance": impact.distance,
                        "node_color": impact.color,
                    }
                )

        try:
            self.impact_repository.replace_for_symbol(symbol, impact_rows)
        except SQLAlchemyError as exc:
            raise ExternalDependencyError("뉴스 영향 데이터를 저장할 수 없습니다. 데이터베이스 연결을 확인하세요.") from exc

    @staticmethod
    def _to_article(item) -> NewsArticle:
        return NewsArticle(
            title=item.title,
            source=item.source,
            url=item.url,
            published_at=item.published_at,
            sentiment_score=float(item.sentiment_score) if item.sentiment_score is not None else None,
            symbols=[symbol.symbol for symbol in item.symbols],
            content=item.content,
        )
