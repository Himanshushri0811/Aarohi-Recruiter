# Integrations

This directory contains integration adapters to external services.

## Pattern

Each integration is a thin, interface-driven adapter:

```
integrations/
└── <service>/
    ├── <service>.client.ts     # API client / SDK wrapper
    ├── <service>.types.ts      # DTOs and response types
    └── <service>.errors.ts     # Service-specific error mapping
```

## Planned Integrations (Phase 2+)

| Integration | Purpose |
|-------------|---------|
| `aarohi-ai` | HTTP client for the Python AI service (Aarohi agent) |
| `email` | Transactional email (Resend or SendGrid) |
| `storage` | Object storage for recordings and resumes |
| `livekit` | LiveKit server API for room management |
| `stripe` | Billing and subscription management |

## Rules

1. Never import integration clients directly in route handlers — inject via service layer.
2. Map all external errors to `AppError` before they reach the application layer.
3. All external HTTP calls must have timeout handling.
4. All sensitive credentials are read from `env.ts`, never hardcoded.
