import { describe, expect, it, vi } from 'vitest';
import {
  buildPlaceholderPrintCutLinkData,
  createPlaceholderPrintCutLinkRow,
} from './file-chain.js';

describe('placeholder print-cut link creation', () => {
  it('builds the canonical placeholder shape', () => {
    expect(
      buildPlaceholderPrintCutLinkData({
        workOrderId: 'wo_1',
        orderNumber: '64524',
      }),
    ).toEqual({
      workOrderId: 'wo_1',
      printFileName: '64524',
      printFilePath: '',
      status: 'DESIGN',
      linkConfidence: 'NONE',
      cutId: undefined,
    });
  });

  it('derives cutId when print file name contains one', () => {
    expect(
      buildPlaceholderPrintCutLinkData({
        workOrderId: 'wo_3',
        printFileName: 'my_file_PRINTANDCUT_11N520I263N.pdf',
      }),
    ).toEqual({
      workOrderId: 'wo_3',
      printFileName: 'my_file_PRINTANDCUT_11N520I263N.pdf',
      printFilePath: '',
      status: 'DESIGN',
      linkConfidence: 'NONE',
      cutId: '11N520I263N',
    });
  });

  it('uses the canonical placeholder shape when creating rows', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'link_1' });
    await createPlaceholderPrintCutLinkRow(
      {
        printCutLink: {
          create,
        },
      } as any,
      {
        workOrderId: 'wo_2',
        orderNumber: '64586',
        status: 'DESIGN',
      },
    );

    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({
      data: {
        workOrderId: 'wo_2',
        printFileName: '64586',
        printFilePath: '',
        status: 'DESIGN',
        linkConfidence: 'NONE',
        cutId: undefined,
      },
    });
  });
});
