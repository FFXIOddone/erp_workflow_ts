# Untangle Piping and Polish Sprint

AGENT-AUTO | IN PROGRESS

## Goal
Use the next hours to reduce duplicate route/service logic, untangle cross-system piping, and tighten the visible UI polish that still feels inconsistent.

## Tasks

### FedEx / Shipments
- [x] Create a single FedEx shipment truth builder consumed by `routes/shipments.ts` and `routes/fedex.ts`.
- [x] Move carrier inference into one shared helper for shipment read and repair paths.
- [x] Unify tracking-number normalization across the FedEx list, shipment detail, and hourly sync.
- [x] Consolidate FedEx lookup issue parsing so the same unresolved message appears everywhere.
- [x] Replace destination fallbacks with one explicit `No Address Found` helper.
- [x] Make `routes/shipments.ts` and `fedex.ts` agree on the latest-status source.
- [x] Centralize `trackingEvents` selection so summary and detail views pick the same latest scan.
- [x] Add one helper for PO / reference candidate generation.
- [x] Normalize FedEx service labels before storing and before rendering.
- [x] Move FedEx record grouping by tracking number into one shared summarizer.
- [x] Surface the exact failed lookup key in both shipment list and shipment drawer.
- [x] Prevent mixed-source tracking numbers from collapsing into one false row.
- [x] Make the shipment detail drawer derive its top-line state from the same summary builder as the list.
- [x] Keep shipment fallback copy actionable when lookup fails.
- [x] Unify `linkedWorkOrderCount` calculation for the FedEx page and order details page.
- [x] Make sandbox vs production source labeling flow from one shared shipment metadata field.
- [x] Extract a shared FedEx location formatter and use it across shipping cards.
- [x] Consolidate ambiguous-tracking reconciliation into one repair job.
- [x] Ensure hourly tracking refresh skips shipments with no real FedEx identifier.
- [x] Audit shipment caches so stale values cannot outlive a fresh API result.

### Fiery / RIP
- [x] Create one Fiery media mapping resolver used by JDF builder, queue repair, and diagnostics.
- [x] Move Fiery workflow selection fallback logic out of routes into one service.
- [x] Consolidate Fiery queued, processing, and completed state parsing into one timeline helper.
- [x] Add one helper for Fiery customer metadata resolution.
- [x] Remove duplicate Fiery staged-path repair branches from the sync path.
- [x] Unify Fiery submission job ID parsing so `0` and missing values are handled once.
- [x] Audit Fiery JDF creation for any remaining hardcoded PSA-style defaults.
- [x] Add more known Fiery media mapping rows from the live RIP box.
- [x] Make Fiery diagnostics read the same workflow name that submission uses.
- [x] Extract Fiery download-file matching into one helper.
- [x] Normalize Fiery job naming and work-order extraction in one place.
- [x] Collapse duplicate Fiery hotfolder versus JMF description copy into one source.
- [x] Add a shared JDF assertion test for media, comment, and customer fields.
- [x] Separate physical substrate, RIP mapping, and profile fields in Fiery docs and code comments.
- [x] Make Fiery connection health surface the exact failing stage.
- [x] Reconcile Fiery print-mode values against the RIP-side catalog entries.
- [x] Ensure held Fiery jobs can be inspected without re-running submit logic.
- [x] Audit Fiery queue repair for duplicate writes to the same metadata fields.
- [x] Add a helper to normalize `Any` wildcards in Fiery media table lookups.
- [x] Make the Fiery media mapping table discoverable from Rip Queue diagnostics.

### File Chain / Linked Data
- [x] Create one shared file-chain status evaluator used by order details and the file-chain page.
- [x] Move linked-data summary counts into the same source that drives file-chain rows.
- [x] Unify placeholder creation so batch repair and summary rendering cannot diverge.
- [x] Consolidate file-chain completion heuristics into one helper.
- [ ] Make order-linked-data and file-chain agree on completed-station counts.
- [ ] Extract a shared latest-shipment/latest-attachment selector for order details.
- [ ] Remove duplicate file-chain repair logic from route and service layers.
- [ ] Add a single normalized representation for print, cut, proof, and shipment links.
- [ ] Ensure linked-data warnings always cite the exact missing record type.
- [ ] Prevent summary counters from counting placeholder rows twice.
- [ ] Make the file-chain page and order-detail page read the same normalized chain model.
- [ ] Add a repair helper for missing cut IDs that both pages can consume.
- [ ] Reconcile the file-chain state machine with the linked-data order summary state.
- [ ] Untangle the order-detail card assembly so shipment, file, and proof data all come from one composed model.
- [ ] Make the linked-data refresh broadcast invalidate file-chain and order-detail queries together.
- [ ] Deduplicate code that finds the latest linked shipment or attachment.
- [ ] Keep the file-chain summary from surfacing stale `READY_TO_PRINT` states after completion.
- [ ] Standardize linked-data empty states across shipments, attachments, proofs, and reprints.
- [ ] Add a per-link provenance field so operators can tell where each linked record came from.
- [ ] Audit all order-detail linked-data counts against the raw database rows.

### Orders / Routes
- [ ] Extract a shared station-transition mutation helper from `routes/orders.ts`.
- [ ] Consolidate completion, validation-request, and status-broadcast side effects into one order mutation path.
- [ ] Reduce repeated notification logic in order station routes.
- [ ] Merge duplicate proof-approval broadcast payload shapes.
- [ ] Clean up repeated route-level authorization checks that mirror middleware behavior.
- [ ] Extract one helper for order completion and shipping designation updates.
- [ ] Remove duplicate filter parsing from the order, shipment, and FedEx list routes.
- [ ] Consolidate route-level pagination and sorting defaults into a shared utility.
- [ ] Make `routes/equipment.ts` use shared queue/data builders rather than ad hoc composition.
- [ ] Audit all route handlers for repeated `select` and `include` shapes that can be shared.
- [ ] Unify station label resolution across orders, equipment, and shop-floor routes.
- [ ] Centralize `last updated at` fallback formatting across routes.
- [ ] Remove redundant work-order extraction helpers from multiple controllers.
- [ ] Make the batch repair routes call the same backend service as the single-item routes.
- [ ] Add a shared route helper for `NotFound` versus `BadRequest` shipment responses.
- [ ] Consolidate route-specific activity logging payloads.
- [ ] Replace repeated `broadcast()` wrappers with one helper per domain event.
- [ ] Audit route-level timeout wrappers and keep only the smallest necessary ones.
- [ ] Unify duplicate route handlers that differ only by minor payload shape.
- [ ] Add controller-level tests for any routes that still use custom fallback copy.

### Equipment / Live Data
- [ ] Remove duplicate Fiery and Thrive fetch branches from the flatbed live-data route.
- [ ] Deduplicate Zund queue scanning so the same job set is not rebuilt three times.
- [ ] Consolidate equipment reachability checks into one service-level probe.
- [ ] Make Fiery, Thrive, and Zund live-data cards use one shared summary composer.
- [ ] Reduce repeated timeout wrappers in `routes/equipment.ts`.
- [ ] Move live-data list filtering into one helper per equipment family.
- [ ] Standardize how equipment cards report `linked`, `queued`, and `completed` counts.
- [ ] Share work-order matching logic between equipment live data and file-chain repair.
- [ ] Keep the same job from appearing in both print and cut lists unless it truly is dual-linked.
- [ ] Add a single source for the “last seen” timestamp shown in equipment summaries.
- [ ] Make equipment detail modals use a common header and action bar.
- [ ] Standardize equipment empty-state copy across all live-data tabs.
- [ ] Simplify the download-file scan so it only runs when a connected source changed.
- [ ] Remove duplicate JDF parsing from the equipment route and Fiery service.
- [ ] Keep Zund cut-link repair from racing with Fiery job enrichment.
- [ ] Make equipment job naming use one normalized order/work-order parser.
- [ ] Audit live-data badge counts for duplicated or stale rows.
- [ ] Ensure linked Fiery cut rows never fall back to Thrive cutter-folder data.
- [ ] Keep equipment page search and filters aligned with the shared search helper.
- [ ] Add one repair broadcast path for any equipment row that changes identity.

### Shop Floor / UI
- [ ] Rebuild the shared loading skeleton so the same card chrome is reused on web and shop-floor.
- [ ] Replace one-off empty states on order details with the shared empty-state component.
- [ ] Reuse one search input implementation across pages that already support quoted search.
- [ ] Standardize card padding, radius, and header spacing across shop-floor station screens.
- [ ] Make the station picker use a single palette source for all six stations.
- [ ] Collapse duplicate modal shells in printing, production, shipping, design, and installation stations.
- [ ] Align shop-floor button styles with the ERP side for destructive, primary, and secondary actions.
- [ ] Make the `Already Complete` flow visually consistent with other validation dialogs.
- [ ] Improve the order-entry station so Brenda’s turquoise theme appears on every control.
- [ ] Standardize status pills on order detail, shop-floor, and the RIP queue.
- [ ] Make the printing page and order-detail cards share a common media/status chip component.
- [ ] Rework the FedEx shipment row so it can open detail without a separate action button.
- [ ] Clean up the Zund and Thrive panels so they share one summary layout.
- [ ] Replace mixed icon sizes in card headers with a single icon sizing token.
- [ ] Make full-screen chart and timeline popouts use the same header/footer chrome.
- [ ] Improve mobile stacking on order detail so cards don’t collapse into awkward single columns.
- [ ] Tighten shop-floor station spacing so the selected station remains obvious at a glance.
- [ ] Add a unified `no data yet` treatment for station detail cards.
- [ ] Make the installation page show proof, notes, and completion clearly without extra chrome.
- [ ] Review remaining shop-floor labels for wording that reads like a placeholder or dev tool.

### Search / Filters
- [ ] Keep quoted search, exclusions, and tokenized search behavior in one helper across the app.
- [ ] Remove page-local debounce implementations that duplicate the shared search bar.
- [ ] Make search comboboxes and text inputs share the same clear/reset behavior.
- [ ] Ensure order, company, shipment, and equipment searches rank exact phrases consistently.
- [ ] Standardize search placeholder copy across all list pages.
- [ ] Move advanced filter parsing out of individual pages and into one shared adapter.
- [ ] Make filter chips and search bars agree on active query state.
- [ ] Remove duplicate sort-helper logic from list pages that already use shared table components.
- [ ] Keep date-range filters using the same start/end semantics everywhere.
- [ ] Normalize `any`, `anyone`, and `all` filter labels across pages.
- [ ] Make the search helper respect fuzzy matching and quoted exact phrases simultaneously.
- [ ] Add one common search empty-state message that can be parameterized by entity type.
- [ ] Audit search bars for mixed `Search`, `Filter`, and `Find` labels that mean the same thing.
- [ ] Consolidate search loading spinners so the page doesn’t flicker differently by route.
- [ ] Add tests for quoted phrase search on the remaining pages that still use a local filter.
- [ ] Replace duplicate `no results` cards with one shared component.
- [ ] Ensure list search remains accessible with keyboard and screen-reader labels.
- [ ] Unify quick-nav/search shortcuts with the main search helper.
- [ ] Add a single source for the “showing N of N results” footer.
- [ ] Remove any page-level search logic that no longer adds unique behavior.

### Production Calendar / Scheduling
- [ ] Audit the production calendar for any lingering manual station-slot logic.
- [ ] Ensure the calendar always derives from ship date plus prerequisite completion.
- [ ] Make each lane use one shared card style and density.
- [ ] Keep crowded days collapsed until expanded explicitly.
- [ ] Add customer priority definitions as a first-class scheduling input.
- [ ] Make priority overrides visible on the calendar cards.
- [ ] Reduce scroll pressure on multi-station days by shrinking repeated labels.
- [ ] Keep shipped and completed orders out of the schedule automatically.
- [ ] Add a clear indicator for orders waiting on upstream prerequisites.
- [ ] Make lane color and station meaning match the canonical station palette.
- [ ] Add a compact `needs design` state for unscheduled orders.
- [ ] Make production calendar tooltips show ship date and priority together.
- [ ] Reconcile shipping-lane timing against the actual FedEx status.
- [ ] Add a minimal reschedule action for derived calendar cards where appropriate.
- [ ] Standardize the lane headers across all calendar views.
- [ ] Collapse repeated order/customer text in dense days.
- [ ] Make the calendar respect customer-specific expedited routing definitions.
- [ ] Audit calendar data for duplicate order cards when one order spans multiple lanes.
- [ ] Keep the calendar responsive on smaller screens without hiding a full lane.
- [ ] Add a dated note for any orders excluded from the schedule so operators know why.

### Loading / Empty / Error States
- [ ] Replace remaining bare `Loading...` text with section-specific loading copy.
- [ ] Standardize skeleton widths on order-detail top cards.
- [ ] Make all shipment-related loading states reuse the same shimmer and height.
- [ ] Add a shared error card for page sections that currently inline their own fallback.
- [ ] Replace generic `something went wrong` copy with task-specific remediation text.
- [ ] Keep empty states from implying data failure when the dataset is merely sparse.
- [ ] Standardize retry buttons and retry copy in panels that can refresh independently.
- [ ] Make the Thrive and Fiery panels share one loading/error/empty shell.
- [ ] Normalize the phrasing for `not configured` versus `not found` states.
- [ ] Add a consistent `last refreshed` footer pattern for live data panels.
- [ ] Make search result skeletons match table skeletons instead of inventing new variants.
- [ ] Reuse one disclosure pattern for expandable error details.
- [ ] Ensure dashboard cards don’t show layout jumps while nested data resolves.
- [ ] Prevent cards from collapsing to zero-height when child queries are pending.
- [ ] Add shared placeholder text for unresolved shipment, file-chain, and proof data.
- [ ] Keep validation-request and approval states from rendering as generic missing data.
- [ ] Standardize how hidden, disabled, and unavailable states are displayed in the UI.
- [ ] Make the same data state look the same in desktop and shop-floor layouts.
- [ ] Replace page-specific empty illustrations with a common asset style.
- [ ] Audit every live-data panel for a dedicated `stale` state.

### Performance / Caching / Background Jobs
- [ ] Create one cache policy for tracking and shipment refresh instead of per-route TTLs.
- [ ] Audit duplicate background refresh triggers so a single event doesn’t fan out twice.
- [ ] Reduce hourly FedEx work to only orders that truly need a refresh.
- [ ] Make Fiery queue sync skip unchanged rows before writing to the database.
- [ ] Consolidate Zund reachability checks so the same share isn’t probed multiple times per screen.
- [ ] Keep the Fiery device-info blob cache and workflow discovery cache in sync.
- [ ] Revisit any `withTimeout` wrappers that can be replaced by an earlier, cheaper guard.
- [ ] Add a shared stale-data policy for order detail, shipments, and RIP pages.
- [ ] Prevent background jobs from doing the same record lookup in multiple services.
- [ ] Make the job queue summary page use pre-fetched data when available.
- [ ] Remove needless duplicate file scanning from route-level endpoints.
- [ ] Cache expensive route lookups at the service layer instead of the controller layer.
- [ ] Add a single `refresh now` path for live data pages.
- [ ] Keep background refreshes from racing with manual repairs on the same row.
- [ ] Make feed refreshes idempotent when the same shipment or Fiery job is touched twice.
- [ ] Log slow path stages with enough detail to know whether the delay is network, parse, or write.
- [ ] Audit current hourly jobs for memory churn caused by repeated full-table scans.
- [ ] Prefer incremental reconciliation over full rescans wherever the data model allows it.
- [ ] Keep the browser-facing pages responsive even when the server refresh jobs are busy.
- [ ] Add a simple health check note for stalled refresh jobs.

### Docs / Tests / Cleanup
- [ ] Finish the remaining Obsidian notes for the major data flows that still lack a map.
- [ ] Add a field-map note for the remaining order-detail sources not yet documented.
- [ ] Cross-check route and service comments against the current code so stale comments get removed.
- [ ] Remove or rewrite any docs that still describe old hotfolder-only Fiery behavior.
- [ ] Add tests for each newly introduced shared helper before expanding it.
- [ ] Reconcile existing server tests with any new shared summary builders.
- [ ] Expand UI tests for the loading, empty, and error states that were standardized.
- [ ] Add route tests for the duplicate-path cleanup slices as they land.
- [ ] Audit temporary scripts to make sure only still-useful utilities remain in the repo.
- [ ] Reduce noisy comments that repeat what the code already makes obvious.
- [ ] Keep plan docs compact by collapsing finished task groups into a short archive note.
- [ ] Update the run log and milestones after each completed cleanup slice.
- [ ] Remove stale references to sandbox-only FedEx assumptions from user-facing docs.
- [ ] Add a one-page operator cheat sheet for the main live-data panels.
- [ ] Ensure the top 20 bug-prone flows each have a regression test.
- [ ] Tighten type coverage on the most churned server services.
- [ ] Add a cross-package smoke test that exercises a representative order-detail, shipment, and Fiery path.
- [ ] Run a final dead-code pass on helper utilities that are now superseded by shared functions.
- [ ] Verify every public-facing fallback string is intentional and actionable.
- [ ] Leave a concise final polish summary in the autonomy docs so the next maintainer can see what was untangled.

## Notes
- This backlog intentionally focuses on overlap zones, copy polish, and shared helper extraction rather than redoing already-complete work.
- Take one independently verifiable slice at a time.
- Prefer the smallest visible win that also simplifies the piping behind it.
