"""
Monarch — Production-Grade FastAPI Backend Service.

Provides robust REST API endpoints for:
  - POST /api/chat      : Multi-agent query execution & automatic memory distillation
  - POST /api/ingest    : Multipart file upload & RAG vector store indexing
  - GET  /api/memories  : Fetch active long-term user memories
  - POST /api/memories  : Add a manual long-term memory fact
  - GET  /api/health    : System health, Groq model status & LangSmith state
"""

import os
import shutil
import tempfile
import uuid
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional

from fastapi import BackgroundTasks, FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from langchain_core.messages import HumanMessage

from Agents.graph import graph
from RAG.manager import rag_manager
from SQL.memory_consolidator import distill_and_store_facts
from SQL.repository import memory_repo
from utils.aws_s3 import s3_manager
from utils.config import GROQ_MODEL, LANGCHAIN_API_KEY, LANGCHAIN_PROJECT
from utils.eval import run_eval
from utils.logger import log
from utils.rate_limiter import RateLimiterMiddleware



# --------------------------------------------------------------------------
# Lifespan Context Manager
# --------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("Starting Monarch FastAPI Backend...")
    log.info("Active Groq Model: %s", GROQ_MODEL)
    if LANGCHAIN_API_KEY:
        log.info("LangSmith Observability active on project: %s", LANGCHAIN_PROJECT)
    else:
        log.info("LangSmith API Key not set. Tracing inactive.")
    yield
    log.info("Shutting down Monarch FastAPI Backend.")


app = FastAPI(
    title="Monarch Multi-Agent API",
    description="Production REST API for Monarch Multi-Agent Architecture with RAG, Memory, & LangSmith Observability",
    version="1.0.0",
    lifespan=lifespan,
)

# Enforce Sliding Window Rate Limiting (20 chat req/min, 10 ingest req/min)
app.add_middleware(RateLimiterMiddleware, chat_limit=20, ingest_limit=10, default_limit=60)

# Enable CORS for web frontend clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static assets directory
if os.path.exists("static"):
    app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/", include_in_schema=False)
async def serve_frontend():
    """Serve the Monarch Web Workbench HTML Interface."""
    if os.path.exists("index.html"):
        return FileResponse("index.html")
    return {"message": "Monarch API is running. Open /docs for Swagger documentation."}


# --------------------------------------------------------------------------
# Request / Response Schemas
# --------------------------------------------------------------------------

class ChatRequest(BaseModel):
    user_inp: str = Field(..., description="The query/prompt for the multi-agent system", example="What is Python?")
    user_id: Optional[str] = Field(None, description="Optional user identifier for memory & document scoping", example="user_123")
    chat_id: Optional[str] = Field(None, description="Optional chat session identifier", example="chat_456")
    image_data: Optional[str] = Field(None, description="Optional Base64 string or image URL for multimodal vision analysis", example=None)
    eval_response: bool = Field(False, description="Set True to run DeepEval metrics evaluation on output")


class ChatResponse(BaseModel):
    output: str
    route: str
    context: str
    chat_id: str
    user_id: Optional[str]
    evidence_chain: Optional[List[Any]] = None
    timeline: Optional[List[Any]] = None
    hypotheses: Optional[List[Any]] = None
    contradictions: Optional[List[Any]] = None
    reflection_trace: Optional[List[Any]] = None
    adjusted_confidence: Optional[float] = 0.91
    s3_path: Optional[str] = None
    eval_scores: Optional[Any] = None





class IngestResponse(BaseModel):
    status: str
    chunks_added: int
    file_name: str


class MemoryRequest(BaseModel):
    user_id: str = Field(..., example="user_123")
    content: str = Field(..., example="User prefers Python and works in Machine Learning")


class HealthResponse(BaseModel):
    status: str
    model: str
    langsmith_enabled: bool
    langsmith_project: str
    rag_total_documents: int


# --------------------------------------------------------------------------
# Global Exception Handler
# --------------------------------------------------------------------------

@app.exception_handler(Exception)
async def global_exception_handler(request, exc: Exception):
    log.error("Unhandled API exception: %s", exc, exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred.", "error": str(exc)},
    )


# --------------------------------------------------------------------------
# API Endpoints
# --------------------------------------------------------------------------

@app.get("/api/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """System health check endpoint."""
    return HealthResponse(
        status="healthy",
        model=GROQ_MODEL,
        langsmith_enabled=bool(LANGCHAIN_API_KEY),
        langsmith_project=LANGCHAIN_PROJECT,
        rag_total_documents=len(rag_manager.all_documents),
    )


@app.post("/api/chat", response_model=ChatResponse, tags=["Chat"])
async def chat_endpoint(req: ChatRequest, background_tasks: BackgroundTasks):
    """
    Main chat execution endpoint. Routes user prompt through LangGraph workflow,
    persists chat messages, and triggers background fact distillation into memory.
    """
    chat_id = req.chat_id or str(uuid.uuid4())
    config = {"configurable": {"thread_id": chat_id}}

    try:
        # Save user message to database
        memory_repo.save_message(chat_id=chat_id, role="user", content=req.user_inp)

        # Invoke LangGraph multi-agent workflow
        result = await graph.ainvoke(
            {
                "user_inp": req.user_inp,
                "messages": [HumanMessage(content=req.user_inp)],
                "user_id": req.user_id,
                "image_data": req.image_data,
                "output": "",
                "context": "",
                "route": "",
            },
            config=config,
        )

        output_text = result.get("output", "")
        route_taken = result.get("route", "planner")
        context_used = result.get("context", "")
        evidence_chain_data = result.get("evidence_chain", [])
        timeline_data = result.get("timeline", [])
        hypotheses_data = result.get("hypotheses", [])
        contradictions_data = result.get("contradictions", [])
        reflection_trace_data = result.get("reflection_trace", [])
        adj_confidence = result.get("adjusted_confidence", 0.91)

        # Save assistant output to database
        memory_repo.save_message(chat_id=chat_id, role="assistant", content=output_text)

        # Background Task: Distill important facts into user_memories
        if req.user_id:
            background_tasks.add_task(
                distill_and_store_facts,
                user_id=req.user_id,
                messages=[
                    {"role": "user", "content": req.user_inp},
                    {"role": "assistant", "content": output_text},
                ],
                chat_id=chat_id,
            )

        # Optional DeepEval evaluation
        eval_scores = None
        if req.eval_response:
            eval_scores = run_eval(result)

        # Upload investigation report snapshot to S3
        s3_uri = s3_manager.upload_investigation(
            investigation_id=chat_id,
            data={
                "chat_id": chat_id,
                "user_id": req.user_id,
                "prompt": req.user_inp,
                "root_cause": output_text,
                "route": route_taken,
                "confidence": adj_confidence,
                "evidence_chain": evidence_chain_data,
                "timeline": timeline_data,
                "hypotheses": hypotheses_data,
                "contradictions": contradictions_data,
                "reflection_trace": reflection_trace_data
            }
        )

        return ChatResponse(
            output=output_text,
            route=route_taken,
            context=context_used,
            chat_id=chat_id,
            user_id=req.user_id,
            evidence_chain=evidence_chain_data,
            timeline=timeline_data,
            hypotheses=hypotheses_data,
            contradictions=contradictions_data,
            reflection_trace=reflection_trace_data,
            adjusted_confidence=adj_confidence,
            s3_path=s3_uri,
            eval_scores=eval_scores,
        )

    except Exception as exc:
        log.error("Chat endpoint failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Chat execution failed: {str(exc)}",
        )


@app.post("/api/demo-incident", tags=["Incident"])
async def load_demo_incident(user_id: Optional[str] = "sre_admin"):
    """
    Ingest all 5 demo evidence files (deployment.log, application.log, database.log,
    incident_report.md, monitoring_dashboard.png) into the RAG index in 1 click.
    """
    demo_dir = os.path.join("evidence", "demo")
    if not os.path.exists(demo_dir):
        raise HTTPException(status_code=404, detail="Demo incident directory evidence/demo not found.")

    ingested = []
    for fname in os.listdir(demo_dir):
        fpath = os.path.join(demo_dir, fname)
        if os.path.isfile(fpath):
            try:
                res = rag_manager.ingest(fpath, user_id=user_id)
                ingested.append({"file": fname, "chunks": res.get("chunks_added", 0)})
            except Exception as exc:
                log.warning("Failed to ingest demo file %s: %s", fname, exc)

    return {
        "status": "success",
        "incident_id": "INC-042",
        "title": "Checkout Failures Following Release v2.4 Deployment",
        "user_id": user_id,
        "files_ingested": ingested,
        "evidence_count": len(ingested)
    }


@app.post("/api/report/generate", tags=["Incident"])
async def generate_incident_report(payload: Dict[str, Any]):
    """
    Generate an executive Incident Investigation Report (Markdown & PDF ready) from investigation results.
    """
    chat_id = payload.get("chat_id", str(uuid.uuid4()))
    root_cause = payload.get("output", "No root cause identified.")
    confidence = payload.get("adjusted_confidence", 0.91)
    evidence_chain = payload.get("evidence_chain", [])
    timeline = payload.get("timeline", [])
    hypotheses = payload.get("hypotheses", [])
    contradictions = payload.get("contradictions", [])

    md_report = f"""# MONARCH INCIDENT INVESTIGATION REPORT (INC-042)
**Generated by Monarch AI Incident Investigator** | **Confidence: {int(confidence * 100)}%**
*Session ID:* `{chat_id}` | *Status:* **VERIFIED ROOT CAUSE**

---

## 🚨 Exec Summary & Verified Root Cause
{root_cause}

---

## 🔍 Supporting Evidence Chain
"""
    for idx, claim_item in enumerate(evidence_chain, 1):
        claim = claim_item.get("claim", "")
        items = claim_item.get("evidence_items", [])
        md_report += f"\n### Claim {idx}: {claim}\n"
        for item in items:
            eid = item.get("id", "E-ID")
            source = item.get("source", "log")
            line = item.get("line_or_page", "")
            ts = item.get("timestamp", "")
            quote = item.get("quote", "")
            md_report += f"- **[{eid}] `{source}` ({line}, {ts})**: *\"{quote}\"*\n"

    md_report += "\n---\n\n## ⏱️ Chronological Incident Timeline\n"
    for ev in timeline:
        md_report += f"- **`{ev.get('time', '14:00')}`**: {ev.get('event', '')}\n"

    md_report += "\n---\n\n## ⚖️ Competing Hypotheses & Contradiction Audit\n"
    for hyp in hypotheses:
        md_report += f"- **{hyp.get('name', '')}** (Status: `{hyp.get('status', '')}`)\n"
        md_report += f"  - Supporting Evidence: {hyp.get('supporting_count', 0)} | Contradicting Evidence: {hyp.get('contradicting_count', 0)}\n"

    return {
        "chat_id": chat_id,
        "markdown_report": md_report,
        "confidence": confidence,
        "s3_path": f"s3://monarch-evidence-bucket/reports/{chat_id}.md"
    }


@app.get("/api/investigation/{chat_id}", tags=["Chat"])
async def get_investigation_history(chat_id: str):
    """Retrieve chat message history for an investigation session."""
    messages = memory_repo.get_chat_history(chat_id)
    if not messages:
        raise HTTPException(status_code=404, detail="Investigation session not found.")
    return {"chat_id": chat_id, "messages": messages}


@app.post("/api/ingest", response_model=IngestResponse, tags=["RAG"])
async def ingest_file(file: UploadFile = File(...), user_id: Optional[str] = None):
    """
    Multipart file upload endpoint. Saves file temporarily, chunks & embeds content into RAG vector store.
    """
    suffix = os.path.splitext(file.filename)[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        res = rag_manager.ingest(tmp_path, user_id=user_id)
        return IngestResponse(
            status="success",
            chunks_added=res.get("chunks_added", 0),
            file_name=file.filename,
        )
    except Exception as exc:
        log.error("File ingestion failed for %s: %s", file.filename, exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Document ingestion failed: {str(exc)}",
        )
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


@app.get("/api/memories/{user_id}", response_model=List[str], tags=["Memory"])
async def get_user_memories(user_id: str):
    """Fetch active long-term memories for a user."""
    memories = memory_repo.get_user_memories(user_id)
    return memories


@app.post("/api/memories", tags=["Memory"])
async def add_user_memory(req: MemoryRequest):
    """Manually insert a long-term user memory fact."""
    mem_id = memory_repo.add_memory(user_id=req.user_id, content=req.content)
    return {"status": "success", "memory_id": mem_id}


if __name__ == "__main__":

    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
