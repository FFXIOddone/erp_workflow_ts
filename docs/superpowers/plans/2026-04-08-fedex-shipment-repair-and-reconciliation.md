# FedEx Shipment Repair and Reconciliation

AGENT-AUTO | COMPLETE

## Goal
Repair the FedEx shipments experience so linked shipments are accurate, the FedEx page shows shipment-level records instead of noisy raw log rows, and tracked shipments are reconciled in the ERP fast enough for ongoing use.

## Slices
- [x] Add a backend path that reconciles every shipment with a tracking number, including delivered rows, so the ERP can repair existing linked shipment data in one pass.
- [x] Group the FedEx shipments page by tracking number and show the latest shipment-level evidence instead of repeating raw import rows as separate shipments.
- [x] Validate the touched server and web slices and log the work in the autonomy notes.

## Notes
- Keep the hourly refresh lean so it still only touches the active/shipped set.
- Use the full reconciliation path for manual cleanup and backfill, not for the hourly cadence.
- Prefer actual scan/status evidence over raw destination placeholders when a row has live FedEx data.
- Manual full reconciliation has been run against the current tracked-shipment set, and the grouped view now surfaces conflict counts for rows that still need human review.
