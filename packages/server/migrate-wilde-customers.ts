/**
 * Wilde Signs Customer Migration Script
 * 
 * Reads WILDE SIGNS CUSTOMER LIST.xlsm and imports customers to the ERP
 * with normalized phone numbers, addresses, and consistent formatting.
 * 
 * Excludes: Balance, Balance Total (as requested)
 */

import { PrismaClient } from '@prisma/client';
import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

// Column index mapping based on Excel headers
const COL = {
  ACTIVE_STATUS: 0,
  CUSTOMER: 1,
  BALANCE: 2,        // Skip
  BALANCE_TOTAL: 3,  // Skip
  COMPANY: 4,
  SALUTATION: 5,
  FIRST_NAME: 6,
  MIDDLE_INITIAL: 7,
  LAST_NAME: 8,
  PRIMARY_CONTACT: 9,
  MAIN_PHONE: 10,
  FAX: 11,
  ALT_PHONE: 12,
  SECONDARY_CONTACT: 13,
  JOB_TITLE: 14,
  MAIN_EMAIL: 15,
  BILL_TO_1: 16,
  BILL_TO_2: 17,
  BILL_TO_3: 18,
  BILL_TO_4: 19,
  BILL_TO_5: 20,
  SHIP_TO_1: 21,
  SHIP_TO_2: 22,
  SHIP_TO_3: 23,
  SHIP_TO_4: 24,
  SHIP_TO_5: 25,
  CUSTOMER_TYPE: 26,
  TERMS: 27,
  REP: 28,
  SALES_TAX_CODE: 29,
  TAX_ITEM: 30,
  RESALE_NUM: 31,
  ACCOUNT_NO: 32,
  CREDIT_LIMIT: 33,
  // Job fields (34-39) - skipping for customer migration
};

/**
 * Normalize phone number to consistent format: (XXX) XXX-XXXX
 * Handles various input formats and extracts extension if present
 */
function normalizePhone(phone: string | null | undefined): { phone: string | null; note: string | null } {
  if (!phone || phone === 'null') return { phone: null, note: null };
  
  const original = String(phone).trim();
  if (!original) return { phone: null, note: null };
  
  // Check for special notes like "CELL:", "EXT.", etc.
  let note: string | null = null;
  let cleaned = original.toUpperCase();
  
  // Extract cell phone indicator
  if (cleaned.includes('CELL')) {
    note = 'Cell';
  }
  
  // Extract extension
  const extMatch = cleaned.match(/EXT\.?\s*(\d+)/i);
  let extension = '';
  if (extMatch) {
    extension = ` ext. ${extMatch[1]}`;
  }
  
  // Remove all non-digit characters except for extension extraction
  const digits = original.replace(/[^\d]/g, '');
  
  // Handle different digit lengths
  if (digits.length === 10) {
    // Standard US number
    const formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    return { phone: formatted + extension, note };
  } else if (digits.length === 11 && digits.startsWith('1')) {
    // US number with country code
    const formatted = `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 11)}`;
    return { phone: formatted + extension, note };
  } else if (digits.length === 7) {
    // Local number (no area code) - just format with dashes
    const formatted = `${digits.slice(0, 3)}-${digits.slice(3, 7)}`;
    return { phone: formatted + extension, note };
  } else if (digits.length > 10) {
    // International or number with extension already
    const formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    const rest = digits.slice(10);
    if (rest && !extension) {
      extension = ` ext. ${rest}`;
    }
    return { phone: formatted + extension, note };
  } else if (digits.length < 7) {
    // Too short - return original
    return { phone: original, note };
  }
  
  // Fallback: return digits formatted as best as possible
  return { phone: original, note };
}

/**
 * Normalize email address
 */
function normalizeEmail(email: string | null | undefined): string | null {
  if (!email || email === 'null') return null;
  
  const cleaned = String(email).trim().toLowerCase();
  
  // Basic email validation
  if (!cleaned.includes('@') || !cleaned.includes('.')) {
    return null;
  }
  
  // Fix common typos
  let normalized = cleaned
    .replace(/\s+/g, '') // Remove spaces
    .replace(/,/g, '.'); // Sometimes commas instead of dots
  
  return normalized || null;
}

/**
 * Normalize text field - proper case, trim, etc.
 */
function normalizeText(text: string | null | undefined): string | null {
  if (!text || text === 'null') return null;
  
  const cleaned = String(text).trim();
  if (!cleaned || cleaned === '.') return null;
  
  return cleaned;
}

/**
 * Title case a string
 */
function toTitleCase(str: string): string {
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Normalize address line
 */
function normalizeAddressLine(line: string | null | undefined): string | null {
  if (!line || line === 'null') return null;
  
  let cleaned = String(line).trim();
  if (!cleaned || cleaned === '.') return null;
  
  // Remove excessive spaces
  cleaned = cleaned.replace(/\s+/g, ' ');
  
  return cleaned;
}

/**
 * Parse city, state, zip from address lines (QB format: "CITY, ST  ZIPCODE")
 */
function parseCityStateZip(line: string | null): { city: string | null; state: string | null; zip: string | null } {
  if (!line) return { city: null, state: null, zip: null };
  
  const cleaned = line.trim();
  
  // Match pattern: "CITY, STATE ZIPCODE" or "CITY, STATE  ZIPCODE"
  const match = cleaned.match(/^([^,]+),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i);
  
  if (match) {
    return {
      city: toTitleCase(match[1].trim()),
      state: match[2].toUpperCase(),
      zip: match[3]
    };
  }
  
  return { city: null, state: null, zip: null };
}

/**
 * Normalize payment terms to consistent format
 */
function normalizePaymentTerms(terms: string | null | undefined): string | null {
  if (!terms || terms === 'null') return null;
  
  const cleaned = String(terms).trim().toUpperCase();
  
  const termsMap: Record<string, string> = {
    'NET-30': 'Net 30',
    'NET 30': 'Net 30',
    'NET-45': 'Net 45',
    'NET-60': 'Net 60',
    'NET-15': 'Net 15',
    'NET 15': 'Net 15',
    'NET 10': 'Net 10',
    'PRE-PAY': 'Pre-Pay',
    'PREPAY': 'Pre-Pay',
    'DUE ON RECEIPT': 'Due on Receipt',
    'COD': 'COD',
    'CREDIT CARD': 'Credit Card',
    'VISA': 'Credit Card',
    'MASTERCARD': 'Credit Card',
    '50%DEPOSIT/DOR': '50% Deposit / Due on Receipt',
    '50%DEPOSIT/NET30': '50% Deposit / Net 30',
    '50%DOR/NET30': '50% Due on Receipt / Net 30',
    '75% DEPOSIT/DOR': '75% Deposit / Due on Receipt',
    '1% 10 NET 30': '1% 10 Net 30',
    '2%15 NET 30': '2% 15 Net 30',
    '2% 10 NET 30': '2% 10 Net 30',
    '4.5%60/NET 120': '4.5% 60 Net 120',
    '4.5%60/NET120': '4.5% 60 Net 120',
  };
  
  return termsMap[cleaned] || toTitleCase(cleaned.toLowerCase());
}

/**
 * Normalize sales rep initials
 */
function normalizeSalesRep(rep: string | null | undefined): string | null {
  if (!rep || rep === 'null') return null;
  return String(rep).trim().toUpperCase() || null;
}

/**
 * Normalize customer type
 */
function normalizeCustomerType(type: string | null | undefined): string | null {
  if (!type || type === 'null') return null;
  
  const cleaned = String(type).trim();
  
  const typeMap: Record<string, string> = {
    'WALK IN': 'Walk-In',
    'PHONE BOOK': 'Phone Book',
    'REFERRAL': 'Referral',
    'TRADE SHOW': 'Trade Show',
    'CORPORATE': 'Corporate',
    'CATALOG MAILING': 'Catalog Mailing',
    'WEBSITE REFERAL': 'Website Referral',
    'WEBSITE REFERAL:E_COMMERCE': 'Website Referral - E-Commerce',
    'CATALOG MAILING:BROCHURE MAILING': 'Catalog/Brochure Mailing',
  };
  
  return typeMap[cleaned.toUpperCase()] || cleaned;
}

interface CustomerData {
  name: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  fax: string | null;
  altPhone: string | null;
  salutation: string | null;
  firstName: string | null;
  middleInitial: string | null;
  lastName: string | null;
  primaryContact: string | null;
  secondaryContact: string | null;
  jobTitle: string | null;
  billToLine1: string | null;
  billToLine2: string | null;
  billToLine3: string | null;
  billToLine4: string | null;
  billToLine5: string | null;
  shipToLine1: string | null;
  shipToLine2: string | null;
  shipToLine3: string | null;
  shipToLine4: string | null;
  shipToLine5: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  customerType: string | null;
  paymentTerms: string | null;
  salesRep: string | null;
  salesTaxCode: string | null;
  taxItem: string | null;
  taxExempt: boolean;
  resaleNumber: string | null;
  accountNumber: string | null;
  creditLimit: number | null;
  isActive: boolean;
  notes: string | null;
}

function parseRow(row: any[]): CustomerData | null {
  const customerName = normalizeText(row[COL.CUSTOMER]);
  
  // Skip rows without a valid customer name
  if (!customerName || customerName === '.' || customerName === '0.') {
    return null;
  }
  
  // Normalize phone numbers
  const mainPhone = normalizePhone(row[COL.MAIN_PHONE]);
  const faxPhone = normalizePhone(row[COL.FAX]);
  const altPhoneResult = normalizePhone(row[COL.ALT_PHONE]);
  
  // Build notes from phone indicators
  const notesParts: string[] = [];
  if (mainPhone.note) notesParts.push(`Main: ${mainPhone.note}`);
  if (altPhoneResult.note) notesParts.push(`Alt: ${altPhoneResult.note}`);
  
  // Parse city/state/zip from billing address line 4 or 5
  let cityStateZip = parseCityStateZip(row[COL.BILL_TO_4]);
  if (!cityStateZip.city) {
    cityStateZip = parseCityStateZip(row[COL.BILL_TO_3]);
  }
  
  // Get street address (usually line 3, but could be line 2)
  let streetAddress = normalizeAddressLine(row[COL.BILL_TO_3]);
  if (!streetAddress || (cityStateZip.city && streetAddress.includes(cityStateZip.city))) {
    streetAddress = normalizeAddressLine(row[COL.BILL_TO_2]);
  }
  
  // Determine tax exemption
  const salesTaxCode = normalizeText(row[COL.SALES_TAX_CODE]);
  const taxExempt = salesTaxCode?.toUpperCase() === 'NON';
  
  // Parse credit limit
  let creditLimit: number | null = null;
  const creditLimitRaw = row[COL.CREDIT_LIMIT];
  if (creditLimitRaw && typeof creditLimitRaw === 'number' && creditLimitRaw > 0) {
    creditLimit = creditLimitRaw;
  }
  
  return {
    name: customerName,
    companyName: normalizeText(row[COL.COMPANY]),
    email: normalizeEmail(row[COL.MAIN_EMAIL]),
    phone: mainPhone.phone,
    fax: faxPhone.phone,
    altPhone: altPhoneResult.phone,
    salutation: normalizeText(row[COL.SALUTATION]),
    firstName: normalizeText(row[COL.FIRST_NAME]),
    middleInitial: normalizeText(row[COL.MIDDLE_INITIAL]),
    lastName: normalizeText(row[COL.LAST_NAME]),
    primaryContact: normalizeText(row[COL.PRIMARY_CONTACT]),
    secondaryContact: normalizeText(row[COL.SECONDARY_CONTACT]),
    jobTitle: normalizeText(row[COL.JOB_TITLE]),
    billToLine1: normalizeAddressLine(row[COL.BILL_TO_1]),
    billToLine2: normalizeAddressLine(row[COL.BILL_TO_2]),
    billToLine3: normalizeAddressLine(row[COL.BILL_TO_3]),
    billToLine4: normalizeAddressLine(row[COL.BILL_TO_4]),
    billToLine5: normalizeAddressLine(row[COL.BILL_TO_5]),
    shipToLine1: normalizeAddressLine(row[COL.SHIP_TO_1]),
    shipToLine2: normalizeAddressLine(row[COL.SHIP_TO_2]),
    shipToLine3: normalizeAddressLine(row[COL.SHIP_TO_3]),
    shipToLine4: normalizeAddressLine(row[COL.SHIP_TO_4]),
    shipToLine5: normalizeAddressLine(row[COL.SHIP_TO_5]),
    address: streetAddress,
    city: cityStateZip.city,
    state: cityStateZip.state,
    zipCode: cityStateZip.zip,
    customerType: normalizeCustomerType(row[COL.CUSTOMER_TYPE]),
    paymentTerms: normalizePaymentTerms(row[COL.TERMS]),
    salesRep: normalizeSalesRep(row[COL.REP]),
    salesTaxCode: normalizeText(row[COL.SALES_TAX_CODE]),
    taxItem: normalizeText(row[COL.TAX_ITEM]),
    taxExempt,
    resaleNumber: normalizeText(row[COL.RESALE_NUM]),
    accountNumber: normalizeText(row[COL.ACCOUNT_NO]),
    creditLimit,
    isActive: String(row[COL.ACTIVE_STATUS]).toUpperCase() === 'ACTIVE',
    notes: notesParts.length > 0 ? notesParts.join('; ') : null,
  };
}

async function migrateCustomers() {
  console.log('🚀 Starting Wilde Signs Customer Migration...\n');
  
  // Read Excel file
  const filePath = path.join(__dirname, '../../docs/WILDE SIGNS CUSTOMER LIST.xlsm');
  console.log(`📂 Reading: ${filePath}`);
  
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets['Sheet1'];
  const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  console.log(`📊 Found ${data.length - 1} rows (excluding header)\n`);
  
  // Skip header row
  const customerRows = data.slice(1);
  
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  
  // Process in batches for progress reporting
  const batchSize = 100;
  
  for (let i = 0; i < customerRows.length; i += batchSize) {
    const batch = customerRows.slice(i, i + batchSize);
    
    for (const row of batch) {
      try {
        const customerData = parseRow(row);
        
        if (!customerData) {
          skipped++;
          continue;
        }
        
        // Check if customer already exists by name
        const existing = await prisma.customer.findFirst({
          where: { name: customerData.name }
        });
        
        if (existing) {
          // Update existing customer
          await prisma.customer.update({
            where: { id: existing.id },
            data: customerData
          });
          updated++;
        } else {
          // Create new customer
          await prisma.customer.create({
            data: customerData
          });
          created++;
        }
      } catch (error) {
        errors++;
        console.error(`❌ Error processing row: ${row[COL.CUSTOMER]}`, error);
      }
    }
    
    // Progress update
    const progress = Math.min(i + batchSize, customerRows.length);
    console.log(`📈 Progress: ${progress}/${customerRows.length} (${Math.round(progress / customerRows.length * 100)}%)`);
  }
  
  console.log('\n✅ Migration Complete!');
  console.log(`   Created: ${created}`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors:  ${errors}`);
  
  // Show some sample normalized data
  console.log('\n📋 Sample Normalized Customers:');
  const samples = await prisma.customer.findMany({
    take: 5,
    orderBy: { name: 'asc' },
    where: { phone: { not: null } }
  });
  
  for (const customer of samples) {
    console.log(`\n   ${customer.name}`);
    console.log(`   Phone: ${customer.phone}`);
    if (customer.altPhone) console.log(`   Alt:   ${customer.altPhone}`);
    console.log(`   Email: ${customer.email || 'N/A'}`);
    console.log(`   Terms: ${customer.paymentTerms || 'N/A'}`);
    console.log(`   Rep:   ${customer.salesRep || 'N/A'}`);
  }
}

// Run migration
migrateCustomers()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
