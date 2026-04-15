import { FIERY_MEDIA_MAPPINGS, type FieryMediaMappingEntry } from './fiery-media-map.js';

export interface FieryMediaCatalogRow extends FieryMediaMappingEntry {
  id: string;
  specificity: number;
  wildcardFields: string[];
}

export interface FieryMediaCatalogSnapshot {
  source: 'erp-fiery-mis';
  generatedAt: string;
  rowCount: number;
  rows: FieryMediaCatalogRow[];
}

const FIERY_MEDIA_CATALOG_COLUMNS = [
  'id',
  'label',
  'substrate',
  'ripMedia',
  'inkType',
  'mediaName',
  'resolution',
  'dotSize',
  'colorMode',
  'printMode',
  'halftoneMode',
  'profileType',
  'resultingCalibration',
  'icc',
  'mediaType',
  'specificity',
  'wildcardFields',
  'notes',
] as const;

function isWildcardField(value: string | null | undefined): boolean {
  if (typeof value !== 'string') return true;
  const trimmed = value.trim();
  return !trimmed || /^any$/i.test(trimmed);
}

function countSpecificFields(entry: FieryMediaMappingEntry): number {
  return [
    entry.substrate,
    entry.ripMedia,
    entry.inkType,
    entry.mediaName,
    entry.resolution,
    entry.dotSize,
    entry.colorMode,
    entry.printMode,
    entry.halftoneMode,
    entry.profileType,
    entry.resultingCalibration,
    entry.icc,
    entry.mediaType,
  ].reduce((score, value) => score + (isWildcardField(value) ? 0 : 1), 0);
}

function csvEscape(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function buildFieryMediaCatalogSnapshot(now = new Date()): FieryMediaCatalogSnapshot {
  const rows = [...FIERY_MEDIA_MAPPINGS]
    .map((entry, index) => {
      const entryRecord = entry as unknown as Record<string, string | undefined>;
      const wildcardFields = FIERY_MEDIA_CATALOG_COLUMNS.filter((field) => {
        if (field === 'id' || field === 'specificity' || field === 'wildcardFields' || field === 'notes') {
          return false;
        }
        return isWildcardField(entryRecord[field]);
      });

      return {
        ...entry,
        id: `${String(index + 1).padStart(3, '0')}-${entry.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        specificity: countSpecificFields(entry),
        wildcardFields,
      };
    })
    .sort((left, right) => right.specificity - left.specificity || left.label.localeCompare(right.label));

  return {
    source: 'erp-fiery-mis',
    generatedAt: now.toISOString(),
    rowCount: rows.length,
    rows,
  };
}

export function serializeFieryMediaCatalogCsv(snapshot: FieryMediaCatalogSnapshot): string {
  const headers = FIERY_MEDIA_CATALOG_COLUMNS;
  const rows = snapshot.rows.map((row) =>
    [
      row.id,
      row.label,
      row.substrate ?? '',
      row.ripMedia,
      row.inkType ?? '',
      row.mediaName ?? '',
      row.resolution ?? '',
      row.dotSize ?? '',
      row.colorMode ?? '',
      row.printMode ?? '',
      row.halftoneMode ?? '',
      row.profileType ?? '',
      row.resultingCalibration ?? '',
      row.icc ?? '',
      row.mediaType ?? '',
      row.specificity,
      row.wildcardFields.join('; '),
      row.notes ?? '',
    ]
      .map(csvEscape)
      .join(','),
  );

  return [headers.join(','), ...rows].join('\n');
}
