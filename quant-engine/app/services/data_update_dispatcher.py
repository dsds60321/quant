from __future__ import annotations

import json
import logging
from concurrent.futures import Future, ThreadPoolExecutor
from threading import Lock

from sqlalchemy import select

from app.database import session_scope, utc_now
from app.models import Job
from app.schemas.data import DataUpdateRequest, DataUpdateResult
from app.services.data_ingestion_service import DataIngestionService

logger = logging.getLogger(__name__)


class DataUpdateDispatcher:
    _executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="data-update")
    _lock = Lock()
    _active_future: Future | None = None
    _active_job_id: int | None = None

    @staticmethod
    def _load_metadata(job: Job | None) -> dict:
        if job is None or not job.metadata_json:
            return {}
        if isinstance(job.metadata_json, dict):
            return job.metadata_json
        if isinstance(job.metadata_json, (bytes, bytearray)):
            try:
                return json.loads(job.metadata_json.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError):
                return {}
        try:
            return json.loads(job.metadata_json)
        except (TypeError, json.JSONDecodeError):
            return {}

    @classmethod
    def enqueue(cls, request: DataUpdateRequest) -> DataUpdateResult:
        with cls._lock:
            running_job_id = cls._find_running_job_id()
            if running_job_id is not None:
                cls._active_job_id = running_job_id
                return DataUpdateResult(
                    accepted=False,
                    job_id=running_job_id,
                    status="RUNNING",
                    message="이미 데이터 동기화 작업이 실행 중입니다. 완료 후 다시 시도하세요.",
                )

            request_payload = request.model_dump()
            with session_scope() as session:
                job = Job(
                    job_type="data_update_dispatch",
                    status="PENDING",
                    message="queued",
                    metadata_json=json.dumps(
                        {
                            "kind": "dispatch",
                            "preset": request.preset,
                            "symbolCount": len(request.symbols),
                            "benchmarkCount": len(request.benchmark_symbols),
                            "period": request.period,
                            "interval": request.interval,
                            "progressPercent": 0,
                            "stage": "queued",
                            "stageLabel": "대기 중",
                            "processedCount": 0,
                            "totalCount": 0,
                        },
                        ensure_ascii=False,
                    ),
                )
                session.add(job)
                session.flush()
                job_id = job.id

            future = cls._executor.submit(cls._run_job, job_id, request_payload)
            cls._active_future = future
            cls._active_job_id = job_id

            return DataUpdateResult(
                accepted=True,
                job_id=job_id,
                status="QUEUED",
                message="데이터 동기화 작업이 백그라운드에 등록되었습니다.",
            )

    @classmethod
    def _find_running_job_id(cls) -> int | None:
        if cls._active_future is not None and not cls._active_future.done():
            return cls._active_job_id

        with session_scope() as session:
            jobs = session.scalars(
                select(Job)
                .where(Job.job_type == "data_update_dispatch", Job.status.in_(["PENDING", "RUNNING"]))
                .order_by(Job.created_at.desc())
            ).all()
            if not jobs:
                return None
            for job in jobs:
                cls._mark_job_tree_failed(session, job, "이전 데이터 동기화 프로세스가 중단되어 자동 실패 처리되었습니다.")
            return None

    @classmethod
    def _mark_job_tree_failed(cls, session, job: Job, message: str) -> None:
        pending_children = session.scalars(
            select(Job)
            .where(Job.parent_job_id == job.id, Job.status.in_(["PENDING", "RUNNING"]))
            .order_by(Job.created_at.desc())
        ).all()
        for child in pending_children:
            child.status = "FAILED"
            child.finished_at = utc_now()
            child.message = message
            child.metadata_json = json.dumps({"kind": "stage", "error": message}, ensure_ascii=False)
        job.status = "FAILED"
        job.finished_at = utc_now()
        job.message = message
        job.metadata_json = json.dumps({"kind": "dispatch", "error": message}, ensure_ascii=False)

    @classmethod
    def get_queue_state(cls) -> dict:
        with cls._lock:
            if cls._active_future is not None and not cls._active_future.done() and cls._active_job_id is not None:
                with session_scope() as session:
                    job = session.get(Job, cls._active_job_id)
                    if job is not None:
                        metadata = cls._load_metadata(job)
                        return {
                            "queue_status": "실행중" if job.status == "RUNNING" else "대기",
                            "active_job": {
                                "id": job.id,
                                "job_type": job.job_type,
                                "status": job.status,
                                "started_at": job.started_at,
                                "finished_at": job.finished_at,
                                "message": job.message,
                                "progress_percent": int(metadata.get("progressPercent") or 0),
                                "stage": metadata.get("stage"),
                                "stage_label": metadata.get("stageLabel"),
                                "processed_count": int(metadata.get("processedCount") or 0),
                                "total_count": int(metadata.get("totalCount") or 0),
                            },
                        }

            with session_scope() as session:
                jobs = session.scalars(
                    select(Job)
                    .where(Job.job_type == "data_update_dispatch", Job.status.in_(["PENDING", "RUNNING"]))
                    .order_by(Job.created_at.desc())
                ).all()
                if jobs:
                    for job in jobs:
                        cls._mark_job_tree_failed(session, job, "현재 실행 중인 작업 스레드가 없어 자동 실패 처리되었습니다.")
                return {"queue_status": "유휴", "active_job": None}

    @classmethod
    def _run_job(cls, job_id: int, payload: dict) -> None:
        try:
            with session_scope() as session:
                job = session.get(Job, job_id)
                if job is not None:
                    job.status = "RUNNING"
                    job.started_at = utc_now()
                    job.message = "심볼 목록을 준비하는 중입니다."
                    job.metadata_json = json.dumps(
                        {
                            "kind": "dispatch",
                            "preset": payload.get("preset"),
                            "symbolCount": len(payload.get("symbols") or []),
                            "benchmarkCount": len(payload.get("benchmark_symbols") or []),
                            "period": payload.get("period"),
                            "interval": payload.get("interval"),
                            "progressPercent": 1,
                            "stage": "preparing",
                            "stageLabel": "심볼 준비",
                            "processedCount": 0,
                            "totalCount": 0,
                        },
                        ensure_ascii=False,
                    )

            with session_scope() as session:
                service = DataIngestionService(session)
                primary_result = service.update(DataUpdateRequest(**payload), parent_job_id=job_id)
                result = primary_result
                if (payload.get("preset") or "").lower() == "full":
                    follow_up_payload = {
                        **payload,
                        "preset": "fundamentals_only",
                        "benchmark_symbols": [],
                    }
                    follow_up_result = service.update(
                        DataUpdateRequest(**follow_up_payload),
                        parent_job_id=job_id,
                        skip_initial_progress=True,
                    )
                    result = DataUpdateResult(
                        accepted=True,
                        status="COMPLETED",
                        message="전체 최신 갱신과 펀더멘털 후속 동기화가 완료되었습니다.",
                        prices_updated=(primary_result.prices_updated or 0) + (follow_up_result.prices_updated or 0),
                        fundamentals_updated=(primary_result.fundamentals_updated or 0) + (follow_up_result.fundamentals_updated or 0),
                        benchmarks_updated=(primary_result.benchmarks_updated or 0) + (follow_up_result.benchmarks_updated or 0),
                        jobs_written=[*primary_result.jobs_written, *follow_up_result.jobs_written],
                    )
                job = session.get(Job, job_id)
                if job is not None:
                    job.status = "COMPLETED"
                    job.finished_at = utc_now()
                    job.message = (
                        f"prices={result.prices_updated}, fundamentals={result.fundamentals_updated}, "
                        f"benchmarks={result.benchmarks_updated}"
                    )
                    job.metadata_json = json.dumps(
                        {
                            "kind": "dispatch",
                            "pricesUpdated": result.prices_updated,
                            "fundamentalsUpdated": result.fundamentals_updated,
                            "benchmarksUpdated": result.benchmarks_updated,
                            "childJobIds": result.jobs_written,
                            "progressPercent": 100,
                            "stage": "completed",
                            "stageLabel": "완료",
                            "processedCount": (result.prices_updated or 0) + (result.benchmarks_updated or 0),
                            "totalCount": (result.prices_updated or 0) + (result.benchmarks_updated or 0),
                        },
                        ensure_ascii=False,
                    )
        except Exception as exc:
            logger.exception("data update job failed", exc_info=exc)
            with session_scope() as session:
                job = session.get(Job, job_id)
                if job is not None:
                    job.status = "FAILED"
                    job.finished_at = utc_now()
                    job.message = str(exc)
                    job.metadata_json = json.dumps({"kind": "dispatch", "error": str(exc)}, ensure_ascii=False)
        finally:
            with cls._lock:
                if cls._active_job_id == job_id:
                    cls._active_future = None
                    cls._active_job_id = None
