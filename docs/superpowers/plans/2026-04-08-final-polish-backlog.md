# Final Polish Backlog

AGENT-AUTO | IN PROGRESS

## Goal
Close the remaining polish gaps in the ERP without duplicating the already-completed FedEx, production-calendar, routing, or install-flow work. Keep each slice small, independently verifiable, and focused on visible quality, data truth, or operator clarity.

## Slices
- [x] Replace the `PrinterMonitor` SNMP placeholder in `packages/wilde-core` with an explicit unsupported/error path so it never reports a false "Ready" state.
- [x] Fix the `OrdersPage` advanced filter crash by normalizing the users payload before the dropdown renders.
- [x] Fix the Shop Floor station-selection crash by normalizing order and station payloads before array methods are used.
- [x] Repair the Subcontractors page 400 error so the page loads cleanly and shows a useful empty/error state.
- [x] Replace missing PWA icon references with valid assets and correct manifest file types.
- [ ] Remove the Activity page count flash and show a stable loading placeholder until stats arrive.
- [ ] Ensure Job Costing never shows `Invalid Date` for the last-calculated value.
- [ ] Audit user-facing `Unknown` fallbacks across the web app and replace them with context-specific copy.
- [ ] Audit shipment and FedEx fallback copy so unresolved rows say exactly what failed instead of implying a valid destination.
- [ ] Audit order-detail linked-data counters so each count reflects the actual record source and not a derived placeholder.
- [ ] Make shipment detail drawers always show the latest known scan history before any fallback destination text.
- [ ] Surface the exact FedEx lookup key used for any unresolved shipment so operators can repair the record faster.
- [ ] Add a manual reconcile action for ambiguous shipment records that need operator review.
- [ ] Label FedEx rows that came from sandbox data clearly so they cannot be mistaken for production tracking.
- [ ] Review and normalize remaining service-code labels across all FedEx surfaces.
- [ ] Standardize loading skeletons on the order-detail cards so they match visually and structurally.
- [ ] Standardize loading skeletons on shipping, FedEx, and linked-data panels so they do not render differently for the same loading state.
- [ ] Replace remaining bare `Loading...` strings with section-specific messages.
- [ ] Add a shared empty-state component for card sections that currently hand-roll similar empty UI.
- [ ] Add a shared loading-copy helper so page-level spinners read consistently.
- [ ] Make the activity timeline overlap handling consistent wherever timeline points can collide.
- [ ] Ensure grouped activity tooltips show every overlapping item in a readable order.
- [ ] Harmonize badge spacing, radius, and density across order-detail cards.
- [ ] Tighten card height consistency on the order-detail page so wide cards do not dwarf adjacent sections.
- [ ] Improve small-window responsiveness on the order-detail page so important cards stay visible without awkward scroll jumps.
- [ ] Keep full-screen popout behavior consistent for all charts and timelines that can overflow their cards.
- [ ] Ensure all search bars share the same quoted-phrase and exclusion behavior.
- [ ] Remove duplicate local search logic where a shared search helper already exists.
- [ ] Replace misleading `Unknown station` and `Unknown error` UI copy with actionable fallback text.
- [ ] Normalize date formatting across order, shipment, FedEx, and activity views.
- [ ] Normalize time-zone handling for recent event timestamps shown in the UI.
- [ ] Ensure service and carrier labels read consistently across order detail, shipment list, and FedEx detail views.
- [ ] Compact the Production Calendar crowded-day layout without hiding data.
- [ ] Keep Production Calendar lanes limited to the four canonical station groups.
- [ ] Confirm shipped/completed orders drop out of the Production Calendar automatically.
- [ ] Add customer priority definitions that can feed production scheduling defaults.
- [ ] Make the production queue sort priority rules visually obvious to operators.
- [ ] Keep the shop-floor station picker aligned with the canonical station palette and layout.
- [ ] Ensure Order Entry keeps the Brenda turquoise theme consistently across the app.
- [ ] Keep Printing blue, Shipping green, Production orange, and Install yellow on every surface.
- [ ] Apply gradient treatment only to substations, and keep the main station colors solid.
- [ ] Revisit installation workflow copy so actions and completion states are explicit.
- [ ] Keep the `Already Complete` production flow discoverable without introducing extra noise.
- [ ] Reduce noisy development logging that does not help operators or debugging.
- [ ] Consolidate repeated network-share timeout messages into a single actionable pattern.
- [ ] Verify the hourly FedEx refresh only touches shipped or trackable orders.
- [ ] Verify shipment grouping does not inflate counts when mixed-source rows share a tracking number.
- [ ] Verify linked-data sections invalidate together when related shipments, files, or proofs change.
- [ ] Audit all linked-data counters so their numbers match the underlying rows and files.
- [ ] Finish the remaining Obsidian field-map notes for the major order-detail data paths.

## Notes
- This backlog intentionally avoids redoing the already-complete FedEx shipment repair, calendar density, routing-source awareness, and installation validation slices.
- Take one independently verifiable slice at a time. Prefer the smallest visible polish win that can be validated cleanly.
