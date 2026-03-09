from datetime import date

from sqlalchemy.orm import Session

from app.schemas.factor import FactorCalculationRequest
from app.schemas.strategy import StrategySnapshot
from app.services.factor_service import FactorService


class FactorBatchJob:
    def __init__(self, session: Session) -> None:
        self.service = FactorService(session)

    def run(self, as_of_date: date | None = None):
        request = FactorCalculationRequest(as_of_date=as_of_date or date.today())
        strategy = StrategySnapshot(id=0, name="batch", stock_count=200)
        return self.service.calculate(request, strategy)
