import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { getValidAccessToken, getConnectionStatus } from './microsoft-oauth.js';
import { resolveEmailDeliveryTarget } from './email-routing.js';

// Email configuration from environment variables
const EMAIL_HOST = process.env.EMAIL_HOST || 'smtp.office365.com';
const EMAIL_PORT = parseInt(process.env.EMAIL_PORT || '587', 10);
const EMAIL_SECURE = process.env.EMAIL_SECURE === 'true';
const EMAIL_USER = process.env.EMAIL_USER || '';
const EMAIL_PASS = process.env.EMAIL_PASS || '';
const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@wildesigns.com';
const APP_URL = process.env.APP_URL || 'http://localhost:5173';
const COMPANY_NAME = process.env.COMPANY_NAME || 'Wilde Signs';
const EMAIL_DEV_OVERRIDE_TO = process.env.EMAIL_DEV_OVERRIDE_TO || 'approvals@wilde-signs.com';
const EMAIL_DEV_OVERRIDE_ENABLED = (process.env.NODE_ENV ?? 'development') !== 'production';

// Email enabled flag (may also be enabled by OAuth — checked dynamically)
const PASSWORD_AUTH_ENABLED = !!(EMAIL_USER && EMAIL_PASS);

// ──── DEBUG: Dump config on module load ────
console.log('📧 ===== EMAIL SERVICE CONFIG =====');
console.log('📧  EMAIL_HOST     :', EMAIL_HOST);
console.log('📧  EMAIL_PORT     :', EMAIL_PORT);
console.log('📧  EMAIL_SECURE   :', EMAIL_SECURE);
console.log('📧  EMAIL_USER     :', EMAIL_USER || '(empty)');
console.log('📧  EMAIL_PASS     :', EMAIL_PASS ? `(set, ${EMAIL_PASS.length} chars)` : '(empty)');
console.log('📧  EMAIL_FROM     :', EMAIL_FROM);
console.log('📧  PASSWORD_AUTH  :', PASSWORD_AUTH_ENABLED);
console.log(
  '📧  DEV_OVERRIDE   :',
  EMAIL_DEV_OVERRIDE_ENABLED ? `enabled -> ${EMAIL_DEV_OVERRIDE_TO}` : 'disabled',
);
console.log('📧  APP_URL        :', APP_URL);
console.log('📧  COMPANY_NAME   :', COMPANY_NAME);
console.log('📧  (OAuth2 status checked at runtime)');
console.log('📧 ================================');

let passwordTransporter: Transporter | null = null;

// Create a transporter using password auth (legacy)
function getPasswordTransporter(): Transporter | null {
  if (!PASSWORD_AUTH_ENABLED) {
    return null;
  }

  if (!passwordTransporter) {
    console.log('📧 [getPasswordTransporter] Creating password-auth transport...');
    passwordTransporter = nodemailer.createTransport({
      host: EMAIL_HOST,
      port: EMAIL_PORT,
      secure: EMAIL_SECURE,
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
      },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 30_000,
      logger: !!process.env.EMAIL_DEBUG,
      debug: !!process.env.EMAIL_DEBUG,
    } as any);
  }
  return passwordTransporter;
}

// Create a one-shot transporter using OAuth2 access token
function createOAuth2Transporter(accessToken: string, userEmail: string): Transporter {
  console.log('📧 [createOAuth2Transporter] Creating XOAUTH2 transport for %s', userEmail);
  return nodemailer.createTransport({
    host: 'smtp.office365.com',
    port: 587,
    secure: false,
    auth: {
      type: 'OAuth2',
      user: userEmail,
      accessToken: accessToken,
    },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
    logger: !!process.env.EMAIL_DEBUG,
    debug: !!process.env.EMAIL_DEBUG,
  } as any);
}

/**
 * Get a working transporter. Prefers OAuth2, falls back to password auth.
 * Returns null if no auth method is available.
 */
async function getTransporter(): Promise<Transporter | null> {
  // Try OAuth2 first — this is the preferred method
  const oauthToken = await getValidAccessToken();
  if (oauthToken) {
    console.log('📧 [getTransporter] Using OAuth2 (XOAUTH2) for %s', oauthToken.email);
    return createOAuth2Transporter(oauthToken.accessToken, oauthToken.email);
  }

  // Fall back to password auth
  const pwTransport = getPasswordTransporter();
  if (pwTransport) {
    console.log('📧 [getTransporter] Using password auth for %s', EMAIL_USER);
    return pwTransport;
  }

  console.log('📧 [getTransporter] SKIPPED - No auth available (no OAuth2 token, no password)');
  return null;
}

// Verify the transporter connection
export async function verifyEmailConnection(): Promise<boolean> {
  console.log('📧 [verifyEmailConnection] Starting SMTP connection test...');
  const transport = await getTransporter();
  if (!transport) {
    console.log('📧 [verifyEmailConnection] No transport available — cannot verify');
    return false;
  }
  
  try {
    console.log('📧 [verifyEmailConnection] Calling transport.verify()...');
    await transport.verify();
    console.log('📧 ✅ Email connection VERIFIED — SMTP handshake successful');
    return true;
  } catch (error: any) {
    console.log('📧 ❌ Email connection FAILED');
    console.log('📧   Error code   :', error?.code);
    console.log('📧   Error command :', error?.command);
    console.log('📧   Response code :', error?.responseCode);
    console.log('📧   Response      :', error?.response);
    console.log('📧   Full error    :', error);
    return false;
  }
}

// Common email template wrapper
function wrapInTemplate(content: string, title: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
      background-color: #f5f5f5;
    }
    .container {
      max-width: 600px;
      margin: 20px auto;
      background: #fff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      background: #1e40af;
      color: #fff;
      padding: 24px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    .content {
      padding: 32px 24px;
    }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background: #1e40af;
      color: #fff !important;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 500;
      margin: 16px 0;
    }
    .button:hover {
      background: #1d4ed8;
    }
    .footer {
      background: #f9fafb;
      padding: 16px 24px;
      text-align: center;
      font-size: 12px;
      color: #6b7280;
      border-top: 1px solid #e5e7eb;
    }
    .info-box {
      background: #f0f9ff;
      border: 1px solid #bae6fd;
      border-radius: 6px;
      padding: 16px;
      margin: 16px 0;
    }
    .info-row {
      display: flex;
      margin: 8px 0;
    }
    .info-label {
      font-weight: 600;
      min-width: 120px;
      color: #374151;
    }
    .info-value {
      color: #1f2937;
    }
    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .status-pending { background: #fef3c7; color: #92400e; }
    .status-progress { background: #dbeafe; color: #1e40af; }
    .status-complete { background: #d1fae5; color: #065f46; }
    .status-shipped { background: #e0e7ff; color: #4338ca; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${COMPANY_NAME}</h1>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} ${COMPANY_NAME}. All rights reserved.</p>
      <p>This is an automated message. Please do not reply directly to this email.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

function buildDevEmailOverrideHeaders(originalTo: string, effectiveTo: string): Record<string, string> {
  return {
    'X-Original-To': originalTo,
    'X-Dev-Email-Override': effectiveTo,
  };
}

// Send a generic email
export async function sendEmail(options: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}): Promise<boolean> {
  console.log('📧 [sendEmail] ─────────────────────────');
  console.log('📧   To      :', options.to);
  console.log('📧   Subject :', options.subject);
  console.log('📧   HTML len:', options.html?.length ?? 0);

  const deliveryTarget = resolveEmailDeliveryTarget(options.to);
  if (deliveryTarget.overridden) {
    console.warn(
      `📧 [sendEmail] DEV OVERRIDE active: "${deliveryTarget.originalTo}" -> "${deliveryTarget.effectiveTo}"`,
    );
  }

  const transport = await getTransporter();
  if (!transport) {
    console.log('📧 [sendEmail] SKIPPED — no transport available (no OAuth2 token, no password auth)');
    return false;
  }

  // Determine the "from" address — use OAuth account email if available
  const oauthToken = await getValidAccessToken();
  const fromEmail = oauthToken ? oauthToken.email : EMAIL_FROM;

  const envelope = {
    from: `"${COMPANY_NAME}" <${fromEmail}>`,
    to: deliveryTarget.effectiveTo,
    subject: options.subject,
    html: options.html,
    text: options.text,
    ...(deliveryTarget.overridden
      ? { headers: buildDevEmailOverrideHeaders(deliveryTarget.originalTo, deliveryTarget.effectiveTo) }
      : {}),
  };
  console.log('📧 [sendEmail] Envelope from:', envelope.from);
  console.log('📧 [sendEmail] Envelope to  :', envelope.to);

  try {
    const info = await transport.sendMail(envelope);
    console.log('📧 ✅ Email SENT successfully');
    console.log('📧   messageId :', info.messageId);
    console.log('📧   response  :', info.response);
    console.log('📧   accepted  :', info.accepted);
    console.log('📧   rejected  :', info.rejected);
    return true;
  } catch (error: any) {
    console.error('\n' + '!'.repeat(60));
    console.error('!!!  EMAIL SEND FAILED  !!!');
    console.error('!'.repeat(60));
    console.error('  To        :', envelope.to);
    console.error('  Subject   :', envelope.subject);
    console.error('  Error code:', error?.code);
    console.error('  SMTP cmd  :', error?.command);
    console.error('  Response  :', error?.responseCode, error?.response);
    console.error('  Message   :', error?.message);
    console.error('!'.repeat(60) + '\n');
    // THROW so callers know the email failed — do NOT silently swallow
    throw error;
  }
}

// ===== Order-related Emails =====

export interface OrderEmailData {
  orderNumber: string;
  orderId: string;
  customerName: string;
  description: string;
  status: string;
  dueDate?: Date | null;
  lineItems?: Array<{
    itemNumber: string;
    description: string;
    quantity: number;
  }>;
}

// New order created notification
export async function sendOrderCreatedEmail(to: string | string[], order: OrderEmailData): Promise<boolean> {
  const orderLink = `${APP_URL}/orders/${order.orderId}`;
  const dueDateStr = order.dueDate ? new Date(order.dueDate).toLocaleDateString() : 'Not set';

  const lineItemsHtml = order.lineItems?.length
    ? `
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <thead>
          <tr style="background: #f3f4f6;">
            <th style="padding: 8px; text-align: left; border: 1px solid #e5e7eb;">Item #</th>
            <th style="padding: 8px; text-align: left; border: 1px solid #e5e7eb;">Description</th>
            <th style="padding: 8px; text-align: right; border: 1px solid #e5e7eb;">Qty</th>
          </tr>
        </thead>
        <tbody>
          ${order.lineItems.map(item => `
            <tr>
              <td style="padding: 8px; border: 1px solid #e5e7eb;">${item.itemNumber}</td>
              <td style="padding: 8px; border: 1px solid #e5e7eb;">${item.description}</td>
              <td style="padding: 8px; text-align: right; border: 1px solid #e5e7eb;">${item.quantity}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `
    : '';

  const content = `
    <h2 style="margin-top: 0;">New Order Created</h2>
    <p>A new work order has been created and is ready for processing.</p>
    
    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Order Number:</span>
        <span class="info-value"><strong>${order.orderNumber}</strong></span>
      </div>
      <div class="info-row">
        <span class="info-label">Customer:</span>
        <span class="info-value">${order.customerName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Description:</span>
        <span class="info-value">${order.description}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Due Date:</span>
        <span class="info-value">${dueDateStr}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Status:</span>
        <span class="info-value"><span class="status-badge status-pending">${order.status}</span></span>
      </div>
    </div>

    ${lineItemsHtml}
    
    <a href="${orderLink}" class="button">View Order Details</a>
  `;

  return sendEmail({
    to,
    subject: `New Order Created: ${order.orderNumber} - ${order.customerName}`,
    html: wrapInTemplate(content, 'New Order Created'),
  });
}

// Order status changed notification
export async function sendOrderStatusChangedEmail(
  to: string | string[],
  order: OrderEmailData,
  oldStatus: string,
  newStatus: string
): Promise<boolean> {
  const orderLink = `${APP_URL}/orders/${order.orderId}`;
  
  // Determine status badge class
  let statusClass = 'status-pending';
  if (newStatus === 'IN_PROGRESS') statusClass = 'status-progress';
  else if (newStatus === 'COMPLETE') statusClass = 'status-complete';
  else if (newStatus === 'SHIPPED') statusClass = 'status-shipped';

  const content = `
    <h2 style="margin-top: 0;">Order Status Updated</h2>
    <p>The status of order <strong>${order.orderNumber}</strong> has been updated.</p>
    
    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Order Number:</span>
        <span class="info-value"><strong>${order.orderNumber}</strong></span>
      </div>
      <div class="info-row">
        <span class="info-label">Customer:</span>
        <span class="info-value">${order.customerName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Previous Status:</span>
        <span class="info-value">${oldStatus}</span>
      </div>
      <div class="info-row">
        <span class="info-label">New Status:</span>
        <span class="info-value"><span class="status-badge ${statusClass}">${newStatus}</span></span>
      </div>
    </div>
    
    <a href="${orderLink}" class="button">View Order</a>
  `;

  return sendEmail({
    to,
    subject: `Order ${order.orderNumber} Status: ${newStatus.replace('_', ' ')}`,
    html: wrapInTemplate(content, 'Order Status Updated'),
  });
}

// Order assigned notification
export async function sendOrderAssignedEmail(to: string, order: OrderEmailData): Promise<boolean> {
  const orderLink = `${APP_URL}/orders/${order.orderId}`;
  const dueDateStr = order.dueDate ? new Date(order.dueDate).toLocaleDateString() : 'Not set';

  const content = `
    <h2 style="margin-top: 0;">Order Assigned to You</h2>
    <p>You have been assigned to a work order. Please review the details below.</p>
    
    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Order Number:</span>
        <span class="info-value"><strong>${order.orderNumber}</strong></span>
      </div>
      <div class="info-row">
        <span class="info-label">Customer:</span>
        <span class="info-value">${order.customerName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Description:</span>
        <span class="info-value">${order.description}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Due Date:</span>
        <span class="info-value">${dueDateStr}</span>
      </div>
    </div>
    
    <a href="${orderLink}" class="button">View Order Details</a>
  `;

  return sendEmail({
    to,
    subject: `Order Assigned: ${order.orderNumber} - ${order.customerName}`,
    html: wrapInTemplate(content, 'Order Assigned'),
  });
}

// ===== Quote-related Emails =====

export interface QuoteEmailData {
  quoteNumber: string;
  quoteId: string;
  customerName: string;
  customerEmail?: string;
  description?: string;
  total: number;
  validUntil?: Date | null;
  lineItems?: Array<{
    itemNumber: string;
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
}

// Quote sent to customer
export async function sendQuoteToCustomerEmail(to: string, quote: QuoteEmailData): Promise<boolean> {
  const validUntilStr = quote.validUntil ? new Date(quote.validUntil).toLocaleDateString() : 'Contact us for details';

  const lineItemsHtml = quote.lineItems?.length
    ? `
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <thead>
          <tr style="background: #f3f4f6;">
            <th style="padding: 8px; text-align: left; border: 1px solid #e5e7eb;">Item</th>
            <th style="padding: 8px; text-align: left; border: 1px solid #e5e7eb;">Description</th>
            <th style="padding: 8px; text-align: right; border: 1px solid #e5e7eb;">Qty</th>
            <th style="padding: 8px; text-align: right; border: 1px solid #e5e7eb;">Price</th>
            <th style="padding: 8px; text-align: right; border: 1px solid #e5e7eb;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${quote.lineItems.map(item => `
            <tr>
              <td style="padding: 8px; border: 1px solid #e5e7eb;">${item.itemNumber}</td>
              <td style="padding: 8px; border: 1px solid #e5e7eb;">${item.description}</td>
              <td style="padding: 8px; text-align: right; border: 1px solid #e5e7eb;">${item.quantity}</td>
              <td style="padding: 8px; text-align: right; border: 1px solid #e5e7eb;">$${item.unitPrice.toFixed(2)}</td>
              <td style="padding: 8px; text-align: right; border: 1px solid #e5e7eb;">$${item.totalPrice.toFixed(2)}</td>
            </tr>
          `).join('')}
          <tr style="background: #f3f4f6; font-weight: 600;">
            <td colspan="4" style="padding: 8px; text-align: right; border: 1px solid #e5e7eb;">Total:</td>
            <td style="padding: 8px; text-align: right; border: 1px solid #e5e7eb;">$${quote.total.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
    `
    : `<p style="font-size: 24px; font-weight: 600;">Total: $${quote.total.toFixed(2)}</p>`;

  const content = `
    <h2 style="margin-top: 0;">Your Quote from ${COMPANY_NAME}</h2>
    <p>Hello${quote.customerName ? ` ${quote.customerName}` : ''},</p>
    <p>Thank you for your interest! Please find your quote details below.</p>
    
    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Quote Number:</span>
        <span class="info-value"><strong>${quote.quoteNumber}</strong></span>
      </div>
      ${quote.description ? `
      <div class="info-row">
        <span class="info-label">Description:</span>
        <span class="info-value">${quote.description}</span>
      </div>
      ` : ''}
      <div class="info-row">
        <span class="info-label">Valid Until:</span>
        <span class="info-value">${validUntilStr}</span>
      </div>
    </div>

    ${lineItemsHtml}
    
    <p>If you have any questions or would like to proceed with this quote, please don't hesitate to contact us.</p>
    
    <p>Best regards,<br>${COMPANY_NAME}</p>
  `;

  return sendEmail({
    to,
    subject: `Quote ${quote.quoteNumber} from ${COMPANY_NAME}`,
    html: wrapInTemplate(content, 'Your Quote'),
  });
}

// Quote approved notification (internal)
export async function sendQuoteApprovedEmail(to: string | string[], quote: QuoteEmailData): Promise<boolean> {
  const quoteLink = `${APP_URL}/quotes/${quote.quoteId}`;

  const content = `
    <h2 style="margin-top: 0;">Quote Approved!</h2>
    <p>Great news! Quote <strong>${quote.quoteNumber}</strong> has been approved by the customer.</p>
    
    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Quote Number:</span>
        <span class="info-value"><strong>${quote.quoteNumber}</strong></span>
      </div>
      <div class="info-row">
        <span class="info-label">Customer:</span>
        <span class="info-value">${quote.customerName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Total Value:</span>
        <span class="info-value"><strong>$${quote.total.toFixed(2)}</strong></span>
      </div>
    </div>
    
    <p>Please proceed with converting this quote to a work order.</p>
    
    <a href="${quoteLink}" class="button">View Quote</a>
  `;

  return sendEmail({
    to,
    subject: `Quote Approved: ${quote.quoteNumber} - $${quote.total.toFixed(2)}`,
    html: wrapInTemplate(content, 'Quote Approved'),
  });
}

// ===== Time Off Emails =====

export interface TimeOffEmailData {
  userName: string;
  userEmail: string;
  startDate: Date;
  endDate: Date;
  reason?: string;
  status: 'APPROVED' | 'DENIED';
  denialReason?: string;
}

// Time off request submitted (to managers)
export async function sendTimeOffRequestEmail(to: string | string[], data: TimeOffEmailData): Promise<boolean> {
  const startStr = new Date(data.startDate).toLocaleDateString();
  const endStr = new Date(data.endDate).toLocaleDateString();

  const content = `
    <h2 style="margin-top: 0;">Time Off Request</h2>
    <p>A time off request has been submitted for review.</p>
    
    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Employee:</span>
        <span class="info-value"><strong>${data.userName}</strong></span>
      </div>
      <div class="info-row">
        <span class="info-label">Start Date:</span>
        <span class="info-value">${startStr}</span>
      </div>
      <div class="info-row">
        <span class="info-label">End Date:</span>
        <span class="info-value">${endStr}</span>
      </div>
      ${data.reason ? `
      <div class="info-row">
        <span class="info-label">Reason:</span>
        <span class="info-value">${data.reason}</span>
      </div>
      ` : ''}
    </div>
    
    <a href="${APP_URL}/users" class="button">Review Request</a>
  `;

  return sendEmail({
    to,
    subject: `Time Off Request: ${data.userName} (${startStr} - ${endStr})`,
    html: wrapInTemplate(content, 'Time Off Request'),
  });
}

// Time off response (to employee)
export async function sendTimeOffResponseEmail(data: TimeOffEmailData): Promise<boolean> {
  const startStr = new Date(data.startDate).toLocaleDateString();
  const endStr = new Date(data.endDate).toLocaleDateString();
  const approved = data.status === 'APPROVED';

  const content = `
    <h2 style="margin-top: 0;">Time Off ${approved ? 'Approved' : 'Denied'}</h2>
    <p>Your time off request has been ${approved ? 'approved' : 'denied'}.</p>
    
    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Start Date:</span>
        <span class="info-value">${startStr}</span>
      </div>
      <div class="info-row">
        <span class="info-label">End Date:</span>
        <span class="info-value">${endStr}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Status:</span>
        <span class="info-value">
          <span class="status-badge ${approved ? 'status-complete' : 'status-pending'}">${data.status}</span>
        </span>
      </div>
      ${data.denialReason ? `
      <div class="info-row">
        <span class="info-label">Reason:</span>
        <span class="info-value">${data.denialReason}</span>
      </div>
      ` : ''}
    </div>
    
    ${approved ? '<p>Enjoy your time off!</p>' : '<p>Please contact your manager if you have any questions.</p>'}
  `;

  return sendEmail({
    to: data.userEmail,
    subject: `Time Off ${approved ? 'Approved' : 'Denied'}: ${startStr} - ${endStr}`,
    html: wrapInTemplate(content, `Time Off ${approved ? 'Approved' : 'Denied'}`),
  });
}

// ===== Portal-related Emails =====

const PORTAL_URL = process.env.PORTAL_URL || 'http://localhost:5174';

export interface PortalUserEmailData {
  email: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  token?: string;
}

// Portal user registration verification email
export async function sendPortalVerificationEmail(data: PortalUserEmailData): Promise<boolean> {
  const verifyLink = `${PORTAL_URL}/verify-email?token=${data.token}`;
  const name = data.firstName || data.companyName || 'Customer';

  const content = `
    <h2 style="margin-top: 0;">Welcome to ${COMPANY_NAME} Customer Portal</h2>
    <p>Hi ${name},</p>
    <p>Thank you for registering with our customer portal. Please verify your email address to complete your registration.</p>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="${verifyLink}" class="button">Verify Email Address</a>
    </div>
    
    <p style="color: #6b7280; font-size: 14px;">
      If you didn't create an account with us, you can safely ignore this email.
    </p>
    <p style="color: #6b7280; font-size: 14px;">
      This link will expire in 24 hours.
    </p>
  `;

  return sendEmail({
    to: data.email,
    subject: `Verify Your Email - ${COMPANY_NAME} Customer Portal`,
    html: wrapInTemplate(content, 'Verify Your Email'),
  });
}

// Portal password reset email
export async function sendPortalPasswordResetEmail(data: PortalUserEmailData): Promise<boolean> {
  const resetLink = `${PORTAL_URL}/reset-password?token=${data.token}`;
  const name = data.firstName || 'Customer';

  const content = `
    <h2 style="margin-top: 0;">Reset Your Password</h2>
    <p>Hi ${name},</p>
    <p>We received a request to reset your password. Click the button below to create a new password.</p>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="${resetLink}" class="button">Reset Password</a>
    </div>
    
    <p style="color: #6b7280; font-size: 14px;">
      If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
    </p>
    <p style="color: #6b7280; font-size: 14px;">
      This link will expire in 1 hour for security reasons.
    </p>
  `;

  return sendEmail({
    to: data.email,
    subject: `Password Reset Request - ${COMPANY_NAME} Customer Portal`,
    html: wrapInTemplate(content, 'Reset Your Password'),
  });
}

// Portal proof ready for review notification
export interface ProofNotificationData {
  customerEmail: string;
  customerName: string;
  orderNumber: string;
  orderId: string;
  proofNumber: number;
  notes?: string;
}

export async function sendProofReadyEmail(data: ProofNotificationData): Promise<boolean> {
  const proofLink = `${PORTAL_URL}/orders/${data.orderId}`;

  const content = `
    <h2 style="margin-top: 0;">Proof Ready for Review</h2>
    <p>Hi ${data.customerName},</p>
    <p>A new proof is ready for your review on order <strong>${data.orderNumber}</strong>.</p>
    
    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Order Number:</span>
        <span class="info-value"><strong>${data.orderNumber}</strong></span>
      </div>
      <div class="info-row">
        <span class="info-label">Proof Version:</span>
        <span class="info-value">#${data.proofNumber}</span>
      </div>
      ${data.notes ? `
      <div class="info-row">
        <span class="info-label">Notes:</span>
        <span class="info-value">${data.notes}</span>
      </div>
      ` : ''}
    </div>
    
    <p>Please log in to the customer portal to review and approve the proof.</p>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="${proofLink}" class="button">Review Proof</a>
    </div>
    
    <p style="color: #6b7280; font-size: 14px;">
      Your feedback helps us ensure your order is exactly what you want before production begins.
    </p>
  `;

  return sendEmail({
    to: data.customerEmail,
    subject: `Proof Ready for Review - Order ${data.orderNumber}`,
    html: wrapInTemplate(content, 'Proof Ready for Review'),
  });
}

// Portal customer responded to proof notification (to staff)
export interface ProofResponseNotificationData {
  staffEmail: string | string[];
  customerName: string;
  orderNumber: string;
  orderId: string;
  proofNumber: number;
  approved: boolean;
  feedback?: string;
}

export async function sendProofResponseNotificationEmail(data: ProofResponseNotificationData): Promise<boolean> {
  const orderLink = `${APP_URL}/orders/${data.orderId}`;

  const content = `
    <h2 style="margin-top: 0;">Customer Proof ${data.approved ? 'Approved' : 'Feedback Received'}</h2>
    <p>The customer has responded to the proof for order <strong>${data.orderNumber}</strong>.</p>
    
    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Order Number:</span>
        <span class="info-value"><strong>${data.orderNumber}</strong></span>
      </div>
      <div class="info-row">
        <span class="info-label">Customer:</span>
        <span class="info-value">${data.customerName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Proof Version:</span>
        <span class="info-value">#${data.proofNumber}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Status:</span>
        <span class="info-value">
          <span class="status-badge ${data.approved ? 'status-complete' : 'status-pending'}">
            ${data.approved ? 'APPROVED' : 'REVISION REQUESTED'}
          </span>
        </span>
      </div>
      ${data.feedback ? `
      <div style="margin-top: 12px;">
        <span class="info-label">Customer Feedback:</span>
        <p style="margin: 8px 0; padding: 12px; background: #fff; border-radius: 4px; border: 1px solid #e5e7eb;">
          ${data.feedback}
        </p>
      </div>
      ` : ''}
    </div>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="${orderLink}" class="button">View Order</a>
    </div>
  `;

  return sendEmail({
    to: data.staffEmail,
    subject: `Proof ${data.approved ? 'Approved' : 'Revision Requested'} - Order ${data.orderNumber}`,
    html: wrapInTemplate(content, `Proof ${data.approved ? 'Approved' : 'Revision Requested'}`),
  });
}

// Portal new message notification
export interface PortalMessageNotificationData {
  recipientEmail: string;
  recipientName: string;
  senderName: string;
  orderNumber?: string;
  orderId?: string;
  messagePreview: string;
  isToCustomer: boolean; // true = staff to customer, false = customer to staff
}

export async function sendNewMessageNotificationEmail(data: PortalMessageNotificationData): Promise<boolean> {
  const messageLink = data.orderId 
    ? (data.isToCustomer ? `${PORTAL_URL}/orders/${data.orderId}` : `${APP_URL}/orders/${data.orderId}`)
    : (data.isToCustomer ? PORTAL_URL : APP_URL);

  const content = `
    <h2 style="margin-top: 0;">New Message Received</h2>
    <p>Hi ${data.recipientName},</p>
    <p>You have received a new message from <strong>${data.senderName}</strong>${data.orderNumber ? ` regarding order <strong>${data.orderNumber}</strong>` : ''}.</p>
    
    <div class="info-box">
      <p style="margin: 0; font-style: italic; color: #4b5563;">
        "${data.messagePreview.length > 200 ? data.messagePreview.substring(0, 200) + '...' : data.messagePreview}"
      </p>
    </div>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="${messageLink}" class="button">View Message</a>
    </div>
  `;

  return sendEmail({
    to: data.recipientEmail,
    subject: `New Message${data.orderNumber ? ` - Order ${data.orderNumber}` : ''} - ${COMPANY_NAME}`,
    html: wrapInTemplate(content, 'New Message'),
  });
}

// ===== Initialization =====

// Initialize email service on startup
export async function initEmailService(): Promise<void> {
  // Check OAuth2 connection first (preferred)
  const oauthStatus = await getConnectionStatus();
  
  if (oauthStatus.connected) {
    console.log('\n' + '='.repeat(60));
    console.log('  ✅ EMAIL SERVICE: Microsoft OAuth2 Connected');
    console.log('     Account  : %s', oauthStatus.email);
    console.log('     Expires  : %s', oauthStatus.expiresAt?.toISOString());
    console.log('     Method   : XOAUTH2 (auto-refresh)');
    console.log('='.repeat(60) + '\n');
    
    // Verify the connection actually works
    const ok = await verifyEmailConnection();
    if (!ok) {
      console.warn('📧 ⚠️  OAuth2 connected but SMTP verify failed — token may need refresh');
    }
    return;
  }

  if (oauthStatus.configured && !oauthStatus.connected) {
    console.log('📧 Microsoft OAuth is configured but not yet connected.');
    console.log('📧 An admin needs to go to Settings → Email → Connect Microsoft Email.');
  }

  // Fall back to password auth check
  if (PASSWORD_AUTH_ENABLED) {
    const ok = await verifyEmailConnection();
    if (ok) {
      console.log('\n' + '='.repeat(60));
      console.log('  ✅ EMAIL SERVICE: Password Auth Connected');
      console.log('     SMTP Host : %s:%d', EMAIL_HOST, EMAIL_PORT);
      console.log('     From      : %s', EMAIL_FROM);
      console.log('='.repeat(60) + '\n');
    } else {
      console.error('\n' + '!'.repeat(60));
      console.error('  ❌ EMAIL SERVICE: VERIFICATION FAILED');
      console.error('     SMTP Host : %s:%d', EMAIL_HOST, EMAIL_PORT);
      console.error('     User      : %s', EMAIL_USER);
      console.error('     Pass      : %s chars (check credentials!)', EMAIL_PASS.length);
      console.error('     Emails WILL FAIL until this is resolved!');
      console.error('!'.repeat(60) + '\n');
    }
  } else {
    console.warn('\n' + '~'.repeat(60));
    console.warn('  ⚠️  EMAIL SERVICE: NO AUTH CONFIGURED');
    console.warn('     Option 1: Connect Microsoft Email via Settings (OAuth2 — recommended)');
    console.warn('     Option 2: Set EMAIL_USER + EMAIL_PASS in .env (password auth)');
    console.warn('~'.repeat(60) + '\n');
  }
}
