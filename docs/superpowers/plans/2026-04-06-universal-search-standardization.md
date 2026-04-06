AGENT-AUTO | COMPLETE

# Universal Search Standardization

> ERP search now uses the same tokenized fuzzy matching model as the shop-floor Production page.

## Delivered
- Added shared search scoring and filtering helpers in `packages/shared`.
- Migrated the main server list/search endpoints and generic pagination search helper to tokenized matching.
- Migrated the web search widgets, table filters, and generic search utility to the shared matcher.
- Migrated the shop-floor station queues to the shared matcher.

## Notes
- Search now favors multi-word fuzzy matches instead of plain substring checks.
- Remaining search presentation differences are intentional where a page has its own UX.
