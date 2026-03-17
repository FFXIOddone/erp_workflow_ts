import { Router, Response } from 'express';
import { z } from 'zod';
import { UserRole } from '@erp/shared';
import { AuthRequest, authenticate, requireRole } from '../middleware/auth.js';
import { prisma } from '../db/client.js';
import {
  sendEmail,
  sendQuoteToCustomerEmail,
  verifyEmailConnection,
} from '../services/email.js';

export const emailRouter = Router();

// All routes require authentication
emailRouter.use(authenticate);

// Check email service status (admin only)
emailRouter.get('/status', requireRole(UserRole.ADMIN), async (_req: AuthRequest, res: Response) => {
  const isConnected = await verifyEmailConnection();
  
  res.json({
    enabled: !!process.env.EMAIL_USER && !!process.env.EMAIL_PASS,
    connected: isConnected,
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    from: process.env.EMAIL_FROM || 'noreply@wildesigns.com',
  });
});

// Send quote to customer
const SendQuoteSchema = z.object({
  quoteId: z.string().uuid(),
  recipientEmail: z.string().email(),
});

emailRouter.post('/send-quote', async (req: AuthRequest, res: Response) => {
  const { quoteId, recipientEmail } = SendQuoteSchema.parse(req.body);

  // Fetch the quote with line items
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: {
      lineItems: true,
      customer: true,
    },
  });

  if (!quote) {
    res.status(404).json({ error: 'Quote not found' });
    return;
  }

  const quoteData: Parameters<typeof sendQuoteToCustomerEmail>[1] = {
    quoteId: quote.id,
    quoteNumber: quote.quoteNumber,
    customerName: quote.customerName,
    customerEmail: recipientEmail,
    total: quote.total.toNumber(),
    lineItems: quote.lineItems.map(item => ({
      itemNumber: String(item.itemNumber),
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice.toNumber(),
      totalPrice: item.totalPrice.toNumber(),
    })),
  };
  if (quote.description) quoteData.description = quote.description;
  if (quote.validUntil) quoteData.validUntil = quote.validUntil;

  try {
    await sendQuoteToCustomerEmail(recipientEmail, quoteData);

    // Update quote status to SENT if it was DRAFT
    if (quote.status === 'DRAFT') {
      await prisma.quote.update({
        where: { id: quoteId },
        data: { 
          status: 'SENT',
          sentAt: new Date(),
        },
      });
    }

    res.json({ success: true, message: 'Quote sent successfully' });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: `Failed to send quote email: ${error?.message || 'Unknown error'}. Check server logs for SMTP details.`,
    });
  }
});

// Send custom email
const CustomEmailSchema = z.object({
  to: z.union([z.string().email(), z.array(z.string().email())]),
  subject: z.string().min(1),
  html: z.string().min(1),
  text: z.string().optional(),
});

emailRouter.post('/send', requireRole(UserRole.ADMIN), async (req: AuthRequest, res: Response) => {
  const emailData = CustomEmailSchema.parse(req.body);
  
  const emailPayload: Parameters<typeof sendEmail>[0] = {
    to: emailData.to,
    subject: emailData.subject,
    html: emailData.html,
  };
  if (emailData.text) emailPayload.text = emailData.text;

  try {
    await sendEmail(emailPayload);
    res.json({ success: true, message: 'Email sent successfully' });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: `Failed to send email: ${error?.message || 'Unknown error'}. Check server logs for SMTP details.`,
    });
  }
});

// Test email configuration
emailRouter.post('/test', requireRole(UserRole.ADMIN), async (req: AuthRequest, res: Response) => {
  const testRecipient = req.body.email || req.user?.email;
  
  if (!testRecipient) {
    res.status(400).json({ error: 'No email address provided' });
    return;
  }

  try {
    await sendEmail({
      to: testRecipient,
      subject: 'Test Email from ERP System',
      html: `
        <h1>Test Email</h1>
        <p>This is a test email from your ERP system.</p>
        <p>If you received this, your email configuration is working correctly!</p>
        <p>Sent at: ${new Date().toLocaleString()}</p>
      `,
    });
    res.json({ success: true, message: `Test email sent to ${testRecipient}` });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: `Failed to send test email: ${error?.message || 'Unknown error'}. Check server logs for SMTP details.`,
    });
  }
});
