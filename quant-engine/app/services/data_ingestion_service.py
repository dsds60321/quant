from __future__ import annotations

import csv
import io
import json
import logging
import time
from datetime import date, timedelta, timezone
from html import unescape
from html.parser import HTMLParser

import pandas as pd
import requests
import yfinance as yf
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import utc_now
from app.models import Job
from app.exceptions import ExternalDependencyError, ValidationError
from app.repositories.benchmark_repository import BenchmarkRepository
from app.repositories.fundamental_repository import FundamentalRepository
from app.repositories.price_repository import PriceRepository
from app.repositories.stock_repository import StockRepository
from app.schemas.data import DataStatusResponse, DataUpdateRequest, DataUpdateResult, StockRegisterRequest, StockRegisterResponse, StockSearchResult
from app.schemas.common import JobSummary
from app.services.sec_company_facts_service import SecCompanyFactsService
from app.services.structured_event_service import StructuredEventService

logger = logging.getLogger(__name__)


class _SimpleHtmlTableParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.in_table = False
        self.in_row = False
        self.in_cell = False
        self.current_cell: list[str] = []
        self.current_row: list[str] = []
        self.rows: list[list[str]] = []

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag == "table" and not self.in_table:
            self.in_table = True
            return
        if not self.in_table:
            return
        if tag == "tr":
            self.in_row = True
            self.current_row = []
            return
        if self.in_row and tag in {"th", "td"}:
            self.in_cell = True
            self.current_cell = []

    def handle_data(self, data: str) -> None:
        if self.in_table and self.in_row and self.in_cell:
            self.current_cell.append(data)

    def handle_endtag(self, tag: str) -> None:
        if not self.in_table:
            return
        if self.in_row and tag in {"th", "td"} and self.in_cell:
            value = unescape("".join(self.current_cell)).strip()
            self.current_row.append(" ".join(value.split()))
            self.in_cell = False
            self.current_cell = []
            return
        if tag == "tr" and self.in_row:
            if any(cell for cell in self.current_row):
                self.rows.append(self.current_row[:])
            self.current_row = []
            self.in_row = False
            return
        if tag == "table":
            self.in_table = False

class DataIngestionService:
    etf_name_tokens = (
        "etf", "etn", "fund", "trust", "spdr", "ishares", "vanguard", "invesco", "wisdomtree",
        "proshares", "direxion", "global x", "first trust", "schwab", "ark", "kodex", "tiger",
        "arirang", "kbstar", "ace", "sol",
    )
    unsupported_security_name_tokens = (
        "warrant", "rights", "right", "unit", "units", "preferred", "preference", "depositary share",
        "depositary shares", "depository share", "depository shares",
    )
    default_benchmark_symbols = ["^GSPC", "^IXIC", "^KS11", "^KQ11"]
    download_retry_delays = (1, 2, 4)
    discovery_request_timeout = (5, 10)
    full_history_chunk_size = 150
    incremental_history_chunk_size = 200
    profile_enriched_history_chunk_size = 100
    fundamentals_refresh_chunk_size = 250
    benchmark_chunk_size = 25
    yahoo_market_suffixes = {
        "KS", "KQ", "TO", "AX", "HK", "SS", "SZ", "SI", "TW", "T", "L", "PA", "MI",
        "AS", "BR", "LS", "MC", "SW", "ST", "CO", "HE", "IC", "OL", "NZ",
    }
    yahoo_class_share_suffixes = {"A", "B", "C", "D", "V"}
    us_equity_exchanges = {"NASDAQ", "NYSE", "NYSE MKT", "NYSE ARCA", "AMEX", "IEX", "BATS", "CBOE", "UNKNOWN"}
    request_headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
        "Accept": "application/json,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,ko-KR;q=0.8,ko;q=0.7",
    }

    def __init__(self, session: Session) -> None:
        self.session = session
        self.price_repository = PriceRepository(session)
        self.fundamental_repository = FundamentalRepository(session)
        self.benchmark_repository = BenchmarkRepository(session)
        self.stock_repository = StockRepository(session)
        self.sec_company_facts_service = SecCompanyFactsService()
        self.structured_event_service = StructuredEventService(session)

    def _start_job(self, job_type: str, parent_job_id: int | None = None, metadata: dict | None = None) -> Job:
        job = Job(
            job_type=job_type,
            parent_job_id=parent_job_id,
            status="RUNNING",
            started_at=utc_now(),
            message="started",
            metadata_json=json.dumps(metadata or {}, ensure_ascii=False) if metadata is not None else None,
        )
        self.session.add(job)
        self.session.flush()
        return job

    def _finish_job(self, job: Job, status: str, message: str, metadata: dict | None = None) -> None:
        job.status = status
        job.message = message
        if metadata is not None:
            job.metadata_json = json.dumps(metadata, ensure_ascii=False)
        job.finished_at = utc_now()

    def _load_job_metadata(self, job: Job | None) -> dict:
        if job is None or not job.metadata_json:
            return {}
        if isinstance(job.metadata_json, dict):
            return job.metadata_json
        if isinstance(job.metadata_json, (bytes, bytearray)):
            try:
                return json.loads(job.metadata_json.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError):
                return {}
        try:
            return json.loads(job.metadata_json)
        except (TypeError, json.JSONDecodeError):
            return {}

    def _update_job_metadata(self, job: Job | None, metadata: dict, message: str | None = None) -> None:
        if job is None:
            return
        current = self._load_job_metadata(job)
        current.update(metadata)
        job.metadata_json = json.dumps(current, ensure_ascii=False)
        if message is not None:
            job.message = message
        self.session.flush()

    def _progress_percent(
        self,
        stage: str,
        processed_symbols: int,
        total_symbols: int,
        processed_benchmarks: int,
        total_benchmarks: int,
        has_discovery: bool,
    ) -> int:
        if stage == "preparing":
            return 1
        if stage == "listing_discovery":
            return 5 if has_discovery else 10
        if stage == "market_data":
            if total_symbols <= 0:
                return 85 if total_benchmarks > 0 else 95
            return min(85, 10 + int((processed_symbols / total_symbols) * 75))
        if stage == "fundamentals_sync":
            if total_symbols <= 0:
                return 99
            return min(99, 85 + int((processed_symbols / total_symbols) * 14))
        if stage == "benchmark_sync":
            if total_benchmarks <= 0:
                return 100
            return min(99, 85 + int((processed_benchmarks / total_benchmarks) * 15))
        if stage == "completed":
            return 100
        return 0

    def _update_dispatch_progress(
        self,
        parent_job_id: int | None,
        *,
        stage: str,
        stage_label: str,
        processed_symbols: int = 0,
        total_symbols: int = 0,
        processed_benchmarks: int = 0,
        total_benchmarks: int = 0,
        has_discovery: bool = False,
        message: str | None = None,
    ) -> None:
        if parent_job_id is None:
            return
        parent_job = self.session.get(Job, parent_job_id)
        if parent_job is None:
            return
        if stage == "market_data":
            processed_count = processed_symbols
            total_count = total_symbols
        elif stage == "benchmark_sync":
            processed_count = processed_benchmarks
            total_count = total_benchmarks
        else:
            processed_count = processed_symbols + processed_benchmarks
            total_count = total_symbols + total_benchmarks
        progress_percent = self._progress_percent(
            stage=stage,
            processed_symbols=processed_symbols,
            total_symbols=total_symbols,
            processed_benchmarks=processed_benchmarks,
            total_benchmarks=total_benchmarks,
            has_discovery=has_discovery,
        )
        self._update_job_metadata(
            parent_job,
            {
                "stage": stage,
                "stageLabel": stage_label,
                "progressPercent": progress_percent,
                "processedCount": processed_count,
                "totalCount": total_count,
                "symbolsProcessed": processed_symbols,
                "symbolsTotal": total_symbols,
                "benchmarksProcessed": processed_benchmarks,
                "benchmarksTotal": total_benchmarks,
            },
            message=message,
        )

    def _commit_checkpoint(self) -> None:
        # Long-running syncs should expose progress and committed rows incrementally.
        self.session.commit()

    @staticmethod
    def _is_rate_limited(error: Exception) -> bool:
        message = str(error)
        return "YFRateLimitError" in type(error).__name__ or "rate limit" in message.lower() or "too many requests" in message.lower()

    def _download_history(
        self,
        symbols: str | list[str],
        *,
        interval: str,
        auto_adjust: bool,
        period: str | None = None,
        start: date | None = None,
        end: date | None = None,
        group_by: str = "ticker",
    ) -> pd.DataFrame:
        last_error: Exception | None = None
        for attempt, delay_seconds in enumerate(self.download_retry_delays, start=1):
            try:
                return yf.download(
                    symbols,
                    period=period,
                    interval=interval,
                    start=start.isoformat() if start else None,
                    end=end.isoformat() if end else None,
                    group_by=group_by,
                    auto_adjust=auto_adjust,
                    progress=False,
                    threads=False,
                )
            except Exception as exc:
                last_error = exc
                if not self._is_rate_limited(exc) or attempt == len(self.download_retry_delays):
                    break
                logger.warning("yfinance rate limit detected for %s, retry=%s", symbols, attempt, exc_info=True)
                time.sleep(delay_seconds)
        if last_error is not None:
            raise last_error
        return pd.DataFrame()

    @staticmethod
    def _build_price_rows(symbol: str, frame: pd.DataFrame) -> list[dict]:
        rows: list[dict] = []
        for idx, row in frame.iterrows():
            open_value = DataIngestionService._coerce_scalar(row.get("Open", 0))
            high_value = DataIngestionService._coerce_scalar(row.get("High", 0))
            low_value = DataIngestionService._coerce_scalar(row.get("Low", 0))
            close_value = DataIngestionService._coerce_scalar(row.get("Close", 0))
            adj_close_value = DataIngestionService._coerce_scalar(row.get("Adj Close", close_value), close_value)
            volume_value = DataIngestionService._coerce_scalar(row.get("Volume", 0))
            rows.append(
                {
                    "symbol": symbol,
                    "date": pd.Timestamp(idx).date(),
                    "open": float(open_value),
                    "high": float(high_value),
                    "low": float(low_value),
                    "close": float(close_value),
                    "adj_close": float(adj_close_value),
                    "volume": int(volume_value or 0),
                }
            )
        return rows

    def _resolve_price_download_groups(self, symbols: list[str], request: DataUpdateRequest) -> list[dict]:
        if not symbols:
            return []

        preset = (request.preset or "strategy_core_equities").lower()
        if preset == "fundamentals_only":
            return [{"symbols": symbols, "label": "fundamentals_only"}]
        if request.symbols:
            return [{"symbols": symbols, "period": request.period, "label": "full"}]

        latest_price_dates = self.price_repository.get_latest_price_dates(symbols)
        download_groups: list[dict] = []
        new_symbols: list[str] = []
        incremental_groups: dict[date, list[str]] = {}

        for symbol in symbols:
            latest_price_date = latest_price_dates.get(symbol)
            if latest_price_date is None:
                new_symbols.append(symbol)
                continue
            incremental_groups.setdefault(latest_price_date, []).append(symbol)

        if new_symbols and preset == "missing_only":
            download_groups.append({"symbols": new_symbols, "period": request.period, "label": "full"})
            logger.info("backfilling missing price history symbols=%s preset=%s", len(new_symbols), preset)
            return download_groups

        if new_symbols:
            if preset == "full" and latest_price_dates:
                logger.info(
                    "skipping historical backfill for symbols without price history symbols=%s preset=%s",
                    len(new_symbols),
                    preset,
                )
            else:
                download_groups.append({"symbols": new_symbols, "period": request.period, "label": "full"})

        for latest_price_date, group_symbols in sorted(incremental_groups.items(), key=lambda item: item[0]):
            download_groups.append(
                {
                    "symbols": group_symbols,
                    "start": latest_price_date - timedelta(days=7),
                    "end": date.today() + timedelta(days=1),
                    "label": "fundamentals_only" if preset == "fundamentals_only" else "incremental",
                }
            )
        return download_groups

    @staticmethod
    def _is_fundamentals_only_request(request: DataUpdateRequest) -> bool:
        return (request.preset or "").lower() == "fundamentals_only"

    def _resolve_benchmark_download_groups(self, benchmark_symbols: list[str], request: DataUpdateRequest) -> list[dict]:
        if not benchmark_symbols:
            return []

        if request.benchmark_symbols:
            return [{"symbols": benchmark_symbols, "period": request.period, "label": "full"}]

        latest_benchmark_dates = self.benchmark_repository.get_latest_dates(benchmark_symbols)
        download_groups: list[dict] = []
        new_symbols: list[str] = []
        incremental_groups: dict[date, list[str]] = {}

        for symbol in benchmark_symbols:
            latest_benchmark_date = latest_benchmark_dates.get(symbol)
            if latest_benchmark_date is None:
                new_symbols.append(symbol)
                continue
            incremental_groups.setdefault(latest_benchmark_date, []).append(symbol)

        if new_symbols:
            download_groups.append({"symbols": new_symbols, "period": request.period, "label": "full"})

        for latest_benchmark_date, group_symbols in sorted(incremental_groups.items(), key=lambda item: item[0]):
            download_groups.append(
                {
                    "symbols": group_symbols,
                    "start": latest_benchmark_date - timedelta(days=7),
                    "end": date.today() + timedelta(days=1),
                    "label": "incremental",
                }
            )
        return download_groups

    def _resolve_market_chunk_size(self, group: dict, should_fetch_profiles: bool) -> int:
        if group.get("label") == "fundamentals_only":
            return self.fundamentals_refresh_chunk_size
        if should_fetch_profiles:
            return self.profile_enriched_history_chunk_size
        if group.get("label") == "incremental":
            return self.incremental_history_chunk_size
        return self.full_history_chunk_size

    def _extract_history_frame(self, raw: pd.DataFrame, symbol: str) -> pd.DataFrame:
        if raw.empty:
            return pd.DataFrame()

        if isinstance(raw.columns, pd.MultiIndex):
            for level in range(raw.columns.nlevels):
                if symbol not in raw.columns.get_level_values(level):
                    continue
                try:
                    frame = raw.xs(symbol, axis=1, level=level)
                except Exception:
                    continue
                if isinstance(frame, pd.Series):
                    frame = frame.to_frame()
                return self._normalize_history_columns(frame).dropna(how="all")
            return pd.DataFrame()

        return raw.copy().dropna(how="all")

    @staticmethod
    def _coerce_scalar(value, default: float | int = 0):
        if isinstance(value, pd.Series):
            non_null = value.dropna()
            if non_null.empty:
                return default
            return non_null.iloc[0]
        return default if pd.isna(value) else value

    @staticmethod
    def _normalize_history_columns(frame: pd.DataFrame) -> pd.DataFrame:
        if frame.empty or not isinstance(frame.columns, pd.MultiIndex):
            return frame

        normalized = frame.copy()
        columns = normalized.columns
        price_fields = {"Open", "High", "Low", "Close", "Adj Close", "Volume"}

        for level in range(columns.nlevels):
            level_values = pd.Index(columns.get_level_values(level))
            if "Close" in level_values and level_values.is_unique:
                normalized.columns = level_values
                return normalized

        normalized.columns = [
            next(
                (part for part in column if part in price_fields),
                next((part for part in reversed(column) if part), column[-1]),
            )
            if isinstance(column, tuple)
            else column
            for column in columns.to_flat_index()
        ]
        return normalized

    def _prepare_price_history_frame(self, frame: pd.DataFrame) -> pd.DataFrame:
        if frame.empty:
            return pd.DataFrame()

        normalized = self._normalize_history_columns(frame).dropna(how="all")
        if normalized.empty or "Close" not in normalized.columns:
            return pd.DataFrame()
        return normalized.dropna(subset=["Close"])

    def _extract_close_series(self, history: pd.DataFrame, symbol: str) -> pd.Series:
        if history.empty:
            return pd.Series(dtype=float)

        normalized = self._normalize_history_columns(history).dropna(how="all")
        close_data = normalized.get("Close")
        if close_data is None:
            return pd.Series(dtype=float)

        if isinstance(close_data, pd.DataFrame):
            if symbol in close_data.columns:
                return close_data[symbol].dropna()
            if close_data.shape[1] == 1:
                return close_data.iloc[:, 0].dropna()
            return pd.Series(dtype=float)

        return close_data.dropna()

    def _build_symbol_candidates(self, symbol: str, market_type: str | None, asset_group: str | None) -> list[str]:
        normalized = symbol.strip().upper()
        if not normalized:
            return []
        if "." in normalized or normalized.startswith("^"):
            return [normalized]

        candidates = [normalized]
        if market_type == "DOMESTIC" and normalized.isdigit():
            if asset_group == "KOSDAQ":
                candidates = [f"{normalized}.KQ", normalized]
            elif asset_group in {"KOSPI", "ETF"}:
                candidates = [f"{normalized}.KS", normalized]
            else:
                candidates = [f"{normalized}.KS", f"{normalized}.KQ", normalized]

        seen: set[str] = set()
        ordered: list[str] = []
        for item in candidates:
            if item not in seen:
                seen.add(item)
                ordered.append(item)
        return ordered

    def _resolve_market_type(self, exchange: str) -> str:
        return "DOMESTIC" if exchange.lower() in {"kospi", "kosdaq", "krx", "xkrx", "kse", "ksq"} else "INTERNATIONAL"

    def _resolve_asset_group(self, exchange: str, name: str, market_type: str) -> str:
        normalized_name = name.lower()
        if any(token in normalized_name for token in self.etf_name_tokens):
            return "ETF"
        if market_type == "DOMESTIC" and exchange.lower() in {"kosdaq", "ksq"}:
            return "KOSDAQ"
        if market_type == "DOMESTIC":
            return "KOSPI"
        return "STOCK"

    def _normalize_exchange_label(self, exchange: str | None, symbol: str) -> str:
        normalized_exchange = (exchange or "").strip()
        upper_exchange = normalized_exchange.upper()
        upper_symbol = symbol.upper()
        if upper_symbol.endswith(".KS") or upper_exchange in {"KOE", "KSC", "KOSPI", "KRX", "XKRX", "KSE"}:
            return "KOSPI"
        if upper_symbol.endswith(".KQ") or upper_exchange in {"KOSDAQ", "KSQ"}:
            return "KOSDAQ"
        if upper_exchange in {"NMS", "NGM", "NASDAQ", "NAS"}:
            return "NASDAQ"
        if upper_exchange in {"NYQ", "NYSE"}:
            return "NYSE"
        return normalized_exchange or "UNKNOWN"

    def _build_stock_row(self, symbol: str, info: dict, profile: dict) -> dict:
        return {
            "symbol": symbol,
            "name": profile.get("shortName") or profile.get("longName") or info.get("shortName") or symbol,
            "exchange": self._normalize_exchange_label(profile.get("exchange") or info.get("exchange"), symbol),
            "sector": profile.get("sector"),
            "industry": profile.get("industry"),
            "currency": profile.get("currency") or info.get("currency") or "USD",
            "market_cap": info.get("market_cap") or profile.get("marketCap"),
        }

    def _normalize_percentage(self, value: float | int | None) -> float | None:
        if value is None:
            return None
        numeric = float(value)
        if -5 <= numeric <= 5:
            return numeric * 100
        return numeric

    def _get_fundamental_value(self, info: dict, profile: dict, *keys: str):
        for key in keys:
            if key in info and info.get(key) is not None:
                return info.get(key)
            if key in profile and profile.get(key) is not None:
                return profile.get(key)
        return None

    def _is_etf_instrument(self, symbol: str, name: str | None) -> bool:
        normalized_symbol = symbol.upper()
        normalized_name = (name or "").lower()
        if normalized_symbol.startswith("^"):
            return False
        return any(token in normalized_name for token in self.etf_name_tokens)

    def _is_supported_sync_symbol(self, symbol: str, name: str | None) -> bool:
        normalized_symbol = symbol.upper()
        normalized_name = (name or "").lower()
        if not normalized_symbol or normalized_symbol.startswith("^"):
            return False
        if "$" in normalized_symbol:
            return False
        if any(normalized_symbol.endswith(suffix) for suffix in (".U", ".WS", ".W", ".RT", ".R")):
            return False
        return not any(token in normalized_name for token in self.unsupported_security_name_tokens)

    def _resolve_symbols_from_stock_data(self, preset: str) -> list[str]:
        metadata = self.stock_repository.get_metadata_frame()
        if metadata.empty:
            return []

        if preset == "strategy_core_equities":
            filtered = metadata[
                metadata.apply(
                    lambda row: self._is_supported_sync_symbol(str(row["symbol"]), row.get("name"))
                    and not self._is_etf_instrument(str(row["symbol"]), row.get("name")),
                    axis=1,
                )
            ]
        elif preset == "etf_universe":
            filtered = metadata[
                metadata.apply(
                    lambda row: self._is_supported_sync_symbol(str(row["symbol"]), row.get("name"))
                    and self._is_etf_instrument(str(row["symbol"]), row.get("name")),
                    axis=1,
                )
            ]
        elif preset == "full":
            filtered = metadata[
                metadata.apply(
                    lambda row: self._is_supported_sync_symbol(str(row["symbol"]), row.get("name")),
                    axis=1,
                )
            ]
        else:
            filtered = metadata.iloc[0:0]

        return filtered["symbol"].dropna().astype(str).drop_duplicates().tolist()

    def _to_yahoo_symbol(self, symbol: str, exchange: str | None = None) -> str:
        normalized_symbol = str(symbol or "").strip().upper()
        if "." not in normalized_symbol:
            return normalized_symbol

        base, suffix = normalized_symbol.rsplit(".", 1)
        normalized_exchange = (exchange or "").strip().upper()
        normalized_suffix = suffix.upper()

        if not base or base.isdigit():
            return normalized_symbol
        if normalized_suffix in self.yahoo_market_suffixes and normalized_exchange not in self.us_equity_exchanges:
            return normalized_symbol
        if normalized_suffix in self.yahoo_class_share_suffixes:
            return f"{base}-{normalized_suffix}"
        if len(normalized_suffix) <= 2 and normalized_suffix.isalpha() and normalized_exchange in self.us_equity_exchanges:
            return f"{base}-{normalized_suffix}"
        return normalized_symbol

    def _discover_us_equities(self) -> list[dict]:
        discovered: list[dict] = []
        sources = (
            ("https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt", "NASDAQ"),
            ("https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt", None),
        )
        for url, fixed_exchange in sources:
            started_at = time.monotonic()
            count_before = len(discovered)
            logger.info("us equity discovery started source=%s", url)
            try:
                response = requests.get(url, headers=self.request_headers, timeout=self.discovery_request_timeout)
                response.raise_for_status()
                reader = csv.DictReader(io.StringIO(response.text), delimiter="|")
                for row in reader:
                    if not row:
                        continue
                    symbol = str(row.get("Symbol") or row.get("ACT Symbol") or "").strip().upper()
                    if not symbol or symbol.startswith("FILE CREATION TIME"):
                        continue
                    name = str(row.get("Security Name") or symbol).strip() or symbol
                    if not self._is_supported_sync_symbol(symbol, name):
                        continue
                    exchange_code = str(row.get("Exchange") or "").strip().upper()
                    exchange = fixed_exchange
                    if exchange is None:
                        exchange = {
                            "A": "NYSE MKT",
                            "N": "NYSE",
                            "P": "NYSE ARCA",
                            "Q": "NASDAQ",
                            "V": "IEX",
                            "Z": "BATS",
                        }.get(exchange_code, "UNKNOWN")
                    discovered.append(
                        {
                            "symbol": symbol,
                            "name": name,
                            "exchange": self._normalize_exchange_label(exchange, symbol),
                            "sector": None,
                            "industry": None,
                            "currency": "USD",
                            "market_cap": None,
                        }
                    )
            except Exception:
                logger.warning("us equity discovery failed for %s", url, exc_info=True)
            finally:
                logger.info(
                    "us equity discovery finished source=%s discovered=%s duration_ms=%s",
                    url,
                    len(discovered) - count_before,
                    int((time.monotonic() - started_at) * 1000),
                )
        return discovered

    def _parse_html_table(self, html: str) -> list[dict[str, str]]:
        parser = _SimpleHtmlTableParser()
        parser.feed(html)
        rows = [row for row in parser.rows if row]
        if len(rows) < 2:
            return []
        header = rows[0]
        records: list[dict[str, str]] = []
        for row in rows[1:]:
            if len(row) != len(header):
                continue
            records.append({header[index]: value for index, value in enumerate(row)})
        return records

    def _discover_kr_equities(self) -> list[dict]:
        discovered: list[dict] = []
        market_requests = (
            ("stockMkt", ".KS", "KOSPI"),
            ("kosdaqMkt", ".KQ", "KOSDAQ"),
        )
        for market_type, suffix, exchange in market_requests:
            started_at = time.monotonic()
            count_before = len(discovered)
            logger.info("kr equity discovery started market_type=%s", market_type)
            try:
                response = requests.get(
                    f"https://kind.krx.co.kr/corpgeneral/corpList.do?method=download&searchType=13&marketType={market_type}",
                    headers=self.request_headers,
                    timeout=self.discovery_request_timeout,
                )
                response.raise_for_status()
                response.encoding = response.apparent_encoding or response.encoding
                rows = self._parse_html_table(response.text)
            except Exception:
                logger.warning("kr equity discovery failed for %s", market_type, exc_info=True)
                logger.info(
                    "kr equity discovery finished market_type=%s discovered=%s duration_ms=%s",
                    market_type,
                    0,
                    int((time.monotonic() - started_at) * 1000),
                )
                continue

            if not rows:
                logger.info(
                    "kr equity discovery finished market_type=%s discovered=%s duration_ms=%s",
                    market_type,
                    0,
                    int((time.monotonic() - started_at) * 1000),
                )
                continue

            for row in rows:
                raw_code = str(row.get("종목코드") or "").strip()
                if not raw_code:
                    continue
                code = raw_code.zfill(6)
                name = str(row.get("회사명") or code).strip() or code
                if not self._is_supported_sync_symbol(f"{code}{suffix}", name):
                    continue
                discovered.append(
                    {
                        "symbol": f"{code}{suffix}",
                        "name": name,
                        "exchange": exchange,
                        "sector": None,
                        "industry": None,
                        "currency": "KRW",
                        "market_cap": None,
                    }
                )
            logger.info(
                "kr equity discovery finished market_type=%s discovered=%s duration_ms=%s",
                market_type,
                len(discovered) - count_before,
                int((time.monotonic() - started_at) * 1000),
            )
        return discovered

    def _discover_equity_universe(self) -> list[dict]:
        started_at = time.monotonic()
        logger.info("equity universe discovery started")
        discovered = self._discover_us_equities() + self._discover_kr_equities()
        ordered: list[dict] = []
        seen: set[str] = set()
        for row in discovered:
            symbol = str(row.get("symbol") or "").strip().upper()
            if not symbol or symbol in seen:
                continue
            seen.add(symbol)
            ordered.append({**row, "symbol": symbol})
        logger.info(
            "equity universe discovery finished discovered=%s duration_ms=%s",
            len(ordered),
            int((time.monotonic() - started_at) * 1000),
        )
        return ordered

    def _matches_filters(self, market_type: str | None, asset_group: str | None, exchange: str, name: str, resolved_market_type: str, resolved_asset_group: str) -> bool:
        if market_type and market_type != resolved_market_type:
            return False

        if asset_group:
            if asset_group == "STOCK":
                return resolved_asset_group == "STOCK"
            return asset_group == resolved_asset_group

        return True

    def search_symbols(self, query: str, market_type: str | None, asset_group: str | None, limit: int = 20) -> list[StockSearchResult]:
        normalized_query = query.strip()
        if not normalized_query:
            return []

        results: list[StockSearchResult] = []
        seen: set[str] = set()

        metadata = self.stock_repository.get_metadata_frame()
        if not metadata.empty:
            lowered_query = normalized_query.lower()
            matches = metadata[
                metadata["symbol"].astype(str).str.lower().str.contains(lowered_query, na=False)
                | metadata["name"].astype(str).str.lower().str.contains(lowered_query, na=False)
            ].copy()
            if not matches.empty:
                matches = matches.sort_values(by=["market_cap", "symbol"], ascending=[False, True], na_position="last")
                for _, row in matches.iterrows():
                    symbol = str(row["symbol"])
                    name = str(row["name"])
                    exchange = self._normalize_exchange_label(row.get("exchange"), symbol)
                    resolved_market_type = self._resolve_market_type(exchange)
                    resolved_asset_group = self._resolve_asset_group(exchange, name, resolved_market_type)
                    if not self._matches_filters(market_type, asset_group, exchange, name, resolved_market_type, resolved_asset_group):
                        continue
                    results.append(
                        StockSearchResult(
                            symbol=symbol,
                            name=name,
                            exchange=exchange,
                            market_type=resolved_market_type,
                            asset_group=resolved_asset_group,
                            currency=str(row.get("currency") or "USD"),
                            market_cap=float(row["market_cap"]) if row.get("market_cap") is not None and pd.notna(row.get("market_cap")) else None,
                        )
                    )
                    seen.add(symbol)
                    if len(results) >= limit:
                        return results

        try:
            search = yf.Search(normalized_query, max_results=max(limit * 3, 10))
            quotes = getattr(search, "quotes", []) or []
        except Exception:
            logger.warning("external symbol search failed for %s", normalized_query, exc_info=True)
            quotes = []

        for quote in quotes:
            symbol = str(quote.get("symbol") or "").strip().upper()
            if not symbol or symbol in seen:
                continue

            quote_type = str(quote.get("quoteType") or "").upper()
            if quote_type not in {"EQUITY", "ETF"}:
                continue

            name = str(quote.get("longname") or quote.get("shortname") or symbol)
            exchange = self._normalize_exchange_label(quote.get("exchDisp") or quote.get("exchange"), symbol)
            resolved_market_type = self._resolve_market_type(exchange)
            resolved_asset_group = "ETF" if quote_type == "ETF" else self._resolve_asset_group(exchange, name, resolved_market_type)
            if not self._matches_filters(market_type, asset_group, exchange, name, resolved_market_type, resolved_asset_group):
                continue

            results.append(
                StockSearchResult(
                    symbol=symbol,
                    name=name,
                    exchange=exchange,
                    market_type=resolved_market_type,
                    asset_group=resolved_asset_group,
                    currency="KRW" if resolved_market_type == "DOMESTIC" else "USD",
                    market_cap=None,
                )
            )
            seen.add(symbol)
            if len(results) >= limit:
                break

        return results

    def _statement_series(self, statement: pd.DataFrame | None, *row_candidates: str) -> pd.Series:
        if statement is None or statement.empty:
            return pd.Series(dtype=float)
        frame = statement.copy()
        valid_columns = [column for column in frame.columns if pd.notna(pd.to_datetime(column, errors="coerce"))]
        if not valid_columns:
            return pd.Series(dtype=float)
        frame = frame[valid_columns]
        frame.columns = pd.to_datetime(frame.columns)

        normalized_index = {str(index).strip().lower(): index for index in frame.index}
        selected_index = None
        for candidate in row_candidates:
            if candidate.lower() in normalized_index:
                selected_index = normalized_index[candidate.lower()]
                break
        if selected_index is None:
            for candidate in row_candidates:
                selected_index = next(
                    (
                        original_index
                        for normalized, original_index in normalized_index.items()
                        if candidate.lower() in normalized
                    ),
                    None,
                )
                if selected_index is not None:
                    break
        if selected_index is None:
            return pd.Series(dtype=float)

        series = pd.to_numeric(frame.loc[selected_index], errors="coerce").dropna()
        if series.empty:
            return pd.Series(dtype=float)
        series.index = pd.to_datetime(series.index)
        return series.sort_index()

    def _close_price_as_of(self, history: pd.DataFrame, as_of_date: pd.Timestamp) -> float | None:
        if history.empty or "Close" not in history.columns:
            return None
        close_series = history["Close"].copy()
        close_series.index = pd.to_datetime(close_series.index)
        eligible = close_series.loc[close_series.index <= as_of_date].dropna()
        if eligible.empty:
            return None
        return float(eligible.iloc[-1])

    def _build_fundamental_rows(self, symbol: str, history: pd.DataFrame, info: dict, profile: dict, ticker: yf.Ticker) -> list[dict]:
        rows_by_date: dict[pd.Timestamp, dict] = {}
        shares_outstanding = self._get_fundamental_value(info, profile, "sharesOutstanding", "shares_outstanding")
        shares_outstanding = float(shares_outstanding) if shares_outstanding not in (None, 0) else None

        quarterly_income_stmt = getattr(ticker, "quarterly_income_stmt", pd.DataFrame())
        quarterly_balance_sheet = getattr(ticker, "quarterly_balance_sheet", pd.DataFrame())

        revenue_series = self._statement_series(quarterly_income_stmt, "Total Revenue", "Operating Revenue", "Revenue")
        net_income_series = self._statement_series(quarterly_income_stmt, "Net Income", "Net Income Common Stockholders")
        eps_series = self._statement_series(quarterly_income_stmt, "Diluted EPS", "Basic EPS")
        equity_series = self._statement_series(quarterly_balance_sheet, "Stockholders Equity", "Total Stockholder Equity", "Common Stock Equity")

        report_dates = sorted(
            set(revenue_series.index.tolist())
            | set(net_income_series.index.tolist())
            | set(eps_series.index.tolist())
            | set(equity_series.index.tolist())
        )

        for report_date in report_dates:
            revenue = float(revenue_series.get(report_date)) if report_date in revenue_series.index else None
            net_income = float(net_income_series.get(report_date)) if report_date in net_income_series.index else None
            equity = float(equity_series.get(report_date)) if report_date in equity_series.index else None
            eps = float(eps_series.get(report_date)) if report_date in eps_series.index else None
            close_price = self._close_price_as_of(history, report_date)

            if eps in (None, 0) and shares_outstanding and net_income is not None:
                eps = net_income / shares_outstanding

            per = None
            if close_price is not None and eps not in (None, 0) and eps > 0:
                per = close_price / eps

            pbr = None
            market_cap = None
            if close_price is not None and shares_outstanding:
                market_cap = close_price * shares_outstanding
                if equity not in (None, 0):
                    book_value_per_share = equity / shares_outstanding
                    if book_value_per_share > 0:
                        pbr = close_price / book_value_per_share

            roe = None
            if net_income is not None and equity not in (None, 0):
                roe = (net_income * 4 / equity) * 100

            rows_by_date[report_date.normalize()] = {
                "symbol": symbol,
                "date": report_date.date(),
                "per": per,
                "pbr": pbr,
                "roe": roe,
                "eps": eps,
                "dividend_yield": self._get_fundamental_value(info, profile, "dividendYield", "dividend_yield"),
                "market_cap": market_cap,
                "revenue": revenue,
                "net_income": net_income,
            }

        latest_snapshot_date = pd.Timestamp.utcnow().normalize()
        rows_by_date[latest_snapshot_date] = {
            "symbol": symbol,
            "date": latest_snapshot_date.date(),
            "per": self._get_fundamental_value(info, profile, "trailingPE", "trailing_pe", "forwardPE", "forward_pe"),
            "pbr": self._get_fundamental_value(info, profile, "priceToBook", "price_to_book"),
            "roe": self._normalize_percentage(self._get_fundamental_value(info, profile, "returnOnEquity", "return_on_equity")),
            "eps": self._get_fundamental_value(info, profile, "trailingEps", "trailing_eps"),
            "dividend_yield": self._get_fundamental_value(info, profile, "dividendYield", "dividend_yield"),
            "market_cap": self._get_fundamental_value(info, profile, "marketCap", "market_cap"),
            "revenue": self._get_fundamental_value(info, profile, "totalRevenue", "total_revenue"),
            "net_income": self._get_fundamental_value(info, profile, "netIncomeToCommon", "net_income_to_common"),
        }
        return sorted(rows_by_date.values(), key=lambda item: item["date"])

    @staticmethod
    def _empty_history_frame() -> pd.DataFrame:
        return pd.DataFrame(columns=["Open", "High", "Low", "Close", "Adj Close", "Volume"])

    def _load_price_histories_from_db(self, symbols: list[str]) -> dict[str, pd.DataFrame]:
        if not symbols:
            return {}
        frame = self.price_repository.get_price_frame(end_date=date.today(), lookback_days=0, symbols=symbols)
        if frame.empty:
            return {}
        frame["date"] = pd.to_datetime(frame["date"])
        histories: dict[str, pd.DataFrame] = {}
        for symbol, group in frame.groupby("symbol"):
            history = group.sort_values("date").set_index("date").rename(
                columns={
                    "open": "Open",
                    "high": "High",
                    "low": "Low",
                    "close": "Close",
                    "adj_close": "Adj Close",
                    "volume": "Volume",
                }
            )
            histories[str(symbol)] = history[["Open", "High", "Low", "Close", "Adj Close", "Volume"]]
        return histories

    def _fetch_yahoo_profile(self, ticker: yf.Ticker, symbol: str) -> tuple[dict, dict]:
        try:
            profile = dict(ticker.info or {})
        except Exception:
            logger.warning("ticker info fetch failed for %s", symbol, exc_info=True)
            profile = {}
        info = {
            "market_cap": profile.get("marketCap"),
            "currency": profile.get("currency"),
            "exchange": profile.get("exchange"),
            "shortName": profile.get("shortName"),
        }
        return info, profile

    def _merge_snapshot_fundamentals(self, rows: list[dict], info: dict, profile: dict) -> list[dict]:
        if not rows:
            return rows
        latest_row = max(rows, key=lambda item: item["date"])
        latest_row["per"] = latest_row.get("per") if latest_row.get("per") is not None else (
            profile.get("trailingPE") or profile.get("forwardPE") or info.get("trailing_pe")
        )
        latest_row["pbr"] = latest_row.get("pbr") if latest_row.get("pbr") is not None else profile.get("priceToBook")
        latest_row["roe"] = latest_row.get("roe") if latest_row.get("roe") is not None else self._normalize_percentage(
            profile.get("returnOnEquity")
        )
        latest_row["eps"] = latest_row.get("eps") if latest_row.get("eps") is not None else profile.get("trailingEps")
        latest_row["dividend_yield"] = latest_row.get("dividend_yield") if latest_row.get("dividend_yield") is not None else profile.get("dividendYield")
        latest_row["market_cap"] = latest_row.get("market_cap") if latest_row.get("market_cap") is not None else (
            profile.get("marketCap") or info.get("market_cap")
        )
        latest_row["revenue"] = latest_row.get("revenue") if latest_row.get("revenue") is not None else profile.get("totalRevenue")
        latest_row["net_income"] = latest_row.get("net_income") if latest_row.get("net_income") is not None else profile.get("netIncomeToCommon")
        return rows

    def _resolve_request_symbols(self, request: DataUpdateRequest, parent_job_id: int | None = None) -> tuple[list[str], list[str], list[dict]]:
        discovered_stock_rows: list[dict] = []
        preset = (request.preset or "strategy_core_equities").lower()
        if request.symbols:
            symbols = request.symbols
        else:
            if preset == "strategy_core_equities":
                existing_symbols = self._resolve_symbols_from_stock_data(preset)
                if existing_symbols:
                    logger.info("reusing existing strategy equity universe symbols=%s", len(existing_symbols))
                    symbols = existing_symbols
                else:
                    self._update_dispatch_progress(
                        parent_job_id,
                        stage="listing_discovery",
                        stage_label="심볼 발견",
                        has_discovery=True,
                        message="전략 주식 심볼 목록을 외부 소스에서 수집하는 중입니다.",
                    )
                    discovered_stock_rows = self._discover_equity_universe()
                    discovered_symbols = [row["symbol"] for row in discovered_stock_rows]
                    symbols = discovered_symbols
            elif preset == "etf_universe":
                symbols = self._resolve_symbols_from_stock_data(preset)
            elif preset == "benchmark_only":
                symbols = []
            elif preset == "full":
                existing_symbols = self._resolve_symbols_from_stock_data(preset)
                if existing_symbols:
                    existing_price_symbols = set(self.price_repository.get_symbols(existing_symbols))
                    if existing_price_symbols:
                        symbols = [symbol for symbol in existing_symbols if symbol in existing_price_symbols]
                        logger.info(
                            "reusing existing full universe price-backed symbols=%s skipped_without_price_history=%s",
                            len(symbols),
                            len(existing_symbols) - len(symbols),
                        )
                    else:
                        logger.info("reusing existing full universe symbols=%s", len(existing_symbols))
                        symbols = existing_symbols
                else:
                    self._update_dispatch_progress(
                        parent_job_id,
                        stage="listing_discovery",
                        stage_label="심볼 발견",
                        has_discovery=True,
                        message="전체 상장 심볼 목록을 외부 소스에서 수집하는 중입니다.",
                    )
                    discovered_stock_rows = self._discover_equity_universe()
                    discovered_symbols = [row["symbol"] for row in discovered_stock_rows]
                    symbols = list(dict.fromkeys([*existing_symbols, *discovered_symbols])) or existing_symbols
            elif preset == "missing_only":
                existing_symbols = self._resolve_symbols_from_stock_data("full")
                if existing_symbols:
                    existing_price_symbols = set(self.price_repository.get_symbols(existing_symbols))
                    symbols = [symbol for symbol in existing_symbols if symbol not in existing_price_symbols]
                    logger.info(
                        "resolved missing-only symbols=%s already_price_backed=%s",
                        len(symbols),
                        len(existing_price_symbols),
                    )
                else:
                    self._update_dispatch_progress(
                        parent_job_id,
                        stage="listing_discovery",
                        stage_label="심볼 발견",
                        has_discovery=True,
                        message="누락 가격 이력 심볼 목록을 외부 소스에서 수집하는 중입니다.",
                    )
                    discovered_stock_rows = self._discover_equity_universe()
                    discovered_symbols = [row["symbol"] for row in discovered_stock_rows]
                    symbols = discovered_symbols
            elif preset == "fundamentals_only":
                existing_symbols = self._resolve_symbols_from_stock_data("full")
                if existing_symbols:
                    existing_price_symbols = set(self.price_repository.get_symbols(existing_symbols))
                    symbols = [symbol for symbol in existing_symbols if symbol in existing_price_symbols]
                    logger.info(
                        "resolved fundamentals-only symbols=%s skipped_without_price_history=%s",
                        len(symbols),
                        len(existing_symbols) - len(symbols),
                    )
                else:
                    symbols = []
            else:
                symbols = self._resolve_symbols_from_stock_data("strategy_core_equities")

        if preset == "fundamentals_only":
            benchmark_symbols = []
        else:
            benchmark_symbols = request.benchmark_symbols or self.benchmark_repository.get_symbols() or self.default_benchmark_symbols
        seen: set[str] = set()
        ordered_symbols: list[str] = []
        for symbol in symbols:
            if symbol not in seen:
                seen.add(symbol)
                ordered_symbols.append(symbol)

        seen_benchmarks: set[str] = set()
        ordered_benchmarks: list[str] = []
        for symbol in benchmark_symbols:
            if symbol not in seen_benchmarks:
                seen_benchmarks.add(symbol)
                ordered_benchmarks.append(symbol)
        return ordered_symbols, ordered_benchmarks, discovered_stock_rows

    def ensure_symbol(self, request: StockRegisterRequest) -> StockRegisterResponse:
        raw_symbol = request.symbol.strip().upper()
        if not raw_symbol:
            raise ValidationError("심볼을 입력하세요.")

        candidates = self._build_symbol_candidates(raw_symbol, request.market_type, request.asset_group)
        if not candidates:
            raise ValidationError("조회 가능한 심볼이 없습니다.")

        last_error: Exception | None = None
        for candidate in candidates:
            try:
                ticker = yf.Ticker(self._to_yahoo_symbol(candidate))
                history = ticker.history(period=request.period, interval=request.interval, auto_adjust=False)
                history = self._prepare_price_history_frame(history)
                info, profile = self._fetch_yahoo_profile(ticker, candidate)

                if history.empty and not profile and not info:
                    continue

                price_rows = self._build_price_rows(candidate, history)

                stock_row = self._build_stock_row(candidate, info, profile)
                stock_count = self.stock_repository.upsert_rows([stock_row])
                price_count = self.price_repository.upsert_prices(price_rows)
                fundamentals_count = self.fundamental_repository.upsert_fundamentals(
                    self._build_fundamental_rows(candidate, history, info, profile, ticker)
                )
                try:
                    self.structured_event_service.sync_symbol(candidate, ticker=ticker)
                except Exception:
                    logger.warning("structured event sync failed for %s", candidate, exc_info=True)
                self.session.commit()

                exchange = stock_row["exchange"] or "UNKNOWN"
                market_type = self._resolve_market_type(exchange)
                asset_group = self._resolve_asset_group(exchange, stock_row["name"], market_type)
                return StockRegisterResponse(
                    symbol=candidate,
                    name=stock_row["name"],
                    exchange=exchange,
                    market_type=market_type,
                    asset_group=asset_group,
                    currency=stock_row["currency"] or "USD",
                    market_cap=float(stock_row["market_cap"]) if stock_row["market_cap"] is not None else None,
                    prices_updated=price_count,
                    fundamentals_updated=fundamentals_count if stock_count >= 0 else 0,
                )
            except Exception as exc:
                self.session.rollback()
                last_error = exc
                logger.warning("symbol onboarding failed for %s", candidate, exc_info=True)

        if last_error is not None:
            raise ExternalDependencyError("심볼 등록 중 오류가 발생했습니다. 데이터 공급자 연결을 확인하세요.")
        raise ValidationError("조회 가능한 심볼이 없습니다. 심볼 또는 시장 구분을 확인하세요.")

    def update(
        self,
        request: DataUpdateRequest,
        parent_job_id: int | None = None,
        *,
        skip_initial_progress: bool = False,
    ) -> DataUpdateResult:
        jobs: list[Job] = []
        prices_updated = 0
        fundamentals_updated = 0
        benchmarks_updated = 0
        stocks_updated = 0
        earnings_events_updated = 0
        insider_trades_updated = 0
        skipped_symbols: list[str] = []
        failed_benchmarks: list[str] = []
        symbols: list[str] = []
        benchmark_symbols: list[str] = []
        discovered_stock_rows: list[dict] = []
        total_symbols = 0
        total_benchmarks = 0
        processed_symbols = 0
        processed_benchmarks = 0
        fundamentals_only = self._is_fundamentals_only_request(request)
        try:
            if not skip_initial_progress:
                self._update_dispatch_progress(
                    parent_job_id,
                    stage="preparing",
                    stage_label="동기화 준비",
                    total_symbols=0,
                    total_benchmarks=0,
                    has_discovery=False,
                    message="동기화 요청을 초기화하는 중입니다.",
                )
                self._commit_checkpoint()
            symbols, benchmark_symbols, discovered_stock_rows = self._resolve_request_symbols(request, parent_job_id=parent_job_id)
            total_symbols = len(symbols)
            total_benchmarks = len(benchmark_symbols)
            if not skip_initial_progress:
                self._update_dispatch_progress(
                    parent_job_id,
                    stage="preparing",
                    stage_label="동기화 준비",
                    total_symbols=total_symbols,
                    total_benchmarks=total_benchmarks,
                    has_discovery=bool(discovered_stock_rows),
                    message=f"대상 심볼 {total_symbols}개, 벤치마크 {total_benchmarks}개를 준비했습니다.",
                )
                self._commit_checkpoint()

            if discovered_stock_rows:
                self._update_dispatch_progress(
                    parent_job_id,
                    stage="listing_discovery",
                    stage_label="심볼 발견",
                    total_symbols=total_symbols,
                    total_benchmarks=total_benchmarks,
                    has_discovery=True,
                    message=f"상장 심볼 {len(discovered_stock_rows)}개를 정리하는 중입니다.",
                )
                discovery_job = self._start_job(
                    "listing_discovery",
                    parent_job_id=parent_job_id,
                    metadata={"kind": "stage", "stage": "listing_discovery"},
                )
                jobs.append(discovery_job)
                stocks_updated += self.stock_repository.upsert_rows(discovered_stock_rows)
                self._finish_job(
                    discovery_job,
                    "COMPLETED",
                    f"discovered_stocks={len(discovered_stock_rows)}",
                    metadata={"kind": "stage", "stage": "listing_discovery", "discoveredStocks": len(discovered_stock_rows)},
                )
                self._commit_checkpoint()

            market_stage = "fundamentals_sync" if fundamentals_only else "market_data"
            market_stage_label = "펀더멘털 적재" if fundamentals_only else "가격 이력 적재"
            market_job_type = "fundamentals_refresh" if fundamentals_only else "market_data_update"
            market_job = self._start_job(market_job_type, parent_job_id=parent_job_id, metadata={"kind": "stage", "stage": market_stage})
            jobs.append(market_job)
            self._update_dispatch_progress(
                parent_job_id,
                stage=market_stage,
                stage_label=market_stage_label,
                processed_symbols=processed_symbols,
                total_symbols=total_symbols,
                processed_benchmarks=processed_benchmarks,
                total_benchmarks=total_benchmarks,
                has_discovery=bool(discovered_stock_rows),
                message=(
                    f"종목 마스터 {len(discovered_stock_rows):,}개 저장 완료 · 펀더멘털 스냅샷 다운로드를 시작합니다. 대상 심볼 {total_symbols:,}개"
                    if discovered_stock_rows and fundamentals_only
                    else f"펀더멘털 스냅샷 다운로드를 시작합니다. 대상 심볼 {total_symbols:,}개"
                    if fundamentals_only
                    else f"종목 마스터 {len(discovered_stock_rows):,}개 저장 완료 · 가격 이력 다운로드를 시작합니다. 대상 심볼 {total_symbols:,}개"
                    if discovered_stock_rows
                    else f"가격 이력 다운로드를 시작합니다. 대상 심볼 {total_symbols:,}개"
                ),
            )
            self._commit_checkpoint()
            if symbols:
                stock_metadata = self.stock_repository.get_metadata_frame(symbols)
                symbol_exchange_map = {}
                if not stock_metadata.empty and "symbol" in stock_metadata.columns:
                    symbol_exchange_map = {
                        str(row["symbol"]): row.get("exchange")
                        for _, row in stock_metadata.iterrows()
                    }
                should_fetch_profiles = fundamentals_only or len(symbols) <= 200 or bool(request.symbols)
                if not should_fetch_profiles:
                    logger.info(
                        "structured event sync skipped for large universe symbols=%s preset=%s",
                        len(symbols),
                        request.preset or "strategy_core_equities",
                    )
                download_groups = self._resolve_price_download_groups(symbols, request)
                for group in download_groups:
                    group_symbols = group["symbols"]
                    chunk_size = self._resolve_market_chunk_size(group, should_fetch_profiles)
                    for start in range(0, len(group_symbols), chunk_size):
                        chunk = group_symbols[start:start + chunk_size]
                        provider_symbol_map = {symbol: self._to_yahoo_symbol(symbol, symbol_exchange_map.get(symbol)) for symbol in chunk}
                        db_histories = self._load_price_histories_from_db(chunk) if fundamentals_only else {}
                        raw = pd.DataFrame()
                        if not fundamentals_only:
                            download_symbols = list(dict.fromkeys(provider_symbol_map.values()))
                            raw = self._download_history(
                                download_symbols,
                                period=group.get("period"),
                                start=group.get("start"),
                                end=group.get("end"),
                                interval=request.interval,
                                auto_adjust=False,
                                group_by="ticker",
                            )
                        chunk_price_rows: list[dict] = []
                        chunk_stock_rows: list[dict] = []
                        chunk_fundamental_rows: list[dict] = []
                        for symbol in chunk:
                            try:
                                provider_symbol = provider_symbol_map.get(symbol, symbol)
                                exchange = symbol_exchange_map.get(symbol)
                                if fundamentals_only:
                                    frame = db_histories.get(symbol, self._empty_history_frame())
                                else:
                                    frame = self._prepare_price_history_frame(self._extract_history_frame(raw, provider_symbol))
                                if frame.empty:
                                    skipped_symbols.append(symbol)
                                    continue

                                if not fundamentals_only:
                                    chunk_price_rows.extend(self._build_price_rows(symbol, frame))

                                if not should_fetch_profiles:
                                    continue

                                sec_profile = self.sec_company_facts_service.get_company_profile(symbol, exchange)
                                sec_rows = self.sec_company_facts_service.build_fundamental_rows(symbol, exchange, frame) if sec_profile else None
                                if sec_profile and sec_rows:
                                    info = {
                                        "market_cap": sec_rows[-1].get("market_cap"),
                                        "currency": sec_profile.get("currency"),
                                        "exchange": sec_profile.get("exchange"),
                                        "shortName": sec_profile.get("name"),
                                    }
                                    profile = {
                                        "shortName": sec_profile.get("name"),
                                        "longName": sec_profile.get("name"),
                                        "exchange": sec_profile.get("exchange"),
                                        "currency": sec_profile.get("currency"),
                                        "marketCap": sec_rows[-1].get("market_cap"),
                                    }
                                    chunk_stock_rows.append(self._build_stock_row(symbol, info, profile))
                                    chunk_fundamental_rows.extend(sec_rows)
                                    continue

                                ticker = yf.Ticker(provider_symbol)
                                info, profile = self._fetch_yahoo_profile(ticker, symbol)
                                fundamental_rows = self._merge_snapshot_fundamentals(
                                    self._build_fundamental_rows(symbol, frame, info, profile, ticker),
                                    info,
                                    profile,
                                )

                                chunk_stock_rows.append(self._build_stock_row(symbol, info, profile))
                                chunk_fundamental_rows.extend(fundamental_rows)
                                if not fundamentals_only:
                                    try:
                                        event_sync_counts = self.structured_event_service.sync_symbol(symbol, ticker=ticker)
                                        earnings_events_updated += event_sync_counts["earnings_events_updated"]
                                        insider_trades_updated += event_sync_counts["insider_trades_updated"]
                                    except Exception:
                                        logger.warning("structured event sync failed for %s", symbol, exc_info=True)
                            except Exception:
                                skipped_symbols.append(symbol)
                                logger.warning("symbol ingestion failed for %s", symbol, exc_info=True)

                        if not fundamentals_only:
                            prices_updated += self.price_repository.upsert_prices(chunk_price_rows)
                        fundamentals_updated += self.fundamental_repository.upsert_fundamentals(chunk_fundamental_rows)
                        stocks_updated += self.stock_repository.upsert_rows(chunk_stock_rows)
                        processed_symbols = min(total_symbols, processed_symbols + len(chunk))
                        self._update_dispatch_progress(
                            parent_job_id,
                            stage=market_stage,
                            stage_label=market_stage_label,
                            processed_symbols=processed_symbols,
                            total_symbols=total_symbols,
                            processed_benchmarks=processed_benchmarks,
                            total_benchmarks=total_benchmarks,
                            has_discovery=bool(discovered_stock_rows),
                            message=(
                                f"종목 마스터 {len(discovered_stock_rows):,}개 저장 완료 · 펀더멘털 {processed_symbols:,}/{total_symbols:,}개 심볼 처리 중"
                                if discovered_stock_rows and fundamentals_only
                                else f"펀더멘털 {processed_symbols:,}/{total_symbols:,}개 심볼 처리 중"
                                if fundamentals_only
                                else f"종목 마스터 {len(discovered_stock_rows):,}개 저장 완료 · 가격 이력 {processed_symbols:,}/{total_symbols:,}개 심볼 처리 중"
                                if discovered_stock_rows
                                else f"가격 이력 {processed_symbols:,}/{total_symbols:,}개 심볼 처리 중"
                            ),
                        )
                        self._commit_checkpoint()
            market_message = (
                f"stocks={stocks_updated}, prices={prices_updated}, fundamentals={fundamentals_updated}, "
                f"earnings_events={earnings_events_updated}, insider_trades={insider_trades_updated}"
            )
            if skipped_symbols:
                preview = ", ".join(skipped_symbols[:8])
                suffix = "..." if len(skipped_symbols) > 8 else ""
                market_message += f", skipped={len(skipped_symbols)} [{preview}{suffix}]"
            self._finish_job(
                market_job,
                "COMPLETED",
                market_message,
                metadata={
                    "kind": "stage",
                    "stage": market_stage,
                    "skippedSymbols": skipped_symbols,
                    "stocksUpdated": stocks_updated,
                    "pricesUpdated": prices_updated,
                    "fundamentalsUpdated": fundamentals_updated,
                    "earningsEventsUpdated": earnings_events_updated,
                    "insiderTradesUpdated": insider_trades_updated,
                },
            )
            self._commit_checkpoint()

            if not fundamentals_only:
                benchmark_job = self._start_job("benchmark_sync", parent_job_id=parent_job_id, metadata={"kind": "stage", "stage": "benchmark_sync"})
                jobs.append(benchmark_job)
                self._update_dispatch_progress(
                    parent_job_id,
                    stage="benchmark_sync",
                    stage_label="벤치마크 적재",
                    processed_symbols=processed_symbols,
                    total_symbols=total_symbols,
                    processed_benchmarks=processed_benchmarks,
                    total_benchmarks=total_benchmarks,
                    has_discovery=bool(discovered_stock_rows),
                    message=f"가격 이력 {processed_symbols:,}/{total_symbols:,}개 완료 · 벤치마크 다운로드를 시작합니다. 대상 {total_benchmarks:,}개",
                )
                self._commit_checkpoint()
                benchmark_groups = self._resolve_benchmark_download_groups(benchmark_symbols, request)
                for group in benchmark_groups:
                    group_symbols = group["symbols"]
                    for start in range(0, len(group_symbols), self.benchmark_chunk_size):
                        chunk = group_symbols[start:start + self.benchmark_chunk_size]
                        raw = self._download_history(
                            chunk,
                            period=group.get("period"),
                            start=group.get("start"),
                            end=group.get("end"),
                            interval=request.interval,
                            auto_adjust=True,
                            group_by="ticker",
                        )
                        for symbol in chunk:
                            try:
                                history = self._extract_history_frame(raw, symbol)
                                if history.empty:
                                    failed_benchmarks.append(symbol)
                                    continue
                                close_series = self._extract_close_series(history, symbol)
                                if close_series.empty:
                                    failed_benchmarks.append(symbol)
                                    continue
                                rows = [{"symbol": symbol, "date": pd.Timestamp(idx).date(), "price": float(value)} for idx, value in close_series.items()]
                                benchmarks_updated += self.benchmark_repository.upsert_rows(rows)
                            except Exception:
                                failed_benchmarks.append(symbol)
                                logger.warning("benchmark ingestion failed for %s", symbol, exc_info=True)
                        processed_benchmarks = min(total_benchmarks, processed_benchmarks + len(chunk))
                        self._update_dispatch_progress(
                            parent_job_id,
                            stage="benchmark_sync",
                            stage_label="벤치마크 적재",
                            processed_symbols=processed_symbols,
                            total_symbols=total_symbols,
                            processed_benchmarks=processed_benchmarks,
                            total_benchmarks=total_benchmarks,
                            has_discovery=bool(discovered_stock_rows),
                            message=f"가격 이력 {processed_symbols:,}/{total_symbols:,}개 완료 · 벤치마크 {processed_benchmarks:,}/{total_benchmarks:,}개 처리 중",
                        )
                        self._commit_checkpoint()
                benchmark_message = f"benchmarks={benchmarks_updated}"
                if failed_benchmarks:
                    preview = ", ".join(failed_benchmarks[:8])
                    suffix = "..." if len(failed_benchmarks) > 8 else ""
                    benchmark_message += f", failed={len(failed_benchmarks)} [{preview}{suffix}]"
                self._finish_job(
                    benchmark_job,
                    "COMPLETED",
                    benchmark_message,
                    metadata={"kind": "stage", "stage": "benchmark_sync", "failedBenchmarks": failed_benchmarks, "benchmarksUpdated": benchmarks_updated},
                )
            self._update_dispatch_progress(
                parent_job_id,
                stage="completed",
                stage_label="완료",
                processed_symbols=processed_symbols or total_symbols,
                total_symbols=total_symbols,
                processed_benchmarks=processed_benchmarks or total_benchmarks,
                total_benchmarks=total_benchmarks,
                has_discovery=bool(discovered_stock_rows),
                message="데이터 동기화가 완료되었습니다.",
            )
            self._commit_checkpoint()
            return DataUpdateResult(
                accepted=True,
                status="COMPLETED",
                message="데이터 동기화가 완료되었습니다." + (f" 일부 심볼 누락 {len(skipped_symbols)}건." if skipped_symbols else ""),
                prices_updated=prices_updated,
                fundamentals_updated=fundamentals_updated,
                benchmarks_updated=benchmarks_updated,
                jobs_written=[job.id for job in jobs],
            )
        except Exception as exc:
            self.session.rollback()
            for job in jobs:
                persisted_job = self.session.get(Job, job.id) if job.id is not None else None
                if persisted_job is None:
                    continue
                self._finish_job(persisted_job, "FAILED", str(exc), metadata={"kind": "stage", "error": str(exc)})
            self.session.commit()
            raise

    def status(self) -> DataStatusResponse:
        from app.services.data_update_dispatcher import DataUpdateDispatcher

        queue_state = DataUpdateDispatcher.get_queue_state()
        jobs = self.session.scalars(select(Job).order_by(Job.created_at.desc()).limit(10)).all()
        summary = {
            "running": sum(1 for job in jobs if job.status == "RUNNING"),
            "completed": sum(1 for job in jobs if job.status == "COMPLETED"),
            "failed": sum(1 for job in jobs if job.status == "FAILED"),
        }
        return DataStatusResponse(
            latest_price_date=self.price_repository.get_latest_price_date(),
            price_row_count=self.price_repository.get_total_count(),
            latest_fundamentals_date=self.fundamental_repository.get_latest_fundamental_date(),
            fundamentals_row_count=self.fundamental_repository.get_total_count(),
            latest_benchmark_date=self.benchmark_repository.get_latest_date(),
            benchmark_row_count=self.benchmark_repository.get_total_count(),
            job_health_summary=summary,
            latest_jobs=[
                JobSummary(id=job.id, job_type=job.job_type, status=job.status, started_at=job.started_at, finished_at=job.finished_at, message=job.message)
                for job in jobs
            ],
            queue_status=queue_state.get("queue_status", "유휴"),
            active_job=JobSummary(**queue_state["active_job"]) if queue_state.get("active_job") else None,
        )
