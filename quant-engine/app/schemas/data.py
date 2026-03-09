from __future__ import annotations

from datetime import date, datetime

from pydantic import Field

from app.schemas.common import CamelModel, JobSummary


class DataUpdateRequest(CamelModel):
    preset: str | None = "strategy_core_equities"
    symbols: list[str] = Field(default_factory=list)
    benchmark_symbols: list[str] = Field(default_factory=list)
    period: str = "5y"
    interval: str = "1d"


class DataUpdateResult(CamelModel):
    accepted: bool
    job_id: int | None = None
    status: str
    message: str
    prices_updated: int | None = None
    fundamentals_updated: int | None = None
    benchmarks_updated: int | None = None
    jobs_written: list[int] = Field(default_factory=list)


class DataStatusResponse(CamelModel):
    latest_price_date: date | None = None
    price_row_count: int = 0
    latest_fundamentals_date: date | None = None
    fundamentals_row_count: int = 0
    latest_benchmark_date: date | None = None
    benchmark_row_count: int = 0
    job_health_summary: dict[str, int]
    latest_jobs: list[JobSummary]
    queue_status: str = "유휴"
    active_job: JobSummary | None = None


class StockRegisterRequest(CamelModel):
    symbol: str
    market_type: str | None = None
    asset_group: str | None = None
    period: str = "5y"
    interval: str = "1d"


class StockRegisterResponse(CamelModel):
    symbol: str
    name: str
    exchange: str
    market_type: str
    asset_group: str
    currency: str
    market_cap: float | None = None
    prices_updated: int = 0
    fundamentals_updated: int = 0


class StockSearchResult(CamelModel):
    symbol: str
    name: str
    exchange: str
    market_type: str
    asset_group: str
    currency: str
    market_cap: float | None = None
