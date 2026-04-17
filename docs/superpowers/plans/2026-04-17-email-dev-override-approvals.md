# Email Dev Override Safety

AGENT-AUTO | COMPLETE

## Goal
Prevent any customer-facing email from leaving the ERP during development by routing outbound mail to `approvals@wilde-signs.com`.

## Tasks
- [x] Add a central development-only email reroute in the server mailer.
- [x] Seed the development override in active env files and examples.
- [x] Verify the override with a focused regression test.
- [x] Record the safety rule in autonomy logs so it is easy to find later.
