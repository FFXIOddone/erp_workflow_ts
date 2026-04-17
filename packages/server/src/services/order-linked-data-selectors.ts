import { deriveFileChainLinkState } from '@erp/shared';
import { repairMissingCutId } from './file-chain-cut-id.js';

export type LinkedShipmentSummary = {
  id: string;
  carrier: string;
  trackingNumber: string | null;
  status: string;
  shipDate: Date | null;
  estimatedDelivery: Date | null;
  actualDelivery: Date | null;
  packageCount: number;
  createdByDisplayName: string | null;
};

export type LinkedAttachmentSummary = {
  id: string;
  fileName: string;
  fileType: string;
  uploadedAt: Date;
  uploadedByDisplayName: string | null;
};

export type NormalizedLinkedRecordKind = 'SHIPMENT' | 'ATTACHMENT' | 'PROOF' | 'PRINT' | 'CUT';

export type NormalizedLinkedRecord = {
  id: string;
  kind: NormalizedLinkedRecordKind;
  label: string;
  status: string;
  timestamp: Date | null;
  sourceId: string;
  provenance: string;
  note: string | null;
  cutId: string | null;
};

type ShipmentProjectionRow = {
  id: string;
  carrier: string;
  trackingNumber: string | null;
  status: string;
  shipDate: Date | null;
  estimatedDelivery: Date | null;
  actualDelivery: Date | null;
  createdBy: { displayName: string | null } | null;
  packages: Array<{ id: string }>;
};

type AttachmentProjectionRow = {
  id: string;
  fileName: string;
  fileType: string;
  uploadedAt: Date;
  uploadedBy: { displayName: string | null } | null;
};

type ProofProjectionRow = {
  id: string;
  status: string;
  requestedAt: Date;
  respondedAt: Date | null;
  attachment: {
    fileName: string;
  };
};

type FileChainProjectionRow = {
  id: string;
  printFileName: string;
  cutFileName: string | null;
  cutId: string | null;
  status: string;
  printStatus: string;
  cutStatus: string;
  printedAt: Date | string | null;
  cutCompletedAt: Date | string | null;
};

export function selectLatestShipmentSummaries(
  shipments: readonly ShipmentProjectionRow[],
): LinkedShipmentSummary[] {
  return shipments.map((shipment) => ({
    id: shipment.id,
    carrier: shipment.carrier,
    trackingNumber: shipment.trackingNumber,
    status: shipment.status,
    shipDate: shipment.shipDate,
    estimatedDelivery: shipment.estimatedDelivery,
    actualDelivery: shipment.actualDelivery,
    packageCount: shipment.packages.length,
    createdByDisplayName: shipment.createdBy?.displayName ?? null,
  }));
}

export function selectLatestAttachmentSummaries(
  attachments: readonly AttachmentProjectionRow[],
): LinkedAttachmentSummary[] {
  return attachments.map((attachment) => ({
    id: attachment.id,
    fileName: attachment.fileName,
    fileType: attachment.fileType,
    uploadedAt: attachment.uploadedAt,
    uploadedByDisplayName: attachment.uploadedBy?.displayName ?? null,
  }));
}

function pushNormalizedRecord(
  records: NormalizedLinkedRecord[],
  record: NormalizedLinkedRecord,
): void {
  records.push(record);
}

export function selectNormalizedLinkedRecords(input: {
  shipments: readonly ShipmentProjectionRow[];
  attachments: readonly AttachmentProjectionRow[];
  proofs: readonly ProofProjectionRow[];
  fileChainLinks: readonly FileChainProjectionRow[];
}): NormalizedLinkedRecord[] {
  const records: NormalizedLinkedRecord[] = [];

  for (const shipment of input.shipments) {
    pushNormalizedRecord(records, {
      id: `shipment:${shipment.id}`,
      kind: 'SHIPMENT',
      label: `${shipment.carrier}${shipment.trackingNumber ? ` ${shipment.trackingNumber}` : ''}`.trim(),
      status: shipment.status,
      timestamp: shipment.shipDate ?? shipment.actualDelivery ?? shipment.estimatedDelivery ?? null,
      sourceId: shipment.id,
      provenance: 'Shipment record',
      note: shipment.createdBy?.displayName ?? null,
      cutId: null,
    });
  }

  for (const attachment of input.attachments) {
    pushNormalizedRecord(records, {
      id: `attachment:${attachment.id}`,
      kind: 'ATTACHMENT',
      label: attachment.fileName,
      status: attachment.fileType,
      timestamp: attachment.uploadedAt,
      sourceId: attachment.id,
      provenance: 'Attachment record',
      note: attachment.uploadedBy?.displayName ?? null,
      cutId: null,
    });
  }

  for (const proof of input.proofs) {
    pushNormalizedRecord(records, {
      id: `proof:${proof.id}`,
      kind: 'PROOF',
      label: proof.attachment.fileName,
      status: proof.status,
      timestamp: proof.respondedAt ?? proof.requestedAt,
      sourceId: proof.id,
      provenance: 'Proof approval record',
      note: proof.respondedAt ? 'Responded' : 'Awaiting response',
      cutId: null,
    });
  }

  for (const link of input.fileChainLinks) {
    const derivedState = deriveFileChainLinkState(link);
    pushNormalizedRecord(records, {
      id: `file-chain-print:${link.id}`,
      kind: 'PRINT',
      label: link.printFileName,
      status: derivedState.effectiveStatus,
      timestamp: link.printedAt instanceof Date ? link.printedAt : link.printedAt ? new Date(link.printedAt) : null,
      sourceId: link.id,
      provenance: 'Print file-chain record',
      note: link.cutFileName ?? null,
      cutId: repairMissingCutId(link),
    });

    if (link.cutFileName || link.cutCompletedAt) {
      pushNormalizedRecord(records, {
        id: `file-chain-cut:${link.id}`,
        kind: 'CUT',
        label: link.cutFileName ?? link.printFileName,
        status: derivedState.effectiveStatus,
        timestamp:
          link.cutCompletedAt instanceof Date
            ? link.cutCompletedAt
            : link.cutCompletedAt
              ? new Date(link.cutCompletedAt)
              : null,
        sourceId: link.id,
        provenance: 'Cut file-chain record',
        note: link.cutFileName ? link.cutFileName : link.cutStatus,
        cutId: repairMissingCutId(link),
      });
    }
  }

  return records.sort((left, right) => {
    const leftTime = left.timestamp?.getTime() ?? 0;
    const rightTime = right.timestamp?.getTime() ?? 0;
    if (leftTime !== rightTime) {
      return rightTime - leftTime;
    }
    return left.kind.localeCompare(right.kind);
  });
}
