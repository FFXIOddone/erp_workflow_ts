# Fiery Media Mapping Table

This table is the ERP-side mirror of the Fiery media catalog we are using on the VUTEk RIP.
It is intentionally small and explicit so the ERP stops guessing and stops falling back to
generic placeholders like `PSA`.

Important:
- `Any` is a wildcard, not a literal value to store in ERP.
- If a Fiery media configuration field is `Any`, the ERP should treat it as "match anything".
- The RIP-side media mapping name is what belongs in `EFI:VutekProp Media`.
- The physical substrate / stock label belongs in the JDF `<Media>` resource.

| ERP substrate / stock | Ink type | Media name | Resolution | Dot size | Color mode | Print mode | Halftone mode | Profile type | Resulting calibration | ICC | Media type | RIP media mapping | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Oppboga Wide - Fast 4 | EFI GSLX Pro | Any | Any | Any | Any | Any | Any | Any | VUTEK_32h_1000_F4_GSLX-ink_default_081619.epl | VUTEK_32h_1000_F4_GSLX-ink_default_081619.icc | Default | 60 inch Web | Verified on real smoke submissions; the mapping must stay separate from the substrate name. |
| 3M 8518 | EFI GSLX Pro | Any | Any | Any | Any | Any | Any | Any | (not yet captured) | (not yet captured) | Default | 3M 8518 | Verified on a live smoke JDF; the RIP mapping matches the substrate name. |
| Any / wildcard fallback | EFI GSLX Pro | Any | Any | Any | Any | Any | Any | Any | (not yet captured) | (not yet captured) | Default | 60 inch Web | Generic fallback when the job does not declare a known substrate. |

Current code lives in:
- [packages/server/src/services/fiery-media-map.ts](../../packages/server/src/services/fiery-media-map.ts)
- [packages/server/src/services/fiery-jmf.ts](../../packages/server/src/services/fiery-jmf.ts)

