# FedEx XML Import Plan

## Goal
Replace reliance on the locked `shipnet.db` with a date-aware parser for the live FedEx Ship Manager XML logs and persist the discovered shipment records in our own database.

## Assumptions
- The live file format is `FxLogSrMMDDYYYY.xml`.
- The file is updated throughout the day, so the connector should always resolve the current date first and then fall back to the most recent matching log if needed.
- We only need read access to the FedEx PC; all durable data lives in ERP.

## Slices
- [x] Add a dedicated Prisma model for FedEx shipment log records.
- [x] Implement a parser/sync service that reads today’s log file and upserts normalized shipment records.
- [x] Expose authenticated API routes for sync, status, and record browsing.
- [x] Add focused tests for date-based log resolution and request field parsing.
- [x] Validate with server typecheck/build and record the run in autonomy logs.
