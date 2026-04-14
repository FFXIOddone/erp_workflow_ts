/**
 * Fiery XF JMF Submission Service
 *
 * Submits print jobs to the EFI VUTEk GS3250LX Pro via the JDF Connector
 * (port 8010) using JMF SubmitQueueEntry.
 *
 * Discovery notes:
 *   - EFI JDF Connector lives at http://192.168.254.57:8010/
 *   - Device ID: 50aeb1ff-652b-4cd2-96b7-2eefda8925f8
 *   - JMF endpoint: http://192.168.254.57:8010/50aeb1ff-652b-4cd2-96b7-2eefda8925f8
 *   - Supports: SubmitQueueEntry, AbortQueueEntry, RemoveQueueEntry, QueueStatus
 *
 * Flow:
 *   1. Write PDF + JDF to local VUTEK_JOB_DIR on ERP server
 *   2. ERP server serves files at /api/v1/rip-queue/vutek-files/:filename
 *   3. Submit JMF with HTTP URL for JDF → JDF Connector downloads JDF, then PDF
 *   4. JDF Connector places PDF in C:\ProgramData\EFI\EFI XF\JDF\Download\{QueueEntryId}\
 *   5. XF Server finds PDF → analyzes → READY → RIP → PRINT
 *
 * Why HTTP, not file:///: The EFI JDF Connector only downloads RunList files via
 * HTTP/HTTPS URLs. For file:/// URLs it skips the download, leaving the Download
 * folder empty and causing XF Server to fail with "Unknown file type".
 */

import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { resolveFieryCustomerMetadata } from './fiery-customer-metadata.js';
import { findFieryMediaMapping, normalizeFieryMediaName } from './fiery-media-map.js';
import { resolveFieryWorkflowSelection } from './fiery-workflow-selection.js';

const VUTEK_HOST = '192.168.254.57';
const VUTEK_JMF_PORT = 8010;
// Shared ProgramData from the VUTEk machine (mapped as \\192.168.254.57\ProgramData)
const VUTEK_PROGRAM_DATA_SHARE = `\\\\${VUTEK_HOST}\\ProgramData`;
// Fallback GUID discovered during initial setup — overridden by discoverVutekJmfUrl() if changed
const VUTEK_JMF_URL_FALLBACK = `http://${VUTEK_HOST}:${VUTEK_JMF_PORT}/50aeb1ff-652b-4cd2-96b7-2eefda8925f8`;

// Fiery XF output channel / workflow name — must match a workflow in Fiery XF System Manager.
// The ERP default is Zund G7 unless overridden in env or by a persisted controller setting.
const VUTEK_OUTPUT_CHANNEL = process.env.VUTEK_OUTPUT_CHANNEL ?? 'Zund G7';

// Substrate/media name as configured in Fiery XF System Manager → Output → Substrates.
// Must match the RIP-side substrate, not the printer-side print-media label.
const VUTEK_MEDIA = process.env.VUTEK_MEDIA ?? 'Oppboga Wide - Fast 4';
const VUTEK_RIP_MEDIA = process.env.VUTEK_RIP_MEDIA ?? '60 inch Web';

// Physical media dimensions in JDF points (1 pt = 1/72 inch): "Width Height".
// Required so XF can match the substrate to a paper profile (resolution, color mode, ink type).
// Default: 6912 3456 = 96" × 48" (current flatbed board size).
const VUTEK_MEDIA_DIMENSION = process.env.VUTEK_MEDIA_DIMENSION ?? '6912 3456';
const VUTEK_MEDIA_TYPE = process.env.VUTEK_MEDIA_TYPE ?? 'Paper';
const VUTEK_MEDIA_UNIT = process.env.VUTEK_MEDIA_UNIT ?? 'Sheet';
const VUTEK_COLOR_MODE = process.env.VUTEK_COLOR_MODE ?? 'CMYK';
const VUTEK_INK_TYPE = process.env.VUTEK_INK_TYPE ?? 'EFI GSLX Pro';
const VUTEK_WHITE_INK_OPTIONS =
  process.env.VUTEK_WHITE_INK_OPTIONS ?? 'Spot color WHITE_INK';
const VUTEK_RESOLUTION = process.env.VUTEK_RESOLUTION ?? '1000 720';

// HTTP base URL of this ERP server as reachable from the VUTEk machine.
// The JDF Connector downloads job files via HTTP from this URL.
// Set ERP_SERVER_URL in .env — default assumes the ERP server is at 192.168.254.75:8001.
const ERP_SERVER_URL = (process.env.ERP_SERVER_URL ?? 'http://192.168.254.75:8001').replace(
  /\/$/,
  ''
);

// Local directory on the ERP server where VUTEk job files (PDF + JDF) are staged.
// Must be accessible to the HTTP file endpoint at /api/v1/rip-queue/vutek-files/:filename.
// Default: ~/ERPJobs (outside OneDrive, writable by the running user)
export const VUTEK_JOB_DIR = process.env.VUTEK_JOB_DIR ?? path.join(os.homedir(), 'ERPJobs');

let _cachedJmfUrl: string | null = null;
let _jmfUrlCachedAt = 0;
const JMF_URL_CACHE_MS = 60_000;

/**
 * Auto-discover the correct JMF device URL by querying the JDF Connector root.
 * Falls back to the hardcoded URL if discovery fails.
 */
export async function discoverVutekJmfUrl(): Promise<{
  url: string;
  discovered: boolean;
  raw?: string;
}> {
  const now = Date.now();
  if (_cachedJmfUrl && now - _jmfUrlCachedAt < JMF_URL_CACHE_MS) {
    return { url: _cachedJmfUrl, discovered: true };
  }

  try {
    const resp = await fetch(`http://${VUTEK_HOST}:${VUTEK_JMF_PORT}/`, {
      signal: AbortSignal.timeout(5000),
    });
    const body = await resp.text();

    // Look for UUID patterns in the response (href links, JMFURL tags, or plain UUID paths)
    const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
    const matches = body.match(uuidPattern);

    if (matches && matches.length > 0) {
      const url = `http://${VUTEK_HOST}:${VUTEK_JMF_PORT}/${matches[0]}`;
      _cachedJmfUrl = url;
      _jmfUrlCachedAt = now;
      return { url, discovered: true, raw: body.slice(0, 2000) };
    }

    // No UUID found — try the response directly as a JMF endpoint base
    return { url: VUTEK_JMF_URL_FALLBACK, discovered: false, raw: body.slice(0, 2000) };
  } catch {
    return { url: VUTEK_JMF_URL_FALLBACK, discovered: false };
  }
}

/**
 * Test whether the VUTEk Jobs share is writable from this server.
 */
export async function testVutekShareAccess(): Promise<{
  accessible: boolean;
  writable: boolean;
  error?: string;
}> {
  try {
    await fs.access(VUTEK_JOBS_SHARE);
  } catch {
    return {
      accessible: false,
      writable: false,
      error: `Share not accessible: ${VUTEK_JOBS_SHARE}`,
    };
  }

  const testFile = path.join(VUTEK_JOBS_SHARE, `.erp-test-${Date.now()}`);
  try {
    await fs.writeFile(testFile, 'test');
    await fs.unlink(testFile);
    return { accessible: true, writable: true };
  } catch (err: any) {
    return { accessible: true, writable: false, error: `Share read-only: ${err.message}` };
  }
}

// Legacy VUTEk share — kept for testVutekShareAccess() diagnostic only
const VUTEK_JOBS_SHARE = '\\\\192.168.254.57\\Users\\Public\\Documents\\VUTEk Jobs';

export interface VutekPrintSettings {
  media?: string; // e.g. "60 inch Web"
  mediaType?: string; // JDF MediaType, e.g. "Paper"
  mediaUnit?: string; // JDF MediaUnit, e.g. "Sheet"
  ripMedia?: string; // Fiery RIP-side media mapping name
  printDirection?: string; // "Bidirectional" | "Unidirectional"
  interlaceMode?: string; // "Multipass Standard" | "Multipass Quality" | "Single Pass"
  curing?: string; // "High" | "Normal" | "Low"
  cureIntensity?: string; // "Max" | "High" | "Normal"
  carriageSpeed?: string; // "Maximum" | "Normal"
  lampMode?: string; // "Leading" | "Trailing" | "Both"
  shutterMode?: string; // "Double" | "Single"
  smoothing?: string; // "Light" | "Normal" | "Heavy" | "None"
  whiteInk?: boolean; // include WHITE_INK separation
  mirror?: boolean;
  copies?: number;
  workspace?: string; // "DEFAULT"
  /** Fiery XF output channel / workflow name. Check System Manager → Output in Fiery XF. */
  outputChannelName?: string;
  /** Physical media size as JDF points "W H" (1 pt = 1/72 inch). Required for paper profile lookup. */
  mediaDimension?: string;
  /** Fiery ColorMode feature value required for paper profile lookup. */
  colorMode?: string;
  /** Fiery InkType feature value required for paper profile lookup. */
  inkType?: string;
  /** Fiery WhiteInkOptions feature value. */
  whiteInkOptions?: string;
  /** Rendering resolution in JDF XYPair form, e.g. "1000 720". */
  resolution?: string;
}

export interface ResolvedVutekPrintSettings extends VutekPrintSettings {
  media: string;
  mediaType: string;
  mediaUnit: string;
  ripMedia: string;
  printDirection: string;
  interlaceMode: string;
  curing: string;
  cureIntensity: string;
  carriageSpeed: string;
  lampMode: string;
  shutterMode: string;
  smoothing: string;
  whiteInk: boolean;
  mirror: boolean;
  copies: number;
  workspace: string;
  outputChannelName: string;
  mediaDimension: string;
  colorMode: string;
  inkType: string;
  whiteInkOptions: string;
  resolution: string;
}

export interface VutekJobResult {
  success: boolean;
  queueEntryId?: string;
  submissionJobId?: string;
  jdfPath?: string;
  pdfDestPath?: string;
  error?: string;
}

export function normalizeFieryQueueEntryId(queueEntryId?: string | null): string | undefined {
  if (typeof queueEntryId !== 'string') return undefined;
  const trimmed = queueEntryId.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Default print settings for blade sign / HH Global flatbed jobs.
 * Derived from analysis of existing JDFs in EFI Export Folder.
 */
export const BLADE_SIGN_DEFAULTS: VutekPrintSettings = {
  media: VUTEK_MEDIA,
  mediaType: VUTEK_MEDIA_TYPE,
  mediaUnit: VUTEK_MEDIA_UNIT,
  ripMedia: VUTEK_RIP_MEDIA,
  mediaDimension: VUTEK_MEDIA_DIMENSION,
  printDirection: 'Bidirectional',
  interlaceMode: 'Multipass Standard',
  curing: 'High',
  cureIntensity: 'Max',
  carriageSpeed: 'Maximum',
  lampMode: 'Leading',
  shutterMode: 'Double',
  smoothing: 'Light',
  whiteInk: true,
  mirror: false,
  workspace: 'DEFAULT',
  outputChannelName: VUTEK_OUTPUT_CHANNEL || undefined,
  colorMode: VUTEK_COLOR_MODE,
  inkType: VUTEK_INK_TYPE,
  whiteInkOptions: VUTEK_WHITE_INK_OPTIONS,
  resolution: VUTEK_RESOLUTION,
};

interface FieryCapabilities {
  workflows: string[];
  colorModes: string[];
  inkTypes: string[];
  whiteInkOptions: string[];
  source: string;
  error?: string;
}

let _cachedCapabilities: { data: FieryCapabilities; cachedAt: number } | null = null;
const CAPABILITIES_CACHE_MS = 60_000;

function trimTrailingNulls(value: string): string {
  return value.replace(/\0+$/g, '').trim();
}

function escapeXmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function sanitizeJobTicketName(value: string): string {
  return normalizeWhitespace(value)
    .replace(/[<>:"/\\|?*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeResolutionValue(value?: string | null): string {
  const normalized = normalizeWhitespace(String(value ?? '').replace(/[x,]/gi, ' '));
  const match = normalized.match(/^(\d+)\s+(\d+)$/);
  return match ? `${match[1]} ${match[2]}` : VUTEK_RESOLUTION;
}

function normalizeDimensionValue(value?: string | null): string {
  const normalized = normalizeWhitespace(String(value ?? '').replace(/[x,]/gi, ' '));
  const match = normalized.match(/^(\d+)\s+(\d+)$/);
  return match ? `${match[1]} ${match[2]}` : VUTEK_MEDIA_DIMENSION;
}

function deriveDimensionFromInches(width?: number | null, height?: number | null): string | undefined {
  if (!width || !height || width <= 0 || height <= 0) return undefined;
  return `${Math.round(width * 72)} ${Math.round(height * 72)}`;
}

function buildComponentDimensions(dimension: string): string | undefined {
  const match = normalizeDimensionValue(dimension).match(/^(\d+)\s+(\d+)$/);
  return match ? `${match[1]} ${match[2]} 0` : undefined;
}

export function buildFieryJobTicketName(params: {
  workOrderNumber?: string | null;
  customerName?: string | null;
  sourceFileName?: string | null;
  jobDescription?: string | null;
}): string {
  const parts: string[] = [];
  const workOrderNumber = params.workOrderNumber?.trim().replace(/^wo/i, '');
  const customerName = params.customerName?.trim();
  const jobDescription = params.jobDescription?.trim();
  const sourceBaseName = params.sourceFileName
    ? path.basename(params.sourceFileName, path.extname(params.sourceFileName))
    : '';

  if (workOrderNumber) parts.push(`WO${workOrderNumber}`);
  if (customerName) parts.push(customerName);
  if (jobDescription && jobDescription !== sourceBaseName) parts.push(jobDescription);
  if (sourceBaseName) parts.push(sourceBaseName);

  const label = sanitizeJobTicketName(parts.join(' - '));
  return label || `ERP-${Date.now()}`;
}

function decodeFieryValue(rawValue: string): string {
  const trimmed = trimTrailingNulls(rawValue);
  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed.replace(/%20/g, ' ');
  }
}

function uniqueSorted(values: Iterable<string>): string[] {
  return Array.from(
    new Set(
      Array.from(values)
        .map((value) => normalizeWhitespace(value))
        .filter(Boolean)
    )
  ).sort((left, right) => left.localeCompare(right));
}

export function matchFieryWorkflowName(
  preferred: string | null | undefined,
  available: string[],
): string | null {
  const normalizedPreferred = normalizeWhitespace(preferred ?? '');
  if (!normalizedPreferred) return null;

  const exact = available.find((name) => name === normalizedPreferred);
  if (exact) return exact;

  const caseInsensitive = available.find(
    (name) => name.toLowerCase() === normalizedPreferred.toLowerCase(),
  );
  return caseInsensitive || normalizedPreferred;
}

export function resolveFieryMediaMappingName(
  settings: Partial<Pick<ResolvedVutekPrintSettings, 'media' | 'ripMedia' | 'inkType' | 'mediaType' | 'resolution' | 'colorMode'>>,
): string {
  const explicitRipMedia = normalizeFieryMediaName(settings.ripMedia);
  if (explicitRipMedia && explicitRipMedia.toUpperCase() !== 'PSA') {
    return explicitRipMedia;
  }

  const mapped = findFieryMediaMapping({
    substrate: settings.media,
    inkType: settings.inkType,
    mediaType: settings.mediaType,
    resolution: settings.resolution,
    colorMode: settings.colorMode,
  });

  return mapped?.ripMedia ?? VUTEK_RIP_MEDIA;
}

function extractStringStateValues(blobText: string, stateName: string): string[] {
  const blockPattern = new RegExp(
    `<StringState[^>]*Name="${stateName}"[^>]*>([\\s\\S]*?)</StringState>`,
    'i'
  );
  const blockMatch = blobText.match(blockPattern);
  if (!blockMatch?.[1]) return [];
  const values = blockMatch[1].matchAll(/AllowedValue="([^"]+)"/g);
  return uniqueSorted(Array.from(values, (match) => decodeFieryValue(match[1])));
}

async function findDeviceInfoBlob(): Promise<string | null> {
  const roots = [
    path.join(VUTEK_PROGRAM_DATA_SHARE, 'EFI', 'EFI XF', 'JDF'),
    path.join(VUTEK_PROGRAM_DATA_SHARE, 'EFI', 'EFI XF Server', 'JDF'),
  ];

  for (const root of roots) {
    try {
      const entries = await fs.readdir(root, { withFileTypes: true });
      const directMatch = entries.find(
        (entry) => entry.isFile() && entry.name.toLowerCase() === '_0_deviceinfo.blob'
      );
      if (directMatch) {
        return path.join(root, directMatch.name);
      }

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const nestedPath = path.join(root, entry.name, '_0_DEVICEINFO.blob');
        try {
          await fs.access(nestedPath);
          return nestedPath;
        } catch {
          // Keep scanning.
        }
      }
    } catch {
      // Keep scanning.
    }
  }

  return null;
}

async function readDeviceInfoBlob(): Promise<{ path: string; text: string } | null> {
  const blobPath = await findDeviceInfoBlob();
  if (!blobPath) return null;

  try {
    const raw = await fs.readFile(blobPath);
    const text = raw.toString('latin1').replace(/[^\x20-\x7E]+/g, ' ');
    return { path: blobPath, text };
  } catch {
    return null;
  }
}

export async function discoverFieryCapabilities(): Promise<FieryCapabilities> {
  const now = Date.now();
  if (_cachedCapabilities && now - _cachedCapabilities.cachedAt < CAPABILITIES_CACHE_MS) {
    return _cachedCapabilities.data;
  }

  const blob = await readDeviceInfoBlob();
  if (!blob) {
    const unavailable = {
      workflows: [],
      colorModes: [],
      inkTypes: [],
      whiteInkOptions: [],
      source: 'none',
      error: 'Fiery device capabilities were not found on the ProgramData share',
    };
    _cachedCapabilities = { data: unavailable, cachedAt: now };
    return unavailable;
  }

  const capabilities: FieryCapabilities = {
    workflows: extractStringStateValues(blob.text, 'FieryVirtualPrinter'),
    colorModes: extractStringStateValues(blob.text, 'ColorMode'),
    inkTypes: extractStringStateValues(blob.text, 'InkType'),
    whiteInkOptions: extractStringStateValues(blob.text, 'WhiteInkOptions'),
    source: blob.path,
  };

  _cachedCapabilities = { data: capabilities, cachedAt: now };
  return capabilities;
}

export function getEffectiveVutekSettings(
  overrides: Partial<VutekPrintSettings> = {}
): ResolvedVutekPrintSettings {
  const merged: VutekPrintSettings = {
    ...BLADE_SIGN_DEFAULTS,
    ...overrides,
  };
  const media = normalizeWhitespace(merged.media || VUTEK_MEDIA) || VUTEK_MEDIA;
  const resolution = normalizeResolutionValue(merged.resolution) || VUTEK_RESOLUTION;
  const ripMedia = resolveFieryMediaMappingName({
    media,
    ripMedia: merged.ripMedia,
    inkType: merged.inkType || VUTEK_INK_TYPE,
    mediaType: merged.mediaType || VUTEK_MEDIA_TYPE,
    resolution,
    colorMode: merged.colorMode || VUTEK_COLOR_MODE,
  });

  return {
    media,
    mediaType: merged.mediaType || VUTEK_MEDIA_TYPE,
    mediaUnit: merged.mediaUnit || VUTEK_MEDIA_UNIT,
    ripMedia,
    printDirection: merged.printDirection || 'Bidirectional',
    interlaceMode: merged.interlaceMode || 'Multipass Standard',
    curing: merged.curing || 'High',
    cureIntensity: merged.cureIntensity || 'Max',
    carriageSpeed: merged.carriageSpeed || 'Maximum',
    lampMode: merged.lampMode || 'Leading',
    shutterMode: merged.shutterMode || 'Double',
    smoothing: merged.smoothing || 'Light',
    whiteInk: merged.whiteInk ?? true,
    mirror: merged.mirror ?? false,
    copies: Math.max(1, merged.copies ?? 1),
    workspace: merged.workspace || 'DEFAULT',
    outputChannelName: merged.outputChannelName || VUTEK_OUTPUT_CHANNEL,
    mediaDimension: normalizeDimensionValue(merged.mediaDimension),
    colorMode: merged.colorMode || VUTEK_COLOR_MODE,
    inkType: merged.inkType || VUTEK_INK_TYPE,
    whiteInkOptions: merged.whiteInkOptions || VUTEK_WHITE_INK_OPTIONS,
    resolution,
  };
}

/**
 * Build a JDF job ticket for submission to Fiery XF via JMF SubmitQueueEntry.
 * References the PDF at the VUTEk-local path so the Fiery can read it directly.
 */
function buildJdf(params: {
  workOrderId: string;
  submissionJobId: string;
  jobTicketName: string;
  pdfLocalPath: string; // e.g. C:\Users\Public\Documents\VUTEk Jobs\file.pdf
  settings: VutekPrintSettings;
  jobComment?: string;
}): string {
  const { workOrderId, submissionJobId, jobTicketName, pdfLocalPath, settings, jobComment } = params;
  const s = getEffectiveVutekSettings(settings);
  const copies = s.copies;

  // Accept either a pre-built HTTP URL or a Windows local path (convert to file://)
  const pdfUrl = pdfLocalPath.startsWith('http')
    ? pdfLocalPath
    : 'file:///' + pdfLocalPath.replace(/\\/g, '/').replace(/ /g, '%20');

  // Build colorant order — always CMYK, WHITE_INK only when enabled
  const separations = ['Cyan', 'Magenta', 'Yellow', 'Black'];
  if (s.whiteInk) separations.push('WHITE_INK');
  const colorantOrderXml = separations
    .map((n) => `        <SeparationSpec Name="${n}"/>`)
    .join('\n');
  const colorPoolXml = separations
    .map((n) => `      <Color ColorName="${escapeXmlAttr(n)}" Name="${escapeXmlAttr(n)}"/>`)
    .join('\n');
  const inkXml = separations
    .map(
      (n) =>
        `      <Ink ProductID="ERP-IJINK-${escapeXmlAttr(n)}" Separation="${escapeXmlAttr(n)}"/>`
    )
    .join('\n');

  const now = new Date().toISOString();
  const uniqueId = submissionJobId;
  const colorPoolId = `CP_${uniqueId}`;
  const artIntentId = `ADI_${uniqueId}`;
  const componentDimensions = buildComponentDimensions(s.mediaDimension);
  const [aspectX = '1000', aspectY = '720'] = s.resolution.split(' ');
  const ripMediaName = resolveFieryMediaMappingName(s);
  const substrateName = normalizeWhitespace(s.media);
  const nodeFeatures = [
    ['FieryVirtualPrinter', s.outputChannelName],
    ['ColorMode', s.colorMode],
    ['InkType', s.inkType],
    ['WhiteInkOptions', s.whiteInkOptions],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));

  // NodeInfo carries the Fiery XF workflow/output channel name via two mechanisms:
  //   1. DescriptiveName attr — processed by XF Server to select the workflow
  //   2. FieryVirtualPrinter in FeaturePool — EFI-proprietary param processed by the JDF Connector
  //      (discovered in _0_DEVICEINFO.blob; DefaultValue="ZUND%20G7")
  // Both are set so the correct workflow is selected regardless of which layer intercepts first.
  const nodeInfoXml = `    <NodeInfo ID="XFNodeInfo" LastEnd="" DescriptiveName="${escapeXmlAttr(jobTicketName)}">
      <FeaturePool>
${nodeFeatures
  .map(
    ([featureName, value]) =>
      `        <Feature FeatureName="${escapeXmlAttr(featureName)}" Value="${escapeXmlAttr(value)}"/>`
  )
  .join('\n')}
      </FeaturePool>
    </NodeInfo>`;

  // DescriptiveName on the root <JDF> element — EFI JDF Connector may use this for workflow routing
  // (in addition to NodeInfo/@DescriptiveName). Use the exact workflow/output channel name so the
  // connector does not have to infer the route from a placeholder.
  const rootDescriptiveName = s.outputChannelName;

  return `<?xml version="1.0" encoding="UTF-8"?>
<JDF xmlns="http://www.CIP4.org/JDFSchema_1_1"
     xmlns:EFI="http://www.efi.com/efijdf"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
     EFI:MaxIntegrationVer="1.6"
     ID="${uniqueId}"
     JobID="${escapeXmlAttr(jobTicketName)}"${rootDescriptiveName ? `\n     DescriptiveName="${escapeXmlAttr(rootDescriptiveName)}"` : ''}
     Status="Waiting"
     Type="Combined"
     Types="LayoutPreparation DigitalPrinting"
     xsi:type="Combined"
     Version="1.3">
  <ResourceLinkPool>
    <RenderingParamsLink Usage="Input" rRef="REND_${uniqueId}"/>
    <ComponentLink Amount="${copies}" CombinedProcessIndex="1" Usage="Output" rRef="COMP_${uniqueId}"/>
    <ArtDeliveryIntentLink CombinedProcessIndex="1" Usage="Input" rRef="${artIntentId}"/>
    <RunListLink CombinedProcessIndex="1" Usage="Input" rRef="RL_${uniqueId}"/>
    <MediaLink Amount="1" CombinedProcessIndex="1" Usage="Input" rRef="MEDIA_${uniqueId}"/>
    <EFI:MachinePropertiesLink CombinedProcessIndex="1" Usage="Input" rRef="MACH_${uniqueId}"/>
    <ColorantControlLink Usage="Input" rRef="CCTRL_${uniqueId}"/>
    <InkLink Usage="Input" rRef="INK_${uniqueId}"/>
    <NodeInfoLink Usage="Input" rRef="XFNodeInfo"/>
    <DigitalPrintingParamsLink Usage="Input" rRef="DPP_${uniqueId}"/>
  </ResourceLinkPool>
  <ResourcePool>
${nodeInfoXml}
    <DigitalPrintingParams Class="Parameter" ID="DPP_${uniqueId}" NonPrintableMarginBottom="0" NonPrintableMarginLeft="0" NonPrintableMarginRight="0" NonPrintableMarginTop="0" Status="Available"/>
    <ArtDeliveryIntent Class="Intent" ID="${artIntentId}" Status="Available" rRefs="RL_${uniqueId}">
      <ArtDelivery ArtDeliveryType="DigitalFile">
        <RunListRef rRef="RL_${uniqueId}"/>
      </ArtDelivery>
    </ArtDeliveryIntent>
    <RunList Class="Parameter" ID="RL_${uniqueId}" Status="Available">
      <LayoutElement Class="Parameter">
        <FileSpec URL="${escapeXmlAttr(pdfUrl)}"/>
      </LayoutElement>
    </RunList>
    <Component Class="Quantity" ComponentType="FinalProduct"${componentDimensions ? ` Dimensions="${componentDimensions}"` : ''} EFI:AspectX="${aspectX}" EFI:AspectY="${aspectY}" ID="COMP_${uniqueId}" Status="Available"/>
    <Media Class="Consumable" Brand="${escapeXmlAttr(substrateName)}" DescriptiveName="${escapeXmlAttr(substrateName)}" ProductID="${escapeXmlAttr(substrateName)}" Dimension="${escapeXmlAttr(s.mediaDimension)}" ID="MEDIA_${uniqueId}" MediaType="${escapeXmlAttr(s.mediaType)}" MediaUnit="${escapeXmlAttr(s.mediaUnit)}" Status="Available"/>
    <RenderingParams Class="Parameter" ID="REND_${uniqueId}" Status="Available">
      <ObjectResolution Resolution="${escapeXmlAttr(s.resolution)}"/>
    </RenderingParams>
    <EFI:MachineProperties ID="MACH_${uniqueId}">
      <EFI:VutekProp
        AddFooter="false"
        AddHeader="false"
        CarriageSpeed="${escapeXmlAttr(s.carriageSpeed)}"
        Center="true"
        CureIntensity="${escapeXmlAttr(s.cureIntensity)}"
        Curing="${escapeXmlAttr(s.curing)}"
        DoubleStrike="false"
        FullBleed="false"
        InterlaceMode="${escapeXmlAttr(s.interlaceMode)}"
        LampMode="${escapeXmlAttr(s.lampMode)}"
        Media="${escapeXmlAttr(ripMediaName)}"
        Mirror="${s.mirror ? 'true' : 'false'}"
        PrintDirection="${escapeXmlAttr(s.printDirection)}"
        PrintMode="${escapeXmlAttr(s.colorMode)}"
        Resolution="${escapeXmlAttr(s.resolution)}"
        ShutterMode="${escapeXmlAttr(s.shutterMode)}"
        Smoothing="${escapeXmlAttr(s.smoothing)}"
        Unidirectional="${s.printDirection === 'Unidirectional' ? 'true' : 'false'}"
        Workspace="${escapeXmlAttr(s.workspace)}"/>
    </EFI:MachineProperties>
    <ColorPool Class="Parameter" ID="${colorPoolId}" Status="Available">
${colorPoolXml}
    </ColorPool>
    <ColorantControl Class="Parameter" ID="CCTRL_${uniqueId}" Status="Available">
      <ColorPoolRef rRef="${colorPoolId}"/>
      <ColorantOrder>
${colorantOrderXml}
      </ColorantOrder>
    </ColorantControl>
    <Ink Class="Consumable" EFI:BitsPerDot="2" EFI:DropsPerDot="3" Family="InkJet" ID="INK_${uniqueId}" PartIDKeys="Separation" Status="Available" Unit="l">
${inkXml}
    </Ink>
  </ResourcePool>
  <AuditPool>
    <Created AgentName="WildeSignsERP" AgentVersion="1.0" TimeStamp="${now}">
      <Comment>Submitted from ERP for job ${escapeXmlAttr(workOrderId)}${jobComment ? ` | ${escapeXmlAttr(jobComment)}` : ''}</Comment>
    </Created>
  </AuditPool>
</JDF>`;
}

/**
 * Submit a print job to the VUTEk via JMF SubmitQueueEntry.
 *
 * Steps:
 *  1. Copy the source PDF to the VUTEk Jobs share
 *  2. Write a JDF job ticket to the same share
 *  3. POST JMF SubmitQueueEntry referencing the JDF via file:// URL
 */
export async function submitVutekJob(params: {
  jobId: string;
  sourceFilePath: string;
  settings?: Partial<VutekPrintSettings>;
  jobInfo?: {
    workOrderNumber?: string | null;
    customerName?: string | null;
    customerId?: string | null;
    sourceFileName?: string | null;
    jobDescription?: string | null;
  };
}): Promise<VutekJobResult> {
  const { jobId, sourceFilePath, settings = {}, jobInfo } = params;
  const ts = Date.now();
  const submissionJobId = `ERP-${jobId}-${ts}`;
  const ext = path.extname(sourceFilePath);
  const customerMetadata = resolveFieryCustomerMetadata({
    workOrderNumber: jobInfo?.workOrderNumber ?? null,
    customerName: jobInfo?.customerName ?? null,
    customerId: jobInfo?.customerId ?? null,
    sourceFileName: jobInfo?.sourceFileName ?? null,
    jobDescription: jobInfo?.jobDescription ?? null,
  });
  const resolvedCustomerName = customerMetadata.customerName;
  const resolvedCustomerId = customerMetadata.customerId;
  const jobTicketName = buildFieryJobTicketName({
    workOrderNumber: jobInfo?.workOrderNumber ?? null,
    customerName: resolvedCustomerName,
    sourceFileName: jobInfo?.sourceFileName ?? path.basename(sourceFilePath),
    jobDescription: jobInfo?.jobDescription ?? null,
  });
  const jobCommentParts = customerMetadata.commentParts;

  // Files are staged locally on the ERP server and served via HTTP.
  // The JDF Connector downloads both JDF and PDF over HTTP, placing the PDF in
  // C:\ProgramData\EFI\EFI XF\JDF\Download\{QueueEntryId}\ where XF Server expects it.
  const safePdfName = `${submissionJobId}${ext}`;
  const jdfName = `${submissionJobId}.jdf`;

  const pdfLocalPath = path.join(VUTEK_JOB_DIR, safePdfName);
  const jdfLocalPath = path.join(VUTEK_JOB_DIR, jdfName);

  const pdfHttpUrl = `${ERP_SERVER_URL}/api/v1/rip-queue/vutek-files/${encodeURIComponent(safePdfName)}`;
  const jdfHttpUrl = `${ERP_SERVER_URL}/api/v1/rip-queue/vutek-files/${encodeURIComponent(jdfName)}`;

  // 1. Ensure local job directory exists
  await fs.mkdir(VUTEK_JOB_DIR, { recursive: true });

  // 2. Copy PDF to local staging directory
  try {
    await fs.copyFile(sourceFilePath, pdfLocalPath);
  } catch (err: any) {
    return { success: false, error: `Failed to stage PDF for VUTEk: ${err.message}` };
  }

  const resolvedWorkflowName = await resolveFieryWorkflowName(settings.outputChannelName ?? undefined);
  const resolvedSettings = {
    ...settings,
    outputChannelName: resolvedWorkflowName,
  };

  // 3. Build and write JDF (references PDF via HTTP URL)
  const jdfContent = buildJdf({
    workOrderId: jobId,
    submissionJobId,
    jobTicketName,
    pdfLocalPath: pdfHttpUrl, // passed to buildJdf as "pdfLocalPath" but it's an HTTP URL
    settings: resolvedSettings,
    jobComment: jobCommentParts.length > 0 ? jobCommentParts.join(' | ') : undefined,
  });

  try {
    await fs.writeFile(jdfLocalPath, jdfContent, 'utf-8');
  } catch (err: any) {
    await fs.unlink(pdfLocalPath).catch(() => {});
    return { success: false, error: `Failed to write JDF: ${err.message}` };
  }

  // 4. Build JMF SubmitQueueEntry pointing to the JDF via HTTP URL
  const now = new Date().toISOString();
  const msgId = `ERP-C-${Date.now()}`;

  const jmf = `<?xml version="1.0" encoding="UTF-8"?>
<JMF xmlns="http://www.CIP4.org/JDFSchema_1_1" SenderID="WildeSignsERP" TimeStamp="${now}" Version="1.3">
  <Command ID="${msgId}" Type="SubmitQueueEntry">
    <QueueSubmissionParams URL="${jdfHttpUrl}"/>
  </Command>
</JMF>`;

  // 5. POST JMF to the VUTEk JDF Connector (use discovered URL if available)
  const { url: jmfUrl } = await discoverVutekJmfUrl();
  try {
    const resp = await fetch(jmfUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/vnd.cip4-jmf+xml' },
      body: jmf,
      signal: AbortSignal.timeout(15000),
    });

    const body = await resp.text();

    // Parse QueueEntryID from response
    const queueEntryMatch = body.match(/QueueEntryID="([^"]+)"/);
    const returnCodeMatch = body.match(/ReturnCode="(\d+)"/);
    const returnCode = returnCodeMatch ? parseInt(returnCodeMatch[1], 10) : -1;
    const normalizedQueueEntryId = normalizeFieryQueueEntryId(queueEntryMatch?.[1]);

    if (returnCode !== 0) {
      const errorMatch = body.match(
        /<faultstring>([^<]+)<\/faultstring>|<Error[^>]*>([^<]+)<\/Error>/
      );
      const errMsg = errorMatch ? errorMatch[1] || errorMatch[2] : body.slice(0, 500);
      // Clean up staged files on failure
      await fs.unlink(jdfLocalPath).catch(() => {});
      return { success: false, error: `JMF submission failed (code ${returnCode}): ${errMsg}` };
    }

    return {
      success: true,
      queueEntryId: normalizedQueueEntryId,
      submissionJobId,
      jdfPath: jdfLocalPath,
      pdfDestPath: pdfLocalPath,
    };
  } catch (err: any) {
    // Clean up staged files on network failure
    await fs.unlink(jdfLocalPath).catch(() => {});
    return { success: false, error: `JMF network error: ${err.message}` };
  }
}

/**
 * Scan the VUTEk ProgramData share to discover Fiery XF output channel / workflow names.
 *
 * Fiery XF stores its configuration under:
 *   C:\ProgramData\EFI\EFI XF\Server\  (and sub-dirs)
 *
 * Output channels appear as XML files with DescriptiveName attributes or
 * as <OutputChannel> elements. We also mine the EFI Export Folder JDFs for
 * DescriptiveName values used by real processed jobs.
 */
export async function discoverFieryWorkflows(): Promise<{
  workflows: string[];
  source: string;
  error?: string;
}> {
  const capabilities = await discoverFieryCapabilities();
  if (capabilities.workflows.length > 0) {
    return {
      workflows: capabilities.workflows,
      source: capabilities.source,
    };
  }

  const workflows = new Set<string>();
  let source = 'none';

  // --- Strategy 1: scan EFI Export Folder for DescriptiveName in processed JDFs ---
  const exportFolder = `\\\\${VUTEK_HOST}\\EFI Export Folder`;
  try {
    const entries = await fs.readdir(exportFolder);
    const jdfFiles = entries.filter((f) => f.toLowerCase().endsWith('.jdf')).slice(0, 20);
    for (const jdf of jdfFiles) {
      try {
        const xml = await fs.readFile(path.join(exportFolder, jdf), 'utf-8');
        // Extract DescriptiveName from NodeInfo or OutputChannel elements
        const matches = xml.matchAll(/DescriptiveName="([^"]+)"/g);
        for (const m of matches) {
          const name = m[1].trim();
          if (name && name.length < 200) workflows.add(name);
        }
        // Also look for OutputChannel Name attributes
        const ocMatches = xml.matchAll(/<OutputChannel[^>]+Name="([^"]+)"/g);
        for (const m of ocMatches) workflows.add(m[1].trim());
      } catch {
        // skip unreadable files
      }
    }
    if (workflows.size > 0) source = `EFI Export Folder (${exportFolder})`;
  } catch {
    // Export folder not accessible — continue to next strategy
  }

  // --- Strategy 2: scan ProgramData\EFI for XML configs ---
  const xfRoots = [
    path.join(VUTEK_PROGRAM_DATA_SHARE, 'EFI', 'EFI XF'),
    path.join(VUTEK_PROGRAM_DATA_SHARE, 'EFI', 'EFI XF Server'),
    path.join(VUTEK_PROGRAM_DATA_SHARE, 'EFI'),
  ];

  for (const root of xfRoots) {
    try {
      await fs.access(root);
      const found = await scanDirForWorkflows(root, 0);
      for (const w of found) workflows.add(w);
      if (found.length > 0) {
        source = source === 'none' ? root : source + ` + ${root}`;
      }
      break; // use first accessible root
    } catch {
      // not found — try next
    }
  }

  return {
    workflows: Array.from(workflows).sort(),
    source,
    error: workflows.size === 0 ? 'No workflow names found — check share access' : undefined,
  };
}

export async function resolveFieryWorkflowName(
  preferred: string | null | undefined,
): Promise<string> {
  const discovery = await discoverFieryWorkflows();
  return (
    matchFieryWorkflowName(preferred, discovery.workflows) ||
    matchFieryWorkflowName(VUTEK_OUTPUT_CHANNEL, discovery.workflows) ||
    resolveFieryWorkflowSelection(preferred)
  );
}

/** Recursively scan a directory for XML files containing workflow names (max depth 4). */
async function scanDirForWorkflows(dir: string, depth: number): Promise<string[]> {
  if (depth > 4) return [];
  const found: string[] = [];
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }

  for (const entry of entries) {
    const full = path.join(dir, entry);
    const lower = entry.toLowerCase();

    // Skip known-irrelevant large dirs
    if (['logs', 'cache', 'temp', 'tmp', 'backup'].includes(lower)) continue;

    try {
      const stat = await fs.stat(full);
      if (stat.isDirectory()) {
        const sub = await scanDirForWorkflows(full, depth + 1);
        found.push(...sub);
      } else if (
        stat.isFile() &&
        stat.size < 512_000 &&
        (lower.endsWith('.xml') || lower.endsWith('.xjt') || lower.endsWith('.cfg'))
      ) {
        const xml = await fs.readFile(full, 'utf-8').catch(() => '');
        if (!xml) continue;
        // Look for output channel / workflow name patterns
        if (/outputchannel|workflow|channel/i.test(xml)) {
          const dn = xml.matchAll(/DescriptiveName="([^"]+)"/g);
          for (const m of dn) {
            const n = m[1].trim();
            if (n && n.length < 200) found.push(n);
          }
          const nn = xml.matchAll(/<(?:OutputChannel|Workflow|Channel)[^>]+Name="([^"]+)"/g);
          for (const m of nn) found.push(m[1].trim());
        }
      }
    } catch {
      // skip permission errors
    }
  }
  return found;
}

/**
 * Query the current VUTEk print queue status.
 */
export async function getVutekQueueStatus(): Promise<{
  status: string;
  queueSize: number;
  jobId?: string | null;
  queueEntryId?: string | null;
  raw?: string;
}> {
  const now = new Date().toISOString();
  const jmf = `<?xml version="1.0" encoding="UTF-8"?>
<JMF xmlns="http://www.CIP4.org/JDFSchema_1_1" SenderID="WildeSignsERP" TimeStamp="${now}" Version="1.3">
  <Query ID="Q-${Date.now()}" Type="QueueStatus"/>
</JMF>`;

  const { url: jmfUrl } = await discoverVutekJmfUrl();
  try {
    const resp = await fetch(jmfUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/vnd.cip4-jmf+xml' },
      body: jmf,
      signal: AbortSignal.timeout(8000),
    });
    const body = await resp.text();
    const statusMatch = body.match(/Status="([^"]+)"/);
    const sizeMatch = body.match(/QueueSize="(\d+)"/);
    const jobIdMatch = body.match(/JobID="([^"]+)"/);
    const queueEntryMatch = body.match(/QueueEntryID="([^"]+)"/);
    return {
      status: statusMatch?.[1] ?? 'Unknown',
      queueSize: sizeMatch ? parseInt(sizeMatch[1], 10) : 0,
      jobId: jobIdMatch?.[1] ?? null,
      queueEntryId: normalizeFieryQueueEntryId(queueEntryMatch?.[1]) ?? null,
      raw: body,
    };
  } catch (err: any) {
    return { status: 'Unreachable', queueSize: 0, raw: err.message };
  }
}
