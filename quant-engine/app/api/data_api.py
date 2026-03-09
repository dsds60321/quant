from fastapi import APIRouter, Body, Depends
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.schemas.common import ApiResponse
from app.schemas.data import DataUpdateRequest
from app.services.data_ingestion_service import DataIngestionService
from app.services.data_update_dispatcher import DataUpdateDispatcher

router = APIRouter(prefix="/data", tags=["data"])


@router.post("/update")
def update_data(request: DataUpdateRequest | None = Body(default=None), db: Session = Depends(get_db)):
    data = DataUpdateDispatcher.enqueue(request or DataUpdateRequest())
    return ApiResponse(data=data)


@router.get("/status")
def status(db: Session = Depends(get_db)):
    data = DataIngestionService(db).status()
    return ApiResponse(data=data)
