import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { formatFedExLogFileName, parseFedExLogDate, parseFedExLogFile } from './fedex.js';

const tempFiles: string[] = [];

afterEach(async () => {
  while (tempFiles.length > 0) {
    const filePath = tempFiles.pop();
    if (!filePath) continue;
    await fs.rm(filePath, { force: true, recursive: true }).catch(() => {});
  }
});

describe('FedEx log parser', () => {
  it('formats the dated log filename for today-style Ship Manager logs', () => {
    const fileName = formatFedExLogFileName(new Date(2026, 2, 31));
    expect(fileName).toBe('FxLogSr03312026.xml');
  });

  it('parses the Ship Manager timestamp format', () => {
    const parsed = parseFedExLogDate('03/31/2026 07:48:07.0189741');
    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(2);
    expect(parsed?.getDate()).toBe(31);
    expect(parsed?.getHours()).toBe(7);
    expect(parsed?.getMinutes()).toBe(48);
    expect(parsed?.getSeconds()).toBe(7);
  });

  it('extracts the live shipment fields from a FxLogItem block', async () => {
    const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
<FxLog>
  <FxLogItem>
    <LogDate>03/31/2026 07:48:07.0189741</LogDate>
    <Message>request,FDXPSP_I_DEST_ADDRESS_LINE1,1839 CO RD MM,FDXPSP_I_DEST_CITY_NAME,OREGON,FDXPSP_I_DEST_POSTAL,53575,FDXPSP_I_RECIPIENT_COMPANY_NAME,FITCHBURG FARMS LLC,FDXPSP_I_RECIPIENT_CONTACT_NAME,KELLY &amp;#39;JONES&amp;#39;,FDXPSP_I_SERVICE,FEDEX_GROUND,FDXPSP_I_TRACKING_NUMBER,805941978240,FDXPSP_I_DEST_STATE_PROV,WI</Message>
  </FxLogItem>
</FxLog>`;

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fedex-log-'));
    const filePath = path.join(tempDir, 'FxLogSr03312026.xml');
    await fs.writeFile(filePath, sampleXml, 'utf-8');
    tempFiles.push(filePath, tempDir);

    const records = await parseFedExLogFile(filePath);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      sourceFileName: 'FxLogSr03312026.xml',
      trackingNumber: '805941978240',
      service: 'FEDEX_GROUND',
      recipientCompanyName: 'FITCHBURG FARMS LLC',
      recipientContactName: "KELLY 'JONES'",
      destinationAddressLine1: '1839 CO RD MM',
      destinationCity: 'OREGON',
      destinationPostalCode: '53575',
      destinationState: 'WI',
    });
    expect(records[0].sourceKey).toMatch(/^[a-f0-9]{64}$/);
  });
});
