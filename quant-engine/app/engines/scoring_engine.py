from __future__ import annotations

import pandas as pd

from app.schemas.factor import UniverseConfig
from app.schemas.strategy import StrategySnapshot


DEFAULT_WEIGHTS = {
    "momentum": 0.35,
    "value": 0.25,
    "quality": 0.20,
    "news": 0.05,
    "earnings_surprise": 0.10,
    "insider_activity": 0.05,
}


class ScoringEngine:
    @staticmethod
    def _normalize_symbols(symbols: list[str] | None) -> set[str]:
        if not symbols:
            return set()
        return {
            str(symbol).strip().upper()
            for symbol in symbols
            if str(symbol).strip()
        }

    @staticmethod
    def _filter_fundamental_ready(frame: pd.DataFrame) -> pd.DataFrame:
        if frame.empty:
            return frame
        fundamental_columns = [column for column in ("per", "pbr", "roe", "market_cap") if column in frame.columns]
        if not fundamental_columns:
            return frame.iloc[0:0].copy()
        return frame[frame[fundamental_columns].notna().any(axis=1)].copy()

    def score(self, factor_frame: pd.DataFrame, strategy: StrategySnapshot, universe: UniverseConfig | None = None) -> pd.DataFrame:
        if factor_frame.empty:
            return factor_frame
        weights = DEFAULT_WEIGHTS | strategy.factor_weights
        scored = factor_frame.copy()
        explicit_symbols = self._normalize_symbols(universe.allowed_symbols if universe is not None else None)
        direct_selection_mode = bool(
            universe is not None and universe.force_include_allowed_symbols and explicit_symbols
        )
        if direct_selection_mode:
            scored = scored[scored["symbol"].astype(str).str.upper().isin(explicit_symbols)].copy()
            scored = self._filter_fundamental_ready(scored)
        else:
            if strategy.roe_filter is not None:
                scored = scored[scored["roe"].isna() | (scored["roe"] >= float(strategy.roe_filter))]
            if strategy.pbr_filter is not None:
                scored = scored[scored["pbr"].isna() | (scored["pbr"] <= float(strategy.pbr_filter))]
            if strategy.momentum_filter is not None:
                scored = scored[scored["momentum_raw"].isna() | (scored["momentum_raw"] >= float(strategy.momentum_filter))]
        if scored.empty:
            return scored
        scored["final_score"] = (
            weights["momentum"] * scored["momentum"].fillna(0)
            + weights["value"] * scored["value_score"].fillna(0)
            + weights["quality"] * scored["quality_score"].fillna(0)
            + weights["news"] * scored["news_score_z"].fillna(0)
            + weights["earnings_surprise"] * scored["earnings_surprise_score_z"].fillna(0)
            + weights["insider_activity"] * scored["insider_activity_score_z"].fillna(0)
        )
        selection_limit = max(strategy.stock_count, len(explicit_symbols)) if direct_selection_mode else strategy.stock_count
        return scored.sort_values("final_score", ascending=False).head(selection_limit).reset_index(drop=True)
