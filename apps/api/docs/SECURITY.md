# AI Recruiter API — Security Guide

## Layers

### 1. HTTP Security Headers (Helmet)
Applied by `src/middleware/security.middleware.ts`.
- `X-DNS-Prefetch-Control: off`
- `X-Frame-Options: SAMEORIGIN`
- `Strict-Transport-Security` (production only)
- `Content-Security-Policy` (production only)
- `X-Powered-By` removed

### 2. CORS
Configured from `CORS_ORIGINS` environment variable (comma-separated list).
Only listed origins receive `Access-Control-Allow-Origin`.
Credentials (`cookies`) are allowed for same-origin SPA flows.

### 3. Rate Limiting
Two tiers via `express-rate-limit`:

| Scope | Window | Max requests |
|-------|--------|-------------|
| Global | 15 min | 100 |
| `/api/v1/auth/*` | 15 min | 20 |

### 4. Body Size Limit
`express.json({ limit: '1mb' })` — rejects payloads above 1 MB.

### 5. Request IDs
Every request receives a UUID v4 `requestId` via `src/middleware/request-id.middleware.ts`.
- Attached to `req.requestId`
- Returned as `X-Request-ID` response header
- Included in error responses for traceability
- Included in all log lines

### 6. Structured Logging with PII Redaction
Pino redacts the following paths before writing logs:

```
req.headers.authorization
req.headers.cookie
req.body.password
req.body.passwordHash
req.body.token
req.body.refreshToken
*.secret
*.token
*.password
```

### 7. Password Hashing
`argon2` package (Argon2id variant) installed and ready for the auth module.
Default parameters: memory=65536, time=3, parallelism=4.
Never store passwords in plain text or use MD5/SHA1/bcrypt.

### 8. JWT Architecture (Phase 2)
- Short-lived access tokens (15 min) — `JWT_ACCESS_SECRET`
- Long-lived refresh tokens (7 days) — `JWT_REFRESH_SECRET`, stored in DB
- Secrets minimum 32 characters, validated at startup by Zod

### 9. Environment Variables
All secrets come from environment variables — zero hardcoded secrets.
`src/config/env.ts` uses Zod to validate on startup. Missing or short secrets cause immediate process exit.

## Security Checklist for Phase 2

- [ ] Add `helmet({ contentSecurityPolicy: true })` for production build
- [ ] Add `express-validator` or Zod schema validation on every route body
- [ ] Implement refresh token rotation and revocation
- [ ] Add `audit_logs` entries for all sensitive actions (login, password change, role change)
- [ ] Add IP-based suspicious activity detection on auth routes
- [ ] Review OWASP Top 10 before first production deployment
