---
mode: agent
description: "Code review against ERP conventions, security, and quality standards"
---

# Code Review

Review the specified code against these criteria. Output a structured report with findings.

## Security (OWASP Top 10)
- [ ] No SQL injection — all queries use Prisma parameterized queries
- [ ] No XSS — user input is sanitized, React escapes by default
- [ ] No broken access control — routes use `authenticate` middleware, check `req.userId`
- [ ] No sensitive data exposure — passwords hashed with bcrypt, no secrets in responses
- [ ] No SSRF — external URLs validated and allowlisted
- [ ] JWT tokens have reasonable expiry, stored securely

## ERP Patterns Compliance
- [ ] Types/schemas defined in `@erp/shared` first, not inline
- [ ] Server imports use `.js` extension (ESM requirement)
- [ ] Routes use `authenticate` middleware and `AuthRequest` type
- [ ] Zod validation on all request bodies: `Schema.parse(req.body)`
- [ ] Error handling uses `NotFoundError`/`BadRequestError` helpers
- [ ] Significant mutations log via `logActivity()`
- [ ] State changes broadcast via `broadcast()` for real-time updates
- [ ] Frontend uses TanStack Query with proper query keys (not raw fetch)
- [ ] Zustand only for auth state, not duplicating server state

## Code Quality
- [ ] No `any` types — use proper typing from `@erp/shared` or Prisma
- [ ] No dead code or unused imports
- [ ] Error messages are descriptive (include entity IDs, status values)
- [ ] Database queries are efficient (include necessary `select`/`include`, avoid N+1)
- [ ] No hardcoded values — use enums and constants from `@erp/shared`

## Output Format
For each finding, report:
```
[SEVERITY] Category — Description
  File: path/to/file.ts#L42
  Fix: Brief description of what to change
```
Severities: CRITICAL (security/data loss), HIGH (broken functionality), MEDIUM (convention violation), LOW (style/optimization).
