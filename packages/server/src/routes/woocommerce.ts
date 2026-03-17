/**
 * WooCommerce Integration Routes
 * 
 * API endpoints for syncing with shop.wilde-signs.com
 */

import { Router, Request, Response } from 'express';
import { UserRole } from '@erp/shared';
import { wooCommerceService } from '../services/woocommerce.js';
import { authenticate, requireRole, type AuthRequest } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/v1/woocommerce/status
 * Check WooCommerce integration status
 */
router.get('/status', authenticate, async (_req: Request, res: Response) => {
  try {
    const isConfigured = wooCommerceService.isConfigured();
    
    res.json({
      configured: isConfigured,
      storeUrl: process.env.WOOCOMMERCE_URL || 'https://shop.wilde-signs.com',
      message: isConfigured 
        ? 'WooCommerce integration is configured and ready'
        : 'WooCommerce API credentials not configured. Set WOOCOMMERCE_CONSUMER_KEY and WOOCOMMERCE_CONSUMER_SECRET environment variables.',
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check WooCommerce status' });
  }
});

/**
 * POST /api/v1/woocommerce/sync/products
 * Sync products from WooCommerce to ERP Item Masters
 */
router.post('/sync/products', authenticate, requireRole(UserRole.ADMIN, UserRole.MANAGER), async (_req: Request, res: Response): Promise<void> => {
  try {
    if (!wooCommerceService.isConfigured()) {
      res.status(400).json({ error: 'WooCommerce integration not configured' });
      return;
    }

    const result = await wooCommerceService.syncProductsToItemMasters();
    
    res.json({
      success: true,
      message: `Synced products from WooCommerce`,
      created: result.created,
      updated: result.updated,
      errors: result.errors,
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to sync products',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/v1/woocommerce/sync/orders
 * Import WooCommerce orders as Work Orders
 */
router.post('/sync/orders', authenticate, requireRole(UserRole.ADMIN, UserRole.MANAGER), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!wooCommerceService.isConfigured()) {
      res.status(400).json({ error: 'WooCommerce integration not configured' });
      return;
    }

    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const result = await wooCommerceService.importOrdersAsWorkOrders(userId);
    
    res.json({
      success: true,
      message: `Imported orders from WooCommerce`,
      imported: result.imported,
      skipped: result.skipped,
      errors: result.errors,
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to import orders',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/v1/woocommerce/sync/inventory
 * Push inventory levels to WooCommerce
 */
router.post('/sync/inventory', authenticate, requireRole(UserRole.ADMIN, UserRole.MANAGER), async (_req: Request, res: Response): Promise<void> => {
  try {
    if (!wooCommerceService.isConfigured()) {
      res.status(400).json({ error: 'WooCommerce integration not configured' });
      return;
    }

    const result = await wooCommerceService.syncInventoryToWooCommerce();
    
    res.json({
      success: true,
      message: `Synced inventory to WooCommerce`,
      updated: result.updated,
      errors: result.errors,
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to sync inventory',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/v1/woocommerce/stats
 * Get WooCommerce store statistics
 */
router.get('/stats', authenticate, async (_req: Request, res: Response): Promise<void> => {
  try {
    if (!wooCommerceService.isConfigured()) {
      res.status(400).json({ error: 'WooCommerce integration not configured' });
      return;
    }

    const stats = await wooCommerceService.getStoreStats();
    
    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to get store stats',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
