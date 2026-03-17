/**
 * Exports Router - API-009
 * 
 * Centralized export endpoints for CSV/Excel export of major entities.
 * Supports work orders, customers, inventory, quotes, purchase orders,
 * and various reports.
 * 
 * Created by: AGENT-01
 * Date: 2026-01-29
 */

import { Router, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth.js';
import { BadRequestError } from '../middleware/error-handler.js';
import { UserRole, OrderStatus, QuoteStatus } from '@erp/shared';
import { Decimal } from '@prisma/client/runtime/library';
import { InventoryStatus } from '@prisma/client';

export const exportsRouter = Router();

// All routes require authentication
exportsRouter.use(authenticate);

// =============================================================================
// SHARED UTILITIES
// =============================================================================

/**
 * Convert a value to a CSV-safe string
 */
function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    if (value instanceof Decimal) return value.toString();
    return JSON.stringify(value);
  }
  const str = String(value);
  // Escape quotes and wrap in quotes if contains comma, quote, or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Convert array of objects to CSV string
 */
function toCSV(data: Record<string, unknown>[], columns: { key: string; header: string }[]): string {
  const headers = columns.map(c => escapeCSV(c.header)).join(',');
  const rows = data.map(row =>
    columns.map(col => escapeCSV(row[col.key])).join(',')
  );
  return [headers, ...rows].join('\n');
}

/**
 * Convert array of objects to Excel-compatible XML (simple spreadsheet format)
 * This produces a .xls file that Excel can open
 */
function toExcelXML(data: Record<string, unknown>[], columns: { key: string; header: string }[], sheetName: string = 'Export'): string {
  const escapeXML = (val: unknown): string => {
    if (val === null || val === undefined) return '';
    if (val instanceof Date) return val.toISOString();
    if (val instanceof Decimal) return val.toString();
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };

  const getType = (val: unknown): string => {
    if (val === null || val === undefined) return 'String';
    if (typeof val === 'number' || val instanceof Decimal) return 'Number';
    if (val instanceof Date) return 'DateTime';
    return 'String';
  };

  const headerRow = columns
    .map(c => `<Cell><Data ss:Type="String">${escapeXML(c.header)}</Data></Cell>`)
    .join('');

  const dataRows = data.map(row => {
    const cells = columns.map(col => {
      const val = row[col.key];
      const type = getType(val);
      let displayVal = escapeXML(val);
      // Format dates for Excel
      if (val instanceof Date) {
        displayVal = val.toISOString();
      }
      return `<Cell><Data ss:Type="${type}">${displayVal}</Data></Cell>`;
    }).join('');
    return `<Row>${cells}</Row>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Header">
      <Font ss:Bold="1"/>
      <Interior ss:Color="#CCCCCC" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="Date">
      <NumberFormat ss:Format="yyyy-mm-dd hh:mm:ss"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="${escapeXML(sheetName)}">
    <Table>
      <Row ss:StyleID="Header">${headerRow}</Row>
      ${dataRows}
    </Table>
  </Worksheet>
</Workbook>`;
}

/**
 * Send export response with proper headers
 */
function sendExport(
  res: Response, 
  data: string, 
  format: 'csv' | 'excel', 
  filename: string
): void {
  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
  } else {
    res.setHeader('Content-Type', 'application/vnd.ms-excel');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.xls"`);
  }
  res.send(data);
}

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const ExportFormatSchema = z.enum(['csv', 'excel']).default('csv');

const DateRangeSchema = z.object({
  startDate: z.string().datetime().optional().transform(v => v ? new Date(v) : undefined),
  endDate: z.string().datetime().optional().transform(v => v ? new Date(v) : undefined),
});

const OrderExportSchema = z.object({
  format: ExportFormatSchema,
  startDate: z.string().optional().transform(v => v ? new Date(v) : undefined),
  endDate: z.string().optional().transform(v => v ? new Date(v) : undefined),
  status: z.array(z.nativeEnum(OrderStatus)).optional(),
  priority: z.array(z.coerce.number()).optional(),
  includeLineItems: z.enum(['true', 'false']).default('false').transform(v => v === 'true'),
  includeNotes: z.enum(['true', 'false']).default('false').transform(v => v === 'true'),
  assignedToId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
});

const CustomerExportSchema = z.object({
  format: ExportFormatSchema,
  isActive: z.enum(['true', 'false', 'all']).default('all'),
  includeContacts: z.enum(['true', 'false']).default('true').transform(v => v === 'true'),
  includeStats: z.enum(['true', 'false']).default('true').transform(v => v === 'true'),
  startDate: z.string().optional().transform(v => v ? new Date(v) : undefined),
  endDate: z.string().optional().transform(v => v ? new Date(v) : undefined),
});

const InventoryExportSchema = z.object({
  format: ExportFormatSchema,
  status: z.string().optional(),
  category: z.string().optional(),
  lowStockOnly: z.enum(['true', 'false']).default('false').transform(v => v === 'true'),
  includeInactive: z.enum(['true', 'false']).default('false').transform(v => v === 'true'),
});

const QuoteExportSchema = z.object({
  format: ExportFormatSchema,
  startDate: z.string().optional().transform(v => v ? new Date(v) : undefined),
  endDate: z.string().optional().transform(v => v ? new Date(v) : undefined),
  status: z.array(z.nativeEnum(QuoteStatus)).optional(),
  customerId: z.string().uuid().optional(),
  assignedToId: z.string().uuid().optional(),
  includeLineItems: z.enum(['true', 'false']).default('false').transform(v => v === 'true'),
});

const TimeEntriesExportSchema = z.object({
  format: ExportFormatSchema,
  startDate: z.string().transform(v => new Date(v)),
  endDate: z.string().transform(v => new Date(v)),
  userId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
  station: z.string().optional(),
});

const PurchaseOrderExportSchema = z.object({
  format: ExportFormatSchema,
  startDate: z.string().optional().transform(v => v ? new Date(v) : undefined),
  endDate: z.string().optional().transform(v => v ? new Date(v) : undefined),
  status: z.string().optional(),
  vendorId: z.string().uuid().optional(),
  includeLineItems: z.enum(['true', 'false']).default('false').transform(v => v === 'true'),
});

type OrderExportParams = z.infer<typeof OrderExportSchema>;
type CustomerExportParams = z.infer<typeof CustomerExportSchema>;
type InventoryExportParams = z.infer<typeof InventoryExportSchema>;
type QuoteExportParams = z.infer<typeof QuoteExportSchema>;
type TimeEntriesExportParams = z.infer<typeof TimeEntriesExportSchema>;
type PurchaseOrderExportParams = z.infer<typeof PurchaseOrderExportSchema>;

// =============================================================================
// WORK ORDERS EXPORT
// =============================================================================

/**
 * GET /api/exports/orders
 * Export work orders to CSV or Excel
 * 
 * Query params:
 * - format: 'csv' | 'excel'
 * - startDate, endDate: Date range filter
 * - status: Array of order statuses
 * - priority: Array of priorities
 * - includeLineItems: Include line items in separate rows
 * - includeNotes: Include order notes column
 * - assignedToId: Filter by assigned user
 * - customerId: Filter by customer
 */
exportsRouter.get('/orders', async (req: AuthRequest, res: Response) => {
  const params: OrderExportParams = OrderExportSchema.parse(req.query);

  // Build where clause
  const where: Record<string, unknown> = {};
  
  if (params.startDate || params.endDate) {
    where.createdAt = {};
    if (params.startDate) (where.createdAt as Record<string, Date>).gte = params.startDate;
    if (params.endDate) (where.createdAt as Record<string, Date>).lte = params.endDate;
  }
  
  if (params.status && params.status.length > 0) {
    where.status = params.status.length === 1 ? params.status[0] : { in: params.status };
  }
  
  if (params.priority && params.priority.length > 0) {
    where.priority = params.priority.length === 1 ? params.priority[0] : { in: params.priority };
  }
  
  if (params.assignedToId) where.assignedToId = params.assignedToId;
  if (params.customerId) where.customerId = params.customerId;

  const orders = await prisma.workOrder.findMany({
    where,
    include: {
      customer: { select: { id: true, name: true, companyName: true } },
      assignedTo: { select: { displayName: true } },
      createdBy: { select: { displayName: true } },
      lineItems: params.includeLineItems,
      stationProgress: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  // Prepare data for export
  let exportData: Record<string, unknown>[];
  let columns: { key: string; header: string }[];

  if (params.includeLineItems) {
    // Flatten line items - one row per line item
    exportData = [];
    for (const order of orders) {
      // Calculate total from line items
      const orderTotal = order.lineItems.reduce((sum, li) => sum + (li.quantity * Number(li.unitPrice)), 0);
      
      if (order.lineItems.length === 0) {
        // Order with no line items - include order data only
        exportData.push({
          orderNumber: order.orderNumber,
          status: order.status,
          priority: order.priority,
          customerName: order.customerName,
          companyName: order.customer?.companyName || '',
          description: order.description,
          dueDate: order.dueDate,
          totalPrice: orderTotal.toFixed(2),
          assignedTo: order.assignedTo?.displayName || '',
          createdBy: order.createdBy?.displayName || '',
          createdAt: order.createdAt,
          routing: order.routing.join(' → '),
          quickbooksOrderNum: order.quickbooksOrderNum || '',
          notes: params.includeNotes ? (order.notes || '') : undefined,
          lineItemNumber: '',
          lineItemDescription: '',
          lineItemQty: '',
          lineItemPrice: '',
        });
      } else {
        for (const item of order.lineItems) {
          exportData.push({
            orderNumber: order.orderNumber,
            status: order.status,
            priority: order.priority,
            customerName: order.customerName,
            companyName: order.customer?.companyName || '',
            description: order.description,
            dueDate: order.dueDate,
            totalPrice: orderTotal.toFixed(2),
            assignedTo: order.assignedTo?.displayName || '',
            createdBy: order.createdBy?.displayName || '',
            createdAt: order.createdAt,
            routing: order.routing.join(' → '),
            quickbooksOrderNum: order.quickbooksOrderNum || '',
            notes: params.includeNotes ? (order.notes || '') : undefined,
            lineItemNumber: item.itemNumber,
            lineItemDescription: item.description,
            lineItemQty: item.quantity,
            lineItemPrice: item.unitPrice,
          });
        }
      }
    }
    
    columns = [
      { key: 'orderNumber', header: 'Order Number' },
      { key: 'status', header: 'Status' },
      { key: 'priority', header: 'Priority' },
      { key: 'customerName', header: 'Customer Name' },
      { key: 'companyName', header: 'Company' },
      { key: 'description', header: 'Description' },
      { key: 'dueDate', header: 'Due Date' },
      { key: 'totalPrice', header: 'Total Price' },
      { key: 'assignedTo', header: 'Assigned To' },
      { key: 'createdBy', header: 'Created By' },
      { key: 'createdAt', header: 'Created At' },
      { key: 'routing', header: 'Routing' },
      { key: 'quickbooksOrderNum', header: 'QB Order #' },
      { key: 'lineItemNumber', header: 'Line Item #' },
      { key: 'lineItemDescription', header: 'Line Item Description' },
      { key: 'lineItemQty', header: 'Line Item Qty' },
      { key: 'lineItemPrice', header: 'Line Item Price' },
    ];
    
    if (params.includeNotes) {
      columns.splice(13, 0, { key: 'notes', header: 'Notes' });
    }
  } else {
    // One row per order
    exportData = orders.map(order => {
      // Calculate total from line items
      const orderTotal = order.lineItems.reduce((sum, li) => sum + (li.quantity * Number(li.unitPrice)), 0);
      
      return {
        orderNumber: order.orderNumber,
        status: order.status,
        priority: order.priority,
        customerName: order.customerName,
        companyName: order.customer?.companyName || '',
        description: order.description,
        dueDate: order.dueDate,
        totalPrice: orderTotal.toFixed(2),
        lineItemCount: order.lineItems.length,
        assignedTo: order.assignedTo?.displayName || '',
        createdBy: order.createdBy?.displayName || '',
        createdAt: order.createdAt,
        routing: order.routing.join(' → '),
        stationsCompleted: order.stationProgress.filter(sp => sp.completedAt).length,
        stationsTotal: order.routing.length,
        quickbooksOrderNum: order.quickbooksOrderNum || '',
        notes: params.includeNotes ? (order.notes || '') : undefined,
      };
    });
    
    columns = [
      { key: 'orderNumber', header: 'Order Number' },
      { key: 'status', header: 'Status' },
      { key: 'priority', header: 'Priority' },
      { key: 'customerName', header: 'Customer Name' },
      { key: 'companyName', header: 'Company' },
      { key: 'description', header: 'Description' },
      { key: 'dueDate', header: 'Due Date' },
      { key: 'totalPrice', header: 'Total Price' },
      { key: 'lineItemCount', header: 'Line Items' },
      { key: 'assignedTo', header: 'Assigned To' },
      { key: 'createdBy', header: 'Created By' },
      { key: 'createdAt', header: 'Created At' },
      { key: 'routing', header: 'Routing' },
      { key: 'stationsCompleted', header: 'Stations Completed' },
      { key: 'stationsTotal', header: 'Total Stations' },
      { key: 'quickbooksOrderNum', header: 'QB Order #' },
    ];
    
    if (params.includeNotes) {
      columns.push({ key: 'notes', header: 'Notes' });
    }
  }

  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `work_orders_export_${timestamp}`;

  if (params.format === 'excel') {
    sendExport(res, toExcelXML(exportData, columns, 'Work Orders'), 'excel', filename);
  } else {
    sendExport(res, toCSV(exportData, columns), 'csv', filename);
  }
});

// =============================================================================
// CUSTOMERS EXPORT
// =============================================================================

/**
 * GET /api/exports/customers
 * Export customers to CSV or Excel
 */
exportsRouter.get('/customers', async (req: AuthRequest, res: Response) => {
  const params: CustomerExportParams = CustomerExportSchema.parse(req.query);

  const where: Record<string, unknown> = {};
  
  if (params.isActive !== 'all') {
    where.isActive = params.isActive === 'true';
  }
  
  if (params.startDate || params.endDate) {
    where.createdAt = {};
    if (params.startDate) (where.createdAt as Record<string, Date>).gte = params.startDate;
    if (params.endDate) (where.createdAt as Record<string, Date>).lte = params.endDate;
  }

  const customers = await prisma.customer.findMany({
    where,
    include: {
      contacts: params.includeContacts,
      _count: params.includeStats ? {
        select: { quotes: true, workOrders: true },
      } : undefined,
    },
    orderBy: { name: 'asc' },
  });

  let exportData: Record<string, unknown>[];
  let columns: { key: string; header: string }[];

  if (params.includeContacts) {
    // Flatten contacts - one row per contact (or one row for customer with no contacts)
    exportData = [];
    for (const customer of customers) {
      const baseData = {
        id: customer.id,
        name: customer.name,
        companyName: customer.companyName || '',
        email: customer.email || '',
        phone: customer.phone || '',
        address: customer.address || '',
        city: customer.city || '',
        state: customer.state || '',
        zipCode: customer.zipCode || '',
        paymentTerms: customer.paymentTerms || '',
        creditLimit: customer.creditLimit,
        taxExempt: customer.taxExempt ? 'Yes' : 'No',
        isActive: customer.isActive ? 'Yes' : 'No',
        createdAt: customer.createdAt,
        quoteCount: (customer as { _count?: { quotes: number } })._count?.quotes ?? '',
        orderCount: (customer as { _count?: { workOrders: number } })._count?.workOrders ?? '',
      };

      if (customer.contacts.length === 0) {
        exportData.push({
          ...baseData,
          contactName: '',
          contactEmail: '',
          contactPhone: '',
          contactTitle: '',
          contactIsPrimary: '',
        });
      } else {
        for (const contact of customer.contacts) {
          exportData.push({
            ...baseData,
            contactName: contact.name,
            contactEmail: contact.email || '',
            contactPhone: contact.phone || '',
            contactTitle: contact.title || '',
            contactIsPrimary: contact.isPrimary ? 'Yes' : 'No',
          });
        }
      }
    }

    columns = [
      { key: 'id', header: 'Customer ID' },
      { key: 'name', header: 'Name' },
      { key: 'companyName', header: 'Company Name' },
      { key: 'email', header: 'Email' },
      { key: 'phone', header: 'Phone' },
      { key: 'address', header: 'Address' },
      { key: 'city', header: 'City' },
      { key: 'state', header: 'State' },
      { key: 'zipCode', header: 'Zip Code' },
      { key: 'paymentTerms', header: 'Payment Terms' },
      { key: 'creditLimit', header: 'Credit Limit' },
      { key: 'taxExempt', header: 'Tax Exempt' },
      { key: 'isActive', header: 'Active' },
      { key: 'createdAt', header: 'Created At' },
      { key: 'quoteCount', header: 'Total Quotes' },
      { key: 'orderCount', header: 'Total Orders' },
      { key: 'contactName', header: 'Contact Name' },
      { key: 'contactEmail', header: 'Contact Email' },
      { key: 'contactPhone', header: 'Contact Phone' },
      { key: 'contactTitle', header: 'Contact Title' },
      { key: 'contactIsPrimary', header: 'Primary Contact' },
    ];
  } else {
    // One row per customer
    exportData = customers.map(customer => ({
      id: customer.id,
      name: customer.name,
      companyName: customer.companyName || '',
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || '',
      city: customer.city || '',
      state: customer.state || '',
      zipCode: customer.zipCode || '',
      paymentTerms: customer.paymentTerms || '',
      creditLimit: customer.creditLimit,
      taxExempt: customer.taxExempt ? 'Yes' : 'No',
      isActive: customer.isActive ? 'Yes' : 'No',
      createdAt: customer.createdAt,
      contactCount: customer.contacts.length,
      quoteCount: (customer as { _count?: { quotes: number } })._count?.quotes ?? '',
      orderCount: (customer as { _count?: { workOrders: number } })._count?.workOrders ?? '',
    }));

    columns = [
      { key: 'id', header: 'Customer ID' },
      { key: 'name', header: 'Name' },
      { key: 'companyName', header: 'Company Name' },
      { key: 'email', header: 'Email' },
      { key: 'phone', header: 'Phone' },
      { key: 'address', header: 'Address' },
      { key: 'city', header: 'City' },
      { key: 'state', header: 'State' },
      { key: 'zipCode', header: 'Zip Code' },
      { key: 'paymentTerms', header: 'Payment Terms' },
      { key: 'creditLimit', header: 'Credit Limit' },
      { key: 'taxExempt', header: 'Tax Exempt' },
      { key: 'isActive', header: 'Active' },
      { key: 'createdAt', header: 'Created At' },
      { key: 'contactCount', header: 'Contact Count' },
      { key: 'quoteCount', header: 'Total Quotes' },
      { key: 'orderCount', header: 'Total Orders' },
    ];
  }

  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `customers_export_${timestamp}`;

  if (params.format === 'excel') {
    sendExport(res, toExcelXML(exportData, columns, 'Customers'), 'excel', filename);
  } else {
    sendExport(res, toCSV(exportData, columns), 'csv', filename);
  }
});

// =============================================================================
// INVENTORY EXPORT
// =============================================================================

/**
 * GET /api/exports/inventory
 * Export inventory items and item masters to CSV or Excel
 */
exportsRouter.get('/inventory', async (req: AuthRequest, res: Response) => {
  const params: InventoryExportParams = InventoryExportSchema.parse(req.query);

  // Get item masters with inventory counts
  const itemMasters = await prisma.itemMaster.findMany({
    where: {
      isActive: params.includeInactive ? undefined : true,
      category: params.category || undefined,
    },
    include: {
      inventoryItems: {
        where: params.status ? { status: params.status as InventoryStatus } : undefined,
      },
    },
    orderBy: { name: 'asc' },
  });

  // Calculate aggregates
  const exportData = itemMasters.map(item => {
    const totalQty = item.inventoryItems.reduce((sum: number, inv) => sum + inv.quantity, 0);
    const reservedQty = item.inventoryItems
      .filter(inv => inv.status === 'RESERVED')
      .reduce((sum: number, inv) => sum + inv.quantity, 0);
    const availableQty = item.inventoryItems
      .filter(inv => inv.status === 'AVAILABLE')
      .reduce((sum: number, inv) => sum + inv.quantity, 0);
    
    return {
      sku: item.sku,
      name: item.name,
      description: item.description || '',
      category: item.category || '',
      costPrice: item.costPrice,
      unitPrice: item.unitPrice,
      totalQuantity: totalQty,
      availableQuantity: availableQty,
      reservedQuantity: reservedQty,
      isActive: item.isActive ? 'Yes' : 'No',
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }).filter(item => {
    // Filter low stock only if requested
    if (params.lowStockOnly) {
      // Items with 0 available are considered low stock
      return item.availableQuantity === 0;
    }
    return true;
  });

  const columns = [
    { key: 'sku', header: 'SKU' },
    { key: 'name', header: 'Name' },
    { key: 'description', header: 'Description' },
    { key: 'category', header: 'Category' },
    { key: 'costPrice', header: 'Cost Price' },
    { key: 'unitPrice', header: 'Unit Price' },
    { key: 'totalQuantity', header: 'Total Qty' },
    { key: 'availableQuantity', header: 'Available Qty' },
    { key: 'reservedQuantity', header: 'Reserved Qty' },
    { key: 'isActive', header: 'Active' },
    { key: 'createdAt', header: 'Created At' },
    { key: 'updatedAt', header: 'Updated At' },
  ];

  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `inventory_export_${timestamp}`;

  if (params.format === 'excel') {
    sendExport(res, toExcelXML(exportData, columns, 'Inventory'), 'excel', filename);
  } else {
    sendExport(res, toCSV(exportData, columns), 'csv', filename);
  }
});

// =============================================================================
// QUOTES EXPORT
// =============================================================================

/**
 * GET /api/exports/quotes
 * Export quotes to CSV or Excel
 */
exportsRouter.get('/quotes', async (req: AuthRequest, res: Response) => {
  const params: QuoteExportParams = QuoteExportSchema.parse(req.query);

  const where: Record<string, unknown> = {};
  
  if (params.startDate || params.endDate) {
    where.createdAt = {};
    if (params.startDate) (where.createdAt as Record<string, Date>).gte = params.startDate;
    if (params.endDate) (where.createdAt as Record<string, Date>).lte = params.endDate;
  }
  
  if (params.status && params.status.length > 0) {
    where.status = params.status.length === 1 ? params.status[0] : { in: params.status };
  }
  
  if (params.customerId) where.customerId = params.customerId;
  if (params.assignedToId) where.assignedToId = params.assignedToId;

  const quotes = await prisma.quote.findMany({
    where,
    include: {
      customer: { select: { name: true, companyName: true } },
      assignedTo: { select: { displayName: true } },
      createdBy: { select: { displayName: true } },
      lineItems: params.includeLineItems,
    },
    orderBy: { createdAt: 'desc' },
  });

  let exportData: Record<string, unknown>[];
  let columns: { key: string; header: string }[];

  if (params.includeLineItems) {
    // Flatten line items
    exportData = [];
    for (const quote of quotes) {
      if (quote.lineItems.length === 0) {
        exportData.push({
          quoteNumber: quote.quoteNumber,
          status: quote.status,
          customerName: quote.customerName,
          companyName: quote.customer?.companyName || '',
          description: quote.description || '',
          subtotal: quote.subtotal,
          taxAmount: quote.taxAmount,
          discountAmount: quote.discountAmount,
          total: quote.total,
          validUntil: quote.validUntil,
          assignedTo: quote.assignedTo?.displayName || '',
          createdBy: quote.createdBy?.displayName || '',
          createdAt: quote.createdAt,
          lineItemDescription: '',
          lineItemQty: '',
          lineItemPrice: '',
        });
      } else {
        for (const item of quote.lineItems) {
          exportData.push({
            quoteNumber: quote.quoteNumber,
            status: quote.status,
            customerName: quote.customerName,
            companyName: quote.customer?.companyName || '',
            description: quote.description || '',
            subtotal: quote.subtotal,
            taxAmount: quote.taxAmount,
            discountAmount: quote.discountAmount,
            total: quote.total,
            validUntil: quote.validUntil,
            assignedTo: quote.assignedTo?.displayName || '',
            createdBy: quote.createdBy?.displayName || '',
            createdAt: quote.createdAt,
            lineItemDescription: item.description,
            lineItemQty: item.quantity,
            lineItemPrice: item.unitPrice,
          });
        }
      }
    }

    columns = [
      { key: 'quoteNumber', header: 'Quote Number' },
      { key: 'status', header: 'Status' },
      { key: 'customerName', header: 'Customer Name' },
      { key: 'companyName', header: 'Company' },
      { key: 'description', header: 'Description' },
      { key: 'subtotal', header: 'Subtotal' },
      { key: 'taxAmount', header: 'Tax' },
      { key: 'discountAmount', header: 'Discount' },
      { key: 'total', header: 'Total' },
      { key: 'validUntil', header: 'Valid Until' },
      { key: 'assignedTo', header: 'Assigned To' },
      { key: 'createdBy', header: 'Created By' },
      { key: 'createdAt', header: 'Created At' },
      { key: 'lineItemDescription', header: 'Line Item Description' },
      { key: 'lineItemQty', header: 'Line Item Qty' },
      { key: 'lineItemPrice', header: 'Line Item Price' },
    ];
  } else {
    // One row per quote
    exportData = quotes.map(quote => ({
      quoteNumber: quote.quoteNumber,
      status: quote.status,
      customerName: quote.customerName,
      companyName: quote.customer?.companyName || '',
      description: quote.description || '',
      lineItemCount: quote.lineItems.length,
      subtotal: quote.subtotal,
      taxAmount: quote.taxAmount,
      discountAmount: quote.discountAmount,
      total: quote.total,
      validUntil: quote.validUntil,
      assignedTo: quote.assignedTo?.displayName || '',
      createdBy: quote.createdBy?.displayName || '',
      createdAt: quote.createdAt,
    }));

    columns = [
      { key: 'quoteNumber', header: 'Quote Number' },
      { key: 'status', header: 'Status' },
      { key: 'customerName', header: 'Customer Name' },
      { key: 'companyName', header: 'Company' },
      { key: 'description', header: 'Description' },
      { key: 'lineItemCount', header: 'Line Items' },
      { key: 'subtotal', header: 'Subtotal' },
      { key: 'taxAmount', header: 'Tax' },
      { key: 'discountAmount', header: 'Discount' },
      { key: 'total', header: 'Total' },
      { key: 'validUntil', header: 'Valid Until' },
      { key: 'assignedTo', header: 'Assigned To' },
      { key: 'createdBy', header: 'Created By' },
      { key: 'createdAt', header: 'Created At' },
    ];
  }

  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `quotes_export_${timestamp}`;

  if (params.format === 'excel') {
    sendExport(res, toExcelXML(exportData, columns, 'Quotes'), 'excel', filename);
  } else {
    sendExport(res, toCSV(exportData, columns), 'csv', filename);
  }
});

// =============================================================================
// TIME ENTRIES EXPORT
// =============================================================================

/**
 * GET /api/exports/time-entries
 * Export time entries to CSV or Excel (for payroll/billing reports)
 */
exportsRouter.get('/time-entries', async (req: AuthRequest, res: Response) => {
  const params: TimeEntriesExportParams = TimeEntriesExportSchema.parse(req.query);

  const where: Record<string, unknown> = {
    startTime: {
      gte: params.startDate,
      lte: params.endDate,
    },
  };
  
  if (params.userId) where.userId = params.userId;
  if (params.orderId) where.orderId = params.orderId;
  if (params.station) where.station = params.station;

  const entries = await prisma.timeEntry.findMany({
    where,
    include: {
      user: { select: { displayName: true, email: true } },
      order: { select: { orderNumber: true, customerName: true, description: true } },
    },
    orderBy: { startTime: 'asc' },
  });

  const exportData = entries.map(entry => {
    const durationMinutes = entry.endTime
      ? Math.round((entry.endTime.getTime() - entry.startTime.getTime()) / 60000)
      : null;
    const hours = durationMinutes ? (durationMinutes / 60).toFixed(2) : 'In Progress';

    return {
      id: entry.id,
      userName: entry.user.displayName,
      userEmail: entry.user.email,
      orderNumber: entry.order.orderNumber,
      customerName: entry.order.customerName,
      orderDescription: entry.order.description || '',
      station: entry.station,
      startTime: entry.startTime,
      endTime: entry.endTime || '',
      durationMinutes: durationMinutes || '',
      durationHours: hours,
      notes: entry.notes || '',
    };
  });

  const columns = [
    { key: 'id', header: 'Entry ID' },
    { key: 'userName', header: 'Employee Name' },
    { key: 'userEmail', header: 'Employee Email' },
    { key: 'orderNumber', header: 'Order Number' },
    { key: 'customerName', header: 'Customer' },
    { key: 'orderDescription', header: 'Order Description' },
    { key: 'station', header: 'Station' },
    { key: 'startTime', header: 'Start Time' },
    { key: 'endTime', header: 'End Time' },
    { key: 'durationMinutes', header: 'Duration (min)' },
    { key: 'durationHours', header: 'Duration (hrs)' },
    { key: 'notes', header: 'Notes' },
  ];

  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `time_entries_export_${timestamp}`;

  if (params.format === 'excel') {
    sendExport(res, toExcelXML(exportData, columns, 'Time Entries'), 'excel', filename);
  } else {
    sendExport(res, toCSV(exportData, columns), 'csv', filename);
  }
});

// =============================================================================
// PURCHASE ORDERS EXPORT
// =============================================================================

/**
 * GET /api/exports/purchase-orders
 * Export purchase orders to CSV or Excel
 */
exportsRouter.get('/purchase-orders', async (req: AuthRequest, res: Response) => {
  const params: PurchaseOrderExportParams = PurchaseOrderExportSchema.parse(req.query);

  const where: Record<string, unknown> = {};
  
  if (params.startDate || params.endDate) {
    where.createdAt = {};
    if (params.startDate) (where.createdAt as Record<string, Date>).gte = params.startDate;
    if (params.endDate) (where.createdAt as Record<string, Date>).lte = params.endDate;
  }
  
  if (params.status) where.status = params.status;
  if (params.vendorId) where.vendorId = params.vendorId;

  const purchaseOrders = await prisma.purchaseOrder.findMany({
    where,
    include: {
      vendor: { select: { name: true } },
      createdBy: { select: { displayName: true } },
      lineItems: params.includeLineItems,
    },
    orderBy: { createdAt: 'desc' },
  });

  let exportData: Record<string, unknown>[];
  let columns: { key: string; header: string }[];

  if (params.includeLineItems) {
    // Flatten line items
    exportData = [];
    for (const po of purchaseOrders) {
      if (po.lineItems.length === 0) {
        exportData.push({
          poNumber: po.poNumber,
          status: po.status,
          vendorName: po.vendor?.name || '',
          total: po.total,
          expectedDate: po.expectedDate,
          createdBy: po.createdBy?.displayName || '',
          createdAt: po.createdAt,
          notes: po.notes || '',
          lineItemDescription: '',
          lineItemQty: '',
          lineItemUnitCost: '',
        });
      } else {
        for (const item of po.lineItems) {
          exportData.push({
            poNumber: po.poNumber,
            status: po.status,
            vendorName: po.vendor?.name || '',
            total: po.total,
            expectedDate: po.expectedDate,
            createdBy: po.createdBy?.displayName || '',
            createdAt: po.createdAt,
            notes: po.notes || '',
            lineItemDescription: item.description,
            lineItemQty: item.quantity,
            lineItemUnitCost: item.unitCost,
          });
        }
      }
    }

    columns = [
      { key: 'poNumber', header: 'PO Number' },
      { key: 'status', header: 'Status' },
      { key: 'vendorName', header: 'Vendor' },
      { key: 'total', header: 'Total' },
      { key: 'expectedDate', header: 'Expected Date' },
      { key: 'createdBy', header: 'Created By' },
      { key: 'createdAt', header: 'Created At' },
      { key: 'notes', header: 'Notes' },
      { key: 'lineItemDescription', header: 'Line Item Description' },
      { key: 'lineItemQty', header: 'Line Item Qty' },
      { key: 'lineItemUnitCost', header: 'Line Item Unit Cost' },
    ];
  } else {
    // One row per PO
    exportData = purchaseOrders.map(po => ({
      poNumber: po.poNumber,
      status: po.status,
      vendorName: po.vendor?.name || '',
      lineItemCount: po.lineItems.length,
      total: po.total,
      expectedDate: po.expectedDate,
      createdBy: po.createdBy?.displayName || '',
      createdAt: po.createdAt,
      notes: po.notes || '',
    }));

    columns = [
      { key: 'poNumber', header: 'PO Number' },
      { key: 'status', header: 'Status' },
      { key: 'vendorName', header: 'Vendor' },
      { key: 'lineItemCount', header: 'Line Items' },
      { key: 'total', header: 'Total' },
      { key: 'expectedDate', header: 'Expected Date' },
      { key: 'createdBy', header: 'Created By' },
      { key: 'createdAt', header: 'Created At' },
      { key: 'notes', header: 'Notes' },
    ];
  }

  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `purchase_orders_export_${timestamp}`;

  if (params.format === 'excel') {
    sendExport(res, toExcelXML(exportData, columns, 'Purchase Orders'), 'excel', filename);
  } else {
    sendExport(res, toCSV(exportData, columns), 'csv', filename);
  }
});

// =============================================================================
// PRODUCTION REPORT EXPORT
// =============================================================================

/**
 * GET /api/exports/production-report
 * Export production report with station throughput and completion times
 */
exportsRouter.get('/production-report', requireRole(UserRole.ADMIN, UserRole.MANAGER), async (req: AuthRequest, res: Response) => {
  const schema = z.object({
    format: ExportFormatSchema,
    startDate: z.string().transform(v => new Date(v)),
    endDate: z.string().transform(v => new Date(v)),
  });
  
  const params = schema.parse(req.query);

  // Get station progress entries with completion data
  const stationProgress = await prisma.stationProgress.findMany({
    where: {
      completedAt: {
        gte: params.startDate,
        lte: params.endDate,
      },
    },
    include: {
      order: { select: { orderNumber: true, customerName: true, priority: true } },
      completedBy: { select: { displayName: true } },
    },
    orderBy: { completedAt: 'asc' },
  });

  const exportData = stationProgress.map(sp => {
    // Calculate time spent at station (from start of order or previous station)
    const timeSpentMinutes = sp.startedAt && sp.completedAt
      ? Math.round((sp.completedAt.getTime() - sp.startedAt.getTime()) / 60000)
      : null;

    return {
      orderNumber: sp.order.orderNumber,
      customerName: sp.order.customerName,
      priority: sp.order.priority,
      station: sp.station,
      status: sp.status,
      startedAt: sp.startedAt || '',
      completedAt: sp.completedAt,
      completedBy: sp.completedBy?.displayName || '',
      timeSpentMinutes: timeSpentMinutes || '',
      timeSpentHours: timeSpentMinutes ? (timeSpentMinutes / 60).toFixed(2) : '',
    };
  });

  const columns = [
    { key: 'orderNumber', header: 'Order Number' },
    { key: 'customerName', header: 'Customer' },
    { key: 'priority', header: 'Priority' },
    { key: 'station', header: 'Station' },
    { key: 'status', header: 'Status' },
    { key: 'startedAt', header: 'Started At' },
    { key: 'completedAt', header: 'Completed At' },
    { key: 'completedBy', header: 'Completed By' },
    { key: 'timeSpentMinutes', header: 'Time (min)' },
    { key: 'timeSpentHours', header: 'Time (hrs)' },
  ];

  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `production_report_${timestamp}`;

  if (params.format === 'excel') {
    sendExport(res, toExcelXML(exportData, columns, 'Production Report'), 'excel', filename);
  } else {
    sendExport(res, toCSV(exportData, columns), 'csv', filename);
  }
});

// =============================================================================
// LABOR SUMMARY EXPORT
// =============================================================================

/**
 * GET /api/exports/labor-summary
 * Export labor summary by user for payroll
 */
exportsRouter.get('/labor-summary', requireRole(UserRole.ADMIN, UserRole.MANAGER), async (req: AuthRequest, res: Response) => {
  const schema = z.object({
    format: ExportFormatSchema,
    startDate: z.string().transform(v => new Date(v)),
    endDate: z.string().transform(v => new Date(v)),
  });
  
  const params = schema.parse(req.query);

  // Get all time entries in range grouped by user
  const entries = await prisma.timeEntry.findMany({
    where: {
      startTime: {
        gte: params.startDate,
        lte: params.endDate,
      },
      endTime: { not: null }, // Only completed entries
    },
    include: {
      user: { select: { id: true, displayName: true, email: true } },
    },
  });

  // Aggregate by user
  const userSummaries = new Map<string, {
    userId: string;
    displayName: string;
    email: string | null;
    totalMinutes: number;
    entryCount: number;
    stationBreakdown: Map<string, number>;
  }>();

  for (const entry of entries) {
    if (!entry.endTime) continue;
    
    const duration = Math.round((entry.endTime.getTime() - entry.startTime.getTime()) / 60000);
    const userId = entry.user.id;
    
    if (!userSummaries.has(userId)) {
      userSummaries.set(userId, {
        userId,
        displayName: entry.user.displayName,
        email: entry.user.email,
        totalMinutes: 0,
        entryCount: 0,
        stationBreakdown: new Map(),
      });
    }
    
    const summary = userSummaries.get(userId)!;
    summary.totalMinutes += duration;
    summary.entryCount++;
    
    const stationMinutes = summary.stationBreakdown.get(entry.station) || 0;
    summary.stationBreakdown.set(entry.station, stationMinutes + duration);
  }

  const exportData = Array.from(userSummaries.values()).map(summary => {
    const stationBreakdown = Array.from(summary.stationBreakdown.entries())
      .map(([station, minutes]) => `${station}: ${(minutes / 60).toFixed(1)}h`)
      .join(', ');

    return {
      userName: summary.displayName,
      userEmail: summary.email,
      entryCount: summary.entryCount,
      totalMinutes: summary.totalMinutes,
      totalHours: (summary.totalMinutes / 60).toFixed(2),
      stationBreakdown,
    };
  });

  const columns = [
    { key: 'userName', header: 'Employee Name' },
    { key: 'userEmail', header: 'Email' },
    { key: 'entryCount', header: 'Time Entries' },
    { key: 'totalMinutes', header: 'Total Minutes' },
    { key: 'totalHours', header: 'Total Hours' },
    { key: 'stationBreakdown', header: 'Hours by Station' },
  ];

  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `labor_summary_${timestamp}`;

  if (params.format === 'excel') {
    sendExport(res, toExcelXML(exportData, columns, 'Labor Summary'), 'excel', filename);
  } else {
    sendExport(res, toCSV(exportData, columns), 'csv', filename);
  }
});

// =============================================================================
// AVAILABLE EXPORTS ENDPOINT
// =============================================================================

/**
 * GET /api/exports
 * List all available export endpoints and their parameters
 */
exportsRouter.get('/', (_req: AuthRequest, res: Response) => {
  res.json({
    success: true,
    data: {
      availableExports: [
        {
          name: 'Work Orders',
          endpoint: '/exports/orders',
          formats: ['csv', 'excel'],
          parameters: {
            format: 'csv | excel',
            startDate: 'ISO date string (optional)',
            endDate: 'ISO date string (optional)',
            status: 'Array of OrderStatus (optional)',
            priority: 'Array of Priority (optional)',
            includeLineItems: 'true | false (default: false)',
            includeNotes: 'true | false (default: false)',
            assignedToId: 'UUID (optional)',
            customerId: 'UUID (optional)',
          },
        },
        {
          name: 'Customers',
          endpoint: '/exports/customers',
          formats: ['csv', 'excel'],
          parameters: {
            format: 'csv | excel',
            isActive: 'true | false | all (default: all)',
            includeContacts: 'true | false (default: true)',
            includeStats: 'true | false (default: true)',
            startDate: 'ISO date string (optional)',
            endDate: 'ISO date string (optional)',
          },
        },
        {
          name: 'Inventory',
          endpoint: '/exports/inventory',
          formats: ['csv', 'excel'],
          parameters: {
            format: 'csv | excel',
            status: 'Inventory status (optional)',
            category: 'Category name (optional)',
            lowStockOnly: 'true | false (default: false)',
            includeInactive: 'true | false (default: false)',
          },
        },
        {
          name: 'Quotes',
          endpoint: '/exports/quotes',
          formats: ['csv', 'excel'],
          parameters: {
            format: 'csv | excel',
            startDate: 'ISO date string (optional)',
            endDate: 'ISO date string (optional)',
            status: 'Array of QuoteStatus (optional)',
            customerId: 'UUID (optional)',
            assignedToId: 'UUID (optional)',
            includeLineItems: 'true | false (default: false)',
          },
        },
        {
          name: 'Time Entries',
          endpoint: '/exports/time-entries',
          formats: ['csv', 'excel'],
          parameters: {
            format: 'csv | excel',
            startDate: 'ISO date string (required)',
            endDate: 'ISO date string (required)',
            userId: 'UUID (optional)',
            orderId: 'UUID (optional)',
            station: 'Station name (optional)',
          },
        },
        {
          name: 'Purchase Orders',
          endpoint: '/exports/purchase-orders',
          formats: ['csv', 'excel'],
          parameters: {
            format: 'csv | excel',
            startDate: 'ISO date string (optional)',
            endDate: 'ISO date string (optional)',
            status: 'PO status (optional)',
            vendorId: 'UUID (optional)',
            includeLineItems: 'true | false (default: false)',
          },
        },
        {
          name: 'Production Report',
          endpoint: '/exports/production-report',
          formats: ['csv', 'excel'],
          requiredRole: 'ADMIN or MANAGER',
          parameters: {
            format: 'csv | excel',
            startDate: 'ISO date string (required)',
            endDate: 'ISO date string (required)',
          },
        },
        {
          name: 'Labor Summary',
          endpoint: '/exports/labor-summary',
          formats: ['csv', 'excel'],
          requiredRole: 'ADMIN or MANAGER',
          parameters: {
            format: 'csv | excel',
            startDate: 'ISO date string (required)',
            endDate: 'ISO date string (required)',
          },
        },
      ],
    },
  });
});

export default exportsRouter;
