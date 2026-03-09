from sqlalchemy.orm import Session

from app.schemas.news import NewsSentimentQuery
from app.services.news_service import NewsService


class NewsJob:
    def __init__(self, session: Session) -> None:
        self.service = NewsService(session)

    def run(self, symbol: str | None = None, keyword: str | None = None, limit: int = 20):
        return self.service.get_sentiment(NewsSentimentQuery(symbol=symbol, keyword=keyword, limit=limit))
