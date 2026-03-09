from __future__ import annotations

import pandas as pd


class ExecutionCostService:
    def compute_turnover_and_cost(
        self,
        previous_weights: pd.Series,
        target_weights: pd.Series,
        commission_rate: float,
        slippage_rate: float,
        tax_rate: float = 0.0,
    ) -> tuple[float, float]:
        aligned = pd.concat([previous_weights.rename("prev"), target_weights.rename("target")], axis=1).fillna(0.0)
        turnover = float((aligned["target"] - aligned["prev"]).abs().sum())
        total_cost_rate = commission_rate + slippage_rate + tax_rate
        cost = turnover * total_cost_rate
        return turnover, cost
