from __future__ import annotations

from datetime import datetime, timezone

import requests
from dateutil import parser

from app.config import get_settings
from app.exceptions import ExternalDependencyError


class NewsClient:
    def __init__(self) -> None:
        self.settings = get_settings()

    def fetch(self, query: str, page_size: int) -> list[dict]:
        if not self.settings.news_api_key:
            raise ExternalDependencyError("NEWS_API_KEY is not configured")
        response = requests.get(
            self.settings.news_api_base_url,
            params={"q": query, "pageSize": page_size, "language": "en", "sortBy": "publishedAt", "apiKey": self.settings.news_api_key},
            timeout=20,
        )
        if response.status_code >= 400:
            raise ExternalDependencyError(f"NewsAPI request failed: {response.text}")
        payload = response.json()
        articles = payload.get("articles", [])
        normalized = []
        for article in articles:
            normalized.append(
                {
                    "title": article.get("title") or "",
                    "source": (article.get("source") or {}).get("name") or "unknown",
                    "url": article.get("url") or "",
                    "published_at": parser.isoparse(article.get("publishedAt")).astimezone(timezone.utc),
                    "description": article.get("description") or "",
                    "content": article.get("content") or "",
                }
            )
        return normalized
