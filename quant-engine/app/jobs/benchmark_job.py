from sqlalchemy.orm import Session

from app.schemas.data import DataUpdateRequest
from app.services.data_ingestion_service import DataIngestionService


class BenchmarkJob:
    def __init__(self, session: Session) -> None:
        self.service = DataIngestionService(session)

    def run(self, benchmark_symbols: list[str]):
        return self.service.update(DataUpdateRequest(symbols=[], benchmark_symbols=benchmark_symbols))
