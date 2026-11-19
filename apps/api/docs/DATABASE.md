# AI Recruiter API — Database Schema

## Owner

The Node.js API (`apps/api`) owns and migrates the primary PostgreSQL database.

> **Important:** The Python AI service (`apps/ai-service`) must NOT define or run its own Prisma/Alembic migrations against this database. It communicates with the API over HTTP.

## ORM

**Prisma 6** — schema located at `prisma/schema.prisma`.

## Foundation Tables

### `organizations`
Multi-tenant root. Each company using the platform is one `Organization`.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | Auto-generated |
| name | String | Display name |
| slug | String UNIQUE | URL-safe identifier |
| status | Enum | ACTIVE / SUSPENDED / ARCHIVED |
| logoUrl | String? | Optional CDN URL |
| settings | JSON | Tenant-level feature flags |
| createdAt | DateTime | |
| updatedAt | DateTime | Auto-updated |

### `users`
Shared user accounts. One user can belong to multiple organisations via `Membership`.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| email | String UNIQUE | |
| passwordHash | String | Argon2id hash |
| firstName | String? | |
| lastName | String? | |
| emailVerified | Boolean | Default: false |
| status | Enum | PENDING_VERIFICATION / ACTIVE / SUSPENDED / DEACTIVATED |
| lastLoginAt | DateTime? | |

### `memberships`
Links a `User` to an `Organization` with a role. Unique per (user, organization) pair.

| Column | Type | Notes |
|--------|------|-------|
| role | Enum | OWNER / ADMIN / RECRUITER / VIEWER |
| invitedEmail | String? | Email used during invitation |
| acceptedAt | DateTime? | When invitation was accepted |

### `audit_logs`
Immutable security audit trail. Never update or delete rows.

| Column | Type | Notes |
|--------|------|-------|
| action | String | e.g. `user.login`, `interview.created` |
| entityType | String? | e.g. `Interview`, `Job` |
| entityId | String? | UUID of the affected entity |
| metadata | JSON | Contextual event data |
| ipAddress | String? | Client IP |
| userAgent | String? | Browser string |

## Running Migrations

```bash
# First time setup
cp .env.example .env
# Fill in DATABASE_URL

# Generate Prisma client (after schema changes)
npm run prisma:generate

# Create and apply migration
npm run prisma:migrate

# Open Prisma Studio (GUI)
npm run prisma:studio
```

## Planned Phase 2 Tables

| Table | Purpose |
|-------|---------|
| `jobs` | Job definitions with question banks |
| `candidates` | Candidate profiles |
| `applications` | Candidate × Job applications |
| `interviews` | Interview sessions |
| `interview_turns` | Per-turn transcript entries |
| `evaluations` | AI evaluation scores and feedback |
| `invitations` | Org membership invitations |
| `refresh_tokens` | JWT refresh token store |
