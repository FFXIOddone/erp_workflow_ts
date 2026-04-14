# Fiery Media Mapping Table

This table is the ERP-side mirror of the Fiery media catalog we are using on the VUTEk RIP.
It is intentionally small and explicit so the ERP stops guessing and stops falling back to
generic placeholders like `PSA`.

Important:
- The physical substrate / stock label belongs in the JDF `<Media>` resource.
- The RIP-side media mapping name is what belongs in `EFI:VutekProp Media`.
- The remaining Fiery profile fields (`Ink type`, `Resolution`, `Dot size`, `Color mode`, `Print mode`, `Halftone mode`, `Profile type`, and `Media type`) are match selectors, not stock labels.
- `Any` is a wildcard, not a literal value to store in ERP.
- If a Fiery media configuration field is `Any`, the ERP should treat it as "match anything".
- Live catalog rows from the RIP box should be listed most-specific first so the ERP does not
  fall back to the broad `PSA` placeholders.

| Physical substrate / stock | Ink type | Media selector | Resolution | Dot size | Color mode | Print mode | Halftone mode | Profile type | Resulting calibration | ICC | Media type | RIP media mapping | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Oppboga Wide - Fast 4 | EFI GSLX Pro | PSA | 1000 720 | Binary | CMYK | F4 | SE1 | FE | VUTEk_32h_1000_F4_GSLX-ink_default_081619.epl | VUTEk_32h_1000_F4_GSLX-ink_default_081619.icc | Default | PSA CMYK 1000dpi Binary F4 SE1 FE | Live RIP catalog row discovered on the Fiery box. |
| Oppboga Wide - Fast 4 | EFI GSLX Pro | PSA | 600 720 | Binary | CMYK | F4 | SE1 | FE | VUTEk_32h_600bin_F4_GSLX-XP_default_081319.epl | VUTEk_32h_600bin_F4_GSLX-XP_default_081319.icc | Default | PSA CMYK 600dpi Binary F4 SE1 FE | Live RIP catalog row discovered on the Fiery box. |
| Oppboga Wide - Fast 4 | EFI GSLX Pro | PSA | 600 720 | Grayscale | CMYK | F4 | SE1 | FE | VUTEk_32h_600gs_F4_GSLX-ink_default_081319.epl | VUTEk_32h_600gs_F4_GSLX-XP_default_081319.icc | Default | PSA CMYK 600dpi Grayscale F4 SE1 FE | Live RIP catalog row discovered on the Fiery box. |
| Oppboga Wide - Fast 4 | EFI GSLX Pro | PSA | 1000 720 | Binary | CMYKcmyk | Any | SE1 | FE | VUTEk_32h_1000_8c_GSLX-XP_default_080819.epl | VUTEk_32h_1000_8c_GSLX-XP_default_080819.icc | Default | PSA CMYKcmyk 1000dpi Binary SE1 FE | Live RIP catalog row discovered on the Fiery box. |
| Oppboga Wide - Fast 4 | EFI GSLX Pro | PSA | 600 720 | Binary | CMYKcmyk | Any | SE1 | FE | VUTEk_32h_600bin_8c_GSLX-XP_default_080819.epl | VUTEk_32h_600bin_8c_GSLX-XP_default_080819.icc | Default | PSA CMYKcmyk 600dpi Binary SE1 FE | Live RIP catalog row discovered on the Fiery box. |
| 3M 8518 | EFI GSLX Pro | Any | Any | Any | Any | Any | Any | Any | (not yet captured) | (not yet captured) | Default | 3M 8518 | Verified on live ERP smoke submissions; the RIP mapping matches the substrate name. |
| Oppboga Wide - Fast 4 | EFI GSLX Pro | Any | Any | Any | Any | Any | Any | Any | VUTEk_32h_1000_F4_GSLX-ink_default_081619.epl | VUTEk_32h_1000_F4_GSLX-ink_default_081619.icc | Default | 60 inch Web | Broad fallback when the job does not declare a more specific live RIP catalog row. |
| Any / wildcard fallback | EFI GSLX Pro | Any | Any | Any | Any | Any | Any | Any | (not yet captured) | (not yet captured) | Default | 60 inch Web | Generic fallback when the job does not declare a known substrate. |

Current code lives in:
- [packages/server/src/services/fiery-media-map.ts](../../packages/server/src/services/fiery-media-map.ts)
- [packages/server/src/services/fiery-jmf.ts](../../packages/server/src/services/fiery-jmf.ts)
