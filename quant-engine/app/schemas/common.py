from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")


def to_camel(value: str) -> str:
    parts = value.split("_")
    return parts[0] + "".join(part.capitalize() for part in parts[1:])


class CamelModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True, alias_generator=to_camel)


class ApiResponse(CamelModel, Generic[T]):
    success: bool = True
    data: T | None = None
    message: str = "ok"
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class HealthResponse(CamelModel):
    status: str
    app: str
    timestamp: datetime


class SeriesPoint(CamelModel):
    date: date
    value: float


class WeightItem(CamelModel):
    symbol: str
    weight: float


class MetricValue(CamelModel):
    name: str
    value: float | None


class JobSummary(CamelModel):
    id: int
    job_type: str
    status: str
    started_at: datetime | None = None
    finished_at: datetime | None = None
    message: str | None = None
    progress_percent: int | None = None
    stage: str | None = None
    stage_label: str | None = None
    processed_count: int | None = None
    total_count: int | None = None


class MarketCandleDto(CamelModel):
    date: date
    open: Decimal
    high: Decimal
    low: Decimal
    close: Decimal
    volume: int


class MarketIndexDto(CamelModel):
    symbol: str
    name: str
    last_price: Decimal
    change_percent: Decimal
    series: list[Decimal] = Field(default_factory=list)
    range_series: dict[str, list[Decimal]] = Field(default_factory=dict)
    candles: list[MarketCandleDto] = Field(default_factory=list)
    range_candles: dict[str, list[MarketCandleDto]] = Field(default_factory=dict)
