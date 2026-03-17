/**
 * Recurring Order Auto-Generation Service
 * 
 * Handles automatic generation of work orders from recurring order schedules.
 * Runs on a configurable interval (default: every hour) and generates orders
 * for any recurring orders that are due.
 */

import { prisma } from '../db/client.js';
import { broadcast } from '../ws/server.js';
import { PrintingMethod } from '@prisma/client';

// Result of a processing run
export interface RecurringOrderProcessResult {
  processed: number;
  generated: number;
  failed: number;
  skipped: number;
  errors: Array<{ recurringOrderId: string; name: string; error: string }>;
}

/**
 * Calculate next generation date based on frequency
 */
function calculateNextGenerateDate(
  frequency: string,
  customDays: number | null,
  fromDate: Date = new Date()
): Date {
  const next = new Date(fromDate);
  
  switch (frequency) {
    case 'WEEKLY':
      next.setDate(next.getDate() + 7);
      break;
    case 'BIWEEKLY':
      next.setDate(next.getDate() + 14);
      break;
    case 'MONTHLY':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'QUARTERLY':
      next.setMonth(next.getMonth() + 3);
      break;
    case 'SEMIANNUALLY':
      next.setMonth(next.getMonth() + 6);
      break;
    case 'YEARLY':
      next.setFullYear(next.getFullYear() + 1);
      break;
    case 'CUSTOM':
      if (customDays) {
        next.setDate(next.getDate() + customDays);
      }
      break;
  }
  
  return next;
}

/**
 * Get or create the system user for automated actions
 */
async function getSystemUser(): Promise<string> {
  const systemUser = await prisma.user.findFirst({
    where: { username: 'system' },
    select: { id: true },
  });
  
  if (systemUser) {
    return systemUser.id;
  }
  
  // Create system user if it doesn't exist
  const created = await prisma.user.create({
    data: {
      username: 'system',
      email: 'system@wildesigns.local',
      passwordHash: 'SYSTEM_USER_NO_LOGIN',
      displayName: 'System Automation',
      role: 'ADMIN',
    },
    select: { id: true },
  });
  
  return created.id;
}

/**
 * Generate a unique order number
 */
async function generateOrderNumber(): Promise<string> {
  const lastOrder = await prisma.workOrder.findFirst({
    orderBy: { orderNumber: 'desc' },
    where: {
      orderNumber: {
        startsWith: 'WO-',
      },
    },
    select: { orderNumber: true },
  });
  
  const nextNum = lastOrder 
    ? parseInt(lastOrder.orderNumber.replace(/\D/g, '')) + 1 
    : 1;
  
  return `WO-${String(nextNum).padStart(6, '0')}`;
}

/**
 * Generate a work order from a recurring order
 */
async function generateOrderFromRecurring(recurringOrderId: string): Promise<{
  success: boolean;
  workOrderId?: string;
  orderNumber?: string;
  error?: string;
}> {
  try {
    const recurring = await prisma.recurringOrder.findUnique({
      where: { id: recurringOrderId },
      include: {
        customer: true,
        template: {
          include: { lineItemTemplates: true },
        },
        lineItems: {
          include: { itemMaster: true },
        },
      },
    });

    if (!recurring) {
      return { success: false, error: 'Recurring order not found' };
    }

    if (!recurring.isActive) {
      return { success: false, error: 'Recurring order is not active' };
    }

    if (recurring.isPaused) {
      return { success: false, error: 'Recurring order is paused' };
    }

    // Check if end date has passed
    if (recurring.endDate && new Date() > new Date(recurring.endDate)) {
      // Deactivate the recurring order
      await prisma.recurringOrder.update({
        where: { id: recurringOrderId },
        data: {
          isActive: false,
          generationLogs: {
            create: {
              action: 'CANCELLED',
              details: 'Recurring order ended - end date reached',
            },
          },
        },
      });
      return { success: false, error: 'Recurring order has ended' };
    }

    // Generate order number
    const orderNumber = await generateOrderNumber();
    
    // Get system user for automated order creation
    const systemUserId = await getSystemUser();

    // Calculate total with discount
    let lineItemsTotal = recurring.lineItems.reduce(
      (sum, item) => sum + Number(item.unitPrice) * item.quantity,
      0
    );
    if (recurring.discountPercent) {
      lineItemsTotal *= (1 - Number(recurring.discountPercent) / 100);
    }

    // Get routing from template or default
    const routing: PrintingMethod[] = recurring.template?.defaultRouting || [];

    // Create the work order
    const workOrder = await prisma.workOrder.create({
      data: {
        orderNumber,
        customerName: recurring.customer?.companyName || recurring.customer?.name || recurring.name,
        customerId: recurring.customerId,
        description: `${recurring.name} - Auto-generated from recurring order`,
        createdById: systemUserId,
        status: 'PENDING',
        priority: 3,
        routing,
        recurringOrderId: recurring.id,
        // Set a default due date of 7 days from now
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        lineItems: {
          create: recurring.lineItems.map((item, index) => ({
            itemNumber: index + 1,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            notes: item.notes,
            itemMasterId: item.itemMasterId,
          })),
        },
        stationProgress: {
          create: routing.map((station) => ({
            station,
            status: 'NOT_STARTED',
          })),
        },
      },
      include: {
        lineItems: true,
        stationProgress: true,
      },
    });

    // Update recurring order
    const nextGenerateDate = calculateNextGenerateDate(
      recurring.frequency,
      recurring.customDays,
      new Date()
    );

    await prisma.recurringOrder.update({
      where: { id: recurring.id },
      data: {
        lastGeneratedAt: new Date(),
        nextGenerateDate,
        generationLogs: {
          create: {
            action: 'ORDER_GENERATED',
            details: `Auto-generated order ${orderNumber}`,
            generatedOrderId: workOrder.id,
          },
        },
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        action: 'CREATE',
        entityType: 'ORDER',
        entityId: workOrder.id,
        description: `Auto-generated order ${orderNumber} from recurring order "${recurring.name}"`,
        // System-generated, no user ID
      },
    });

    // Broadcast events
    broadcast({ type: 'ORDER_CREATED', payload: workOrder, timestamp: new Date() });
    broadcast({ 
      type: 'RECURRING_ORDER_GENERATED', 
      payload: { 
        recurringOrderId: recurring.id, 
        workOrderId: workOrder.id,
        orderNumber,
      }, 
      timestamp: new Date() 
    });

    return { 
      success: true, 
      workOrderId: workOrder.id,
      orderNumber,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Log the failure
    try {
      await prisma.recurringOrder.update({
        where: { id: recurringOrderId },
        data: {
          generationLogs: {
            create: {
              action: 'GENERATION_FAILED',
              details: `Auto-generation failed: ${errorMessage}`,
              errorMessage,
            },
          },
        },
      });
    } catch {
      // Ignore logging errors
    }
    
    return { success: false, error: errorMessage };
  }
}

/**
 * Process all due recurring orders
 * 
 * This function should be called on a schedule (e.g., every hour) to
 * automatically generate work orders from recurring orders that are due.
 */
export async function processRecurringOrders(): Promise<RecurringOrderProcessResult> {
  const result: RecurringOrderProcessResult = {
    processed: 0,
    generated: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  try {
    // Find all recurring orders that are due
    const dueOrders = await prisma.recurringOrder.findMany({
      where: {
        isActive: true,
        isPaused: false,
        nextGenerateDate: {
          lte: new Date(),
        },
        // Exclude orders that have already ended
        OR: [
          { endDate: null },
          { endDate: { gte: new Date() } },
        ],
      },
      select: {
        id: true,
        name: true,
        nextGenerateDate: true,
        customer: {
          select: { name: true },
        },
      },
    });

    result.processed = dueOrders.length;

    if (dueOrders.length === 0) {
      return result;
    }

    console.log(`🔄 Processing ${dueOrders.length} due recurring order(s)...`);

    // Process each due order
    for (const order of dueOrders) {
      const genResult = await generateOrderFromRecurring(order.id);
      
      if (genResult.success) {
        result.generated++;
        console.log(`  ✅ Generated ${genResult.orderNumber} from "${order.name}"`);
      } else {
        result.failed++;
        result.errors.push({
          recurringOrderId: order.id,
          name: order.name,
          error: genResult.error || 'Unknown error',
        });
        console.log(`  ❌ Failed to generate from "${order.name}": ${genResult.error}`);
      }
    }

    return result;
  } catch (error) {
    console.error('❌ Error processing recurring orders:', error);
    throw error;
  }
}

/**
 * Get upcoming recurring orders (for notifications)
 */
export async function getUpcomingRecurringOrders(daysAhead: number = 3): Promise<Array<{
  id: string;
  name: string;
  nextGenerateDate: Date;
  customerName: string;
  daysUntilDue: number;
}>> {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);

  const upcoming = await prisma.recurringOrder.findMany({
    where: {
      isActive: true,
      isPaused: false,
      nextGenerateDate: {
        gt: new Date(),
        lte: futureDate,
      },
    },
    select: {
      id: true,
      name: true,
      nextGenerateDate: true,
      customer: {
        select: { name: true, companyName: true },
      },
    },
    orderBy: { nextGenerateDate: 'asc' },
  });

  return upcoming.map(order => ({
    id: order.id,
    name: order.name,
    nextGenerateDate: order.nextGenerateDate,
    customerName: order.customer?.companyName || order.customer?.name || order.name,
    daysUntilDue: Math.ceil(
      (order.nextGenerateDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    ),
  }));
}

/**
 * Check for and send customer notifications for upcoming recurring orders
 * 
 * This sends notification emails to customers X days before their recurring
 * order is due to be generated (based on notifyDaysBefore setting).
 */
export async function sendRecurringOrderNotifications(): Promise<{
  sent: number;
  failed: number;
}> {
  const result = { sent: 0, failed: 0 };

  try {
    // Find orders that need notification
    const ordersNeedingNotification = await prisma.recurringOrder.findMany({
      where: {
        isActive: true,
        isPaused: false,
        nextGenerateDate: {
          gt: new Date(),
        },
        customer: {
          email: { not: null },
        },
      },
      include: {
        customer: {
          select: { 
            id: true,
            name: true, 
            companyName: true, 
            email: true,
          },
        },
        generationLogs: {
          where: {
            action: 'NOTIFICATION_SENT',
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    const now = new Date();

    for (const order of ordersNeedingNotification) {
      const daysUntilGeneration = Math.ceil(
        (order.nextGenerateDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Check if we should notify (within notify window and not already notified)
      if (daysUntilGeneration <= order.notifyDaysBefore) {
        // Check if we already sent a notification for this generation cycle
        const lastNotification = order.generationLogs[0];
        if (lastNotification && lastNotification.createdAt > order.lastGeneratedAt!) {
          // Already notified for this cycle
          continue;
        }

        // Queue a notification email
        try {
          // Check if customer has email
          if (!order.customer?.email) {
            continue;
          }

          // Add to email queue
          const emailBody = `
Dear ${order.customer.companyName || order.customer.name},

This is a reminder that your recurring order "${order.name}" is scheduled to be generated on ${order.nextGenerateDate.toLocaleDateString('en-US', { 
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})}.

If you need to make any changes or skip this order, please contact us before that date.

Thank you for your continued business!

Best regards,
Wilde Signs
          `.trim();
          
          await prisma.emailQueue.create({
            data: {
              recipientEmail: order.customer!.email!,
              recipientName: order.customer!.companyName || order.customer!.name,
              subject: `Upcoming Recurring Order: ${order.name}`,
              htmlBody: emailBody.replace(/\n/g, '<br>'),
              textBody: emailBody,
              status: 'PENDING',
              scheduledAt: new Date(),
              customerId: order.customer!.id,
            },
          });

          // Log the notification
          await prisma.recurringOrder.update({
            where: { id: order.id },
            data: {
              generationLogs: {
                create: {
                  action: 'NOTIFICATION_SENT',
                  details: `Customer notification sent - order due in ${daysUntilGeneration} day(s)`,
                },
              },
            },
          });

          result.sent++;
        } catch (error) {
          console.error(`Failed to send notification for ${order.name}:`, error);
          result.failed++;
        }
      }
    }

    return result;
  } catch (error) {
    console.error('Error sending recurring order notifications:', error);
    throw error;
  }
}

/**
 * Get statistics about recurring orders
 */
export async function getRecurringOrderStats(): Promise<{
  total: number;
  active: number;
  paused: number;
  dueToday: number;
  dueThisWeek: number;
  generatedThisMonth: number;
}> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const weekFromNow = new Date(today);
  weekFromNow.setDate(weekFromNow.getDate() + 7);
  
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const [total, active, paused, dueToday, dueThisWeek, generatedThisMonth] = await Promise.all([
    prisma.recurringOrder.count(),
    prisma.recurringOrder.count({ where: { isActive: true, isPaused: false } }),
    prisma.recurringOrder.count({ where: { isPaused: true } }),
    prisma.recurringOrder.count({
      where: {
        isActive: true,
        isPaused: false,
        nextGenerateDate: {
          gte: today,
          lt: tomorrow,
        },
      },
    }),
    prisma.recurringOrder.count({
      where: {
        isActive: true,
        isPaused: false,
        nextGenerateDate: {
          gte: today,
          lt: weekFromNow,
        },
      },
    }),
    prisma.recurringOrderLog.count({
      where: {
        action: 'ORDER_GENERATED',
        createdAt: {
          gte: monthStart,
        },
      },
    }),
  ]);

  return {
    total,
    active,
    paused,
    dueToday,
    dueThisWeek,
    generatedThisMonth,
  };
}
