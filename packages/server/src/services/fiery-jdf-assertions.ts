import { XMLParser } from 'fast-xml-parser';

function normalizeText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export interface FieryJdfAssertions {
  jobId: string | null;
  rootDescriptiveName: string | null;
  nodeDescriptiveName: string | null;
  mediaBrand: string | null;
  mediaDescriptiveName: string | null;
  ripMedia: string | null;
  auditComment: string | null;
}

/**
 * Parse the generated Fiery JDF and expose the fields we care about in tests.
 * Keeping this in one helper avoids repeating XML traversal in every JDF assertion.
 */
export function extractFieryJdfAssertions(jdfContent: string): FieryJdfAssertions {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    removeNSPrefix: true,
  });

  const result = parser.parse(jdfContent);
  const jdf = result?.JDF ?? {};
  const resourcePool = jdf.ResourcePool ?? {};
  const resources = Array.isArray(resourcePool) ? resourcePool : [resourcePool];

  let nodeDescriptiveName: string | null = null;
  let mediaBrand: string | null = null;
  let mediaDescriptiveName: string | null = null;
  let ripMedia: string | null = null;

  for (const pool of resources) {
    const nodeInfo = pool?.NodeInfo ?? pool?.['EFI:NodeInfo'];
    if (!nodeDescriptiveName && nodeInfo) {
      nodeDescriptiveName = normalizeText(nodeInfo.DescriptiveName);
    }

    const media = pool?.Media;
    if (media) {
      mediaBrand = normalizeText(media.Brand) ?? mediaBrand;
      mediaDescriptiveName = normalizeText(media.DescriptiveName) ?? mediaDescriptiveName;
    }

    const machineProps = pool?.MachineProperties ?? pool?.['EFI:MachineProperties'];
    const vutekProp = machineProps?.VutekProp ?? machineProps?.['EFI:VutekProp'];
    if (vutekProp) {
      ripMedia = normalizeText(vutekProp.Media) ?? ripMedia;
    }
  }

  return {
    jobId: normalizeText(jdf.JobID),
    rootDescriptiveName: normalizeText(jdf.DescriptiveName),
    nodeDescriptiveName,
    mediaBrand,
    mediaDescriptiveName,
    ripMedia,
    auditComment: normalizeText(jdf.AuditPool?.Created?.Comment),
  };
}
