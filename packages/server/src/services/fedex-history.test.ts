import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { syncFedExShipmentHistory } from './fedex.js';

const tempFiles: string[] = [];

afterEach(async () => {
  while (tempFiles.length > 0) {
    const filePath = tempFiles.pop();
    if (!filePath) continue;
    await fs.rm(filePath, { force: true, recursive: true }).catch(() => {});
  }
});

describe('FedEx history sync', () => {
  it('discovers and parses all log files in a supplied root', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fedex-history-'));
    tempFiles.push(tempDir);

    const firstFile = path.join(tempDir, 'FxLogSr04062026.xml');
    const secondFile = path.join(tempDir, 'FxLogSr04072026.xml');

    const sampleXml = (trackingNumber: string, recipientCompanyName: string, postalCode: string) => `<?xml version="1.0" encoding="UTF-8"?>
<FxLog>
  <FxLogItem>
    <LogDate>04/07/2026 07:48:07.0189741</LogDate>
    <Message>request,FDXPSP_I_DEST_ADDRESS_LINE1,123 Main St,FDXPSP_I_DEST_CITY_NAME,Grand Rapids,FDXPSP_I_DEST_POSTAL,${postalCode},FDXPSP_I_RECIPIENT_COMPANY_NAME,${recipientCompanyName},FDXPSP_I_RECIPIENT_CONTACT_NAME,STORE MANAGER,FDXPSP_I_SERVICE,FEDEX_GROUND,FDXPSP_I_TRACKING_NUMBER,${trackingNumber},FDXPSP_I_DEST_STATE_PROV,MI</Message>
  </FxLogItem>
</FxLog>`;

    await fs.writeFile(firstFile, sampleXml('805941978240', 'ACME SIGNAGE', '49503'), 'utf-8');
    await fs.writeFile(secondFile, sampleXml('805941978241', 'WILDE SIGNS', '49504'), 'utf-8');

    const result = await syncFedExShipmentHistory({
      rootPaths: [tempDir],
      dryRun: true,
    });

    expect(result.status).toBe('synced');
    expect(result.totalFiles).toBe(2);
    expect(result.totalRecords).toBe(2);
    expect(result.imported).toBe(2);
    expect(result.updated).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.sourceFileNames).toEqual(
      expect.arrayContaining(['FxLogSr04062026.xml', 'FxLogSr04072026.xml'])
    );
    expect(result.backfill).toBeNull();
  });
});
