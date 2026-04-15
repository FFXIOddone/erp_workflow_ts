import { describe, expect, it } from 'vitest';
import {
  buildFieryMediaCatalogSnapshot,
  serializeFieryMediaCatalogCsv,
} from './fiery-media-catalog.js';

describe('buildFieryMediaCatalogSnapshot', () => {
  it('exposes the mirrored Fiery catalog rows in a stable export shape', () => {
    const snapshot = buildFieryMediaCatalogSnapshot(new Date('2026-04-15T12:00:00.000Z'));

    expect(snapshot.source).toBe('erp-fiery-mis');
    expect(snapshot.generatedAt).toBe('2026-04-15T12:00:00.000Z');
    expect(snapshot.rowCount).toBeGreaterThan(0);
    expect(snapshot.rows).toHaveLength(snapshot.rowCount);
    expect(snapshot.rows[0].specificity).toBeGreaterThanOrEqual(
      snapshot.rows[snapshot.rows.length - 1]?.specificity ?? 0,
    );
    expect(snapshot.rows.some((row) => row.label === '3M 8518')).toBe(true);
    expect(snapshot.rows.some((row) => row.wildcardFields.length > 0)).toBe(true);
  });
});

describe('serializeFieryMediaCatalogCsv', () => {
  it('serializes the catalog snapshot as a CSV feed', () => {
    const snapshot = buildFieryMediaCatalogSnapshot(new Date('2026-04-15T12:00:00.000Z'));
    const csv = serializeFieryMediaCatalogCsv(snapshot);

    expect(csv.startsWith('id,label,substrate,ripMedia')).toBe(true);
    expect(csv).toContain('3M 8518');
    expect(csv).toContain('wildcardFields');
    expect(csv).toContain('PSA CMYK 1000dpi Binary F4 SE1 FE');
  });
});
