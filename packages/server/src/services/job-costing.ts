/**
 * Job Costing Service
 * 
 * Calculates and maintains job costs for work orders including:
 * - Labor costs (from TimeEntry records)
 * - Material costs (from MaterialUsage records)
 * - Other direct costs (subcontracting, shipping, etc.)
 * - Overhead allocation
 */

import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../db/client.js';
import { DEFAULT_LABOR_RATE, DEFAULT_OVERHEAD_PERCENT } from '@erp/shared';

export interface JobCostCalculation {
  workOrderId: string;
  quotedAmount: number;
  invoicedAmount: number | null;
  laborHours: number;
  laborRate: number;
  laborCost: number;
  materialCost: number;
  subcontractCost: number | null;
  shippingCost: number | null;
  otherDirectCost: number | null;
  overheadPercent: number | null;
  overheadCost: number | null;
  totalCost: number;
  grossProfit: number;
  grossMargin: number;
}

/**
 * Calculate labor hours and cost from TimeEntry records
 */
async function calculateLaborCosts(workOrderId: string, laborRate: number): Promise<{ hours: number; cost: number }> {
  const timeEntries = await prisma.timeEntry.findMany({
    where: { orderId: workOrderId },
  });

  let totalMinutes = 0;
  for (const entry of timeEntries) {
    if (entry.durationMinutes) {
      totalMinutes += entry.durationMinutes;
    } else if (entry.startTime && entry.endTime) {
      const duration = (new Date(entry.endTime).getTime() - new Date(entry.startTime).getTime()) / 60000;
      totalMinutes += Math.max(0, duration);
    }
  }

  const hours = totalMinutes / 60;
  const cost = hours * laborRate;

  return { hours: Math.round(hours * 100) / 100, cost: Math.round(cost * 100) / 100 };
}

/**
 * Calculate total material costs from MaterialUsage records
 */
async function calculateMaterialCosts(workOrderId: string): Promise<number> {
  const result = await prisma.materialUsage.aggregate({
    where: { workOrderId },
    _sum: { totalCost: true },
  });

  return result._sum.totalCost?.toNumber() ?? 0;
}

/**
 * Calculate quoted amount from line items
 */
async function calculateQuotedAmount(workOrderId: string): Promise<number> {
  const lineItems = await prisma.lineItem.findMany({
    where: { orderId: workOrderId },
  });

  let total = 0;
  for (const item of lineItems) {
    total += item.quantity * item.unitPrice.toNumber();
  }

  return Math.round(total * 100) / 100;
}

/**
 * Calculate job costs for a work order
 */
export async function calculateJobCost(
  workOrderId: string,
  options?: {
    laborRate?: number;
    overheadPercent?: number;
    subcontractCost?: number;
    shippingCost?: number;
    otherDirectCost?: number;
  }
): Promise<JobCostCalculation> {
  const laborRate = options?.laborRate ?? DEFAULT_LABOR_RATE;
  const overheadPercent = options?.overheadPercent ?? DEFAULT_OVERHEAD_PERCENT;

  // Get existing job cost if any (for invoiced amount, etc.)
  const existing = await prisma.jobCost.findUnique({
    where: { workOrderId },
  });

  // Calculate components
  const [laborResult, materialCost, quotedAmount] = await Promise.all([
    calculateLaborCosts(workOrderId, laborRate),
    calculateMaterialCosts(workOrderId),
    calculateQuotedAmount(workOrderId),
  ]);

  const subcontractCost = options?.subcontractCost ?? existing?.subcontractCost?.toNumber() ?? null;
  const shippingCost = options?.shippingCost ?? existing?.shippingCost?.toNumber() ?? null;
  const otherDirectCost = options?.otherDirectCost ?? existing?.otherDirectCost?.toNumber() ?? null;
  const invoicedAmount = existing?.invoicedAmount?.toNumber() ?? null;

  // Calculate totals
  const directCosts = laborResult.cost + materialCost + (subcontractCost ?? 0) + (shippingCost ?? 0) + (otherDirectCost ?? 0);
  const overheadCost = overheadPercent ? (directCosts * overheadPercent) / 100 : 0;
  const totalCost = directCosts + overheadCost;

  const revenueBase = invoicedAmount ?? quotedAmount;
  const grossProfit = revenueBase - totalCost;
  const grossMargin = revenueBase > 0 ? (grossProfit / revenueBase) * 100 : 0;

  return {
    workOrderId,
    quotedAmount,
    invoicedAmount,
    laborHours: laborResult.hours,
    laborRate,
    laborCost: laborResult.cost,
    materialCost,
    subcontractCost,
    shippingCost,
    otherDirectCost,
    overheadPercent,
    overheadCost: Math.round(overheadCost * 100) / 100,
    totalCost: Math.round(totalCost * 100) / 100,
    grossProfit: Math.round(grossProfit * 100) / 100,
    grossMargin: Math.round(grossMargin * 100) / 100,
  };
}

/**
 * Update or create job cost record for a work order
 */
export async function updateJobCost(workOrderId: string, options?: {
  laborRate?: number;
  overheadPercent?: number;
  invoicedAmount?: number | null;
  subcontractCost?: number | null;
  shippingCost?: number | null;
  otherDirectCost?: number | null;
}): Promise<JobCostCalculation> {
  const calculation = await calculateJobCost(workOrderId, {
    laborRate: options?.laborRate,
    overheadPercent: options?.overheadPercent,
    subcontractCost: options?.subcontractCost ?? undefined,
    shippingCost: options?.shippingCost ?? undefined,
    otherDirectCost: options?.otherDirectCost ?? undefined,
  });

  // Merge invoiced amount if provided
  if (options?.invoicedAmount !== undefined) {
    calculation.invoicedAmount = options.invoicedAmount;
    // Recalculate profit based on invoiced amount
    if (options.invoicedAmount !== null) {
      calculation.grossProfit = options.invoicedAmount - calculation.totalCost;
      calculation.grossMargin = options.invoicedAmount > 0 
        ? (calculation.grossProfit / options.invoicedAmount) * 100 
        : 0;
    }
  }

  await prisma.jobCost.upsert({
    where: { workOrderId },
    update: {
      quotedAmount: calculation.quotedAmount,
      invoicedAmount: calculation.invoicedAmount,
      laborHours: calculation.laborHours,
      laborRate: calculation.laborRate,
      laborCost: calculation.laborCost,
      materialCost: calculation.materialCost,
      subcontractCost: calculation.subcontractCost,
      shippingCost: calculation.shippingCost,
      otherDirectCost: calculation.otherDirectCost,
      overheadPercent: calculation.overheadPercent,
      overheadCost: calculation.overheadCost,
      totalCost: calculation.totalCost,
      grossProfit: calculation.grossProfit,
      grossMargin: calculation.grossMargin,
      calculatedAt: new Date(),
    },
    create: {
      workOrderId,
      quotedAmount: calculation.quotedAmount,
      invoicedAmount: calculation.invoicedAmount,
      laborHours: calculation.laborHours,
      laborRate: calculation.laborRate,
      laborCost: calculation.laborCost,
      materialCost: calculation.materialCost,
      subcontractCost: calculation.subcontractCost,
      shippingCost: calculation.shippingCost,
      otherDirectCost: calculation.otherDirectCost,
      overheadPercent: calculation.overheadPercent,
      overheadCost: calculation.overheadCost,
      totalCost: calculation.totalCost,
      grossProfit: calculation.grossProfit,
      grossMargin: calculation.grossMargin,
      calculatedAt: new Date(),
    },
  });

  return calculation;
}

/**
 * Get profitability summary for a date range
 */
export async function getProfitabilitySummary(options?: {
  fromDate?: Date;
  toDate?: Date;
}): Promise<{
  totalOrders: number;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  avgMargin: number;
  laborCost: number;
  materialCost: number;
  otherCost: number;
}> {
  const where: any = {};
  
  if (options?.fromDate || options?.toDate) {
    where.calculatedAt = {};
    if (options.fromDate) where.calculatedAt.gte = options.fromDate;
    if (options.toDate) where.calculatedAt.lte = options.toDate;
  }

  const jobCosts = await prisma.jobCost.findMany({ where });

  if (jobCosts.length === 0) {
    return {
      totalOrders: 0,
      totalRevenue: 0,
      totalCost: 0,
      totalProfit: 0,
      avgMargin: 0,
      laborCost: 0,
      materialCost: 0,
      otherCost: 0,
    };
  }

  let totalRevenue = 0;
  let totalCost = 0;
  let totalProfit = 0;
  let laborCost = 0;
  let materialCost = 0;
  let otherCost = 0;

  for (const jc of jobCosts) {
    const revenue = jc.invoicedAmount?.toNumber() ?? jc.quotedAmount.toNumber();
    totalRevenue += revenue;
    totalCost += jc.totalCost.toNumber();
    totalProfit += jc.grossProfit.toNumber();
    laborCost += jc.laborCost.toNumber();
    materialCost += jc.materialCost.toNumber();
    otherCost += (jc.subcontractCost?.toNumber() ?? 0) + 
                 (jc.shippingCost?.toNumber() ?? 0) + 
                 (jc.otherDirectCost?.toNumber() ?? 0) +
                 (jc.overheadCost?.toNumber() ?? 0);
  }

  const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  return {
    totalOrders: jobCosts.length,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalCost: Math.round(totalCost * 100) / 100,
    totalProfit: Math.round(totalProfit * 100) / 100,
    avgMargin: Math.round(avgMargin * 100) / 100,
    laborCost: Math.round(laborCost * 100) / 100,
    materialCost: Math.round(materialCost * 100) / 100,
    otherCost: Math.round(otherCost * 100) / 100,
  };
}

export default {
  calculateJobCost,
  updateJobCost,
  getProfitabilitySummary,
};
