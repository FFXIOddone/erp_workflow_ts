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
 *   1. Copy PDF to \\192.168.254.57\Users\Public\Documents\VUTEk Jobs\ (writable share)
 *   2. Build JDF job ticket referencing C:\Users\Public\Documents\VUTEk Jobs\{file}.pdf
 *   3. Write JDF to same share
 *   4. Submit JMF SubmitQueueEntry pointing to the JDF via file:// URL
 */

import { promises as fs } from 'fs';
import path from 'path';

// JMF device endpoint (discovered via http://192.168.254.57:8010/)
const VUTEK_JMF_URL = 'http://192.168.254.57:8010/50aeb1ff-652b-4cd2-96b7-2eefda8925f8';

// Network share path where we drop files (writable from ERP server)
const VUTEK_JOBS_SHARE = '\\\\192.168.254.57\\Users\\Public\\Documents\\VUTEk Jobs';

// Local path on the VUTEk machine (how the VUTEk itself sees those same files)
const VUTEK_JOBS_LOCAL = 'C:\\Users\\Public\\Documents\\VUTEk Jobs';

export interface VutekPrintSettings {
  media?: string; // e.g. "60 inch Web"
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
}

export interface VutekJobResult {
  success: boolean;
  queueEntryId?: string;
  jdfPath?: string;
  pdfDestPath?: string;
  error?: string;
}

/**
 * Default print settings for blade sign / HH Global flatbed jobs.
 * Derived from analysis of existing JDFs in EFI Export Folder.
 */
export const BLADE_SIGN_DEFAULTS: VutekPrintSettings = {
  media: '60 inch Web',
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
};

/**
 * Build a JDF job ticket for submission to Fiery XF via JMF SubmitQueueEntry.
 * References the PDF at the VUTEk-local path so the Fiery can read it directly.
 */
function buildJdf(params: {
  jobId: string;
  pdfLocalPath: string; // e.g. C:\Users\Public\Documents\VUTEk Jobs\file.pdf
  settings: VutekPrintSettings;
}): string {
  const { jobId, pdfLocalPath, settings } = params;
  const s = { ...BLADE_SIGN_DEFAULTS, ...settings };
  const copies = s.copies ?? 1;

  // Convert Windows path to file:// URL with percent-encoded spaces
  const pdfUrl = 'file:///' + pdfLocalPath.replace(/\\/g, '/').replace(/ /g, '%20');

  // Build colorant order — always CMYK, WHITE_INK only when enabled
  const separations = ['Cyan', 'Magenta', 'Yellow', 'Black'];
  if (s.whiteInk) separations.push('WHITE_INK');
  const colorantOrderXml = separations
    .map((n) => `        <SeparationSpec Name="${n}"/>`)
    .join('\n');

  const now = new Date().toISOString();
  const uniqueId = `ERP-${jobId}-${Date.now()}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<JDF xmlns="http://www.CIP4.org/JDFSchema_1_1"
     xmlns:EFI="http://www.efi.com/efijdf"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
     EFI:MaxIntegrationVer="1.6"
     ID="${uniqueId}"
     JobID="${uniqueId}"
     Status="Waiting"
     Type="Combined"
     Types="LayoutPreparation DigitalPrinting"
     Version="1.3"
     xsi:type="Combined">
  <ResourceLinkPool>
    <RunListLink CombinedProcessIndex="1" Usage="Input" rRef="RL_${uniqueId}"/>
    <ComponentLink Amount="${copies}" CombinedProcessIndex="1" Usage="Output" rRef="COMP_${uniqueId}"/>
    <MediaLink Amount="1" CombinedProcessIndex="1" Usage="Input" rRef="MEDIA_${uniqueId}"/>
    <EFI:MachinePropertiesLink CombinedProcessIndex="1" Usage="Input" rRef="MACH_${uniqueId}"/>
    <ColorantControlLink Usage="Input" rRef="CCTRL_${uniqueId}"/>
  </ResourceLinkPool>
  <ResourcePool>
    <RunList Class="Parameter" ID="RL_${uniqueId}" Status="Available">
      <LayoutElement>
        <FileSpec URL="${pdfUrl}"/>
      </LayoutElement>
    </RunList>
    <Component Class="Quantity" ComponentType="FinalProduct" ID="COMP_${uniqueId}" Status="Available"/>
    <Media Class="Consumable" DescriptiveName="${s.media}" ID="MEDIA_${uniqueId}" Status="Available"/>
    <EFI:MachineProperties ID="MACH_${uniqueId}">
      <EFI:VutekProp
        AddFooter="false"
        AddHeader="false"
        CarriageSpeed="${s.carriageSpeed}"
        Center="true"
        CureIntensity="${s.cureIntensity}"
        Curing="${s.curing}"
        DoubleStrike="false"
        FullBleed="false"
        GlossMode=""
        InterlaceMode="${s.interlaceMode}"
        LampMode="${s.lampMode}"
        Media="${s.media}"
        Mirror="${s.mirror ? 'true' : 'false'}"
        PrintDirection="${s.printDirection}"
        PrintMode=""
        Resolution=""
        ShutterMode="${s.shutterMode}"
        Smoothing="${s.smoothing}"
        Unidirectional="false"
        Workspace="${s.workspace}"/>
    </EFI:MachineProperties>
    <ColorantControl Class="Parameter" ID="CCTRL_${uniqueId}" Status="Available">
      <ColorantOrder>
${colorantOrderXml}
      </ColorantOrder>
    </ColorantControl>
  </ResourcePool>
  <AuditPool>
    <Created AgentName="WildeSignsERP" AgentVersion="1.0" TimeStamp="${now}">
      <Comment>Submitted from ERP for job ${jobId}</Comment>
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
}): Promise<VutekJobResult> {
  const { jobId, sourceFilePath, settings = {} } = params;
  const fileName = path.basename(sourceFilePath);
  const jdfName = `ERP-${jobId}-${Date.now()}.jdf`;

  const pdfDestShare = path.join(VUTEK_JOBS_SHARE, fileName);
  const jdfDestShare = path.join(VUTEK_JOBS_SHARE, jdfName);

  const pdfLocalPath = path.join(VUTEK_JOBS_LOCAL, fileName);
  const jdfLocalPath = path.join(VUTEK_JOBS_LOCAL, jdfName);

  // 1. Ensure the share is accessible
  try {
    await fs.access(VUTEK_JOBS_SHARE);
  } catch {
    return { success: false, error: `VUTEk Jobs share not accessible: ${VUTEK_JOBS_SHARE}` };
  }

  // 2. Copy PDF to share (rename if already exists)
  let finalPdfDestShare = pdfDestShare;
  try {
    await fs.access(pdfDestShare);
    // Already exists — append timestamp to avoid collision
    const ext = path.extname(fileName);
    const base = path.basename(fileName, ext);
    const ts = Date.now();
    finalPdfDestShare = path.join(VUTEK_JOBS_SHARE, `${base}_${ts}${ext}`);
  } catch {
    // Doesn't exist — use as-is
  }

  try {
    await fs.copyFile(sourceFilePath, finalPdfDestShare);
  } catch (err: any) {
    return { success: false, error: `Failed to copy PDF to VUTEk share: ${err.message}` };
  }

  // Recompute local PDF path if name changed
  const finalPdfLocal = path.join(VUTEK_JOBS_LOCAL, path.basename(finalPdfDestShare));

  // 3. Build and write JDF
  const jdfContent = buildJdf({
    jobId,
    pdfLocalPath: finalPdfLocal,
    settings,
  });

  try {
    await fs.writeFile(jdfDestShare, jdfContent, 'utf-8');
  } catch (err: any) {
    return { success: false, error: `Failed to write JDF to VUTEk share: ${err.message}` };
  }

  // 4. Build JMF SubmitQueueEntry pointing to the JDF via file:// URL
  const jdfFileUrl = 'file:///' + jdfLocalPath.replace(/\\/g, '/').replace(/ /g, '%20');
  const now = new Date().toISOString();
  const msgId = `ERP-C-${Date.now()}`;

  const jmf = `<?xml version="1.0" encoding="UTF-8"?>
<JMF xmlns="http://www.CIP4.org/JDFSchema_1_1" SenderID="WildeSignsERP" TimeStamp="${now}" Version="1.3">
  <Command ID="${msgId}" Type="SubmitQueueEntry">
    <QueueSubmissionParams URL="${jdfFileUrl}"/>
  </Command>
</JMF>`;

  // 5. POST JMF to the VUTEk JDF Connector
  try {
    const resp = await fetch(VUTEK_JMF_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/vnd.cip4-jmf+xml' },
      body: jmf,
    });

    const body = await resp.text();

    // Parse QueueEntryID from response
    const queueEntryMatch = body.match(/QueueEntryID="([^"]+)"/);
    const returnCodeMatch = body.match(/ReturnCode="(\d+)"/);
    const returnCode = returnCodeMatch ? parseInt(returnCodeMatch[1], 10) : -1;

    if (returnCode !== 0) {
      const errorMatch = body.match(
        /<faultstring>([^<]+)<\/faultstring>|<Error[^>]*>([^<]+)<\/Error>/
      );
      const errMsg = errorMatch ? errorMatch[1] || errorMatch[2] : body.slice(0, 500);
      // Clean up JDF on failure
      await fs.unlink(jdfDestShare).catch(() => {});
      return { success: false, error: `JMF submission failed (code ${returnCode}): ${errMsg}` };
    }

    return {
      success: true,
      queueEntryId: queueEntryMatch?.[1],
      jdfPath: jdfDestShare,
      pdfDestPath: finalPdfDestShare,
    };
  } catch (err: any) {
    // Clean up JDF on network failure
    await fs.unlink(jdfDestShare).catch(() => {});
    return { success: false, error: `JMF network error: ${err.message}` };
  }
}

/**
 * Query the current VUTEk print queue status.
 */
export async function getVutekQueueStatus(): Promise<{
  status: string;
  queueSize: number;
  raw?: string;
}> {
  const now = new Date().toISOString();
  const jmf = `<?xml version="1.0" encoding="UTF-8"?>
<JMF xmlns="http://www.CIP4.org/JDFSchema_1_1" SenderID="WildeSignsERP" TimeStamp="${now}" Version="1.3">
  <Query ID="Q-${Date.now()}" Type="QueueStatus"/>
</JMF>`;

  try {
    const resp = await fetch(VUTEK_JMF_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/vnd.cip4-jmf+xml' },
      body: jmf,
    });
    const body = await resp.text();
    const statusMatch = body.match(/Status="([^"]+)"/);
    const sizeMatch = body.match(/QueueSize="(\d+)"/);
    return {
      status: statusMatch?.[1] ?? 'Unknown',
      queueSize: sizeMatch ? parseInt(sizeMatch[1], 10) : 0,
      raw: body,
    };
  } catch (err: any) {
    return { status: 'Unreachable', queueSize: 0 };
  }
}
