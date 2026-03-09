from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone


@dataclass(slots=True)
class ImpactResult:
    impact_score: float
    distance: float
    color: str
    sentiment: str


class ImpactService:
    SOURCE_WEIGHTS = {
        "bloomberg": 1.0,
        "reuters": 0.98,
        "wsj": 0.95,
        "financial times": 0.95,
        "cnbc": 0.9,
        "marketwatch": 0.88,
    }

    def calculate(
        self,
        sentiment_score: float,
        relevance_score: float,
        source: str,
        published_at: datetime,
        now: datetime | None = None,
    ) -> ImpactResult:
        reference_time = now or datetime.now(timezone.utc)
        sentiment_weight = 0.2 if sentiment_score == 0 else min(1.0, max(0.25, abs(sentiment_score)))
        keyword_relevance = min(1.0, max(0.2, relevance_score))
        source_weight = self._source_weight(source)
        recency_weight = self._recency_weight(published_at, reference_time)
        impact_score = max(0.05, sentiment_weight * keyword_relevance * source_weight * recency_weight)
        distance = round(max(80.0, min(320.0, 320.0 - impact_score * 220.0)), 2)
        color, sentiment = self._sentiment_meta(sentiment_score)
        return ImpactResult(
            impact_score=round(impact_score, 4),
            distance=distance,
            color=color,
            sentiment=sentiment,
        )

    def _source_weight(self, source: str) -> float:
        lowered = source.lower()
        for keyword, weight in self.SOURCE_WEIGHTS.items():
            if keyword in lowered:
                return weight
        return 0.8

    @staticmethod
    def _recency_weight(published_at: datetime, reference_time: datetime) -> float:
        age = max(timedelta(), reference_time - published_at)
        hours = age.total_seconds() / 3600
        if hours <= 6:
            return 1.0
        if hours <= 24:
            return 0.95
        if hours <= 72:
            return 0.88
        if hours <= 168:
            return 0.74
        return 0.55

    @staticmethod
    def _sentiment_meta(score: float) -> tuple[str, str]:
        if score > 0.1:
            return "blue", "positive"
        if score < -0.1:
            return "red", "negative"
        return "gray", "neutral"
