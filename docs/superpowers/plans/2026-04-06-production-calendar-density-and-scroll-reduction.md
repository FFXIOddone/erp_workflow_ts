# Production Calendar Density and Scroll Reduction

> AGENT-AUTO | COMPLETE

**Goal:** Make the Production Calendar fit more working information on screen by compacting crowded cells, especially HH Global orders, so users can see more of the schedule without vertical scrolling.

## Slice 1
- Group crowded entries within the same lane/day by customer so repeated HH Global orders collapse into smaller visual blocks.
- Remove redundant summary chrome and reduce card padding, header width, and text size.
- Validate the page visually with build/typecheck and keep the change limited to the calendar page.

## Notes
- Preserve access to full order detail via click-through and hover titles, even when the on-screen card is compact.
- Do not widen this slice into new scheduling logic or route inference work.
