from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.schemas.common import ApiResponse
from app.schemas.factor import FactorCalculationRequest
from app.schemas.strategy import StrategySnapshot
from app.services.factor_service import FactorService
from app.services.universe_service import UniverseService

router = APIRouter(tags=["factor"])


def _ad_hoc_strategy(request: FactorCalculationRequest) -> StrategySnapshot:
    total = sum(max(item.factor_weight, 0.0) for item in request.factor_weights)
    weights = {}
    if request.factor_weight_mode.upper() == "MANUAL" and total > 0:
        weights = {
            item.factor_name.lower(): round(max(item.factor_weight, 0.0) / total, 6)
            for item in request.factor_weights
        }
    return StrategySnapshot(
        id=0,
        name="adhoc",
        roe_filter=request.roe,
        pbr_filter=request.pbr,
        momentum_filter=request.momentum,
        stock_count=request.stock_count,
        rebalance_period=request.rebalance,
        weighting_method="equal_weight",
        status="DRAFT",
        factor_weights=weights,
    )


def _resolved_request(request: FactorCalculationRequest, db: Session) -> FactorCalculationRequest:
    if request.universe_scope is None:
        return request
    scope_service = UniverseService(db)
    effective_scope = request.universe_scope.model_copy(deep=True)
    # Strategy candidate analysis uses the strategy's saved universe as the
    # authoritative scope, even when it is not marked as a one-time override.
    if effective_scope.override_mode != "ONE_TIME_OVERRIDE":
        effective_scope.override_mode = "ONE_TIME_OVERRIDE"
    resolved_scope = scope_service.resolve_universe_scope(effective_scope)
    if resolved_scope.allowed_symbols is None:
        return request
    return request.model_copy(
        update={
            "universe_scope": resolved_scope.scope,
            "universe": request.universe.model_copy(
                update={
                    "allowed_symbols": resolved_scope.allowed_symbols,
                    "preserve_explicit_symbols": resolved_scope.scope.mode in {"SPECIFIC_STOCKS", "PORTFOLIO"},
                }
            )
        }
    )


@router.post("/factor/calculate")
def calculate_factor(request: FactorCalculationRequest, db: Session = Depends(get_db)):
    resolved_request = _resolved_request(request, db)
    service = FactorService(db)
    strategy = _ad_hoc_strategy(resolved_request)
    data = service.calculate(resolved_request, strategy)
    return ApiResponse(data=data)


@router.post("/strategy/candidates")
def generate_candidates(request: FactorCalculationRequest, db: Session = Depends(get_db)):
    resolved_request = _resolved_request(request, db)
    service = FactorService(db)
    strategy = _ad_hoc_strategy(resolved_request)
    data = service.analyze_candidates(resolved_request, strategy)
    return ApiResponse(data=data)
