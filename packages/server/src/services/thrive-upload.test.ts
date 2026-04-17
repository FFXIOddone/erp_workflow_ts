import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { buildThriveJobTicketName, parseJobInfo } from './thrive.js';
import { copyThriveFileToHotfolder } from './thrive-upload.js';

describe('buildThriveJobTicketName', () => {
  it('builds a Smart File Name Job Submission ticket filename', () => {
    const ticket = buildThriveJobTicketName({
      sourceFileName: 'Wine & Cheese.tif',
      copies: 5,
      magnification: 110,
      rotation: 90,
      customerName: 'ABC Printing',
    });

    expect(ticket).toBe('Wine & Cheese_#JMD#_5;110;90;;;ABC Printing.tif');
  });

  it('omits trailing blank metadata slots when only copies are provided', () => {
    const ticket = buildThriveJobTicketName({
      sourceFileName: 'Wine & Cheese.tif',
      copies: 5,
    });

    expect(ticket).toBe('Wine & Cheese_#JMD#_5.tif');
  });
});

describe('parseJobInfo', () => {
  it('recovers Smart File Name Job Submission metadata from the filename', () => {
    const info = parseJobInfo('Wine & Cheese_#JMD#_5;110;90;;;ABC Printing.tif');

    expect(info.workOrderNumber).toBeNull();
    expect(info.customerName).toBe('ABC Printing');
    expect(info.companyName).toBeNull();
    expect(info.copies).toBe(5);
    expect(info.magnification).toBe(110);
    expect(info.rotation).toBe(90);
    expect(info.jobDescription).toBe('Wine & Cheese');
  });
});

describe('copyThriveFileToHotfolder', () => {
  it('copies a renamed temp file into the hotfolder and cleans up the temp directory', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'erp-thrive-test-'));
    const sourceFile = path.join(root, 'Wine & Cheese.tif');
    const hotfolder = path.join(root, 'hotfolder');
    await fs.mkdir(hotfolder, { recursive: true });
    await fs.writeFile(sourceFile, 'pdf-data');

    const result = await copyThriveFileToHotfolder({
      sourceFilePath: sourceFile,
      hotfolderPath: hotfolder,
      copies: 5,
      magnification: 110,
      rotation: 90,
      customerName: 'ABC Printing',
    });

    expect(result.success).toBe(true);
    expect(result.ticketName).toBe('Wine & Cheese_#JMD#_5;110;90;;;ABC Printing.tif');
    expect(result.destinationPath).toBe(
      path.join(hotfolder, 'Wine & Cheese_#JMD#_5;110;90;;;ABC Printing.tif')
    );
    expect(await fs.readFile(result.destinationPath!, 'utf-8')).toBe('pdf-data');
    await expect(fs.stat(path.dirname(result.stagedPath!))).rejects.toThrow();

    await fs.rm(root, { recursive: true, force: true });
  });
});
