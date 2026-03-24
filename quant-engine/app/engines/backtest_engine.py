from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass
import logging
from typing import Callable

import numpy as np
import pandas as pd
from sqlalchemy.orm import Session

from app.engines.factor_engine import FactorContext, FactorEngine
from app.engines.scoring_engine import ScoringEngine
from app.repositories.earnings_event_repository import EarningsEventRepository
from app.repositories.insider_trade_repository import InsiderTradeRepository
from app.repositories.news_signal_repository import NewsSignalRepository
from app.schemas.backtest import (
    BacktestMetrics,
    BacktestPatternBreakdown,
    BacktestRequest,
    BacktestResearchConfig,
    BacktestResult,
    BacktestSignalTimelineItem,
    BacktestStockBreakdown,
    BacktestTradeLogItem,
    PatternDefinition,
    RebalanceRecord,
    SignalPlan,
)
from app.schemas.common import SeriesPoint, WeightItem
from app.schemas.factor import UniverseConfig
from app.schemas.strategy import StrategySnapshot
from app.services.benchmark_service import BenchmarkService
from app.services.execution_cost_service import ExecutionCostService
from app.services.portfolio_construction_service import PortfolioConstructionService
from app.services.rebalance_service import RebalanceService
from app.services.universe_service import UniverseService

logger = logging.getLogger(__name__)


@dataclass
class BacktestArtifacts:
    equity_curve: pd.Series
    benchmark_curve: pd.Series
    returns: pd.Series
    benchmark_returns: pd.Series
    rebalances: list[RebalanceRecord]


@dataclass
class PatternMatchArtifact:
    pattern: PatternDefinition
    trigger_price: float
    signal_price: float
    signal_reason: str
    detection_start_date: pd.Timestamp | None
    detection_end_date: pd.Timestamp | None
    stop_price: float | None = None
    target_price1: float | None = None
    target_price2: float | None = None


class BacktestEngine:
    _UNIVERSE_PRELOAD_SYMBOL_LIMIT = 500

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

    def _report_progress(
        self,
        progress_callback: Callable[[dict[str, object]], None] | None,
        *,
        stage: str,
        stage_label: str,
        progress_percent: int,
        message: str,
        processed_count: int | None = None,
        total_count: int | None = None,
        extra: dict[str, object] | None = None,
    ) -> None:
        if progress_callback is None:
            return
        payload: dict[str, object] = {
            "stage": stage,
            "stageLabel": stage_label,
            "progressPercent": max(0, min(int(progress_percent), 99)),
            "message": message,
        }
        if processed_count is not None:
            payload["processedCount"] = processed_count
        if total_count is not None:
            payload["totalCount"] = total_count
        if extra:
            payload.update(extra)
        progress_callback(payload)

    def _should_preload_universe(self, universe_config: UniverseConfig | None) -> bool:
        if universe_config is None or universe_config.allowed_symbols is None:
            return False
        return len({str(symbol or "").strip().upper() for symbol in universe_config.allowed_symbols if str(symbol or "").strip()}) <= self._UNIVERSE_PRELOAD_SYMBOL_LIMIT

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

    def _compute_series_drawdown(self, series: pd.Series) -> float:
        clean = series.dropna()
        if clean.empty:
            return 0.0
        running_max = clean.cummax()
        drawdown = clean / running_max - 1
        return float(drawdown.min())

    @staticmethod
    def _safe_series_value(series: pd.Series, timestamp: pd.Timestamp, default: float = 0.0) -> float:
        if series.empty:
            return default
        try:
            value = series.loc[timestamp]
            if pd.notna(value):
                return float(value)
        except KeyError:
            pass
        fallback = series.loc[:timestamp].dropna()
        if fallback.empty:
            return default
        return float(fallback.iloc[-1])

    @staticmethod
    def _entry_mode_label(entry_mode: str | None) -> str:
        normalized = (entry_mode or "SIGNAL_CLOSE").upper()
        if normalized == "NEXT_OPEN":
            return "다음 봉 시가 기준"
        if normalized == "BREAKOUT_PRICE":
            return "돌파 가격 기준"
        if normalized == "VWAP_PROXY":
            return "VWAP 근사 기준"
        return "종가 기준"

    @staticmethod
    def _round_optional(value: float | None, digits: int = 4) -> float | None:
        if value is None:
            return None
        return round(float(value), digits)

    def _build_price_plan(
        self,
        *,
        pattern: PatternDefinition,
        signal_plan: SignalPlan | None,
        entry_price: float,
        trigger_price: float,
        current_price: float,
        trailing_stop_price: float,
        override_stop_price: float | None = None,
        override_target_price1: float | None = None,
        override_target_price2: float | None = None,
        exit_price: float | None = None,
        override_sell_price: float | None = None,
    ) -> dict[str, float | bool | str | None]:
        safe_entry_price = max(float(entry_price), 0.0)
        safe_current_price = max(float(current_price), 0.0)
        safe_trigger_price = max(float(trigger_price), 0.0)
        signal_plan_stop = float(signal_plan.stop_loss_percent) if signal_plan is not None else 8.0
        signal_plan_take_profit = float(signal_plan.take_profit_percent) if signal_plan is not None else 22.0
        entry_band_percent = max(0.35, min(1.2, float(pattern.breakout_percent) * 0.45))
        stop_loss_percent = float(pattern.stop_loss_percent or signal_plan_stop)
        target1_percent = float(pattern.target1_percent or max(8.0, signal_plan_take_profit * 0.55))
        target2_percent = float(pattern.target2_percent or signal_plan_take_profit)
        entry_range_low = safe_entry_price * (1 - entry_band_percent / 100)
        entry_range_high = safe_entry_price * (1 + entry_band_percent / 100)
        stop_price = float(override_stop_price) if override_stop_price is not None and override_stop_price > 0 else safe_entry_price * (1 - stop_loss_percent / 100)
        resolved_trailing_stop = max(float(trailing_stop_price), stop_price)
        target_price1 = float(override_target_price1) if override_target_price1 is not None and override_target_price1 > 0 else safe_entry_price * (1 + target1_percent / 100)
        target_price2 = float(override_target_price2) if override_target_price2 is not None and override_target_price2 > 0 else safe_entry_price * (1 + target2_percent / 100)
        recommended_sell_price = override_sell_price or max(resolved_trailing_stop, safe_current_price if safe_current_price >= target_price1 else target_price1)
        expected_exit_price = float(exit_price) if exit_price is not None else recommended_sell_price
        expected_return_percent = ((expected_exit_price / safe_entry_price) - 1) * 100 if safe_entry_price > 0 else None
        expected_return_percent2 = ((target_price2 / safe_entry_price) - 1) * 100 if safe_entry_price > 0 else None
        risk = safe_entry_price - stop_price
        reward = target_price1 - safe_entry_price
        risk_reward = (reward / risk) if risk > 0 else None
        entry_distance_percent = ((safe_current_price / safe_entry_price) - 1) * 100 if safe_entry_price > 0 else None

        return {
            "trigger_price": self._round_optional(safe_trigger_price),
            "recommended_buy_price": self._round_optional(safe_entry_price),
            "entry_range_low": self._round_optional(entry_range_low),
            "entry_range_high": self._round_optional(entry_range_high),
            "entry_allowed": bool(entry_range_low <= safe_current_price <= entry_range_high) if safe_entry_price > 0 and safe_current_price > 0 else False,
            "stop_price": self._round_optional(stop_price),
            "trailing_stop_price": self._round_optional(resolved_trailing_stop),
            "target_price1": self._round_optional(target_price1),
            "target_price2": self._round_optional(target_price2),
            "recommended_sell_price": self._round_optional(recommended_sell_price),
            "expected_exit_price": self._round_optional(expected_exit_price),
            "expected_return_percent": self._round_optional(expected_return_percent),
            "expected_return_percent2": self._round_optional(expected_return_percent2),
            "risk_reward": self._round_optional(risk_reward, 2),
            "execution_label": self._entry_mode_label(pattern.entry_mode),
            "entry_distance_percent": self._round_optional(entry_distance_percent),
        }

    def _resolve_pattern_definitions(self, pattern_definitions: list[PatternDefinition] | None) -> list[PatternDefinition]:
        enabled = [pattern for pattern in (pattern_definitions or []) if pattern.enabled]
        if enabled:
            return enabled
        return [
            PatternDefinition(
                id="score-selection",
                name="복합 점수 선택",
                short_label="CORE",
                category="momentum",
                thesis="사용자 패턴이 없을 때 점수 기반 선택을 기본 패턴으로 간주합니다.",
                rule_summary="멀티 팩터 최종 점수 상위 종목을 선택합니다.",
                lookback_days=63,
                breakout_percent=1.0,
                holding_days=30,
                momentum_threshold=6.0,
                slope_threshold=0.1,
                volume_surge_percent=12.0,
                stop_loss_percent=8.0,
                target1_percent=12.0,
                target2_percent=20.0,
                entry_mode="SIGNAL_CLOSE",
                exit_mode="TRAILING_STOP",
                enabled=True,
                source="system",
            )
        ]

    @staticmethod
    def _has_explicit_pattern_overlay(pattern_definitions: list[PatternDefinition]) -> bool:
        return any((pattern.source or "preset") != "system" for pattern in pattern_definitions)

    @staticmethod
    def _previous_close_before(series: pd.Series, timestamp: pd.Timestamp, default: float) -> float:
        history = series.loc[:timestamp].dropna()
        if history.empty:
            return default
        if history.index[-1] == timestamp and history.size > 1:
            return float(history.iloc[-2])
        if history.index[-1] == timestamp:
            return default
        return float(history.iloc[-1])

    def _evaluate_pattern_signal(
        self,
        pattern: PatternDefinition,
        market_window: pd.DataFrame,
    ) -> PatternMatchArtifact | None:
        clean = market_window.dropna(subset=["close"]).copy()
        if clean.shape[0] < 3:
            return None

        lookback = max(3, min(int(pattern.lookback_days), clean.shape[0]))
        window = clean.tail(lookback).copy()
        previous = window.iloc[:-1]
        if previous.empty:
            return None

        close_series = window["close"].astype(float)
        high_series = window["high"].astype(float)
        low_series = window["low"].astype(float)
        open_series = window["open"].astype(float)
        volume_series = window["volume"].fillna(0.0).astype(float)

        latest_close = float(close_series.iloc[-1])
        first_close = float(close_series.iloc[0])
        if first_close <= 0:
            return None

        breakout_ratio = max(float(pattern.breakout_percent), 0.0) / 100.0
        momentum_percent = (latest_close / first_close - 1) * 100
        previous_high = float(high_series.iloc[:-1].max())
        window_low = float(low_series.min())
        returns = close_series.pct_change().dropna()
        normalized = close_series / first_close - 1
        slope = 0.0
        if normalized.size >= 3:
            try:
                slope = float(np.polyfit(np.arange(normalized.size), normalized.values, 1)[0] * normalized.size)
            except Exception:
                slope = 0.0

        def volume_ratio_at(position: int, period: int = 20) -> float:
            start = max(0, position - period + 1)
            avg_volume = float(volume_series.iloc[start : position + 1].mean()) if position >= start else 0.0
            current_volume = float(volume_series.iloc[position]) if position < volume_series.size else 0.0
            return current_volume / avg_volume if avg_volume > 0 else 1.0

        def average_true_range(frame: pd.DataFrame, period: int = 14) -> float:
            if frame.empty:
                return 0.0
            local = frame.tail(max(period, 2)).copy()
            prev_close = local["close"].shift(1).fillna(local["close"])
            ranges = pd.concat(
                [
                    local["high"] - local["low"],
                    (local["high"] - prev_close).abs(),
                    (local["low"] - prev_close).abs(),
                ],
                axis=1,
            ).max(axis=1)
            return float(ranges.dropna().mean()) if not ranges.dropna().empty else 0.0

        def find_recent_pivot_low(frame: pd.DataFrame, pivot_span: int = 2) -> float | None:
            if frame.shape[0] < pivot_span * 2 + 1:
                return None
            for idx in range(frame.shape[0] - pivot_span - 1, pivot_span - 1, -1):
                pivot_low = float(frame.iloc[idx]["low"])
                is_pivot = True
                for offset in range(1, pivot_span + 1):
                    left_low = float(frame.iloc[idx - offset]["low"])
                    right_low = float(frame.iloc[idx + offset]["low"])
                    if pivot_low >= left_low or pivot_low > right_low:
                        is_pivot = False
                        break
                if is_pivot:
                    return pivot_low
            return None

        current_volume_ratio = volume_ratio_at(volume_series.size - 1)
        required_volume_ratio = 1 + max(float(pattern.volume_surge_percent), 0.0) / 100.0
        recent_window = returns.tail(min(20, returns.size))
        recent_volatility = float(recent_window.std(ddof=0)) if recent_window.size > 1 else float(recent_window.std(ddof=0) or 0.0)
        baseline_volatility = float(returns.std(ddof=0)) if returns.size > 1 else recent_volatility

        if pattern.id == "liquidity-sweep-reversal":
            sweep_start = max(1, window.shape[0] - max(int(pattern.max_reentry_bars), 1))
            for sweep_offset in range(window.shape[0] - 1, sweep_start - 1, -1):
                structure_start = max(0, sweep_offset - lookback)
                structure = window.iloc[structure_start:sweep_offset]
                if structure.shape[0] < 6:
                    continue
                recent_pivot_low = find_recent_pivot_low(structure)
                structure_low = float(recent_pivot_low if recent_pivot_low is not None else structure["low"].min())
                structure_high = float(structure["high"].max())
                if not np.isfinite(structure_low) or not np.isfinite(structure_high) or structure_high <= structure_low:
                    continue

                sweep_bar = window.iloc[sweep_offset]
                confirm_bar = window.iloc[-1]
                sweep_threshold = structure_low * (1 - float(pattern.sweep_buffer_percent) / 100)
                if float(sweep_bar["low"]) > sweep_threshold:
                    continue

                atr = average_true_range(window.iloc[: sweep_offset + 1], min(14, lookback))
                bar_range = max(float(sweep_bar["high"]) - float(sweep_bar["low"]), float(sweep_bar["close"]) * 0.001, 0.01)
                body = max(abs(float(sweep_bar["close"]) - float(sweep_bar["open"])), bar_range * 0.08)
                lower_wick = max(min(float(sweep_bar["open"]), float(sweep_bar["close"])) - float(sweep_bar["low"]), 0.0)
                wick_ratio = lower_wick / body if body > 0 else 0.0
                close_recovery = ((float(confirm_bar["close"]) - float(sweep_bar["low"])) / bar_range) * 100 if bar_range > 0 else 0.0
                sweep_volume_ratio = volume_ratio_at(sweep_offset)
                recovered_price = structure_low * (1 + float(pattern.breakout_percent) / 100 * 0.15)

                if wick_ratio < float(pattern.wick_ratio_threshold):
                    continue
                if atr > 0 and bar_range < atr * 0.65:
                    continue
                if close_recovery < float(pattern.close_recovery_percent):
                    continue
                if float(confirm_bar["close"]) < recovered_price:
                    continue
                if sweep_offset < window.shape[0] - 1 and float(confirm_bar["close"]) <= max(structure_low, float(sweep_bar["close"])):
                    continue
                if sweep_volume_ratio < max(required_volume_ratio * 0.85, 1.02):
                    continue

                structure_range = structure_high - structure_low
                trigger_price = max(recovered_price, float(confirm_bar["close"]))
                stop_price = float(sweep_bar["low"]) * (1 - float(pattern.sweep_buffer_percent) / 200)
                target_price1 = max(trigger_price * (1 + float(pattern.target1_percent) / 100), structure_low + structure_range * 0.5)
                target_price2 = max(trigger_price * (1 + float(pattern.target2_percent) / 100), structure_high)
                return PatternMatchArtifact(
                    pattern=pattern,
                    trigger_price=round(trigger_price, 4),
                    signal_price=round(float(confirm_bar["close"]), 4),
                    signal_reason=f"구조 하단 스윕 후 {window.shape[0] - 1 - sweep_offset}봉 내 복귀 · 꼬리비 {round(wick_ratio, 2)} · 복귀 {round(close_recovery, 1)}%",
                    detection_start_date=window.index[max(0, sweep_offset - min(lookback, 12))],
                    detection_end_date=window.index[-1],
                    stop_price=round(stop_price, 4),
                    target_price1=round(target_price1, 4),
                    target_price2=round(target_price2, 4),
                )
            return None

        if pattern.id == "imbalance-pullback-continuation":
            if momentum_percent < float(pattern.momentum_threshold) or slope < float(pattern.slope_threshold):
                return None
            search_start = max(2, window.shape[0] - max(lookback, int(pattern.max_confirmation_bars) + 3))
            for fvg_offset in range(window.shape[0] - 2, search_start - 1, -1):
                first = window.iloc[fvg_offset - 2]
                middle = window.iloc[fvg_offset - 1]
                third = window.iloc[fvg_offset]
                gap_low = float(first["high"])
                gap_high = float(third["low"])
                gap_size = gap_high - gap_low
                gap_percent = (gap_size / gap_low) * 100 if gap_low > 0 else 0.0
                atr = average_true_range(window.iloc[: fvg_offset + 1], 14)
                middle_body = abs(float(middle["close"]) - float(middle["open"]))
                adjacent_average_body = (
                    abs(float(first["close"]) - float(first["open"])) + abs(float(third["close"]) - float(third["open"]))
                ) / 2
                impulse_body_percent = (middle_body / max(float(middle["open"]), 1e-9)) * 100
                if gap_size <= 0 or gap_percent < float(pattern.min_gap_percent) or (atr > 0 and gap_size < atr * 0.2):
                    continue
                if float(middle["close"]) <= float(middle["open"]) or impulse_body_percent < max(float(pattern.breakout_percent) * 0.8, gap_percent * 0.8):
                    continue
                if adjacent_average_body > 0 and middle_body / adjacent_average_body < 1.8:
                    continue

                bars_since_formation = window.shape[0] - 1 - fvg_offset
                if bars_since_formation < 2 or bars_since_formation > int(pattern.max_confirmation_bars):
                    continue

                pullback = window.iloc[fvg_offset + 1 : -1]
                if pullback.empty:
                    continue
                pullback_low = float(pullback["low"].min())
                fill_percent = ((gap_high - pullback_low) / gap_size) * 100 if gap_size > 0 else 0.0
                invalidated = bool((pullback["close"] < gap_low * (1 - float(pattern.breakout_percent) / 100 * 0.5)).any())
                rebreak_price = gap_high * (1 + float(pattern.breakout_percent) / 100 * 0.1)

                if pullback_low > gap_high:
                    continue
                if fill_percent < float(pattern.min_fill_percent):
                    continue
                if invalidated:
                    continue
                if latest_close < rebreak_price:
                    continue
                if current_volume_ratio < max(required_volume_ratio * 0.8, 1.0):
                    continue

                stop_price = min(pullback_low, gap_low) * (1 - float(pattern.min_gap_percent) / 200)
                target_base = max(latest_close, rebreak_price)
                target_price1 = max(target_base * (1 + float(pattern.target1_percent) / 100), target_base + gap_size * 1.5)
                target_price2 = max(target_base * (1 + float(pattern.target2_percent) / 100), target_base + gap_size * 3)
                return PatternMatchArtifact(
                    pattern=pattern,
                    trigger_price=round(rebreak_price, 4),
                    signal_price=round(latest_close, 4),
                    signal_reason=f"Bullish FVG {round(gap_percent, 2)}% · fill {round(fill_percent, 1)}% · {bars_since_formation}봉 내 재돌파",
                    detection_start_date=window.index[max(0, fvg_offset - 2)],
                    detection_end_date=window.index[-1],
                    stop_price=round(stop_price, 4),
                    target_price1=round(target_price1, 4),
                    target_price2=round(target_price2, 4),
                )
            return None

        pattern_key = f"{pattern.id} {pattern.name}".lower()
        matched = False
        trigger_price = latest_close
        reason = f"{pattern.name} 정량 패턴"
        if "52" in pattern_key or "52주" in pattern_key:
            rolling_high = float(high_series.max())
            trigger_price = rolling_high * (1 - breakout_ratio)
            matched = latest_close >= trigger_price and momentum_percent >= float(pattern.momentum_threshold) and current_volume_ratio >= max(required_volume_ratio * 0.85, 1.0)
            reason = f"52주 고점 {round(rolling_high, 4)} 대비 {round(((latest_close / rolling_high) - 1) * 100, 4)}% / 거래량 {round(current_volume_ratio, 2)}배"
        elif pattern.category == "breakout":
            trigger_price = previous_high * (1 + breakout_ratio / 2)
            matched = latest_close >= trigger_price and momentum_percent >= max(float(pattern.momentum_threshold) * 0.4, 4.0) and current_volume_ratio >= max(required_volume_ratio * 0.9, 1.0)
            reason = f"돌파 {round(trigger_price, 4)} / 모멘텀 {round(momentum_percent, 4)}% / 거래량 {round(current_volume_ratio, 2)}배"
        elif pattern.category == "trend":
            trigger_price = previous_high * (1 + breakout_ratio / 3)
            matched = slope >= float(pattern.slope_threshold) and latest_close >= trigger_price and current_volume_ratio >= max(required_volume_ratio * 0.85, 1.0)
            reason = f"기울기 {round(slope, 4)}% / 돌파 {round(trigger_price, 4)} / 거래량 {round(current_volume_ratio, 2)}배"
        elif pattern.category == "volatility":
            trigger_price = previous_high * (1 + breakout_ratio / 4)
            matched = recent_volatility <= baseline_volatility and latest_close >= trigger_price and current_volume_ratio >= max(required_volume_ratio, 1.0)
            reason = f"변동성 수축 {round(recent_volatility * 100, 4)}% / 돌파 {round(trigger_price, 4)} / 거래량 {round(current_volume_ratio, 2)}배"
        else:
            trigger_price = previous_high * (1 - breakout_ratio)
            matched = momentum_percent >= float(pattern.momentum_threshold) or latest_close >= trigger_price
            reason = f"모멘텀 {round(momentum_percent, 4)}% / 기준가 {round(trigger_price, 4)} / 저점 {round(window_low, 4)}"

        if not matched:
            return None

        detection_window = window.tail(min(window.shape[0], 12))
        return PatternMatchArtifact(
            pattern=pattern,
            trigger_price=round(trigger_price, 4),
            signal_price=round(latest_close, 4),
            signal_reason=reason,
            detection_start_date=detection_window.index[0] if not detection_window.empty else None,
            detection_end_date=window.index[-1] if not window.empty else None,
        )

    def _match_patterns(
        self,
        close_pivot: pd.DataFrame,
        open_pivot: pd.DataFrame,
        high_pivot: pd.DataFrame,
        low_pivot: pd.DataFrame,
        volume_pivot: pd.DataFrame,
        symbol: str,
        signal_date: pd.Timestamp,
        pattern_definitions: list[PatternDefinition],
    ) -> list[PatternMatchArtifact]:
        if symbol not in close_pivot.columns:
            fallback = pattern_definitions[0]
            return [
                PatternMatchArtifact(
                    pattern=fallback,
                    trigger_price=0.0,
                    signal_price=0.0,
                    signal_reason="가격 이력이 없어 기본 패턴으로 대체",
                    detection_start_date=None,
                    detection_end_date=signal_date,
                )
            ]
        close_series = close_pivot[symbol].loc[:signal_date].dropna()
        history = pd.DataFrame(index=close_series.index)
        history["close"] = close_series.astype(float)
        history["open"] = open_pivot[symbol].loc[history.index].astype(float) if symbol in open_pivot.columns else history["close"]
        history["high"] = high_pivot[symbol].loc[history.index].astype(float) if symbol in high_pivot.columns else history["close"]
        history["low"] = low_pivot[symbol].loc[history.index].astype(float) if symbol in low_pivot.columns else history["close"]
        history["volume"] = volume_pivot[symbol].loc[history.index].astype(float) if symbol in volume_pivot.columns else 0.0
        history["open"] = history["open"].fillna(history["close"])
        history["high"] = history["high"].fillna(history["close"])
        history["low"] = history["low"].fillna(history["close"])
        history["volume"] = history["volume"].fillna(0.0)

        matches = [match for pattern in pattern_definitions if (match := self._evaluate_pattern_signal(pattern, history)) is not None]
        if matches:
            return matches
        if self._has_explicit_pattern_overlay(pattern_definitions):
            return []
        fallback = pattern_definitions[0]
        latest_price = float(close_series.iloc[-1]) if not close_series.empty else 0.0
        detection_window = close_series.tail(min(close_series.size, 12))
        return [
            PatternMatchArtifact(
                pattern=fallback,
                trigger_price=round(latest_price, 4),
                signal_price=round(latest_price, 4),
                signal_reason="조건 일치 패턴이 없어 기본 패턴을 사용",
                detection_start_date=detection_window.index[0] if not detection_window.empty else None,
                detection_end_date=close_series.index[-1] if not close_series.empty else signal_date,
            )
        ]

    def _simulate_period_position(
        self,
        *,
        symbol: str,
        period_dates: pd.Index,
        period_return_series: pd.Series,
        close_pivot: pd.DataFrame,
        high_pivot: pd.DataFrame,
        low_pivot: pd.DataFrame,
        position: dict[str, object],
        match: PatternMatchArtifact,
        signal_plan: SignalPlan | None,
        new_entry: bool,
    ) -> dict[str, object]:
        adjusted_returns = period_return_series.reindex(period_dates).fillna(0.0).astype(float).copy()
        close_series = close_pivot[symbol].reindex(period_dates).ffill().dropna()
        high_series = high_pivot[symbol].reindex(period_dates).ffill().reindex(close_series.index)
        low_series = low_pivot[symbol].reindex(period_dates).ffill().reindex(close_series.index)
        if close_series.empty:
            return {
                "return_series": adjusted_returns,
                "segment_return": 0.0,
                "segment_drawdown": 0.0,
                "segment_holding_days": 0,
                "segment_start_date": period_dates[0].date(),
                "segment_end_date": period_dates[-1].date(),
                "exit_triggered": False,
                "exit_date": None,
                "exit_price": None,
                "exit_reason": None,
                "current_price": 0.0,
                "last_price": 0.0,
                "highest_close": float(position.get("highest_close", 0.0) or 0.0),
                "lowest_price": float(position.get("lowest_price", 0.0) or 0.0),
                "realized_return": None,
                "mfe_percent": None,
                "mae_percent": None,
            }

        pattern = match.pattern
        entry_price = float(position.get("entry_price", close_series.iloc[0]) or close_series.iloc[0])
        entry_date = position["entry_date"]
        highest_close = max(float(position.get("highest_close", entry_price) or entry_price), float(close_series.iloc[0]))
        lowest_price = min(float(position.get("lowest_price", entry_price) or entry_price), float(low_series.iloc[0]))
        highest_high = max(entry_price, float(high_series.iloc[0])) if not high_series.empty else entry_price
        lowest_low = min(entry_price, float(low_series.iloc[0])) if not low_series.empty else entry_price
        signal_stop = float(signal_plan.stop_loss_percent) if signal_plan is not None else 8.0
        stop_loss_percent = float(pattern.stop_loss_percent or signal_stop)
        stop_price = float(match.stop_price) if match.stop_price is not None and match.stop_price > 0 else entry_price * (1 - stop_loss_percent / 100)
        signal_take_profit = float(signal_plan.take_profit_percent) if signal_plan is not None else 22.0
        target_price1 = (
            float(match.target_price1)
            if match.target_price1 is not None and match.target_price1 > 0
            else entry_price * (1 + float(pattern.target1_percent or max(8.0, signal_take_profit * 0.55)) / 100)
        )
        target_price2 = (
            float(match.target_price2)
            if match.target_price2 is not None and match.target_price2 > 0
            else entry_price * (1 + float(pattern.target2_percent or signal_take_profit) / 100)
        )
        max_holding_days = max(
            1,
            min(
                int(pattern.holding_days),
                int(signal_plan.max_holding_days) if signal_plan is not None else int(pattern.holding_days),
            ),
        )
        exit_mode = (pattern.exit_mode or "TRAILING_STOP").upper()
        target1_release_days = max(3, int(pattern.holding_days * 0.45))
        evaluation_start = 1 if new_entry else 0
        exit_date: pd.Timestamp | None = None
        exit_price: float | None = None
        exit_reason: str | None = None
        current_price = float(close_series.iloc[-1])

        for index, current_date in enumerate(close_series.index):
            day_close = float(close_series.loc[current_date])
            day_high = float(high_series.loc[current_date]) if current_date in high_series.index else day_close
            day_low = float(low_series.loc[current_date]) if current_date in low_series.index else day_close
            highest_high = max(highest_high, day_high)
            lowest_low = min(lowest_low, day_low)
            current_price = day_close

            if index < evaluation_start:
                highest_close = max(highest_close, day_close)
                lowest_price = min(lowest_price, day_low)
                continue

            holding_days = max(int((current_date.date() - entry_date).days), 1)
            trailing_stop = max(stop_price, highest_close * (1 - stop_loss_percent * 0.007))
            trend_floor_source = close_pivot[symbol].loc[:current_date].dropna().tail(20)
            trend_floor = float(trend_floor_source.mean()) if not trend_floor_source.empty else day_close

            if exit_mode in {"STOP", "TRAILING_STOP"} and day_low <= trailing_stop:
                exit_price = trailing_stop
                exit_reason = "손절/트레일링 스탑"
            elif exit_mode in {"TARGET", "TRAILING_STOP"} and day_high >= target_price2:
                exit_price = target_price2
                exit_reason = "2차 목표가 도달"
            elif exit_mode in {"TARGET", "TRAILING_STOP"} and day_high >= target_price1 and holding_days >= target1_release_days:
                exit_price = target_price1
                exit_reason = "1차 목표가 도달"
            elif exit_mode == "TREND" and day_close < trend_floor:
                exit_price = day_close
                exit_reason = "추세 이탈"
            elif holding_days >= max_holding_days:
                exit_price = day_close
                exit_reason = "최대 보유일 도달"
            elif day_low <= trailing_stop:
                exit_price = trailing_stop
                exit_reason = "손절가 이탈"
            elif day_high >= target_price2:
                exit_price = target_price2
                exit_reason = "2차 목표가 도달"

            if exit_price is not None:
                exit_date = current_date
                previous_close = self._previous_close_before(close_pivot[symbol], current_date, entry_price)
                adjusted_returns.loc[current_date] = ((exit_price / previous_close) - 1) if previous_close > 0 else 0.0
                adjusted_returns.loc[adjusted_returns.index > current_date] = 0.0
                current_price = exit_price
                break

            highest_close = max(highest_close, day_close)
            lowest_price = min(lowest_price, day_low)

        segment_curve = (1 + adjusted_returns.fillna(0.0)).cumprod()
        segment_return = float(segment_curve.iloc[-1] - 1) if not segment_curve.empty else 0.0
        segment_drawdown = self._compute_series_drawdown(segment_curve)
        segment_end_date = exit_date.date() if exit_date is not None else period_dates[-1].date()
        segment_holding_days = max(int((segment_end_date - period_dates[0].date()).days), 1)
        last_price = float(exit_price if exit_price is not None else close_series.iloc[-1])
        realized_return = ((last_price / entry_price) - 1) * 100 if entry_price > 0 else None
        mfe_percent = ((highest_high / entry_price) - 1) * 100 if entry_price > 0 else None
        mae_percent = ((lowest_low / entry_price) - 1) * 100 if entry_price > 0 else None

        return {
            "return_series": adjusted_returns.reindex(period_dates).fillna(0.0),
            "segment_return": segment_return,
            "segment_drawdown": segment_drawdown,
            "segment_holding_days": segment_holding_days,
            "segment_start_date": period_dates[0].date(),
            "segment_end_date": segment_end_date,
            "exit_triggered": exit_date is not None,
            "exit_date": exit_date,
            "exit_price": self._round_optional(exit_price),
            "exit_reason": exit_reason,
            "current_price": self._round_optional(current_price),
            "last_price": self._round_optional(last_price),
            "highest_close": self._round_optional(highest_close),
            "lowest_price": self._round_optional(lowest_low),
            "realized_return": self._round_optional(realized_return),
            "mfe_percent": self._round_optional(mfe_percent),
            "mae_percent": self._round_optional(mae_percent),
        }

    def _resolve_trailing_stop(
        self,
        *,
        pattern: PatternDefinition,
        signal_plan: SignalPlan | None,
        entry_price: float,
        highest_close: float,
    ) -> float:
        signal_stop = float(signal_plan.stop_loss_percent) if signal_plan is not None else 8.0
        stop_loss_percent = float(pattern.stop_loss_percent or signal_stop)
        base_stop = max(float(entry_price), 0.0) * (1 - stop_loss_percent / 100)
        trailing_stop = max(float(highest_close), 0.0) * (1 - stop_loss_percent * 0.007)
        return round(max(base_stop, trailing_stop), 4)

    def _build_pattern_event_payload(
        self,
        *,
        match: PatternMatchArtifact,
        signal_plan: SignalPlan | None,
        entry_price: float,
        current_price: float,
        highest_close: float,
        signal_date,
        entry_date,
        current_state: str,
        open_position: bool,
        entry_allowed: bool | None = None,
        exit_date=None,
        exit_price: float | None = None,
        return_percent: float | None = None,
        holding_days: int | None = None,
        mfe_percent: float | None = None,
        mae_percent: float | None = None,
        exit_reason: str | None = None,
        override_sell_price: float | None = None,
    ) -> dict[str, object]:
        trailing_stop = self._resolve_trailing_stop(
            pattern=match.pattern,
            signal_plan=signal_plan,
            entry_price=entry_price,
            highest_close=highest_close,
        )
        plan = self._build_price_plan(
            pattern=match.pattern,
            signal_plan=signal_plan,
            entry_price=entry_price,
            trigger_price=match.trigger_price,
            current_price=current_price,
            trailing_stop_price=trailing_stop,
            override_stop_price=match.stop_price,
            override_target_price1=match.target_price1,
            override_target_price2=match.target_price2,
            exit_price=exit_price,
            override_sell_price=override_sell_price,
        )
        if entry_allowed is not None:
            plan["entry_allowed"] = entry_allowed
        return {
            "signal_date": signal_date,
            "signal_price": self._round_optional(match.signal_price),
            "signal_reason": match.signal_reason,
            "exit_reason": exit_reason,
            "current_state": current_state,
            "current_price": self._round_optional(current_price),
            "open_position": open_position,
            "entry_date": entry_date,
            "entry_price": self._round_optional(entry_price),
            "exit_date": exit_date,
            "exit_price": self._round_optional(exit_price),
            "return_percent": self._round_optional(return_percent),
            "holding_days": holding_days,
            "mfe_percent": self._round_optional(mfe_percent),
            "mae_percent": self._round_optional(mae_percent),
            "detection_start_date": match.detection_start_date.date() if match.detection_start_date is not None else None,
            "detection_end_date": match.detection_end_date.date() if match.detection_end_date is not None else None,
            **plan,
        }

    def _build_stock_breakdown(
        self,
        stock_segments: dict[str, list[dict]],
        last_signal_by_symbol: dict[str, str],
        signal_plan: SignalPlan | None,
    ) -> list[BacktestStockBreakdown]:
        rows: list[BacktestStockBreakdown] = []
        for symbol, segments in stock_segments.items():
            if not segments:
                continue
            compounded_return = float(np.prod([1 + segment["return"] for segment in segments]) - 1)
            contribution = float(sum(segment["contribution"] for segment in segments))
            win_rate = float(np.mean([segment["return"] > 0 for segment in segments]) * 100) if segments else 0.0
            drawdown = float(min((segment["drawdown"] for segment in segments), default=0.0))
            average_weight = float(np.mean([segment["weight"] for segment in segments]) * 100)
            total_holding_days = int(sum(segment["holding_days"] for segment in segments))
            first_entry = min(segment["start_date"] for segment in segments)
            last_exit = max(segment["end_date"] for segment in segments)
            active_patterns = [
                name
                for name, _ in Counter(
                    pattern_name
                    for segment in segments
                    for pattern_name in segment["patterns"]
                ).most_common(3)
            ]
            signal = last_signal_by_symbol.get(symbol, "HOLD")
            note = (
                signal_plan.hold_mode if signal == "HOLD" and signal_plan is not None
                else signal_plan.sell_mode if signal == "SELL" and signal_plan is not None
                else signal_plan.buy_mode if signal_plan is not None
                else "리밸런싱 기반 시그널"
            )
            rows.append(
                BacktestStockBreakdown(
                    symbol=symbol,
                    weight=round(average_weight, 4),
                    return_percent=round(compounded_return * 100, 4),
                    contribution_percent=round(contribution * 100, 4),
                    win_rate_percent=round(win_rate, 4),
                    drawdown_percent=round(drawdown * 100, 4),
                    signal=signal,
                    entry_date=first_entry,
                    exit_date=last_exit,
                    holding_days=total_holding_days,
                    active_patterns=active_patterns,
                    note=note,
                )
            )
        return sorted(rows, key=lambda item: (item.contribution_percent, item.return_percent), reverse=True)

    def _build_pattern_breakdown(
        self,
        pattern_segments: dict[str, list[dict]],
        total_segment_count: int,
    ) -> list[BacktestPatternBreakdown]:
        rows: list[BacktestPatternBreakdown] = []
        for pattern_name, segments in pattern_segments.items():
            if not segments:
                continue
            returns = np.array([segment["return"] for segment in segments], dtype=float)
            sample_size = len(segments)
            avg_return = float(np.mean(returns))
            volatility = float(np.std(returns, ddof=0)) if sample_size > 1 else 0.0
            sharpe = float((np.mean(returns) / volatility) * np.sqrt(sample_size)) if volatility > 0 else None
            max_drawdown = float(min((segment["drawdown"] for segment in segments), default=0.0))
            win_rate = float(np.mean(returns > 0) * 100) if sample_size > 0 else 0.0
            avg_holding_days = int(round(np.mean([segment["holding_days"] for segment in segments]))) if segments else 0
            turnover = float((sample_size / max(total_segment_count, 1)) * 100)
            rows.append(
                BacktestPatternBreakdown(
                    name=pattern_name,
                    sample_size=sample_size,
                    avg_return_percent=round(avg_return * 100, 4),
                    sharpe=round(sharpe, 4) if sharpe is not None else None,
                    max_drawdown_percent=round(max_drawdown * 100, 4),
                    win_rate_percent=round(win_rate, 4),
                    avg_holding_days=avg_holding_days,
                    turnover_percent=round(turnover, 4),
                    status="실거래 집계",
                )
            )
        return sorted(rows, key=lambda item: item.avg_return_percent, reverse=True)

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
        pattern_definitions: list[PatternDefinition] | None = None,
        signal_plan: SignalPlan | None = None,
        progress_callback: Callable[[dict[str, object]], None] | None = None,
    ) -> tuple[BacktestResult, BacktestArtifacts]:
        resolved_patterns = self._resolve_pattern_definitions(pattern_definitions)
        research_config = BacktestResearchConfig(pattern_definitions=resolved_patterns, signal_plan=signal_plan) if pattern_definitions or signal_plan is not None else None

        self._report_progress(
            progress_callback,
            stage="preparing",
            stage_label="전략 / 데이터 준비",
            progress_percent=2,
            message="전략, 기간, 유니버스 데이터를 준비하고 있습니다.",
        )
        prepared_universe = None
        if self._should_preload_universe(universe_config):
            prepared_universe = self.universe_service.prepare_universe_data(start_date, end_date, universe_config)
            eligible, price_frame, fundamental_frame, fundamental_history = self.universe_service.build_universe_from_data(
                end_date,
                prepared_universe,
                prepared_universe.config,
            )
        else:
            eligible, price_frame, fundamental_frame, fundamental_history = self.universe_service.build_universe(end_date, universe_config)
        if not eligible:
            empty = pd.Series(dtype=float)
            result = BacktestResult(strategy_id=strategy.id, benchmark_symbol=benchmark_symbol, metrics=BacktestMetrics(), equity_curve=[], research_config=research_config)
            return result, BacktestArtifacts(empty, empty, empty, empty, [])

        price_frame = price_frame[price_frame["symbol"].isin(eligible)].copy()
        price_frame["date"] = pd.to_datetime(price_frame["date"])
        price_frame = price_frame[price_frame["date"].between(pd.Timestamp(start_date), pd.Timestamp(end_date)) | (price_frame["date"] <= pd.Timestamp(end_date))]
        close_pivot = price_frame.pivot_table(index="date", columns="symbol", values="adj_close").sort_index().ffill()
        open_pivot = price_frame.pivot_table(index="date", columns="symbol", values="open").sort_index()
        high_pivot = price_frame.pivot_table(index="date", columns="symbol", values="high").sort_index()
        low_pivot = price_frame.pivot_table(index="date", columns="symbol", values="low").sort_index()
        volume_pivot = price_frame.pivot_table(index="date", columns="symbol", values="volume").sort_index().ffill().fillna(0.0)
        close_pivot = close_pivot.loc[(close_pivot.index >= pd.Timestamp(start_date)) & (close_pivot.index <= pd.Timestamp(end_date))]
        open_pivot = open_pivot.reindex(close_pivot.index).ffill().fillna(close_pivot)
        high_pivot = high_pivot.reindex(close_pivot.index).ffill().fillna(close_pivot)
        low_pivot = low_pivot.reindex(close_pivot.index).ffill().fillna(close_pivot)
        volume_pivot = volume_pivot.reindex(close_pivot.index).ffill().fillna(0.0)
        if close_pivot.empty:
            empty = pd.Series(dtype=float)
            result = BacktestResult(strategy_id=strategy.id, benchmark_symbol=benchmark_symbol, metrics=BacktestMetrics(), equity_curve=[], research_config=research_config)
            return result, BacktestArtifacts(empty, empty, empty, empty, [])

        trading_dates = close_pivot.index
        schedule = self.rebalance_service.generate_schedule(trading_dates, strategy.rebalance_period)
        if not schedule:
            empty = pd.Series(dtype=float)
            result = BacktestResult(strategy_id=strategy.id, benchmark_symbol=benchmark_symbol, metrics=BacktestMetrics(), equity_curve=[], research_config=research_config)
            return result, BacktestArtifacts(empty, empty, empty, empty, [])

        total_rebalances = len(schedule)
        self._report_progress(
            progress_callback,
            stage="schedule_ready",
            stage_label="리밸런싱 일정 생성",
            progress_percent=10,
            message=f"리밸런싱 일정 {total_rebalances}회를 준비했습니다.",
            processed_count=0,
            total_count=total_rebalances,
        )

        returns = close_pivot.pct_change().fillna(0.0)
        equity = pd.Series(index=trading_dates, dtype=float)
        equity.iloc[0] = initial_cash
        current_weights = pd.Series(dtype=float)
        rebalance_records: list[RebalanceRecord] = []
        stock_segments: dict[str, list[dict]] = defaultdict(list)
        pattern_segments: dict[str, list[dict]] = defaultdict(list)
        open_positions: dict[str, dict] = {}
        trade_log: list[BacktestTradeLogItem] = []
        signal_timeline: list[BacktestSignalTimelineItem] = []
        last_signal_by_symbol: dict[str, str] = {}

        for idx, (signal_date, execution_date) in enumerate(schedule):
            progress = 12 + int(((idx + 1) / max(total_rebalances, 1)) * 70)
            self._report_progress(
                progress_callback,
                stage="rebalancing",
                stage_label="리밸런싱 시점 계산",
                progress_percent=progress,
                message=f"리밸런싱 {idx + 1}/{total_rebalances}회를 계산하고 있습니다. 기준일 {signal_date.date()}",
                processed_count=idx + 1,
                total_count=total_rebalances,
            )
            if prepared_universe is not None:
                eligible_window, window_prices, window_fundamentals, window_fund_hist = self.universe_service.build_universe_from_data(
                    signal_date.date(),
                    prepared_universe,
                    prepared_universe.config,
                )
            else:
                eligible_window, window_prices, window_fundamentals, window_fund_hist = self.universe_service.build_universe(
                    signal_date.date(),
                    universe_config,
                )
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
            selected = self.scoring_engine.score(factor_frame, strategy, universe_config)
            target_weights = self.portfolio_construction.build_weights(selected, strategy.weighting_method)
            start_loc = trading_dates.get_loc(execution_date)
            end_loc = trading_dates.get_loc(schedule[idx + 1][1]) if idx + 1 < len(schedule) else len(trading_dates)
            period_dates = trading_dates[start_loc:end_loc]
            if period_dates.empty:
                continue
            if idx == 0 and start_loc > 0:
                equity.iloc[:start_loc] = initial_cash

            period_returns = returns.reindex(period_dates)
            aligned_symbols = [symbol for symbol in target_weights.index if symbol in period_returns.columns]
            target_weights = target_weights.reindex(aligned_symbols).dropna()
            pattern_overlay_enabled = self._has_explicit_pattern_overlay(resolved_patterns)
            pattern_matches = {
                symbol: self._match_patterns(close_pivot, open_pivot, high_pivot, low_pivot, volume_pivot, symbol, signal_date, resolved_patterns)
                for symbol in target_weights.index
            }
            if pattern_overlay_enabled:
                matched_symbols = [symbol for symbol in target_weights.index if pattern_matches.get(symbol)]
                target_weights = target_weights.reindex(matched_symbols).dropna()
                target_weight_sum = float(target_weights.sum())
                if target_weight_sum > 0:
                    target_weights = target_weights / target_weight_sum
                pattern_matches = {symbol: pattern_matches[symbol] for symbol in target_weights.index}
            turnover, cost = self.execution_cost_service.compute_turnover_and_cost(
                current_weights,
                target_weights,
                commission_rate=commission_rate,
                slippage_rate=slippage_rate,
                tax_rate=tax_rate,
            )
            previous_symbols = set(current_weights.index)
            target_symbols = set(target_weights.index)
            new_symbols = target_symbols - previous_symbols
            sold_symbols = previous_symbols - target_symbols

            for symbol in sold_symbols:
                position = open_positions.pop(symbol, None)
                if position is None:
                    continue
                latest_match = position.get("latest_match") or position.get("entry_match")
                if latest_match is None:
                    latest_match = PatternMatchArtifact(
                        pattern=resolved_patterns[0],
                        trigger_price=float(position.get("entry_price", 0.0) or 0.0),
                        signal_price=float(position.get("last_price", 0.0) or 0.0),
                        signal_reason="기본 패턴 사용",
                        detection_start_date=None,
                        detection_end_date=signal_date,
                    )
                signal_price = self._safe_series_value(close_pivot[symbol], signal_date)
                exit_price = self._safe_series_value(close_pivot[symbol], execution_date, signal_price)
                entry_price = float(position.get("entry_price", 0.0) or 0.0)
                holding_days = max(int((execution_date.date() - position["entry_date"]).days), 1)
                highest_close = max(float(position.get("highest_close", entry_price) or entry_price), signal_price, exit_price)
                lowest_price = min(float(position.get("lowest_price", entry_price) or entry_price), signal_price, exit_price)
                realized_return = ((exit_price / entry_price) - 1) * 100 if entry_price > 0 else None
                mfe_percent = ((highest_close / entry_price) - 1) * 100 if entry_price > 0 else None
                mae_percent = ((lowest_price / entry_price) - 1) * 100 if entry_price > 0 else None
                artifact_payload = self._build_pattern_event_payload(
                    match=latest_match,
                    signal_plan=signal_plan,
                    entry_price=entry_price,
                    current_price=signal_price,
                    highest_close=highest_close,
                    signal_date=signal_date.date(),
                    entry_date=position["entry_date"],
                    current_state="SELL",
                    open_position=False,
                    exit_date=execution_date.date(),
                    exit_price=exit_price,
                    return_percent=realized_return,
                    holding_days=holding_days,
                    mfe_percent=mfe_percent,
                    mae_percent=mae_percent,
                    exit_reason=signal_plan.sell_mode if signal_plan is not None else "리밸런싱 제외",
                    override_sell_price=exit_price,
                )
                signal_timeline.append(
                    BacktestSignalTimelineItem(
                        date=signal_date.date(),
                        symbol=symbol,
                        signal="SELL",
                        pattern_id=latest_match.pattern.id,
                        pattern=latest_match.pattern.name,
                        status="리밸런싱 제외",
                        note=signal_plan.sell_mode if signal_plan is not None else "리밸런싱에서 제외되어 청산합니다.",
                        **artifact_payload,
                    )
                )
                trade_log.append(
                    BacktestTradeLogItem(
                        date=execution_date.date(),
                        symbol=symbol,
                        action="SELL",
                        pattern_id=latest_match.pattern.id,
                        pattern=latest_match.pattern.name,
                        note=signal_plan.sell_mode if signal_plan is not None else "리밸런싱 교체 청산",
                        **artifact_payload,
                    )
                )
                last_signal_by_symbol[symbol] = "SELL"

            for symbol in sorted(target_symbols):
                matches = pattern_matches.get(symbol) or []
                primary_match = matches[0] if matches else PatternMatchArtifact(
                    pattern=resolved_patterns[0],
                    trigger_price=0.0,
                    signal_price=0.0,
                    signal_reason="기본 패턴 사용",
                    detection_start_date=None,
                    detection_end_date=signal_date,
                )
                primary_pattern = primary_match.pattern.name
                signal_price = self._safe_series_value(close_pivot[symbol], signal_date, primary_match.signal_price)
                execution_price = self._safe_series_value(close_pivot[symbol], execution_date, signal_price)
                if symbol in new_symbols:
                    open_positions[symbol] = {
                        "entry_date": execution_date.date(),
                        "entry_price": execution_price,
                        "patterns": [match.pattern.name for match in matches] or [primary_pattern],
                        "pattern_ids": [match.pattern.id for match in matches] or [primary_match.pattern.id],
                        "entry_match": primary_match,
                        "latest_match": primary_match,
                        "cumulative_factor": 1.0,
                        "holding_days": 0,
                        "highest_close": max(execution_price, signal_price),
                        "lowest_price": min(execution_price, signal_price),
                        "last_price": signal_price,
                    }
                    artifact_payload = self._build_pattern_event_payload(
                        match=primary_match,
                        signal_plan=signal_plan,
                        entry_price=execution_price,
                        current_price=signal_price,
                        highest_close=max(execution_price, signal_price),
                        signal_date=signal_date.date(),
                        entry_date=execution_date.date(),
                        current_state="BUY",
                        open_position=True,
                    )
                    signal_timeline.append(
                        BacktestSignalTimelineItem(
                            date=signal_date.date(),
                            symbol=symbol,
                            signal="BUY",
                            pattern_id=primary_match.pattern.id,
                            pattern=primary_pattern,
                            status="신규 진입",
                            note=signal_plan.buy_mode if signal_plan is not None else "리밸런싱 신규 편입",
                            **artifact_payload,
                        )
                    )
                    trade_log.append(
                        BacktestTradeLogItem(
                            date=execution_date.date(),
                            symbol=symbol,
                            action="BUY",
                            pattern_id=primary_match.pattern.id,
                            pattern=primary_pattern,
                            note=signal_plan.buy_mode if signal_plan is not None else "리밸런싱 신규 편입",
                            **artifact_payload,
                        )
                    )
                    last_signal_by_symbol[symbol] = "BUY"
                else:
                    position = open_positions.get(symbol)
                    if position is None:
                        open_positions[symbol] = {
                            "entry_date": execution_date.date(),
                            "entry_price": execution_price,
                            "patterns": [match.pattern.name for match in matches] or [primary_pattern],
                            "pattern_ids": [match.pattern.id for match in matches] or [primary_match.pattern.id],
                            "entry_match": primary_match,
                            "latest_match": primary_match,
                            "cumulative_factor": 1.0,
                            "holding_days": 0,
                            "highest_close": max(execution_price, signal_price),
                            "lowest_price": min(execution_price, signal_price),
                            "last_price": signal_price,
                        }
                        position = open_positions[symbol]
                    else:
                        position["patterns"] = [match.pattern.name for match in matches] or position["patterns"]
                        position["pattern_ids"] = [match.pattern.id for match in matches] or position.get("pattern_ids", [primary_match.pattern.id])
                        position["latest_match"] = primary_match
                        position["highest_close"] = max(float(position.get("highest_close", signal_price) or signal_price), signal_price)
                        position["lowest_price"] = min(float(position.get("lowest_price", signal_price) or signal_price), signal_price)
                        position["last_price"] = signal_price
                    entry_price = float(position.get("entry_price", execution_price) or execution_price)
                    holding_days = max(int((signal_date.date() - position["entry_date"]).days), 0)
                    current_return = ((signal_price / entry_price) - 1) * 100 if entry_price > 0 else None
                    highest_close = float(position.get("highest_close", signal_price) or signal_price)
                    lowest_price = float(position.get("lowest_price", signal_price) or signal_price)
                    artifact_payload = self._build_pattern_event_payload(
                        match=primary_match,
                        signal_plan=signal_plan,
                        entry_price=entry_price,
                        current_price=signal_price,
                        highest_close=highest_close,
                        signal_date=signal_date.date(),
                        entry_date=position["entry_date"],
                        current_state="HOLD",
                        open_position=True,
                        return_percent=current_return,
                        holding_days=holding_days,
                        mfe_percent=((highest_close / entry_price) - 1) * 100 if entry_price > 0 else None,
                        mae_percent=((lowest_price / entry_price) - 1) * 100 if entry_price > 0 else None,
                    )
                    signal_timeline.append(
                        BacktestSignalTimelineItem(
                            date=signal_date.date(),
                            symbol=symbol,
                            signal="HOLD",
                            pattern_id=primary_match.pattern.id,
                            pattern=primary_pattern,
                            status="보유 유지",
                            note=signal_plan.hold_mode if signal_plan is not None else "점수 상위군 유지",
                            **artifact_payload,
                        )
                    )
                    last_signal_by_symbol[symbol] = "HOLD"

            base_equity = float(equity.iloc[start_loc - 1]) if start_loc > 0 and pd.notna(equity.iloc[start_loc - 1]) else initial_cash
            base_equity *= max(1 - cost, 0)

            if target_weights.empty:
                for loc, period_date in enumerate(period_dates):
                    equity.loc[period_date] = base_equity if loc == 0 else equity.loc[period_dates[loc - 1]]
                active_period_weights = target_weights
            else:
                weighted_returns = pd.Series(0.0, index=period_dates, dtype=float)
                active_end_symbols: list[str] = []

                for symbol in target_weights.index:
                    position = open_positions.get(symbol)
                    if position is None:
                        continue
                    matched_pattern_artifacts = pattern_matches.get(symbol) or []
                    primary_match = matched_pattern_artifacts[0] if matched_pattern_artifacts else position.get("latest_match") or position.get("entry_match")
                    if primary_match is None:
                        continue
                    simulation = self._simulate_period_position(
                        symbol=symbol,
                        period_dates=period_dates,
                        period_return_series=period_returns[symbol],
                        close_pivot=close_pivot,
                        high_pivot=high_pivot,
                        low_pivot=low_pivot,
                        position=position,
                        match=primary_match,
                        signal_plan=signal_plan,
                        new_entry=symbol in new_symbols,
                    )
                    weight = float(target_weights[symbol])
                    weighted_returns = weighted_returns.add(simulation["return_series"] * weight, fill_value=0.0)
                    matched_patterns = [match.pattern.name for match in matched_pattern_artifacts] or [primary_match.pattern.name]
                    stock_segments[symbol].append(
                        {
                            "return": simulation["segment_return"],
                            "contribution": weight * simulation["segment_return"],
                            "drawdown": simulation["segment_drawdown"],
                            "weight": weight,
                            "holding_days": simulation["segment_holding_days"],
                            "start_date": simulation["segment_start_date"],
                            "end_date": simulation["segment_end_date"],
                            "patterns": matched_patterns,
                        }
                    )
                    for pattern_name in matched_patterns:
                        pattern_segments[pattern_name].append(
                            {
                                "return": simulation["segment_return"],
                                "drawdown": simulation["segment_drawdown"],
                                "holding_days": simulation["segment_holding_days"],
                            }
                        )

                    if simulation["exit_triggered"]:
                        entry_price = float(position.get("entry_price", 0.0) or 0.0)
                        exit_timestamp = simulation["exit_date"]
                        exit_trade_date = exit_timestamp.date() if exit_timestamp is not None else execution_date.date()
                        artifact_payload = self._build_pattern_event_payload(
                            match=primary_match,
                            signal_plan=signal_plan,
                            entry_price=entry_price,
                            current_price=float(simulation["current_price"] or simulation["exit_price"] or entry_price),
                            highest_close=float(simulation["highest_close"] or entry_price),
                            signal_date=exit_trade_date,
                            entry_date=position["entry_date"],
                            current_state="SELL",
                            open_position=False,
                            exit_date=exit_trade_date,
                            exit_price=float(simulation["exit_price"] or 0.0),
                            return_percent=simulation["realized_return"],
                            holding_days=max(int((exit_trade_date - position["entry_date"]).days), 1),
                            mfe_percent=simulation["mfe_percent"],
                            mae_percent=simulation["mae_percent"],
                            exit_reason=simulation["exit_reason"],
                            override_sell_price=float(simulation["exit_price"] or 0.0),
                        )
                        signal_timeline.append(
                            BacktestSignalTimelineItem(
                                date=exit_trade_date,
                                symbol=symbol,
                                signal="SELL",
                                pattern_id=primary_match.pattern.id,
                                pattern=primary_match.pattern.name,
                                status="패턴 청산",
                                note=simulation["exit_reason"] or (signal_plan.sell_mode if signal_plan is not None else "패턴 규칙 청산"),
                                **artifact_payload,
                            )
                        )
                        trade_log.append(
                            BacktestTradeLogItem(
                                date=exit_trade_date,
                                symbol=symbol,
                                action="SELL",
                                pattern_id=primary_match.pattern.id,
                                pattern=primary_match.pattern.name,
                                note=simulation["exit_reason"] or (signal_plan.sell_mode if signal_plan is not None else "패턴 규칙 청산"),
                                **artifact_payload,
                            )
                        )
                        open_positions.pop(symbol, None)
                        last_signal_by_symbol[symbol] = "SELL"
                    else:
                        position["cumulative_factor"] *= 1 + simulation["segment_return"]
                        position["holding_days"] += simulation["segment_holding_days"]
                        position["patterns"] = matched_patterns
                        position["pattern_ids"] = [match.pattern.id for match in matched_pattern_artifacts] or position.get("pattern_ids", [primary_match.pattern.id])
                        position["latest_match"] = primary_match
                        position["highest_close"] = float(simulation["highest_close"] or position.get("highest_close", 0.0) or 0.0)
                        position["lowest_price"] = float(simulation["lowest_price"] or position.get("lowest_price", 0.0) or 0.0)
                        position["last_price"] = float(simulation["last_price"] or position.get("last_price", 0.0) or 0.0)
                        active_end_symbols.append(symbol)

                cumulative = (1 + weighted_returns).cumprod()
                equity.loc[period_dates] = base_equity * cumulative.values
                active_period_weights = target_weights.reindex(active_end_symbols).dropna()

            rebalance_records.append(
                RebalanceRecord(
                    date=signal_date.date(),
                    selections=selected["symbol"].tolist(),
                    target_weights=[WeightItem(symbol=symbol, weight=float(weight)) for symbol, weight in target_weights.items()],
                    turnover=turnover,
                    cost=cost,
                )
            )
            current_weights = active_period_weights

        final_date = trading_dates[-1].date()
        self._report_progress(
            progress_callback,
            stage="finalizing_positions",
            stage_label="보유 포지션 정리",
            progress_percent=86,
            message="백테스트 종료 시점 보유 포지션과 거래 로그를 정리하고 있습니다.",
            processed_count=total_rebalances,
            total_count=total_rebalances,
        )
        for symbol, position in open_positions.items():
            latest_match = position.get("latest_match") or position.get("entry_match")
            if latest_match is None:
                latest_match = PatternMatchArtifact(
                    pattern=resolved_patterns[0],
                    trigger_price=float(position.get("entry_price", 0.0) or 0.0),
                    signal_price=float(position.get("last_price", 0.0) or 0.0),
                    signal_reason="기본 패턴 사용",
                    detection_start_date=None,
                    detection_end_date=trading_dates[-1],
                )
            current_price = self._safe_series_value(close_pivot[symbol], trading_dates[-1], float(position.get("last_price", 0.0) or 0.0))
            entry_price = float(position.get("entry_price", 0.0) or 0.0)
            holding_days = max(int((final_date - position["entry_date"]).days), 1)
            highest_close = max(float(position.get("highest_close", entry_price) or entry_price), current_price)
            lowest_price = min(float(position.get("lowest_price", entry_price) or entry_price), current_price)
            current_return = ((current_price / entry_price) - 1) * 100 if entry_price > 0 else None
            artifact_payload = self._build_pattern_event_payload(
                match=latest_match,
                signal_plan=signal_plan,
                entry_price=entry_price,
                current_price=current_price,
                highest_close=highest_close,
                signal_date=final_date,
                entry_date=position["entry_date"],
                current_state="HOLD",
                open_position=True,
                return_percent=current_return,
                holding_days=holding_days,
                mfe_percent=((highest_close / entry_price) - 1) * 100 if entry_price > 0 else None,
                mae_percent=((lowest_price / entry_price) - 1) * 100 if entry_price > 0 else None,
                exit_reason=signal_plan.hold_mode if signal_plan is not None else "백테스트 종료 시점 보유",
            )
            trade_log.append(
                BacktestTradeLogItem(
                    date=final_date,
                    symbol=symbol,
                    action="HOLD",
                    pattern_id=latest_match.pattern.id,
                    pattern=latest_match.pattern.name,
                    note=signal_plan.hold_mode if signal_plan is not None else "백테스트 종료 시점 보유",
                    **artifact_payload,
                )
            )
            signal_timeline.append(
                BacktestSignalTimelineItem(
                    date=final_date,
                    symbol=symbol,
                    signal="HOLD",
                    pattern_id=latest_match.pattern.id,
                    pattern=latest_match.pattern.name,
                    status="백테스트 종료",
                    note=signal_plan.hold_mode if signal_plan is not None else "백테스트 종료 시점 보유",
                    **artifact_payload,
                )
            )
            last_signal_by_symbol[symbol] = "HOLD"

        equity = equity.ffill().fillna(initial_cash)
        self._report_progress(
            progress_callback,
            stage="benchmark",
            stage_label="벤치마크 정렬",
            progress_percent=92,
            message=f"벤치마크 {benchmark_symbol}와 전략 곡선을 정렬하고 있습니다.",
            processed_count=total_rebalances,
            total_count=total_rebalances,
        )
        try:
            benchmark_source = self.benchmark_service.get_benchmark_series(benchmark_symbol, start_date, end_date)
        except Exception as exc:
            logger.warning(
                "benchmark load failed inside backtest engine; fallback to empty benchmark",
                extra={"benchmark_symbol": benchmark_symbol, "error": str(exc)},
                exc_info=exc,
            )
            benchmark_source = pd.Series(dtype=float)
        benchmark_curve = benchmark_source.reindex(trading_dates).ffill().dropna()
        metrics_benchmark_curve = pd.Series(dtype=float)
        if benchmark_curve.empty:
            benchmark_curve = pd.Series(initial_cash, index=trading_dates)
        else:
            benchmark_curve = benchmark_curve / benchmark_curve.iloc[0] * initial_cash
            metrics_benchmark_curve = benchmark_curve
        self._report_progress(
            progress_callback,
            stage="metrics",
            stage_label="성과 지표 집계",
            progress_percent=96,
            message="성과 지표, 종목별 성과, 패턴별 성과를 집계하고 있습니다.",
            processed_count=total_rebalances,
            total_count=total_rebalances,
        )
        metrics = self._compute_metrics(equity, metrics_benchmark_curve)
        if rebalance_records:
            metrics.turnover = float(np.mean([item.turnover for item in rebalance_records]))
        running_max = equity.cummax()
        drawdown_curve = equity / running_max - 1

        stock_breakdown = self._build_stock_breakdown(stock_segments, last_signal_by_symbol, signal_plan)
        total_segment_count = sum(len(segments) for segments in stock_segments.values())
        pattern_breakdown = self._build_pattern_breakdown(pattern_segments, total_segment_count)

        result = BacktestResult(
            strategy_id=strategy.id,
            benchmark_symbol=benchmark_symbol,
            metrics=metrics,
            equity_curve=[SeriesPoint(date=idx.date(), value=float(value)) for idx, value in equity.items()],
            benchmark_curve=[SeriesPoint(date=idx.date(), value=float(value)) for idx, value in benchmark_curve.items()],
            drawdown_curve=[SeriesPoint(date=idx.date(), value=float(value)) for idx, value in drawdown_curve.items()],
            rebalances=rebalance_records,
            stock_breakdown=stock_breakdown,
            pattern_breakdown=pattern_breakdown,
            trade_log=sorted(trade_log, key=lambda item: (item.date, item.symbol, item.action)),
            signal_timeline=sorted(signal_timeline, key=lambda item: (item.date, item.symbol, item.signal)),
            research_config=research_config,
        )
        return result, BacktestArtifacts(
            equity_curve=equity,
            benchmark_curve=benchmark_curve,
            returns=equity.pct_change().dropna(),
            benchmark_returns=benchmark_curve.pct_change().dropna(),
            rebalances=rebalance_records,
        )
