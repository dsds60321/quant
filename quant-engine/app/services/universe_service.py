from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
import logging

import pandas as pd
from sqlalchemy.orm import Session

from app.config import get_settings
from app.repositories.fundamental_repository import FundamentalRepository
from app.repositories.portfolio_repository import PortfolioRepository
from app.repositories.price_repository import PriceRepository
from app.repositories.stock_repository import StockRepository
from app.schemas.data import StockRegisterRequest
from app.schemas.backtest import UniverseScope
from app.schemas.factor import UniverseConfig
from app.services.data_ingestion_service import DataIngestionService
from app.services.sector_taxonomy import normalize_sector_label


logger = logging.getLogger(__name__)


@dataclass
class ResolvedUniverseScope:
    scope: UniverseScope
    allowed_symbols: list[str] | None = None


@dataclass
class UniverseDataBundle:
    config: UniverseConfig
    requested_symbols: list[str]
    stock_metadata: pd.DataFrame
    price_frame: pd.DataFrame
    fundamental_history: pd.DataFrame


class UniverseService:
    _ETF_TOKEN_PATTERN = (
        r"etf|etn|trust|fund|spdr|ishares|vanguard|invesco|wisdomtree|proshares|"
        r"direxion|global x|kodex|tiger|arirang|kbstar|ace|sol|vaneck|victoryshares|"
        r"glaciershares|defiance|leverage shares|yieldmax|roundhill|themes|graniteshares|"
        r"simplify|pacer|kraneshares|cambria|robo global|bitwise"
    )
    _US_EXCHANGE_TOKENS = ("NASDAQ", "NYSE", "NYSE ARCA", "AMEX", "BATS", "CBOE", "OTC")
    _KOREA_EXCHANGE_TOKENS = ("KOSPI", "KOSDAQ", "KRX")
    _WATCHLIST_PRESET_SYMBOLS = {
        "watchlist-semiconductor": ["NVDA", "AVGO", "TSM", "AMD", "SOXL", "NVDL"],
        "watchlist-ai-core": ["NVDA", "MSFT", "GOOGL", "AMZN", "META", "PLTR", "SMCI", "AVGO"],
        "watchlist-defense": ["LMT", "NOC", "RTX", "LHX", "KTOS"],
    }
    _THEME_KEYWORDS = {
        "ai": (" ai ", "artificial intelligence", "machine learning", "gpu", "data center", "cloud", "semiconductor"),
        "반도체": ("semiconductor", "chip", "gpu", "memory", "foundry", "fabless"),
        "2차전지": ("battery", "lithium", "cathode", "anode", "energy storage"),
        "방산": ("defense", "aerospace", "military", "missile", "weapon"),
        "ev": ("ev", "electric vehicle", "battery", "charging", "autonomous"),
        "바이오": ("biotech", "biopharma", "pharma", "drug", "therapeutics", "diagnostic"),
        "생활소비재": ("consumer", "lifestyle", "retail", "apparel", "beauty", "food", "beverage"),
    }

    def __init__(self, session: Session) -> None:
        self.session = session
        self.settings = get_settings()
        self.price_repository = PriceRepository(session)
        self.fundamental_repository = FundamentalRepository(session)
        self.stock_repository = StockRepository(session)
        self.portfolio_repository = PortfolioRepository(session)

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

    def _resolve_asset_group(self, exchange: str, name: str, market_type: str) -> str:
        normalized_name = name.lower()
        if any(token in normalized_name for token in ("etf", "etn", "trust", "fund", "spdr", "ishares", "vanguard", "invesco", "wisdomtree", "proshares", "direxion", "global x", "kodex", "tiger", "arirang", "kbstar", "ace", "sol", "vaneck", "victoryshares", "glaciershares", "defiance", "leverage shares", "yieldmax", "roundhill", "themes", "graniteshares", "simplify", "pacer", "kraneshares", "cambria", "robo global", "bitwise")):
            return "ETF"
        if market_type == "DOMESTIC" and exchange.lower() in {"kosdaq", "ksq"}:
            return "KOSDAQ"
        if market_type == "DOMESTIC":
            return "KOSPI"
        return "STOCK"

    @staticmethod
    def _filter_frame_by_symbols(frame: pd.DataFrame, allowed_symbols: list[str]) -> pd.DataFrame:
        if frame.empty or "symbol" not in frame.columns:
            return frame
        return frame[frame["symbol"].isin(allowed_symbols)].reset_index(drop=True)

    def _resolve_config(self, config: UniverseConfig | None = None) -> UniverseConfig:
        return config or UniverseConfig(
            min_market_cap=self.settings.min_market_cap,
            min_avg_volume=self.settings.min_avg_volume,
            min_history_days=self.settings.min_history_days,
            max_missing_ratio=self.settings.max_missing_ratio,
        )

    def _build_latest_fundamentals(self, fundamental_history: pd.DataFrame, as_of_timestamp: pd.Timestamp) -> pd.DataFrame:
        if fundamental_history.empty:
            return pd.DataFrame(columns=FundamentalRepository._FRAME_COLUMNS)
        window = fundamental_history.loc[fundamental_history["date"] <= as_of_timestamp]
        if window.empty:
            return pd.DataFrame(columns=FundamentalRepository._FRAME_COLUMNS)
        return window.groupby("symbol", observed=True, group_keys=False).tail(1).reset_index(drop=True)

    @staticmethod
    def _normalize_symbols(symbols: list[str] | None) -> list[str]:
        if not symbols:
            return []
        normalized: list[str] = []
        seen: set[str] = set()
        for symbol in symbols:
            resolved = str(symbol or "").strip().upper()
            if not resolved or resolved in seen:
                continue
            seen.add(resolved)
            normalized.append(resolved)
        return normalized

    @staticmethod
    def _normalize_labels(labels: list[str] | None) -> list[str]:
        if not labels:
            return []
        normalized: list[str] = []
        seen: set[str] = set()
        for label in labels:
            resolved = str(label or "").strip()
            if not resolved:
                continue
            lowered = resolved.casefold()
            if lowered in seen:
                continue
            seen.add(lowered)
            normalized.append(resolved)
        return normalized

    def _normalize_asset_scope(self, asset_scope: str | None) -> str:
        normalized = (asset_scope or "STRATEGY_DEFAULT").upper()
        if normalized == "ETF":
            return "ETF"
        if normalized == "ALL":
            return "ALL"
        return "STOCK"

    def _filter_eligible_metadata(
        self,
        stock_metadata: pd.DataFrame,
        asset_scope: str | None = None,
        preserve_symbols: list[str] | None = None,
    ) -> pd.DataFrame:
        if stock_metadata.empty:
            return stock_metadata
        symbols = stock_metadata["symbol"].fillna("").astype(str)
        names = stock_metadata["name"].fillna("").astype(str)
        sectors = stock_metadata["sector"].fillna("").astype(str).str.upper()
        is_index = symbols.str.startswith("^")
        is_fund_like = names.str.lower().str.contains(self._ETF_TOKEN_PATTERN, regex=True, na=False) | (sectors == "ETF")
        normalized_asset_scope = self._normalize_asset_scope(asset_scope)
        if normalized_asset_scope == "ETF":
            allowed_mask = ~is_index & is_fund_like
        elif normalized_asset_scope == "ALL":
            allowed_mask = ~is_index
        else:
            allowed_mask = ~is_index & ~is_fund_like
        if preserve_symbols:
            preserved = symbols.str.upper().isin(self._normalize_symbols(preserve_symbols))
            return stock_metadata.loc[allowed_mask | preserved].reset_index(drop=True)
        return stock_metadata.loc[allowed_mask].reset_index(drop=True)

    def _ensure_requested_symbol_data(self, requested_symbols: list[str], stock_metadata: pd.DataFrame) -> None:
        if not requested_symbols:
            return
        latest_dates = self.price_repository.get_latest_price_dates(requested_symbols)
        latest_fundamentals = self.fundamental_repository.get_latest_fundamentals(end_date=date.today(), symbols=requested_symbols)
        fundamental_ready_symbols: set[str] = set()
        if not latest_fundamentals.empty:
            readiness_columns = [
                column
                for column in ["per", "pbr", "roe", "market_cap"]
                if column in latest_fundamentals.columns
            ]
            if readiness_columns:
                fundamental_ready_symbols = {
                    str(symbol).upper()
                    for symbol in latest_fundamentals.loc[
                        latest_fundamentals[readiness_columns].notna().any(axis=1),
                        "symbol",
                    ].astype(str).tolist()
                }
        missing_price_symbols = [symbol for symbol in requested_symbols if latest_dates.get(symbol) is None]
        missing_fundamental_symbols = [
            symbol
            for symbol in requested_symbols
            if latest_dates.get(symbol) is not None and symbol not in fundamental_ready_symbols
        ]
        if not missing_price_symbols and not missing_fundamental_symbols:
            return

        metadata_by_symbol: dict[str, dict[str, object]] = {}
        if not stock_metadata.empty and "symbol" in stock_metadata.columns:
            metadata_by_symbol = {
                str(row["symbol"]).upper(): row.to_dict()
                for _, row in stock_metadata.iterrows()
            }

        ingestion_service = DataIngestionService(self.session)
        for symbol in missing_price_symbols:
            metadata = metadata_by_symbol.get(symbol, {})
            exchange = str(metadata.get("exchange") or "")
            name = str(metadata.get("name") or symbol)
            market_type = self._resolve_market_type(exchange) if exchange else ("DOMESTIC" if symbol.endswith((".KS", ".KQ")) else "INTERNATIONAL")
            asset_group = str(metadata.get("asset_group") or metadata.get("assetGroup") or self._resolve_asset_group(exchange, name, market_type))
            try:
                ingestion_service.ensure_symbol(
                    StockRegisterRequest(
                        symbol=symbol,
                        market_type=market_type,
                        asset_group=asset_group,
                    )
                )
            except Exception:
                logger.warning("on-demand symbol hydration failed for %s", symbol, exc_info=True)
        for symbol in missing_fundamental_symbols:
            metadata = metadata_by_symbol.get(symbol, {})
            exchange = str(metadata.get("exchange") or "")
            try:
                ingestion_service.ensure_symbol_fundamentals(symbol, exchange=exchange)
            except Exception:
                logger.warning("on-demand fundamental hydration failed for %s", symbol, exc_info=True)

    def _filter_market_scope(self, stock_metadata: pd.DataFrame, market_scope: str) -> pd.DataFrame:
        if stock_metadata.empty:
            return stock_metadata
        normalized_scope = (market_scope or "STRATEGY_DEFAULT").upper()
        if normalized_scope in {"STRATEGY_DEFAULT", "GLOBAL"}:
            return stock_metadata.reset_index(drop=True)
        exchange = stock_metadata["exchange"].fillna("").astype(str).str.upper()
        currency = stock_metadata["currency"].fillna("").astype(str).str.upper()
        if normalized_scope == "US":
            mask = exchange.apply(lambda value: any(token in value for token in self._US_EXCHANGE_TOKENS)) | (currency == "USD")
            return stock_metadata.loc[mask].reset_index(drop=True)
        if normalized_scope == "KOREA":
            mask = exchange.apply(lambda value: any(token in value for token in self._KOREA_EXCHANGE_TOKENS)) | (currency == "KRW")
            return stock_metadata.loc[mask].reset_index(drop=True)
        return stock_metadata.reset_index(drop=True)

    def _filter_sector_scope(self, stock_metadata: pd.DataFrame, sectors: list[str]) -> pd.DataFrame:
        if stock_metadata.empty or not sectors:
            return stock_metadata.iloc[0:0].copy() if not sectors else stock_metadata
        normalized = {
            (normalize_sector_label(sector) or str(sector or "").strip()).casefold()
            for sector in sectors
            if str(sector or "").strip()
        }
        return stock_metadata.loc[
            stock_metadata["sector"].fillna("").astype(str).str.casefold().isin(normalized)
        ].reset_index(drop=True)

    def _filter_theme_scope(self, stock_metadata: pd.DataFrame, themes: list[str]) -> pd.DataFrame:
        if stock_metadata.empty or not themes:
            return stock_metadata.iloc[0:0].copy() if not themes else stock_metadata

        def match_row(row: pd.Series) -> bool:
            text = " ".join(
                [
                    str(row.get("name") or ""),
                    str(row.get("sector") or ""),
                    str(row.get("industry") or ""),
                ]
            ).casefold()
            padded_text = f" {text} "
            for theme in themes:
                tokens = self._THEME_KEYWORDS.get(theme.casefold()) or self._THEME_KEYWORDS.get(theme) or ()
                if any(token.casefold() in padded_text for token in tokens):
                    return True
            return False

        mask = stock_metadata.apply(match_row, axis=1)
        return stock_metadata.loc[mask].reset_index(drop=True)

    def _resolve_portfolio_symbols(self, scope: UniverseScope) -> list[str]:
        if (scope.portfolio_source or "").upper() == "WATCHLIST":
            return self._normalize_symbols(self._WATCHLIST_PRESET_SYMBOLS.get(scope.portfolio_key or "", []))
        if scope.portfolio_id is None:
            return []
        positions = self.portfolio_repository.get_positions_frame(scope.portfolio_id)
        if positions.empty or "symbol" not in positions.columns:
            return []
        return self._normalize_symbols(positions["symbol"].astype(str).tolist())

    def resolve_universe_scope(self, scope: UniverseScope | None) -> ResolvedUniverseScope:
        resolved_scope = scope.model_copy(deep=True) if scope is not None else UniverseScope()
        if resolved_scope.override_mode != "ONE_TIME_OVERRIDE":
            return ResolvedUniverseScope(scope=resolved_scope, allowed_symbols=None)

        stock_metadata = self.stock_repository.get_metadata_frame()
        requested_asset_scope = self._normalize_asset_scope(resolved_scope.asset_scope)
        explicit_symbols = self._normalize_symbols([item.symbol for item in resolved_scope.selected_stocks])
        eligible_metadata = self._filter_eligible_metadata(
            stock_metadata,
            asset_scope=requested_asset_scope,
            preserve_symbols=explicit_symbols if resolved_scope.mode in {"SPECIFIC_STOCKS", "PORTFOLIO"} else None,
        )

        if resolved_scope.mode == "FULL_MARKET":
            if resolved_scope.market_scope == "STRATEGY_DEFAULT":
                return ResolvedUniverseScope(scope=resolved_scope, allowed_symbols=None)
            filtered = self._filter_market_scope(eligible_metadata, resolved_scope.market_scope)
            allowed_symbols = self._normalize_symbols(filtered["symbol"].astype(str).tolist()) if not filtered.empty else []
            resolved_scope.estimated_stock_count = len(allowed_symbols)
            return ResolvedUniverseScope(scope=resolved_scope, allowed_symbols=allowed_symbols)

        if resolved_scope.mode == "SPECIFIC_STOCKS":
            resolved_scope.estimated_stock_count = len(explicit_symbols)
            return ResolvedUniverseScope(scope=resolved_scope, allowed_symbols=explicit_symbols)

        if resolved_scope.mode == "SECTOR":
            selected_sectors = self._normalize_labels(resolved_scope.selected_sectors)
            resolved_scope.selected_sectors = selected_sectors
            filtered = self._filter_sector_scope(eligible_metadata, selected_sectors)
            allowed_symbols = self._normalize_symbols(filtered["symbol"].astype(str).tolist()) if not filtered.empty else []
            resolved_scope.estimated_stock_count = len(allowed_symbols)
            return ResolvedUniverseScope(scope=resolved_scope, allowed_symbols=allowed_symbols)

        if resolved_scope.mode == "THEME":
            selected_themes = self._normalize_labels(resolved_scope.selected_themes)
            resolved_scope.selected_themes = selected_themes
            filtered = self._filter_theme_scope(eligible_metadata, selected_themes)
            allowed_symbols = self._normalize_symbols(filtered["symbol"].astype(str).tolist()) if not filtered.empty else []
            resolved_scope.estimated_stock_count = len(allowed_symbols)
            return ResolvedUniverseScope(scope=resolved_scope, allowed_symbols=allowed_symbols)

        portfolio_symbols = self._resolve_portfolio_symbols(resolved_scope)
        resolved_scope.estimated_stock_count = len(portfolio_symbols)
        return ResolvedUniverseScope(scope=resolved_scope, allowed_symbols=portfolio_symbols)

    def prepare_universe_data(
        self,
        start_date: date | None,
        end_date: date,
        config: UniverseConfig | None = None,
    ) -> UniverseDataBundle:
        resolved_config = self._resolve_config(config)
        requested_symbols = self._normalize_symbols(resolved_config.allowed_symbols)
        lookback = max(resolved_config.min_history_days + 40, 320)
        history_anchor = start_date or end_date
        price_start_date = history_anchor - timedelta(days=max(lookback * 2, lookback))
        fundamentals_start_date = history_anchor - timedelta(days=540)
        stock_metadata = self.stock_repository.get_metadata_frame(symbols=requested_symbols or None)
        if requested_symbols and resolved_config.preserve_explicit_symbols:
            self._ensure_requested_symbol_data(requested_symbols, stock_metadata)
            stock_metadata = self.stock_repository.get_metadata_frame(symbols=requested_symbols or None)
        price_frame = self.price_repository.get_price_frame(
            end_date=end_date,
            symbols=requested_symbols or None,
            start_date=price_start_date,
            lookback_days=0,
        )
        fundamental_history = self.fundamental_repository.get_fundamental_history(
            end_date=end_date,
            symbols=requested_symbols or None,
            start_date=fundamentals_start_date,
        )
        if not price_frame.empty and "date" in price_frame.columns:
            price_frame = price_frame.copy()
            price_frame["date"] = pd.to_datetime(price_frame["date"])
            price_frame = price_frame.sort_values(["symbol", "date"]).reset_index(drop=True)
        if not fundamental_history.empty and "date" in fundamental_history.columns:
            fundamental_history = fundamental_history.copy()
            fundamental_history["date"] = pd.to_datetime(fundamental_history["date"])
            fundamental_history = fundamental_history.sort_values(["symbol", "date"]).reset_index(drop=True)
        return UniverseDataBundle(
            config=resolved_config,
            requested_symbols=requested_symbols,
            stock_metadata=stock_metadata,
            price_frame=price_frame,
            fundamental_history=fundamental_history,
        )

    def build_universe_from_data(
        self,
        as_of_date: date,
        data: UniverseDataBundle,
        config: UniverseConfig | None = None,
    ) -> tuple[list[str], pd.DataFrame, pd.DataFrame, pd.DataFrame]:
        resolved_config = self._resolve_config(config or data.config)
        as_of_timestamp = pd.Timestamp(as_of_date)
        lookback = max(resolved_config.min_history_days + 40, 320)
        price_start_timestamp = as_of_timestamp - pd.Timedelta(days=max(lookback * 2, lookback))
        fundamentals_start_timestamp = as_of_timestamp - pd.Timedelta(days=540)
        price_frame = (
            data.price_frame.loc[
                (data.price_frame["date"] >= price_start_timestamp)
                & (data.price_frame["date"] <= as_of_timestamp)
            ].copy()
            if not data.price_frame.empty
            else data.price_frame.copy()
        )
        fundamental_history = (
            data.fundamental_history.loc[
                (data.fundamental_history["date"] >= fundamentals_start_timestamp)
                & (data.fundamental_history["date"] <= as_of_timestamp)
            ].copy()
            if not data.fundamental_history.empty
            else data.fundamental_history.copy()
        )
        fundamental_frame = self._build_latest_fundamentals(fundamental_history, as_of_timestamp)
        stock_metadata = data.stock_metadata.copy()
        requested_symbols = data.requested_symbols
        allowed_symbols: list[str] = []
        if not stock_metadata.empty:
            eligible_metadata = self._filter_eligible_metadata(
                stock_metadata,
                asset_scope="ALL" if resolved_config.allowed_symbols is not None else "STOCK",
                preserve_symbols=requested_symbols if resolved_config.preserve_explicit_symbols else None,
            )
            allowed_symbols = eligible_metadata["symbol"].dropna().astype(str).drop_duplicates().tolist()

        if resolved_config.allowed_symbols is not None:
            if not requested_symbols:
                empty = price_frame.iloc[0:0].copy()
                empty_fundamental = fundamental_frame.iloc[0:0].copy()
                empty_history = fundamental_history.iloc[0:0].copy()
                return [], empty, empty_fundamental, empty_history
            requested_set = set(requested_symbols)
            if allowed_symbols:
                allowed_symbols = [symbol for symbol in allowed_symbols if str(symbol).upper() in requested_set]
            if resolved_config.preserve_explicit_symbols:
                allowed_symbols = list(dict.fromkeys([*allowed_symbols, *requested_symbols]))
            elif not allowed_symbols:
                allowed_symbols = requested_symbols.copy()

        if allowed_symbols:
            price_frame = self._filter_frame_by_symbols(price_frame, allowed_symbols)
            fundamental_frame = self._filter_frame_by_symbols(fundamental_frame, allowed_symbols)
            fundamental_history = self._filter_frame_by_symbols(fundamental_history, allowed_symbols)
            if not stock_metadata.empty:
                stock_metadata = stock_metadata[stock_metadata["symbol"].isin(allowed_symbols)].reset_index(drop=True)
        elif resolved_config.allowed_symbols is not None:
            empty = price_frame.iloc[0:0].copy()
            empty_fundamental = fundamental_frame.iloc[0:0].copy()
            empty_history = fundamental_history.iloc[0:0].copy()
            return [], empty, empty_fundamental, empty_history

        if price_frame.empty:
            return [], price_frame, fundamental_frame, fundamental_history

        latest_timestamp = price_frame["date"].max()
        price_frame = price_frame.sort_values(["symbol", "date"]).reset_index(drop=True)
        price_frame["adj_close_clean"] = pd.to_numeric(price_frame["adj_close"], errors="coerce").replace(0, pd.NA)
        price_frame["missing_flag"] = price_frame["adj_close_clean"].isna().astype("float64")
        price_frame["traded_value"] = (
            pd.to_numeric(price_frame["adj_close"], errors="coerce").fillna(0.0)
            * pd.to_numeric(price_frame["volume"], errors="coerce").fillna(0.0)
        )

        history_stats = price_frame.groupby("symbol", observed=True).agg(
            history_days=("date", "size"),
            missing_ratio=("missing_flag", "mean"),
            latest_date=("date", "max"),
        )
        recent_rows = price_frame.groupby("symbol", observed=True, group_keys=False).tail(20)
        recent_stats = recent_rows.groupby("symbol", observed=True).agg(
            avg_volume_20=("volume", "mean"),
            avg_traded_value_20=("traded_value", "mean"),
        )
        universe = history_stats.join(recent_stats, how="left").reset_index()
        if not fundamental_frame.empty and "market_cap" in fundamental_frame.columns:
            universe = universe.merge(fundamental_frame[["symbol", "market_cap"]], on="symbol", how="left")
        else:
            universe["market_cap"] = pd.NA
        if not stock_metadata.empty:
            universe = universe.merge(stock_metadata[["symbol", "name"]], on="symbol", how="left")
        if resolved_config.min_history_days > 0:
            universe = universe[universe["history_days"] >= resolved_config.min_history_days]
        if resolved_config.max_missing_ratio < 1:
            universe = universe[universe["missing_ratio"] <= resolved_config.max_missing_ratio]
        if resolved_config.min_avg_volume > 0:
            universe = universe[universe["avg_volume_20"] >= resolved_config.min_avg_volume]
        universe = universe[universe["avg_traded_value_20"] > 0]
        if resolved_config.min_market_cap > 0 and universe["market_cap"].notna().any():
            universe = universe[(universe["market_cap"].isna()) | (universe["market_cap"] >= resolved_config.min_market_cap)]
        universe = universe[(latest_timestamp - universe["latest_date"]).dt.days <= resolved_config.stale_after_days]
        eligible = universe["symbol"].drop_duplicates().tolist()
        return eligible, price_frame, fundamental_frame, fundamental_history

    def build_universe(self, as_of_date: date, config: UniverseConfig | None = None) -> tuple[list[str], pd.DataFrame, pd.DataFrame, pd.DataFrame]:
        prepared = self.prepare_universe_data(start_date=as_of_date, end_date=as_of_date, config=config)
        return self.build_universe_from_data(as_of_date, prepared, prepared.config)
