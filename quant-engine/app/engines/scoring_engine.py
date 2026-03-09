from __future__ import annotations

import pandas as pd

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
    def score(self, factor_frame: pd.DataFrame, strategy: StrategySnapshot) -> pd.DataFrame:
        if factor_frame.empty:
            return factor_frame
        weights = DEFAULT_WEIGHTS | strategy.factor_weights
        scored = factor_frame.copy()
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
        return scored.sort_values("final_score", ascending=False).head(strategy.stock_count).reset_index(drop=True)
