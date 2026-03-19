import { Router, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db/client.js';
import { NotFoundError, BadRequestError } from '../middleware/error-handler.js';
import { extractWoNumber, sanitizeFolderName, findWoFolder, getOrCreateOrderFolder, FILE_CATEGORIES } from '../lib/folder-utils.js';
import { broadcast } from '../ws/server.js';

export const fileBrowserRouter = Router();

fileBrowserRouter.use(authenticate);

// Configure multer for file uploads (temporary storage)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

// Allowed image extensions for inline viewing
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.tiff', '.tif'];
const DOCUMENT_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv'];
const DESIGN_EXTENSIONS = ['.ai', '.psd', '.eps', '.svg', '.cdr'];

type FileCategory = keyof typeof FILE_CATEGORIES;

interface FileInfo {
  name: string;
  path: string;
  type: 'file' | 'folder';
  extension?: string;
  size?: number;
  modifiedAt?: string;
  isImage: boolean;
  isDocument: boolean;
  isDesign: boolean;
}

/** Compute the effective base path — 4-digit WO numbers use Safari/Port City Signs path */
function getEffectiveBasePath(basePath: string, safariPath: string | null | undefined, woNumber: string): string {
  if (woNumber.length === 4) {
    return safariPath || path.join(basePath, 'Safari');
  }
  return basePath;
}

/**
 * Resolve the network folder for a work order.
 * Priority: WO-level manual override > customer override > dynamic discovery
 */
async function resolveOrderFolder(orderId: string, basePath: string, safariBasePath?: string | null): Promise<{
  found: boolean;
  folderPath: string | null;
  folderName: string | null;
  customerFolder: string | null;
  searchedLocations: string[];
  hasManualOverride: boolean;
  order: { orderNumber: string; customerName: string; networkFolderPath: string | null; description?: string | null } | null;
}> {
  const order = await prisma.workOrder.findUnique({
    where: { id: orderId },
    select: { orderNumber: true, customerName: true, description: true, networkFolderPath: true, customer: { select: { networkDriveFolderPath: true } } },
  });

  if (!order) return { found: false, folderPath: null, folderName: null, customerFolder: null, searchedLocations: [], hasManualOverride: false, order: null };

  const woNumber = extractWoNumber(order.orderNumber);
  // 4-digit WO numbers are Safari/Port City Signs — use Safari base path for auto-discovery
  const effectiveBasePath = getEffectiveBasePath(basePath, safariBasePath, woNumber);

  // Strategy 0: WO-level manual override (highest priority)
  if (order.networkFolderPath) {
    const overridePath = path.isAbsolute(order.networkFolderPath)
      ? order.networkFolderPath
      : path.join(basePath, order.networkFolderPath);
    const exists = fs.existsSync(overridePath);
    return {
      found: exists,
      folderPath: exists ? overridePath : null,
      folderName: path.basename(overridePath),
      customerFolder: path.basename(path.dirname(overridePath)),
      searchedLocations: [`Manual override: ${overridePath}`],
      hasManualOverride: true,
      order,
    };
  }

  // Fall through to customer override > dynamic discovery
  const result = findWoFolder(effectiveBasePath, woNumber, order.customerName, order.customer?.networkDriveFolderPath);
  return { ...result, hasManualOverride: false, order };
}

/**
 * Get files in a work order's network folder
 */
fileBrowserRouter.get('/orders/:orderId/files', async (req: AuthRequest, res: Response) => {
  const { orderId } = req.params;
  const subfolder = req.query.subfolder as string | undefined;

  // Get system settings for network drive config
  const settings = await prisma.systemSettings.findFirst();
  
  if (!settings?.networkDriveBasePath) {
    return res.json({
      success: true,
      data: {
        configured: false,
        message: 'Network drive path not configured. Go to Settings to configure.',
        files: [],
      },
    });
  }

  // Get the order with customer folder override and WO-level override
  const searchResult = await resolveOrderFolder(orderId, settings.networkDriveBasePath, settings.networkDriveSafariPath);
  
  if (!searchResult.order) {
    throw NotFoundError('Order not found');
  }

  const woNumber = extractWoNumber(searchResult.order.orderNumber);

  if (!searchResult.found || !searchResult.folderPath) {
    return res.json({
      success: true,
      data: {
        configured: true,
        folderExists: false,
        folderPath: null,
        woNumber: `WO${woNumber}`,
        customerName: searchResult.order.customerName,
        message: `Could not find folder for WO${woNumber}`,
        searchedLocations: searchResult.searchedLocations,
        files: [],
        hasManualOverride: searchResult.hasManualOverride,
      },
    });
  }

  let folderPath = searchResult.folderPath;
  
  // Add subfolder if specified
  if (subfolder) {
    // Prevent directory traversal attacks with robust path validation
    const resolvedSubfolderPath = path.resolve(folderPath, subfolder);
    if (!resolvedSubfolderPath.startsWith(path.resolve(folderPath))) {
      throw BadRequestError('Invalid subfolder path — directory traversal not allowed');
    }
    folderPath = resolvedSubfolderPath;
  }

  // Check if folder exists (for subfolder navigation)
  if (!fs.existsSync(folderPath)) {
    return res.json({
      success: true,
      data: {
        configured: true,
        folderExists: false,
        folderPath: folderPath,
        message: `Subfolder not found: ${folderPath}`,
        files: [],
      },
    });
  }

  try {
    const items = fs.readdirSync(folderPath, { withFileTypes: true });
    const files: FileInfo[] = [];

    for (const item of items) {
      const itemPath = path.join(folderPath, item.name);
      const relativePath = subfolder ? `${subfolder}/${item.name}` : item.name;
      
      if (item.isDirectory()) {
        files.push({
          name: item.name,
          path: relativePath,
          type: 'folder',
          isImage: false,
          isDocument: false,
          isDesign: false,
        });
      } else {
        const ext = path.extname(item.name).toLowerCase();
        const stats = fs.statSync(itemPath);
        
        files.push({
          name: item.name,
          path: relativePath,
          type: 'file',
          extension: ext,
          size: stats.size,
          modifiedAt: stats.mtime.toISOString(),
          isImage: IMAGE_EXTENSIONS.includes(ext),
          isDocument: DOCUMENT_EXTENSIONS.includes(ext),
          isDesign: DESIGN_EXTENSIONS.includes(ext),
        });
      }
    }

    // Sort: folders first, then files alphabetically
    files.sort((a, b) => {
      if (a.type === 'folder' && b.type !== 'folder') return -1;
      if (a.type !== 'folder' && b.type === 'folder') return 1;
      return a.name.localeCompare(b.name);
    });

    res.json({
      success: true,
      data: {
        configured: true,
        folderExists: true,
        folderPath: folderPath,
        folderName: searchResult.folderName,
        customerFolder: searchResult.customerFolder,
        currentSubfolder: subfolder || null,
        files,
      },
    });
  } catch (error) {
    console.error('Error reading folder:', error);
    res.json({
      success: true,
      data: {
        configured: true,
        folderExists: true,
        folderPath: folderPath,
        folderName: searchResult.folderName,
        customerFolder: searchResult.customerFolder,
        error: `Error reading folder: ${(error as Error).message}`,
        files: [],
      },
    });
  }
});

/**
 * Get file content (for images/documents)
 */
fileBrowserRouter.get('/orders/:orderId/files/content', async (req: AuthRequest, res: Response) => {
  const { orderId } = req.params;
  const filePath = req.query.path as string;

  if (!filePath) {
    throw BadRequestError('File path is required');
  }

  // Get system settings for network drive config
  const settings = await prisma.systemSettings.findFirst();
  
  if (!settings?.networkDriveBasePath) {
    throw BadRequestError('Network drive not configured');
  }

  // Get the order folder (WO override > customer override > dynamic)
  const resolved = await resolveOrderFolder(orderId, settings.networkDriveBasePath, settings.networkDriveSafariPath);
  
  if (!resolved.order) {
    throw NotFoundError('Order not found');
  }

  if (!resolved.found || !resolved.folderPath) {
    throw NotFoundError('Work order folder not found');
  }
  
  const baseFolderPath = resolved.folderPath;
  
  // Prevent directory traversal attacks
  const sanitizedPath = filePath.replace(/\.\./g, '');
  const fullPath = path.join(baseFolderPath, sanitizedPath);

  // Verify the file is within the allowed base path
  const resolvedPath = path.resolve(fullPath);
  const resolvedBase = path.resolve(baseFolderPath);
  
  if (!resolvedPath.startsWith(resolvedBase)) {
    throw BadRequestError('Invalid file path');
  }

  // Check if file exists
  if (!fs.existsSync(fullPath)) {
    throw NotFoundError('File not found');
  }

  // Get file stats and extension
  const ext = path.extname(fullPath).toLowerCase();
  
  // Set content type based on extension
  const contentTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.tiff': 'image/tiff',
    '.tif': 'image/tiff',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
  };

  const contentType = contentTypes[ext] || 'application/octet-stream';
  
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `inline; filename="${path.basename(fullPath)}"`);
  
  // Stream the file
  const fileStream = fs.createReadStream(fullPath);
  fileStream.pipe(res);
});

/**
 * Open file in system default application (returns path for frontend to handle)
 */
fileBrowserRouter.get('/orders/:orderId/files/open-path', async (req: AuthRequest, res: Response) => {
  const { orderId } = req.params;
  const filePath = req.query.path as string;

  if (!filePath) {
    throw BadRequestError('File path is required');
  }

  // Get system settings for network drive config
  const settings = await prisma.systemSettings.findFirst();
  
  if (!settings?.networkDriveBasePath) {
    throw BadRequestError('Network drive not configured');
  }

  // Get the order with customer folder override
  const resolved = await resolveOrderFolder(orderId, settings.networkDriveBasePath, settings.networkDriveSafariPath);

  if (!resolved.order) {
    throw NotFoundError('Order not found');
  }

  if (!resolved.found || !resolved.folderPath) {
    throw NotFoundError('Work order folder not found');
  }
  
  const baseFolderPath = resolved.folderPath;
  
  // Prevent directory traversal attacks
  const sanitizedPath = filePath.replace(/\.\./g, '');
  const fullPath = path.join(baseFolderPath, sanitizedPath);

  // Verify the path is within the allowed base path
  const resolvedPath = path.resolve(fullPath);
  const resolvedBase = path.resolve(baseFolderPath);
  
  if (!resolvedPath.startsWith(resolvedBase)) {
    throw BadRequestError('Invalid file path');
  }

  res.json({
    success: true,
    data: {
      fullPath: resolvedPath,
      exists: fs.existsSync(resolvedPath),
    },
  });
});

/**
 * Get the folder path for an order (for opening in Explorer)
 */
fileBrowserRouter.get('/orders/:orderId/folder-path', async (req: AuthRequest, res: Response) => {
  const { orderId } = req.params;

  // Get system settings for network drive config
  const settings = await prisma.systemSettings.findFirst();
  
  if (!settings?.networkDriveBasePath) {
    return res.json({
      success: true,
      data: {
        configured: false,
      },
    });
  }

  // Get the order folder using centralized resolver
  const resolved = await resolveOrderFolder(orderId, settings.networkDriveBasePath, settings.networkDriveSafariPath);

  if (!resolved.order) {
    throw NotFoundError('Order not found');
  }

  const woNumber = extractWoNumber(resolved.order.orderNumber);

  res.json({
    success: true,
    data: {
      configured: true,
      folderPath: resolved.folderPath,
      folderName: resolved.folderName,
      customerFolder: resolved.customerFolder,
      exists: resolved.found,
      woNumber: `WO${woNumber}`,
      hasManualOverride: resolved.hasManualOverride,
    },
  });
});

/**
 * Get available file categories
 */
fileBrowserRouter.get('/categories', async (_req: AuthRequest, res: Response) => {
  res.json({
    success: true,
    data: Object.entries(FILE_CATEGORIES).map(([key, label]) => ({
      value: key,
      label,
    })),
  });
});

/**
 * Upload a file to the work order's network folder
 * Creates folder structure if it doesn't exist
 */
fileBrowserRouter.post('/orders/:orderId/upload', upload.single('file'), async (req: AuthRequest, res: Response) => {
  const { orderId } = req.params;
  const category = (req.body.category as FileCategory) || 'OTHER';
  const file = req.file;

  if (!file) {
    throw BadRequestError('No file provided');
  }

  // Validate category
  if (!FILE_CATEGORIES[category]) {
    throw BadRequestError(`Invalid category. Valid options: ${Object.keys(FILE_CATEGORIES).join(', ')}`);
  }

  // Get system settings
  const settings = await prisma.systemSettings.findFirst();
  
  if (!settings?.networkDriveBasePath) {
    throw BadRequestError('Network drive not configured');
  }

  // Get the order with description and customer folder override
  const resolved = await resolveOrderFolder(orderId, settings.networkDriveBasePath, settings.networkDriveSafariPath);

  if (!resolved.order) {
    throw NotFoundError('Order not found');
  }

  // First try to find existing folder, then create if needed
  let folderPath: string;
  let folderCreated = false;
  
  if (resolved.found && resolved.folderPath) {
    folderPath = resolved.folderPath;
  } else {
    const woNum = extractWoNumber(resolved.order.orderNumber);
    const effectiveBase = getEffectiveBasePath(settings.networkDriveBasePath!, settings.networkDriveSafariPath, woNum);
    const result = getOrCreateOrderFolder(effectiveBase, resolved.order, true);
    folderPath = result.folderPath;
    folderCreated = result.created;
  }

  // Get the category subfolder
  const categoryFolder = FILE_CATEGORIES[category];
  const categoryPath = path.join(folderPath, categoryFolder);
  
  // Create category folder if it doesn't exist
  if (!fs.existsSync(categoryPath)) {
    fs.mkdirSync(categoryPath, { recursive: true });
  }

  // Generate unique filename (preserve original name but add timestamp if exists)
  let fileName = file.originalname;
  let filePath = path.join(categoryPath, fileName);
  
  if (fs.existsSync(filePath)) {
    const ext = path.extname(fileName);
    const baseName = path.basename(fileName, ext);
    const timestamp = Date.now();
    fileName = `${baseName}_${timestamp}${ext}`;
    filePath = path.join(categoryPath, fileName);
  }

  // Write the file
  fs.writeFileSync(filePath, file.buffer);

  res.json({
    success: true,
    data: {
      fileName,
      filePath: `${categoryFolder}/${fileName}`,
      fullPath: filePath,
      category,
      categoryLabel: categoryFolder,
      folderCreated,
      size: file.size,
    },
  });
});

/**
 * Create folder structure for an order (without uploading a file)
 */
fileBrowserRouter.post('/orders/:orderId/create-folder', async (req: AuthRequest, res: Response) => {
  const { orderId } = req.params;

  // Get system settings
  const settings = await prisma.systemSettings.findFirst();
  
  if (!settings?.networkDriveBasePath) {
    throw BadRequestError('Network drive not configured');
  }

  // Get the order with customer folder override
  const resolved = await resolveOrderFolder(orderId, settings.networkDriveBasePath, settings.networkDriveSafariPath);

  if (!resolved.order) {
    throw NotFoundError('Order not found');
  }

  // Check if folder already exists
  if (resolved.found && resolved.folderPath) {
    return res.json({
      success: true,
      data: {
        folderPath: resolved.folderPath,
        customerFolder: resolved.customerFolder,
        woFolder: resolved.folderName,
        created: false,
        message: 'Folder already exists',
      },
    });
  }

  // Create new standardized folder structure
  const woNum = extractWoNumber(resolved.order.orderNumber);
  const effectiveBase = getEffectiveBasePath(settings.networkDriveBasePath!, settings.networkDriveSafariPath, woNum);
  const result = getOrCreateOrderFolder(effectiveBase, resolved.order, true);

  res.json({
    success: true,
    data: {
      folderPath: result.folderPath,
      customerFolder: result.customerFolder,
      woFolder: result.woFolder,
      created: result.created,
      message: result.created ? 'Folder created successfully' : 'Folder already exists',
    },
  });
});

/**
 * Link a network folder to a work order (manual override)
 */
fileBrowserRouter.put('/orders/:orderId/link-folder', async (req: AuthRequest, res: Response) => {
  const { orderId } = req.params;
  const { folderPath } = req.body;

  if (!folderPath || typeof folderPath !== 'string') {
    throw BadRequestError('folderPath is required');
  }

  const settings = await prisma.systemSettings.findFirst();
  if (!settings?.networkDriveBasePath) {
    throw BadRequestError('Network drive path not configured');
  }

  // Resolve full path — accept relative or absolute
  const fullPath = path.isAbsolute(folderPath)
    ? folderPath
    : path.join(settings.networkDriveBasePath, folderPath);

  // Verify the folder actually exists on disk
  if (!fs.existsSync(fullPath)) {
    throw BadRequestError('Folder does not exist on the network drive', { path: fullPath });
  }

  // Store as relative path when possible (cleaner)
  const normalizedBase = path.resolve(settings.networkDriveBasePath);
  const normalizedFull = path.resolve(fullPath);
  const relativePath = normalizedFull.startsWith(normalizedBase)
    ? path.relative(normalizedBase, normalizedFull)
    : fullPath;

  const order = await prisma.workOrder.update({
    where: { id: orderId },
    data: { networkFolderPath: relativePath },
    select: { id: true, orderNumber: true, networkFolderPath: true },
  });

  broadcast({ type: 'ORDER_UPDATED', payload: { id: order.id, orderNumber: order.orderNumber } });

  res.json({
    success: true,
    data: {
      orderId: order.id,
      networkFolderPath: order.networkFolderPath,
      resolvedPath: fullPath,
    },
  });
});

/**
 * Unlink a manually-linked folder from a work order
 */
fileBrowserRouter.delete('/orders/:orderId/link-folder', async (req: AuthRequest, res: Response) => {
  const { orderId } = req.params;

  const order = await prisma.workOrder.update({
    where: { id: orderId },
    data: { networkFolderPath: null },
    select: { id: true, orderNumber: true },
  });

  broadcast({ type: 'ORDER_UPDATED', payload: { id: order.id, orderNumber: order.orderNumber } });

  res.json({ success: true, data: { orderId: order.id, message: 'Folder unlinked' } });
});

/**
 * Browse folders on the network drive (for folder picker UI)
 */
fileBrowserRouter.get('/browse-folders', async (req: AuthRequest, res: Response) => {
  const relativePath = (req.query.path as string) || '';

  const settings = await prisma.systemSettings.findFirst();
  if (!settings?.networkDriveBasePath) {
    throw BadRequestError('Network drive path not configured');
  }

  const basePath = path.resolve(settings.networkDriveBasePath);
  const targetPath = relativePath
    ? path.resolve(path.join(basePath, relativePath))
    : basePath;

  // Security: prevent path traversal outside the base path
  if (!targetPath.startsWith(basePath)) {
    throw BadRequestError('Invalid path: outside network drive');
  }

  if (!fs.existsSync(targetPath)) {
    throw BadRequestError('Path does not exist');
  }

  const entries = fs.readdirSync(targetPath, { withFileTypes: true });
  const folders = entries
    .filter(e => e.isDirectory() && !e.name.startsWith('.'))
    .map(e => ({
      name: e.name,
      path: path.relative(basePath, path.join(targetPath, e.name)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  res.json({
    success: true,
    data: {
      currentPath: path.relative(basePath, targetPath) || '',
      parentPath: relativePath ? path.relative(basePath, path.dirname(targetPath)) || null : null,
      folders,
    },
  });
});
