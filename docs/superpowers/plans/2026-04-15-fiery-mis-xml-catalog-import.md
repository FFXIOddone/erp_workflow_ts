# Fiery MIS XML Catalog Import

AGENT-AUTO | COMPLETE

## Goal
- Convert the ERP Fiery media catalog mirror into the XML shape Fiery Command WorkStation expects for Paper Catalog / Substrate Catalog import.
- Make the export easy to download and easy to point the Fiery PC at without extra manual reshaping.

## Slice Plan
- [x] Add an XML export for the mirrored Fiery catalog.
- [x] Keep the existing JSON/CSV feed, but make the XML export the primary import artifact for Fiery.
- [x] Surface the XML download URL in Rip Queue diagnostics and the docs.
- [x] Validate the XML export shape and confirm the catalog rows serialize cleanly.

## Notes
- Fiery’s own docs say catalog databases export and import as `.xml` files.
- The ERP should stay the source of truth for the mirrored catalog data, but the Fiery PC should import the XML artifact as its live catalog seed.
