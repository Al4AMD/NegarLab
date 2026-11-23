import asyncio
import json

import httpx
from fastapi import FastAPI


def make_client(app: FastAPI) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")


async def create_job(client: httpx.AsyncClient, steps: int = 3) -> str:
    response = await client.post(
        "/api/v1/jobs", json={"task": "progress-demo", "params": {"steps": steps}}
    )
    assert response.status_code == 202
    return response.json()["job_id"]


async def test_job_streams_progress_until_done(app_factory):
    app = app_factory(job_step_delay_ms=20)
    async with make_client(app) as client:
        job_id = await create_job(client, steps=10)
        events: list[str] = []
        final: dict[str, object] = {}
        async with client.stream("GET", f"/api/v1/jobs/{job_id}/events") as response:
            assert response.headers["content-type"].startswith("text/event-stream")
            async for line in response.aiter_lines():
                if line.startswith("event: "):
                    events.append(line.removeprefix("event: "))
                elif line.startswith("data: "):
                    payload = json.loads(line.removeprefix("data: "))
                    if payload.get("status") in {"done", "cancelled"}:
                        final = payload

    assert events[-1] == "done"
    assert "progress" in events
    assert final["progress"] == 100


async def test_unknown_task_is_rejected(app_factory):
    async with make_client(app_factory()) as client:
        response = await client.post("/api/v1/jobs", json={"task": "nope", "params": {}})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "unknown_task"


async def test_unknown_job_is_404(app_factory):
    async with make_client(app_factory()) as client:
        response = await client.get("/api/v1/jobs/does-not-exist")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "job_not_found"


async def test_cancel_stops_running_job(app_factory):
    app = app_factory(job_step_delay_ms=20)
    async with make_client(app) as client:
        job_id = await create_job(client, steps=20)
        await asyncio.sleep(0.05)
        cancelled = await client.delete(f"/api/v1/jobs/{job_id}")
        assert cancelled.status_code == 200
        assert cancelled.json() == {"status": "cancelled"}

        snapshot = await client.get(f"/api/v1/jobs/{job_id}")
        assert snapshot.json()["status"] == "cancelled"

        again = await client.delete(f"/api/v1/jobs/{job_id}")
        assert again.status_code == 409


async def test_missing_job_cancel_is_404(app_factory):
    async with make_client(app_factory()) as client:
        response = await client.delete("/api/v1/jobs/does-not-exist")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "job_not_found"
