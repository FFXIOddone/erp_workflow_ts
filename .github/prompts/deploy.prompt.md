---
mode: agent
description: "Deployment workflow: build, verify, push to production server"
---

# Deployment

Guide the deployment process for the Wilde Signs ERP system.

## Pre-Deploy Checklist
1. **Check for errors**: Run TypeScript diagnostics across all packages. Fix any errors before proceeding.
2. **Verify database**: Ensure `schema.prisma` changes have been pushed with `npm run db:push`. Check that enums in `@erp/shared` match Prisma enums.
3. **Check `.env`**: Verify production environment variables are set (DATABASE_URL, JWT_SECRET, SMTP settings, WooCommerce keys).
4. **Test critical paths**: Verify login works, order creation works, WebSocket connects.

## Build
```bash
# Build all packages in dependency order
npm run build          # or use build-all.bat
```

## Deploy
```bash
# Push to production server
push-to-server.bat
```

## Post-Deploy
1. Verify the server starts without errors on the production host
2. Check that WebSocket connections establish
3. Verify the web dashboard loads and can authenticate
4. Check that WooCommerce sync is running (if applicable)
5. Monitor logs for the first few minutes for unexpected errors

## Rollback
If something goes wrong:
1. SSH into the production server
2. Revert to the previous deployment
3. Restart the service with `restart-on-crash.bat`

## Notes
- The production server runs on port 8001 (API) and serves the web build statically
- `start-production.bat` is the production entry point
- `restart-on-crash.bat` provides automatic restart on failures
