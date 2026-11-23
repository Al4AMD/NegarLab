from __future__ import annotations

import asyncio
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime

from .errors import ApiError

TERMINAL_STATUSES = {"done", "cancelled", "failed"}


@dataclass
class Job:
    id: str
    task: str
    params: dict[str, object]
    status: str = "queued"
    progress: int = 0
    message: str | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    cancel_event: asyncio.Event = field(default_factory=asyncio.Event)
    done_event: asyncio.Event = field(default_factory=asyncio.Event)

    def snapshot(self) -> dict[str, object]:
        return {
            "job_id": self.id,
            "task": self.task,
            "status": self.status,
            "progress": self.progress,
            "message": self.message,
        }


class JobRegistry:
    """In-process job runner. One API process per deployment (see compose.yaml)."""

    def __init__(self, max_concurrency: int = 2, step_delay_ms: int = 50) -> None:
        self._semaphore = asyncio.Semaphore(max(1, max_concurrency))
        self._step_delay = max(0, step_delay_ms) / 1000.0
        self._jobs: dict[str, Job] = {}

    async def submit(self, task: str, params: dict[str, object]) -> str:
        if task != "progress-demo":
            raise ApiError("unknown_task", 422, f"Unknown task: {task}")
        job = Job(id=uuid.uuid4().hex, task=task, params=params)
        self._jobs[job.id] = job
        asyncio.create_task(self._run(job))
        return job.id

    def get(self, job_id: str) -> dict[str, object] | None:
        job = self._jobs.get(job_id)
        return job.snapshot() if job is not None else None

    async def cancel(self, job_id: str) -> bool:
        job = self._jobs.get(job_id)
        if job is None or job.status in TERMINAL_STATUSES:
            return False
        job.cancel_event.set()
        if job.status == "queued":
            job.status = "cancelled"
            job.message = "Cancelled"
            job.done_event.set()
            return True
        await job.done_event.wait()
        return True

    async def _run(self, job: Job) -> None:
        async with self._semaphore:
            if job.cancel_event.is_set():
                job.status = "cancelled"
                job.done_event.set()
                return
            job.status = "running"
            steps = _clamp_steps(job.params.get("steps"))
            for step in range(1, steps + 1):
                await asyncio.sleep(self._step_delay)
                if job.cancel_event.is_set():
                    job.status = "cancelled"
                    job.message = "Cancelled"
                    job.done_event.set()
                    return
                job.progress = round(step / steps * 100)
            job.status = "done"
            job.progress = 100
            job.done_event.set()


def _clamp_steps(value: object) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        return 5
    return max(1, min(20, value))
