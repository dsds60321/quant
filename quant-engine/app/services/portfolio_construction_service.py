from __future__ import annotations

import numpy as np
import pandas as pd

from app.config import get_settings


class PortfolioConstructionService:
    def __init__(self) -> None:
        self.settings = get_settings()

    def _normalize(self, weights: pd.Series) -> pd.Series:
        weights = weights.replace([np.inf, -np.inf], np.nan).dropna()
        weights = weights[weights > 0]
        if weights.empty:
            return weights
        capped = weights.copy()
        cap = self.settings.max_single_weight
        for _ in range(5):
            capped = capped / capped.sum()
            overflow = capped[capped > cap]
            if overflow.empty:
                break
            capped.loc[overflow.index] = cap
            remaining = 1 - capped.sum()
            if remaining <= 0:
                break
            uncapped = capped[capped < cap]
            if uncapped.empty:
                break
            capped.loc[uncapped.index] += remaining * (uncapped / uncapped.sum())
        return capped / capped.sum()

    def build_weights(self, selected: pd.DataFrame, weighting_method: str) -> pd.Series:
        if selected.empty:
            return pd.Series(dtype=float)
        method = (weighting_method or "equal_weight").lower()
        if method == "equal_weight":
            raw = pd.Series(1.0, index=selected["symbol"])
        elif method == "score_weight":
            scores = selected.set_index("symbol")["final_score"].clip(lower=0)
            raw = scores if scores.sum() > 0 else pd.Series(1.0, index=scores.index)
        elif method == "inverse_volatility_weight":
            vol = selected.set_index("symbol")["volatility"].replace(0, np.nan)
            raw = 1 / vol
        else:
            raw = pd.Series(1.0, index=selected["symbol"])
        return self._normalize(raw.astype(float))
