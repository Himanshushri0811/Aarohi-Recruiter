# Aarohi AI Interview Service (`apps/ai-service`)

Production-grade real-time conversational AI interview microservice powering **Aarohi**, the AI Interviewer for the AI Recruiter SaaS platform.

---

## Overview

Aarohi is an enterprise-grade AI interviewer engineered to conduct natural, high-fidelity, multilingual interviews (English, Hindi, Hinglish). Aarohi operates under a hybrid architecture:

1. **Deterministic State Machine**: Strictly governs interview progression through 12 mandatory stages (Welcome, Instructions, Warmup, Background, Technical, Situational, Behavioral, Candidate Q&A, Closing, Completed).
2. **Generative Intelligence**: Formulates dynamic, contextual follow-up questions and conversational replies tailored to the candidate's exact responses and job requirements.
3. **Evidence-Based Evaluation Engine**: Completely decoupled from live conversational interaction; analyzes structured transcripts against pre-configured rubrics to provide objective recruiter evidence.

---

## Architectural Principles

- **Zero Provider Lock-In**: Decoupled provider interfaces for LLMs (Google Gemini, OpenAI), STT (Deepgram), and TTS (Cartesia).
- **Strict Multi-Tenant Isolation**: Short-lived, HMAC-SHA256 signed service tokens cryptographically bind requests to organization tenants and specific interview IDs.
- **Fail-Safe Observability**: Structured JSON logging with automatic PII, token, and API key redaction, request correlation tracing, and provider health probes.
- **Cost & Latency Optimization**: Deterministic state transitions, configurable model tiers, strict interview timeout budgets, and streaming WebRTC audio pipelines.

---

## Quickstart

### Prerequisites

- Python 3.12+ (Python 3.13 supported)
- pip

### 1. Environment Setup

```bash
cd apps/ai-service
cp .env.example .env
```

### 2. Install Dependencies

```bash
pip install -r requirements-dev.txt
```

### 3. Run Automated Tests

The test suite runs with 100% mocked providers and requires no paid external credentials:

```bash
python -m pytest tests -v
```

### 4. Run the Development Server

```bash
python scripts/run_dev.py
```

Or using Uvicorn directly:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

---

## Service Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Service metadata and operational status |
| `GET` | `/health/live` | Container liveness probe |
| `GET` | `/health/ready` | Subsystem and provider readiness probe |
| `GET` | `/health/diagnostics` | Safe operational diagnostic report and budget limits |
| `GET` | `/api/v1/health/*` | Versioned equivalents of health probes |

---

## Documentation Index

- [ARCHITECTURE.md](docs/ARCHITECTURE.md): Complete system architecture, component breakdown, and runtime flow.
- [PERSONA.md](docs/PERSONA.md): Aarohi's persona, linguistic traits, voice parameters, and behavioral guidelines.
- [CONVERSATION_FLOW.md](docs/CONVERSATION_FLOW.md): 12-stage state machine, interruption handling, and fallback logic.
- [PROVIDER_INTEGRATION.md](docs/PROVIDER_INTEGRATION.md): Abstract provider interfaces, Gemini/Deepgram/Cartesia adapters.
- [SECURITY.md](docs/SECURITY.md): Multi-tenant security, token validation, PII redaction, and compliance.
- [TESTING.md](docs/TESTING.md): Testing strategy, mock providers, and quality gates.
- [COST_OPTIMIZATION.md](docs/COST_OPTIMIZATION.md): Token budgeting, caching, and infrastructure cost controls.
