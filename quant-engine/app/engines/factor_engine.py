from __future__ import annotations

import logging
from dataclasses import dataclass

import numpy as np
import pandas as pd
from scipy.stats.mstats import winsorize

from app.config import get_settings

logger = logging.getLogger(__name__)


@dataclass
class FactorContext:
    as_of_date: pd.Timestamp
    price_frame: pd.DataFrame
    fundamental_frame: pd.DataFrame
    fundamental_history: pd.DataFrame
    news_frame: pd.DataFrame | None = None
    earnings_frame: pd.DataFrame | None = None
    insider_frame: pd.DataFrame | None = None


class FactorEngine:
    def __init__(self) -> None:
        self.settings = get_settings()

    def _safe_nanmean(self, values: list[float | int | None]) -> float:
        clean = [float(value) for value in values if value is not None and pd.notna(value)]
        if not clean:
            return np.nan
        return float(np.mean(clean))

    def _winsorized(self, series: pd.Series) -> pd.Series:
        clean = series.astype(float).replace([np.inf, -np.inf], np.nan)
        if clean.dropna().empty:
            return clean
        limited = winsorize(clean.fillna(clean.median()), limits=self.settings.factor_winsor_quantile)
        return pd.Series(np.asarray(limited), index=series.index)

    def _zscore(self, series: pd.Series) -> pd.Series:
        clean = self._winsorized(series)
        std = clean.std(ddof=0)
        if std == 0 or np.isnan(std):
            return pd.Series(0.0, index=series.index)
        return (clean - clean.mean()) / std

    def calculate(self, context: FactorContext, universe_symbols: list[str]) -> pd.DataFrame:
        if not universe_symbols:
            return pd.DataFrame(columns=["symbol", "momentum", "volatility", "value_score", "quality_score", "growth_score", "liquidity_score"])

        price_frame = context.price_frame[context.price_frame["symbol"].isin(universe_symbols)].copy()
        price_frame["date"] = pd.to_datetime(price_frame["date"])
        price_frame = price_frame.sort_values(["symbol", "date"])
        latest_fund = context.fundamental_frame[context.fundamental_frame["symbol"].isin(universe_symbols)].copy()
        fundamentals_hist = context.fundamental_history[context.fundamental_history["symbol"].isin(universe_symbols)].copy()

        rows: list[dict] = []
        for symbol, group in price_frame.groupby("symbol"):
            group = group.reset_index(drop=True)
            prices = group["adj_close"].replace(0, np.nan).ffill().dropna()
            returns = prices.pct_change().dropna()
            if prices.empty:
                continue
            if len(prices) >= 273:
                momentum = prices.iloc[-22] / prices.iloc[-252] - 1
            else:
                lookback = min(252, len(prices) - 1)
                momentum = prices.iloc[-1] / prices.iloc[-1 - lookback] - 1 if lookback >= 1 else np.nan
            volatility = returns.tail(252).std(ddof=0) * np.sqrt(252) if len(returns) >= 20 else np.nan
            avg_volume_20 = group["volume"].tail(20).mean()
            avg_traded_value_20 = (group["adj_close"] * group["volume"]).tail(20).mean()
            rows.append(
                {
                    "symbol": symbol,
                    "momentum_raw": momentum,
                    "volatility": volatility,
                    "avg_volume_20": avg_volume_20,
                    "avg_traded_value_20": avg_traded_value_20,
                }
            )

        factor_frame = pd.DataFrame(rows)
        if factor_frame.empty:
            return factor_frame

        if not latest_fund.empty:
            latest_fund = latest_fund.drop_duplicates(subset=["symbol"]).set_index("symbol")
            factor_frame = factor_frame.join(latest_fund[[c for c in ["per", "pbr", "roe", "market_cap", "revenue", "eps", "net_income"] if c in latest_fund.columns]], on="symbol")
        else:
            for column in ["per", "pbr", "roe", "market_cap", "revenue", "eps", "net_income"]:
                factor_frame[column] = np.nan
        if context.news_frame is not None and not context.news_frame.empty:
            news_frame = context.news_frame.drop_duplicates(subset=["symbol"]).set_index("symbol")
            factor_frame = factor_frame.join(news_frame[["news_score"]], on="symbol")
        else:
            factor_frame["news_score"] = np.nan
        if context.earnings_frame is not None and not context.earnings_frame.empty:
            earnings_frame = context.earnings_frame.drop_duplicates(subset=["symbol"]).set_index("symbol")
            factor_frame = factor_frame.join(earnings_frame[["earnings_surprise_score"]], on="symbol")
        else:
            factor_frame["earnings_surprise_score"] = np.nan
        if context.insider_frame is not None and not context.insider_frame.empty:
            insider_frame = context.insider_frame.drop_duplicates(subset=["symbol"]).set_index("symbol")
            factor_frame = factor_frame.join(insider_frame[["insider_activity_score"]], on="symbol")
        else:
            factor_frame["insider_activity_score"] = np.nan

        growth_records: dict[str, dict[str, float]] = {}
        if not fundamentals_hist.empty:
            fundamentals_hist["date"] = pd.to_datetime(fundamentals_hist["date"])
            fundamentals_hist = fundamentals_hist.sort_values(["symbol", "date"])
            for symbol, group in fundamentals_hist.groupby("symbol"):
                latest = group.iloc[-1]
                lag_candidates = group[group["date"] <= latest["date"] - pd.Timedelta(days=330)]
                lag = lag_candidates.iloc[-1] if not lag_candidates.empty else group.iloc[0]
                revenue_growth = np.nan
                eps_growth = np.nan
                if pd.notna(latest.get("revenue")) and pd.notna(lag.get("revenue")) and float(lag["revenue"] or 0) != 0:
                    revenue_growth = float(latest["revenue"]) / float(lag["revenue"]) - 1
                if pd.notna(latest.get("eps")) and pd.notna(lag.get("eps")) and float(lag["eps"] or 0) != 0:
                    eps_growth = float(latest["eps"]) / float(lag["eps"]) - 1
                growth_records[symbol] = {"revenue_growth": revenue_growth, "eps_growth": eps_growth}
        growth_frame = pd.DataFrame.from_dict(growth_records, orient="index")
        if not growth_frame.empty:
            factor_frame = factor_frame.join(growth_frame, on="symbol")
        else:
            factor_frame["revenue_growth"] = np.nan
            factor_frame["eps_growth"] = np.nan

        factor_frame["value_raw"] = factor_frame[["per", "pbr"]].apply(
            lambda row: self._safe_nanmean([
                -np.log(max(row["per"], 1e-6)) if pd.notna(row["per"]) and row["per"] > 0 else None,
                -np.log(max(row["pbr"], 1e-6)) if pd.notna(row["pbr"]) and row["pbr"] > 0 else None,
            ]),
            axis=1,
        )
        factor_frame["quality_raw"] = factor_frame.apply(
            lambda row: self._safe_nanmean([
                row["roe"] if pd.notna(row.get("roe")) else None,
                (row["net_income"] / row["revenue"]) if pd.notna(row.get("net_income")) and pd.notna(row.get("revenue")) and row["revenue"] not in (0, None) else None,
            ]),
            axis=1,
        )
        factor_frame["growth_raw"] = factor_frame[["revenue_growth", "eps_growth"]].mean(axis=1, skipna=True)
        factor_frame["liquidity_raw"] = np.log1p(factor_frame[["avg_volume_20", "avg_traded_value_20"]].mean(axis=1, skipna=True))

        factor_frame["momentum"] = self._zscore(factor_frame["momentum_raw"])
        factor_frame["value_score"] = self._zscore(factor_frame["value_raw"])
        factor_frame["quality_score"] = self._zscore(factor_frame["quality_raw"])
        factor_frame["growth_score"] = self._zscore(factor_frame["growth_raw"])
        factor_frame["liquidity_score"] = self._zscore(factor_frame["liquidity_raw"])
        factor_frame["volatility_z"] = self._zscore(factor_frame["volatility"])
        factor_frame["news_score_z"] = self._zscore(factor_frame["news_score"])
        factor_frame["earnings_surprise_score_z"] = self._zscore(factor_frame["earnings_surprise_score"])
        factor_frame["insider_activity_score_z"] = self._zscore(factor_frame["insider_activity_score"])

        return factor_frame[
            [
                "symbol",
                "momentum_raw",
                "momentum",
                "volatility",
                "volatility_z",
                "value_score",
                "quality_score",
                "growth_score",
                "liquidity_score",
                "news_score",
                "news_score_z",
                "earnings_surprise_score",
                "earnings_surprise_score_z",
                "insider_activity_score",
                "insider_activity_score_z",
                "per",
                "pbr",
                "roe",
                "market_cap",
            ]
        ].sort_values("symbol").reset_index(drop=True)
