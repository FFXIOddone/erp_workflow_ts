# Production Complete Validation and Station Theme

AGENT-AUTO | COMPLETE

## Goal
Expose the existing order-completion validation flow on the Production shop-floor page, and normalize the shop-floor / ERP station colors and station picker presentation so they read as one coherent system.

## Slices
- [x] Add an `Already Complete` action on Production that opens a modal for estimated ship date plus validation request.
- [x] Update notification display mappings so the manager/admin validation request is visible and readable in the ERP.
- [x] Rework the station picker layout to feel intentional and professional, while keeping the station color palette canonical.
- [x] Align print status colors so Printing is blue, Shipping is green, Production is orange, Install is yellow, and Order Entry is turquoise.
- [x] Validate the touched packages in dependency order.

## Notes
- The server-side validation route already exists, so the user-facing work should stay focused on the Production UI and shared color/theme cleanup.
- Keep existing in-flight FedEx and shipment work untouched.
