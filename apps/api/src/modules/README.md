# Modules

This directory contains vertical feature modules for the AI Recruiter platform.

## Module Pattern

Each module is a self-contained vertical slice:

```
modules/
└── <feature>/
    ├── <feature>.controller.ts   # Route handlers (thin, delegates to service)
    ├── <feature>.service.ts      # Business logic
    ├── <feature>.repository.ts   # Data access (Prisma queries)
    ├── <feature>.routes.ts       # Express Router definition
    ├── <feature>.schema.ts       # Zod validation schemas
    ├── <feature>.types.ts        # TypeScript interfaces for this module
    └── __tests__/
        ├── <feature>.service.test.ts
        └── <feature>.controller.test.ts
```

## Planned Modules (Phase 2+)

| Module | Responsibility |
|--------|---------------|
| `auth` | Login, registration, JWT token management, refresh |
| `organizations` | Tenant management, settings |
| `users` | User profile, password management |
| `jobs` | Job definitions and question banks |
| `candidates` | Candidate profiles and applications |
| `interviews` | Interview sessions, Aarohi agent coordination |
| `evaluations` | Scoring, structured feedback |
| `notifications` | Email and in-app notifications |
| `analytics` | Aggregated reporting |

## Rules

1. Modules must NOT import from other modules directly — use service interfaces.
2. All database access goes through the module's own repository.
3. All route handlers use `asyncHandler()` from `common/utils/async-handler.ts`.
4. All validation uses Zod schemas defined in `<feature>.schema.ts`.
5. All errors must be `AppError` instances or Zod errors (the error handler handles both).
