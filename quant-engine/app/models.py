from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import BigInteger, Date, DateTime, ForeignKey, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base, TimestampMixin


class Price(TimestampMixin, Base):
    __tablename__ = "prices"
    __table_args__ = (UniqueConstraint("symbol", "date"),)

    symbol: Mapped[str] = mapped_column(String(32), index=True)
    date: Mapped[date] = mapped_column(Date, index=True)
    open: Mapped[Decimal | None] = mapped_column(Numeric(20, 6))
    high: Mapped[Decimal | None] = mapped_column(Numeric(20, 6))
    low: Mapped[Decimal | None] = mapped_column(Numeric(20, 6))
    close: Mapped[Decimal | None] = mapped_column(Numeric(20, 6))
    adj_close: Mapped[Decimal | None] = mapped_column(Numeric(20, 6), nullable=True)
    volume: Mapped[int] = mapped_column(BigInteger, default=0)


class Stock(TimestampMixin, Base):
    __tablename__ = "stocks"

    symbol: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    exchange: Mapped[str] = mapped_column(String(50))
    sector: Mapped[str | None] = mapped_column(String(100), nullable=True)
    industry: Mapped[str | None] = mapped_column(String(150), nullable=True)
    currency: Mapped[str] = mapped_column(String(16), default="USD")
    market_cap: Mapped[Decimal | None] = mapped_column(Numeric(24, 4), nullable=True)


class Fundamental(TimestampMixin, Base):
    __tablename__ = "fundamentals"
    __table_args__ = (UniqueConstraint("symbol", "date"),)

    symbol: Mapped[str] = mapped_column(String(32), index=True)
    date: Mapped[date] = mapped_column(Date, index=True)
    per: Mapped[Decimal | None] = mapped_column(Numeric(20, 6), nullable=True)
    pbr: Mapped[Decimal | None] = mapped_column(Numeric(20, 6), nullable=True)
    roe: Mapped[Decimal | None] = mapped_column(Numeric(20, 6), nullable=True)
    eps: Mapped[Decimal | None] = mapped_column(Numeric(20, 6), nullable=True)
    dividend_yield: Mapped[Decimal | None] = mapped_column(Numeric(20, 6), nullable=True)
    market_cap: Mapped[Decimal | None] = mapped_column(Numeric(24, 4), nullable=True)
    revenue: Mapped[Decimal | None] = mapped_column(Numeric(24, 4), nullable=True)
    net_income: Mapped[Decimal | None] = mapped_column(Numeric(24, 4), nullable=True)


class FactorData(TimestampMixin, Base):
    __tablename__ = "factor_data"

    symbol: Mapped[str] = mapped_column(String(32), index=True)
    date: Mapped[date] = mapped_column(Date, index=True)
    momentum: Mapped[Decimal | None] = mapped_column(Numeric(20, 6), nullable=True)
    volatility: Mapped[Decimal | None] = mapped_column(Numeric(20, 6), nullable=True)
    value_score: Mapped[Decimal | None] = mapped_column(Numeric(20, 6), nullable=True)
    quality_score: Mapped[Decimal | None] = mapped_column(Numeric(20, 6), nullable=True)
    growth_score: Mapped[Decimal | None] = mapped_column(Numeric(20, 6), nullable=True)


class Strategy(TimestampMixin, Base):
    __tablename__ = "strategies"

    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    roe_filter: Mapped[Decimal | None] = mapped_column(Numeric(20, 6), nullable=True)
    pbr_filter: Mapped[Decimal | None] = mapped_column(Numeric(20, 6), nullable=True)
    momentum_filter: Mapped[Decimal | None] = mapped_column(Numeric(20, 6), nullable=True)
    stock_count: Mapped[int | None]
    rebalance_period: Mapped[str | None] = mapped_column(String(50), nullable=True)
    weighting_method: Mapped[str | None] = mapped_column(String(50), nullable=True)
    factor_weight_mode: Mapped[str] = mapped_column(String(20), default="AUTO")
    status: Mapped[str] = mapped_column(String(50), default="DRAFT")

    factor_weights: Mapped[list[StrategyFactor]] = relationship(back_populates="strategy")


class StrategyFactor(TimestampMixin, Base):
    __tablename__ = "strategy_factors"

    strategy_id: Mapped[int] = mapped_column(ForeignKey("strategies.id"), index=True)
    factor_name: Mapped[str] = mapped_column(String(100))
    factor_weight: Mapped[Decimal] = mapped_column(Numeric(12, 6))

    strategy: Mapped[Strategy] = relationship(back_populates="factor_weights")


class Backtest(TimestampMixin, Base):
    __tablename__ = "backtests"

    strategy_id: Mapped[int] = mapped_column(ForeignKey("strategies.id"), index=True)
    snapshot_id: Mapped[int | None] = mapped_column(ForeignKey("strategy_weight_snapshots.id"), nullable=True, index=True)
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    cagr: Mapped[Decimal | None] = mapped_column(Numeric(20, 6), nullable=True)
    sharpe: Mapped[Decimal | None] = mapped_column(Numeric(20, 6), nullable=True)
    max_drawdown: Mapped[Decimal | None] = mapped_column(Numeric(20, 6), nullable=True)
    volatility: Mapped[Decimal | None] = mapped_column(Numeric(20, 6), nullable=True)
    win_rate: Mapped[Decimal | None] = mapped_column(Numeric(20, 6), nullable=True)
    stock_breakdown_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    pattern_breakdown_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    trade_log_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    signal_timeline_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    research_config_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    universe_scope_json: Mapped[str | None] = mapped_column(Text, nullable=True)


class BacktestEquity(TimestampMixin, Base):
    __tablename__ = "backtest_equity"

    backtest_id: Mapped[int] = mapped_column(ForeignKey("backtests.id"), index=True)
    date: Mapped[date] = mapped_column(Date)
    equity_value: Mapped[Decimal] = mapped_column(Numeric(24, 6))


class BenchmarkData(TimestampMixin, Base):
    __tablename__ = "benchmark_data"
    __table_args__ = (UniqueConstraint("symbol", "date"),)

    symbol: Mapped[str] = mapped_column(String(32), index=True)
    date: Mapped[date] = mapped_column(Date, index=True)
    price: Mapped[Decimal] = mapped_column(Numeric(20, 6))


class StrategyWeightSnapshot(TimestampMixin, Base):
    __tablename__ = "strategy_weight_snapshots"

    strategy_id: Mapped[int] = mapped_column(ForeignKey("strategies.id"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    factor_weight_mode: Mapped[str] = mapped_column(String(20), default="AUTO")
    factor_weights_json: Mapped[str] = mapped_column(Text)


class Portfolio(TimestampMixin, Base):
    __tablename__ = "portfolio"

    user_id: Mapped[int] = mapped_column(index=True)
    name: Mapped[str] = mapped_column(String(255))
    base_currency: Mapped[str] = mapped_column(String(16), default="KRW")
    status: Mapped[str] = mapped_column(String(50), default="ACTIVE")


class Position(TimestampMixin, Base):
    __tablename__ = "positions"

    portfolio_id: Mapped[int] = mapped_column(ForeignKey("portfolio.id"), index=True)
    symbol: Mapped[str] = mapped_column(String(32), index=True)
    quantity: Mapped[Decimal | None] = mapped_column(Numeric(24, 6), nullable=True)
    avg_price: Mapped[Decimal | None] = mapped_column(Numeric(20, 6), nullable=True)
    current_price: Mapped[Decimal | None] = mapped_column(Numeric(20, 6), nullable=True)
    market_value: Mapped[Decimal | None] = mapped_column(Numeric(24, 6), nullable=True)
    unrealized_pnl: Mapped[Decimal | None] = mapped_column(Numeric(24, 6), nullable=True)


class RiskMetric(TimestampMixin, Base):
    __tablename__ = "risk_metrics"

    portfolio_id: Mapped[int] = mapped_column(ForeignKey("portfolio.id"), index=True)
    date: Mapped[date] = mapped_column(Date)
    var: Mapped[Decimal | None] = mapped_column("var", Numeric(20, 6), nullable=True)
    beta: Mapped[Decimal | None] = mapped_column(Numeric(20, 6), nullable=True)
    volatility: Mapped[Decimal | None] = mapped_column(Numeric(20, 6), nullable=True)
    max_drawdown: Mapped[Decimal | None] = mapped_column(Numeric(20, 6), nullable=True)


class News(TimestampMixin, Base):
    __tablename__ = "news"

    title: Mapped[str] = mapped_column(String(500))
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(String(255))
    url: Mapped[str] = mapped_column(String(1000))
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    sentiment_score: Mapped[Decimal | None] = mapped_column(Numeric(20, 6), nullable=True)

    symbols: Mapped[list[NewsSymbol]] = relationship(back_populates="news")
    impacts: Mapped[list[NewsImpact]] = relationship(back_populates="news")


class NewsSymbol(TimestampMixin, Base):
    __tablename__ = "news_symbols"

    news_id: Mapped[int] = mapped_column(ForeignKey("news.id"), index=True)
    symbol: Mapped[str] = mapped_column(String(32), index=True)
    relevance_score: Mapped[Decimal | None] = mapped_column(Numeric(12, 6), nullable=True)

    news: Mapped[News] = relationship(back_populates="symbols")


class NewsImpact(TimestampMixin, Base):
    __tablename__ = "news_impact"

    symbol: Mapped[str] = mapped_column(String(32), index=True)
    news_id: Mapped[int] = mapped_column(ForeignKey("news.id"), index=True)
    impact_score: Mapped[Decimal] = mapped_column(Numeric(12, 6))
    distance: Mapped[Decimal] = mapped_column(Numeric(12, 6))
    node_color: Mapped[str] = mapped_column(String(32))

    news: Mapped[News] = relationship(back_populates="impacts")


class EarningsEvent(TimestampMixin, Base):
    __tablename__ = "earnings_events"
    __table_args__ = (UniqueConstraint("symbol", "earnings_date"),)

    symbol: Mapped[str] = mapped_column(String(32), index=True)
    earnings_date: Mapped[date] = mapped_column(Date, index=True)
    eps_estimate: Mapped[Decimal | None] = mapped_column(Numeric(20, 6), nullable=True)
    reported_eps: Mapped[Decimal | None] = mapped_column(Numeric(20, 6), nullable=True)
    surprise_percent: Mapped[Decimal | None] = mapped_column(Numeric(20, 6), nullable=True)
    source: Mapped[str] = mapped_column(String(50), default="yfinance")


class InsiderTrade(TimestampMixin, Base):
    __tablename__ = "insider_trades"

    trade_key: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    symbol: Mapped[str] = mapped_column(String(32), index=True)
    transaction_date: Mapped[date] = mapped_column(Date, index=True)
    insider: Mapped[str | None] = mapped_column(String(255), nullable=True)
    position: Mapped[str | None] = mapped_column(String(255), nullable=True)
    transaction_type: Mapped[str | None] = mapped_column(String(255), nullable=True)
    transaction_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    shares: Mapped[Decimal | None] = mapped_column(Numeric(24, 6), nullable=True)
    value: Mapped[Decimal | None] = mapped_column(Numeric(24, 6), nullable=True)
    ownership: Mapped[str | None] = mapped_column(String(32), nullable=True)
    direction: Mapped[int] = mapped_column(default=0)
    source: Mapped[str] = mapped_column(String(50), default="yfinance")


class Job(TimestampMixin, Base):
    __tablename__ = "jobs"

    job_type: Mapped[str] = mapped_column(String(100))
    parent_job_id: Mapped[int | None] = mapped_column(ForeignKey("jobs.id"), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(50), default="PENDING")
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[str | None] = mapped_column(Text, nullable=True)
