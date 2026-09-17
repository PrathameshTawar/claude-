# 👑 Monarch — Master Demo Incident Files & Ingestion Collection

This document consolidates all **5 Demo Incident Files** for the **Monarch Production Multi-Agent AI System**. These incident reports detail real-world failure modes, root cause analyses, detection timelines, and remediation steps across the Monarch API Gateway, LLM Routing, Hybrid RAG, SQL Memory Repository, and LangSmith Telemetry subsystems.

---

## 📋 Table of Contents
1. [INC-2026-001: API Rate Limiter Spike & HTTP 429 Cascades](#inc-2026-001-api-rate-limiter-spike--http-429-cascades)
2. [INC-2026-002: Groq API Model Deprecation & Resolution Fallback](#inc-2026-002-groq-model-deprecation--resolution-fallback)
3. [INC-2026-003: FAISS Vector Store Index Out-Of-Memory](#inc-2026-003-faiss-vector-store-index-out-of-memory)
4. [INC-2026-004: SQLite Database Lock Contention in Fact Distillation](#inc-2026-004-database-lock-contention-in-fact-distillation)
5. [INC-2026-005: LangSmith Telemetry Exporter Thread Pool Leak](#inc-2026-005-langsmith-trace-exporter-leak)

---

## 🚨 Incident 1: INC-2026-001 — API Rate Limiter Spike & HTTP 429 Cascades

- **Incident ID**: INC-2026-001
- **Severity**: High (P2)
- **Component**: FastAPI Gateway (`api.py`, `utils/rate_limiter.py`)
- **Status**: Resolved
- **Date**: 2026-09-17

### Executive Summary
During a high-concurrency stress test on `/api/chat`, the sliding-window rate limiter blocked legitimate traffic with HTTP 429 errors. A race condition in cleanup of expired IP timestamps caused thread contention, stalling valid requests.

### Key Metrics
- **Peak Request Rate**: 1,200 req/min
- **Error Rate**: 38% HTTP 429 False Positives
- **P99 Latency Spike**: 4.8s (Normal: 420ms)

### Root Cause Analysis
The `RateLimiterMiddleware` used a single un-synchronized dictionary across async requests. High concurrent mutations triggered dictionary resizing exceptions and lock contention.

### Resolution & Mitigation
1. Refactored `utils/rate_limiter.py` to use `asyncio.Lock()` per IP window.
2. Implemented automatic garbage collection for inactive client IPs every 60 seconds.
3. Added `Retry-After` header standardization in FastAPI exception handling.

---

## 🚨 Incident 2: INC-2026-002 — Groq API Model Deprecation & Resolution Fallback

- **Incident ID**: INC-2026-002
- **Severity**: Critical (P1)
- **Component**: LLM Core & Config (`utils/config.py`, `Agents/router.py`)
- **Status**: Resolved
- **Date**: 2026-09-17

### Executive Summary
Groq deprecated the legacy `llama-3.1-70b-versatile` model endpoint. Initial API calls threw uncaught `NotFoundError` exceptions, rendering the multi-agent orchestrator non-functional.

### Key Metrics
- **Downtime Duration**: 14 minutes
- **Impacted Services**: All Agent Workflows (`/api/chat`, CLI)
- **Failed Invocations**: 840 chat requests

### Root Cause Analysis
`utils/config.py` loaded `GROQ_MODEL` directly from `.env` without dynamic validation against Groq's active `/v1/models` catalog endpoint.

### Resolution & Mitigation
1. Implemented `_resolve_model()` in `utils/config.py` that queries Groq model catalog at startup.
2. Defined fallback priority chain: `openai/gpt-oss-20b` -> `llama-3.3-70b-versatile` -> `qwen/qwen3.6-27b`.
3. Added auto-logging warning when fallback model auto-resolution triggers.

---

## 🚨 Incident 3: INC-2026-003 — FAISS Vector Store Index Out-Of-Memory

- **Incident ID**: INC-2026-003
- **Severity**: Critical (P1)
- **Component**: Multimodal RAG (`RAG/manager.py`, `RAG/embeddings.py`)
- **Status**: Resolved
- **Date**: 2026-09-17

### Executive Summary
Ingestion of a 250MB PDF document containing embedded high-resolution graphics caused worker process crash due to Out-Of-Memory (OOM) killer terminating the FastAPI container.

### Key Metrics
- **Memory Consumption Peak**: 4.2 GB RAM (Limit: 2.0 GB)
- **Container Restarts**: 3 cycles
- **Ingestion Backlog**: 42 pending documents

### Root Cause Analysis
`RAGAgentManager.ingest()` attempted to load all extracted text into memory at once without streaming batch processing, while HuggingFace embeddings were initialized with unbounded batch sizes.

### Resolution & Mitigation
1. Constrained `RecursiveCharacterTextSplitter` chunk size to 800 tokens with 120 token overlap.
2. Updated HuggingFace embeddings wrapper (`RAG/embeddings.py`) to process vector embeddings in sub-batches of 32 chunks.
3. Configured Docker container memory limits with graceful garbage collection hooks.

---

## 🚨 Incident 4: INC-2026-004 — SQLite Database Lock Contention in Fact Distillation

- **Incident ID**: INC-2026-004
- **Severity**: Medium (P3)
- **Component**: Memory Subsystem (`SQL/repository.py`, `SQL/memory_consolidator.py`)
- **Status**: Resolved
- **Date**: 2026-09-17

### Executive Summary
Asynchronous background memory distillation tasks produced `sqlite3.OperationalError: database is locked` errors during concurrent user message saving.

### Key Metrics
- **Failed Background Tasks**: 18% of fact distillation jobs
- **Database Lock Wait Time**: >5,000ms
- **Impact**: User memories delayed in semantic storage

### Root Cause Analysis
SQLite in default journal mode defaults to single-writer access. Concurrent background workers in FastAPI wrote to `monarch.db` simultaneously without WAL (Write-Ahead Logging) mode enabled.

### Resolution & Mitigation
1. Updated `SQL/db.py` initialization to enable `PRAGMA journal_mode=WAL;` and `PRAGMA busy_timeout=5000;`.
2. Wrapped memory repository database writes in retry decorator `@db_retry(max_retries=3)`.
3. Separated read queries from memory distillation write transactions.

---

## 🚨 Incident 5: INC-2026-005 — LangSmith Telemetry Exporter Thread Pool Leak

- **Incident ID**: INC-2026-005
- **Severity**: Medium (P3)
- **Component**: Telemetry & Observability (`utils/config.py`, `api.py`)
- **Status**: Resolved
- **Date**: 2026-09-17

### Executive Summary
Long-running FastAPI backend deployments exhibited steady memory leak (~15MB/hour) caused by un-reclaimed background threads from the LangChain/LangSmith tracing exporter.

### Key Metrics
- **Leaked Threads**: 120 background HTTP worker threads over 8 hours
- **Memory Growth Rate**: +15.4 MB/hour
- **Process Latency Increase**: +85ms over 12 hours

### Root Cause Analysis
LangSmith tracing background worker created a new thread pool instance on every graph invocation when `LANGCHAIN_TRACING_V2=true` instead of reusing a global singleton client session.

### Resolution & Mitigation
1. Initialized global LangSmith client in `utils/config.py` during module startup.
2. Added proper shutdown hooks in FastAPI `lifespan` context manager (`api.py`) to flush pending traces cleanly.
3. Validated zero thread leaks after 10,000 synthetic chat executions.

---

## 💡 RAG Ingestion Instructions

All 5 incident reports above have also been split into individual standalone files in the `incidents/` directory:
- [incidents/INC-2026-001-api-rate-limit-spike.md](file:///e:/aws%20project%20banglore/incidents/INC-2026-001-api-rate-limit-spike.md)
- [incidents/INC-2026-002-groq-model-fallback.md](file:///e:/aws%20project%20banglore/incidents/INC-2026-002-groq-model-fallback.md)
- [incidents/INC-2026-003-rag-faiss-index-corruption.md](file:///e:/aws%20project%20banglore/incidents/INC-2026-003-rag-faiss-index-corruption.md)
- [incidents/INC-2026-004-database-lock-contention.md](file:///e:/aws%20project%20banglore/incidents/INC-2026-004-database-lock-contention.md)
- [incidents/INC-2026-005-langsmith-trace-exporter-leak.md](file:///e:/aws%20project%20banglore/incidents/INC-2026-005-langsmith-trace-exporter-leak.md)

To bulk ingest this document into Monarch RAG:
```bash
python main.py --ingest monarch-demo-incident-files.md --user-id sre_admin
```
