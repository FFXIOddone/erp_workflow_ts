/**
 * Batch Import Routes
 *
 * CSV/Excel import functionality for bulk data import:
 * - Customer imports
 * - Inventory item imports
 * - Work order imports
 *
 * Supports column mapping, validation preview, and batch processing
 */

import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';
import { AuthRequest, authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/auth.js';
import { prisma } from '../db/client.js';
import { broadcast } from '../ws/server.js';
import { buildRouteBroadcastPayload } from '../lib/route-broadcast.js';
import { logActivity, ActivityAction, EntityType } from '../lib/activity-logger.js';
import { buildRouteActivityPayload } from '../lib/route-activity.js';
import { BadRequestError, NotFoundError } from '../middleware/error-handler.js';
import { UserRole } from '@erp/shared';
import { OrderStatus, InventoryStatus } from '@prisma/client';

export const batchImportRouter = Router();

// ============================================================================
// TYPES & SCHEMAS
// ============================================================================

// Import entity types
type ImportEntityType = 'customer' | 'inventory' | 'workorder';

// Import status enum
type ImportStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

// Column mapping for each entity type
interface ColumnMapping {
  sourceColumn: string;
  targetField: string;
  required: boolean;
  transform?: string; // 'trim' | 'uppercase' | 'lowercase' | 'number' | 'date' | 'boolean'
}

// Import job record (stored in memory for now, could be persisted)
interface ImportJob {
  id: string;
  entityType: ImportEntityType;
  fileName: string;
  filePath: string;
  status: ImportStatus;
  columnMappings: ColumnMapping[];
  totalRows: number;
  processedRows: number;
  successCount: number;
  errorCount: number;
  errors: ImportError[];
  createdById: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  preview?: ParsedRow[];
}

interface ImportError {
  row: number;
  field?: string;
  message: string;
  value?: string;
}

interface ParsedRow {
  rowNumber: number;
  data: Record<string, unknown>;
  errors: ImportError[];
  isValid: boolean;
}

// In-memory job storage (in production, use Redis or database)
const importJobs = new Map<string, ImportJob>();

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const ColumnMappingSchema = z.object({
  sourceColumn: z.string().min(1),
  targetField: z.string().min(1),
  required: z.boolean().default(false),
  transform: z.enum(['trim', 'uppercase', 'lowercase', 'number', 'date', 'boolean']).optional(),
});

const StartImportSchema = z.object({
  columnMappings: z.array(ColumnMappingSchema).min(1),
  skipHeader: z.boolean().default(true),
  dryRun: z.boolean().default(false), // Validate only, don't persist
  updateExisting: z.boolean().default(false), // Update if exists by key field
  batchSize: z.number().min(1).max(1000).default(100),
});

const ImportOptionsSchema = z.object({
  delimiter: z.string().default(','),
  encoding: z.enum(['utf-8', 'utf-16le', 'latin1']).default('utf-8'),
  skipEmptyRows: z.boolean().default(true),
  maxRows: z.number().min(1).max(50000).optional(), // Limit for safety
});

// ============================================================================
// FIELD DEFINITIONS
// ============================================================================

// Available fields for each entity type
const ENTITY_FIELDS: Record<ImportEntityType, { field: string; label: string; type: string; required: boolean }[]> = {
  customer: [
    { field: 'name', label: 'Customer Name', type: 'string', required: true },
    { field: 'companyName', label: 'Company Name', type: 'string', required: false },
    { field: 'email', label: 'Email', type: 'string', required: false },
    { field: 'phone', label: 'Phone', type: 'string', required: false },
    { field: 'address', label: 'Address', type: 'string', required: false },
    { field: 'city', label: 'City', type: 'string', required: false },
    { field: 'state', label: 'State', type: 'string', required: false },
    { field: 'zipCode', label: 'Zip Code', type: 'string', required: false },
    { field: 'country', label: 'Country', type: 'string', required: false },
    { field: 'notes', label: 'Notes', type: 'string', required: false },
    { field: 'taxExempt', label: 'Tax Exempt', type: 'boolean', required: false },
    { field: 'creditLimit', label: 'Credit Limit', type: 'number', required: false },
    { field: 'paymentTerms', label: 'Payment Terms', type: 'string', required: false },
    { field: 'tags', label: 'Tags (comma-separated)', type: 'array', required: false },
  ],
  inventory: [
    { field: 'sku', label: 'SKU', type: 'string', required: true },
    { field: 'name', label: 'Item Name', type: 'string', required: true },
    { field: 'description', label: 'Description', type: 'string', required: false },
    { field: 'category', label: 'Category', type: 'string', required: false },
    { field: 'unitPrice', label: 'Unit Price', type: 'number', required: true },
    { field: 'costPrice', label: 'Cost Price', type: 'number', required: false },
    { field: 'quantity', label: 'Initial Quantity', type: 'number', required: false },
    { field: 'location', label: 'Location', type: 'string', required: false },
    { field: 'isActive', label: 'Is Active', type: 'boolean', required: false },
  ],
  workorder: [
    { field: 'orderNumber', label: 'Order Number', type: 'string', required: false }, // Auto-generated if not provided
    { field: 'customerName', label: 'Customer Name', type: 'string', required: true },
    { field: 'description', label: 'Description', type: 'string', required: true },
    { field: 'priority', label: 'Priority (1-5)', type: 'number', required: false },
    { field: 'dueDate', label: 'Due Date', type: 'date', required: false },
    { field: 'notes', label: 'Notes', type: 'string', required: false },
    { field: 'status', label: 'Status', type: 'enum', required: false },
    { field: 'customerId', label: 'Customer ID (UUID)', type: 'string', required: false },
  ],
};

// Required fields for validation
const REQUIRED_FIELDS: Record<ImportEntityType, string[]> = {
  customer: ['name'],
  inventory: ['sku', 'name', 'unitPrice'],
  workorder: ['customerName', 'description'],
};

// Key fields for update matching
const KEY_FIELDS: Record<ImportEntityType, string> = {
  customer: 'email', // Match by email for updates
  inventory: 'sku', // Match by SKU for updates
  workorder: 'orderNumber', // Match by order number for updates
};

// ============================================================================
// MULTER CONFIGURATION FOR CSV UPLOADS
// ============================================================================

const IMPORT_DIR = process.env.IMPORT_DIR || path.join(process.cwd(), 'uploads', 'imports');

// Ensure import directory exists
if (!fs.existsSync(IMPORT_DIR)) {
  fs.mkdirSync(IMPORT_DIR, { recursive: true });
}

const importStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, IMPORT_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `import-${uniqueSuffix}${ext}`);
  },
});

const importFileFilter = (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = [
    'text/csv',
    'text/plain',
    'application/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ];

  const allowedExtensions = ['.csv', '.txt', '.xlsx', '.xls'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedMimes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only CSV, TXT, and Excel files are allowed for import'));
  }
};

const importUpload = multer({
  storage: importStorage,
  fileFilter: importFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max for imports
  },
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parse CSV content into rows
 */
function parseCSV(content: string, delimiter = ',', skipEmptyRows = true): string[][] {
  const rows: string[][] = [];
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    if (skipEmptyRows && line.trim() === '') continue;

    const row: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"' && !inQuotes) {
        inQuotes = true;
      } else if (char === '"' && inQuotes) {
        if (nextChar === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = false;
        }
      } else if (char === delimiter && !inQuotes) {
        row.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    row.push(current.trim());
    rows.push(row);
  }

  return rows;
}

/**
 * Transform value based on transform type
 */
function transformValue(value: string, transform?: string): unknown {
  if (!transform) return value;

  switch (transform) {
    case 'trim':
      return value.trim();
    case 'uppercase':
      return value.toUpperCase();
    case 'lowercase':
      return value.toLowerCase();
    case 'number': {
      const num = parseFloat(value.replace(/[,$]/g, ''));
      return isNaN(num) ? null : num;
    }
    case 'date': {
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : date;
    }
    case 'boolean': {
      const lower = value.toLowerCase();
      return ['true', 'yes', '1', 'y'].includes(lower);
    }
    default:
      return value;
  }
}

/**
 * Validate a row against entity field requirements
 */
function validateRow(
  rowData: Record<string, unknown>,
  entityType: ImportEntityType,
  rowNumber: number
): ImportError[] {
  const errors: ImportError[] = [];
  const requiredFields = REQUIRED_FIELDS[entityType];

  for (const field of requiredFields) {
    const value = rowData[field];
    if (value === undefined || value === null || value === '') {
      errors.push({
        row: rowNumber,
        field,
        message: `Required field "${field}" is missing or empty`,
      });
    }
  }

  // Entity-specific validation
  if (entityType === 'customer') {
    if (rowData.email && typeof rowData.email === 'string') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(rowData.email)) {
        errors.push({
          row: rowNumber,
          field: 'email',
          message: 'Invalid email format',
          value: String(rowData.email),
        });
      }
    }
    if (rowData.creditLimit !== undefined && rowData.creditLimit !== null) {
      const limit = Number(rowData.creditLimit);
      if (isNaN(limit) || limit < 0) {
        errors.push({
          row: rowNumber,
          field: 'creditLimit',
          message: 'Credit limit must be a positive number',
          value: String(rowData.creditLimit),
        });
      }
    }
  }

  if (entityType === 'inventory') {
    const unitPrice = Number(rowData.unitPrice);
    if (isNaN(unitPrice) || unitPrice < 0) {
      errors.push({
        row: rowNumber,
        field: 'unitPrice',
        message: 'Unit price must be a positive number',
        value: String(rowData.unitPrice),
      });
    }
  }

  if (entityType === 'workorder') {
    if (rowData.priority !== undefined && rowData.priority !== null) {
      const priority = Number(rowData.priority);
      if (isNaN(priority) || priority < 1 || priority > 5) {
        errors.push({
          row: rowNumber,
          field: 'priority',
          message: 'Priority must be between 1 and 5',
          value: String(rowData.priority),
        });
      }
    }
    if (rowData.status && typeof rowData.status === 'string') {
      const validStatuses = Object.values(OrderStatus);
      if (!validStatuses.includes(rowData.status as OrderStatus)) {
        errors.push({
          row: rowNumber,
          field: 'status',
          message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
          value: String(rowData.status),
        });
      }
    }
  }

  return errors;
}

/**
 * Generate unique import job ID
 */
function generateJobId(): string {
  return `import-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate order number
 */
async function generateOrderNumber(): Promise<string> {
  const lastOrder = await prisma.workOrder.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { orderNumber: true },
  });

  if (!lastOrder) {
    return 'WO-000001';
  }

  const match = lastOrder.orderNumber.match(/WO-(\d+)/);
  if (!match) {
    return `WO-${Date.now().toString().slice(-6)}`;
  }

  const nextNum = parseInt(match[1], 10) + 1;
  return `WO-${nextNum.toString().padStart(6, '0')}`;
}

// ============================================================================
// ROUTES
// ============================================================================

// All routes require authentication
batchImportRouter.use(authenticate);

// Only managers and admins can use import functionality
batchImportRouter.use(requireRole(UserRole.ADMIN, UserRole.MANAGER));

// --------------------------------------------------------------------------
// GET /batch-import/fields/:entityType - Get available fields for mapping
// --------------------------------------------------------------------------
batchImportRouter.get('/fields/:entityType', async (req: AuthRequest, res: Response) => {
  const entityType = req.params.entityType as ImportEntityType;

  if (!['customer', 'inventory', 'workorder'].includes(entityType)) {
    throw BadRequestError('Invalid entity type. Must be: customer, inventory, or workorder');
  }

  const fields = ENTITY_FIELDS[entityType];
  const requiredFields = REQUIRED_FIELDS[entityType];
  const keyField = KEY_FIELDS[entityType];

  res.json({
    success: true,
    data: {
      entityType,
      fields,
      requiredFields,
      keyField,
      transforms: ['trim', 'uppercase', 'lowercase', 'number', 'date', 'boolean'],
    },
  });
});

// --------------------------------------------------------------------------
// POST /batch-import/upload/:entityType - Upload file and create import job
// --------------------------------------------------------------------------
batchImportRouter.post(
  '/upload/:entityType',
  importUpload.single('file'),
  async (req: AuthRequest, res: Response) => {
    const userId = req.userId!;
    const entityType = req.params.entityType as ImportEntityType;

    if (!['customer', 'inventory', 'workorder'].includes(entityType)) {
      throw BadRequestError('Invalid entity type. Must be: customer, inventory, or workorder');
    }

    if (!req.file) {
      throw BadRequestError('No file uploaded');
    }

    const options = ImportOptionsSchema.parse(req.body);

    // Read and parse file to get headers
    const content = fs.readFileSync(req.file.path, options.encoding);
    const rows = parseCSV(content, options.delimiter, options.skipEmptyRows);

    if (rows.length === 0) {
      fs.unlinkSync(req.file.path);
      throw BadRequestError('File is empty or contains no valid data');
    }

    const headers = rows[0];
    const dataRowCount = rows.length - 1; // Minus header row

    if (options.maxRows && dataRowCount > options.maxRows) {
      fs.unlinkSync(req.file.path);
      throw BadRequestError(`File exceeds maximum row limit of ${options.maxRows}`);
    }

    // Create import job
    const jobId = generateJobId();
    const job: ImportJob = {
      id: jobId,
      entityType,
      fileName: req.file.originalname,
      filePath: req.file.path,
      status: 'pending',
      columnMappings: [],
      totalRows: dataRowCount,
      processedRows: 0,
      successCount: 0,
      errorCount: 0,
      errors: [],
      createdById: userId,
      createdAt: new Date(),
    };

    importJobs.set(jobId, job);

    // Log activity
    await logActivity(
      buildRouteActivityPayload({
        action: ActivityAction.CREATE,
        entityType: EntityType.OTHER,
        entityId: jobId,
        entityName: req.file.originalname,
        description: `Created ${entityType} import job from file: ${req.file.originalname}`,
        userId,
        req,
      }),
    );

    res.json({
      success: true,
      data: {
        jobId,
        fileName: req.file.originalname,
        entityType,
        headers,
        totalRows: dataRowCount,
        availableFields: ENTITY_FIELDS[entityType],
        requiredFields: REQUIRED_FIELDS[entityType],
      },
    });
  }
);

// --------------------------------------------------------------------------
// POST /batch-import/:jobId/preview - Preview parsed data with column mappings
// --------------------------------------------------------------------------
batchImportRouter.post('/:jobId/preview', async (req: AuthRequest, res: Response) => {
  const jobId = req.params.jobId;
  const job = importJobs.get(jobId);

  if (!job) {
    throw NotFoundError('Import job not found');
  }

  if (job.status !== 'pending') {
    throw BadRequestError('Cannot preview job that has already been processed');
  }

  const body = StartImportSchema.parse(req.body);
  const previewLimit = 10; // Show first 10 rows

  // Read file
  const content = fs.readFileSync(job.filePath, 'utf-8');
  const rows = parseCSV(content);
  const headers = rows[0];
  const dataRows = rows.slice(body.skipHeader ? 1 : 0);

  // Build column index map
  const columnIndexMap = new Map<string, number>();
  headers.forEach((header, index) => {
    columnIndexMap.set(header.trim().toLowerCase(), index);
  });

  // Parse and validate preview rows
  const preview: ParsedRow[] = [];

  for (let i = 0; i < Math.min(dataRows.length, previewLimit); i++) {
    const row = dataRows[i];
    const rowNumber = body.skipHeader ? i + 2 : i + 1;
    const rowData: Record<string, unknown> = {};

    // Apply column mappings
    for (const mapping of body.columnMappings) {
      const sourceIndex = columnIndexMap.get(mapping.sourceColumn.trim().toLowerCase());
      if (sourceIndex !== undefined && sourceIndex < row.length) {
        const rawValue = row[sourceIndex];
        rowData[mapping.targetField] = transformValue(rawValue, mapping.transform);
      }
    }

    // Validate
    const errors = validateRow(rowData, job.entityType, rowNumber);

    preview.push({
      rowNumber,
      data: rowData,
      errors,
      isValid: errors.length === 0,
    });
  }

  // Store preview and mappings
  job.preview = preview;
  job.columnMappings = body.columnMappings;

  const validCount = preview.filter((p) => p.isValid).length;
  const errorCount = preview.filter((p) => !p.isValid).length;

  res.json({
    success: true,
    data: {
      jobId,
      previewRows: preview,
      validCount,
      errorCount,
      totalRows: job.totalRows,
      columnMappings: body.columnMappings,
    },
  });
});

// --------------------------------------------------------------------------
// POST /batch-import/:jobId/start - Start processing the import
// --------------------------------------------------------------------------
batchImportRouter.post('/:jobId/start', async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const jobId = req.params.jobId;
  const job = importJobs.get(jobId);

  if (!job) {
    throw NotFoundError('Import job not found');
  }

  if (job.status !== 'pending') {
    throw BadRequestError('Import job has already been started or completed');
  }

  const body = StartImportSchema.parse(req.body);

  // Update job with final mappings
  job.columnMappings = body.columnMappings;
  job.status = 'processing';
  job.startedAt = new Date();

  // Read file
  const content = fs.readFileSync(job.filePath, 'utf-8');
  const rows = parseCSV(content);
  const headers = rows[0];
  const dataRows = rows.slice(body.skipHeader ? 1 : 0);

  // Build column index map
  const columnIndexMap = new Map<string, number>();
  headers.forEach((header, index) => {
    columnIndexMap.set(header.trim().toLowerCase(), index);
  });

  // Process in batches
  const keyField = KEY_FIELDS[job.entityType];

  for (let i = 0; i < dataRows.length; i += body.batchSize) {
    const batch = dataRows.slice(i, i + body.batchSize);

    for (let j = 0; j < batch.length; j++) {
      const row = batch[j];
      const rowNumber = body.skipHeader ? i + j + 2 : i + j + 1;
      const rowData: Record<string, unknown> = {};

      // Apply column mappings
      for (const mapping of job.columnMappings) {
        const sourceIndex = columnIndexMap.get(mapping.sourceColumn.trim().toLowerCase());
        if (sourceIndex !== undefined && sourceIndex < row.length) {
          const rawValue = row[sourceIndex];
          rowData[mapping.targetField] = transformValue(rawValue, mapping.transform);
        }
      }

      // Validate
      const errors = validateRow(rowData, job.entityType, rowNumber);

      if (errors.length > 0) {
        job.errors.push(...errors);
        job.errorCount++;
        job.processedRows++;
        continue;
      }

      // Skip actual persistence in dry run mode
      if (body.dryRun) {
        job.successCount++;
        job.processedRows++;
        continue;
      }

      // Process row based on entity type
      try {
        switch (job.entityType) {
          case 'customer':
            await processCustomerRow(rowData, body.updateExisting, keyField, userId);
            break;
          case 'inventory':
            await processInventoryRow(rowData, body.updateExisting, keyField, userId);
            break;
          case 'workorder':
            await processWorkOrderRow(rowData, body.updateExisting, keyField, userId);
            break;
        }
        job.successCount++;
      } catch (error) {
        job.errors.push({
          row: rowNumber,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
        job.errorCount++;
      }

      job.processedRows++;
    }
  }

  // Complete job
  job.status = job.errorCount > 0 && job.successCount === 0 ? 'failed' : 'completed';
  job.completedAt = new Date();

  // Cleanup file
  try {
    fs.unlinkSync(job.filePath);
  } catch {
    // Ignore cleanup errors
  }

  // Log activity
  await logActivity(
    buildRouteActivityPayload({
      action: ActivityAction.CREATE,
      entityType: EntityType.OTHER,
      entityId: jobId,
      entityName: job.fileName,
      description: `Completed ${job.entityType} import: ${job.successCount} success, ${job.errorCount} errors`,
      userId,
      req,
    }),
  );

  // Broadcast import completion
  broadcast(buildRouteBroadcastPayload({
    type: 'IMPORT_COMPLETED',
    payload: {
      jobId,
      entityType: job.entityType,
      successCount: job.successCount,
      errorCount: job.errorCount,
    },
  }));

  res.json({
    success: true,
    data: {
      jobId,
      status: job.status,
      totalRows: job.totalRows,
      processedRows: job.processedRows,
      successCount: job.successCount,
      errorCount: job.errorCount,
      errors: job.errors.slice(0, 100), // Limit errors in response
      dryRun: body.dryRun,
      duration: job.completedAt!.getTime() - job.startedAt!.getTime(),
    },
  });
});

// --------------------------------------------------------------------------
// GET /batch-import/:jobId - Get import job status
// --------------------------------------------------------------------------
batchImportRouter.get('/:jobId', async (req: AuthRequest, res: Response) => {
  const jobId = req.params.jobId;
  const job = importJobs.get(jobId);

  if (!job) {
    throw NotFoundError('Import job not found');
  }

  res.json({
    success: true,
    data: {
      id: job.id,
      entityType: job.entityType,
      fileName: job.fileName,
      status: job.status,
      totalRows: job.totalRows,
      processedRows: job.processedRows,
      successCount: job.successCount,
      errorCount: job.errorCount,
      errors: job.errors.slice(0, 100),
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
    },
  });
});

// --------------------------------------------------------------------------
// DELETE /batch-import/:jobId - Cancel import job
// --------------------------------------------------------------------------
batchImportRouter.delete('/:jobId', async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const jobId = req.params.jobId;
  const job = importJobs.get(jobId);

  if (!job) {
    throw NotFoundError('Import job not found');
  }

  if (job.status === 'processing') {
    throw BadRequestError('Cannot cancel job that is currently processing');
  }

  // Cleanup file if still exists
  if (fs.existsSync(job.filePath)) {
    try {
      fs.unlinkSync(job.filePath);
    } catch {
      // Ignore cleanup errors
    }
  }

  // Update status and remove from active jobs
  job.status = 'cancelled';
  importJobs.delete(jobId);

  await logActivity(
    buildRouteActivityPayload({
      action: ActivityAction.DELETE,
      entityType: EntityType.OTHER,
      entityId: jobId,
      entityName: job.fileName,
      description: `Cancelled ${job.entityType} import job`,
      userId,
      req,
    }),
  );

  res.json({
    success: true,
    message: 'Import job cancelled',
  });
});

// --------------------------------------------------------------------------
// GET /batch-import - List recent import jobs
// --------------------------------------------------------------------------
batchImportRouter.get('/', async (_req: AuthRequest, res: Response) => {
  const jobs = Array.from(importJobs.values())
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 50)
    .map((job) => ({
      id: job.id,
      entityType: job.entityType,
      fileName: job.fileName,
      status: job.status,
      totalRows: job.totalRows,
      successCount: job.successCount,
      errorCount: job.errorCount,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
    }));

  res.json({
    success: true,
    data: jobs,
  });
});

// --------------------------------------------------------------------------
// POST /batch-import/template/:entityType - Generate sample CSV template
// --------------------------------------------------------------------------
batchImportRouter.post('/template/:entityType', async (req: AuthRequest, res: Response) => {
  const entityType = req.params.entityType as ImportEntityType;

  if (!['customer', 'inventory', 'workorder'].includes(entityType)) {
    throw BadRequestError('Invalid entity type. Must be: customer, inventory, or workorder');
  }

  const fields = ENTITY_FIELDS[entityType];
  const headers = fields.map((f) => f.label);
  const sampleData = generateSampleData(entityType);

  // Build CSV content
  const csvLines: string[] = [headers.join(',')];

  for (const row of sampleData) {
    const values = fields.map((f) => {
      const value = row[f.field];
      if (value === undefined || value === null) return '';
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return String(value);
    });
    csvLines.push(values.join(','));
  }

  const csvContent = csvLines.join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${entityType}-import-template.csv"`);
  res.send(csvContent);
});

// ============================================================================
// ROW PROCESSORS
// ============================================================================

async function processCustomerRow(
  rowData: Record<string, unknown>,
  updateExisting: boolean,
  keyField: string,
  userId: string
): Promise<void> {
  const name = String(rowData.name || '');
  const email = rowData.email ? String(rowData.email) : undefined;

  // Check for existing by email if updating
  if (updateExisting && email) {
    const existing = await prisma.customer.findFirst({
      where: { email },
    });

    if (existing) {
      await prisma.customer.update({
        where: { id: existing.id },
        data: {
          name,
          companyName: rowData.companyName ? String(rowData.companyName) : undefined,
          phone: rowData.phone ? String(rowData.phone) : undefined,
          address: rowData.address ? String(rowData.address) : undefined,
          city: rowData.city ? String(rowData.city) : undefined,
          state: rowData.state ? String(rowData.state) : undefined,
          zipCode: rowData.zipCode ? String(rowData.zipCode) : undefined,
          country: rowData.country ? String(rowData.country) : undefined,
          notes: rowData.notes ? String(rowData.notes) : undefined,
          taxExempt: rowData.taxExempt === true,
          creditLimit: rowData.creditLimit ? Number(rowData.creditLimit) : undefined,
          paymentTerms: rowData.paymentTerms ? String(rowData.paymentTerms) : undefined,
          tags: rowData.tags ? String(rowData.tags).split(',').map((t) => t.trim()) : undefined,
        },
      });
      return;
    }
  }

  // Create new customer
  await prisma.customer.create({
    data: {
      name,
      companyName: rowData.companyName ? String(rowData.companyName) : null,
      email: email || null,
      phone: rowData.phone ? String(rowData.phone) : null,
      address: rowData.address ? String(rowData.address) : null,
      city: rowData.city ? String(rowData.city) : null,
      state: rowData.state ? String(rowData.state) : null,
      zipCode: rowData.zipCode ? String(rowData.zipCode) : null,
      country: rowData.country ? String(rowData.country) : 'USA',
      notes: rowData.notes ? String(rowData.notes) : null,
      taxExempt: rowData.taxExempt === true,
      creditLimit: rowData.creditLimit ? Number(rowData.creditLimit) : null,
      paymentTerms: rowData.paymentTerms ? String(rowData.paymentTerms) : null,
      tags: rowData.tags ? String(rowData.tags).split(',').map((t) => t.trim()) : [],
    },
  });
}

async function processInventoryRow(
  rowData: Record<string, unknown>,
  updateExisting: boolean,
  keyField: string,
  userId: string
): Promise<void> {
  const sku = String(rowData.sku || '');
  const name = String(rowData.name || '');
  const unitPrice = Number(rowData.unitPrice || 0);

  // Check for existing by SKU
  const existing = await prisma.itemMaster.findFirst({
    where: { sku },
  });

  if (existing && updateExisting) {
    // Update ItemMaster
    await prisma.itemMaster.update({
      where: { id: existing.id },
      data: {
        name,
        description: rowData.description ? String(rowData.description) : undefined,
        category: rowData.category ? String(rowData.category) : undefined,
        unitPrice,
        costPrice: rowData.costPrice ? Number(rowData.costPrice) : undefined,
        isActive: rowData.isActive !== false,
      },
    });
    return;
  }

  if (existing && !updateExisting) {
    throw new Error(`SKU "${sku}" already exists`);
  }

  // Create new ItemMaster
  const itemMaster = await prisma.itemMaster.create({
    data: {
      sku,
      name,
      description: rowData.description ? String(rowData.description) : null,
      category: rowData.category ? String(rowData.category) : null,
      unitPrice,
      costPrice: rowData.costPrice ? Number(rowData.costPrice) : null,
      isActive: rowData.isActive !== false,
    },
  });

  // Create initial inventory if quantity provided
  if (rowData.quantity && Number(rowData.quantity) > 0) {
    await prisma.inventoryItem.create({
      data: {
        itemMasterId: itemMaster.id,
        quantity: Number(rowData.quantity),
        location: rowData.location ? String(rowData.location) : null,
        status: InventoryStatus.AVAILABLE,
      },
    });
  }
}

async function processWorkOrderRow(
  rowData: Record<string, unknown>,
  updateExisting: boolean,
  keyField: string,
  userId: string
): Promise<void> {
  const customerName = String(rowData.customerName || '');
  const description = String(rowData.description || '');

  // Generate or use provided order number
  let orderNumber = rowData.orderNumber ? String(rowData.orderNumber) : await generateOrderNumber();

  // Check for existing by order number
  if (rowData.orderNumber) {
    const existing = await prisma.workOrder.findFirst({
      where: { orderNumber },
    });

    if (existing && updateExisting) {
      await prisma.workOrder.update({
        where: { id: existing.id },
        data: {
          customerName,
          description,
          priority: rowData.priority ? Number(rowData.priority) : undefined,
          dueDate: rowData.dueDate as Date | undefined,
          notes: rowData.notes ? String(rowData.notes) : undefined,
          status: rowData.status ? (rowData.status as OrderStatus) : undefined,
        },
      });
      return;
    }

    if (existing && !updateExisting) {
      throw new Error(`Order number "${orderNumber}" already exists`);
    }
  }

  // Look up customer if customerId not provided but customerName is
  let customerId = rowData.customerId ? String(rowData.customerId) : null;
  if (!customerId && customerName) {
    const customer = await prisma.customer.findFirst({
      where: {
        OR: [{ name: customerName }, { companyName: customerName }],
      },
      select: { id: true },
    });
    if (customer) {
      customerId = customer.id;
    }
  }

  // Create work order
  await prisma.workOrder.create({
    data: {
      orderNumber,
      customerName,
      description,
      priority: rowData.priority ? Number(rowData.priority) : 3,
      dueDate: rowData.dueDate as Date | undefined,
      notes: rowData.notes ? String(rowData.notes) : null,
      status: rowData.status ? (rowData.status as OrderStatus) : OrderStatus.PENDING,
      createdById: userId,
      customerId,
      isTempOrder: true,
      routing: [],
    },
  });
}

// ============================================================================
// SAMPLE DATA GENERATOR
// ============================================================================

function generateSampleData(entityType: ImportEntityType): Record<string, unknown>[] {
  switch (entityType) {
    case 'customer':
      return [
        {
          name: 'John Smith',
          companyName: 'ABC Company',
          email: 'john@abccompany.com',
          phone: '555-123-4567',
          address: '123 Main St',
          city: 'Springfield',
          state: 'IL',
          zipCode: '62701',
          country: 'USA',
          notes: 'Preferred customer',
          taxExempt: false,
          creditLimit: 10000,
          paymentTerms: 'Net 30',
          tags: 'retail, priority',
        },
        {
          name: 'Jane Doe',
          companyName: 'XYZ Corp',
          email: 'jane@xyzcorp.com',
          phone: '555-987-6543',
          address: '456 Oak Ave',
          city: 'Chicago',
          state: 'IL',
          zipCode: '60601',
          country: 'USA',
          notes: '',
          taxExempt: true,
          creditLimit: 25000,
          paymentTerms: 'Net 60',
          tags: 'wholesale',
        },
      ];

    case 'inventory':
      return [
        {
          sku: 'VINYL-3M-WHT',
          name: '3M White Vinyl - 54"',
          description: 'Premium cast vinyl for outdoor signage',
          category: 'Vinyl',
          unitPrice: 2.5,
          costPrice: 1.25,
          quantity: 100,
          location: 'Warehouse A, Shelf 1',
          isActive: true,
        },
        {
          sku: 'INK-ECO-BLK',
          name: 'Eco Solvent Black Ink - 1L',
          description: 'Eco solvent ink for wide format printers',
          category: 'Ink',
          unitPrice: 85.0,
          costPrice: 42.0,
          quantity: 24,
          location: 'Warehouse A, Shelf 3',
          isActive: true,
        },
      ];

    case 'workorder':
      return [
        {
          orderNumber: '',
          customerName: 'ABC Company',
          description: 'Vehicle wrap for company fleet - 3 vans',
          priority: 2,
          dueDate: '2024-02-15',
          notes: 'Use customer-provided design files',
          status: 'PENDING',
        },
        {
          orderNumber: '',
          customerName: 'XYZ Corp',
          description: 'Outdoor banner - 3x6 ft',
          priority: 3,
          dueDate: '2024-02-10',
          notes: 'Double-sided, grommets on all corners',
          status: 'PENDING',
        },
      ];

    default:
      return [];
  }
}

export default batchImportRouter;
