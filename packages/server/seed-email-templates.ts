/**
 * Seed Email Templates
 * 
 * Run with: npx tsx seed-email-templates.ts
 * 
 * Valid EmailTrigger values (from Prisma schema):
 * - ORDER_CREATED, ORDER_STATUS_CHANGED, ORDER_COMPLETED, ORDER_SHIPPED, ORDER_ON_HOLD
 * - QUOTE_SENT, QUOTE_FOLLOWUP_3DAY, QUOTE_FOLLOWUP_7DAY, QUOTE_FOLLOWUP_14DAY, QUOTE_ACCEPTED, QUOTE_EXPIRED
 * - PROOF_UPLOADED, PROOF_REMINDER, PROOF_APPROVED, PROOF_CHANGES_REQUESTED
 * - DUE_DATE_3DAY, DUE_DATE_1DAY, ORDER_LATE
 * - PORTAL_WELCOME, PORTAL_MESSAGE_RECEIVED
 * - MANUAL
 */

import { PrismaClient, EmailTrigger } from '@prisma/client';

const prisma = new PrismaClient();

interface TemplateData {
  name: string;
  description: string;
  trigger: EmailTrigger;
  subject: string;
  htmlBody: string;
  textBody: string;
  delayMinutes: number;
  isActive: boolean;
}

const emailTemplates: TemplateData[] = [
  // ============ QUOTE & SALES ============
  {
    name: 'New Quote Submission',
    description: 'Sent when a new quote is created and sent to customer',
    trigger: EmailTrigger.QUOTE_SENT,
    subject: 'Your Wilde Signs Quote #{{quoteNumber}} - {{projectDescription}}',
    htmlBody: `
<p>Hi {{customerName}},</p>

<p>Thank you for reaching out to Wilde Signs! We're excited about the opportunity to work with you on your signage project.</p>

<p>Please find your quote attached for the following:</p>

<p><strong>{{projectDescription}}</strong></p>

<p><strong>Quote Details:</strong></p>
<ul>
  <li>Quote #: {{quoteNumber}}</li>
  <li>Total: {{quoteTotal}}</li>
  <li>Valid Until: {{expirationDate}}</li>
</ul>

<p>To approve this quote and proceed with your order, simply reply to this email with your approval or click the link below:</p>

<p><a href="{{approvalLink}}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px;">Approve Quote</a></p>

<p>If you have any questions or would like to discuss modifications, please don't hesitate to reach out. We're happy to adjust the design or scope to better fit your needs.</p>

<p>Thank you for considering Wilde Signs for your project!</p>

<p>Best regards,<br>
{{senderName}}<br>
Wilde Signs<br>
{{senderPhone}}<br>
{{senderEmail}}</p>
`,
    textBody: `Hi {{customerName}},

Thank you for reaching out to Wilde Signs! We're excited about the opportunity to work with you on your signage project.

Please find your quote attached for the following:

{{projectDescription}}

Quote Details:
• Quote #: {{quoteNumber}}
• Total: {{quoteTotal}}
• Valid Until: {{expirationDate}}

To approve this quote and proceed with your order, simply reply to this email with your approval.

If you have any questions or would like to discuss modifications, please don't hesitate to reach out.

Thank you for considering Wilde Signs for your project!

Best regards,
{{senderName}}
Wilde Signs
{{senderPhone}}
{{senderEmail}}`,
    delayMinutes: 0,
    isActive: true,
  },

  {
    name: 'Quote Follow-Up (3 Days)',
    description: 'Automated follow-up 3 days after quote is sent',
    trigger: EmailTrigger.QUOTE_FOLLOWUP_3DAY,
    subject: 'Following Up: Your Wilde Signs Quote #{{quoteNumber}}',
    htmlBody: `
<p>Hi {{customerName}},</p>

<p>I wanted to follow up on the quote we sent over on {{quoteSentDate}} for your <strong>{{projectDescription}}</strong> project.</p>

<p>Have you had a chance to review it? If you have any questions or would like to discuss any changes, I'm happy to help.</p>

<p>As a reminder, the quote is valid until <strong>{{expirationDate}}</strong>.</p>

<p><a href="{{approvalLink}}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px;">View Quote</a></p>

<p>Looking forward to hearing from you!</p>

<p>Best regards,<br>
{{senderName}}<br>
Wilde Signs<br>
{{senderPhone}}</p>
`,
    textBody: `Hi {{customerName}},

I wanted to follow up on the quote we sent over on {{quoteSentDate}} for your {{projectDescription}} project.

Have you had a chance to review it? If you have any questions or would like to discuss any changes, I'm happy to help.

As a reminder, the quote is valid until {{expirationDate}}.

Looking forward to hearing from you!

Best regards,
{{senderName}}
Wilde Signs
{{senderPhone}}`,
    delayMinutes: 4320, // 3 days
    isActive: true,
  },

  {
    name: 'Quote Follow-Up (7 Days)',
    description: 'Automated follow-up 7 days after quote is sent',
    trigger: EmailTrigger.QUOTE_FOLLOWUP_7DAY,
    subject: 'Still Interested? Quote #{{quoteNumber}} - {{projectDescription}}',
    htmlBody: `
<p>Hi {{customerName}},</p>

<p>I hope this message finds you well. I'm reaching out one more time regarding the quote we prepared for your <strong>{{projectDescription}}</strong> project.</p>

<p>I understand timing may not be right at the moment, and that's completely okay. If your needs have changed or if there's anything we can adjust to make this work better for you, please let me know.</p>

<p>If you'd like to move forward, we're ready to get started as soon as you give us the green light.</p>

<p><a href="{{approvalLink}}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px;">View Quote</a></p>

<p>Thank you for your time, and I hope we can work together soon!</p>

<p>Best regards,<br>
{{senderName}}<br>
Wilde Signs<br>
{{senderPhone}}</p>
`,
    textBody: `Hi {{customerName}},

I hope this message finds you well. I'm reaching out one more time regarding the quote we prepared for your {{projectDescription}} project.

I understand timing may not be right at the moment, and that's completely okay. If your needs have changed or if there's anything we can adjust to make this work better for you, please let me know.

If you'd like to move forward, we're ready to get started as soon as you give us the green light.

Thank you for your time, and I hope we can work together soon!

Best regards,
{{senderName}}
Wilde Signs
{{senderPhone}}`,
    delayMinutes: 10080, // 7 days
    isActive: true,
  },

  {
    name: 'Quote Approved Confirmation',
    description: 'Sent when customer approves a quote',
    trigger: EmailTrigger.QUOTE_ACCEPTED,
    subject: 'Quote Approved - Thank You! | #{{quoteNumber}}',
    htmlBody: `
<p>Hi {{customerName}},</p>

<p>Thank you for approving your quote! We're excited to get started on your project.</p>

<p><strong>Approved Quote Details:</strong></p>
<ul>
  <li>Quote #: {{quoteNumber}}</li>
  <li>Project: {{projectDescription}}</li>
  <li>Total: {{quoteTotal}}</li>
</ul>

<p><strong>What's Next:</strong></p>
<ol>
  <li>Your order is being created in our system</li>
  <li>You'll receive an order confirmation shortly</li>
  <li>Our team will begin the design/production process</li>
</ol>

<p>If you have any questions, feel free to reach out anytime.</p>

<p>Thank you for choosing Wilde Signs!</p>

<p>Best regards,<br>
{{senderName}}<br>
Wilde Signs<br>
{{senderPhone}}</p>
`,
    textBody: `Hi {{customerName}},

Thank you for approving your quote! We're excited to get started on your project.

Approved Quote Details:
• Quote #: {{quoteNumber}}
• Project: {{projectDescription}}
• Total: {{quoteTotal}}

What's Next:
1. Your order is being created in our system
2. You'll receive an order confirmation shortly
3. Our team will begin the design/production process

If you have any questions, feel free to reach out anytime.

Thank you for choosing Wilde Signs!

Best regards,
{{senderName}}
Wilde Signs
{{senderPhone}}`,
    delayMinutes: 0,
    isActive: true,
  },

  // ============ ORDER CONFIRMATION ============
  {
    name: 'Order Confirmed',
    description: 'Sent when a new order is created/confirmed',
    trigger: EmailTrigger.ORDER_CREATED,
    subject: 'Order Confirmed! WO#{{workOrderNumber}} - {{projectDescription}}',
    htmlBody: `
<p>Hi {{customerName}},</p>

<p>Great news! Your order has been confirmed and is now in our system.</p>

<p><strong>Order Details:</strong></p>
<ul>
  <li>Work Order #: {{workOrderNumber}}</li>
  <li>Project: {{projectDescription}}</li>
  <li>Estimated Completion: {{estimatedCompletionDate}}</li>
  <li>Order Total: {{orderTotal}}</li>
</ul>

<p><strong>What's Next:</strong></p>
<p>{{nextSteps}}</p>

<p>You can track your order status anytime by logging into our customer portal:</p>

<p><a href="{{portalLink}}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px;">Track Your Order</a></p>

<p>If you have any questions, feel free to reach out. We're excited to bring your vision to life!</p>

<p>Thank you for choosing Wilde Signs!</p>

<p>Best regards,<br>
{{senderName}}<br>
Wilde Signs<br>
{{senderPhone}}</p>
`,
    textBody: `Hi {{customerName}},

Great news! Your order has been confirmed and is now in our system.

Order Details:
• Work Order #: {{workOrderNumber}}
• Project: {{projectDescription}}
• Estimated Completion: {{estimatedCompletionDate}}
• Order Total: {{orderTotal}}

What's Next:
{{nextSteps}}

You can track your order status anytime by logging into our customer portal:
{{portalLink}}

If you have any questions, feel free to reach out. We're excited to bring your vision to life!

Thank you for choosing Wilde Signs!

Best regards,
{{senderName}}
Wilde Signs
{{senderPhone}}`,
    delayMinutes: 0,
    isActive: true,
  },

  // ============ PROOF & ARTWORK ============
  {
    name: 'Proof Ready for Review',
    description: 'Sent when a proof is uploaded and ready for customer approval',
    trigger: EmailTrigger.PROOF_UPLOADED,
    subject: 'ACTION REQUIRED: Proof Ready for Approval | WO#{{workOrderNumber}}',
    htmlBody: `
<p>Hi {{customerName}},</p>

<p>Your proof is ready for review!</p>

<p>Please find the attached proof for your <strong>{{projectDescription}}</strong> project. Take a moment to review all details carefully, including:</p>

<ul>
  <li>✓ Spelling and grammar</li>
  <li>✓ Phone numbers and addresses</li>
  <li>✓ Colors and logo placement</li>
  <li>✓ Overall layout and sizing</li>
</ul>

<p><a href="{{proofLink}}" style="display: inline-block; padding: 12px 24px; background-color: #16a34a; color: white; text-decoration: none; border-radius: 6px; margin-right: 10px;">View & Approve Proof</a></p>

<p><strong>To Approve:</strong> Click the button above or reply with "APPROVED"<br>
<strong>To Request Changes:</strong> Reply with your requested revisions</p>

<p style="color: #dc2626;"><strong>Please note:</strong> Once approved, we cannot make changes without incurring additional charges. Production will begin immediately upon approval.</p>

<p>We kindly ask for your response within <strong>{{proofDeadline}}</strong> to keep your project on schedule.</p>

<p>Thank you!</p>

<p>Best regards,<br>
{{senderName}}<br>
Wilde Signs<br>
{{senderPhone}}</p>
`,
    textBody: `Hi {{customerName}},

Your proof is ready for review!

Please find the attached proof for your {{projectDescription}} project. Take a moment to review all details carefully, including:

✓ Spelling and grammar
✓ Phone numbers and addresses
✓ Colors and logo placement
✓ Overall layout and sizing

View your proof here: {{proofLink}}

To Approve: Reply with "APPROVED"
To Request Changes: Reply with your requested revisions

Please note: Once approved, we cannot make changes without incurring additional charges. Production will begin immediately upon approval.

We kindly ask for your response within {{proofDeadline}} to keep your project on schedule.

Thank you!

Best regards,
{{senderName}}
Wilde Signs
{{senderPhone}}`,
    delayMinutes: 0,
    isActive: true,
  },

  {
    name: 'Proof Approved Confirmation',
    description: 'Sent when customer approves a proof',
    trigger: EmailTrigger.PROOF_APPROVED,
    subject: 'Proof Approved - Production Starting | WO#{{workOrderNumber}}',
    htmlBody: `
<p>Hi {{customerName}},</p>

<p>Thank you for approving your proof! Your project is now moving into production.</p>

<p><strong>Project:</strong> {{projectDescription}}<br>
<strong>Work Order:</strong> #{{workOrderNumber}}<br>
<strong>Estimated Completion:</strong> {{estimatedCompletionDate}}</p>

<p>We'll notify you when your order is ready for pickup/shipping/installation.</p>

<p>If you have any questions in the meantime, don't hesitate to reach out.</p>

<p>Thank you for choosing Wilde Signs!</p>

<p>Best regards,<br>
{{senderName}}<br>
Wilde Signs<br>
{{senderPhone}}</p>
`,
    textBody: `Hi {{customerName}},

Thank you for approving your proof! Your project is now moving into production.

Project: {{projectDescription}}
Work Order: #{{workOrderNumber}}
Estimated Completion: {{estimatedCompletionDate}}

We'll notify you when your order is ready for pickup/shipping/installation.

If you have any questions in the meantime, don't hesitate to reach out.

Thank you for choosing Wilde Signs!

Best regards,
{{senderName}}
Wilde Signs
{{senderPhone}}`,
    delayMinutes: 0,
    isActive: true,
  },

  {
    name: 'Proof Revision Requested',
    description: 'Sent when customer requests changes to proof',
    trigger: EmailTrigger.PROOF_CHANGES_REQUESTED,
    subject: 'Proof Revision Request Received | WO#{{workOrderNumber}}',
    htmlBody: `
<p>Hi {{customerName}},</p>

<p>We've received your revision request for the <strong>{{projectDescription}}</strong> proof.</p>

<p><strong>Changes Requested:</strong><br>
{{revisionNotes}}</p>

<p>Our design team is working on the revisions and will send you an updated proof shortly.</p>

<p>If you have any additional feedback or questions, please let us know.</p>

<p>Thank you for your patience!</p>

<p>Best regards,<br>
{{senderName}}<br>
Wilde Signs<br>
{{senderPhone}}</p>
`,
    textBody: `Hi {{customerName}},

We've received your revision request for the {{projectDescription}} proof.

Changes Requested:
{{revisionNotes}}

Our design team is working on the revisions and will send you an updated proof shortly.

If you have any additional feedback or questions, please let us know.

Thank you for your patience!

Best regards,
{{senderName}}
Wilde Signs
{{senderPhone}}`,
    delayMinutes: 0,
    isActive: true,
  },

  {
    name: 'Proof Reminder',
    description: 'Reminder sent when proof has not been reviewed',
    trigger: EmailTrigger.PROOF_REMINDER,
    subject: 'Reminder: Proof Awaiting Your Approval | WO#{{workOrderNumber}}',
    htmlBody: `
<p>Hi {{customerName}},</p>

<p>This is a friendly reminder that we're still awaiting your approval on the proof for your <strong>{{projectDescription}}</strong> project.</p>

<p>To keep your project on schedule, please review and approve the proof at your earliest convenience.</p>

<p><a href="{{proofLink}}" style="display: inline-block; padding: 12px 24px; background-color: #16a34a; color: white; text-decoration: none; border-radius: 6px;">Review Proof Now</a></p>

<p>If you have any questions or need more time, please let us know.</p>

<p>Thank you!</p>

<p>Best regards,<br>
{{senderName}}<br>
Wilde Signs<br>
{{senderPhone}}</p>
`,
    textBody: `Hi {{customerName}},

This is a friendly reminder that we're still awaiting your approval on the proof for your {{projectDescription}} project.

To keep your project on schedule, please review and approve the proof at your earliest convenience.

View proof: {{proofLink}}

If you have any questions or need more time, please let us know.

Thank you!

Best regards,
{{senderName}}
Wilde Signs
{{senderPhone}}`,
    delayMinutes: 2880, // 2 days
    isActive: true,
  },

  // ============ PRODUCTION UPDATES ============
  {
    name: 'Order Status Changed',
    description: 'Sent when order status is updated',
    trigger: EmailTrigger.ORDER_STATUS_CHANGED,
    subject: 'Order Update | WO#{{workOrderNumber}} - {{currentStatus}}',
    htmlBody: `
<p>Hi {{customerName}},</p>

<p>Here's a quick update on your order:</p>

<p><strong>Project:</strong> {{projectDescription}}<br>
<strong>Work Order:</strong> #{{workOrderNumber}}<br>
<strong>Status:</strong> {{currentStatus}}<br>
<strong>Current Station:</strong> {{currentStation}}<br>
<strong>Estimated Completion:</strong> {{estimatedCompletionDate}}</p>

<p>{{additionalNotes}}</p>

<p><a href="{{portalLink}}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px;">Track Your Order</a></p>

<p>Thank you!</p>

<p>Best regards,<br>
{{senderName}}<br>
Wilde Signs<br>
{{senderPhone}}</p>
`,
    textBody: `Hi {{customerName}},

Here's a quick update on your order:

Project: {{projectDescription}}
Work Order: #{{workOrderNumber}}
Status: {{currentStatus}}
Current Station: {{currentStation}}
Estimated Completion: {{estimatedCompletionDate}}

{{additionalNotes}}

Track your order: {{portalLink}}

Thank you!

Best regards,
{{senderName}}
Wilde Signs
{{senderPhone}}`,
    delayMinutes: 0,
    isActive: false, // Disabled by default - can be too noisy
  },

  {
    name: 'Order Complete - Ready for Pickup',
    description: 'Sent when order is completed and ready for pickup',
    trigger: EmailTrigger.ORDER_COMPLETED,
    subject: 'Your Order is Ready! | WO#{{workOrderNumber}}',
    htmlBody: `
<p>Hi {{customerName}},</p>

<p>Your order is complete and ready for pickup!</p>

<p><strong>Project:</strong> {{projectDescription}}<br>
<strong>Work Order:</strong> #{{workOrderNumber}}</p>

<p><strong>Pickup Location:</strong><br>
Wilde Signs<br>
{{companyAddress}}</p>

<p><strong>Pickup Hours:</strong><br>
Monday - Friday: 8:00 AM - 5:00 PM</p>

<p><strong>Balance Due:</strong> {{balanceDue}}<br>
<strong>Accepted Payment Methods:</strong> Cash, Check, Credit Card</p>

<p>Please bring a copy of this email or your work order number when you arrive.</p>

<p>If you have any questions or need to arrange an alternate pickup time, please let us know.</p>

<p>Thank you for choosing Wilde Signs!</p>

<p>Best regards,<br>
{{senderName}}<br>
Wilde Signs<br>
{{senderPhone}}</p>
`,
    textBody: `Hi {{customerName}},

Your order is complete and ready for pickup!

Project: {{projectDescription}}
Work Order: #{{workOrderNumber}}

Pickup Location:
Wilde Signs
{{companyAddress}}

Pickup Hours:
Monday - Friday: 8:00 AM - 5:00 PM

Balance Due: {{balanceDue}}
Accepted Payment Methods: Cash, Check, Credit Card

Please bring a copy of this email or your work order number when you arrive.

If you have any questions or need to arrange an alternate pickup time, please let us know.

Thank you for choosing Wilde Signs!

Best regards,
{{senderName}}
Wilde Signs
{{senderPhone}}`,
    delayMinutes: 0,
    isActive: true,
  },

  // ============ SHIPPING ============
  {
    name: 'Order Shipped',
    description: 'Sent when order is shipped with tracking info',
    trigger: EmailTrigger.ORDER_SHIPPED,
    subject: 'Your Order Has Shipped! | WO#{{workOrderNumber}}',
    htmlBody: `
<p>Hi {{customerName}},</p>

<p>Your order is on its way!</p>

<p><strong>Shipping Details:</strong></p>
<ul>
  <li>Work Order: #{{workOrderNumber}}</li>
  <li>Project: {{projectDescription}}</li>
  <li>Carrier: {{carrier}}</li>
  <li>Tracking Number: {{trackingNumber}}</li>
  <li>Estimated Delivery: {{estimatedDelivery}}</li>
</ul>

<p><a href="{{trackingLink}}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px;">Track Your Package</a></p>

<p><strong>Shipping Address:</strong><br>
{{shippingAddress}}</p>

<p>If you have any questions about your shipment, please don't hesitate to reach out.</p>

<p>Thank you for your business!</p>

<p>Best regards,<br>
{{senderName}}<br>
Wilde Signs<br>
{{senderPhone}}</p>
`,
    textBody: `Hi {{customerName}},

Your order is on its way!

Shipping Details:
• Work Order: #{{workOrderNumber}}
• Project: {{projectDescription}}
• Carrier: {{carrier}}
• Tracking Number: {{trackingNumber}}
• Estimated Delivery: {{estimatedDelivery}}

Track Your Package: {{trackingLink}}

Shipping Address:
{{shippingAddress}}

If you have any questions about your shipment, please don't hesitate to reach out.

Thank you for your business!

Best regards,
{{senderName}}
Wilde Signs
{{senderPhone}}`,
    delayMinutes: 0,
    isActive: true,
  },

  {
    name: 'Shipment Delivered',
    description: 'Sent when shipment is confirmed delivered (trigger manually)',
    trigger: EmailTrigger.MANUAL,
    subject: 'Delivery Complete | WO#{{workOrderNumber}}',
    htmlBody: `
<p>Hi {{customerName}},</p>

<p>This is to confirm that your order has been successfully delivered.</p>

<p><strong>Project:</strong> {{projectDescription}}<br>
<strong>Work Order:</strong> #{{workOrderNumber}}<br>
<strong>Delivered:</strong> {{deliveryDateTime}}</p>

<p>Please inspect your items and let us know if you have any questions or concerns.</p>

<p>We hope you love your new signage! If you're happy with your order, we'd greatly appreciate a review:</p>

<p><a href="{{reviewLink}}" style="display: inline-block; padding: 12px 24px; background-color: #f59e0b; color: white; text-decoration: none; border-radius: 6px;">Leave a Review</a></p>

<p>Thank you for choosing Wilde Signs!</p>

<p>Best regards,<br>
{{senderName}}<br>
Wilde Signs<br>
{{senderPhone}}</p>
`,
    textBody: `Hi {{customerName}},

This is to confirm that your order has been successfully delivered.

Project: {{projectDescription}}
Work Order: #{{workOrderNumber}}
Delivered: {{deliveryDateTime}}

Please inspect your items and let us know if you have any questions or concerns.

We hope you love your new signage! If you're happy with your order, we'd greatly appreciate a review:
{{reviewLink}}

Thank you for choosing Wilde Signs!

Best regards,
{{senderName}}
Wilde Signs
{{senderPhone}}`,
    delayMinutes: 0,
    isActive: true,
  },

  // ============ DUE DATE REMINDERS ============
  {
    name: 'Due Date Reminder (7 Days)',
    description: 'Internal reminder 7 days before due date (trigger manually)',
    trigger: EmailTrigger.MANUAL,
    subject: 'Due Date Reminder: WO#{{workOrderNumber}} - Due in 7 Days',
    htmlBody: `
<p><strong>Due Date Reminder</strong></p>

<p>The following order is due in <strong>7 days</strong>:</p>

<p><strong>Work Order:</strong> #{{workOrderNumber}}<br>
<strong>Customer:</strong> {{customerName}}<br>
<strong>Project:</strong> {{projectDescription}}<br>
<strong>Due Date:</strong> {{dueDate}}<br>
<strong>Current Status:</strong> {{currentStatus}}<br>
<strong>Current Station:</strong> {{currentStation}}</p>

<p><a href="{{orderLink}}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px;">View Order</a></p>
`,
    textBody: `Due Date Reminder

The following order is due in 7 days:

Work Order: #{{workOrderNumber}}
Customer: {{customerName}}
Project: {{projectDescription}}
Due Date: {{dueDate}}
Current Status: {{currentStatus}}
Current Station: {{currentStation}}

View Order: {{orderLink}}`,
    delayMinutes: 0,
    isActive: true,
  },

  {
    name: 'Due Date Reminder (3 Days)',
    description: 'Internal reminder 3 days before due date',
    trigger: EmailTrigger.DUE_DATE_3DAY,
    subject: 'ATTENTION: WO#{{workOrderNumber}} - Due in 3 Days',
    htmlBody: `
<p><strong style="color: #f59e0b;">⚠️ Due Date Approaching</strong></p>

<p>The following order is due in <strong>3 days</strong>:</p>

<p><strong>Work Order:</strong> #{{workOrderNumber}}<br>
<strong>Customer:</strong> {{customerName}}<br>
<strong>Project:</strong> {{projectDescription}}<br>
<strong>Due Date:</strong> {{dueDate}}<br>
<strong>Current Status:</strong> {{currentStatus}}<br>
<strong>Current Station:</strong> {{currentStation}}</p>

<p><a href="{{orderLink}}" style="display: inline-block; padding: 12px 24px; background-color: #f59e0b; color: white; text-decoration: none; border-radius: 6px;">View Order</a></p>
`,
    textBody: `⚠️ Due Date Approaching

The following order is due in 3 days:

Work Order: #{{workOrderNumber}}
Customer: {{customerName}}
Project: {{projectDescription}}
Due Date: {{dueDate}}
Current Status: {{currentStatus}}
Current Station: {{currentStation}}

View Order: {{orderLink}}`,
    delayMinutes: 0,
    isActive: true,
  },

  {
    name: 'Due Date Reminder (1 Day)',
    description: 'Internal reminder 1 day before due date',
    trigger: EmailTrigger.DUE_DATE_1DAY,
    subject: 'URGENT: WO#{{workOrderNumber}} - Due TOMORROW',
    htmlBody: `
<p><strong style="color: #dc2626;">🚨 DUE TOMORROW</strong></p>

<p>The following order is due <strong>TOMORROW</strong>:</p>

<p><strong>Work Order:</strong> #{{workOrderNumber}}<br>
<strong>Customer:</strong> {{customerName}}<br>
<strong>Project:</strong> {{projectDescription}}<br>
<strong>Due Date:</strong> {{dueDate}}<br>
<strong>Current Status:</strong> {{currentStatus}}<br>
<strong>Current Station:</strong> {{currentStation}}</p>

<p><a href="{{orderLink}}" style="display: inline-block; padding: 12px 24px; background-color: #dc2626; color: white; text-decoration: none; border-radius: 6px;">View Order Now</a></p>
`,
    textBody: `🚨 DUE TOMORROW

The following order is due TOMORROW:

Work Order: #{{workOrderNumber}}
Customer: {{customerName}}
Project: {{projectDescription}}
Due Date: {{dueDate}}
Current Status: {{currentStatus}}
Current Station: {{currentStation}}

View Order: {{orderLink}}`,
    delayMinutes: 0,
    isActive: true,
  },

  {
    name: 'Order Late Alert',
    description: 'Alert when order is past due date',
    trigger: EmailTrigger.ORDER_LATE,
    subject: 'OVERDUE: WO#{{workOrderNumber}} - {{daysPastDue}} Days Late',
    htmlBody: `
<p><strong style="color: #dc2626;">🚨 ORDER OVERDUE</strong></p>

<p>The following order is <strong>{{daysPastDue}} days past due</strong>:</p>

<p><strong>Work Order:</strong> #{{workOrderNumber}}<br>
<strong>Customer:</strong> {{customerName}}<br>
<strong>Project:</strong> {{projectDescription}}<br>
<strong>Due Date:</strong> {{dueDate}}<br>
<strong>Current Status:</strong> {{currentStatus}}<br>
<strong>Current Station:</strong> {{currentStation}}</p>

<p>Please prioritize this order immediately.</p>

<p><a href="{{orderLink}}" style="display: inline-block; padding: 12px 24px; background-color: #dc2626; color: white; text-decoration: none; border-radius: 6px;">View Order</a></p>
`,
    textBody: `🚨 ORDER OVERDUE

The following order is {{daysPastDue}} days past due:

Work Order: #{{workOrderNumber}}
Customer: {{customerName}}
Project: {{projectDescription}}
Due Date: {{dueDate}}
Current Status: {{currentStatus}}
Current Station: {{currentStation}}

Please prioritize this order immediately.

View Order: {{orderLink}}`,
    delayMinutes: 0,
    isActive: true,
  },

  // ============ PORTAL ============
  {
    name: 'Portal Welcome Email',
    description: 'Sent when a new portal user is created',
    trigger: EmailTrigger.PORTAL_WELCOME,
    subject: 'Welcome to the Wilde Signs Customer Portal!',
    htmlBody: `
<p>Hi {{customerName}},</p>

<p>Welcome to the Wilde Signs Customer Portal! Your account has been created and you now have access to track orders, view invoices, and manage your projects online.</p>

<p><strong>Your Login Credentials:</strong></p>
<ul>
  <li>Email: {{portalEmail}}</li>
  <li>Temporary Password: {{temporaryPassword}}</li>
</ul>

<p><a href="{{portalLink}}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px;">Log In to Portal</a></p>

<p>For security, please change your password after your first login.</p>

<p><strong>With the customer portal, you can:</strong></p>
<ul>
  <li>✓ Track order status in real-time</li>
  <li>✓ View and approve proofs</li>
  <li>✓ Access invoices and payment history</li>
  <li>✓ Upload artwork and files</li>
  <li>✓ Communicate with our team</li>
</ul>

<p>If you have any questions about using the portal, please don't hesitate to reach out.</p>

<p>Thank you for choosing Wilde Signs!</p>

<p>Best regards,<br>
The Wilde Signs Team<br>
{{companyPhone}}</p>
`,
    textBody: `Hi {{customerName}},

Welcome to the Wilde Signs Customer Portal! Your account has been created and you now have access to track orders, view invoices, and manage your projects online.

Your Login Credentials:
Email: {{portalEmail}}
Temporary Password: {{temporaryPassword}}

Log in here: {{portalLink}}

For security, please change your password after your first login.

With the customer portal, you can:
✓ Track order status in real-time
✓ View and approve proofs
✓ Access invoices and payment history
✓ Upload artwork and files
✓ Communicate with our team

If you have any questions about using the portal, please don't hesitate to reach out.

Thank you for choosing Wilde Signs!

Best regards,
The Wilde Signs Team
{{companyPhone}}`,
    delayMinutes: 0,
    isActive: true,
  },

  {
    name: 'Portal Password Reset',
    description: 'Sent when user requests password reset',
    trigger: EmailTrigger.MANUAL,
    subject: 'Password Reset Request | Wilde Signs Portal',
    htmlBody: `
<p>Hi {{customerName}},</p>

<p>We received a request to reset your password for the Wilde Signs Customer Portal.</p>

<p>Click the button below to reset your password:</p>

<p><a href="{{resetLink}}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px;">Reset Password</a></p>

<p>This link will expire in <strong>1 hour</strong>.</p>

<p>If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>

<p>Best regards,<br>
The Wilde Signs Team</p>
`,
    textBody: `Hi {{customerName}},

We received a request to reset your password for the Wilde Signs Customer Portal.

Click here to reset your password:
{{resetLink}}

This link will expire in 1 hour.

If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.

Best regards,
The Wilde Signs Team`,
    delayMinutes: 0,
    isActive: true,
  },

  // ============ MANUAL TEMPLATES ============
  {
    name: 'Payment Reminder',
    description: 'Manual template for payment reminders',
    trigger: EmailTrigger.MANUAL,
    subject: 'Payment Reminder: Invoice #{{invoiceNumber}}',
    htmlBody: `
<p>Hi {{customerName}},</p>

<p>This is a friendly reminder that Invoice #{{invoiceNumber}} for <strong>{{amountDue}}</strong> is due on <strong>{{dueDate}}</strong>.</p>

<p><strong>Invoice Details:</strong></p>
<ul>
  <li>Invoice #: {{invoiceNumber}}</li>
  <li>Amount Due: {{amountDue}}</li>
  <li>Due Date: {{dueDate}}</li>
</ul>

<p><a href="{{paymentLink}}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px;">Pay Now</a></p>

<p>If you've already sent payment, please disregard this notice.</p>

<p>If you have any questions, please don't hesitate to reach out.</p>

<p>Thank you!</p>

<p>Best regards,<br>
{{senderName}}<br>
Wilde Signs<br>
{{senderPhone}}</p>
`,
    textBody: `Hi {{customerName}},

This is a friendly reminder that Invoice #{{invoiceNumber}} for {{amountDue}} is due on {{dueDate}}.

Invoice Details:
• Invoice #: {{invoiceNumber}}
• Amount Due: {{amountDue}}
• Due Date: {{dueDate}}

Pay Now: {{paymentLink}}

If you've already sent payment, please disregard this notice.

If you have any questions, please don't hesitate to reach out.

Thank you!

Best regards,
{{senderName}}
Wilde Signs
{{senderPhone}}`,
    delayMinutes: 0,
    isActive: true,
  },

  {
    name: 'Thank You - Review Request',
    description: 'Manual template for post-project follow-up',
    trigger: EmailTrigger.MANUAL,
    subject: 'Thank You! How Was Your Experience with Wilde Signs?',
    htmlBody: `
<p>Hi {{customerName}},</p>

<p>Thank you for trusting Wilde Signs with your recent project! We truly appreciate your business.</p>

<p>We hope you're loving your new {{projectDescription}}!</p>

<p>If you have a moment, would you consider leaving us a review? Your feedback means the world to us and helps other businesses discover our services.</p>

<p>It only takes a minute:</p>

<p><a href="{{googleReviewLink}}" style="display: inline-block; padding: 12px 24px; background-color: #f59e0b; color: white; text-decoration: none; border-radius: 6px; margin-right: 10px;">⭐ Google Review</a>
<a href="{{facebookReviewLink}}" style="display: inline-block; padding: 12px 24px; background-color: #1877f2; color: white; text-decoration: none; border-radius: 6px;">⭐ Facebook Review</a></p>

<p>Thank you so much for your support!</p>

<p>Best regards,<br>
{{senderName}}<br>
Wilde Signs<br>
{{senderPhone}}</p>

<p style="font-size: 12px; color: #666;">P.S. - If there's anything we could have done better, please let me know directly. We're always looking to improve!</p>
`,
    textBody: `Hi {{customerName}},

Thank you for trusting Wilde Signs with your recent project! We truly appreciate your business.

We hope you're loving your new {{projectDescription}}!

If you have a moment, would you consider leaving us a review? Your feedback means the world to us and helps other businesses discover our services.

⭐ Google Review: {{googleReviewLink}}
⭐ Facebook Review: {{facebookReviewLink}}

Thank you so much for your support!

Best regards,
{{senderName}}
Wilde Signs
{{senderPhone}}

P.S. - If there's anything we could have done better, please let me know directly. We're always looking to improve!`,
    delayMinutes: 0,
    isActive: true,
  },

  {
    name: 'Artwork Request',
    description: 'Manual template for requesting artwork from customer',
    trigger: EmailTrigger.MANUAL,
    subject: 'Artwork Needed | WO#{{workOrderNumber}} - {{projectDescription}}',
    htmlBody: `
<p>Hi {{customerName}},</p>

<p>We're excited to get started on your project! To proceed, we need the following artwork/files:</p>

<p><strong>Files Needed:</strong></p>
<ul>
{{filesNeededList}}
</ul>

<p><strong>Preferred File Formats:</strong></p>
<ul>
  <li>Vector files: .AI, .EPS, .PDF (preferred)</li>
  <li>High-resolution images: .PNG, .JPG (minimum 300 DPI)</li>
  <li>Fonts: If using custom fonts, please include the font files</li>
</ul>

<p><strong>You can send files by:</strong></p>
<ul>
  <li>Reply to this email with attachments</li>
  <li>Upload here: <a href="{{uploadLink}}">{{uploadLink}}</a></li>
  <li>Large files: Use WeTransfer, Dropbox, or Google Drive</li>
</ul>

<p>If you don't have vector artwork, we can recreate your logo for an additional fee. Let us know if you'd like a quote for that service.</p>

<p>Thank you!</p>

<p>Best regards,<br>
{{senderName}}<br>
Wilde Signs<br>
{{senderPhone}}</p>
`,
    textBody: `Hi {{customerName}},

We're excited to get started on your project! To proceed, we need the following artwork/files:

Files Needed:
{{filesNeededList}}

Preferred File Formats:
• Vector files: .AI, .EPS, .PDF (preferred)
• High-resolution images: .PNG, .JPG (minimum 300 DPI)
• Fonts: If using custom fonts, please include the font files

You can send files by:
• Reply to this email with attachments
• Upload here: {{uploadLink}}
• Large files: Use WeTransfer, Dropbox, or Google Drive

If you don't have vector artwork, we can recreate your logo for an additional fee. Let us know if you'd like a quote for that service.

Thank you!

Best regards,
{{senderName}}
Wilde Signs
{{senderPhone}}`,
    delayMinutes: 0,
    isActive: true,
  },

  {
    name: 'Installation Scheduled',
    description: 'Manual template for installation scheduling',
    trigger: EmailTrigger.MANUAL,
    subject: 'Installation Scheduled | WO#{{workOrderNumber}} - {{installDate}}',
    htmlBody: `
<p>Hi {{customerName}},</p>

<p>Your installation has been scheduled!</p>

<p><strong>Installation Details:</strong></p>
<ul>
  <li>Work Order #: {{workOrderNumber}}</li>
  <li>Project: {{projectDescription}}</li>
  <li>Date: {{installDate}}</li>
  <li>Time: {{installTime}}</li>
  <li>Location: {{installAddress}}</li>
</ul>

<p><strong>Our Installation Team:</strong><br>
{{installerNames}}</p>

<p><strong>Pre-Installation Checklist:</strong></p>
<ul>
{{preInstallChecklist}}
</ul>

<p>If you need to reschedule, please contact us at least 48 hours in advance to avoid rescheduling fees.</p>

<p>We're looking forward to completing your project!</p>

<p>Best regards,<br>
{{senderName}}<br>
Wilde Signs<br>
{{senderPhone}}</p>
`,
    textBody: `Hi {{customerName}},

Your installation has been scheduled!

Installation Details:
• Work Order #: {{workOrderNumber}}
• Project: {{projectDescription}}
• Date: {{installDate}}
• Time: {{installTime}}
• Location: {{installAddress}}

Our Installation Team:
{{installerNames}}

Pre-Installation Checklist:
{{preInstallChecklist}}

If you need to reschedule, please contact us at least 48 hours in advance to avoid rescheduling fees.

We're looking forward to completing your project!

Best regards,
{{senderName}}
Wilde Signs
{{senderPhone}}`,
    delayMinutes: 0,
    isActive: true,
  },

  {
    name: 'Installation Complete',
    description: 'Manual template for installation completion',
    trigger: EmailTrigger.MANUAL,
    subject: 'Installation Complete! | WO#{{workOrderNumber}}',
    htmlBody: `
<p>Hi {{customerName}},</p>

<p>Great news! Your installation is complete.</p>

<p><strong>Project:</strong> {{projectDescription}}<br>
<strong>Work Order:</strong> #{{workOrderNumber}}<br>
<strong>Installed:</strong> {{installDateTime}}<br>
<strong>Location:</strong> {{installAddress}}</p>

<p>{{installationNotes}}</p>

<p>Please take a moment to inspect the installation. If you notice any issues or have concerns, please contact us within 48 hours.</p>

<p>We've attached photos of the completed installation for your records.</p>

<p>Thank you for choosing Wilde Signs! We hope you love your new signage.</p>

<p>If you're happy with our work, we'd really appreciate a review:</p>
<p><a href="{{reviewLink}}" style="display: inline-block; padding: 12px 24px; background-color: #f59e0b; color: white; text-decoration: none; border-radius: 6px;">Leave a Review</a></p>

<p>Best regards,<br>
{{senderName}}<br>
Wilde Signs<br>
{{senderPhone}}</p>
`,
    textBody: `Hi {{customerName}},

Great news! Your installation is complete.

Project: {{projectDescription}}
Work Order: #{{workOrderNumber}}
Installed: {{installDateTime}}
Location: {{installAddress}}

{{installationNotes}}

Please take a moment to inspect the installation. If you notice any issues or have concerns, please contact us within 48 hours.

Thank you for choosing Wilde Signs! We hope you love your new signage.

If you're happy with our work, we'd really appreciate a review:
{{reviewLink}}

Best regards,
{{senderName}}
Wilde Signs
{{senderPhone}}`,
    delayMinutes: 0,
    isActive: true,
  },
];

async function seedEmailTemplates() {
  console.log('Seeding email templates...\n');

  for (const template of emailTemplates) {
    try {
      const existing = await prisma.emailTemplate.findUnique({
        where: { name: template.name },
      });

      if (existing) {
        // Update existing template
        await prisma.emailTemplate.update({
          where: { id: existing.id },
          data: template,
        });
        console.log(`✓ Updated: ${template.name}`);
      } else {
        // Create new template
        await prisma.emailTemplate.create({
          data: template,
        });
        console.log(`✓ Created: ${template.name}`);
      }
    } catch (error) {
      console.error(`✗ Error with ${template.name}:`, error);
    }
  }

  const count = await prisma.emailTemplate.count();
  console.log(`\n✓ Total templates in database: ${count}`);
}

seedEmailTemplates()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
