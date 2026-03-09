from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime, timezone
from threading import Lock

from sqlalchemy import Date, DateTime, MetaData, create_engine, text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

from app.config import get_settings


NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


class TimestampMixin:
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


settings = get_settings()
engine = create_engine(settings.sqlalchemy_database_uri, pool_pre_ping=True, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
_UPSERT_INDEX_LOCK = Lock()
_UPSERT_INDEX_READY = False


@contextmanager
def session_scope():
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def ensure_upsert_indexes(session) -> None:
    global _UPSERT_INDEX_READY
    if _UPSERT_INDEX_READY:
        return

    with _UPSERT_INDEX_LOCK:
        if _UPSERT_INDEX_READY:
            return

        session.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS earnings_events (
                    id SERIAL PRIMARY KEY,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    symbol VARCHAR(32) NOT NULL,
                    earnings_date DATE NOT NULL,
                    eps_estimate NUMERIC(20, 6),
                    reported_eps NUMERIC(20, 6),
                    surprise_percent NUMERIC(20, 6),
                    source VARCHAR(50) NOT NULL DEFAULT 'yfinance'
                )
                """
            )
        )
        session.execute(text("CREATE INDEX IF NOT EXISTS ix_earnings_events_symbol ON earnings_events (symbol)"))
        session.execute(text("CREATE INDEX IF NOT EXISTS ix_earnings_events_earnings_date ON earnings_events (earnings_date)"))

        session.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS insider_trades (
                    id SERIAL PRIMARY KEY,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    trade_key VARCHAR(255) NOT NULL,
                    symbol VARCHAR(32) NOT NULL,
                    transaction_date DATE NOT NULL,
                    insider VARCHAR(255),
                    position VARCHAR(255),
                    transaction_type VARCHAR(255),
                    transaction_text TEXT,
                    shares NUMERIC(24, 6),
                    value NUMERIC(24, 6),
                    ownership VARCHAR(32),
                    direction SMALLINT NOT NULL DEFAULT 0,
                    source VARCHAR(50) NOT NULL DEFAULT 'yfinance'
                )
                """
            )
        )
        session.execute(text("CREATE INDEX IF NOT EXISTS ix_insider_trades_symbol ON insider_trades (symbol)"))
        session.execute(text("CREATE INDEX IF NOT EXISTS ix_insider_trades_transaction_date ON insider_trades (transaction_date)"))

        session.execute(
            text(
                """
                DELETE FROM prices older
                USING prices newer
                WHERE older.symbol = newer.symbol
                  AND older.date = newer.date
                  AND older.id < newer.id
                """
            )
        )
        session.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_prices_symbol_date ON prices (symbol, date)"))

        session.execute(
            text(
                """
                DELETE FROM fundamentals older
                USING fundamentals newer
                WHERE older.symbol = newer.symbol
                  AND older.date = newer.date
                  AND older.id < newer.id
                """
            )
        )
        session.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_fundamentals_symbol_date ON fundamentals (symbol, date)"))

        session.execute(
            text(
                """
                DELETE FROM benchmark_data older
                USING benchmark_data newer
                WHERE older.symbol = newer.symbol
                  AND older.date = newer.date
                  AND older.id < newer.id
                """
            )
        )
        session.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_benchmark_data_symbol_date ON benchmark_data (symbol, date)"))

        session.execute(
            text(
                """
                DELETE FROM earnings_events older
                USING earnings_events newer
                WHERE older.symbol = newer.symbol
                  AND older.earnings_date = newer.earnings_date
                  AND older.id < newer.id
                """
            )
        )
        session.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_earnings_events_symbol_date ON earnings_events (symbol, earnings_date)"))

        session.execute(
            text(
                """
                DELETE FROM insider_trades older
                USING insider_trades newer
                WHERE older.trade_key = newer.trade_key
                  AND older.id < newer.id
                """
            )
        )
        session.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_insider_trades_trade_key ON insider_trades (trade_key)"))
        session.flush()
        _UPSERT_INDEX_READY = True
