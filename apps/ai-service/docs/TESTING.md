# Aarohi AI Recruiter Service - Testing Strategy

## 1. Testing Philosophy

A production-grade voice AI service requires rigorous testing across multiple dimensions:
- Configuration validation and environment guards.
- Cryptographic tenant boundaries.
- Deterministic finite state machine transitions.
- Asynchronous speech streaming and interruption handling.
- Decoupled rubric evaluation schemas.

### Zero-Cost CI/CD Rule
The automated test suite runs **100% offline with zero external API calls**. Developers and CI/CD pipelines can execute the full suite without configuring paid API keys for Gemini, Deepgram, Cartesia, or LiveKit.

---

## 2. Test Architecture

The tests are organized into clear layers under `apps/ai-service/tests/`:

```
tests/
├── conftest.py                 # Global pytest fixtures, mock env vars & sys.path setup
│
├── unit/                       # Isolated unit tests
│   ├── test_config.py          # Settings parsing, defaults, production validation guards
│   ├── test_security.py        # Token creation, verification, boundary assertion
│   └── test_logging.py         # JSON formatting, context vars, sensitive data scrubbing
│
├── integration/                # End-to-end integration tests
│   └── test_health_api.py      # Liveness, readiness, diagnostics probes & routing
│
├── agent/                      # Phase 2 Agent & State machine tests (stubs ready)
│   ├── test_persona.py         # Persona prompts, language preferences
│   └── test_state_machine.py   # 12-stage interview transitions & gate rules
│
├── realtime/                   # Phase 4 WebRTC & LiveKit tests (stubs ready)
│   └── test_reconnection.py    # Session resume & interruption handling
│
└── fixtures/                   # Shared JSON fixtures
    ├── mock_job_description.json
    └── mock_candidate_profile.json
```

---

## 3. Running Tests Locally

### Run All Tests
```bash
python -m pytest tests -v
```

### Run With Test Coverage
```bash
python -m pytest tests --cov=app --cov-report=term-missing
```

### Run Specific Test Suite
```bash
python -m pytest tests/unit/test_config.py -v
python -m pytest tests/unit/test_security.py -v
python -m pytest tests/integration/test_health_api.py -v
```

---

## 4. Phase 1 Test Execution Results

All 20 test cases in Phase 1 pass cleanly in 0.48s:
- `test_config.py`: 8 passed (development defaults, log level validation, production safeguards against debug mode, weak secret keys, missing Gemini/Deepgram/Cartesia API keys).
- `test_security.py`: 4 passed (valid token decoding, expired token rejection, tampered signature rejection, tenant isolation & interview boundary enforcement).
- `test_logging.py`: 3 passed (PII/token scrubbing, dictionary secret redaction, context variable tracing).
- `test_health_api.py`: 5 passed (root metadata, liveness probe, readiness probe with provider status, diagnostics report, route registration).
