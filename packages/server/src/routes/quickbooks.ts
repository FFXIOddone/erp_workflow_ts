/**
 * QuickBooks API Routes (READ-ONLY)
 * 
 * All routes in this file are READ-ONLY. No modifications to QuickBooks data are allowed.
 * Data is fetched from QuickBooks Desktop running on CHRISTINA-NEW via ODBC.
 * 
 * @module routes/quickbooks
 */

import { Router, type Response } from 'express';
import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';
import { QBCacheImportPayloadSchema } from '@erp/shared';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { quickbooks } from '../services/quickbooks.js';
import {
  importToCache,
  searchCache,
  getCachedOrder,
  getCacheStats,
  clearCache,
} from '../services/quickbooks-cache.js';

const execAsync = promisify(exec);

export const quickbooksRouter = Router();

// All routes require authentication
quickbooksRouter.use(authenticate);

// ============ CONNECTION STATUS ============

/**
 * GET /quickbooks/status
 * Get QuickBooks connection status
 */
quickbooksRouter.get('/status', async (_req: AuthRequest, res: Response) => {
  const status = quickbooks.getConnectionStatus();
  res.json({ success: true, data: status });
});

/**
 * GET /quickbooks/network-test
 * Test network connectivity to QuickBooks host
 */
quickbooksRouter.get('/network-test', async (_req: AuthRequest, res: Response) => {
  const host = process.env.QB_HOST ?? 'CHRISTINA-NEW';
  const companyFile = process.env.QB_COMPANY_FILE ?? '';
  
  const results: Record<string, unknown> = {
    host,
    companyFile,
    hostReachable: false,
    hostPingResult: null,
    fileServerReachable: false,
    odbcDriverInstalled: false,
    dsnConfigured: false,
  };
  
  try {
    // Test ping to QB host
    const { stdout: pingResult } = await execAsync(`ping ${host} -n 1`, { timeout: 5000 });
    // Check for actual successful ping (not just "Destination host unreachable")
    results.hostReachable = pingResult.includes('TTL=') && !pingResult.includes('unreachable');
    results.hostPingResult = pingResult.trim();
  } catch (error) {
    results.hostPingResult = error instanceof Error ? error.message : 'Ping failed';
  }
  
  // Test if company file server is reachable (extract server from UNC path)
  if (companyFile.startsWith('\\\\')) {
    const serverMatch = companyFile.match(/^\\\\([^\\]+)/);
    if (serverMatch) {
      const fileServer = serverMatch[1];
      results.fileServer = fileServer;
      try {
        const { stdout: filePingResult } = await execAsync(`ping ${fileServer} -n 1`, { timeout: 5000 });
        results.fileServerReachable = filePingResult.includes('TTL=') && !filePingResult.includes('unreachable');
        results.filePingResult = filePingResult.trim();
      } catch (err) {
        results.fileServerReachable = false;
        results.filePingResult = err instanceof Error ? err.message : 'Ping failed';
      }
    }
  }
  
  // Check if ODBC driver is installed (Windows only)
  try {
    const { stdout: odbcResult } = await execAsync('powershell -Command "Get-OdbcDriver | Where-Object { $_.Name -like \'*QB*\' -or $_.Name -like \'*QuickBooks*\' -or $_.Name -like \'*QODBC*\' } | Select-Object -ExpandProperty Name"', { timeout: 10000 });
    results.odbcDriverInstalled = odbcResult.trim().length > 0;
    results.odbcDriverInfo = odbcResult.trim() || 'No QuickBooks ODBC driver found';
  } catch {
    results.odbcDriverInstalled = false;
    results.odbcDriverInfo = 'Failed to query ODBC drivers';
  }
  
  // Check if DSN is configured
  const dsn = process.env.QB_DSN ?? 'QuickBooks Data';
  try {
    const { stdout: dsnResult } = await execAsync(`powershell -Command "Get-OdbcDsn -Name '${dsn}' -ErrorAction SilentlyContinue | Select-Object Name, DriverName, DsnType, Platform | ConvertTo-Json"`, { timeout: 10000 });
    if (dsnResult.trim()) {
      results.dsnConfigured = true;
      results.dsnInfo = JSON.parse(dsnResult.trim());
    } else {
      results.dsnConfigured = false;
    }
    results.dsnName = dsn;
  } catch {
    results.dsnConfigured = false;
    results.dsnName = dsn;
  }
  
  res.json({ 
    success: true, 
    data: results,
    recommendations: getRecommendations(results),
  });
});

function getRecommendations(results: Record<string, unknown>): string[] {
  const recommendations: string[] = [];
  
  if (!results.hostReachable) {
    recommendations.push(`QuickBooks host (${results.host}) is not reachable. Ensure the machine is powered on and connected to the network.`);
  }
  
  if (!results.fileServerReachable && results.fileServer) {
    recommendations.push(`File server (${results.fileServer}) is not reachable. Check network connectivity.`);
  }
  
  if (!results.odbcDriverInstalled) {
    recommendations.push('QuickBooks ODBC driver is not installed. Download and install it from Intuit or use QODBC from qodbc.com');
  }
  
  if (!results.dsnConfigured) {
    recommendations.push(`ODBC DSN "${results.dsnName}" is not configured. Create a System DSN in ODBC Data Sources (64-bit) pointing to QuickBooks.`);
  }
  
  if (results.hostReachable && results.odbcDriverInstalled && results.dsnConfigured) {
    recommendations.push('Network and ODBC configuration looks good. Try testing the connection.');
  }
  
  return recommendations;
}

/**
 * POST /quickbooks/test-connection
 * Test QuickBooks connection
 */
quickbooksRouter.post('/test-connection', async (_req: AuthRequest, res: Response) => {
  const status = await quickbooks.testConnection();
  res.json({ 
    success: status.connected, 
    data: status,
    message: status.connected ? 'Connection successful' : status.error,
  });
});

// ============ CUSTOMERS (READ-ONLY) ============

const CustomerQuerySchema = z.object({
  activeOnly: z.coerce.boolean().optional().default(true),
  limit: z.coerce.number().int().min(1).max(5000).optional().default(1000),
  search: z.string().optional(),
});

/**
 * GET /quickbooks/customers
 * Get customers from QuickBooks (READ-ONLY)
 */
quickbooksRouter.get('/customers', async (req: AuthRequest, res: Response) => {
  const params = CustomerQuerySchema.parse(req.query);
  
  const customers = await quickbooks.getCustomers(params);
  
  res.json({
    success: true,
    data: customers,
    total: customers.length,
  });
});

/**
 * GET /quickbooks/customers/:listId
 * Get a single customer by ListID (READ-ONLY)
 */
quickbooksRouter.get('/customers/:listId', async (req: AuthRequest, res: Response) => {
  const { listId } = req.params;
  
  const customer = await quickbooks.getCustomerById(listId);
  
  if (!customer) {
    res.status(404).json({ success: false, error: 'Customer not found' });
    return;
  }
  
  res.json({ success: true, data: customer });
});

// ============ INVOICES (READ-ONLY) ============

const InvoiceQuerySchema = z.object({
  customerId: z.string().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  unpaidOnly: z.coerce.boolean().optional().default(false),
  limit: z.coerce.number().int().min(1).max(5000).optional().default(500),
});

/**
 * GET /quickbooks/invoices
 * Get invoices from QuickBooks (READ-ONLY)
 */
quickbooksRouter.get('/invoices', async (req: AuthRequest, res: Response) => {
  const params = InvoiceQuerySchema.parse(req.query);
  
  const invoices = await quickbooks.getInvoices(params);
  
  res.json({
    success: true,
    data: invoices,
    total: invoices.length,
  });
});

/**
 * GET /quickbooks/invoices/:txnId
 * Get a single invoice by TxnID (READ-ONLY)
 */
quickbooksRouter.get('/invoices/:txnId', async (req: AuthRequest, res: Response) => {
  const { txnId } = req.params;
  
  const invoice = await quickbooks.getInvoiceById(txnId);
  
  if (!invoice) {
    res.status(404).json({ success: false, error: 'Invoice not found' });
    return;
  }
  
  res.json({ success: true, data: invoice });
});

// ============ ITEMS (READ-ONLY) ============

const ItemQuerySchema = z.object({
  activeOnly: z.coerce.boolean().optional().default(true),
  type: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(5000).optional().default(1000),
  search: z.string().optional(),
});

/**
 * GET /quickbooks/items
 * Get items from QuickBooks (READ-ONLY)
 */
quickbooksRouter.get('/items', async (req: AuthRequest, res: Response) => {
  const params = ItemQuerySchema.parse(req.query);
  
  const items = await quickbooks.getItems(params);
  
  res.json({
    success: true,
    data: items,
    total: items.length,
  });
});

/**
 * GET /quickbooks/items/:listId
 * Get a single item by ListID (READ-ONLY)
 */
quickbooksRouter.get('/items/:listId', async (req: AuthRequest, res: Response) => {
  const { listId } = req.params;
  
  const item = await quickbooks.getItemById(listId);
  
  if (!item) {
    res.status(404).json({ success: false, error: 'Item not found' });
    return;
  }
  
  res.json({ success: true, data: item });
});

// ============ ESTIMATES (READ-ONLY) ============

const EstimateQuerySchema = z.object({
  customerId: z.string().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  activeOnly: z.coerce.boolean().optional().default(true),
  limit: z.coerce.number().int().min(1).max(5000).optional().default(500),
});

/**
 * GET /quickbooks/estimates
 * Get estimates from QuickBooks (READ-ONLY)
 */
quickbooksRouter.get('/estimates', async (req: AuthRequest, res: Response) => {
  const params = EstimateQuerySchema.parse(req.query);
  
  const estimates = await quickbooks.getEstimates(params);
  
  res.json({
    success: true,
    data: estimates,
    total: estimates.length,
  });
});

// ============ SALES ORDERS (READ-ONLY) ============

const SalesOrderQuerySchema = z.object({
  customerId: z.string().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  openOnly: z.coerce.boolean().optional().default(false),
  limit: z.coerce.number().int().min(1).max(5000).optional().default(500),
});

/**
 * GET /quickbooks/sales-orders
 * Get sales orders from QuickBooks (READ-ONLY)
 */
quickbooksRouter.get('/sales-orders', async (req: AuthRequest, res: Response) => {
  const params = SalesOrderQuerySchema.parse(req.query);
  
  const salesOrders = await quickbooks.getSalesOrders(params);
  
  res.json({
    success: true,
    data: salesOrders,
    total: salesOrders.length,
  });
});

// ============ ORDER SEARCH (for linking) ============

const QBSearchSchema = z.object({
  refNumber: z.string().optional(),
  customerName: z.string().optional(),
  poNumber: z.string().optional(),
  amount: z.coerce.number().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
});

/**
 * GET /quickbooks/search
 * Search QuickBooks for orders matching criteria (for linking to ERP orders)
 */
quickbooksRouter.get('/search', async (req: AuthRequest, res: Response) => {
  const params = QBSearchSchema.parse(req.query);
  
  const matches = await quickbooks.findMatchingQBOrder({
    refNumber: params.refNumber,
    customerName: params.customerName,
    poNumber: params.poNumber,
    amount: params.amount,
    dateRange: params.fromDate && params.toDate
      ? { from: params.fromDate, to: params.toDate }
      : undefined,
  });
  
  res.json({
    success: true,
    data: matches,
    total: matches.length,
  });
});

/**
 * GET /quickbooks/order/:refNumber/line-items
 * Get line items for a specific QB order by reference number
 */
quickbooksRouter.get('/order/:refNumber/line-items', async (req: AuthRequest, res: Response) => {
  const { refNumber } = req.params;
  
  const result = await quickbooks.getLineItemsForQBOrder(refNumber);
  
  if (!result) {
    res.status(404).json({ 
      success: false, 
      error: `Order "${refNumber}" not found in QuickBooks` 
    });
    return;
  }
  
  res.json({
    success: true,
    data: result,
  });
});

// ============ CONNECTION MANAGEMENT ============

/**
 * POST /quickbooks/reset-connection
 * Reset the ODBC connection pool and immediately attempt to reconnect.
 */
quickbooksRouter.post('/reset-connection', async (_req: AuthRequest, res: Response) => {
  quickbooks.resetConnection();
  
  // Attempt to reconnect right away
  const status = await quickbooks.testConnection();
  
  res.json({ 
    success: true, 
    message: status.connected 
      ? 'Connection re-established successfully.' 
      : 'Connection pool reset but reconnection failed. QuickBooks may not be running.',
    data: status,
  });
});

// ============ QB CACHE ============

/**
 * POST /quickbooks/cache/import
 * Import a batch of QB orders + line items into the local cache.
 * Used by the USB qb-agent tool and ODBC snapshot jobs.
 */
quickbooksRouter.post('/cache/import', async (req: AuthRequest, res: Response) => {
  const payload = QBCacheImportPayloadSchema.parse(req.body);
  const result = await importToCache(payload);
  res.json({ success: true, data: result });
});

/**
 * GET /quickbooks/cache/stats
 * Get cache statistics (total orders, line items, date range, etc.)
 */
quickbooksRouter.get('/cache/stats', async (_req: AuthRequest, res: Response) => {
  const stats = await getCacheStats();
  res.json({ success: true, data: stats });
});

/**
 * GET /quickbooks/cache/search?search=&type=&limit=&offset=
 * Search cached QB orders.
 */
quickbooksRouter.get('/cache/search', async (req: AuthRequest, res: Response) => {
  const { search, type, limit, offset } = req.query;
  const result = await searchCache({
    search: typeof search === 'string' ? search : undefined,
    type: typeof type === 'string' ? type : undefined,
    limit: limit ? parseInt(String(limit), 10) : undefined,
    offset: offset ? parseInt(String(offset), 10) : undefined,
  });
  res.json({ success: true, data: result });
});

/**
 * GET /quickbooks/cache/:refNumber
 * Get a specific cached order by reference number.
 */
quickbooksRouter.get('/cache/:refNumber', async (req: AuthRequest, res: Response) => {
  const order = await getCachedOrder(req.params.refNumber);
  if (!order) {
    res.status(404).json({ success: false, error: 'Order not found in cache' });
    return;
  }
  res.json({ success: true, data: order });
});

/**
 * DELETE /quickbooks/cache
 * Clear the entire QB cache (admin action).
 */
quickbooksRouter.delete('/cache', async (_req: AuthRequest, res: Response) => {
  const result = await clearCache();
  res.json({ success: true, data: result });
});

export default quickbooksRouter;
