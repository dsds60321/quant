from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


def _resolve_spring_value(value: str) -> str | None:
    if value.startswith("${") and value.endswith("}"):
        placeholder = value[2:-1]
        _, _, default_value = placeholder.partition(":")
        return default_value or None
    return value or None


def _load_news_api_key_from_spring_config() -> str | None:
    root_dir = Path(__file__).resolve().parents[2]
    config_path = root_dir / "src" / "main" / "resources" / "application.yml"
    if not config_path.exists():
        return None

    in_api_block = False
    in_news_block = False
    for raw_line in config_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.rstrip()
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        indent = len(line) - len(line.lstrip(" "))
        if indent == 0:
            in_api_block = stripped == "api:"
            in_news_block = False
            continue
        if in_api_block and indent == 2:
            in_news_block = stripped == "news:"
            continue
        if in_api_block and in_news_block and indent >= 4 and stripped.startswith("key:"):
            value = stripped.split(":", 1)[1].strip()
            return _resolve_spring_value(value.strip("'\""))
    return None


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "quant-engine"
    app_env: Literal["local", "dev", "prod", "test"] = "local"
    debug: bool = False
    api_prefix: str = ""
    timezone: str = "UTC"

    db_host: str = Field(default="localhost", alias="DB_HOST")
    db_port: int = Field(default=5432, alias="DB_PORT")
    db_name: str = Field(default="quant", alias="DB_NAME")
    db_username: str = Field(default="kanggeonho", alias="DB_USERNAME")
    db_password: str = Field(default="", alias="DB_PASSWORD")
    database_url: str | None = Field(default=None, alias="DB_URL")

    default_benchmark_symbol: str = "SPY"
    default_initial_cash: float = 1_000_000.0
    min_market_cap: float = 0.0
    min_avg_volume: float = 0.0
    min_history_days: int = 20
    max_missing_ratio: float = 1.0
    max_single_weight: float = 0.2
    factor_winsor_quantile: float = 0.025
    risk_free_rate: float = 0.02
    news_api_key: str | None = Field(default_factory=_load_news_api_key_from_spring_config, alias="NEWS_API_KEY")
    news_api_base_url: str = "https://newsapi.org/v2/everything"
    sec_user_agent: str = Field(default="quant-engine/1.0 (contact: support@quant-engine.local)", alias="SEC_USER_AGENT")
    sentiment_model_name: str = "ProsusAI/finbert"
    translation_model_name: str = "Helsinki-NLP/opus-mt-tc-big-en-ko"
    news_max_nodes: int = 100
    news_lookback_days: int = 7

    @property
    def sqlalchemy_database_uri(self) -> str:
        if self.database_url:
            if self.database_url.startswith("jdbc:postgresql://"):
                return self.database_url.replace("jdbc:postgresql://", "postgresql+psycopg2://", 1)
            return self.database_url
        return (
            f"postgresql+psycopg2://{self.db_username}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
