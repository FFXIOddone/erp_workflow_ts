/**
 * Email Automation Service
 * 
 * Handles triggering automated emails based on events,
 * processing the email queue, and template variable substitution.
 */

import { prisma } from '../db/client.js';
import { EmailTrigger } from '@erp/shared';
import { EmailTrigger as PrismaEmailTrigger } from '@prisma/client';
import { sendEmail } from './email.js';

// Template variable patterns like {{order.orderNumber}}, {{customer.name}}, etc.
const VARIABLE_PATTERN = /\{\{([^}]+)\}\}/g;

interface TriggerContext {
  order?: {
    id: string;
    orderNumber: string;
    description: string;
    status: string;
    dueDate: Date | null;
    customerName: string;
  };
  customer?: {
    id: string;
    name: string;
    email: string | null;
  };
  quote?: {
    id: string;
    quoteNumber: string;
    customerName: string;
    total: number;
  };
  proof?: {
    fileName: string;
    uploadedAt: Date;
  };
  shipment?: {
    trackingNumber: string | null;
    carrier: string | null;
  };
  portalUser?: {
    firstName: string;
    lastName: string;
    email: string;
  };
  [key: string]: unknown;
}

/**
 * Substitute template variables with actual values
 */
function substituteVariables(template: string, context: TriggerContext): string {
  return template.replace(VARIABLE_PATTERN, (match, path) => {
    const keys = path.trim().split('.');
    let value: unknown = context;
    
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = (value as Record<string, unknown>)[key];
      } else {
        return match; // Keep original if path not found
      }
    }
    
    if (value === null || value === undefined) {
      return '';
    }
    
    if (value instanceof Date) {
      return value.toLocaleDateString('en-US', { 
        month: 'long', 
        day: 'numeric', 
        year: 'numeric' 
      });
    }
    
    if (typeof value === 'number') {
      // Format as currency if it looks like a price
      if (path.includes('total') || path.includes('price') || path.includes('amount')) {
        return new Intl.NumberFormat('en-US', { 
          style: 'currency', 
          currency: 'USD' 
        }).format(value);
      }
      return value.toString();
    }
    
    return String(value);
  });
}

/**
 * Check if template conditions are met
 */
function evaluateConditions(
  conditions: Record<string, unknown> | null,
  context: TriggerContext
): boolean {
  if (!conditions || Object.keys(conditions).length === 0) {
    return true;
  }
  
  // Simple condition evaluation
  // Example: { "order.status": "COMPLETED" } or { "quote.total": { "$gt": 1000 } }
  for (const [path, expected] of Object.entries(conditions)) {
    const keys = path.split('.');
    let value: unknown = context;
    
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = (value as Record<string, unknown>)[key];
      } else {
        return false;
      }
    }
    
    if (typeof expected === 'object' && expected !== null) {
      const op = expected as Record<string, unknown>;
      if ('$gt' in op && !(Number(value) > Number(op.$gt))) return false;
      if ('$lt' in op && !(Number(value) < Number(op.$lt))) return false;
      if ('$gte' in op && !(Number(value) >= Number(op.$gte))) return false;
      if ('$lte' in op && !(Number(value) <= Number(op.$lte))) return false;
      if ('$ne' in op && value === op.$ne) return false;
      if ('$in' in op && !Array.isArray(op.$in)) return false;
      if ('$in' in op && Array.isArray(op.$in) && !op.$in.includes(value)) return false;
    } else if (value !== expected) {
      return false;
    }
  }
  
  return true;
}

/**
 * Trigger an email based on an event
 */
export async function triggerEmail(
  trigger: EmailTrigger,
  context: TriggerContext,
  recipientEmail?: string
): Promise<void> {
  // Find active templates for this trigger
  const templates = await prisma.emailTemplate.findMany({
    where: {
      trigger: trigger as unknown as PrismaEmailTrigger,
      isActive: true,
    },
  });
  
  if (templates.length === 0) {
    console.log(`[Email] No active templates for trigger: ${trigger}`);
    return;
  }
  
  for (const template of templates) {
    // Check conditions
    if (!evaluateConditions(template.conditions as Record<string, unknown> | null, context)) {
      console.log(`[Email] Conditions not met for template: ${template.name}`);
      continue;
    }
    
    // Determine recipient
    let email: string | undefined = recipientEmail;
    if (!email) {
      email = context.customer?.email ?? 
              context.portalUser?.email ?? 
              undefined;
    }
    
    if (!email) {
      console.warn(`[Email] No recipient email for template: ${template.name}`);
      continue;
    }
    
    // Calculate scheduled time
    const scheduledAt = template.delayMinutes > 0
      ? new Date(Date.now() + template.delayMinutes * 60 * 1000)
      : new Date();
    
    // Substitute variables
    const subject = substituteVariables(template.subject, context);
    const htmlBody = substituteVariables(template.htmlBody, context);
    const textBody = template.textBody 
      ? substituteVariables(template.textBody, context)
      : undefined;
    
    // Queue the email
    await prisma.emailQueue.create({
      data: {
        templateId: template.id,
        recipientEmail: email,
        recipientName: context.customer?.name || 
                       (context.portalUser 
                         ? `${context.portalUser.firstName} ${context.portalUser.lastName}`
                         : undefined),
        subject,
        htmlBody,
        textBody,
        scheduledAt,
        status: 'PENDING',
        orderId: context.order?.id,
        customerId: context.customer?.id,
        quoteId: context.quote?.id,
      },
    });
    
    console.log(`[Email] Queued email "${template.name}" for ${email} at ${scheduledAt}`);
  }
}

/**
 * Process pending emails in the queue
 */
export async function processEmailQueue(): Promise<{ sent: number; failed: number }> {
  const now = new Date();
  let sent = 0;
  let failed = 0;
  
  // Get pending emails that are ready to send
  const pendingEmails = await prisma.emailQueue.findMany({
    where: {
      status: 'PENDING',
      scheduledAt: { lte: now },
    },
    orderBy: { scheduledAt: 'asc' },
    take: 50, // Process in batches
  });
  
  for (const email of pendingEmails) {
    try {
      const wasSent = await sendEmail({
        to: email.recipientEmail,
        subject: email.subject,
        html: email.htmlBody,
        text: email.textBody || undefined,
      });

      if (!wasSent) {
        // sendEmail returned false — email is disabled, don't mark as SENT
        console.warn(`[Email] SKIPPED (email disabled): ${email.subject} to ${email.recipientEmail}`);
        continue;
      }
      
      await prisma.emailQueue.update({
        where: { id: email.id },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          attempts: { increment: 1 },
        },
      });
      
      sent++;
      console.log(`[Email] Sent: ${email.subject} to ${email.recipientEmail}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const attempts = email.attempts + 1;
      
      // Mark as failed after 3 attempts
      const status = attempts >= 3 ? 'FAILED' : 'PENDING';
      
      await prisma.emailQueue.update({
        where: { id: email.id },
        data: {
          status,
          attempts,
          error: errorMessage,
          // Retry in 5 minutes if not failed
          scheduledAt: status === 'PENDING' 
            ? new Date(Date.now() + 5 * 60 * 1000)
            : undefined,
        },
      });
      
      failed++;
      console.error(`[Email] Failed: ${email.subject} - ${errorMessage}`);
    }
  }
  
  return { sent, failed };
}

/**
 * Send a test email for a template
 */
export async function sendTestEmail(
  templateId: string,
  recipientEmail: string,
  testData?: Record<string, unknown>
): Promise<void> {
  const template = await prisma.emailTemplate.findUnique({
    where: { id: templateId },
  });
  
  if (!template) {
    throw new Error('Template not found');
  }
  
  // Create test context with sample data
  const context: TriggerContext = {
    order: {
      id: 'test-order-id',
      orderNumber: 'TEMPWO-123456',
      description: 'Test Order Description',
      status: 'IN_PROGRESS',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      customerName: 'Test Customer',
    },
    customer: {
      id: 'test-customer-id',
      name: 'Test Customer',
      email: recipientEmail,
    },
    quote: {
      id: 'test-quote-id',
      quoteNumber: 'Q-2024-0001',
      customerName: 'Test Customer',
      total: 1500.00,
    },
    ...testData,
  };
  
  const subject = substituteVariables(template.subject, context);
  const htmlBody = substituteVariables(template.htmlBody, context);
  const textBody = template.textBody 
    ? substituteVariables(template.textBody, context)
    : undefined;
  
  await sendEmail({
    to: recipientEmail,
    subject: `[TEST] ${subject}`,
    html: htmlBody,
    text: textBody,
  });
}

/**
 * Get email trigger display names for UI
 */
export const EMAIL_TRIGGER_DISPLAY_NAMES: Record<EmailTrigger, string> = {
  [EmailTrigger.ORDER_CREATED]: 'Order Created',
  [EmailTrigger.ORDER_STATUS_CHANGED]: 'Order Status Changed',
  [EmailTrigger.ORDER_COMPLETED]: 'Order Completed',
  [EmailTrigger.ORDER_SHIPPED]: 'Order Shipped',
  [EmailTrigger.QUOTE_SENT]: 'Quote Sent',
  [EmailTrigger.QUOTE_FOLLOWUP_3DAY]: 'Quote Follow-up (3 Days)',
  [EmailTrigger.QUOTE_FOLLOWUP_7DAY]: 'Quote Follow-up (7 Days)',
  [EmailTrigger.QUOTE_FOLLOWUP_14DAY]: 'Quote Follow-up (14 Days)',
  [EmailTrigger.QUOTE_APPROVED]: 'Quote Approved',
  [EmailTrigger.QUOTE_REJECTED]: 'Quote Rejected',
  [EmailTrigger.PROOF_UPLOADED]: 'Proof Uploaded',
  [EmailTrigger.PROOF_APPROVED]: 'Proof Approved',
  [EmailTrigger.PROOF_REJECTED]: 'Proof Rejected',
  [EmailTrigger.PROOF_REMINDER]: 'Proof Reminder',
  [EmailTrigger.DUE_DATE_7DAY]: 'Due Date (7 Days)',
  [EmailTrigger.DUE_DATE_3DAY]: 'Due Date (3 Days)',
  [EmailTrigger.DUE_DATE_1DAY]: 'Due Date (1 Day)',
  [EmailTrigger.ORDER_LATE]: 'Order Late',
  [EmailTrigger.PORTAL_WELCOME]: 'Portal Welcome',
  [EmailTrigger.PORTAL_PASSWORD_RESET]: 'Portal Password Reset',
  [EmailTrigger.SHIPMENT_CREATED]: 'Shipment Created',
  [EmailTrigger.SHIPMENT_DELIVERED]: 'Shipment Delivered',
  [EmailTrigger.MANUAL]: 'Manual',
};

/**
 * Get available template variables for a trigger
 */
export function getTemplateVariables(trigger: EmailTrigger): string[] {
  const commonVars = [
    '{{customer.name}}',
    '{{customer.email}}',
  ];
  
  const orderVars = [
    '{{order.orderNumber}}',
    '{{order.description}}',
    '{{order.status}}',
    '{{order.dueDate}}',
    '{{order.customerName}}',
  ];
  
  const quoteVars = [
    '{{quote.quoteNumber}}',
    '{{quote.customerName}}',
    '{{quote.total}}',
  ];
  
  const proofVars = [
    '{{proof.fileName}}',
    '{{proof.uploadedAt}}',
  ];
  
  const shipmentVars = [
    '{{shipment.trackingNumber}}',
    '{{shipment.carrier}}',
  ];
  
  const portalVars = [
    '{{portalUser.firstName}}',
    '{{portalUser.lastName}}',
    '{{portalUser.email}}',
  ];
  
  switch (trigger) {
    case EmailTrigger.ORDER_CREATED:
    case EmailTrigger.ORDER_STATUS_CHANGED:
    case EmailTrigger.ORDER_COMPLETED:
    case EmailTrigger.DUE_DATE_7DAY:
    case EmailTrigger.DUE_DATE_3DAY:
    case EmailTrigger.DUE_DATE_1DAY:
    case EmailTrigger.ORDER_LATE:
      return [...commonVars, ...orderVars];
      
    case EmailTrigger.ORDER_SHIPPED:
    case EmailTrigger.SHIPMENT_CREATED:
    case EmailTrigger.SHIPMENT_DELIVERED:
      return [...commonVars, ...orderVars, ...shipmentVars];
      
    case EmailTrigger.QUOTE_SENT:
    case EmailTrigger.QUOTE_FOLLOWUP_3DAY:
    case EmailTrigger.QUOTE_FOLLOWUP_7DAY:
    case EmailTrigger.QUOTE_FOLLOWUP_14DAY:
    case EmailTrigger.QUOTE_APPROVED:
    case EmailTrigger.QUOTE_REJECTED:
      return [...commonVars, ...quoteVars];
      
    case EmailTrigger.PROOF_UPLOADED:
    case EmailTrigger.PROOF_APPROVED:
    case EmailTrigger.PROOF_REJECTED:
    case EmailTrigger.PROOF_REMINDER:
      return [...commonVars, ...orderVars, ...proofVars];
      
    case EmailTrigger.PORTAL_WELCOME:
    case EmailTrigger.PORTAL_PASSWORD_RESET:
      return [...portalVars];
      
    case EmailTrigger.MANUAL:
      return [...commonVars, ...orderVars, ...quoteVars, ...proofVars, ...shipmentVars, ...portalVars];
      
    default:
      return commonVars;
  }
}
