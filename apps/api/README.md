# AI Recruiter API

> Enterprise Node.js/Express backend for the **AI Recruiter — Aarohi AI Interview Platform**.

## Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 22 LTS |
| Language | TypeScript 5 (strict) |
| Framework | Express 4 |
| Database | PostgreSQL + Prisma 6 |
| Validation | Zod 3 |
| Logging | Pino 9 |
| Testing | Vitest 3 — 56 tests |

## Quick Start

```bash
cp .env.example .env
# Fill in DATABASE_URL and JWT secrets

npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

## Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/v1/health/live` | Liveness probe |
| `GET /api/v1/health/ready` | Readiness probe (DB check) |
| `GET /api/v1/docs` | Swagger UI (development) |

## Tests

```bash
npm test          # 56 tests, all passing
npm run typecheck # Zero TypeScript errors
npm run build     # Production build to dist/
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Database Schema](docs/DATABASE.md)
- [Security](docs/SECURITY.md)
- [Development Guide](docs/DEVELOPMENT.md)
