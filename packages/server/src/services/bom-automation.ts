/**
 * BOM Automation Service
 * 
 * Handles automatic Bill of Materials operations:
 * - Template matching from order descriptions
 * - Auto-BOM generation from line items
 * - Material deduction on station completion
 * - Print job material estimation
 * - Waste tracking from Zund production
 * - Low stock auto-PO generation
 */

import { prisma } from '../db/client.js';
import { Decimal } from '@prisma/client/runtime/library';

// Material type patterns for matching
const MATERIAL_PATTERNS: Record<string, { keywords: string[]; category: string }> = {
  COROPLAST: { 
    keywords: ['coroplast', 'corrugated plastic', 'coro', 'yard sign'], 
    category: 'SUBSTRATE' 
  },
  VINYL: { 
    keywords: ['vinyl', 'adhesive vinyl', 'oracal', 'avery', '3m vinyl'], 
    category: 'MEDIA' 
  },
  BANNER: { 
    keywords: ['banner', 'scrim', '13oz', '15oz', 'mesh banner'], 
    category: 'MEDIA' 
  },
  FOAM_BOARD: { 
    keywords: ['foam board', 'foamcore', 'sintra', 'pvc foam'], 
    category: 'SUBSTRATE' 
  },
  ALUMINUM: { 
    keywords: ['aluminum', 'aluminium', 'dibond', 'acm', 'metal sign'], 
    category: 'SUBSTRATE' 
  },
  ACRYLIC: { 
    keywords: ['acrylic', 'plexiglass', 'lucite'], 
    category: 'SUBSTRATE' 
  },
  MAGNETIC: { 
    keywords: ['magnetic', 'magnet', 'vehicle magnet'], 
    category: 'MEDIA' 
  },
  CANVAS: { 
    keywords: ['canvas', 'stretched canvas'], 
    category: 'MEDIA' 
  },
  LAMINATE: { 
    keywords: ['laminate', 'overlaminate', 'lam', 'uv laminate'], 
    category: 'CONSUMABLE' 
  },
};

// Common sign type templates
const SIGN_TYPE_TEMPLATES: Record<string, { materials: string[]; defaultWaste: number }> = {
  'yard sign': { materials: ['COROPLAST', 'VINYL'], defaultWaste: 10 },
  'banner': { materials: ['BANNER'], defaultWaste: 5 },
  'vehicle wrap': { materials: ['VINYL', 'LAMINATE'], defaultWaste: 20 },
  'wall graphic': { materials: ['VINYL', 'LAMINATE'], defaultWaste: 15 },
  'window decal': { materials: ['VINYL'], defaultWaste: 10 },
  'floor graphic': { materials: ['VINYL', 'LAMINATE'], defaultWaste: 15 },
  'trade show': { materials: ['BANNER', 'VINYL'], defaultWaste: 10 },
  'aluminum sign': { materials: ['ALUMINUM', 'VINYL'], defaultWaste: 5 },
  'acrylic sign': { materials: ['ACRYLIC', 'VINYL'], defaultWaste: 5 },
  'foam board': { materials: ['FOAM_BOARD', 'VINYL'], defaultWaste: 10 },
  'magnetic sign': { materials: ['MAGNETIC'], defaultWaste: 10 },
};

export interface MaterialEstimate {
  itemMasterId: string;
  itemName: string;
  itemSku: string;
  quantity: Decimal;
  unit: string;
  unitCost: Decimal;
  totalCost: Decimal;
  wastePercent: number;
  source: 'template' | 'print_analysis' | 'manual';
}

export interface BOMSuggestion {
  orderId: string;
  orderNumber: string;
  materials: MaterialEstimate[];
  totalEstimatedCost: Decimal;
  confidence: 'high' | 'medium' | 'low';
  matchedTemplate?: string;
}

/**
 * Detect material types from order description and line items
 */
export function detectMaterialTypes(description: string, lineItems: Array<{ description: string }>): string[] {
  const lowerDesc = description.toLowerCase();
  const lineItemText = lineItems.map(li => li.description.toLowerCase()).join(' ');
  const combinedText = `${lowerDesc} ${lineItemText}`;
  
  const detectedMaterials: string[] = [];
  
  for (const [materialType, config] of Object.entries(MATERIAL_PATTERNS)) {
    for (const keyword of config.keywords) {
      if (combinedText.includes(keyword)) {
        if (!detectedMaterials.includes(materialType)) {
          detectedMaterials.push(materialType);
        }
        break;
      }
    }
  }
  
  return detectedMaterials;
}

/**
 * Match order to a template based on description
 */
export function matchTemplate(description: string): { template: string; materials: string[]; waste: number } | null {
  const lowerDesc = description.toLowerCase();
  
  for (const [templateName, config] of Object.entries(SIGN_TYPE_TEMPLATES)) {
    if (lowerDesc.includes(templateName)) {
      return {
        template: templateName,
        materials: config.materials,
        waste: config.defaultWaste,
      };
    }
  }
  
  return null;
}

/**
 * Calculate material area from dimensions (in square feet)
 */
export function calculateArea(width: number, height: number, unit: 'in' | 'ft' | 'mm' = 'in'): number {
  let sqFt = 0;
  
  switch (unit) {
    case 'in':
      sqFt = (width * height) / 144;
      break;
    case 'ft':
      sqFt = width * height;
      break;
    case 'mm':
      sqFt = (width * height) / 92903.04;
      break;
  }
  
  return Math.ceil(sqFt * 100) / 100; // Round up to 2 decimal places
}

/**
 * Parse dimensions from text (e.g., "24x36", "24" x 36"", "2ft x 3ft")
 */
export function parseDimensions(text: string): { width: number; height: number; unit: 'in' | 'ft' | 'mm' } | null {
  // Pattern: <number>x<number> with optional units
  const patterns = [
    /(\d+(?:\.\d+)?)\s*["']?\s*[xX×]\s*(\d+(?:\.\d+)?)\s*["']?(?:\s*(in|inch|inches|ft|feet|mm))?/i,
    /(\d+(?:\.\d+)?)\s*(?:ft|feet)\s*[xX×]\s*(\d+(?:\.\d+)?)\s*(?:ft|feet)/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const width = parseFloat(match[1]);
      const height = parseFloat(match[2]);
      let unit: 'in' | 'ft' | 'mm' = 'in';
      
      if (match[3]) {
        if (/ft|feet/i.test(match[3])) unit = 'ft';
        else if (/mm/i.test(match[3])) unit = 'mm';
      }
      
      // Check if pattern itself suggests feet
      if (/ft|feet/i.test(text) && !match[3]) unit = 'ft';
      
      return { width, height, unit };
    }
  }
  
  return null;
}

/**
 * Find matching ItemMaster records for material types
 */
export async function findMaterialItems(materialTypes: string[]): Promise<Map<string, Array<{ id: string; sku: string; name: string; costPrice: Decimal | null }>>> {
  const result = new Map<string, Array<{ id: string; sku: string; name: string; costPrice: Decimal | null }>>();
  
  for (const materialType of materialTypes) {
    const config = MATERIAL_PATTERNS[materialType];
    if (!config) continue;
    
    // Search for matching items
    const items = await prisma.itemMaster.findMany({
      where: {
        isActive: true,
        OR: config.keywords.map(keyword => ({
          OR: [
            { name: { contains: keyword, mode: 'insensitive' } },
            { category: { contains: config.category, mode: 'insensitive' } },
            { sku: { contains: materialType, mode: 'insensitive' } },
          ],
        })),
      },
      select: {
        id: true,
        sku: true,
        name: true,
        costPrice: true,
      },
      take: 5,
    });
    
    result.set(materialType, items);
  }
  
  return result;
}

/**
 * Generate BOM suggestions for a work order
 */
export async function generateBOMSuggestions(orderId: string): Promise<BOMSuggestion | null> {
  const order = await prisma.workOrder.findUnique({
    where: { id: orderId },
    include: {
      lineItems: {
        select: { description: true, quantity: true },
      },
    },
  });
  
  if (!order) return null;
  
  // Try template matching first
  const templateMatch = matchTemplate(order.description);
  
  // Detect materials from description
  const detectedMaterials = detectMaterialTypes(
    order.description, 
    order.lineItems.map(li => ({ description: li.description }))
  );
  
  // Use template materials if matched, otherwise use detected
  const materialTypes = templateMatch?.materials ?? detectedMaterials;
  
  if (materialTypes.length === 0) {
    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      materials: [],
      totalEstimatedCost: new Decimal(0),
      confidence: 'low',
    };
  }
  
  // Find matching items
  const itemsByType = await findMaterialItems(materialTypes);
  
  // Parse dimensions from description or line items
  let dimensions = parseDimensions(order.description);
  if (!dimensions) {
    for (const li of order.lineItems) {
      dimensions = parseDimensions(li.description);
      if (dimensions) break;
    }
  }
  
  // Calculate quantity (area-based for media/substrates)
  const area = dimensions ? calculateArea(dimensions.width, dimensions.height, dimensions.unit) : 1;
  const totalQuantity = order.lineItems.reduce((sum, li) => sum + li.quantity, 0) || 1;
  const wastePercent = templateMatch?.waste ?? 10;
  
  const materials: MaterialEstimate[] = [];
  let totalCost = new Decimal(0);
  
  for (const [materialType, items] of itemsByType) {
    if (items.length === 0) continue;
    
    // Use the first matching item (in production, you'd want smarter selection)
    const item = items[0];
    const baseQuantity = new Decimal(area * totalQuantity);
    const wasteMultiplier = 1 + wastePercent / 100;
    const quantity = baseQuantity.mul(wasteMultiplier);
    const unitCost = item.costPrice ?? new Decimal(0);
    const lineCost = quantity.mul(unitCost);
    
    materials.push({
      itemMasterId: item.id,
      itemName: item.name,
      itemSku: item.sku,
      quantity,
      unit: 'SQFT',
      unitCost,
      totalCost: lineCost,
      wastePercent,
      source: templateMatch ? 'template' : 'print_analysis',
    });
    
    totalCost = totalCost.add(lineCost);
  }
  
  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    materials,
    totalEstimatedCost: totalCost,
    confidence: templateMatch ? 'high' : materials.length > 0 ? 'medium' : 'low',
    matchedTemplate: templateMatch?.template,
  };
}

/**
 * Create BOM from suggestions (actually creates the records)
 */
export async function createBOMFromSuggestions(
  orderId: string, 
  materials: MaterialEstimate[],
  userId: string
): Promise<void> {
  const order = await prisma.workOrder.findUnique({
    where: { id: orderId },
  });
  
  if (!order) throw new Error('Order not found');
  
  // Record material usage for each material
  for (const material of materials) {
    await prisma.materialUsage.create({
      data: {
        workOrderId: orderId,
        itemMasterId: material.itemMasterId,
        quantity: material.quantity,
        unit: material.unit,
        unitCost: material.unitCost,
        totalCost: material.totalCost,
        recordedById: userId,
        notes: `Auto-generated from BOM suggestion (${material.source})`,
      },
    });
  }
}

/**
 * Deduct materials from inventory when station is completed
 */
export async function deductMaterialsOnStationComplete(
  orderId: string,
  station: string,
  userId: string
): Promise<{ deducted: number; errors: string[] }> {
  const result = { deducted: 0, errors: [] as string[] };
  
  // Get material usage for this order
  const materialUsages = await prisma.materialUsage.findMany({
    where: { workOrderId: orderId },
    include: {
      itemMaster: {
        select: { id: true, sku: true, name: true },
      },
    },
  });
  
  if (materialUsages.length === 0) {
    return result;
  }
  
  // Deduct from inventory for each material
  for (const usage of materialUsages) {
    try {
      // Find available inventory
      const inventory = await prisma.inventoryItem.findFirst({
        where: {
          itemMasterId: usage.itemMasterId,
          status: 'AVAILABLE',
          quantity: { gt: 0 },
        },
        orderBy: { quantity: 'desc' },
      });
      
      if (inventory) {
        const deductQty = Math.ceil(usage.quantity.toNumber());
        const newQty = Math.max(0, inventory.quantity - deductQty);
        
        await prisma.inventoryItem.update({
          where: { id: inventory.id },
          data: {
            quantity: newQty,
            status: newQty === 0 ? 'DEPLETED' : 'AVAILABLE',
          },
        });
        
        result.deducted++;
      } else {
        result.errors.push(`No inventory for ${usage.itemMaster.name}`);
      }
    } catch (err: any) {
      result.errors.push(`Failed to deduct ${usage.itemMaster.name}: ${err.message}`);
    }
  }
  
  return result;
}

/**
 * Estimate materials from Thrive print job data
 */
export async function estimateMaterialsFromPrintJob(printJobData: {
  media: string;
  jobSize: string;
  inkCoverage: string;
  copies: number;
}): Promise<MaterialEstimate[]> {
  const materials: MaterialEstimate[] = [];
  
  // Parse job size (format: "24.00 x 36.00 in" or similar)
  const sizeMatch = printJobData.jobSize?.match(/(\d+\.?\d*)\s*x\s*(\d+\.?\d*)/i);
  const area = sizeMatch 
    ? calculateArea(parseFloat(sizeMatch[1]), parseFloat(sizeMatch[2]), 'in')
    : 1;
  
  // Find matching media in inventory
  if (printJobData.media) {
    const mediaItems = await prisma.itemMaster.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { contains: printJobData.media, mode: 'insensitive' } },
          { sku: { contains: printJobData.media, mode: 'insensitive' } },
        ],
      },
      take: 1,
    });
    
    if (mediaItems.length > 0) {
      const item = mediaItems[0];
      const quantity = new Decimal(area * printJobData.copies * 1.1); // 10% waste
      
      materials.push({
        itemMasterId: item.id,
        itemName: item.name,
        itemSku: item.sku,
        quantity,
        unit: 'SQFT',
        unitCost: item.costPrice ?? new Decimal(0),
        totalCost: quantity.mul(item.costPrice ?? new Decimal(0)),
        wastePercent: 10,
        source: 'print_analysis',
      });
    }
  }
  
  // Estimate ink usage based on coverage
  const inkCoverage = parseFloat(printJobData.inkCoverage) || 0;
  if (inkCoverage > 0) {
    // Rough estimate: 0.01 liters per sqft at 100% coverage
    const inkUsage = (area * printJobData.copies * inkCoverage / 100) * 0.01;
    
    const inkItems = await prisma.itemMaster.findMany({
      where: {
        isActive: true,
        OR: [
          { category: { contains: 'ink', mode: 'insensitive' } },
          { name: { contains: 'ink', mode: 'insensitive' } },
        ],
      },
      take: 1,
    });
    
    if (inkItems.length > 0) {
      const item = inkItems[0];
      const quantity = new Decimal(inkUsage);
      
      materials.push({
        itemMasterId: item.id,
        itemName: item.name,
        itemSku: item.sku,
        quantity,
        unit: 'LITER',
        unitCost: item.costPrice ?? new Decimal(0),
        totalCost: quantity.mul(item.costPrice ?? new Decimal(0)),
        wastePercent: 5,
        source: 'print_analysis',
      });
    }
  }
  
  return materials;
}

/**
 * Track Zund waste vs estimated
 */
export async function trackZundWaste(
  orderId: string,
  actualCopyCount: number,
  estimatedMaterialArea: number
): Promise<{ variancePercent: number; notes: string }> {
  // Get estimated material usage
  const usage = await prisma.materialUsage.findMany({
    where: { workOrderId: orderId },
  });
  
  if (usage.length === 0) {
    return { variancePercent: 0, notes: 'No material usage recorded' };
  }
  
  const totalEstimated = usage.reduce((sum, u) => sum + u.quantity.toNumber(), 0);
  const variance = ((estimatedMaterialArea - totalEstimated) / totalEstimated) * 100;
  
  return {
    variancePercent: Math.round(variance * 100) / 100,
    notes: variance > 0 
      ? `Actual usage ${variance.toFixed(1)}% higher than estimated`
      : `Actual usage ${Math.abs(variance).toFixed(1)}% lower than estimated`,
  };
}

/**
 * Check for low stock items and generate draft PO suggestions
 */
export async function checkLowStockAndSuggestPO(): Promise<Array<{
  itemId: string;
  itemSku: string;
  itemName: string;
  currentStock: number;
  reorderPoint: number;
  suggestedQty: number;
  preferredVendor?: { id: string; name: string };
}>> {
  const suggestions: Array<{
    itemId: string;
    itemSku: string;
    itemName: string;
    currentStock: number;
    reorderPoint: number;
    suggestedQty: number;
    preferredVendor?: { id: string; name: string };
  }> = [];
  
  // Get all items with their inventory
  const items = await prisma.itemMaster.findMany({
    where: { isActive: true },
    include: {
      inventoryItems: {
        where: { status: 'AVAILABLE' },
      },
      vendorPricing: {
        where: { isActive: true },
        orderBy: { effectiveDate: 'desc' },
        include: {
          vendor: { select: { id: true, name: true } },
        },
        take: 1,
      },
    },
  });
  
  for (const item of items) {
    const currentStock = item.inventoryItems.reduce((sum, inv) => sum + inv.quantity, 0);
    const reorderPoint = 10; // Default - in production, this would be configurable per item
    
    if (currentStock < reorderPoint) {
      const suggestedQty = Math.max(reorderPoint * 2, 50); // Order 2x reorder point or 50, whichever is higher
      
      suggestions.push({
        itemId: item.id,
        itemSku: item.sku,
        itemName: item.name,
        currentStock,
        reorderPoint,
        suggestedQty,
        preferredVendor: item.vendorPricing[0]?.vendor,
      });
    }
  }
  
  return suggestions;
}

/**
 * Create draft PO from low stock suggestion
 */
export async function createDraftPOFromSuggestion(
  suggestion: { itemId: string; suggestedQty: number; preferredVendor?: { id: string } },
  userId: string
): Promise<string | null> {
  if (!suggestion.preferredVendor) {
    return null; // No vendor to order from
  }
  
  const item = await prisma.itemMaster.findUnique({
    where: { id: suggestion.itemId },
    include: {
      vendorPricing: {
        where: { vendorId: suggestion.preferredVendor.id },
        take: 1,
      },
    },
  });
  
  if (!item) return null;
  
  const pricing = item.vendorPricing[0];
  const unitPrice = pricing?.basePrice ?? item.costPrice ?? new Decimal(0);
  
  // Create the PO
  const lineTotal = unitPrice.mul(suggestion.suggestedQty);
  const po = await prisma.purchaseOrder.create({
    data: {
      poNumber: `PO-AUTO-${Date.now()}`,
      vendorId: suggestion.preferredVendor.id,
      status: 'DRAFT',
      createdById: userId,
      subtotal: lineTotal,
      total: lineTotal,
      lineItems: {
        create: {
          itemMasterId: suggestion.itemId,
          description: item.name,
          quantity: suggestion.suggestedQty,
          unitCost: unitPrice,
          totalCost: unitPrice.mul(suggestion.suggestedQty),
        },
      },
    },
  });
  
  return po.id;
}

export const bomAutomationService = {
  detectMaterialTypes,
  matchTemplate,
  parseDimensions,
  calculateArea,
  findMaterialItems,
  generateBOMSuggestions,
  createBOMFromSuggestions,
  deductMaterialsOnStationComplete,
  estimateMaterialsFromPrintJob,
  trackZundWaste,
  checkLowStockAndSuggestPO,
  createDraftPOFromSuggestion,
};
