from __future__ import annotations

import logging
from dataclasses import dataclass

from app.config import get_settings

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class SentimentResult:
    label: str
    score: float


class SentimentService:
    def __init__(self) -> None:
        self._pipeline = None
        self._settings = get_settings()

    def _load(self):
        if self._pipeline is not None:
            return self._pipeline
        try:
            from transformers import pipeline

            self._pipeline = pipeline(
                "sentiment-analysis",
                model=self._settings.sentiment_model_name,
                tokenizer=self._settings.sentiment_model_name,
                truncation=True,
            )
        except Exception as exc:
            logger.warning("FinBERT 초기화 실패, 규칙 기반 감성 분석으로 전환합니다: %s", exc)
            self._pipeline = False
        return self._pipeline

    def analyze(self, text: str) -> SentimentResult:
        model = self._load()
        if model:
            result = model(text[:512])[0]
            label = result["label"].lower()
            probability = float(result["score"])
            if label.startswith("pos"):
                return SentimentResult(label="positive", score=round(probability, 4))
            if label.startswith("neg"):
                return SentimentResult(label="negative", score=round(-probability, 4))
            return SentimentResult(label="neutral", score=0.0)
        return self._rule_based(text)

    @staticmethod
    def _rule_based(text: str) -> SentimentResult:
        lower = text.lower()
        positive = sum(token in lower for token in ["beat", "growth", "surge", "upgrade", "strong", "record", "demand"])
        negative = sum(token in lower for token in ["miss", "drop", "downgrade", "weak", "lawsuit", "restriction", "probe"])
        if positive == negative:
            return SentimentResult(label="neutral", score=0.0)
        total = max(1, positive + negative)
        raw_score = (positive - negative) / total
        label = "positive" if raw_score > 0 else "negative"
        return SentimentResult(label=label, score=round(raw_score, 4))
