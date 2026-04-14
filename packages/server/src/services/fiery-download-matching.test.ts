import { describe, expect, it } from 'vitest';
import { findMatchingFieryDownloadFile } from './fiery-download-matching.js';

describe('findMatchingFieryDownloadFile', () => {
  const files = [
    {
      fileName: 'Jimmy_Deans_Blades.pdf',
      filePath: 'C:/ProgramData/EFI/EFI XF/JDF/Download/Jimmy_Deans_Blades.pdf',
      timestamp: '2026-04-14T10:00:00.000Z',
    },
    {
      fileName: 'Other.pdf',
      filePath: 'C:/ProgramData/EFI/EFI XF/JDF/Download/Other.pdf',
      timestamp: '2026-04-14T11:00:00.000Z',
    },
  ];

  it('matches on staged pdf path basename', () => {
    expect(
      findMatchingFieryDownloadFile(files, ['C:/ERPJobs/Jimmy_Deans_Blades.pdf']),
    )?.toMatchObject({
      fileName: 'Jimmy_Deans_Blades.pdf',
    });
  });

  it('matches on copied file name when the staged path is absent', () => {
    expect(findMatchingFieryDownloadFile(files, [undefined, null, 'Other.pdf']))?.toMatchObject({
      fileName: 'Other.pdf',
    });
  });

  it('returns undefined when no download file matches', () => {
    expect(findMatchingFieryDownloadFile(files, ['Missing.pdf'])).toBeUndefined();
  });
});
