import asyncio
import json
from collections.abc import AsyncIterator
from typing import cast

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from ...errors import ApiError
from ...jobs import TERMINAL_STATUSES, JobRegistry

router = APIRouter(tags=["jobs"])
POLL_INTERVAL_S = 0.05


class JobCreate(BaseModel):
    task: str
    params: dict[str, object] = Field(default_factory=dict)


def get_jobs(request: Request) -> JobRegistry:
    return cast(JobRegistry, request.app.state.jobs)


@router.post("/jobs", status_code=202)
async def create_job(
    payload: JobCreate, jobs: JobRegistry = Depends(get_jobs)
) -> dict[str, str]:
    job_id = await jobs.submit(payload.task, payload.params)
    return {"job_id": job_id}


@router.get("/jobs/{job_id}")
def read_job(job_id: str, jobs: JobRegistry = Depends(get_jobs)) -> dict[str, object]:
    snapshot = jobs.get(job_id)
    if snapshot is None:
        raise ApiError("job_not_found", 404, "Job not found")
    return snapshot


@router.get("/jobs/{job_id}/events")
def stream_job(job_id: str, jobs: JobRegistry = Depends(get_jobs)) -> StreamingResponse:
    if jobs.get(job_id) is None:
        raise ApiError("job_not_found", 404, "Job not found")
    return StreamingResponse(
        _events(jobs, job_id),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.delete("/jobs/{job_id}")
async def cancel_job(job_id: str, jobs: JobRegistry = Depends(get_jobs)) -> dict[str, str]:
    if jobs.get(job_id) is None:
        raise ApiError("job_not_found", 404, "Job not found")
    if not await jobs.cancel(job_id):
        raise ApiError("job_not_cancellable", 409, "Job already finished")
    return {"status": "cancelled"}


async def _events(jobs: JobRegistry, job_id: str) -> AsyncIterator[str]:
    last: tuple[object, object, object] | None = None
    while True:
        snapshot = jobs.get(job_id)
        if snapshot is None:
            return
        if str(snapshot["status"]) in TERMINAL_STATUSES:
            yield f"event: done\ndata: {json.dumps(snapshot)}\n\n"
            return
        current = (snapshot["status"], snapshot["progress"], snapshot["message"])
        if current != last:
            yield f"event: progress\ndata: {json.dumps(snapshot)}\n\n"
            last = current
        await asyncio.sleep(POLL_INTERVAL_S)
