# Security Remediation — Next Steps

**Reference:** [SECURITY_AUDIT_REPORT.md](SECURITY_AUDIT_REPORT.md)  
**Target:** Complete Phase 1 before portal launch. Phase 2 within 30 days.

---

## Phase 1 — MUST DO Before Portal Launch (Est. 1-2 days)

These are blocking issues. Do not expose the portal to the internet until all items are resolved.

### 1.1 Remove All Hardcoded JWT Secret Fallbacks
**Priority:** P0 — Critical  
**Files to change:**
- `packages/server/src/middleware/auth.ts` — Remove `?? 'change-this-in-production'`
- `packages/server/src/ws/server.ts` — Remove `|| 'dev-secret-change-in-production'`
- `packages/server/src/routes/portal.ts` — Remove `|| 'portal-dev-secret'`

**Action:**
```typescript
// auth.ts — BEFORE
const JWT_SECRET = process.env.JWT_SECRET ?? 'change-this-in-production';

// auth.ts — AFTER
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');
```

Do the same for `portal.ts` using `PORTAL_JWT_SECRET` and `ws/server.ts` using `JWT_SECRET`.

**Generate production secret:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Add to `.env`:
```
JWT_SECRET=<64-char-hex-from-above>
PORTAL_JWT_SECRET=<different-64-char-hex>
```

---

### 1.2 Lock Down Portal Registration
**Priority:** P0 — Critical  
**File:** `packages/server/src/routes/portal.ts`

**Recommended approach — Invitation-based registration:**

1. Add a `PortalInvite` model to Prisma schema:
```prisma
model PortalInvite {
  id          String   @id @default(uuid())
  email       String
  customerId  String
  token       String   @unique
  expiresAt   DateTime
  usedAt      DateTime?
  createdById String
  createdAt   DateTime @default(now())
  
  customer    Customer @relation(fields: [customerId], references: [id])
  createdBy   User     @relation(fields: [createdById], references: [id])
}
```

2. Add admin endpoint to create invites (sends email with registration link)
3. Modify `/portal/auth/register` to require `inviteToken` parameter
4. Validate token, verify email matches, mark invite as used

---

### 1.3 Add Rate Limiting to Portal Auth Routes
**Priority:** P0 — High  
**File:** `packages/server/src/routes/portal.ts`

Add before the auth routes:
```typescript
import { loginRateLimiter } from '../middleware/rate-limiter.js';
import rateLimit from 'express-rate-limit';

const portalAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, error: 'Too many attempts. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const portalRegisterLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { success: false, error: 'Too many registration attempts.' },
});

// Apply to routes:
router.post('/auth/login', portalAuthLimiter, async (req, res) => { ... });
router.post('/auth/register', portalRegisterLimiter, async (req, res) => { ... });
router.post('/auth/forgot-password', portalAuthLimiter, async (req, res) => { ... });
router.post('/auth/reset-password', portalAuthLimiter, async (req, res) => { ... });
```

---

### 1.4 Enable Content Security Policy in Production
**Priority:** P1 — High  
**File:** `packages/server/src/index.ts`

Replace:
```typescript
app.use(helmet({
  contentSecurityPolicy: isProduction ? false : undefined,
}));
```

With:
```typescript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: isProduction ? [] : null,
    },
  },
}));
```

**Test after applying** — if any SPA functionality breaks, add specific exceptions as needed.

---

### 1.5 Use Separate Portal JWT Secret
**Priority:** P1 — High  
**File:** `packages/server/src/routes/portal.ts`

```typescript
// BEFORE
const JWT_SECRET = process.env.JWT_SECRET || 'portal-dev-secret';

// AFTER
const PORTAL_JWT_SECRET = process.env.PORTAL_JWT_SECRET;
if (!PORTAL_JWT_SECRET) throw new Error('PORTAL_JWT_SECRET environment variable is required');
```

Update `generatePortalToken()` and `portalAuth()` to use `PORTAL_JWT_SECRET`.

---

### 1.6 Add WebSocket Origin Validation
**Priority:** P1 — High  
**File:** `packages/server/src/ws/server.ts`

```typescript
export function setupWebSocket(wss: WebSocketServer): void {
  // Add origin validation
  wss.on('headers', (headers, request) => {
    // Optional: Add security headers to WS upgrade response
  });
  
  wss.options.verifyClient = (info, callback) => {
    const origin = info.origin || info.req.headers.origin;
    const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').map(o => o.trim());
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(true);
    } else {
      callback(false, 403, 'Origin not allowed');
    }
  };
  // ... rest of setup
}
```

---

### 1.7 Set Up TLS (HTTPS)
**Priority:** P1 — High  
**Cost:** $0

**Recommended: Cloudflare Tunnel (easiest, free)**
1. Create free Cloudflare account
2. Add your domain
3. Install `cloudflared` on the server
4. Create tunnel: `cloudflared tunnel create erp`
5. Route traffic: `cloudflared tunnel route dns erp portal.yourdomain.com`
6. Run: `cloudflared tunnel --url http://localhost:8001`

**Alternative: Caddy reverse proxy (also free)**
```
# Caddyfile
portal.yourdomain.com {
    reverse_proxy localhost:8001
}
```
Caddy auto-provisions Let's Encrypt certs.

---

## Phase 2 — Should Do Within 30 Days

### 2.1 Fix Path Traversal in File Browser List Endpoint
**File:** `packages/server/src/routes/file-browser.ts` (line ~318)

Replace:
```typescript
const sanitizedSubfolder = subfolder.replace(/\.\./g, '');
folderPath = path.join(folderPath, sanitizedSubfolder);
```

With:
```typescript
const resolvedPath = path.resolve(folderPath, subfolder);
if (!resolvedPath.startsWith(path.resolve(folderPath))) {
  throw BadRequestError('Invalid subfolder path');
}
folderPath = resolvedPath;
```

---

### 2.2 Add Authentication to Updates Publish Endpoint
**File:** `packages/server/src/routes/updates.ts`

Add at the top:
```typescript
import { authenticate, requireRole } from '../middleware/auth.js';
import { UserRole } from '@erp/shared';

// Require admin auth for publishing
router.post('/publish', authenticate, requireRole(UserRole.ADMIN), upload.single('bundle'), ...);
```

Leave download unauthenticated if needed for Tauri auto-updates, but consider signed URLs.

---

### 2.3 Secure Client-Errors Endpoint
**File:** `packages/server/src/routes/client-errors.ts`

```typescript
import rateLimit from 'express-rate-limit';

const errorReportLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Rate limited' },
});

router.post('/', errorReportLimiter, (req, res) => {
  // Truncate all fields
  const sanitize = (val: any, maxLen = 500) => 
    typeof val === 'string' ? val.substring(0, maxLen) : val;
  
  // ... rest of handler with sanitized values
});
```

---

### 2.4 Fix npm Vulnerabilities
```bash
# Fix AWS SDK vulnerabilities (most of the 31 high-severity)
npm audit fix

# Replace xlsx (unfixable vulnerability)
npm uninstall xlsx
npm install exceljs  # or sheetjs-ce

# Update electron-builder
npm install electron-builder@latest
```

---

### 2.5 Strengthen Portal Password Policy
**File:** `packages/shared/src/schemas.ts`

```typescript
export const PortalRegisterSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(10, 'Password must be at least 10 characters')
    .regex(/[a-z]/, 'Must contain a lowercase letter')
    .regex(/[A-Z]/, 'Must contain an uppercase letter')  
    .regex(/[0-9]/, 'Must contain a number'),
  // ... rest
});
```

Update `PortalResetPasswordSchema` and `PortalChangePasswordSchema` similarly.

---

### 2.6 Sanitize Error Responses
**File:** `packages/server/src/middleware/error-handler.ts`

```typescript
// Replace Prisma validation error handler
if (err instanceof Prisma.PrismaClientValidationError) {
  logErrorToFile(_req, 500, `Prisma validation: ${err.message.substring(0, 500)}`);
  res.status(500).json({
    success: false,
    error: 'An internal error occurred',
    // Do NOT send err.message to client
  });
  return;
}
```

---

### 2.7 Secure Docker for Production
**Create `docker-compose.production.yml`:**
```yaml
version: '3.8'
services:
  postgres:
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}  
    ports: []  # Don't expose port externally
  # Remove pgAdmin entirely in production
```

---

### 2.8 Add Audit Logging for Portal Actions
Add `logActivity()` to all portal write operations:
- Proof approvals/rejections
- Quote approvals/rejections
- Reorders
- File uploads
- Profile changes
- Messages sent

---

## Phase 3 — Nice to Have (60+ Days)

### 3.1 Move Rate Limiting to Redis
When you scale beyond a single server instance, switch from in-memory rate limit stores to Redis:
```bash
npm install rate-limit-redis ioredis
```

### 3.2 Add CSRF Tokens for Cookie-Based Auth
If you ever switch from Bearer tokens to cookies, add CSRF protection with `csurf` or double-submit cookie pattern.

### 3.3 Implement Token Revocation
Add a token blocklist (in Redis or DB) so that tokens can be invalidated on password change, role change, or manual revocation.

### 3.4 Add Security Headers for Portal
```typescript
// Additional headers for portal routes
app.use('/portal', (req, res, next) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  next();
});
```

### 3.5 Consider 2FA for Admin Accounts
Implement TOTP-based two-factor authentication for admin and manager roles. Free libraries:
- `otpauth` (npm) — generates and verifies TOTP codes
- Frontend: QR code with `qrcode` npm package

### 3.6 Set Up Log Monitoring
Use free log aggregation to detect anomalies:
- **Grafana Loki** (free, self-hosted) — log aggregation
- **Uptime Kuma** (free, self-hosted) — uptime monitoring + alerting

---

## Pre-Launch Checklist

Before opening the portal to customers, verify each item:

- [ ] `JWT_SECRET` is a cryptographically random 64+ character string in production `.env`
- [ ] `PORTAL_JWT_SECRET` is a different random string in production `.env`
- [ ] Portal registration requires invitation token (or admin approval)
- [ ] Rate limiting is active on all portal auth endpoints
- [ ] CSP is enabled with proper directives
- [ ] WebSocket validates origin header
- [ ] HTTPS is enforced (either via reverse proxy or direct TLS)
- [ ] `NODE_ENV=production` is set in production
- [ ] Docker credentials are changed from defaults
- [ ] `npm audit` shows no critical vulnerabilities
- [ ] Password policy requires 10+ chars with complexity
- [ ] Error responses don't leak internal details
- [ ] All portal data queries are scoped to `customerId` (already verified ✓)
- [ ] File upload restrictions are in place (already verified ✓)
- [ ] Tested: Portal user cannot access internal API endpoints
- [ ] Tested: Portal user cannot see other customers' data
- [ ] Tested: Portal user cannot perform admin actions

---

## Budget Summary

| Item | Cost |
|------|------|
| Code changes (Phase 1-2) | $0 |
| TLS via Cloudflare or Let's Encrypt | $0 |
| Redis (if needed) | $0 (self-hosted or Upstash free tier) |
| **Total required spend** | **$0** |

---

*This document should be updated as items are completed. Check off items in the pre-launch checklist above.*
