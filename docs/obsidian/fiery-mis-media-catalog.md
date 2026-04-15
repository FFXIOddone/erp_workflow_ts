# Fiery MIS Media Catalog Feed

The ERP now exposes the mirrored Fiery media catalog so the Fiery PC can seed or reconcile its Media Catalog without relying on PSA fallbacks.

## Feed URLs
- JSON: `/rip-queue/fiery/media-catalog`
- CSV: `/rip-queue/fiery/media-catalog?format=csv`
- XML import: `/rip-queue/fiery/media-catalog?format=xml`

## What the feed represents
- The ERP is the source of truth for the mirrored media rows.
- Fiery Command WorkStation / Command Center still owns the live RIP-side catalog database.
- The feed exists so the RIP-side catalog can be loaded or reconciled from one clean source instead of hand-editing rows.

## Practical setup
- Use the ERP feed to confirm the media rows you want Fiery to know about.
- Seed the Fiery Media Catalog on the RIP PC with the XML import artifact.
- Once the Fiery catalog row exists, `Media Mapping` should no longer be greyed out for that media.

## Notes
- `Any` is a wildcard, not a literal media value.
- `PSA` is a legacy fallback identifier and should not be treated as the final media name unless the RIP catalog explicitly uses it.
