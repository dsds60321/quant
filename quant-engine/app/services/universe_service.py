from __future__ import annotations

from datetime import date

import pandas as pd
from sqlalchemy.orm import Session

from app.config import get_settings
from app.repositories.fundamental_repository import FundamentalRepository
from app.repositories.price_repository import PriceRepository
from app.repositories.stock_repository import StockRepository
from app.schemas.factor import UniverseConfig


class UniverseService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.settings = get_settings()
        self.price_repository = PriceRepository(session)
        self.fundamental_repository = FundamentalRepository(session)
        self.stock_repository = StockRepository(session)

    def _is_factor_eligible_instrument(self, symbol: str, name: str | None) -> bool:
        normalized_symbol = symbol.upper()
        normalized_name = (name or "").lower()
        if normalized_symbol.startswith("^"):
            return False
        etf_tokens = (
            "etf", "etn", "trust", "fund", "spdr", "ishares", "vanguard", "invesco",
            "wisdomtree", "proshares", "direxion", "global x", "kodex", "tiger",
            "arirang", "kbstar", "ace", "sol",
        )
        return not any(token in normalized_name for token in etf_tokens)

    @staticmethod
    def _filter_frame_by_symbols(frame: pd.DataFrame, allowed_symbols: list[str]) -> pd.DataFrame:
        if frame.empty or "symbol" not in frame.columns:
            return frame
        return frame[frame["symbol"].isin(allowed_symbols)].reset_index(drop=True)

    def build_universe(self, as_of_date: date, config: UniverseConfig | None = None) -> tuple[list[str], pd.DataFrame, pd.DataFrame, pd.DataFrame]:
        config = config or UniverseConfig(
            min_market_cap=self.settings.min_market_cap,
            min_avg_volume=self.settings.min_avg_volume,
            min_history_days=self.settings.min_history_days,
            max_missing_ratio=self.settings.max_missing_ratio,
        )
        lookback = max(config.min_history_days + 40, 320)
        price_frame = self.price_repository.get_price_frame(end_date=as_of_date, lookback_days=lookback)
        fundamental_frame = self.fundamental_repository.get_latest_fundamentals(end_date=as_of_date)
        fundamental_history = self.fundamental_repository.get_fundamental_history(end_date=as_of_date)
        stock_metadata = self.stock_repository.get_metadata_frame()
        allowed_symbols: list[str] = []
        if not stock_metadata.empty:
            eligible_metadata = stock_metadata[
                stock_metadata.apply(
                    lambda row: self._is_factor_eligible_instrument(str(row["symbol"]), row.get("name")),
                    axis=1,
                )
            ]
            allowed_symbols = eligible_metadata["symbol"].dropna().astype(str).drop_duplicates().tolist()

        if allowed_symbols:
            price_frame = self._filter_frame_by_symbols(price_frame, allowed_symbols)
            fundamental_frame = self._filter_frame_by_symbols(fundamental_frame, allowed_symbols)
            fundamental_history = self._filter_frame_by_symbols(fundamental_history, allowed_symbols)
            if not stock_metadata.empty:
                stock_metadata = stock_metadata[stock_metadata["symbol"].isin(allowed_symbols)].reset_index(drop=True)

        if price_frame.empty:
            return [], price_frame, fundamental_frame, fundamental_history

        price_frame["date"] = pd.to_datetime(price_frame["date"])
        stats = []
        latest_timestamp = price_frame["date"].max()
        for symbol, group in price_frame.groupby("symbol"):
            closes = group["adj_close"].replace(0, pd.NA)
            stats.append(
                {
                    "symbol": symbol,
                    "history_days": len(group),
                    "missing_ratio": closes.isna().mean(),
                    "avg_volume_20": group["volume"].tail(20).mean(),
                    "avg_traded_value_20": (group["adj_close"] * group["volume"]).tail(20).mean(),
                    "latest_date": group["date"].max(),
                }
            )
        universe = pd.DataFrame(stats)
        if not fundamental_frame.empty and "market_cap" in fundamental_frame.columns:
            universe = universe.merge(fundamental_frame[["symbol", "market_cap"]], on="symbol", how="left")
        else:
            universe["market_cap"] = pd.NA
        if not stock_metadata.empty:
            universe = universe.merge(stock_metadata[["symbol", "name"]], on="symbol", how="left")
        if config.min_history_days > 0:
            universe = universe[universe["history_days"] >= config.min_history_days]
        if config.max_missing_ratio < 1:
            universe = universe[universe["missing_ratio"] <= config.max_missing_ratio]
        if config.min_avg_volume > 0:
            universe = universe[universe["avg_volume_20"] >= config.min_avg_volume]
        universe = universe[universe["avg_traded_value_20"] > 0]
        if config.min_market_cap > 0 and universe["market_cap"].notna().any():
            universe = universe[(universe["market_cap"].isna()) | (universe["market_cap"] >= config.min_market_cap)]
        universe = universe[(latest_timestamp - universe["latest_date"]).dt.days <= config.stale_after_days]
        if "name" in universe.columns:
            universe = universe[universe.apply(lambda row: self._is_factor_eligible_instrument(str(row["symbol"]), row.get("name")), axis=1)]
        eligible = universe["symbol"].drop_duplicates().tolist()
        return eligible, price_frame, fundamental_frame, fundamental_history
