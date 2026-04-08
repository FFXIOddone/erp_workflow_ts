# Blockers

## Open

| Timestamp | Task ID | Source | Blocker | Needs | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-04-08T09:46:15.2320654-04:00 | FEDEX-TRACKING-082 | validation | The current local FedEx credentials still behave like sandbox credentials when pointed at the production API, so live FedEx tracking will fail until production OAuth credentials are supplied or an explicit sandbox override is set. | Production FedEx OAuth credentials for live tracking, or a deliberate `FEDEX_API_BASE_URL=sandbox` override if the sandbox lane must remain in use | open | The code now defaults to the live FedEx endpoint so future orders can link correctly once production credentials are available, but the current credential set cannot authenticate to production. |
| 2026-04-01T15:25:58.5937653-04:00 | SHIPMENTS-TRACKING-045 | validation | The remaining 34 shipment rows on the Shipments page do not have a matching FedEx/store-code record, and the repo does not yet have a UPS/USPS/manual tracking source for them. | A carrier-specific source or manual tracking capture for the non-FedEx `OTHER` shipments | open | The current FedEx share now imports correctly and updates 13 shipment rows, but the rest of the page still needs a separate source feed. |
| 2026-03-25T20:12:18.169Z | PRINT-STATION-ROUTING-001 | validation | Vitest cannot execute targeted server tests because the local install is missing the std-env package. | Restore the missing Vitest dependency or refresh workspace installs before relying on package tests. | open | Attempted: npm.cmd run test -w @erp/server -- src/lib/routing-defaults.test.ts. Server TypeScript build still passed, so this did not block the code fix itself. |
| 2026-04-01T15:50:08.524Z | PLAN:2026-03-23-ai-optimized-dynamic-routing-engine | validation | Shared package lint baseline fails on pre-existing unused imports and type debt in unrelated files | Repo-wide shared lint cleanup before npm run lint -w @erp/shared can pass cleanly | open | The routing contract slice itself builds cleanly and targeted lint on the touched files shows only baseline debt outside this patch. |
| 2026-04-01T17:43:40.591Z | SSS-API-001 | server-validation | Server TypeScript build fails on pre-existing Prisma typing drift and implicit-any debt in unrelated files | Repo-wide server typing cleanup before the full build can pass cleanly | open | The new routing feedback helper and its regression test are clean; the failure is baseline repo debt, not this slice. |
| 2026-04-01T18:03:38.953Z | WOOCOMMERCE-STARTUP-044 | user-request | WooCommerce admin credentials from docs/PASSWORDS & LOGINS.docx do not authenticate to wp-login | Current WordPress/WooCommerce admin access or fresh REST API consumer key/secret credentials | open | Tried the documented WooCommerce login plus the obvious admin/email variants; WordPress returns an incorrect username/password error. |
<!-- BLOCKER_OPEN_ROWS -->

## Resolved

| Timestamp | Task ID | Source | Blocker | Resolution | Notes |
| --- | --- | --- | --- | --- | --- |
| 2026-03-25T19:39:48.076Z | INFRA-DISK-LOW-008 | runtime-audit | C drive ran out of free space during autonomous validation, causing file writes and log updates to fail. | Recovered disk headroom, restored the damaged materials route from HEAD, recreated the autonomy log templates, and resumed the normal loop. | The immediate incident is resolved; continue watching generated build output so the workspace stays stable. |
<!-- BLOCKER_RESOLVED_ROWS -->
