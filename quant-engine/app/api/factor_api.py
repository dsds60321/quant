from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.schemas.common import ApiResponse
from app.schemas.factor import FactorCalculationRequest
from app.schemas.strategy import StrategySnapshot
from app.services.factor_service import FactorService

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


@router.post("/factor/calculate")
def calculate_factor(request: FactorCalculationRequest, db: Session = Depends(get_db)):
    service = FactorService(db)
    strategy = _ad_hoc_strategy(request)
    data = service.calculate(request, strategy)
    return ApiResponse(data=data)


@router.post("/strategy/candidates")
def generate_candidates(request: FactorCalculationRequest, db: Session = Depends(get_db)):
    service = FactorService(db)
    strategy = _ad_hoc_strategy(request)
    data = service.analyze_candidates(request, strategy)
    return ApiResponse(data=data)
