import path from 'path';
import { promises as fs } from 'fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FIERY_CONFIG, getAllFieryJobs } from './fiery.js';

describe('getAllFieryJobs snapshot cache', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shares one in-flight JDF parse across concurrent callers', async () => {
    const exportPath = FIERY_CONFIG.exportPath.replace(/\//g, '\\');
    const jobPath = path.join(FIERY_CONFIG.exportPath, 'subdir', 'job1.jdf');
    const jdfXml = `<?xml version="1.0" encoding="UTF-8"?>
      <JDF JobID="ERP-123">
        <ResourcePool>
          <Media Brand="3M 8518" DescriptiveName="3M 8518" MediaType="Default" />
        </ResourcePool>
        <AuditPool>
          <Created TimeStamp="2026-04-01T00:00:00.000Z" />
        </AuditPool>
      </JDF>`;

    let resolveRootEntries: ((value: string[]) => void) | null = null;
    const rootEntries = new Promise<string[]>((resolve) => {
      resolveRootEntries = resolve;
    });
    let rootReadCount = 0;

    vi.spyOn(fs, 'readdir').mockImplementation(((dir: any) => {
      const normalizedDir = String(dir).replace(/\//g, '\\');
      if (normalizedDir === exportPath) {
        rootReadCount += 1;
        return rootEntries as any;
      }

      if (normalizedDir === path.dirname(jobPath).replace(/\//g, '\\')) {
        return Promise.resolve([]) as any;
      }

      return Promise.resolve([]) as any;
    }) as any);

    vi.spyOn(fs, 'stat').mockImplementation(async (filePath) => {
      if (String(filePath).replace(/\//g, '\\') === jobPath.replace(/\//g, '\\')) {
        return {
          mtime: new Date('2026-04-01T00:00:00.000Z'),
        } as any;
      }

      return {
        mtime: new Date('2026-04-01T00:00:00.000Z'),
      } as any;
    });

    const readFileSpy = vi.spyOn(fs, 'readFile').mockResolvedValue(jdfXml);

    const first = getAllFieryJobs([]);
    const second = getAllFieryJobs([]);

    await Promise.resolve();
    expect(rootReadCount).toBe(1);

    if (!resolveRootEntries) {
      throw new Error('Expected the root entries resolver to be available');
    }
    (resolveRootEntries as (value: string[]) => void)(['subdir/job1.jdf']);

    const [firstJobs, secondJobs] = await Promise.all([first, second]);

    expect(rootReadCount).toBe(1);
    expect(readFileSpy).toHaveBeenCalledTimes(1);
    expect(firstJobs).toHaveLength(1);
    expect(secondJobs).toHaveLength(1);
    expect(firstJobs[0]?.jobId).toBe('ERP-123');
    expect(secondJobs[0]?.jobId).toBe('ERP-123');
  });
});
