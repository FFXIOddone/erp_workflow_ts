# Routing Recommendation Source Awareness

> AGENT-AUTO | COMPLETE

**Goal:** Make routing recommendations respect order source conventions, especially WooCommerce orders that should not be forced through `Order Entry`, while keeping the recommendation card readable and deterministic.

## Slice 1
- Infer the order source inside the routing optimization path when the caller does not provide it.
- Ensure WooCommerce routes strip `Order Entry` even when the route starts empty, and use a safe fallback for source-aware defaults.
- Add a regression that proves source-aware recommendations change the route preview the way the business rules expect.

## Notes
- Keep the change narrow: improve the recommendation engine first, then stop.
- Do not widen this plan into new routing intelligence models or extra UI polish unless the slice proves we need it.
