from __future__ import annotations

import json
import logging
import re
import zipfile
from datetime import date
from pathlib import Path

import pandas as pd
import requests

from app.config import get_settings
from app.services.sector_taxonomy import normalize_sector_label

logger = logging.getLogger(__name__)


class SecCompanyFactsService:
    _TICKER_MAP_URL = "https://www.sec.gov/files/company_tickers_exchange.json"
    _BULK_COMPANY_FACTS_URL = "https://www.sec.gov/Archives/edgar/daily-index/xbrl/companyfacts.zip"
    _SUBMISSIONS_URL_TEMPLATE = "https://data.sec.gov/submissions/CIK{cik:010d}.json"
    _US_EXCHANGES = {"NASDAQ", "NYSE", "NYSE MKT", "NYSE ARCA", "AMEX", "IEX", "BATS", "CBOE", "UNKNOWN"}
    _CIK_PATTERN = re.compile(r"(CIK\d{10})\.json$", re.IGNORECASE)
    _FORMS = {"10-Q", "10-Q/A", "10-K", "10-K/A", "20-F", "20-F/A", "40-F", "40-F/A", "6-K", "6-K/A"}

    def __init__(self) -> None:
        self.settings = get_settings()
        self.cache_dir = Path(__file__).resolve().parents[2] / ".cache" / "sec"
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.submissions_cache_dir = self.cache_dir / "submissions"
        self.submissions_cache_dir.mkdir(parents=True, exist_ok=True)
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": self.settings.sec_user_agent,
                "Accept": "application/json,text/plain,*/*",
                "Accept-Encoding": "gzip, deflate",
            }
        )
        self._ticker_map: dict[str, dict] | None = None
        self._bulk_zip: zipfile.ZipFile | None = None
        self._bulk_member_index: dict[str, str] | None = None
        self._submissions_cache: dict[int, dict] = {}

    def is_supported_symbol(self, symbol: str, exchange: str | None) -> bool:
        normalized_symbol = str(symbol or "").strip().upper()
        normalized_exchange = (exchange or "").strip().upper()
        if not normalized_symbol or normalized_symbol.startswith("^"):
            return False
        if normalized_symbol.endswith(".KS") or normalized_symbol.endswith(".KQ"):
            return False
        return normalized_exchange in self._US_EXCHANGES

    def get_company_profile(self, symbol: str, exchange: str | None) -> dict | None:
        if not self.is_supported_symbol(symbol, exchange):
            return None
        ticker_entry = self._resolve_ticker_entry(symbol)
        if ticker_entry is None:
            return None
        submissions = self._load_submissions_payload(int(ticker_entry["cik"])) or {}
        name = self._clean_text(submissions.get("name")) or self._clean_text(ticker_entry.get("name")) or symbol
        exchange_label = (
            self._clean_text(exchange)
            or self._first_text(submissions.get("exchanges"))
            or self._clean_text(ticker_entry.get("exchange"))
            or "UNKNOWN"
        )
        industry = self._clean_text(submissions.get("sicDescription"))
        sector = normalize_sector_label(None, industry, name, "STOCK")
        return {
            "symbol": symbol,
            "exchange": exchange_label,
            "name": name,
            "currency": "USD",
            "industry": industry,
            "sector": sector,
            "sic": self._clean_text(submissions.get("sic")),
            "quoteType": "EQUITY",
        }

    def build_fundamental_rows(self, symbol: str, exchange: str | None, history: pd.DataFrame) -> list[dict] | None:
        if not self.is_supported_symbol(symbol, exchange):
            return None

        ticker_entry = self._resolve_ticker_entry(symbol)
        if ticker_entry is None:
            return None

        payload = self._load_company_facts_payload(int(ticker_entry["cik"]))
        if payload is None:
            return None

        shares_series = self._build_instant_series(payload, "dei", "EntityCommonStockSharesOutstanding", "CommonStockSharesOutstanding", units=("shares",))
        equity_series = self._build_instant_series(
            payload,
            "us-gaap",
            "StockholdersEquity",
            "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
            "CommonStockholdersEquity",
            units=("USD",),
        )
        revenue_series = self._build_period_series(
            payload,
            "us-gaap",
            "RevenueFromContractWithCustomerExcludingAssessedTax",
            "RevenueFromContractWithCustomerIncludingAssessedTax",
            "SalesRevenueNet",
            "Revenues",
            "SalesRevenueServicesNet",
            units=("USD",),
        )
        net_income_series = self._build_period_series(payload, "us-gaap", "NetIncomeLoss", units=("USD",))
        eps_series = self._build_period_series(
            payload,
            "us-gaap",
            "EarningsPerShareDiluted",
            "EarningsPerShareBasicAndDiluted",
            "EarningsPerShareBasic",
            units=("USD/shares",),
        )

        report_dates = sorted(set(revenue_series.index) | set(net_income_series.index) | set(eps_series.index) | set(equity_series.index) | set(shares_series.index))
        if not report_dates:
            return None

        rows: list[dict] = []
        for report_date in report_dates:
            revenue = self._series_value(revenue_series, report_date)
            net_income = self._series_value(net_income_series, report_date)
            equity = self._series_asof_value(equity_series, report_date)
            shares_outstanding = self._series_asof_value(shares_series, report_date)
            eps = self._series_value(eps_series, report_date)
            close_price = self._close_price_as_of(history, report_date)

            if eps in (None, 0) and shares_outstanding not in (None, 0) and net_income is not None:
                eps = net_income / shares_outstanding

            per = None
            if close_price is not None and eps not in (None, 0) and eps > 0:
                per = close_price / eps

            market_cap = None
            pbr = None
            if close_price is not None and shares_outstanding not in (None, 0):
                market_cap = close_price * shares_outstanding
                if equity not in (None, 0):
                    book_value_per_share = equity / shares_outstanding
                    if book_value_per_share > 0:
                        pbr = close_price / book_value_per_share

            roe = None
            if net_income is not None and equity not in (None, 0):
                roe = (net_income * 4 / equity) * 100

            rows.append(
                {
                    "symbol": symbol,
                    "date": report_date.date(),
                    "per": per,
                    "pbr": pbr,
                    "roe": roe,
                    "eps": eps,
                    "dividend_yield": None,
                    "market_cap": market_cap,
                    "revenue": revenue,
                    "net_income": net_income,
                }
            )

        latest_snapshot_date = pd.Timestamp.utcnow().normalize()
        latest_revenue = self._latest_series_value(revenue_series)
        latest_net_income = self._latest_series_value(net_income_series)
        latest_equity = self._latest_series_value(equity_series)
        latest_shares_outstanding = self._latest_series_value(shares_series)
        latest_eps = self._latest_series_value(eps_series)
        latest_close_price = self._latest_close_price(history)

        if latest_eps in (None, 0) and latest_shares_outstanding not in (None, 0) and latest_net_income is not None:
            latest_eps = latest_net_income / latest_shares_outstanding

        latest_per = None
        if latest_close_price is not None and latest_eps not in (None, 0) and latest_eps > 0:
            latest_per = latest_close_price / latest_eps

        latest_market_cap = None
        latest_pbr = None
        if latest_close_price is not None and latest_shares_outstanding not in (None, 0):
            latest_market_cap = latest_close_price * latest_shares_outstanding
            if latest_equity not in (None, 0):
                latest_book_value_per_share = latest_equity / latest_shares_outstanding
                if latest_book_value_per_share > 0:
                    latest_pbr = latest_close_price / latest_book_value_per_share

        latest_roe = None
        if latest_net_income is not None and latest_equity not in (None, 0):
            latest_roe = (latest_net_income * 4 / latest_equity) * 100

        rows.append(
            {
                "symbol": symbol,
                "date": latest_snapshot_date.date(),
                "per": latest_per,
                "pbr": latest_pbr,
                "roe": latest_roe,
                "eps": latest_eps,
                "dividend_yield": None,
                "market_cap": latest_market_cap,
                "revenue": latest_revenue,
                "net_income": latest_net_income,
            }
        )
        return rows

    def _resolve_ticker_entry(self, symbol: str) -> dict | None:
        ticker_map = self._load_ticker_map()
        normalized_symbol = str(symbol or "").strip().upper()
        return (
            ticker_map.get(normalized_symbol)
            or ticker_map.get(normalized_symbol.replace(".", "-"))
            or ticker_map.get(normalized_symbol.replace("-", "."))
        )

    def _load_ticker_map(self) -> dict[str, dict]:
        if self._ticker_map is not None:
            return self._ticker_map

        cache_path = self.cache_dir / "company_tickers_exchange.json"
        payload = self._load_or_download_json(cache_path, self._TICKER_MAP_URL)
        fields = payload.get("fields") or []
        rows = payload.get("data") or []
        if not fields or not rows:
            self._ticker_map = {}
            return self._ticker_map

        field_index = {field: index for index, field in enumerate(fields)}
        mapping: dict[str, dict] = {}
        for row in rows:
            try:
                cik = int(row[field_index["cik"]])
                name = str(row[field_index["name"]] or "").strip()
                ticker = str(row[field_index["ticker"]] or "").strip().upper()
                exchange = str(row[field_index["exchange"]] or "").strip().upper()
            except Exception:
                continue
            if not ticker:
                continue
            entry = {"cik": cik, "name": name, "ticker": ticker, "exchange": exchange}
            mapping[ticker] = entry
            mapping[ticker.replace("-", ".")] = entry
            mapping[ticker.replace(".", "-")] = entry
        self._ticker_map = mapping
        return mapping

    def _load_or_download_json(self, cache_path: Path, url: str) -> dict:
        if cache_path.exists() and not self._is_cache_stale(cache_path):
            try:
                return json.loads(cache_path.read_text(encoding="utf-8"))
            except Exception:
                logger.warning("cached SEC json load failed for %s", cache_path, exc_info=True)
        response = self.session.get(url, timeout=(10, 60))
        response.raise_for_status()
        cache_path.write_text(response.text, encoding="utf-8")
        return response.json()

    def _load_company_facts_payload(self, cik: int) -> dict | None:
        archive = self._get_bulk_archive()
        member_index = self._get_bulk_member_index(archive)
        cik_key = f"CIK{cik:010d}"
        member_name = member_index.get(cik_key)
        if member_name is None:
            return None
        try:
            with archive.open(member_name) as member:
                return json.load(member)
        except Exception:
            logger.warning("SEC company facts load failed for %s", cik_key, exc_info=True)
            return None

    def _load_submissions_payload(self, cik: int) -> dict | None:
        if cik in self._submissions_cache:
            return self._submissions_cache[cik]
        cache_path = self.submissions_cache_dir / f"CIK{cik:010d}.json"
        try:
            payload = self._load_or_download_json(cache_path, self._SUBMISSIONS_URL_TEMPLATE.format(cik=cik))
        except Exception:
            logger.warning("SEC submissions load failed for CIK%010d", cik, exc_info=True)
            return None
        self._submissions_cache[cik] = payload
        return payload

    def _get_bulk_archive(self) -> zipfile.ZipFile:
        cache_path = self.cache_dir / "companyfacts.zip"
        if self._bulk_zip is not None and cache_path.exists() and not self._is_cache_stale(cache_path):
            return self._bulk_zip

        if self._bulk_zip is not None:
            self._bulk_zip.close()
            self._bulk_zip = None
            self._bulk_member_index = None
        if not cache_path.exists() or self._is_cache_stale(cache_path):
            self._download_bulk_archive(cache_path)
        try:
            self._bulk_zip = zipfile.ZipFile(cache_path)
        except zipfile.BadZipFile:
            logger.warning("SEC companyfacts cache is corrupted, redownloading %s", cache_path, exc_info=True)
            cache_path.unlink(missing_ok=True)
            self._download_bulk_archive(cache_path)
            self._bulk_zip = zipfile.ZipFile(cache_path)
        return self._bulk_zip

    def _download_bulk_archive(self, cache_path: Path) -> None:
        tmp_path = cache_path.with_suffix(".zip.tmp")
        response = self.session.get(self._BULK_COMPANY_FACTS_URL, timeout=(10, 300), stream=True)
        response.raise_for_status()
        with tmp_path.open("wb") as stream:
            for chunk in response.iter_content(chunk_size=1024 * 1024):
                if chunk:
                    stream.write(chunk)
        tmp_path.replace(cache_path)

    def _get_bulk_member_index(self, archive: zipfile.ZipFile) -> dict[str, str]:
        if self._bulk_member_index is not None:
            return self._bulk_member_index
        member_index: dict[str, str] = {}
        for member_name in archive.namelist():
            match = self._CIK_PATTERN.search(member_name)
            if match is None:
                continue
            member_index[match.group(1).upper()] = member_name
        self._bulk_member_index = member_index
        return member_index

    def _build_period_series(self, payload: dict, taxonomy: str, *tags: str, units: tuple[str, ...]) -> pd.Series:
        entries = self._collect_entries(payload, taxonomy, tags, units)
        if not entries:
            return pd.Series(dtype=float)

        rows = []
        for entry in entries:
            filed_at = pd.to_datetime(entry.get("filed"), errors="coerce")
            end_at = pd.to_datetime(entry.get("end"), errors="coerce")
            start_at = pd.to_datetime(entry.get("start"), errors="coerce")
            if pd.isna(filed_at) or pd.isna(end_at):
                continue
            form = str(entry.get("form") or "").upper()
            if form and form not in self._FORMS:
                continue
            duration_days = None
            if not pd.isna(start_at):
                duration_days = int((end_at - start_at).days)
            preference = 0
            if duration_days is not None and 70 <= duration_days <= 120:
                preference += 3
            elif duration_days is not None and duration_days > 250:
                preference -= 1
            if form.startswith("10-Q") or form.startswith("6-K"):
                preference += 2
            if form.startswith("10-K") or form.startswith("20-F") or form.startswith("40-F"):
                preference -= 1
            rows.append(
                {
                    "filed": filed_at.normalize(),
                    "end": end_at.normalize(),
                    "value": float(entry["val"]),
                    "preference": preference,
                }
            )
        if not rows:
            return pd.Series(dtype=float)

        frame = pd.DataFrame(rows).sort_values(["filed", "preference", "end"]).drop_duplicates(subset=["filed"], keep="last")
        series = pd.Series(frame["value"].astype(float).values, index=pd.to_datetime(frame["filed"]))
        return series.sort_index()

    def _build_instant_series(self, payload: dict, taxonomy: str, *tags: str, units: tuple[str, ...]) -> pd.Series:
        entries = self._collect_entries(payload, taxonomy, tags, units)
        if not entries:
            return pd.Series(dtype=float)

        rows = []
        for entry in entries:
            filed_at = pd.to_datetime(entry.get("filed"), errors="coerce")
            end_at = pd.to_datetime(entry.get("end"), errors="coerce")
            if pd.isna(end_at):
                continue
            reference_date = filed_at.normalize() if not pd.isna(filed_at) else end_at.normalize()
            rows.append({"date": reference_date, "value": float(entry["val"])})
        if not rows:
            return pd.Series(dtype=float)

        frame = pd.DataFrame(rows).sort_values("date").drop_duplicates(subset=["date"], keep="last")
        series = pd.Series(frame["value"].astype(float).values, index=pd.to_datetime(frame["date"]))
        return series.sort_index()

    @staticmethod
    def _collect_entries(payload: dict, taxonomy: str, tags: tuple[str, ...], units: tuple[str, ...]) -> list[dict]:
        facts = payload.get("facts", {})
        taxonomy_facts = facts.get(taxonomy, {})
        entries: list[dict] = []
        for tag in tags:
            fact = taxonomy_facts.get(tag)
            if not fact:
                continue
            fact_units = fact.get("units", {})
            for unit in units:
                entries.extend(fact_units.get(unit, []))
            if entries:
                break
        return entries

    @staticmethod
    def _series_value(series: pd.Series, report_date: pd.Timestamp) -> float | None:
        if series.empty:
            return None
        value = series.get(report_date)
        if value is None or pd.isna(value):
            return None
        return float(value)

    @staticmethod
    def _series_asof_value(series: pd.Series, report_date: pd.Timestamp) -> float | None:
        if series.empty:
            return None
        eligible = series.loc[series.index <= report_date].dropna()
        if eligible.empty:
            return None
        return float(eligible.iloc[-1])

    @staticmethod
    def _latest_series_value(series: pd.Series) -> float | None:
        if series.empty:
            return None
        clean = series.dropna()
        if clean.empty:
            return None
        return float(clean.iloc[-1])

    @staticmethod
    def _close_price_as_of(history: pd.DataFrame, report_date: pd.Timestamp) -> float | None:
        if history.empty or "Close" not in history.columns:
            return None
        close_series = history["Close"].copy()
        close_series.index = pd.to_datetime(close_series.index)
        eligible = close_series.loc[close_series.index <= report_date].dropna()
        if eligible.empty:
            return None
        return float(eligible.iloc[-1])

    @staticmethod
    def _latest_close_price(history: pd.DataFrame) -> float | None:
        if history.empty or "Close" not in history.columns:
            return None
        close_series = history["Close"].copy()
        close_series.index = pd.to_datetime(close_series.index)
        clean = close_series.dropna()
        if clean.empty:
            return None
        return float(clean.iloc[-1])

    @staticmethod
    def _clean_text(value: object | None) -> str | None:
        if value is None:
            return None
        text = str(value).strip()
        return text or None

    @classmethod
    def _first_text(cls, values: object | None) -> str | None:
        if isinstance(values, list):
            for value in values:
                text = cls._clean_text(value)
                if text:
                    return text
            return None
        return cls._clean_text(values)

    @staticmethod
    def _is_cache_stale(cache_path: Path) -> bool:
        modified_date = date.fromtimestamp(cache_path.stat().st_mtime)
        return modified_date < date.today()
