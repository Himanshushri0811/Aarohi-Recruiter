# AI Recruiter - Enterprise Monorepo

Welcome to **AI Recruiter**, an enterprise-grade AI-powered recruitment and candidate interviewing SaaS platform.

## Monorepo Architecture

```
Aarohi-Recruiter/
├── apps/
│   ├── ai-service/             # Real-time Voice & Conversational AI microservice (Aarohi)
│   └── web/                    # Enterprise Frontend & Aurora Intelligence Design System
├── docs/                       # Shared architecture and design documentation
├── .gitignore                  # Global Git ignore rules
└── README.md                   # Repository overview
```

---

## Applications

### 1. `apps/ai-service` (Python 3.12+ / FastAPI / LiveKit)
- Powering **Aarohi**, the AI Interview Assistant.
- Deterministic 12-stage state machine.
- Decoupled rubric evaluation engine.
- Provider abstractions for Google Gemini, Deepgram STT, and Cartesia TTS.
- Detailed docs: [apps/ai-service/README.md](apps/ai-service/README.md).

### 2. `apps/web` (Vite / React 18 / TypeScript / Tailwind CSS)
- Implementing the official **Aurora Intelligence** visual design system.
- Exclusive Lucide React icon integration.
- Two connected experiences:
  - **Recruiter Experience**: Information-dense, minimal, Midnight Indigo navigation.
  - **Aarohi AI Interviewer**: Approachable, audio waveforms, 12-stage visual tracking.
- Detailed docs: [apps/web/README.md](apps/web/README.md).
