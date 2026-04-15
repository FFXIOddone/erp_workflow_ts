import { describe, expect, it } from 'vitest';
import { resolveFieryCustomerMetadata } from './fiery-customer-metadata.js';
import { extractFieryJdfAssertions } from './fiery-jdf-assertions.js';
import { buildFieryJobTicketName, buildJdf } from './fiery-jmf.js';

describe('extractFieryJdfAssertions', () => {
  it('captures the resolved media, customer, and comment fields from a generated JDF', () => {
    const customerMetadata = resolveFieryCustomerMetadata({
      workOrderNumber: '64524',
      customerName: 'Pribusin',
      customerId: 'PO23402',
      sourceFileName: 'jimmy_deans_blades.pdf',
    });
    const jobTicketName = buildFieryJobTicketName({
      workOrderNumber: '64524',
      customerName: customerMetadata.customerName,
      sourceFileName: 'jimmy_deans_blades.pdf',
      jobDescription: 'Jimmy Dean Blades',
    });

    const jdf = buildJdf({
      workOrderId: '64524',
      submissionJobId: 'ERP-64524-1776176299000',
      jobTicketName,
      pdfLocalPath: 'http://example.test/jimmy_deans_blades.pdf',
      settings: {
        media: 'Oppboga Wide - Fast 4',
        ripMedia: '60 inch Web',
        mediaType: 'Paper',
        mediaUnit: 'Sheet',
        outputChannelName: 'Zund G7',
        mediaDimension: '6912 3456',
        colorMode: 'CMYK',
        inkType: 'EFI GSLX Pro',
        whiteInkOptions: 'Spot color WHITE_INK',
        resolution: '1000 720',
      },
      jobComment: customerMetadata.commentParts.join(' | '),
    });

    const parsed = extractFieryJdfAssertions(jdf);

    expect(parsed.jobId).toBe(jobTicketName);
    expect(parsed.rootDescriptiveName).toBe('Zund G7');
    expect(parsed.nodeDescriptiveName).toBe(jobTicketName);
    expect(parsed.mediaBrand).toBe('Oppboga Wide - Fast 4');
    expect(parsed.mediaDescriptiveName).toBe('Oppboga Wide - Fast 4');
    expect(parsed.ripMedia).toBe('60 inch Web');
    expect(parsed.printMode).toBe('Any');
    expect(parsed.auditComment).toContain('Source: jimmy_deans_blades.pdf');
    expect(parsed.auditComment).toContain('Customer: Pribusin');
    expect(parsed.auditComment).toContain('CustomerID: PO23402');
  });
});
