# Shop Floor Installation Workflow and Fuzzy Search

> Active plan for the current shop-floor request. Keep this doc short and use it to track the installation visibility fix, production fuzzy search, and installer workflow controls without drifting into unrelated shop-floor work.

**Goal:** Make shop-floor station views find the right orders by real routing context, surface installation work correctly, and let installers upload photos, view proofs, and save notes directly back to the order.

## Current Status
- Installation station visibility is fixed and now follows the parent/child routing family.
- Production search now fuzzy-matches order metadata, linked file names, and CutIDs.
- Installation workflow now has phone photo upload, proof viewing, installer notes, and no timer UI.
- No remaining code changes are needed for this plan.

## Slice 1
- Completed.

## Slice 2
- Completed.

## Slice 3
- Completed.

## Assumptions
- Existing order notes can be updated through the general order patch route.
- The mobile upload QR flow is the right way to let installers capture photos on their phones.
- Station-family matching should stay aligned with `PARENT_SUB_STATIONS` from `@erp/shared`.
