import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { buildThriveJobTicketName, parseJobInfo } from './thrive.js';
import { copyThriveFileToHotfolder } from './thrive-upload.js';

describe('buildThriveJobTicketName', () => {
  it('builds a structured Thrive job ticket filename', () => {
    const ticket = buildThriveJobTicketName({
      workOrderNumber: '64379',
      customerName: 'Jim Driscoll',
      jobDescription: 'Garage Sign',
      sourceFileName: 'Garage Sign.pdf',
    });

    expect(ticket).toBe('WO64379__Jim Driscoll__Garage Sign.pdf');
  });
});

describe('parseJobInfo', () => {
  it('recovers the Thrive job-ticket fields from the structured filename', () => {
    const info = parseJobInfo('WO64379__Jim Driscoll__Garage Sign.pdf');

    expect(info.workOrderNumber).toBe('64379');
    expect(info.customerName).toBe('Jim Driscoll');
    expect(info.jobDescription).toBe('Garage Sign');
    expect(info.companyBrand).toBe('WILDE_SIGNS');
  });
});

describe('copyThriveFileToHotfolder', () => {
  it('copies a renamed temp file into the hotfolder and cleans up the temp directory', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'erp-thrive-test-'));
    const sourceFile = path.join(root, 'source.pdf');
    const hotfolder = path.join(root, 'hotfolder');
    await fs.mkdir(hotfolder, { recursive: true });
    await fs.writeFile(sourceFile, 'pdf-data');

    const result = await copyThriveFileToHotfolder({
      sourceFilePath: sourceFile,
      hotfolderPath: hotfolder,
      workOrderNumber: '64379',
      customerName: 'Jim Driscoll',
      jobDescription: 'Garage Sign',
    });

    expect(result.success).toBe(true);
    expect(result.ticketName).toBe('WO64379__Jim Driscoll__Garage Sign.pdf');
    expect(result.destinationPath).toBe(path.join(hotfolder, 'WO64379__Jim Driscoll__Garage Sign.pdf'));
    expect(await fs.readFile(result.destinationPath!, 'utf-8')).toBe('pdf-data');
    await expect(fs.stat(path.dirname(result.stagedPath!))).rejects.toThrow();

    await fs.rm(root, { recursive: true, force: true });
  });
});
