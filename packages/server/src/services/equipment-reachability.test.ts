import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { probeRemotePathAccessible } from './equipment-reachability.js';

describe('equipment reachability probe', () => {
  it('returns true for an accessible path and false for a missing one', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'erp-reachability-'));
    const filePath = join(dir, 'probe.txt');
    writeFileSync(filePath, 'ok', 'utf8');

    await expect(probeRemotePathAccessible(filePath, 'temp file')).resolves.toBe(true);
    await expect(
      probeRemotePathAccessible(join(dir, 'missing.txt'), 'missing file'),
    ).resolves.toBe(false);
  });
});
