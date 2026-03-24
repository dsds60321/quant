from __future__ import annotations

from datetime import date, datetime
import json
import logging
from concurrent.futures import Future, ThreadPoolExecutor
from time import monotonic
from threading import Lock

from sqlalchemy import select

from app.config import get_settings
from app.database import session_scope, utc_now
from app.models import Job
from app.schemas.backtest import BacktestQueueResult, BacktestRequest
from app.services.backtest_service import BacktestService

logger = logging.getLogger(__name__)


class BacktestDispatcher:
    _executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="backtest")
    _lock = Lock()
    _active_future: Future | None = None
    _active_job_id: int | None = None
    _progress_state: dict[str, object] = {"job_id": None, "progress": -1, "stage": None, "updated_at": 0.0}

    @staticmethod
    def _describe_universe_scope(scope_payload: dict[str, object] | None) -> str:
        if not scope_payload:
            return "전략 기본 유니버스"
        override_mode = str(scope_payload.get("overrideMode") or scope_payload.get("override_mode") or "STRATEGY_DEFAULT").upper()
        if override_mode != "ONE_TIME_OVERRIDE":
            return "전략 기본 유니버스"
        mode = str(scope_payload.get("mode") or "FULL_MARKET").upper()
        if mode == "SPECIFIC_STOCKS":
            selected_stocks = scope_payload.get("selectedStocks") or scope_payload.get("selected_stocks") or []
            return f"특정 종목 {len(selected_stocks)}개"
        if mode == "SECTOR":
            sectors = scope_payload.get("selectedSectors") or scope_payload.get("selected_sectors") or []
            return f"섹터 {len(sectors)}개"
        if mode == "THEME":
            themes = scope_payload.get("selectedThemes") or scope_payload.get("selected_themes") or []
            return f"테마 {len(themes)}개"
        if mode == "PORTFOLIO":
            portfolio_name = scope_payload.get("portfolioName") or scope_payload.get("portfolio_name")
            return f"포트폴리오 {portfolio_name}" if portfolio_name else "포트폴리오 범위"
        market_scope = str(scope_payload.get("marketScope") or scope_payload.get("market_scope") or "GLOBAL").upper()
        if market_scope == "US":
            return "미국 전체 시장"
        if market_scope == "KOREA":
            return "한국 전체 시장"
        if market_scope == "GLOBAL":
            return "전체 주식 유니버스"
        return "전략 기본 유니버스"

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
    def _make_json_safe(cls, value):
        if isinstance(value, (date, datetime)):
            return value.isoformat()
        if isinstance(value, dict):
            return {str(key): cls._make_json_safe(item) for key, item in value.items()}
        if isinstance(value, (list, tuple, set)):
            return [cls._make_json_safe(item) for item in value]
        return value

    @classmethod
    def _serialize_metadata(cls, metadata: dict[str, object]) -> str:
        return json.dumps(cls._make_json_safe(metadata), ensure_ascii=False)

    @classmethod
    def _mark_job_failed(cls, session, job: Job, message: str, *, extra_metadata: dict[str, object] | None = None) -> None:
        metadata = cls._load_metadata(job)
        metadata.update({"kind": "backtest", "error": message})
        if extra_metadata:
            metadata.update(extra_metadata)
        job.status = "FAILED"
        job.finished_at = utc_now()
        job.message = message
        job.metadata_json = cls._serialize_metadata(metadata)

    @classmethod
    def recover_orphaned_jobs(cls, message: str | None = None) -> int:
        settings = get_settings()
        recovery_message = message or settings.backtest_orphan_recovery_message
        with cls._lock:
            cls._refresh_active_state_locked()
            if cls._active_future is not None and not cls._active_future.done():
                return 0
            with session_scope() as session:
                jobs = session.scalars(
                    select(Job)
                    .where(Job.job_type == "backtest_dispatch", Job.status.in_(["PENDING", "RUNNING"]))
                    .order_by(Job.created_at.desc())
                ).all()
                for job in jobs:
                    cls._mark_job_failed(
                        session,
                        job,
                        recovery_message,
                        extra_metadata={"recovered": True, "recoveredAt": utc_now().isoformat()},
                    )
                return len(jobs)

    @classmethod
    def _refresh_active_state_locked(cls) -> None:
        if cls._active_future is not None and cls._active_future.done():
            cls._active_future = None
            cls._active_job_id = None

    @classmethod
    def _recover_orphaned_jobs_locked(cls, message: str | None = None) -> None:
        cls._refresh_active_state_locked()
        if cls._active_future is not None and not cls._active_future.done():
            return
        settings = get_settings()
        recovery_message = message or settings.backtest_orphan_recovery_message
        with session_scope() as session:
            jobs = session.scalars(
                select(Job)
                .where(Job.job_type == "backtest_dispatch", Job.status.in_(["PENDING", "RUNNING"]))
                .order_by(Job.created_at.desc())
            ).all()
            for job in jobs:
                cls._mark_job_failed(
                    session,
                    job,
                    recovery_message,
                    extra_metadata={"recovered": True, "recoveredAt": utc_now().isoformat()},
                )

    @classmethod
    def enqueue(cls, request: BacktestRequest) -> BacktestQueueResult:
        with cls._lock:
            cls._recover_orphaned_jobs_locked()
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
                "universeScope": request.universe_scope.model_dump(mode="json", by_alias=True) if request.universe_scope is not None else None,
                "patternDefinitions": [item.model_dump(mode="json", by_alias=True) for item in request.pattern_definitions],
                "signalPlan": request.signal_plan.model_dump(mode="json", by_alias=True) if request.signal_plan is not None else None,
                "progressPercent": 0,
                "stage": "queued",
                "stageLabel": "대기 중",
                "processedCount": 0,
                "totalCount": 0,
            }
            with session_scope() as session:
                job = Job(
                    job_type="backtest_dispatch",
                    status="PENDING",
                    message=f"{cls._describe_universe_scope(metadata.get('universeScope'))} 기준 백테스트를 대기열에 등록했습니다.",
                    metadata_json=cls._serialize_metadata(metadata),
                )
                session.add(job)
                session.flush()
                job_id = job.id

            future = cls._executor.submit(cls._run_job, job_id, request.model_dump())
            cls._active_future = future
            cls._active_job_id = job_id
            cls._progress_state = {"job_id": job_id, "progress": 0, "stage": "queued", "updated_at": monotonic()}
            return BacktestQueueResult(
                accepted=True,
                job_id=job_id,
                status="QUEUED",
                message=f"{cls._describe_universe_scope(metadata.get('universeScope'))} 기준 백테스트를 백그라운드 큐에 등록했습니다.",
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
                    and metadata.get("universeScope") == (request.universe_scope.model_dump(mode="json", by_alias=True) if request.universe_scope is not None else None)
                    and metadata.get("patternDefinitions") == [item.model_dump(mode="json", by_alias=True) for item in request.pattern_definitions]
                    and metadata.get("signalPlan") == (request.signal_plan.model_dump(mode="json", by_alias=True) if request.signal_plan is not None else None)
                ):
                    return job
        return None

    @classmethod
    def _build_progress_reporter(cls, job_id: int):
        def report(payload: dict[str, object]) -> None:
            progress = max(0, min(int(payload.get("progressPercent") or 0), 99))
            stage = str(payload.get("stage") or "")
            now = monotonic()
            with cls._lock:
                state_job_id = cls._progress_state.get("job_id")
                last_progress = int(cls._progress_state.get("progress") or -1)
                last_stage = cls._progress_state.get("stage")
                last_updated = float(cls._progress_state.get("updated_at") or 0.0)
                should_skip = (
                    state_job_id == job_id
                    and stage == last_stage
                    and progress <= last_progress
                    and now - last_updated < 1.0
                )
                if should_skip:
                    return
                cls._progress_state = {"job_id": job_id, "progress": progress, "stage": stage, "updated_at": now}

            with session_scope() as session:
                job = session.get(Job, job_id)
                if job is None or job.status not in ["PENDING", "RUNNING"]:
                    return
                metadata = cls._load_metadata(job)
                metadata.update(
                    {
                        "kind": "backtest",
                        "progressPercent": progress,
                        "stage": payload.get("stage"),
                        "stageLabel": payload.get("stageLabel"),
                        "processedCount": int(payload.get("processedCount") or 0),
                        "totalCount": int(payload.get("totalCount") or 0),
                    }
                )
                for key, value in payload.items():
                    if key not in {"progressPercent", "stage", "stageLabel", "processedCount", "totalCount", "message"}:
                        metadata[key] = value
                job.message = str(payload.get("message") or job.message or "running")
                job.metadata_json = cls._serialize_metadata(metadata)

        return report

    @classmethod
    def _run_job(cls, job_id: int, payload: dict) -> None:
        try:
            with session_scope() as session:
                job = session.get(Job, job_id)
                if job is not None:
                    job.status = "RUNNING"
                    job.started_at = utc_now()
                    metadata = cls._load_metadata(job)
                    scope_label = cls._describe_universe_scope(metadata.get("universeScope"))
                    job.message = f"{scope_label} 기준으로 전략, 기간, 연구 설정을 검증하고 있습니다."
                    metadata.update(
                        {
                            "kind": "backtest",
                            "progressPercent": 1,
                            "stage": "preparing",
                            "stageLabel": "전략 / 기간 검증",
                            "processedCount": 0,
                            "totalCount": 0,
                        }
                    )
                    job.metadata_json = cls._serialize_metadata(metadata)

            progress_reporter = cls._build_progress_reporter(job_id)
            with session_scope() as session:
                result = BacktestService(session).run_backtest(BacktestRequest(**payload), progress_callback=progress_reporter)
                selection_counts = [len(item.selections) for item in result.rebalances]
                rebalance_count = len(result.rebalances)
                average_selection_count = (sum(selection_counts) / rebalance_count) if rebalance_count > 0 else 0.0
                latest_selection_count = selection_counts[-1] if selection_counts else 0
                job = session.get(Job, job_id)
                if job is not None and job.status in ["PENDING", "RUNNING"]:
                    job.status = "COMPLETED"
                    job.finished_at = utc_now()
                    metadata = cls._load_metadata(job)
                    scope_label = cls._describe_universe_scope(metadata.get("universeScope"))
                    cagr_label = f"{round(float(result.metrics.cagr or 0.0) * 100, 2)}%" if result.metrics.cagr is not None else "-"
                    sharpe_label = f"{round(float(result.metrics.sharpe or 0.0), 2)}" if result.metrics.sharpe is not None else "-"
                    job.message = (
                        f"{scope_label} 백테스트가 완료되었습니다. "
                        f"CAGR {cagr_label}, 샤프 {sharpe_label}, 최신 편입 {latest_selection_count}종목입니다."
                    )
                    job.metadata_json = cls._serialize_metadata(
                        {
                            "kind": "backtest",
                            "strategyId": result.strategy_id,
                            "snapshotId": payload.get("snapshot_id"),
                            "startDate": payload.get("start_date"),
                            "endDate": payload.get("end_date"),
                            "backtestId": result.backtest_id,
                            "benchmarkSymbol": result.benchmark_symbol,
                            "universeScope": metadata.get("universeScope"),
                            "cagr": result.metrics.cagr,
                            "sharpe": result.metrics.sharpe,
                            "maxDrawdown": result.metrics.max_drawdown,
                            "winRate": result.metrics.win_rate,
                            "rebalanceCount": rebalance_count,
                            "averageSelectionCount": average_selection_count,
                            "latestSelectionCount": latest_selection_count,
                            "patternCount": len(result.research_config.pattern_definitions) if result.research_config is not None else 0,
                            "progressPercent": 100,
                            "stage": "completed",
                            "stageLabel": "완료",
                            "processedCount": rebalance_count,
                            "totalCount": rebalance_count,
                        }
                    )
        except Exception as exc:
            logger.exception("backtest job failed", exc_info=exc)
            with session_scope() as session:
                job = session.get(Job, job_id)
                if job is not None and job.status in ["PENDING", "RUNNING"]:
                    metadata = cls._load_metadata(job)
                    metadata.update(
                        {
                            "kind": "backtest",
                            "error": str(exc),
                            "progressPercent": int(metadata.get("progressPercent") or 0),
                            "stage": "failed",
                            "stageLabel": "실패",
                        }
                    )
                    job.status = "FAILED"
                    job.finished_at = utc_now()
                    job.message = str(exc)
                    job.metadata_json = cls._serialize_metadata(metadata)
        finally:
            with cls._lock:
                if cls._active_job_id == job_id:
                    cls._active_future = None
                    cls._active_job_id = None
                if cls._progress_state.get("job_id") == job_id:
                    cls._progress_state = {"job_id": None, "progress": -1, "stage": None, "updated_at": 0.0}
