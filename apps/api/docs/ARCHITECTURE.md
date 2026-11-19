# AI Recruiter API — Architecture

## Overview

The API is a **modular monolith** built with Node.js 22 LTS, TypeScript, and Express. It is the primary business-logic layer of the AI Recruiter SaaS platform and owns the PostgreSQL database schema.

## Monorepo Position

```
Aarohi-Recruiter/
└── apps/
    ├── web/          React + TypeScript + Vite (Aurora Intelligence UI)
    ├── api/          Node.js + Express (this service) ← owns the DB schema
    └── ai-service/   Python + FastAPI (Aarohi AI interview agent)
```

## Technology Stack

| Concern | Technology |
|---------|-----------|
| Runtime | Node.js 22 LTS |
| Language | TypeScript 5 (strict, NodeNext module resolution) |
| Framework | Express 4 |
| Database | PostgreSQL via Prisma 6 |
| Validation | Zod 3 |
| Logging | Pino 9 + pino-http |
| Security | Helmet, CORS, express-rate-limit, Argon2id |
| Testing | Vitest 3 |
| Build | tsc → `dist/` |

## Directory Structure

```
apps/api/
├── prisma/
│   └── schema.prisma         # Database schema (source of truth)
│
├── src/
│   ├── config/
│   │   ├── env.ts            # Zod-validated environment singleton
│   │   ├── logger.ts         # Pino logger singleton
│   │   └── database.ts       # PrismaClient singleton
│   │
│   ├── common/
│   │   ├── errors/
│   │   │   └── app-error.ts  # AppError class with factory methods
│   │   ├── types/
│   │   │   └── index.ts      # Shared TypeScript interfaces
│   │   └── utils/
│   │       ├── async-handler.ts  # Express async wrapper
│   │       └── helpers.ts        # paginate, slugify, pick, omit
│   │
│   ├── middleware/
│   │   ├── request-id.middleware.ts    # UUID per request
│   │   ├── security.middleware.ts      # Helmet + CORS + rate limit
│   │   ├── not-found.middleware.ts     # 404 catcher
│   │   └── error-handler.middleware.ts # Centralised error format
│   │
│   ├── database/
│   │   ├── prisma.service.ts   # Re-exports getPrismaClient
│   │   └── database-health.ts  # SELECT 1 health probe
│   │
│   ├── routes/
│   │   ├── health.routes.ts    # /health/live, /health/ready
│   │   └── index.ts            # Route mounting + Swagger (dev)
│   │
│   ├── modules/     # Feature modules (Phase 2+)
│   ├── integrations/ # External service adapters (Phase 2+)
│   ├── app.ts       # Express app factory
│   └── server.ts    # Entrypoint — listen + graceful shutdown
│
└── tests/
    ├── unit/        # AppError, env schema, request-id middleware
    └── integration/ # Health endpoints, middleware wiring
```

## Middleware Order

```
Request
  → Helmet (security headers)
  → CORS
  → express.json (body parser, 1 MB limit)
  → Global rate limiter (100 req / 15 min)
  → pino-http (structured HTTP logging)
  → requestIdMiddleware (UUID on each request)
  → Routes
  → notFoundMiddleware (404 for unmatched paths)
  → errorHandlerMiddleware (consistent JSON error shape)
Response
```

## Error Response Shape

All errors follow this envelope, guaranteed by `errorHandlerMiddleware`:

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Resource not found",
    "details": [],
    "requestId": "uuid-v4"
  }
}
```

## Success Response Shape

```json
{
  "success": true,
  "data": { ... },
  "meta": { "page": 1, "limit": 20, "total": 100 }
}
```

## Health Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/health/live` | Liveness probe — always 200 if process is running |
| `GET /api/v1/health/ready` | Readiness probe — checks DB; returns 200/503 |

## Separation of Concerns

- `config/` — infrastructure wiring only (env, logger, DB client)
- `common/` — shared utilities with zero business logic
- `middleware/` — Express middleware only
- `modules/<feature>/` — vertical slices: controller → service → repository
- `integrations/<service>/` — external API adapters, error-mapped to `AppError`

## Key Principles

1. **Config fails fast** — `env.ts` throws on startup if any required variable is missing or invalid.
2. **No floating promises** — all async route handlers wrapped in `asyncHandler()`.
3. **Consistent errors** — all thrown values must be `AppError` or `ZodError`; the middleware handles the rest.
4. **PII redaction** — Pino is configured to redact `authorization`, `cookie`, `password`, and `token` fields in logs.
5. **No secrets in code** — all secrets come from environment variables validated by Zod.
