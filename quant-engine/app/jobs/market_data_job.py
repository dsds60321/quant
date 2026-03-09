from sqlalchemy.orm import Session

from app.schemas.data import DataUpdateRequest
from app.services.data_ingestion_service import DataIngestionService


class MarketDataJob:
    def __init__(self, session: Session) -> None:
        self.service = DataIngestionService(session)

    def run(self, request: DataUpdateRequest | None = None):
        return self.service.update(request or DataUpdateRequest())
