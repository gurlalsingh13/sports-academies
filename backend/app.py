"""
FastAPI application for Sports Academies discovery, crawling, extraction, and validation.
Exposes endpoints for triggering location-based pipeline runs, checking execution status,
and streaming live execution logs via Server-Sent Events.
"""

from dotenv import load_dotenv

load_dotenv()

import sys
import collections
import asyncio
import traceback
from fastapi.responses import StreamingResponse

MAX_LOGS = 1000
log_queue = collections.deque(maxlen=MAX_LOGS)


class LogCaptureStream:
    def __init__(self, original_stream):
        self.original_stream = original_stream

    def write(self, data):
        self.original_stream.write(data)
        self.original_stream.flush()
        stripped = data.strip()
        if stripped:
            log_queue.append(stripped)

    def flush(self):
        self.original_stream.flush()


sys.stdout = LogCaptureStream(sys.stdout)
sys.stderr = LogCaptureStream(sys.stderr)

from typing import Optional
from fastapi import FastAPI, BackgroundTasks
from pydantic import BaseModel, Field

from database.supabase import get_store
from orchestrator.orchestrator import run_pipeline
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Sports Academies Discovery API",
    description="API for discovering, crawling, extracting and validating sports academies.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_event():
    print("=" * 80)
    print("[SERVER] Sports Academies Discovery API starting up...")
    print(f"[SERVER] Log capture active - {MAX_LOGS} log buffer size")
    print(f"[SERVER] API docs available at http://localhost:8000/docs")
    print("=" * 80)


@app.on_event("shutdown")
def shutdown_event():
    print("[SERVER] Shutting down...")


@app.get("/health")
def health():
    """Unauthenticated - for uptime checks only, reveals nothing sensitive."""
    return {"status": "ok"}


@app.get("/logs/count")
def log_count():
    """Return the current number of logs in the buffer."""
    return {"count": len(log_queue), "max": MAX_LOGS}


@app.get("/logs")
def get_logs():
    """Return all logs in the buffer as JSON (for debugging)."""
    return {"logs": list(log_queue), "count": len(log_queue), "max": MAX_LOGS}


@app.post("/logs/clear")
def clear_logs():
    """Clear the log buffer."""
    log_queue.clear()
    return {"status": "cleared", "count": 0}


class OrchestratorRequest(BaseModel):
    location: Optional[str] = Field(default="Delhi")
    max_domains: int = Field(default=40, ge=1, le=50)
    max_depth: int = Field(default=2, ge=1, le=10)
    max_pages: int = Field(default=15, ge=1, le=100)
    start_url: Optional[str] = Field(default=None)
    skip_db: bool = Field(default=False)


# In-memory execution tracker
pipeline_state = {
    "running": False,
    "location": None,
    "started_at": None,
}


def _execute_pipeline_task(**kwargs):
    location = kwargs.get("location", "Delhi")
    pipeline_state["running"] = True
    pipeline_state["location"] = location
    pipeline_state["started_at"] = None
    try:
        loop = asyncio.get_running_loop()
        pipeline_state["started_at"] = loop.time()
    except RuntimeError:
        # No running event loop in this thread (background task)
        pass
    try:
        run_pipeline(**kwargs)
    finally:
        pipeline_state["running"] = False
        pipeline_state["location"] = None
        pipeline_state["started_at"] = None


@app.post("/orchestrator/run")
def run_orchestrator(
    background_tasks: BackgroundTasks,
    payload: OrchestratorRequest = OrchestratorRequest(),
):
    """
    Trigger the end-to-end sports academy discovery and crawling pipeline for a specific location.
    Runs asynchronously in the background since crawling can take minutes.
    """
    background_tasks.add_task(
        _execute_pipeline_task,
        location=payload.location or "Delhi",
        start_url=payload.start_url,
        max_domains=payload.max_domains,
        max_depth=payload.max_depth,
        max_pages=payload.max_pages,
        skip_db=payload.skip_db,
    )
    return {
        "status": "accepted",
        "message": f"Orchestrator pipeline run for '{payload.location or 'Delhi'}' started in the background.",
    }


@app.post("/orchestrator/manual")
def run_orchestrator_manual(
    background_tasks: BackgroundTasks,
    payload: OrchestratorRequest = OrchestratorRequest(),
):
    """
    Trigger the end-to-end pipeline manually from the dashboard.
    Runs asynchronously in the background.
    """
    background_tasks.add_task(
        _execute_pipeline_task,
        location=payload.location or "Delhi",
        start_url=payload.start_url,
        max_domains=payload.max_domains,
        max_depth=payload.max_depth,
        max_pages=payload.max_pages,
        skip_db=payload.skip_db,
    )
    return {
        "status": "accepted",
        "message": f"Orchestrator pipeline run for '{payload.location or 'Delhi'}' started in the background.",
    }


@app.get("/orchestrator/status")
def get_orchestrator_status():
    """
    Check if a crawl/discovery run is currently active.
    """
    if pipeline_state["running"]:
        return {
            "running": True,
            "location": pipeline_state["location"],
        }

    store = get_store()
    try:
        if hasattr(store, 'client'):
            # Check crawl_runs safely
            crawl_res = store.client.table("crawl_runs").select("id,started_at").eq("status", "RUNNING").limit(1).execute()
            # Check discovery_runs safely
            disc_res = store.client.table("discovery_runs").select("id,started_at").eq("status", "RUNNING").limit(1).execute()

            if (crawl_res and crawl_res.data) or (disc_res and disc_res.data):
                return {
                    "running": True,
                    "crawl_run": crawl_res.data[0] if crawl_res and crawl_res.data else None,
                    "discovery_run": disc_res.data[0] if disc_res and disc_res.data else None
                }
    except Exception:
        # Silently ignore when tables don't exist yet or during schema initialization
        pass

    return {"running": False}


@app.get("/logs/stream")
def stream_logs():
    """
    Server-Sent Events (SSE) endpoint to stream backend execution logs to the frontend terminal.
    """
    async def event_generator():
        yield "data: [SYSTEM] Connected to backend live log stream.\n\n"
        last_index = max(0, len(log_queue) - 50) # send last 50 logs as context
        try:
            while True:
                if last_index < len(log_queue):
                    while last_index < len(log_queue):
                        yield f"data: {log_queue[last_index]}\n\n"
                        last_index += 1
                else:
                    yield ": heartbeat\n\n"
                await asyncio.sleep(0.5)
        except asyncio.CancelledError:
            print("[SYSTEM] SSE client disconnected, stream cancelled.")
        except Exception as e:
            print(f"[SYSTEM] SSE stream error: {e}")
            traceback.print_exc()
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )
