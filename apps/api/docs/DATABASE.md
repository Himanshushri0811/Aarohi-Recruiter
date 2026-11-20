# AI Recruiter API — Database Schema

## Ownership

The Node.js API (`apps/api`) owns and migrates the primary PostgreSQL database. The Python AI service communicates with the API over HTTP and must not run migrations against this database.

The Prisma schema is `prisma/schema.prisma`. The `User` model maps to `public.users` through `@@map("users")`; PostgreSQL uses `public` as the default schema.

## Database URL

Configure the existing `DATABASE_URL` in the Render Node API environment with the existing Neon PostgreSQL connection string. Do not replace it with a localhost URL or commit it to source control. The API and Prisma CLI both read this variable.

## Production migrations

The Render Docker image runs the following before starting the API:

```bash
npx prisma migrate deploy
```

`prisma` is installed as a production dependency so the CLI and migration engine are present in the runtime image. The command uses the committed files in `prisma/migrations` and Prisma's `_prisma_migrations` history table. It is safe to rerun when migrations are already applied; failures stop the container before the API starts.

Before deploying this startup behavior to an existing database, take a Neon backup/snapshot and inspect the database's schema and `_prisma_migrations` history. Do not assume it is empty. If tables already exist without matching migration records, or migration history is partial/inconsistent, **do not deploy or baseline automatically**; reconcile the actual schema and migration records first.

To inspect status manually from `apps/api` with the production `DATABASE_URL` configured in a secure shell:

```bash
npx prisma migrate status
```

Do not print or paste the connection string in logs or support requests. Do not use `prisma migrate dev`, `prisma migrate reset`, `prisma db push`, or `prisma migrate resolve` against production.

### Failed migration recovery

1. Keep the failed API deployment stopped and preserve its migration logs.
2. Take/confirm a database backup before any repair.
3. Inspect the failed migration in `_prisma_migrations` and compare the actual tables, columns, indexes, constraints, and data with its SQL. Do not assume the migration rolled back completely.
4. Do not reset the database or mark the migration applied/rolled back just to make deployment pass. If the schema has drifted or the migration partially applied, prepare and review a forward-only repair based on verified database state.
5. Retry deployment only after the repair plan and impact are understood.

## Readiness checks

- `GET /api/v1/health/live` confirms the API process is running.
- `GET /api/v1/health/ready` runs a database check. Expect HTTP 200 with `checks.database.status` equal to `healthy`; HTTP 503 indicates the API is not ready.

## Local development

Set `DATABASE_URL` to a development PostgreSQL database, then use:

```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:studio
```

`prisma:migrate` uses `prisma migrate dev` and is for development only.
