# AI Recruiter API — Development Guide

## Prerequisites

- Node.js 22 LTS
- npm 10+
- PostgreSQL 15+ (local or Docker)

## Quick Start

```bash
# 1. Clone and navigate
cd apps/api

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env — set DATABASE_URL, JWT secrets

# 4. Generate Prisma client
npm run prisma:generate

# 5. Run database migrations
npm run prisma:migrate

# 6. Start development server
npm run dev
```

The API will be available at `http://localhost:5000`.
Swagger docs at `http://localhost:5000/api/v1/docs` (development only).

## Available Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Development server with hot reload (tsx watch) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run start` | Run compiled production build |
| `npm run typecheck` | Type check without emitting |
| `npm test` | Run all tests with Vitest |
| `npm run test:watch` | Run tests in watch mode |
| `npm run prisma:generate` | Regenerate Prisma client after schema changes |
| `npm run prisma:migrate` | Create and apply database migration |
| `npm run prisma:studio` | Open Prisma Studio GUI |

## Health Endpoints

```bash
# Liveness
curl http://localhost:5000/api/v1/health/live

# Readiness (checks DB)
curl http://localhost:5000/api/v1/health/ready
```

## Adding a Feature Module

1. Create `src/modules/<feature>/` following the module pattern in `src/modules/README.md`.
2. Write tests in `tests/unit/<feature>.service.test.ts` and `tests/integration/<feature>.routes.test.ts`.
3. Mount the router in `src/routes/index.ts`.

## Environment Variables

See [`.env.example`](../.env.example) for the full list with descriptions.

## Code Style

- TypeScript strict mode enabled
- ESLint (`eslint.config.js`) + Prettier (`prettier.config.js`)
- Use `asyncHandler()` for every async route handler
- Throw `AppError` or let Zod validation propagate — never `res.status(500).json()` manually
- Use `logger` (Pino) — never `console.log`

## Docker

```bash
# Build image
docker build -t ai-recruiter-api .

# Run with environment file
docker run --env-file .env -p 5000:5000 ai-recruiter-api
```
