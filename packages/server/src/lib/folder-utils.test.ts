import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { findShipmentEvidence, findWoFolder } from './folder-utils.js';

describe('findWoFolder', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it('finds a work order folder directly at the network drive root', () => {
    const basePath = fs.mkdtempSync(path.join(os.tmpdir(), 'erp-folder-root-'));
    tempDirs.push(basePath);

    const woFolder = path.join(basePath, 'WO41019_PO206556_REDI MART COOLER HEADER DECALS');
    fs.mkdirSync(woFolder, { recursive: true });

    const result = findWoFolder(basePath, '41019', 'Redi Mart');

    expect(result.found).toBe(true);
    expect(result.folderPath).toBe(woFolder);
    expect(result.folderName).toBe(path.basename(woFolder));
  });

  it('finds a work order folder nested under a customer subfolder and year route', () => {
    const basePath = fs.mkdtempSync(path.join(os.tmpdir(), 'erp-folder-nested-'));
    tempDirs.push(basePath);

    const customerRoot = path.join(basePath, 'Abundant Life Church of God');
    const projectRoot = path.join(customerRoot, 'Acierno Family Chiropractice & Rehab');
    const yearRoot = path.join(projectRoot, '2026');
    const woFolder = path.join(yearRoot, 'WO44786 14...');
    fs.mkdirSync(woFolder, { recursive: true });

    const result = findWoFolder(basePath, '44786', 'Acierno Family Chiropractice & Rehab');

    expect(result.found).toBe(true);
    expect(result.folderPath).toBe(woFolder);
    expect(result.folderName).toBe(path.basename(woFolder));
    expect(result.customerFolder).toBe('Abundant Life Church of God');
  });

  it('finds shipment evidence in the shipping archive by WO number', () => {
    const basePath = fs.mkdtempSync(path.join(os.tmpdir(), 'erp-shipment-wo-'));
    tempDirs.push(basePath);

    const shippingRoot = path.join(basePath, 'SHIPPING', '2024');
    const evidenceFile = path.join(shippingRoot, 'MRT WO#59335.pdf');
    fs.mkdirSync(shippingRoot, { recursive: true });
    fs.writeFileSync(evidenceFile, 'shipping evidence');

    const result = findShipmentEvidence(basePath, '59335', 'MRT', 'installation');

    expect(result.found).toBe(true);
    expect(result.evidencePath).toBe(evidenceFile);
    expect(result.evidenceRoot).toBe('SHIPPING/2024');
    expect(result.matchedBy).toBe('wo');
  });

  it('finds shipment evidence by customer name in the freight bucket', () => {
    const basePath = fs.mkdtempSync(path.join(os.tmpdir(), 'erp-shipment-customer-'));
    tempDirs.push(basePath);

    const freightRoot = path.join(basePath, 'FEDEX', 'FREIGHT');
    const evidenceFile = path.join(freightRoot, 'Bill of Lading_BLUEBAY OFFICE.pdf');
    fs.mkdirSync(freightRoot, { recursive: true });
    fs.writeFileSync(evidenceFile, 'freight evidence');

    const result = findShipmentEvidence(basePath, '99999', 'Bluebay Office', null);

    expect(result.found).toBe(true);
    expect(result.evidencePath).toBe(evidenceFile);
    expect(result.evidenceRoot).toBe('FEDEX/FREIGHT');
    expect(result.matchedBy).toBe('customer');
  });
});
