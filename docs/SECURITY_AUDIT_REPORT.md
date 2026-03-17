# Security Audit Report — Wilde Signs ERP & Customer Portal

**Date:** February 26, 2026  
**Scope:** Full workspace — server, portal, web, shared, desktop packages  
**Classification:** Internal — Do Not Distribute

---

## Executive Summary

The Wilde Signs ERP system has a **solid foundation** with many security best practices already in place (Helmet, bcrypt, Zod validation, Prisma ORM, JWT token separation, rate limiting). However, there are **12 critical and high-severity issues** that must be resolved before opening the customer portal to the public. Most fixes are **free** and require only code changes. One optional purchase (TLS certificate) is recommended if not already handled by a reverse proxy.

### Risk Rating: **MEDIUM-HIGH** (pre-remediation) → **LOW** (post-remediation)

---

## Findings Summary

| # | Finding | Severity | Cost to Fix | Effort |
|---|---------|----------|-------------|--------|
| 1 | JWT Secret Fallback Defaults in Code | **CRITICAL** | Free | 30 min |
| 2 | Portal Registration Open to Anyone | **CRITICAL** | Free | 2-4 hrs |
| 3 | No Rate Limiting on Portal Auth Routes | **HIGH** | Free | 1 hr |
| 4 | CSP Disabled in Production | **HIGH** | Free | 2 hrs |
| 5 | Portal Shares JWT_SECRET with Internal API | **HIGH** | Free | 1 hr |
| 6 | WebSocket No Origin Validation | **HIGH** | Free | 1 hr |
| 7 | Path Traversal Weakness in File Browser | **MEDIUM** | Free | 1 hr |
| 8 | Updates Route Has No Authentication | **MEDIUM** | Free | 30 min |
| 9 | Client-Errors Route Unauthenticated Log Injection | **MEDIUM** | Free | 1 hr |
| 10 | Docker Default Credentials Exposed | **MEDIUM** | Free | 30 min |
| 11 | 43 npm Vulnerabilities (3 Critical) | **MEDIUM** | Free | 1-2 hrs |
| 12 | Password Policy Too Weak for Portal | **MEDIUM** | Free | 30 min |
| 13 | Sensitive Data in Error Responses | **LOW** | Free | 1 hr |
| 14 | No HTTPS Enforcement | **LOW** | Free/$0-12/yr | 1 hr |
| 15 | In-Memory Rate Limit Store | **LOW** | Free | Future |
| 16 | No Audit Trail for Portal Actions | **LOW** | Free | 2-4 hrs |

---

## Detailed Findings

### 1. CRITICAL — JWT Secret Fallback Defaults in Code

**Files affected:**
- `packages/server/src/middleware/auth.ts` (line 18): `'change-this-in-production'`
- `packages/server/src/ws/server.ts` (line 33): `'dev-secret-change-in-production'`
- `packages/server/src/routes/portal.ts` (line 105): `'portal-dev-secret'`

**Risk:** If `JWT_SECRET` env var is unset, the application falls back to hardcoded strings. Anyone with access to the source code (including this repo) can forge valid JWT tokens and **impersonate any user, including admins**.

**Note:** The env-validation.ts does warn in development and throw in production when `NODE_ENV=production`. However, the portal route has its own separate fallback (`portal-dev-secret`) that **bypasses** the env-validation check entirely.

**Fix:**
- Remove all fallback/default JWT secrets from code.
- Make `JWT_SECRET` a required env variable (fail-fast on startup if missing).
- Use a separate `PORTAL_JWT_SECRET` env var for portal tokens (defined in env-validation but not actually used in portal.ts).

---

### 2. CRITICAL — Portal Registration Open to Anyone with a Customer ID

**File:** `packages/server/src/routes/portal.ts` (lines 153-210)

**Risk:** Anyone who knows or guesses a valid `customerId` (UUID) can register a portal account and gain access to that customer's orders, pricing, financial data, proofs, and messaging. UUIDs are hard to guess randomly, but they may be leaked via URLs, emails, or API responses.

**Fix Options (free):**
- **Option A (Recommended):** Require an invitation code. Admin creates a portal invite, which generates a one-time token. Registration requires this token.
- **Option B:** Require admin approval before activating portal accounts (account created in `pending` state, admin manually approves).
- **Option C:** Restrict registration to pre-approved email domains associated with each customer.

---

### 3. HIGH — No Rate Limiting on Portal Auth Routes

**File:** `packages/server/src/routes/portal.ts`

**Risk:** The internal login (`/auth/login`) has dedicated rate limiting (`loginRateLimiter`, `preLoginCheck`, progressive delays, account lockout). The portal login (`/portal/auth/login`), register, and forgot-password routes have **none of these protections**. An attacker can brute-force portal passwords or enumerate accounts via registration and forgot-password timing attacks.

**Fix:** Apply rate limiting middleware to all portal auth endpoints:
- `/portal/auth/login` — strict rate limit (5 attempts/15 min per IP)
- `/portal/auth/register` — moderate rate limit (3 registrations/hour per IP)
- `/portal/auth/forgot-password` — moderate rate limit (3 requests/hour per IP)
- `/portal/auth/reset-password` — strict rate limit

---

### 4. HIGH — Content Security Policy (CSP) Disabled in Production

**File:** `packages/server/src/index.ts` (line 103)

```typescript
app.use(helmet({
  contentSecurityPolicy: isProduction ? false : undefined,
}));
```

**Risk:** CSP is the primary defense against XSS attacks. Disabling it in production (the environment that matters most) removes this protection. The comment says "SPA needs inline scripts," but this can be solved with nonces or hashes.

**Fix:** Configure a proper CSP instead of disabling it:
```typescript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Tailwind needs this
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
}));
```

---

### 5. HIGH — Portal Shares JWT_SECRET with Internal API

**File:** `packages/server/src/routes/portal.ts` (line 105)

```typescript
const JWT_SECRET = process.env.JWT_SECRET || 'portal-dev-secret';
```

**Risk:** Portal tokens and internal tokens are signed with the same secret. While there is token-type checking (the `authenticate` middleware rejects `type: 'portal'` tokens), this is defense-in-depth that relies on a single check. If any endpoint forgets to check the type, a portal user could access internal API endpoints.

**Fix:** Use a dedicated `PORTAL_JWT_SECRET` environment variable (already defined in env-validation.ts but never used):
```typescript
const PORTAL_JWT_SECRET = process.env.PORTAL_JWT_SECRET || process.env.JWT_SECRET;
```

---

### 6. HIGH — WebSocket Has No Origin Validation

**File:** `packages/server/src/ws/server.ts`

**Risk:** The WebSocket server accepts connections from any origin. There's no `verifyClient` callback to check the `Origin` header. This enables:
- Cross-Site WebSocket Hijacking (CSWSH)
- Unauthorized clients connecting and receiving broadcast messages (order updates, etc.)

**Note:** Authentication is done post-connection via `AUTHENTICATE` message, but before authentication, the client already receives the `USER_JOINED` welcome message and could potentially receive broadcast messages during the race window.

**Fix:**
```typescript
const wss = new WebSocketServer({ 
  server,
  verifyClient: ({ origin }) => {
    const allowed = env.CORS_ORIGIN.split(',').map(o => o.trim());
    return allowed.includes(origin);
  }
});
```

---

### 7. MEDIUM — Path Traversal Weakness in File Browser

**File:** `packages/server/src/routes/file-browser.ts` (line 318)

```typescript
const sanitizedSubfolder = subfolder.replace(/\.\./g, '');
```

**Risk:** The `..` stripping is naive. Patterns like `....//` or URL-encoded `%2e%2e%2f` could bypass this filter. The file serving endpoint at line 442 does proper `path.resolve()` + `startsWith()` checking, but the list endpoint on line 318 only strips `..` without the resolve check.

**Fix:** Apply the same robust validation everywhere:
```typescript
const resolvedPath = path.resolve(baseFolderPath, subfolder);
if (!resolvedPath.startsWith(path.resolve(baseFolderPath))) {
  throw BadRequestError('Invalid path');
}
```

---

### 8. MEDIUM — Updates Route Has No Authentication

**File:** `packages/server/src/routes/updates.ts`

**Risk:** The `/api/v1/updates/download/:filename` endpoint serves update binaries (MSI, exe) without any authentication. While this is intentional for Tauri auto-updates, it means:
- Anyone who discovers the endpoint can download your software
- The publish endpoint should be admin-only but lacks auth checks

**Fix:**
- Add authentication to the `POST /publish` endpoint (admin-only)
- For download, if public access is intended for auto-update, add signed URL verification or a download token

---

### 9. MEDIUM — Client-Errors Route: Unauthenticated Log Injection

**File:** `packages/server/src/routes/client-errors.ts`

**Risk:** This endpoint is intentionally unauthenticated (errors may happen before login). However, an attacker can:
- Flood the log file with garbage data (DoS on disk)
- Inject crafted log entries that could mislead debugging or cause log parsing issues

**Fix:**
- Add rate limiting (e.g., 10 requests/minute per IP)
- Limit request body size (max 5KB)
- Sanitize/truncate all fields before logging

---

### 10. MEDIUM — Docker Default Credentials in docker-compose.yml

**File:** `docker-compose.yml`

```yaml
POSTGRES_USER: erp_user
POSTGRES_PASSWORD: erp_password
PGADMIN_DEFAULT_PASSWORD: admin123
```

**Risk:** If docker-compose is used in production with these defaults, the database is accessible with known credentials. pgAdmin with `admin123` is particularly dangerous.

**Fix:**
- Use environment variables or Docker secrets for credentials
- Remove pgAdmin from production compose file
- Add a `docker-compose.production.yml` override with secure defaults

---

### 11. MEDIUM — 43 npm Vulnerabilities (3 Critical, 31 High)

**Source:** `npm audit`

**Key vulnerable packages:**
- `@aws-sdk/*` — 31 high-severity issues (fixable with update)
- `xlsx` — high severity, prototype pollution, **no fix available**
- `tar` / `electron-builder` — moderate
- `odbc` — moderate

**Fix:**
- Run `npm audit fix` to resolve AWS SDK vulnerabilities
- Replace `xlsx` with `sheetjs-ce` (community edition) or `exceljs` (both free)
- Update electron-builder to latest

---

### 12. MEDIUM — Password Policy Too Weak for Portal

**File:** `packages/shared/src/schemas.ts` (line 1085)

```typescript
password: z.string().min(8, 'Password must be at least 8 characters'),
```

**Risk:** 8-character minimum with no complexity requirements allows passwords like `password`, `12345678`, `qwerty12`.

**Fix:** Strengthen the schema:
```typescript
password: z.string()
  .min(10, 'Password must be at least 10 characters')
  .regex(/[a-z]/, 'Must contain a lowercase letter')
  .regex(/[A-Z]/, 'Must contain an uppercase letter')
  .regex(/[0-9]/, 'Must contain a number')
```

---

### 13. LOW — Sensitive Data Leakage in Error Responses

**File:** `packages/server/src/middleware/error-handler.ts`

**Risk:** Prisma errors (line 75-82) send `err.message` directly to clients. In some Prisma error cases, this includes database schema details, field names, or query structure.

**Fix:** Return generic messages for Prisma validation errors:
```typescript
if (err instanceof Prisma.PrismaClientValidationError) {
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
}
```

---

### 14. LOW — No HTTPS Enforcement

**Risk:** The server binds to `0.0.0.0:8001` on HTTP. If there's no reverse proxy (nginx, Cloudflare, etc.) in front, all traffic including JWT tokens and passwords is transmitted in plaintext.

**Fix (Free options):**
- **Cloudflare Tunnel** (free tier) — easiest, provides TLS + DDoS protection
- **Let's Encrypt + Caddy** (free) — auto-renewing TLS certs
- **nginx reverse proxy** with Let's Encrypt certbot (free)

**Cost:** $0 with any of the above. Only paid if you want a custom EV certificate.

---

### 15. LOW — In-Memory Rate Limiting Store

**File:** `packages/server/src/middleware/rate-limiter.ts` (line 41)

**Risk:** Rate limiting uses in-memory Maps. If the server restarts, all lockout counters reset. Not a vulnerability per se, but reduces effectiveness of brute-force protection.

**Fix (Future):** When scaling to multiple instances, use Redis. For a single-server deployment, this is acceptable.

---

### 16. LOW — No Audit Trail for Portal User Actions

**Risk:** Portal user actions (proof approvals, messages, reorders, quote approvals) are not consistently logged to the activity log with the portal user's identity. This makes it harder to investigate disputes or unauthorized actions.

**Fix:** Add `logActivity()` calls to all portal write operations with a `PORTAL_USER` entity type.

---

## What's Already Good ✓

These are security measures that are properly implemented:

| Area | Implementation | Status |
|------|---------------|--------|
| **Password Hashing** | bcrypt with cost factor 12 | ✓ Excellent |
| **Input Validation** | Zod schemas on all endpoints | ✓ Excellent |
| **SQL Injection** | Prisma ORM (parameterized queries) | ✓ Excellent |
| **Token Type Separation** | Portal tokens marked with `type: 'portal'` | ✓ Good |
| **Token Type Enforcement** | Internal API rejects portal tokens | ✓ Good |
| **Security Headers** | Helmet middleware enabled | ✓ Good |
| **File Upload Security** | Extension blocklist + MIME whitelist + size limits | ✓ Good |
| **Upload Path Traversal** | `path.basename()` + `startsWith()` validation | ✓ Good |
| **Customer Data Isolation** | Portal queries scoped to `customerId` consistently | ✓ Good |
| **Anti-Enumeration** | Forgot-password always returns success | ✓ Good |
| **Internal Rate Limiting** | Login brute-force protection with lockout | ✓ Good |
| **Global API Rate Limit** | 200 req/min per IP | ✓ Good |
| **Role-Based Access** | `requireRole()` middleware on admin endpoints | ✓ Good |
| **Environment Validation** | Zod schema on startup with fail-fast | ✓ Good |
| **Error Handling** | Global error handler, no stack traces to client | ✓ Good |
| **Secrets in .gitignore** | `.env` properly git-ignored | ✓ Good |
| **Pricing Server-Side** | Quote engine uses server-side pricing, not client | ✓ Good |

---

## Purchases Required

| Item | Cost | Required? | Why |
|------|------|-----------|-----|
| TLS Certificate | $0 (Let's Encrypt) | **YES** | Encrypts all traffic. Free. |
| Redis | $0 (self-hosted) or $0 (Upstash free tier) | No | Only needed at scale for rate limiting |
| WAF (Web Application Firewall) | $0 (Cloudflare free) | Recommended | DDoS protection + bot mitigation |
| Penetration Test | $2,000-10,000 | No | Optional professional validation |
| Bug Bounty | $0-500 | No | Optional crowdsourced testing |

**Bottom line: $0 in mandatory purchases.** All critical and high-severity fixes are free code changes. The recommended Cloudflare free tier for TLS + WAF is also $0.

---

## Risk Matrix After Remediation

| Threat | Before | After | Notes |
|--------|--------|-------|-------|
| Token Forgery | Critical | Eliminated | Strong secrets required |
| Account Takeover | High | Low | Rate limiting + strong passwords |
| Unauthorized Portal Access | Critical | Low | Invitation-based registration |
| XSS | High | Low | CSP enabled |
| CSRF via WebSocket | High | Low | Origin validation |
| Brute Force | Medium | Low | Portal rate limiting added |
| Data Exposure | Medium | Low | Error sanitization |
| Path Traversal | Medium | Eliminated | Consistent path validation |

---

*Report prepared by automated security audit. Findings should be validated by the development team.*
