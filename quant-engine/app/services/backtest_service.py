from __future__ import annotations

from sqlalchemy.orm import Session

from app.exceptions import ValidationError
from app.engines.backtest_engine import BacktestEngine
from app.repositories.backtest_repository import BacktestRepository
from app.repositories.fundamental_repository import FundamentalRepository
from app.repositories.strategy_repository import StrategyRepository
from app.schemas.backtest import BacktestRequest, BacktestResult
from app.schemas.factor import FactorCalculationRequest
from app.services.factor_service import FactorService


class BacktestService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.strategy_repository = StrategyRepository(session)
        self.backtest_repository = BacktestRepository(session)
        self.fundamental_repository = FundamentalRepository(session)
        self.backtest_engine = BacktestEngine(session)
        self.factor_service = FactorService(session)

    def _build_diagnostic_message(self, request: BacktestRequest, strategy) -> str:
        analysis = self.factor_service.analyze_candidates(
            FactorCalculationRequest(
                as_of_date=request.end_date,
                stock_count=strategy.stock_count,
                rebalance=strategy.rebalance_period,
                roe=float(strategy.roe_filter) if strategy.roe_filter is not None else None,
                pbr=float(strategy.pbr_filter) if strategy.pbr_filter is not None else None,
                momentum=float(strategy.momentum_filter) if strategy.momentum_filter is not None else None,
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
        return (
            "전략 조건을 통과한 종목이 없어 백테스트를 진행할 수 없습니다. "
            f"전체 {diagnostics.total_symbols}개, 가격 통과 {diagnostics.price_ready_count}개, "
            f"재무 데이터 보유 {diagnostics.fundamentals_ready_count}개, ROE 통과 {diagnostics.roe_pass_count}개, "
            f"PBR 통과 {diagnostics.pbr_pass_count}개, 모멘텀 통과 {diagnostics.momentum_pass_count}개입니다."
            f"{history_hint}"
        )

    def run_backtest(self, request: BacktestRequest) -> BacktestResult:
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
        result, artifacts = self.backtest_engine.run(
            strategy,
            start_date=request.start_date,
            end_date=request.end_date,
            benchmark_symbol=request.benchmark_symbol,
            commission_rate=request.commission_rate,
            slippage_rate=request.slippage_rate,
            tax_rate=request.tax_rate,
            initial_cash=request.initial_cash,
        )
        if not result.equity_curve:
            raise ValidationError(self._build_diagnostic_message(request, strategy))
        if result.rebalances and max((len(item.selections) for item in result.rebalances), default=0) == 0:
            raise ValidationError(self._build_diagnostic_message(request, strategy))
        backtest = self.backtest_repository.create_backtest(
            strategy.id,
            request.start_date,
            request.end_date,
            result.metrics.model_dump(),
            snapshot_id=request.snapshot_id,
        )
        self.backtest_repository.replace_equity_curve(backtest.id, artifacts.equity_curve)
        self.session.commit()
        result.backtest_id = backtest.id
        return result
