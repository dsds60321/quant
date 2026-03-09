from __future__ import annotations

import logging

from app.config import get_settings

logger = logging.getLogger(__name__)


class TranslationService:
    _load_error_logged = False

    def __init__(self) -> None:
        self._pipeline = None
        self._settings = get_settings()

    def _load(self):
        if self._pipeline is not None:
            return self._pipeline
        try:
            from transformers import pipeline

            self._pipeline = pipeline(
                "translation_en_to_ko",
                model=self._settings.translation_model_name,
                tokenizer=self._settings.translation_model_name,
                truncation=True,
            )
        except Exception as exc:
            if not TranslationService._load_error_logged:
                logger.warning("번역 모델 초기화 실패, 원문을 그대로 사용합니다: %s", exc)
                TranslationService._load_error_logged = True
            self._pipeline = False
        return self._pipeline

    def translate(self, text: str | None) -> str | None:
        if not text:
            return text
        stripped = text.strip()
        if not stripped or self._looks_korean(stripped):
            return stripped

        model = self._load()
        if not model:
            return stripped

        try:
            result = model(stripped[:512])[0]
            return (result.get("translation_text") or stripped).strip()
        except Exception as exc:
            logger.warning("번역 처리 실패, 원문을 그대로 사용합니다: %s", exc)
            return stripped

    @staticmethod
    def _looks_korean(text: str) -> bool:
        return any("\uac00" <= char <= "\ud7a3" for char in text)
