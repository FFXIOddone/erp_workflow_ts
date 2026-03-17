/**
 * QuickBooks Desktop Integration Service (READ-ONLY)
 * 
 * This service provides read-only integration with QuickBooks Desktop
 * running on the local network at CHRISTINA-NEW.
 * 
 * IMPORTANT: This is a READ-ONLY connection. No modifications to QuickBooks data are allowed.
 * 
 * Connection Methods:
 * 1. ODBC Driver - Uses QuickBooks ODBC Driver for direct SQL-like queries
 * 2. Web Connector - SOAP-based sync (requires QWC file setup on CHRISTINA-NEW)
 * 
 * Setup Requirements:
 * 1. Install QuickBooks ODBC Driver on the server running this app
 * 2. Configure DSN pointing to CHRISTINA-NEW QuickBooks company file
 * 3. Set environment variables:
 *    - QB_HOST=CHRISTINA-NEW
 *    - QB_DSN=QuickBooks Data
 *    - QB_COMPANY_FILE=C:\path\to\company.qbw (on CHRISTINA-NEW)
 * 
 * @module services/quickbooks
 */

import type {
  QBCustomer,
  QBInvoice,
  QBItem,
  QBEstimate,
  QBSalesOrder,
  QBAddress,
  QBInvoiceLineItem,
  QBConnectionStatus,
  QBPayment,
  QBPaymentAppliedTo,
} from '@erp/shared';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';

// Configuration from environment
const QB_CONFIG = {
  host: process.env.QB_HOST ?? 'wildesigns3cx',
  dsn: process.env.QB_DSN ?? 'QuickBooks Data',
  companyFile: process.env.QB_COMPANY_FILE ?? '\\\\192.168.254.4\\New Shared Quick Books Folder\\Wilde Signs LLC.QBW',
  connectionTimeout: parseInt(process.env.QB_CONNECTION_TIMEOUT ?? '30000', 10),
};

// Connection state
let connectionStatus: QBConnectionStatus = {
  connected: false,
  serverHost: QB_CONFIG.host,
  companyFile: QB_CONFIG.companyFile || null,
  lastSync: null,
  error: null,
};

// ODBC connection pool (lazy-loaded)
let odbcPool: unknown = null;

// Connection cooldown — avoid hammering ODBC when QB is offline
let lastConnectionFailure: number = 0;
const CONNECTION_COOLDOWN_MS = 60_000; // Don't retry for 60s after a failure
const PER_ATTEMPT_TIMEOUT_MS = 8_000;  // Each ODBC attempt gets 8 seconds max

// Company file paths
const LOCAL_COMPANY_FILE = process.env.QB_LOCAL_COMPANY_FILE 
  ?? 'C:\\Users\\Jake\\OneDrive - Wilde Signs\\Desktop\\DevTeam\\Quickbooks DB\\Wilde Signs LLC.QBW';

// Remote company file on the actual QB server — this is the live, authoritative copy
const REMOTE_COMPANY_FILE = process.env.QB_REMOTE_COMPANY_FILE
  ?? '\\\\192.168.254.4\\New Shared Quick Books Folder\\Wilde Signs LLC.QBW';

/**
 * Parse a QuickBooks .ND (Network Descriptor) file to discover DB engine name and port.
 * QB creates these alongside the .QBW file when it's open or hosted by QBDBMgrN.
 */
function parseNDFile(qbwPath: string): { engineName: string | null; port: number | null; serverIp: string | null; dbGuid: string | null } {
  const ndPath = qbwPath + '.ND';
  const result = { engineName: null as string | null, port: null as number | null, serverIp: null as string | null, dbGuid: null as string | null };

  if (!existsSync(ndPath)) return result;

  try {
    const content = readFileSync(ndPath, 'utf-8');
    const engineMatch = content.match(/EngineName=(.+)/);
    const portMatch = content.match(/ServerPort=(\d+)/);
    const ipMatch = content.match(/ServerIp=(.+)/);
    const guidMatch = content.match(/FileConnectionGuid=(.+)/);
    if (engineMatch) result.engineName = engineMatch[1].trim();
    if (portMatch) result.port = parseInt(portMatch[1].trim(), 10);
    if (ipMatch) result.serverIp = ipMatch[1].trim();
    if (guidMatch) result.dbGuid = guidMatch[1].trim();
    console.log(`📄 Parsed .ND file: engine=${result.engineName}, port=${result.port}, ip=${result.serverIp}, guid=${result.dbGuid}`);
  } catch (err) {
    console.log(`⚠️ Failed to parse .ND file: ${err}`);
  }
  return result;
}

/**
 * Parse a QuickBooks .DSN file to get the exact connection parameters QB clients use.
 * This is the most reliable source — it's what QuickBooks itself uses to connect.
 */
function parseDSNFile(qbwPath: string): { serverName: string | null; commLinks: string | null; databaseName: string | null } {
  const dsnPath = qbwPath + '.DSN';
  const result = { serverName: null as string | null, commLinks: null as string | null, databaseName: null as string | null };

  if (!existsSync(dsnPath)) {
    console.log(`📄 No .DSN file found at ${dsnPath}`);
    return result;
  }

  try {
    const content = readFileSync(dsnPath, 'utf-8');
    const serverMatch = content.match(/ServerName=(.+)/);
    const commMatch = content.match(/CommLinks=(.+)/);
    const dbMatch = content.match(/DatabaseName=(.+)/);
    if (serverMatch) result.serverName = serverMatch[1].trim();
    if (commMatch) result.commLinks = commMatch[1].trim();
    if (dbMatch) result.databaseName = dbMatch[1].trim();
    console.log(`📄 Parsed .DSN file: server=${result.serverName}, commLinks=${result.commLinks}, db=${result.databaseName}`);
  } catch (err) {
    console.log(`⚠️ Failed to parse .DSN file: ${err}`);
  }
  return result;
}

/**
 * Initialize ODBC connection to QuickBooks
 * Uses dynamic import since odbc is an optional dependency
 * 
 * Connection strategy (tries in order):
 * 1. Remote .ND file discovery — reads the .ND file from the network share to get
 *    the LIVE engine name, IP, and port from the actual QB server (wildesigns3cx)
 * 2. Local .ND file — fallback if the company file was opened locally
 * 3. DSN-based connection — uses the configured ODBC DSN (QB)
 */
async function getOdbcConnection(): Promise<unknown> {
  if (odbcPool) {
    return odbcPool;
  }

  // Fast-fail if we recently failed and are within cooldown window
  const timeSinceLastFailure = Date.now() - lastConnectionFailure;
  if (lastConnectionFailure > 0 && timeSinceLastFailure < CONNECTION_COOLDOWN_MS) {
    const remainingSec = Math.ceil((CONNECTION_COOLDOWN_MS - timeSinceLastFailure) / 1000);
    throw new Error(`Connection cooldown active (${remainingSec}s remaining). Last attempt failed.`);
  }

  // Dynamic import for optional ODBC dependency
  const odbc = await import('odbc');

  // Try remote .ND + .DSN file first (the live QB server share), then local
  const remoteND = parseNDFile(REMOTE_COMPANY_FILE);
  const remoteDSN = parseDSNFile(REMOTE_COMPANY_FILE);
  const localND = parseNDFile(LOCAL_COMPANY_FILE);

  // Build connection attempts list — prioritize the exact format from the .DSN file
  const connectionAttempts: { name: string; connectionString: string }[] = [];

  // Strategy 1: Use .DSN file format exactly (most reliable — this is what QB clients use)
  if (remoteDSN.serverName && remoteDSN.commLinks) {
    const dbName = remoteDSN.databaseName ? `;DatabaseName=${remoteDSN.databaseName}` : '';
    connectionAttempts.push({
      name: `Remote DSN (${remoteDSN.serverName})`,
      connectionString: `Driver={QB SQL Anywhere};ServerName=${remoteDSN.serverName};CommLinks=${remoteDSN.commLinks};Integrated=NO;Compress=NO;AutoStop=NO${dbName}`,
    });
  }

  // Strategy 2: Use .ND file info with TCPIP{HOST} format (matches .DSN CommLinks format)
  if (remoteND.engineName && remoteND.port && remoteND.serverIp) {
    const dbName = remoteND.dbGuid ? `;DatabaseName=${remoteND.dbGuid}` : '';
    connectionAttempts.push({
      name: `Remote ND (${remoteND.engineName} @ ${remoteND.serverIp}:${remoteND.port})`,
      connectionString: `Driver={QB SQL Anywhere};ServerName=${remoteND.engineName};CommLinks=TCPIP{HOST=${remoteND.serverIp}:${remoteND.port}};Integrated=NO;Compress=NO;AutoStop=NO${dbName}`,
    });
  }

  if (localND.engineName && localND.port) {
    connectionAttempts.push({
      name: `Local ND (${localND.engineName}:${localND.port})`,
      connectionString: `Driver={QB SQL Anywhere};ServerName=${localND.engineName};CommLinks=TCPIP{HOST=127.0.0.1:${localND.port}};Integrated=NO;Compress=NO;AutoStop=NO`,
    });
  }

  // DSN fallback  
  connectionAttempts.push(
    {
      name: 'DSN (QB)',
      connectionString: 'DSN=QB',
    },
  );

  let lastError: Error | null = null;

  for (const attempt of connectionAttempts) {
    try {
      console.log(`🔌 Attempting QuickBooks ODBC connection via ${attempt.name}...`);
      
      // Wrap each attempt in a timeout to avoid blocking for minutes
      odbcPool = await Promise.race([
        odbc.pool(attempt.connectionString),
        new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout after ${PER_ATTEMPT_TIMEOUT_MS}ms`)), PER_ATTEMPT_TIMEOUT_MS)),
      ]);
      
      // Verify the pool actually works by running a simple query (also with timeout)
      const pool = odbcPool as { query: (sql: string) => Promise<unknown[]> };
      await Promise.race([
        pool.query('SELECT TOP 1 ListID FROM Customer'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Verification query timeout')), PER_ATTEMPT_TIMEOUT_MS)),
      ]);
      
      connectionStatus = {
        connected: true,
        serverHost: attempt.name,
        companyFile: REMOTE_COMPANY_FILE,
        lastSync: new Date(),
        error: null,
      };
      
      console.log(`✅ QuickBooks ODBC connection established via ${attempt.name}`);
      return odbcPool;
    } catch (error) {
      odbcPool = null; // Reset pool on failure so next attempt starts fresh
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorDetails = error instanceof Error && 'odbcErrors' in error 
        ? JSON.stringify((error as { odbcErrors: unknown[] }).odbcErrors) 
        : '';
      console.log(`⚠️ ${attempt.name} connection failed: ${errorMessage}${errorDetails ? ` - ${errorDetails}` : ''}`);
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  // All attempts failed — record the failure time for cooldown
  lastConnectionFailure = Date.now();
  const errorMessage = lastError?.message ?? 'All connection attempts failed';
  const errorDetails = lastError && 'odbcErrors' in lastError 
    ? JSON.stringify((lastError as { odbcErrors: unknown[] }).odbcErrors) 
    : '';
  connectionStatus = {
    connected: false,
    serverHost: QB_CONFIG.host,
    companyFile: null,
    lastSync: null,
    error: `ODBC connection failed: ${errorMessage}${errorDetails ? ` - Details: ${errorDetails}` : ''}`,
  };
  console.error('❌ All QuickBooks ODBC connection attempts failed');
  throw lastError ?? new Error('All connection attempts failed');
}

/**
 * Reset the connection pool — forces next call to re-establish
 */
export function resetConnection(): void {
  odbcPool = null;
  lastConnectionFailure = 0; // Clear cooldown so next request retries immediately
  connectionStatus = {
    connected: false,
    serverHost: QB_CONFIG.host,
    companyFile: QB_CONFIG.companyFile || null,
    lastSync: null,
    error: null,
  };
  console.log('🔄 QuickBooks connection pool reset (cooldown cleared)');
}

/**
 * Execute a read-only query against QuickBooks via ODBC
 */
async function executeQuery<T>(sql: string): Promise<T[]> {
  // Safety check: Only allow SELECT statements (READ-ONLY)
  const normalizedSql = sql.trim().toUpperCase();
  if (!normalizedSql.startsWith('SELECT')) {
    throw new Error('Only SELECT queries are allowed. QuickBooks connection is READ-ONLY.');
  }
  
  // Block any potential injection attempts
  const dangerousKeywords = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 'TRUNCATE', 'EXEC', 'EXECUTE'];
  for (const keyword of dangerousKeywords) {
    if (normalizedSql.includes(keyword)) {
      throw new Error(`Dangerous keyword "${keyword}" detected. QuickBooks connection is READ-ONLY.`);
    }
  }

  try {
    const pool = await getOdbcConnection() as { query: (sql: string) => Promise<T[]> };
    const results = await pool.query(sql);
    connectionStatus.lastSync = new Date();
    return results;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Query failed';
    console.error('QuickBooks query error:', errorMessage);
    throw new Error(`QuickBooks query failed: ${errorMessage}`);
  }
}

/**
 * Get current connection status
 */
export function getConnectionStatus(): QBConnectionStatus {
  return { ...connectionStatus };
}

/**
 * Test QuickBooks connection
 */
export async function testConnection(): Promise<QBConnectionStatus> {
  try {
    await getOdbcConnection();
    // Try a simple query to verify actual connectivity
    await executeQuery('SELECT TOP 1 ListID FROM Customer');
    return getConnectionStatus();
  } catch (error) {
    return getConnectionStatus();
  }
}

// ============ CUSTOMER QUERIES (READ-ONLY) ============

/**
 * Get all active customers from QuickBooks
 */
export async function getCustomers(options?: {
  activeOnly?: boolean;
  limit?: number;
  search?: string;
}): Promise<QBCustomer[]> {
  const { activeOnly = true, limit = 1000, search } = options ?? {};
  
  let sql = `
    SELECT TOP ${limit}
      ListID, Name, FullName, CompanyName, FirstName, LastName,
      Email, Phone, AltPhone, Fax,
      BillAddressAddr1, BillAddressAddr2, BillAddressAddr3,
      BillAddressCity, BillAddressState, BillAddressPostalCode, BillAddressCountry,
      ShipAddressAddr1, ShipAddressAddr2, ShipAddressAddr3,
      ShipAddressCity, ShipAddressState, ShipAddressPostalCode, ShipAddressCountry,
      Balance, TotalBalance, IsActive, EditSequence, TimeCreated, TimeModified
    FROM Customer
    WHERE 1=1
  `;
  
  if (activeOnly) {
    sql += ` AND IsActive = 1`;
  }
  
  if (search) {
    const safeSearch = search.replace(/'/g, "''");
    sql += ` AND (Name LIKE '%${safeSearch}%' OR FullName LIKE '%${safeSearch}%' OR CompanyName LIKE '%${safeSearch}%')`;
  }
  
  sql += ` ORDER BY FullName`;
  
  const rows = await executeQuery<Record<string, unknown>>(sql);
  
  return rows.map(mapRowToCustomer);
}

/**
 * Get a single customer by ListID
 */
export async function getCustomerById(listId: string): Promise<QBCustomer | null> {
  const safeListId = listId.replace(/'/g, "''");
  
  const sql = `
    SELECT
      ListID, Name, FullName, CompanyName, FirstName, LastName,
      Email, Phone, AltPhone, Fax,
      BillAddressAddr1, BillAddressAddr2, BillAddressAddr3,
      BillAddressCity, BillAddressState, BillAddressPostalCode, BillAddressCountry,
      ShipAddressAddr1, ShipAddressAddr2, ShipAddressAddr3,
      ShipAddressCity, ShipAddressState, ShipAddressPostalCode, ShipAddressCountry,
      Balance, TotalBalance, IsActive, EditSequence, TimeCreated, TimeModified
    FROM Customer
    WHERE ListID = '${safeListId}'
  `;
  
  const rows = await executeQuery<Record<string, unknown>>(sql);
  
  return rows.length > 0 ? mapRowToCustomer(rows[0]) : null;
}

// ============ INVOICE QUERIES (READ-ONLY) ============

/**
 * Get invoices from QuickBooks
 */
export async function getInvoices(options?: {
  customerId?: string;
  fromDate?: Date;
  toDate?: Date;
  unpaidOnly?: boolean;
  limit?: number;
}): Promise<QBInvoice[]> {
  const { customerId, fromDate, toDate, unpaidOnly = false, limit = 500 } = options ?? {};
  
  let sql = `
    SELECT TOP ${limit}
      TxnID, TxnNumber, RefNumber,
      CustomerRefListID, CustomerRefFullName,
      TxnDate, DueDate, ShipDate,
      Subtotal, SalesTaxTotal, AppliedAmount, BalanceRemaining,
      IsPaid, IsPending, Memo, PONumber,
      EditSequence, TimeCreated, TimeModified
    FROM Invoice
    WHERE 1=1
  `;
  
  if (customerId) {
    const safeId = customerId.replace(/'/g, "''");
    sql += ` AND CustomerRefListID = '${safeId}'`;
  }
  
  if (fromDate) {
    sql += ` AND TxnDate >= {d '${fromDate.toISOString().split('T')[0]}'}`;
  }
  
  if (toDate) {
    sql += ` AND TxnDate <= {d '${toDate.toISOString().split('T')[0]}'}`;
  }
  
  if (unpaidOnly) {
    sql += ` AND IsPaid = 0`;
  }
  
  sql += ` ORDER BY TxnDate DESC`;
  
  const rows = await executeQuery<Record<string, unknown>>(sql);
  
  // Fetch line items for each invoice
  const invoices: QBInvoice[] = [];
  for (const row of rows) {
    const invoice = mapRowToInvoice(row);
    invoice.lineItems = await getInvoiceLineItems(invoice.txnId);
    invoices.push(invoice);
  }
  
  return invoices;
}

/**
 * Get invoice line items
 */
async function getInvoiceLineItems(txnId: string): Promise<QBInvoiceLineItem[]> {
  const safeTxnId = txnId.replace(/'/g, "''");
  
  const sql = `
    SELECT
      TxnLineID, ItemRefListID, ItemRefFullName,
      Description, Quantity, UnitOfMeasure, Rate, Amount
    FROM InvoiceLine
    WHERE InvoiceTxnID = '${safeTxnId}'
    ORDER BY TxnLineID
  `;
  
  const rows = await executeQuery<Record<string, unknown>>(sql);
  
  return rows.map(mapRowToLineItem);
}

/**
 * Get a single invoice by TxnID
 */
export async function getInvoiceById(txnId: string): Promise<QBInvoice | null> {
  const safeTxnId = txnId.replace(/'/g, "''");
  
  const sql = `
    SELECT
      TxnID, TxnNumber, RefNumber,
      CustomerRefListID, CustomerRefFullName,
      TxnDate, DueDate, ShipDate,
      Subtotal, SalesTaxTotal, AppliedAmount, BalanceRemaining,
      IsPaid, IsPending, Memo, PONumber,
      EditSequence, TimeCreated, TimeModified
    FROM Invoice
    WHERE TxnID = '${safeTxnId}'
  `;
  
  const rows = await executeQuery<Record<string, unknown>>(sql);
  
  if (rows.length === 0) return null;
  
  const invoice = mapRowToInvoice(rows[0]);
  invoice.lineItems = await getInvoiceLineItems(invoice.txnId);
  
  return invoice;
}

// ============ ITEM QUERIES (READ-ONLY) ============

/**
 * Get items (products/services) from QuickBooks
 */
export async function getItems(options?: {
  activeOnly?: boolean;
  type?: string;
  limit?: number;
  search?: string;
}): Promise<QBItem[]> {
  const { activeOnly = true, type, limit = 1000, search } = options ?? {};
  
  // Query from the combined Item table
  let sql = `
    SELECT TOP ${limit}
      ListID, Name, FullName, Type,
      Description, Price, Cost, IsActive,
      QuantityOnHand, QuantityOnOrder,
      EditSequence, TimeCreated, TimeModified
    FROM Item
    WHERE 1=1
  `;
  
  if (activeOnly) {
    sql += ` AND IsActive = 1`;
  }
  
  if (type) {
    const safeType = type.replace(/'/g, "''");
    sql += ` AND Type = '${safeType}'`;
  }
  
  if (search) {
    const safeSearch = search.replace(/'/g, "''");
    sql += ` AND (Name LIKE '%${safeSearch}%' OR FullName LIKE '%${safeSearch}%' OR Description LIKE '%${safeSearch}%')`;
  }
  
  sql += ` ORDER BY FullName`;
  
  const rows = await executeQuery<Record<string, unknown>>(sql);
  
  return rows.map(mapRowToItem);
}

/**
 * Get a single item by ListID
 */
export async function getItemById(listId: string): Promise<QBItem | null> {
  const safeListId = listId.replace(/'/g, "''");
  
  const sql = `
    SELECT
      ListID, Name, FullName, Type,
      Description, Price, Cost, IsActive,
      QuantityOnHand, QuantityOnOrder,
      EditSequence, TimeCreated, TimeModified
    FROM Item
    WHERE ListID = '${safeListId}'
  `;
  
  const rows = await executeQuery<Record<string, unknown>>(sql);
  
  return rows.length > 0 ? mapRowToItem(rows[0]) : null;
}

// ============ ESTIMATE QUERIES (READ-ONLY) ============

/**
 * Get estimates from QuickBooks
 */
export async function getEstimates(options?: {
  customerId?: string;
  fromDate?: Date;
  toDate?: Date;
  activeOnly?: boolean;
  limit?: number;
}): Promise<QBEstimate[]> {
  const { customerId, fromDate, toDate, activeOnly = true, limit = 500 } = options ?? {};
  
  let sql = `
    SELECT TOP ${limit}
      TxnID, TxnNumber, RefNumber,
      CustomerRefListID, CustomerRefFullName,
      TxnDate, DueDate,
      Subtotal, SalesTaxTotal, TotalAmount,
      IsActive, Memo, PONumber,
      EditSequence, TimeCreated, TimeModified
    FROM Estimate
    WHERE 1=1
  `;
  
  if (customerId) {
    const safeId = customerId.replace(/'/g, "''");
    sql += ` AND CustomerRefListID = '${safeId}'`;
  }
  
  if (fromDate) {
    sql += ` AND TxnDate >= {d '${fromDate.toISOString().split('T')[0]}'}`;
  }
  
  if (toDate) {
    sql += ` AND TxnDate <= {d '${toDate.toISOString().split('T')[0]}'}`;
  }
  
  if (activeOnly) {
    sql += ` AND IsActive = 1`;
  }
  
  sql += ` ORDER BY TxnDate DESC`;
  
  const rows = await executeQuery<Record<string, unknown>>(sql);
  
  // Fetch line items for each estimate
  const estimates: QBEstimate[] = [];
  for (const row of rows) {
    const estimate = mapRowToEstimate(row);
    estimate.lineItems = await getEstimateLineItems(estimate.txnId);
    estimates.push(estimate);
  }
  
  return estimates;
}

/**
 * Get estimate line items
 */
async function getEstimateLineItems(txnId: string): Promise<QBInvoiceLineItem[]> {
  const safeTxnId = txnId.replace(/'/g, "''");
  
  const sql = `
    SELECT
      TxnLineID, ItemRefListID, ItemRefFullName,
      Description, Quantity, UnitOfMeasure, Rate, Amount
    FROM EstimateLine
    WHERE EstimateTxnID = '${safeTxnId}'
    ORDER BY TxnLineID
  `;
  
  const rows = await executeQuery<Record<string, unknown>>(sql);
  
  return rows.map(mapRowToLineItem);
}

// ============ SALES ORDER QUERIES (READ-ONLY) ============

/**
 * Get sales orders from QuickBooks
 */
export async function getSalesOrders(options?: {
  customerId?: string;
  fromDate?: Date;
  toDate?: Date;
  openOnly?: boolean;
  limit?: number;
}): Promise<QBSalesOrder[]> {
  const { customerId, fromDate, toDate, openOnly = false, limit = 500 } = options ?? {};
  
  let sql = `
    SELECT TOP ${limit}
      TxnID, TxnNumber, RefNumber,
      CustomerRefListID, CustomerRefFullName,
      TxnDate, DueDate, ShipDate,
      Subtotal, SalesTaxTotal, TotalAmount,
      IsManuallyClosed, IsFullyInvoiced, Memo, PONumber,
      EditSequence, TimeCreated, TimeModified
    FROM SalesOrder
    WHERE 1=1
  `;
  
  if (customerId) {
    const safeId = customerId.replace(/'/g, "''");
    sql += ` AND CustomerRefListID = '${safeId}'`;
  }
  
  if (fromDate) {
    sql += ` AND TxnDate >= {d '${fromDate.toISOString().split('T')[0]}'}`;
  }
  
  if (toDate) {
    sql += ` AND TxnDate <= {d '${toDate.toISOString().split('T')[0]}'}`;
  }
  
  if (openOnly) {
    sql += ` AND IsManuallyClosed = 0 AND IsFullyInvoiced = 0`;
  }
  
  sql += ` ORDER BY TxnDate DESC`;
  
  const rows = await executeQuery<Record<string, unknown>>(sql);
  
  // Fetch line items for each sales order
  const salesOrders: QBSalesOrder[] = [];
  for (const row of rows) {
    const salesOrder = mapRowToSalesOrder(row);
    salesOrder.lineItems = await getSalesOrderLineItems(salesOrder.txnId);
    salesOrders.push(salesOrder);
  }
  
  return salesOrders;
}

/**
 * Get sales order line items
 */
async function getSalesOrderLineItems(txnId: string): Promise<QBInvoiceLineItem[]> {
  const safeTxnId = txnId.replace(/'/g, "''");
  
  const sql = `
    SELECT
      TxnLineID, ItemRefListID, ItemRefFullName,
      Description, Quantity, UnitOfMeasure, Rate, Amount
    FROM SalesOrderLine
    WHERE SalesOrderTxnID = '${safeTxnId}'
    ORDER BY TxnLineID
  `;
  
  const rows = await executeQuery<Record<string, unknown>>(sql);
  
  return rows.map(mapRowToLineItem);
}

// ============ PAYMENT QUERIES (READ-ONLY) ============

/**
 * Get received payments from QuickBooks
 */
export async function getPayments(options?: {
  customerId?: string;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
}): Promise<QBPayment[]> {
  const { customerId, fromDate, toDate, limit = 500 } = options ?? {};
  
  let sql = `
    SELECT TOP ${limit}
      TxnID, TxnNumber, RefNumber,
      CustomerRefListID, CustomerRefFullName,
      TxnDate, TotalAmount,
      PaymentMethodRefFullName, DepositToAccountRefFullName,
      Memo, EditSequence, TimeCreated, TimeModified
    FROM ReceivePayment
    WHERE 1=1
  `;
  
  if (customerId) {
    const safeId = customerId.replace(/'/g, "''");
    sql += ` AND CustomerRefListID = '${safeId}'`;
  }
  
  if (fromDate) {
    sql += ` AND TxnDate >= {d '${fromDate.toISOString().split('T')[0]}'}`;
  }
  
  if (toDate) {
    sql += ` AND TxnDate <= {d '${toDate.toISOString().split('T')[0]}'}`;
  }
  
  sql += ` ORDER BY TxnDate DESC`;
  
  const rows = await executeQuery<Record<string, unknown>>(sql);
  
  // Fetch applied invoices for each payment
  const payments: QBPayment[] = [];
  for (const row of rows) {
    const payment = mapRowToPayment(row);
    payment.appliedToInvoices = await getPaymentAppliedToInvoices(payment.txnId);
    payments.push(payment);
  }
  
  return payments;
}

/**
 * Get invoices a payment was applied to
 */
async function getPaymentAppliedToInvoices(txnId: string): Promise<QBPaymentAppliedTo[]> {
  const safeTxnId = txnId.replace(/'/g, "''");
  
  const sql = `
    SELECT
      TxnID, RefNumber, AppliedAmount, BalanceRemaining
    FROM ReceivePaymentAppliedTo
    WHERE ReceivePaymentTxnID = '${safeTxnId}'
  `;
  
  try {
    const rows = await executeQuery<Record<string, unknown>>(sql);
    return rows.map((row) => ({
      invoiceTxnId: String(row.TxnID ?? ''),
      invoiceRefNumber: row.RefNumber ? String(row.RefNumber) : null,
      appliedAmount: Number(row.AppliedAmount ?? 0),
      balanceRemaining: Number(row.BalanceRemaining ?? 0),
    }));
  } catch {
    // Table might not exist or be accessible
    return [];
  }
}

/**
 * Map row to QBPayment object
 */
function mapRowToPayment(row: Record<string, unknown>): QBPayment {
  return {
    txnId: String(row.TxnID ?? ''),
    txnNumber: String(row.TxnNumber ?? ''),
    refNumber: row.RefNumber ? String(row.RefNumber) : null,
    customerListId: String(row.CustomerRefListID ?? ''),
    customerName: String(row.CustomerRefFullName ?? ''),
    txnDate: new Date(row.TxnDate as string),
    totalAmount: Number(row.TotalAmount ?? 0),
    paymentMethodName: row.PaymentMethodRefFullName ? String(row.PaymentMethodRefFullName) : null,
    depositToAccount: row.DepositToAccountRefFullName ? String(row.DepositToAccountRefFullName) : null,
    memo: row.Memo ? String(row.Memo) : null,
    editSequence: String(row.EditSequence ?? ''),
    timeCreated: new Date(row.TimeCreated as string),
    timeModified: new Date(row.TimeModified as string),
    appliedToInvoices: [],
  };
}

// ============ HELPER FUNCTIONS ============

function mapRowToCustomer(row: Record<string, unknown>): QBCustomer {
  return {
    listId: String(row.ListID ?? ''),
    name: String(row.Name ?? ''),
    fullName: String(row.FullName ?? ''),
    companyName: row.CompanyName ? String(row.CompanyName) : null,
    firstName: row.FirstName ? String(row.FirstName) : null,
    lastName: row.LastName ? String(row.LastName) : null,
    email: row.Email ? String(row.Email) : null,
    phone: row.Phone ? String(row.Phone) : null,
    altPhone: row.AltPhone ? String(row.AltPhone) : null,
    fax: row.Fax ? String(row.Fax) : null,
    billAddress: mapAddress(row, 'BillAddress'),
    shipAddress: mapAddress(row, 'ShipAddress'),
    balance: Number(row.Balance ?? 0),
    totalBalance: Number(row.TotalBalance ?? 0),
    isActive: Boolean(row.IsActive),
    editSequence: String(row.EditSequence ?? ''),
    timeCreated: new Date(row.TimeCreated as string),
    timeModified: new Date(row.TimeModified as string),
  };
}

function mapAddress(row: Record<string, unknown>, prefix: string): QBAddress | null {
  const addr1 = row[`${prefix}Addr1`];
  const city = row[`${prefix}City`];
  
  if (!addr1 && !city) return null;
  
  return {
    addr1: row[`${prefix}Addr1`] ? String(row[`${prefix}Addr1`]) : null,
    addr2: row[`${prefix}Addr2`] ? String(row[`${prefix}Addr2`]) : null,
    addr3: row[`${prefix}Addr3`] ? String(row[`${prefix}Addr3`]) : null,
    city: row[`${prefix}City`] ? String(row[`${prefix}City`]) : null,
    state: row[`${prefix}State`] ? String(row[`${prefix}State`]) : null,
    postalCode: row[`${prefix}PostalCode`] ? String(row[`${prefix}PostalCode`]) : null,
    country: row[`${prefix}Country`] ? String(row[`${prefix}Country`]) : null,
  };
}

function mapRowToInvoice(row: Record<string, unknown>): QBInvoice {
  return {
    txnId: String(row.TxnID ?? ''),
    txnNumber: String(row.TxnNumber ?? ''),
    refNumber: row.RefNumber ? String(row.RefNumber) : null,
    customerRef: {
      listId: String(row.CustomerRefListID ?? ''),
      fullName: String(row.CustomerRefFullName ?? ''),
    },
    txnDate: new Date(row.TxnDate as string),
    dueDate: row.DueDate ? new Date(row.DueDate as string) : null,
    shipDate: row.ShipDate ? new Date(row.ShipDate as string) : null,
    subtotal: Number(row.Subtotal ?? 0),
    salesTaxTotal: Number(row.SalesTaxTotal ?? 0),
    appliedAmount: Number(row.AppliedAmount ?? 0),
    balanceRemaining: Number(row.BalanceRemaining ?? 0),
    isPaid: Boolean(row.IsPaid),
    isPending: Boolean(row.IsPending),
    memo: row.Memo ? String(row.Memo) : null,
    poNumber: row.PONumber ? String(row.PONumber) : null,
    lineItems: [],
    editSequence: String(row.EditSequence ?? ''),
    timeCreated: new Date(row.TimeCreated as string),
    timeModified: new Date(row.TimeModified as string),
  };
}

function mapRowToLineItem(row: Record<string, unknown>): QBInvoiceLineItem {
  return {
    txnLineId: String(row.TxnLineID ?? ''),
    itemRef: row.ItemRefListID ? {
      listId: String(row.ItemRefListID),
      fullName: String(row.ItemRefFullName ?? ''),
    } : null,
    description: row.Description ? String(row.Description) : null,
    quantity: row.Quantity != null ? Number(row.Quantity) : null,
    unitOfMeasure: row.UnitOfMeasure ? String(row.UnitOfMeasure) : null,
    rate: row.Rate != null ? Number(row.Rate) : null,
    amount: Number(row.Amount ?? 0),
  };
}

function mapRowToItem(row: Record<string, unknown>): QBItem {
  return {
    listId: String(row.ListID ?? ''),
    name: String(row.Name ?? ''),
    fullName: String(row.FullName ?? ''),
    type: String(row.Type ?? 'Service') as QBItem['type'],
    description: row.Description ? String(row.Description) : null,
    price: row.Price != null ? Number(row.Price) : null,
    cost: row.Cost != null ? Number(row.Cost) : null,
    isActive: Boolean(row.IsActive),
    quantityOnHand: row.QuantityOnHand != null ? Number(row.QuantityOnHand) : null,
    quantityOnOrder: row.QuantityOnOrder != null ? Number(row.QuantityOnOrder) : null,
    editSequence: String(row.EditSequence ?? ''),
    timeCreated: new Date(row.TimeCreated as string),
    timeModified: new Date(row.TimeModified as string),
  };
}

function mapRowToEstimate(row: Record<string, unknown>): QBEstimate {
  return {
    txnId: String(row.TxnID ?? ''),
    txnNumber: String(row.TxnNumber ?? ''),
    refNumber: row.RefNumber ? String(row.RefNumber) : null,
    customerRef: {
      listId: String(row.CustomerRefListID ?? ''),
      fullName: String(row.CustomerRefFullName ?? ''),
    },
    txnDate: new Date(row.TxnDate as string),
    dueDate: row.DueDate ? new Date(row.DueDate as string) : null,
    subtotal: Number(row.Subtotal ?? 0),
    salesTaxTotal: Number(row.SalesTaxTotal ?? 0),
    totalAmount: Number(row.TotalAmount ?? 0),
    isActive: Boolean(row.IsActive),
    memo: row.Memo ? String(row.Memo) : null,
    poNumber: row.PONumber ? String(row.PONumber) : null,
    lineItems: [],
    editSequence: String(row.EditSequence ?? ''),
    timeCreated: new Date(row.TimeCreated as string),
    timeModified: new Date(row.TimeModified as string),
  };
}

function mapRowToSalesOrder(row: Record<string, unknown>): QBSalesOrder {
  return {
    txnId: String(row.TxnID ?? ''),
    txnNumber: String(row.TxnNumber ?? ''),
    refNumber: row.RefNumber ? String(row.RefNumber) : null,
    customerRef: {
      listId: String(row.CustomerRefListID ?? ''),
      fullName: String(row.CustomerRefFullName ?? ''),
    },
    txnDate: new Date(row.TxnDate as string),
    dueDate: row.DueDate ? new Date(row.DueDate as string) : null,
    shipDate: row.ShipDate ? new Date(row.ShipDate as string) : null,
    subtotal: Number(row.Subtotal ?? 0),
    salesTaxTotal: Number(row.SalesTaxTotal ?? 0),
    totalAmount: Number(row.TotalAmount ?? 0),
    isManuallyClosed: Boolean(row.IsManuallyClosed),
    isFullyInvoiced: Boolean(row.IsFullyInvoiced),
    memo: row.Memo ? String(row.Memo) : null,
    poNumber: row.PONumber ? String(row.PONumber) : null,
    lineItems: [],
    editSequence: String(row.EditSequence ?? ''),
    timeCreated: new Date(row.TimeCreated as string),
    timeModified: new Date(row.TimeModified as string),
  };
}

// ============ UTILITY EXPORTS ============

export const quickbooks = {
  // Connection
  getConnectionStatus,
  testConnection,
  resetConnection,
  
  // Customers (READ-ONLY)
  getCustomers,
  getCustomerById,
  
  // Invoices (READ-ONLY)
  getInvoices,
  getInvoiceById,
  
  // Items (READ-ONLY)
  getItems,
  getItemById,
  
  // Estimates (READ-ONLY)
  getEstimates,
  
  // Sales Orders (READ-ONLY)
  getSalesOrders,
  
  // Payments (READ-ONLY)
  getPayments,
  
  // Temp Order Linking
  findMatchingQBOrder,
  validateTempOrderLink,
  
  // Line Item Sync
  getLineItemsForQBOrder,
};

// ============ TEMP ORDER LINKING ============

/**
 * Find matching QuickBooks order for a temp work order
 * 
 * This function attempts to find a matching sales order or invoice in QuickBooks
 * based on customer name, amount, date, or PO number.
 * 
 * @param criteria - Search criteria for finding QB order
 * @returns Matching QB order info or null if not found
 */
export interface TempOrderLinkCriteria {
  customerName?: string;
  poNumber?: string;
  amount?: number;
  dateRange?: { from: Date; to: Date };
  refNumber?: string; // Direct QB reference number search
}

export interface QBOrderMatch {
  type: 'salesOrder' | 'invoice' | 'estimate';
  txnId: string;
  refNumber: string | null;
  customerName: string;
  amount: number;
  date: Date;
  poNumber: string | null;
  lineItems: QBInvoiceLineItem[];
  confidence: 'high' | 'medium' | 'low';
  matchReason: string;
}

/**
 * Find matching QuickBooks orders for linking to ERP work orders.
 * Searches invoices, sales orders, and estimates by ref number, customer name, PO, and amount.
 */
export async function findMatchingQBOrder(
  criteria: TempOrderLinkCriteria
): Promise<QBOrderMatch[]> {
  console.log('[QuickBooks] findMatchingQBOrder called with criteria:', criteria);
  
  const matches: QBOrderMatch[] = [];

  // If ODBC not connected, search the local cache instead
  if (!connectionStatus.connected || !odbcPool) {
    console.log('[QuickBooks] Not connected — searching local cache');
    try {
      const { searchCache, toCachedLineItems } = await import('./quickbooks-cache.js');
      const search = criteria.refNumber ?? criteria.poNumber ?? criteria.customerName;
      if (!search) return [];
      const { orders } = await searchCache({ search, limit: 20 });
      for (const order of orders) {
        matches.push({
          type: order.type as 'invoice' | 'salesOrder' | 'estimate',
          txnId: order.txnId ?? order.id,
          refNumber: order.refNumber,
          customerName: order.customerName,
          amount: order.totalAmount,
          date: order.txnDate ?? order.snapshotDate,
          poNumber: order.poNumber,
          lineItems: toCachedLineItems(order.lineItems),
          confidence: criteria.refNumber ? 'high' : 'medium',
          matchReason: 'Cached data (QB offline)',
        });
      }
    } catch (e) {
      console.log('[QuickBooks] Cache search failed:', e);
    }
    return matches;
  }

  try {
    // 1. Search by exact reference number (highest confidence)
    if (criteria.refNumber) {
      const refNum = criteria.refNumber.trim();
      
      // Search invoices by RefNumber
      const invoiceSQL = `SELECT TxnID, RefNumber, CustomerRefFullName, TxnDate, Subtotal, TotalAmount, PONumber FROM Invoice WHERE RefNumber = '${refNum.replace(/'/g, "''")}'`;
      try {
        const invoiceRows = await executeQuery<Record<string, unknown>>(invoiceSQL);
        for (const row of invoiceRows) {
          const lineItems = await getInvoiceLineItems(String(row.TxnID));
          matches.push({
            type: 'invoice',
            txnId: String(row.TxnID),
            refNumber: String(row.RefNumber),
            customerName: String(row.CustomerRefFullName ?? ''),
            amount: Number(row.TotalAmount ?? row.Subtotal ?? 0),
            date: new Date(row.TxnDate as string),
            poNumber: row.PONumber ? String(row.PONumber) : null,
            lineItems,
            confidence: 'high',
            matchReason: 'Exact invoice number match',
          });
        }
      } catch (e) {
        console.log('[QuickBooks] Invoice search error:', e);
      }

      // Search sales orders by RefNumber
      const soSQL = `SELECT TxnID, RefNumber, CustomerRefFullName, TxnDate, Subtotal, TotalAmount, PONumber FROM SalesOrder WHERE RefNumber = '${refNum.replace(/'/g, "''")}'`;
      try {
        const soRows = await executeQuery<Record<string, unknown>>(soSQL);
        for (const row of soRows) {
          const lineItems = await getSalesOrderLineItems(String(row.TxnID));
          matches.push({
            type: 'salesOrder',
            txnId: String(row.TxnID),
            refNumber: String(row.RefNumber),
            customerName: String(row.CustomerRefFullName ?? ''),
            amount: Number(row.TotalAmount ?? row.Subtotal ?? 0),
            date: new Date(row.TxnDate as string),
            poNumber: row.PONumber ? String(row.PONumber) : null,
            lineItems,
            confidence: 'high',
            matchReason: 'Exact sales order number match',
          });
        }
      } catch (e) {
        console.log('[QuickBooks] Sales order search error:', e);
      }

      // Search estimates by RefNumber
      const estSQL = `SELECT TxnID, RefNumber, CustomerRefFullName, TxnDate, Subtotal, TotalAmount, PONumber FROM Estimate WHERE RefNumber = '${refNum.replace(/'/g, "''")}'`;
      try {
        const estRows = await executeQuery<Record<string, unknown>>(estSQL);
        for (const row of estRows) {
          const lineItems = await getEstimateLineItems(String(row.TxnID));
          matches.push({
            type: 'estimate',
            txnId: String(row.TxnID),
            refNumber: String(row.RefNumber),
            customerName: String(row.CustomerRefFullName ?? ''),
            amount: Number(row.TotalAmount ?? row.Subtotal ?? 0),
            date: new Date(row.TxnDate as string),
            poNumber: row.PONumber ? String(row.PONumber) : null,
            lineItems,
            confidence: 'high',
            matchReason: 'Exact estimate number match',
          });
        }
      } catch (e) {
        console.log('[QuickBooks] Estimate search error:', e);
      }
    }

    // 2. Search by PO number
    if (criteria.poNumber && matches.length === 0) {
      const po = criteria.poNumber.trim().replace(/'/g, "''");
      
      const poSQL = `SELECT TOP 10 TxnID, RefNumber, CustomerRefFullName, TxnDate, TotalAmount, PONumber FROM Invoice WHERE PONumber = '${po}' ORDER BY TxnDate DESC`;
      try {
        const rows = await executeQuery<Record<string, unknown>>(poSQL);
        for (const row of rows) {
          const lineItems = await getInvoiceLineItems(String(row.TxnID));
          matches.push({
            type: 'invoice',
            txnId: String(row.TxnID),
            refNumber: row.RefNumber ? String(row.RefNumber) : null,
            customerName: String(row.CustomerRefFullName ?? ''),
            amount: Number(row.TotalAmount ?? 0),
            date: new Date(row.TxnDate as string),
            poNumber: row.PONumber ? String(row.PONumber) : null,
            lineItems,
            confidence: 'high',
            matchReason: 'PO number match',
          });
        }
      } catch (e) {
        console.log('[QuickBooks] PO search error:', e);
      }
    }

    // 3. Search by customer name (medium confidence)
    if (criteria.customerName && matches.length === 0) {
      const custName = criteria.customerName.trim().replace(/'/g, "''");
      const dateFilter = criteria.dateRange 
        ? ` AND TxnDate >= {d '${criteria.dateRange.from.toISOString().split('T')[0]}'} AND TxnDate <= {d '${criteria.dateRange.to.toISOString().split('T')[0]}'}`
        : ` AND TxnDate >= {d '${new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}'}`;
      
      const custSQL = `SELECT TOP 20 TxnID, RefNumber, CustomerRefFullName, TxnDate, TotalAmount, PONumber FROM Invoice WHERE CustomerRefFullName LIKE '%${custName}%'${dateFilter} ORDER BY TxnDate DESC`;
      try {
        const rows = await executeQuery<Record<string, unknown>>(custSQL);
        for (const row of rows) {
          const amountMatch = criteria.amount && Math.abs(Number(row.TotalAmount) - criteria.amount) < 0.01;
          const lineItems = await getInvoiceLineItems(String(row.TxnID));
          matches.push({
            type: 'invoice',
            txnId: String(row.TxnID),
            refNumber: row.RefNumber ? String(row.RefNumber) : null,
            customerName: String(row.CustomerRefFullName ?? ''),
            amount: Number(row.TotalAmount ?? 0),
            date: new Date(row.TxnDate as string),
            poNumber: row.PONumber ? String(row.PONumber) : null,
            lineItems,
            confidence: amountMatch ? 'high' : 'medium',
            matchReason: amountMatch ? 'Customer + amount match' : 'Customer name match',
          });
        }
      } catch (e) {
        console.log('[QuickBooks] Customer search error:', e);
      }
    }
  } catch (error) {
    console.error('[QuickBooks] findMatchingQBOrder error:', error);
  }
  
  // Sort by confidence: high first, then medium, then low
  const confidenceOrder = { high: 0, medium: 1, low: 2 };
  matches.sort((a, b) => confidenceOrder[a.confidence] - confidenceOrder[b.confidence]);
  
  return matches;
}

/**
 * Get line items for a QB order (invoice, sales order, or estimate) by its ref number.
 * Used when linking ERP orders to QB to pull in the real line items.
 */
export async function getLineItemsForQBOrder(
  qbOrderNumber: string
): Promise<{ type: 'invoice' | 'salesOrder' | 'estimate'; txnId: string; lineItems: QBInvoiceLineItem[]; customerName: string; totalAmount: number; poNumber: string | null } | null> {
  
  // 1. Check local cache first (fast, always available)
  try {
    const { getCachedOrder, toCachedLineItems } = await import('./quickbooks-cache.js');
    const cached = await getCachedOrder(qbOrderNumber);
    if (cached) {
      console.log(`[QuickBooks] Cache hit for ${qbOrderNumber} (${cached.type})`);
      return {
        type: cached.type as 'invoice' | 'salesOrder' | 'estimate',
        txnId: cached.txnId ?? cached.id,
        lineItems: toCachedLineItems(cached.lineItems),
        customerName: cached.customerName,
        totalAmount: cached.totalAmount,
        poNumber: cached.poNumber,
      };
    }
  } catch (e) {
    console.log('[QuickBooks] Cache lookup failed, falling back to ODBC:', e);
  }

  // 2. Fall back to live ODBC if connected
  if (!connectionStatus.connected || !odbcPool) {
    console.log('[QuickBooks] Not connected and no cache hit — cannot fetch line items');
    return null;
  }

  const safeRef = qbOrderNumber.replace(/'/g, "''");

  // Try invoice first
  try {
    const invoiceRows = await executeQuery<Record<string, unknown>>(
      `SELECT TxnID, CustomerRefFullName, TotalAmount, PONumber FROM Invoice WHERE RefNumber = '${safeRef}'`
    );
    if (invoiceRows.length > 0) {
      const row = invoiceRows[0];
      const lineItems = await getInvoiceLineItems(String(row.TxnID));
      return {
        type: 'invoice',
        txnId: String(row.TxnID),
        lineItems,
        customerName: String(row.CustomerRefFullName ?? ''),
        totalAmount: Number(row.TotalAmount ?? 0),
        poNumber: row.PONumber ? String(row.PONumber) : null,
      };
    }
  } catch (e) {
    console.log('[QuickBooks] Invoice lookup error:', e);
  }

  // Try sales order
  try {
    const soRows = await executeQuery<Record<string, unknown>>(
      `SELECT TxnID, CustomerRefFullName, TotalAmount, PONumber FROM SalesOrder WHERE RefNumber = '${safeRef}'`
    );
    if (soRows.length > 0) {
      const row = soRows[0];
      const lineItems = await getSalesOrderLineItems(String(row.TxnID));
      return {
        type: 'salesOrder',
        txnId: String(row.TxnID),
        lineItems,
        customerName: String(row.CustomerRefFullName ?? ''),
        totalAmount: Number(row.TotalAmount ?? 0),
        poNumber: row.PONumber ? String(row.PONumber) : null,
      };
    }
  } catch (e) {
    console.log('[QuickBooks] Sales order lookup error:', e);
  }

  // Try estimate
  try {
    const estRows = await executeQuery<Record<string, unknown>>(
      `SELECT TxnID, CustomerRefFullName, TotalAmount, PONumber FROM Estimate WHERE RefNumber = '${safeRef}'`
    );
    if (estRows.length > 0) {
      const row = estRows[0];
      const lineItems = await getEstimateLineItems(String(row.TxnID));
      return {
        type: 'estimate',
        txnId: String(row.TxnID),
        lineItems,
        customerName: String(row.CustomerRefFullName ?? ''),
        totalAmount: Number(row.TotalAmount ?? 0),
        poNumber: row.PONumber ? String(row.PONumber) : null,
      };
    }
  } catch (e) {
    console.log('[QuickBooks] Estimate lookup error:', e);
  }

  return null;
}

/**
 * Validate that a temp work order can be linked to a specific QB order.
 * When QB is connected, actually verifies the order exists and returns its metadata.
 * When QB is offline, allows the link with a warning.
 */
export interface TempOrderValidation {
  isValid: boolean;
  qbOrderNumber: string;
  qbOrderType: 'salesOrder' | 'invoice' | 'estimate' | null;
  qbTxnId: string | null;
  issues: string[];
  warnings: string[];
  lineItems?: QBInvoiceLineItem[];
}

export async function validateTempOrderLink(
  tempOrderNumber: string,
  qbOrderNumber: string
): Promise<TempOrderValidation> {
  console.log('[QuickBooks] validateTempOrderLink called:', { tempOrderNumber, qbOrderNumber });
  
  const result: TempOrderValidation = {
    isValid: false,
    qbOrderNumber,
    qbOrderType: null,
    qbTxnId: null,
    issues: [],
    warnings: [],
  };
  
  // Check if tempOrderNumber is in correct format
  if (!tempOrderNumber.startsWith('TEMPWO-')) {
    result.issues.push('Order number is not a temp order (must start with TEMPWO-)');
    return result;
  }

  // Try to validate against QuickBooks if connected
  if (connectionStatus.connected || odbcPool) {
    try {
      const qbOrder = await getLineItemsForQBOrder(qbOrderNumber);
      if (qbOrder) {
        result.isValid = true;
        result.qbOrderType = qbOrder.type;
        result.qbTxnId = qbOrder.txnId;
        result.lineItems = qbOrder.lineItems;
        return result;
      }
      result.issues.push(`Order "${qbOrderNumber}" not found in QuickBooks (searched invoices, sales orders, and estimates)`);
      return result;
    } catch (error) {
      result.warnings.push(`QuickBooks validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // QB not connected — allow the link with a warning
  result.isValid = true;
  result.warnings.push('QuickBooks connection not active - validation skipped. Line items will sync when QB is available.');
  
  return result;
}

export default quickbooks;
