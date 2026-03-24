from __future__ import annotations

from typing import Callable

from sqlalchemy.orm import Session

from app.exceptions import ValidationError
from app.engines.backtest_engine import BacktestEngine
from app.repositories.backtest_repository import BacktestRepository
from app.repositories.fundamental_repository import FundamentalRepository
from app.repositories.strategy_repository import StrategyRepository
from app.schemas.backtest import BacktestRequest, BacktestResearchConfig, BacktestResult
from app.schemas.factor import FactorCalculationRequest, UniverseConfig
from app.services.factor_service import FactorService
from app.services.universe_service import UniverseService


class BacktestService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.strategy_repository = StrategyRepository(session)
        self.backtest_repository = BacktestRepository(session)
        self.fundamental_repository = FundamentalRepository(session)
        self.backtest_engine = BacktestEngine(session)
        self.factor_service = FactorService(session)
        self.universe_service = UniverseService(session)

    def _build_diagnostic_message(self, request: BacktestRequest, strategy, universe_config: UniverseConfig | None = None) -> str:
        analysis = self.factor_service.analyze_candidates(
            FactorCalculationRequest(
                as_of_date=request.end_date,
                stock_count=strategy.stock_count,
                rebalance=strategy.rebalance_period,
                roe=float(strategy.roe_filter) if strategy.roe_filter is not None else None,
                pbr=float(strategy.pbr_filter) if strategy.pbr_filter is not None else None,
                momentum=float(strategy.momentum_filter) if strategy.momentum_filter is not None else None,
                universe=universe_config or UniverseConfig(),
            ),
            strategy,
        )
        diagnostics = analysis.diagnostics
        earliest_fundamental_date = self.fundamental_repository.get_earliest_fundamental_date()
        history_hint = (
            f" 현재 저장된 펀더멘털 시작일은 {earliest_fundamental_date}입니다."
            if earliest_fundamental_date is not None and request.start_date < earliest_fundamental_date
            else ""
        )
        universe_hint = (
            f"직접 선택 종목 {len(universe_config.allowed_symbols or [])}개 기준으로 "
            if universe_config is not None and universe_config.force_include_allowed_symbols and universe_config.allowed_symbols is not None
            else f"선택한 유니버스 {len(universe_config.allowed_symbols or [])}개 기준으로 "
            if universe_config is not None and universe_config.allowed_symbols is not None
            else ""
        )
        mode_hint = (
            "특정 종목 직접 분석 모드에서는 ROE/PBR/모멘텀 컷을 우회하고 가격/재무 데이터 보유 여부만 확인합니다. "
            if universe_config is not None and universe_config.force_include_allowed_symbols
            else ""
        )
        return (
            f"{universe_hint}{mode_hint}전략 조건을 통과한 종목이 없어 백테스트를 진행할 수 없습니다. "
            f"전체 {diagnostics.total_symbols}개, 가격 통과 {diagnostics.price_ready_count}개, "
            f"재무 데이터 보유 {diagnostics.fundamentals_ready_count}개, ROE 통과 {diagnostics.roe_pass_count}개, "
            f"PBR 통과 {diagnostics.pbr_pass_count}개, 모멘텀 통과 {diagnostics.momentum_pass_count}개입니다."
            f"{history_hint}"
        )

    def run_backtest(
        self,
        request: BacktestRequest,
        progress_callback: Callable[[dict[str, object]], None] | None = None,
    ) -> BacktestResult:
        strategy = self.strategy_repository.get_strategy_snapshot(request.strategy_id)
        if request.factor_weight_mode.upper() == "MANUAL":
            total = sum(max(item.factor_weight, 0.0) for item in request.factor_weights)
            if total > 0:
                strategy = strategy.model_copy(
                    update={
                        "factor_weights": {
                            item.factor_name.lower(): round(max(item.factor_weight, 0.0) / total, 6)
                            for item in request.factor_weights
                        }
                    }
                )
        resolved_scope = self.universe_service.resolve_universe_scope(request.universe_scope)
        universe_config = None
        if resolved_scope.allowed_symbols is not None:
            universe_config = UniverseConfig(
                allowed_symbols=resolved_scope.allowed_symbols,
                preserve_explicit_symbols=resolved_scope.scope.mode in {"SPECIFIC_STOCKS", "PORTFOLIO"},
                force_include_allowed_symbols=resolved_scope.scope.mode == "SPECIFIC_STOCKS",
            )
        result, artifacts = self.backtest_engine.run(
            strategy,
            start_date=request.start_date,
            end_date=request.end_date,
            benchmark_symbol=request.benchmark_symbol,
            commission_rate=request.commission_rate,
            slippage_rate=request.slippage_rate,
            tax_rate=request.tax_rate,
            initial_cash=request.initial_cash,
            universe_config=universe_config,
            pattern_definitions=request.pattern_definitions,
            signal_plan=request.signal_plan,
            progress_callback=progress_callback,
        )
        if not result.equity_curve:
            raise ValidationError(self._build_diagnostic_message(request, strategy, universe_config))
        if result.rebalances and max((len(item.selections) for item in result.rebalances), default=0) == 0:
            raise ValidationError(self._build_diagnostic_message(request, strategy, universe_config))
        if request.pattern_definitions or request.signal_plan is not None:
            result.research_config = BacktestResearchConfig(
                pattern_definitions=request.pattern_definitions,
                signal_plan=request.signal_plan,
            )
        result.universe_scope = resolved_scope.scope
        backtest = self.backtest_repository.create_backtest(
            strategy.id,
            request.start_date,
            request.end_date,
            result.metrics.model_dump(),
            snapshot_id=request.snapshot_id,
            stock_breakdown=[item.model_dump(mode="json", by_alias=True) for item in result.stock_breakdown],
            pattern_breakdown=[item.model_dump(mode="json", by_alias=True) for item in result.pattern_breakdown],
            trade_log=[item.model_dump(mode="json", by_alias=True) for item in result.trade_log],
            signal_timeline=[item.model_dump(mode="json", by_alias=True) for item in result.signal_timeline],
            research_config=result.research_config.model_dump(mode="json", by_alias=True) if result.research_config is not None else None,
            universe_scope=resolved_scope.scope.model_dump(mode="json", by_alias=True),
        )
        self.backtest_repository.replace_equity_curve(backtest.id, artifacts.equity_curve)
        self.session.commit()
        result.backtest_id = backtest.id
        return result
