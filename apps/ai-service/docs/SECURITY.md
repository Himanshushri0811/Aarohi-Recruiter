# Aarohi AI Recruiter Service - Security & Tenant Isolation

## 1. Threat Model & Security Principles

Aarohi is designed for enterprise environments where confidential candidate data, proprietary job descriptions, and multiple corporate tenants co-exist within the same platform.

### Zero Trust Candidate Input
- Candidates participate in interviews via browser WebRTC sessions.
- Candidate-submitted parameters (e.g., claimed user ID, claimed tenant ID, or role requested) are **never trusted**.
- Only signed service tokens issued by the authorized core application backend are accepted for interview orchestration.

---

## 2. Multi-Tenant Cryptographic Isolation

Every service request initiating or resuming an interview session must include an `Authorization: Bearer <token>` header containing an HMAC-SHA256 signed JWT.

### JWT Claims Structure

```json
{
  "sub": "ai-recruiter-backend-worker",
  "org_id": "org_enterprise_9918",
  "interview_id": "int_candidate_7721",
  "scopes": ["interview:conduct"],
  "iat": 1731844800,
  "exp": 1731848400
}
```

### Boundary Assertions
1. **Tenant ID Verification**: `assert_tenant_authorization(claims, expected_org_id, expected_interview_id)` validates that the `org_id` in the token matches the requested resource.
2. **Short-Lived Expiration**: Service tokens expire in 60 minutes (`SERVICE_TOKEN_TTL_SECONDS`).
3. **Tenant Whitelist**: In restricted private deployments, `ALLOWED_ORGANIZATION_IDS` enforces explicit instance-level tenant gating.

---

## 3. Observability & Sensitive Data Sanitization

To comply with global privacy standards (GDPR, SOC2, Indian DPDP Act):

### Automated Scrubbing
The structured logging pipeline (`app/core/logging.py`) automatically detects and redacts:
- **API Keys**: Google Gemini (`AIza...`), OpenAI (`sk-...`), and general provider keys.
- **Tokens**: JWTs, Bearer authorization tokens, cookies.
- **Candidate PII**: Candidate personal email addresses and 10+ digit phone numbers.
- **Dictionary Keys**: Any dictionary entry named `password`, `secret`, `token`, `api_key`, or `authorization`.

---

## 4. Evaluation Ethics & Governance

1. **Decoupled Evaluation**: The live agent never assesses candidate scores during the conversation.
2. **Protected Characteristics**: The evaluation engine is programmatically barred from evaluating accent, tone, facial appearance, gender, caste, race, or nationality.
3. **No Autonomous Hiring Decisions**: Aarohi outputs structured candidate evidence and rubric alignments. Human recruiters retain sole decision-making authority.
