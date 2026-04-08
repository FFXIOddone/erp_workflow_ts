import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  formatFedExLogFileName,
  extractFedExWorkOrderCandidates,
  parseFedExLogDate,
  parseFedExLogFile,
  parseFedExShipmentExportCsv,
  parseFedExShipmentDetailReport,
  resolveUniqueShipmentWorkOrderId,
} from './fedex.js';

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

  it('parses the FedEx shipment detail text report format', async () => {
    const sampleReport = `03/26/2026 - 03/27/2026        270013422        A GROUND SHIPMENT DETAIL        CAFE3954          Page: 1

TRACKING #       ACT WG Service Type Desc                        C NET     LNET
   RECIPIENT COMPANY         RECIPIENT CONTACT         RECIPIENT ADDRESS 1  RECIPIENT CITY       ST ZIP
---------------- ------ ---------------------------------------- --------- -----------
   ------------------------- ------------------------- -------------------- -------------------- -- ------
495213067555     10.00  FedEx Ground Service                     12.85     23.76
   Kwik-Fill S0214           STORE MANAGER             4994 Mahoning Ave.   CHAMPION             OH 44483
`;

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fedex-report-'));
    const filePath = path.join(tempDir, 'KF Ground.txt');
    await fs.writeFile(filePath, sampleReport, 'utf-8');
    tempFiles.push(filePath, tempDir);

    const records = await parseFedExShipmentDetailReport(filePath);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      sourceFileName: 'KF Ground.txt',
      trackingNumber: '495213067555',
      service: 'Ground',
      recipientCompanyName: 'Kwik-Fill S0214',
      recipientContactName: 'STORE MANAGER',
      destinationAddressLine1: '4994 Mahoning Ave.',
      destinationCity: 'CHAMPION',
      destinationState: 'OH',
      destinationPostalCode: '44483',
    });
    expect(records[0].sourceFileDate.getFullYear()).toBe(2026);
    expect(records[0].sourceFileDate.getMonth()).toBe(2);
    expect(records[0].sourceFileDate.getDate()).toBe(26);
    expect(records[0].sourceKey).toMatch(/^[a-f0-9]{64}$/);
  });

  it('parses the FedEx shipment export CSV format', async () => {
    const sampleCsv = `Shipment ID,Tracking Number,Service Type Desc,Recipient Company Name,Recipient Contact Name,Recipient Address 1,Recipient City,Recipient State,Recipient Postal Code,Ship Date
64359,805941978240,FedEx Ground Service,URC (M0029),STORE MANAGER,123 Main St.,Mansfield,OH,44905,03/26/2026
`;

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fedex-export-'));
    const filePath = path.join(tempDir, 'shipments_2026-03-26_1100.csv');
    await fs.writeFile(filePath, sampleCsv, 'utf-8');
    tempFiles.push(filePath, tempDir);

    const records = await parseFedExShipmentExportCsv(filePath);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      sourceFileName: 'shipments_2026-03-26_1100.csv',
      trackingNumber: '805941978240',
      service: 'Ground',
      recipientCompanyName: 'URC (M0029)',
      recipientContactName: 'STORE MANAGER',
      destinationAddressLine1: '123 Main St.',
      destinationCity: 'Mansfield',
      destinationState: 'OH',
      destinationPostalCode: '44905',
    });
    expect(records[0].sourceFileDate.getFullYear()).toBe(2026);
    expect(records[0].sourceFileDate.getMonth()).toBe(2);
    expect(records[0].sourceFileDate.getDate()).toBe(26);
    expect(records[0].eventTimestamp?.getFullYear()).toBe(2026);
    expect(records[0].sourceKey).toMatch(/^[a-f0-9]{64}$/);
  });

  it('extracts work order candidates from shipment export rows', () => {
    const candidates = extractFedExWorkOrderCandidates({
      row: {
        'Shipment ID': 'WO-64359',
        'Tracking Number': '805941978240',
        'Service Type Desc': 'FedEx Ground Service',
      },
      sourceType: 'shipment_export_csv',
    });

    expect(candidates).toContain('64359');
  });

  it('does not resolve ambiguous shipment tracking ownership', () => {
    expect(
      resolveUniqueShipmentWorkOrderId([
        { workOrderId: 'wo-1' },
        { workOrderId: 'wo-2' },
      ])
    ).toBeNull();

    expect(
      resolveUniqueShipmentWorkOrderId([
        { workOrderId: 'wo-1' },
        { workOrderId: 'wo-1' },
      ])
    ).toBe('wo-1');
  });
});
