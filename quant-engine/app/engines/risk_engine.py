from __future__ import annotations

import numpy as np
import pandas as pd

from app.schemas.common import SeriesPoint
from app.schemas.risk import RiskResponse
from app.services.benchmark_service import BenchmarkService


class RiskEngine:
    def __init__(self, benchmark_service: BenchmarkService) -> None:
        self.benchmark_service = benchmark_service

    def evaluate(self, equity_curve: pd.Series, benchmark_curve: pd.Series | None = None) -> RiskResponse:
        returns = equity_curve.pct_change().dropna()
        if returns.empty:
            return RiskResponse(rolling_volatility=[], rolling_sharpe=[], drawdown_series=[])
        running_max = equity_curve.cummax()
        drawdown = equity_curve / running_max - 1
        hist_var = float(np.percentile(returns, 5))
        parametric_var = float(returns.mean() - 1.65 * returns.std(ddof=0))
        expected_shortfall = float(returns[returns <= hist_var].mean()) if (returns <= hist_var).any() else hist_var
        rolling_vol = returns.rolling(63).std(ddof=0) * np.sqrt(252)
        rolling_sharpe = (returns.rolling(63).mean() * 252) / (returns.rolling(63).std(ddof=0) * np.sqrt(252))
        beta = None
        if benchmark_curve is not None and not benchmark_curve.empty:
            aligned = pd.concat([returns.rename("p"), benchmark_curve.pct_change().rename("b")], axis=1).dropna()
            if not aligned.empty and aligned["b"].var(ddof=0) != 0:
                beta = float(np.cov(aligned["p"], aligned["b"])[0, 1] / aligned["b"].var(ddof=0))
        return RiskResponse(
            var=hist_var,
            parametric_var=parametric_var,
            expected_shortfall=expected_shortfall,
            beta=beta,
            volatility=float(returns.std(ddof=0) * np.sqrt(252)),
            max_drawdown=float(drawdown.min()),
            rolling_volatility=[SeriesPoint(date=idx.date(), value=float(val)) for idx, val in rolling_vol.dropna().items()],
            rolling_sharpe=[SeriesPoint(date=idx.date(), value=float(val)) for idx, val in rolling_sharpe.dropna().items()],
            drawdown_series=[SeriesPoint(date=idx.date(), value=float(val)) for idx, val in drawdown.items()],
        )
