from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
from sqlalchemy.orm import Session

from app.engines.factor_engine import FactorContext, FactorEngine
from app.engines.scoring_engine import ScoringEngine
from app.repositories.earnings_event_repository import EarningsEventRepository
from app.repositories.insider_trade_repository import InsiderTradeRepository
from app.schemas.backtest import BacktestMetrics, BacktestResult, RebalanceRecord
from app.schemas.common import SeriesPoint, WeightItem
from app.schemas.factor import UniverseConfig
from app.repositories.news_signal_repository import NewsSignalRepository
from app.schemas.strategy import StrategySnapshot
from app.services.benchmark_service import BenchmarkService
from app.services.execution_cost_service import ExecutionCostService
from app.services.portfolio_construction_service import PortfolioConstructionService
from app.services.rebalance_service import RebalanceService
from app.services.universe_service import UniverseService


@dataclass
class BacktestArtifacts:
    equity_curve: pd.Series
    benchmark_curve: pd.Series
    returns: pd.Series
    benchmark_returns: pd.Series
    rebalances: list[RebalanceRecord]


class BacktestEngine:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.universe_service = UniverseService(session)
        self.factor_engine = FactorEngine()
        self.scoring_engine = ScoringEngine()
        self.portfolio_construction = PortfolioConstructionService()
        self.rebalance_service = RebalanceService()
        self.execution_cost_service = ExecutionCostService()
        self.benchmark_service = BenchmarkService(session)
        self.news_signal_repository = NewsSignalRepository(session)
        self.earnings_event_repository = EarningsEventRepository(session)
        self.insider_trade_repository = InsiderTradeRepository(session)

    def _compute_metrics(self, equity_curve: pd.Series, benchmark_curve: pd.Series) -> BacktestMetrics:
        returns = equity_curve.pct_change().dropna()
        benchmark_returns = benchmark_curve.pct_change().dropna() if not benchmark_curve.empty else pd.Series(dtype=float)
        if returns.empty:
            return BacktestMetrics()
        total_return = float(equity_curve.iloc[-1] / equity_curve.iloc[0] - 1)
        num_years = max((equity_curve.index[-1] - equity_curve.index[0]).days / 365.25, 1 / 252)
        cagr = float((equity_curve.iloc[-1] / equity_curve.iloc[0]) ** (1 / num_years) - 1)
        annualized_volatility = float(returns.std(ddof=0) * np.sqrt(252))
        sharpe = float((returns.mean() * 252) / annualized_volatility) if annualized_volatility else None
        downside = returns[returns < 0]
        downside_vol = float(downside.std(ddof=0) * np.sqrt(252)) if not downside.empty else None
        sortino = float((returns.mean() * 252) / downside_vol) if downside_vol else None
        running_max = equity_curve.cummax()
        drawdown = equity_curve / running_max - 1
        max_drawdown = float(drawdown.min())
        calmar = float(cagr / abs(max_drawdown)) if max_drawdown else None
        win_rate = float((returns > 0).mean())
        relative = self.benchmark_service.compute_relative_metrics(returns, benchmark_returns)
        return BacktestMetrics(
            cagr=cagr,
            total_return=total_return,
            annualized_return=float(returns.mean() * 252),
            annualized_volatility=annualized_volatility,
            sharpe=sharpe,
            sortino=sortino,
            calmar=calmar,
            max_drawdown=max_drawdown,
            win_rate=win_rate,
            turnover=None,
            alpha=relative["alpha"],
            beta=relative["beta"],
            information_ratio=relative["information_ratio"],
            tracking_error=relative["tracking_error"],
        )

    def run(
        self,
        strategy: StrategySnapshot,
        start_date,
        end_date,
        benchmark_symbol: str,
        commission_rate: float,
        slippage_rate: float,
        tax_rate: float,
        initial_cash: float,
        universe_config: UniverseConfig | None = None,
    ) -> tuple[BacktestResult, BacktestArtifacts]:
        eligible, price_frame, fundamental_frame, fundamental_history = self.universe_service.build_universe(end_date, universe_config)
        if not eligible:
            empty = pd.Series(dtype=float)
            result = BacktestResult(strategy_id=strategy.id, benchmark_symbol=benchmark_symbol, metrics=BacktestMetrics(), equity_curve=[])
            return result, BacktestArtifacts(empty, empty, empty, empty, [])

        price_frame = price_frame[price_frame["symbol"].isin(eligible)].copy()
        price_frame["date"] = pd.to_datetime(price_frame["date"])
        price_frame = price_frame[price_frame["date"].between(pd.Timestamp(start_date), pd.Timestamp(end_date)) | (price_frame["date"] <= pd.Timestamp(end_date))]
        price_pivot = price_frame.pivot_table(index="date", columns="symbol", values="adj_close").sort_index().ffill()
        price_pivot = price_pivot.loc[(price_pivot.index >= pd.Timestamp(start_date)) & (price_pivot.index <= pd.Timestamp(end_date))]
        if price_pivot.empty:
            empty = pd.Series(dtype=float)
            result = BacktestResult(strategy_id=strategy.id, benchmark_symbol=benchmark_symbol, metrics=BacktestMetrics(), equity_curve=[])
            return result, BacktestArtifacts(empty, empty, empty, empty, [])

        trading_dates = price_pivot.index
        schedule = self.rebalance_service.generate_schedule(trading_dates, strategy.rebalance_period)
        if not schedule:
            empty = pd.Series(dtype=float)
            result = BacktestResult(strategy_id=strategy.id, benchmark_symbol=benchmark_symbol, metrics=BacktestMetrics(), equity_curve=[])
            return result, BacktestArtifacts(empty, empty, empty, empty, [])
        returns = price_pivot.pct_change().fillna(0.0)
        equity = pd.Series(index=trading_dates, dtype=float)
        equity.iloc[0] = initial_cash
        current_weights = pd.Series(dtype=float)
        rebalance_records: list[RebalanceRecord] = []

        for idx, (signal_date, execution_date) in enumerate(schedule):
            eligible_window, window_prices, window_fundamentals, window_fund_hist = self.universe_service.build_universe(signal_date.date(), universe_config)
            factor_context = FactorContext(
                as_of_date=signal_date,
                price_frame=window_prices,
                fundamental_frame=window_fundamentals,
                fundamental_history=window_fund_hist,
                news_frame=self.news_signal_repository.get_recent_sentiment_scores(signal_date.date(), symbols=eligible_window),
                earnings_frame=self.earnings_event_repository.get_recent_surprise_scores(signal_date.date(), symbols=eligible_window),
                insider_frame=self.insider_trade_repository.get_recent_activity_scores(signal_date.date(), symbols=eligible_window),
            )
            factor_frame = self.factor_engine.calculate(factor_context, eligible_window)
            selected = self.scoring_engine.score(factor_frame, strategy)
            target_weights = self.portfolio_construction.build_weights(selected, strategy.weighting_method)
            turnover, cost = self.execution_cost_service.compute_turnover_and_cost(
                current_weights,
                target_weights,
                commission_rate=commission_rate,
                slippage_rate=slippage_rate,
                tax_rate=tax_rate,
            )
            start_loc = trading_dates.get_loc(execution_date)
            end_loc = trading_dates.get_loc(schedule[idx + 1][1]) if idx + 1 < len(schedule) else len(trading_dates)
            period_dates = trading_dates[start_loc:end_loc]
            if period_dates.empty:
                continue
            if idx == 0 and start_loc > 0:
                equity.iloc[:start_loc] = initial_cash
            base_equity = float(equity.iloc[start_loc - 1]) if start_loc > 0 and pd.notna(equity.iloc[start_loc - 1]) else initial_cash
            base_equity *= max(1 - cost, 0)
            period_returns = returns.reindex(period_dates)
            aligned_symbols = [symbol for symbol in target_weights.index if symbol in period_returns.columns]
            target_weights = target_weights.reindex(aligned_symbols).dropna()
            if target_weights.empty:
                for loc, period_date in enumerate(period_dates):
                    equity.loc[period_date] = base_equity if loc == 0 else equity.loc[period_dates[loc - 1]]
            else:
                weighted_returns = period_returns[target_weights.index].mul(target_weights, axis=1).sum(axis=1)
                cumulative = (1 + weighted_returns).cumprod()
                equity.loc[period_dates] = base_equity * cumulative.values
            rebalance_records.append(
                RebalanceRecord(
                    date=signal_date.date(),
                    selections=selected["symbol"].tolist(),
                    target_weights=[WeightItem(symbol=symbol, weight=float(weight)) for symbol, weight in target_weights.items()],
                    turnover=turnover,
                    cost=cost,
                )
            )
            current_weights = target_weights

        equity = equity.ffill().fillna(initial_cash)
        benchmark_curve = self.benchmark_service.get_benchmark_series(benchmark_symbol, start_date, end_date).reindex(trading_dates).ffill().dropna()
        if benchmark_curve.empty:
            benchmark_curve = pd.Series(initial_cash, index=trading_dates)
        else:
            benchmark_curve = benchmark_curve / benchmark_curve.iloc[0] * initial_cash
        metrics = self._compute_metrics(equity, benchmark_curve)
        if rebalance_records:
            metrics.turnover = float(np.mean([item.turnover for item in rebalance_records]))
        running_max = equity.cummax()
        drawdown_curve = equity / running_max - 1
        result = BacktestResult(
            strategy_id=strategy.id,
            benchmark_symbol=benchmark_symbol,
            metrics=metrics,
            equity_curve=[SeriesPoint(date=idx.date(), value=float(value)) for idx, value in equity.items()],
            benchmark_curve=[SeriesPoint(date=idx.date(), value=float(value)) for idx, value in benchmark_curve.items()],
            drawdown_curve=[SeriesPoint(date=idx.date(), value=float(value)) for idx, value in drawdown_curve.items()],
            rebalances=rebalance_records,
        )
        return result, BacktestArtifacts(
            equity_curve=equity,
            benchmark_curve=benchmark_curve,
            returns=equity.pct_change().dropna(),
            benchmark_returns=benchmark_curve.pct_change().dropna(),
            rebalances=rebalance_records,
        )
