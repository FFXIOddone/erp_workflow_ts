import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { buildThriveJobTicketName } from './thrive.js';

export interface CopyThriveFileToHotfolderParams {
  sourceFilePath: string;
  hotfolderPath: string;
  workOrderNumber?: string | null;
  customerName?: string | null;
  jobDescription?: string | null;
}

export interface CopyThriveFileToHotfolderResult {
  success: boolean;
  destinationPath?: string;
  stagedPath?: string;
  ticketName?: string;
  error?: string;
}

async function validateSourceFile(filePath: string): Promise<{
  valid: boolean;
  size?: number;
  error?: string;
}> {
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) {
      return { valid: false, error: 'Path is not a file' };
    }
    return { valid: true, size: stat.size };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { valid: false, error: `Cannot access file: ${message}` };
  }
}

async function resolveUniqueDestinationPath(filePath: string): Promise<string> {
  try {
    await fs.access(filePath);
    const ext = path.extname(filePath);
    const base = path.basename(filePath, ext);
    return path.join(path.dirname(filePath), `${base}_${Date.now()}${ext}`);
  } catch {
    return filePath;
  }
}

/**
 * Thrive-only upload flow.
 * Stage the file in a temp directory with a ticket-style name, copy it into the
 * Thrive hotfolder, and clean up the temp files once the copy completes.
 */
export async function copyThriveFileToHotfolder(
  params: CopyThriveFileToHotfolderParams,
): Promise<CopyThriveFileToHotfolderResult> {
  const { sourceFilePath, hotfolderPath, workOrderNumber, customerName, jobDescription } = params;

  const validation = await validateSourceFile(sourceFilePath);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  try {
    await fs.access(hotfolderPath);
  } catch {
    return { success: false, error: `Hotfolder not accessible: ${hotfolderPath}` };
  }

  const ticketName = buildThriveJobTicketName({
    workOrderNumber,
    customerName,
    sourceFileName: sourceFilePath,
    jobDescription,
  });

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'erp-thrive-'));
  const stagedPath = path.join(tempDir, ticketName);
  const stagedDestination = path.join(hotfolderPath, ticketName);

  try {
    await fs.copyFile(sourceFilePath, stagedPath);

    const destinationPath = await resolveUniqueDestinationPath(stagedDestination);
    await fs.copyFile(stagedPath, destinationPath);

    return {
      success: true,
      destinationPath,
      stagedPath,
      ticketName,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: `Thrive upload failed: ${message}` };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}
