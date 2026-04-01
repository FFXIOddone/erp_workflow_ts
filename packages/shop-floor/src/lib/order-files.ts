import { apiGet } from './api';
import { invoke, isTauri } from './tauri-bridge';

export interface OrderFolderPathResult {
  configured: boolean;
  folderPath: string | null;
  folderName?: string | null;
  customerFolder?: string | null;
  exists?: boolean;
  woNumber?: string;
  hasManualOverride?: boolean;
}

export interface ShopFloorFileChainLink {
  id: string;
  printFileName?: string | null;
  printFilePath?: string | null;
  cutId?: string | null;
  cutFilePath?: string | null;
  cutFileName?: string | null;
  cutFileSource?: string | null;
  linkConfidence?: string | null;
  status?: string | null;
  confirmed?: boolean | null;
  linkedAt?: string | null;
  updatedAt?: string | null;
  createdAt?: string | null;
}

export type OpenPathResult = 'opened' | 'copied' | 'prompted';

const CUT_STATUS_PRIORITY: Record<string, number> = {
  CUT_COMPLETE: 5,
  FINISHED: 5,
  CUTTING: 4,
  CUT_PENDING: 3,
  PRINTED: 2,
  READY_TO_PRINT: 1,
};

const CUT_CONFIDENCE_PRIORITY: Record<string, number> = {
  MANUAL: 6,
  EXACT: 5,
  NESTING: 4,
  HIGH: 3,
  MEDIUM: 2,
  PARTIAL: 1,
  NONE: 0,
};

function isAbsolutePath(pathValue: string | null | undefined): boolean {
  if (!pathValue) return false;
  return /^[A-Za-z]:[\\/]/.test(pathValue) || pathValue.startsWith('\\\\');
}

function toTimestamp(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toFileUrl(pathValue: string): string {
  if (pathValue.startsWith('\\\\')) {
    return encodeURI(`file://${pathValue.replace(/^\\\\+/, '').replace(/\\/g, '/')}`);
  }
  return encodeURI(`file:///${pathValue.replace(/\\/g, '/')}`);
}

async function copyPath(pathValue: string): Promise<OpenPathResult> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(pathValue);
    return 'copied';
  }

  window.prompt('Copy this path:', pathValue);
  return 'prompted';
}

function compareCutLinks(a: ShopFloorFileChainLink, b: ShopFloorFileChainLink): number {
  const confirmedDelta = Number(Boolean(b.confirmed)) - Number(Boolean(a.confirmed));
  if (confirmedDelta !== 0) return confirmedDelta;

  const pathDelta = Number(isAbsolutePath(b.cutFilePath)) - Number(isAbsolutePath(a.cutFilePath));
  if (pathDelta !== 0) return pathDelta;

  const statusDelta =
    (CUT_STATUS_PRIORITY[b.status || ''] || 0) - (CUT_STATUS_PRIORITY[a.status || ''] || 0);
  if (statusDelta !== 0) return statusDelta;

  const confidenceDelta =
    (CUT_CONFIDENCE_PRIORITY[b.linkConfidence || ''] || 0) -
    (CUT_CONFIDENCE_PRIORITY[a.linkConfidence || ''] || 0);
  if (confidenceDelta !== 0) return confidenceDelta;

  return (
    toTimestamp(b.linkedAt || b.updatedAt || b.createdAt) -
    toTimestamp(a.linkedAt || a.updatedAt || a.createdAt)
  );
}

export async function resolveOrderFolderPath(orderId: string): Promise<OrderFolderPathResult> {
  return apiGet<OrderFolderPathResult>(`/file-browser/orders/${orderId}/folder-path`);
}

export async function getOrderFileChainLinks(orderId: string): Promise<ShopFloorFileChainLink[]> {
  return apiGet<ShopFloorFileChainLink[]>(`/file-chain/orders/${orderId}`);
}

export function sortFileChainLinks(links: ShopFloorFileChainLink[]): ShopFloorFileChainLink[] {
  return [...links].sort(compareCutLinks);
}

export function rankCutLinks(links: ShopFloorFileChainLink[]): ShopFloorFileChainLink[] {
  return sortFileChainLinks(links)
    .filter((link) => Boolean(link.cutFilePath?.trim()))
}

export async function openExternalPath(
  pathValue: string,
  kind: 'file' | 'folder',
): Promise<OpenPathResult> {
  if (isTauri()) {
    const exists = await invoke<boolean>('path_exists', { path: pathValue });
    if (exists === false) {
      throw new Error(`${kind === 'folder' ? 'Folder' : 'File'} not found`);
    }

    await invoke(kind === 'folder' ? 'open_folder' : 'open_file', { path: pathValue });
    return 'opened';
  }

  const opened = window.open(toFileUrl(pathValue), '_blank', 'noopener,noreferrer');
  if (opened) return 'opened';
  return copyPath(pathValue);
}

export async function openZundCutQueue(cutId: string): Promise<void> {
  if (!isTauri()) {
    throw new Error('Zund queue search is only available in the desktop app');
  }

  await invoke('open_zund_cut_queue', { cutId });
}

export async function selectBestCutLink(
  orderId: string,
): Promise<{
  selected: ShopFloorFileChainLink | null;
  linkedCount: number;
  invalidCount: number;
}> {
  const rankedLinks = rankCutLinks(await getOrderFileChainLinks(orderId));

  if (!isTauri()) {
    return {
      selected: rankedLinks[0] || null,
      linkedCount: rankedLinks.length,
      invalidCount: 0,
    };
  }

  let invalidCount = 0;

  for (const link of rankedLinks) {
    const cutFilePath = link.cutFilePath?.trim();
    if (!cutFilePath) continue;

    const exists = await invoke<boolean>('path_exists', { path: cutFilePath });
    if (exists) {
      return {
        selected: link,
        linkedCount: rankedLinks.length,
        invalidCount,
      };
    }

    invalidCount++;
  }

  return {
    selected: rankedLinks[0] || null,
    linkedCount: rankedLinks.length,
    invalidCount,
  };
}

export async function selectBestCutIdLink(
  orderId: string,
): Promise<ShopFloorFileChainLink | null> {
  const links = await getOrderFileChainLinks(orderId);
  return links
    .filter((link) => Boolean(link.cutId?.trim()))
    .sort(compareCutLinks)[0] || null;
}
