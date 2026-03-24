from __future__ import annotations

from datetime import date

import pandas as pd
from sqlalchemy.orm import Session

from app.exceptions import ValidationError
from app.engines.factor_engine import FactorContext, FactorEngine
from app.repositories.earnings_event_repository import EarningsEventRepository
from app.engines.scoring_engine import ScoringEngine
from app.repositories.factor_repository import FactorRepository
from app.repositories.insider_trade_repository import InsiderTradeRepository
from app.repositories.news_signal_repository import NewsSignalRepository
from app.schemas.factor import CandidateAnalysisResponse, CandidateResponse, FactorCalculationRequest, FactorSnapshot, UniverseDiagnostics
from app.schemas.strategy import StrategySnapshot
from app.services.universe_service import UniverseService


class FactorService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.universe_service = UniverseService(session)
        self.factor_engine = FactorEngine()
        self.factor_repository = FactorRepository(session)
        self.news_signal_repository = NewsSignalRepository(session)
        self.earnings_event_repository = EarningsEventRepository(session)
        self.insider_trade_repository = InsiderTradeRepository(session)
        self.scoring_engine = ScoringEngine()

    @staticmethod
    def _is_direct_selection_mode(universe_config) -> bool:
        return bool(
            universe_config is not None
            and universe_config.force_include_allowed_symbols
            and universe_config.allowed_symbols
        )

    @staticmethod
    def _fundamental_ready_count(frame: pd.DataFrame) -> int:
        if frame.empty:
            return 0
        fundamental_columns = [column for column in ["per", "pbr", "roe", "market_cap"] if column in frame.columns]
        if not fundamental_columns:
            return 0
        return int(frame[frame[fundamental_columns].notna().any(axis=1)]["symbol"].nunique())

    def _build_diagnostics(
        self,
        eligible: list[str],
        price_frame: pd.DataFrame,
        fundamental_frame: pd.DataFrame,
        factor_frame: pd.DataFrame,
        selected: pd.DataFrame,
        strategy: StrategySnapshot,
        requested_symbol_count: int | None = None,
        universe_config=None,
    ) -> UniverseDiagnostics:
        total_symbols = 0
        price_ready_count = 0
        fundamentals_ready_count = 0
        roe_pass_count = 0
        pbr_pass_count = 0
        momentum_pass_count = 0

        metadata = self.universe_service.stock_repository.get_metadata_frame()
        if requested_symbol_count is not None:
            total_symbols = requested_symbol_count
        elif not metadata.empty:
            total_symbols = int(
                metadata.apply(
                    lambda row: self.universe_service._is_factor_eligible_instrument(str(row["symbol"]), row.get("name")),
                    axis=1,
                ).sum()
            )
        elif not price_frame.empty:
            total_symbols = int(price_frame["symbol"].nunique())

        price_ready_count = len(set(eligible))
        if not factor_frame.empty:
            fundamentals_ready_count = self._fundamental_ready_count(factor_frame)
            if self._is_direct_selection_mode(universe_config):
                roe_pass_count = fundamentals_ready_count
                pbr_pass_count = fundamentals_ready_count
                momentum_pass_count = fundamentals_ready_count
            else:
                after_roe = factor_frame.copy()
                if strategy.roe_filter is not None:
                    after_roe = after_roe[after_roe["roe"].isna() | (after_roe["roe"] >= float(strategy.roe_filter))]
                roe_pass_count = int(after_roe["symbol"].nunique())

                after_pbr = after_roe.copy()
                if strategy.pbr_filter is not None:
                    after_pbr = after_pbr[after_pbr["pbr"].isna() | (after_pbr["pbr"] <= float(strategy.pbr_filter))]
                pbr_pass_count = int(after_pbr["symbol"].nunique())

                after_momentum = after_pbr.copy()
                if strategy.momentum_filter is not None:
                    after_momentum = after_momentum[after_momentum["momentum_raw"].isna() | (after_momentum["momentum_raw"] >= float(strategy.momentum_filter))]
                momentum_pass_count = int(after_momentum["symbol"].nunique())

        return UniverseDiagnostics(
            total_symbols=total_symbols,
            price_ready_count=price_ready_count,
            fundamentals_ready_count=fundamentals_ready_count,
            roe_pass_count=roe_pass_count,
            pbr_pass_count=pbr_pass_count,
            momentum_pass_count=momentum_pass_count,
            final_selected_count=int(selected["symbol"].nunique()) if not selected.empty else 0,
        )

    def calculate(self, request: FactorCalculationRequest, strategy: StrategySnapshot) -> list[FactorSnapshot]:
        as_of_date = request.as_of_date or date.today()
        eligible, price_frame, fundamental_frame, fundamental_history = self.universe_service.build_universe(as_of_date, request.universe)
        if price_frame.empty or not eligible:
            raise ValidationError("팩터 계산에 필요한 시세 데이터가 없습니다. 데이터 센터에서 종목 동기화를 먼저 실행하세요.")
        context = FactorContext(
            as_of_date=pd.Timestamp(as_of_date),
            price_frame=price_frame,
            fundamental_frame=fundamental_frame,
            fundamental_history=fundamental_history,
            news_frame=self.news_signal_repository.get_recent_sentiment_scores(as_of_date, symbols=eligible),
            earnings_frame=self.earnings_event_repository.get_recent_surprise_scores(as_of_date, symbols=eligible),
            insider_frame=self.insider_trade_repository.get_recent_activity_scores(as_of_date, symbols=eligible),
        )
        factor_frame = self.factor_engine.calculate(context, eligible)
        self.factor_repository.replace_for_date(as_of_date, factor_frame)
        selected = self.scoring_engine.score(factor_frame, strategy, request.universe)
        return [
            FactorSnapshot(
                symbol=row["symbol"],
                momentum=row.get("momentum"),
                volatility=row.get("volatility"),
                value_score=row.get("value_score"),
                quality_score=row.get("quality_score"),
                growth_score=row.get("growth_score"),
                liquidity_score=row.get("liquidity_score"),
                final_score=row.get("final_score"),
            )
            for row in selected.to_dict(orient="records")
        ]

    def analyze_candidates(self, request: FactorCalculationRequest, strategy: StrategySnapshot) -> CandidateAnalysisResponse:
        as_of_date = request.as_of_date or date.today()
        requested_symbol_count = len(request.universe.allowed_symbols) if request.universe.allowed_symbols is not None else None
        eligible, price_frame, fundamental_frame, fundamental_history = self.universe_service.build_universe(as_of_date, request.universe)
        if price_frame.empty or not eligible:
            diagnostics = self._build_diagnostics(
                eligible,
                price_frame,
                fundamental_frame,
                pd.DataFrame(),
                pd.DataFrame(),
                strategy,
                requested_symbol_count=requested_symbol_count,
                universe_config=request.universe,
            )
            return CandidateAnalysisResponse(candidates=[], diagnostics=diagnostics)

        context = FactorContext(
            as_of_date=pd.Timestamp(as_of_date),
            price_frame=price_frame,
            fundamental_frame=fundamental_frame,
            fundamental_history=fundamental_history,
            news_frame=self.news_signal_repository.get_recent_sentiment_scores(as_of_date, symbols=eligible),
            earnings_frame=self.earnings_event_repository.get_recent_surprise_scores(as_of_date, symbols=eligible),
            insider_frame=self.insider_trade_repository.get_recent_activity_scores(as_of_date, symbols=eligible),
        )
        factor_frame = self.factor_engine.calculate(context, eligible)
        self.factor_repository.replace_for_date(as_of_date, factor_frame)
        selected = self.scoring_engine.score(factor_frame, strategy, request.universe)
        diagnostics = self._build_diagnostics(
            eligible,
            price_frame,
            fundamental_frame,
            factor_frame,
            selected,
            strategy,
            requested_symbol_count=requested_symbol_count,
            universe_config=request.universe,
        )
        candidates = [
            CandidateResponse(symbol=row["symbol"], score=float(row.get("final_score") or 0.0))
            for row in selected.to_dict(orient="records")
        ]
        return CandidateAnalysisResponse(candidates=candidates, diagnostics=diagnostics)

    def generate_candidates(self, request: FactorCalculationRequest, strategy: StrategySnapshot) -> list[CandidateResponse]:
        return self.analyze_candidates(request, strategy).candidates
