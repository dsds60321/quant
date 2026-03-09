from __future__ import annotations

import json
import logging
from concurrent.futures import Future, ThreadPoolExecutor
from threading import Lock

from sqlalchemy import select

from app.database import session_scope, utc_now
from app.models import Job
from app.schemas.backtest import BacktestQueueResult, BacktestRequest
from app.services.backtest_service import BacktestService

logger = logging.getLogger(__name__)


class BacktestDispatcher:
    _executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="backtest")
    _lock = Lock()
    _futures: dict[int, Future] = {}

    @classmethod
    def enqueue(cls, request: BacktestRequest) -> BacktestQueueResult:
        with cls._lock:
            duplicate_job = cls._find_duplicate_job(request)
            if duplicate_job is not None:
                return BacktestQueueResult(
                    accepted=False,
                    job_id=duplicate_job.id,
                    status=duplicate_job.status,
                    message="동일한 백테스트 작업이 이미 큐에서 처리 중입니다.",
                )

            metadata = {
                "kind": "backtest",
                "strategyId": request.strategy_id,
                "snapshotId": request.snapshot_id,
                "startDate": request.start_date.isoformat(),
                "endDate": request.end_date.isoformat(),
                "benchmarkSymbol": request.benchmark_symbol,
            }
            with session_scope() as session:
                job = Job(
                    job_type="backtest_dispatch",
                    status="PENDING",
                    message="queued",
                    metadata_json=json.dumps(metadata, ensure_ascii=False),
                )
                session.add(job)
                session.flush()
                job_id = job.id

            future = cls._executor.submit(cls._run_job, job_id, request.model_dump())
            cls._futures[job_id] = future
            return BacktestQueueResult(
                accepted=True,
                job_id=job_id,
                status="QUEUED",
                message="백테스트 작업이 백그라운드 큐에 등록되었습니다.",
            )

    @classmethod
    def _find_duplicate_job(cls, request: BacktestRequest) -> Job | None:
        with session_scope() as session:
            jobs = session.scalars(
                select(Job)
                .where(Job.job_type == "backtest_dispatch", Job.status.in_(["PENDING", "RUNNING"]))
                .order_by(Job.created_at.desc())
                .limit(50)
            ).all()
            for job in jobs:
                try:
                    metadata = json.loads(job.metadata_json or "{}")
                except Exception:
                    metadata = {}
                if (
                    metadata.get("strategyId") == request.strategy_id
                    and metadata.get("snapshotId") == request.snapshot_id
                    and metadata.get("startDate") == request.start_date.isoformat()
                    and metadata.get("endDate") == request.end_date.isoformat()
                    and metadata.get("benchmarkSymbol") == request.benchmark_symbol
                ):
                    return job
        return None

    @classmethod
    def _run_job(cls, job_id: int, payload: dict) -> None:
        try:
            with session_scope() as session:
                job = session.get(Job, job_id)
                if job is not None:
                    job.status = "RUNNING"
                    job.started_at = utc_now()
                    job.message = "running"

            with session_scope() as session:
                result = BacktestService(session).run_backtest(BacktestRequest(**payload))
                selection_counts = [len(item.selections) for item in result.rebalances]
                rebalance_count = len(result.rebalances)
                average_selection_count = (sum(selection_counts) / rebalance_count) if rebalance_count > 0 else 0.0
                latest_selection_count = selection_counts[-1] if selection_counts else 0
                job = session.get(Job, job_id)
                if job is not None:
                    job.status = "COMPLETED"
                    job.finished_at = utc_now()
                    job.message = (
                        f"backtestId={result.backtest_id}, "
                        f"cagr={result.metrics.cagr}, sharpe={result.metrics.sharpe}, "
                        f"rebalanceCount={rebalance_count}, latestSelectionCount={latest_selection_count}"
                    )
                    job.metadata_json = json.dumps(
                        {
                            "kind": "backtest",
                            "strategyId": result.strategy_id,
                            "snapshotId": payload.get("snapshot_id"),
                            "backtestId": result.backtest_id,
                            "benchmarkSymbol": result.benchmark_symbol,
                            "cagr": result.metrics.cagr,
                            "sharpe": result.metrics.sharpe,
                            "maxDrawdown": result.metrics.max_drawdown,
                            "winRate": result.metrics.win_rate,
                            "rebalanceCount": rebalance_count,
                            "averageSelectionCount": average_selection_count,
                            "latestSelectionCount": latest_selection_count,
                        },
                        ensure_ascii=False,
                    )
        except Exception as exc:
            logger.exception("backtest job failed", exc_info=exc)
            with session_scope() as session:
                job = session.get(Job, job_id)
                if job is not None:
                    job.status = "FAILED"
                    job.finished_at = utc_now()
                    job.message = str(exc)
                    job.metadata_json = json.dumps({"kind": "backtest", "error": str(exc)}, ensure_ascii=False)
        finally:
            with cls._lock:
                cls._futures.pop(job_id, None)
