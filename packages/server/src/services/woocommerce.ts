/**
 * WooCommerce Integration Service for Wilde Signs Online Store
 * 
 * This service provides integration with shop.wilde-signs.com (WooCommerce)
 * to sync products, orders, and inventory between the ERP and online store.
 * 
 * Features:
 * - Sync product catalog from WooCommerce to ERP Item Masters
 * - Import online orders as Work Orders
 * - Push inventory levels to WooCommerce
 * - Track order fulfillment status
 * 
 * Setup Requirements:
 * 1. Enable WooCommerce REST API in WordPress admin
 * 2. Generate Consumer Key and Consumer Secret
 * 3. Set environment variables:
 *    - WOOCOMMERCE_URL=https://shop.wilde-signs.com
 *    - WOOCOMMERCE_CONSUMER_KEY=ck_xxxxx
 *    - WOOCOMMERCE_CONSUMER_SECRET=cs_xxxxx
 */

import { PrismaClient, PrintingMethod } from '@prisma/client';
import { applyRoutingDefaults } from '../lib/routing-defaults.js';

const prisma = new PrismaClient();

/**
 * Try to find a matching customer ID for the given customer name.
 * Used to auto-link WooCommerce orders to customer profiles.
 */
async function resolveCustomerIdLocal(customerName: string): Promise<string | null> {
  if (!customerName || customerName.trim().length < 3) return null;
  const match = await prisma.customer.findFirst({
    where: {
      OR: [
        { name: { equals: customerName, mode: 'insensitive' } },
        { companyName: { equals: customerName, mode: 'insensitive' } },
        { name: { contains: customerName, mode: 'insensitive' } },
        { companyName: { contains: customerName, mode: 'insensitive' } },
      ],
    },
    select: { id: true },
  });
  return match?.id || null;
}

// WooCommerce API configuration
interface WooCommerceConfig {
  url: string;
  consumerKey: string;
  consumerSecret: string;
}

// WooCommerce Product from API
interface WooProduct {
  id: number;
  name: string;
  sku: string;
  price: string;
  regular_price: string;
  sale_price: string;
  description: string;
  short_description: string;
  categories: { id: number; name: string; slug: string }[];
  images: { id: number; src: string; alt: string }[];
  stock_quantity: number | null;
  stock_status: 'instock' | 'outofstock' | 'onbackorder';
  manage_stock: boolean;
  permalink: string;
}

// WooCommerce Order from API
interface WooOrder {
  id: number;
  number: string;
  status: 'pending' | 'processing' | 'on-hold' | 'completed' | 'cancelled' | 'refunded' | 'failed';
  date_created: string;
  date_modified: string;
  customer_id: number;
  billing: {
    first_name: string;
    last_name: string;
    company: string;
    email: string;
    phone: string;
  };
  shipping: {
    first_name: string;
    last_name: string;
    company: string;
    address_1: string;
    address_2: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
  };
  line_items: {
    id: number;
    name: string;
    product_id: number;
    sku: string;
    quantity: number;
    price: string;
    total: string;
  }[];
  total: string;
  customer_note: string;
}

// Category to routing mapping based on Wilde Signs product categories
const CATEGORY_ROUTING_MAP: Record<string, PrintingMethod[]> = {
  'signs': [PrintingMethod.DESIGN, PrintingMethod.FLATBED, PrintingMethod.SHIPPING_RECEIVING],
  'sign-frames': [PrintingMethod.PRODUCTION, PrintingMethod.SHIPPING_RECEIVING],
  'decals': [PrintingMethod.PRODUCTION, PrintingMethod.SHIPPING_RECEIVING],
  'pump-toppers': [PrintingMethod.DESIGN, PrintingMethod.FLATBED, PrintingMethod.SHIPPING_RECEIVING],
  'poster-frame-inserts': [PrintingMethod.DESIGN, PrintingMethod.FLATBED, PrintingMethod.SHIPPING_RECEIVING],
  'floor-graphics': [PrintingMethod.DESIGN, PrintingMethod.ROLL_TO_ROLL, PrintingMethod.PRODUCTION],
  'hardware': [PrintingMethod.SHIPPING_RECEIVING],
  'banners': [PrintingMethod.DESIGN, PrintingMethod.ROLL_TO_ROLL, PrintingMethod.PRODUCTION],
  'vehicle-wraps': [PrintingMethod.DESIGN, PrintingMethod.ROLL_TO_ROLL, PrintingMethod.INSTALLATION],
  'window-graphics': [PrintingMethod.DESIGN, PrintingMethod.ROLL_TO_ROLL],
};

class WooCommerceService {
  private config: WooCommerceConfig;
  private baseUrl: string;

  constructor() {
    this.config = {
      url: process.env.WOOCOMMERCE_URL || 'https://shop.wilde-signs.com',
      consumerKey: process.env.WOOCOMMERCE_CONSUMER_KEY || '',
      consumerSecret: process.env.WOOCOMMERCE_CONSUMER_SECRET || '',
    };
    this.baseUrl = `${this.config.url}/wp-json/wc/v3`;
  }

  /**
   * Check if WooCommerce integration is configured
   */
  isConfigured(): boolean {
    return !!(this.config.consumerKey && this.config.consumerSecret);
  }

  /**
   * Make authenticated request to WooCommerce API
   */
  private async apiRequest<T>(endpoint: string, method: 'GET' | 'POST' | 'PUT' = 'GET', body?: unknown): Promise<T> {
    if (!this.isConfigured()) {
      throw new Error('WooCommerce API credentials not configured');
    }

    const url = `${this.baseUrl}${endpoint}`;
    const auth = Buffer.from(`${this.config.consumerKey}:${this.config.consumerSecret}`).toString('base64');

    const options: RequestInit = {
      method,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error(`WooCommerce API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as T;
  }

  /**
   * Fetch all products from WooCommerce store
   */
  async fetchProducts(page = 1, perPage = 100): Promise<WooProduct[]> {
    return this.apiRequest<WooProduct[]>(`/products?page=${page}&per_page=${perPage}`);
  }

  /**
   * Fetch all orders from WooCommerce store
   */
  async fetchOrders(status?: string, page = 1, perPage = 100): Promise<WooOrder[]> {
    const statusParam = status ? `&status=${status}` : '';
    return this.apiRequest<WooOrder[]>(`/orders?page=${page}&per_page=${perPage}${statusParam}`);
  }

  /**
   * Sync WooCommerce products to ERP Item Masters
   */
  async syncProductsToItemMasters(): Promise<{ created: number; updated: number; errors: string[] }> {
    const result = { created: 0, updated: 0, errors: [] as string[] };

    try {
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const products = await this.fetchProducts(page);
        
        if (products.length === 0) {
          hasMore = false;
          break;
        }

        for (const product of products) {
          try {
            const sku = product.sku || `WOO-${product.id}`;
            const category = product.categories[0]?.name || 'Uncategorized';
            const unitPrice = parseFloat(product.price) || 0;
            
            // Estimate cost as 40% of retail price
            const costPrice = unitPrice * 0.4;

            const existing = await prisma.itemMaster.findUnique({
              where: { sku },
            });

            if (existing) {
              await prisma.itemMaster.update({
                where: { sku },
                data: {
                  name: product.name,
                  category,
                  unitPrice,
                  costPrice,
                },
              });
              result.updated++;
            } else {
              await prisma.itemMaster.create({
                data: {
                  sku,
                  name: product.name,
                  category,
                  unitPrice,
                  costPrice,
                },
              });
              result.created++;
            }
          } catch (err) {
            result.errors.push(`Product ${product.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
          }
        }

        page++;
        if (products.length < 100) {
          hasMore = false;
        }
      }
    } catch (err) {
      result.errors.push(`Sync failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Import WooCommerce orders as Work Orders
   */
  async importOrdersAsWorkOrders(adminUserId: string): Promise<{ imported: number; skipped: number; errors: string[] }> {
    const result = { imported: 0, skipped: 0, errors: [] as string[] };

    try {
      // Fetch processing orders (paid but not shipped)
      const orders = await this.fetchOrders('processing');

      for (const order of orders) {
        try {
          // Check if order already exists
          const orderNumber = `WOO-${order.number}`;
          const existing = await prisma.workOrder.findUnique({
            where: { orderNumber },
          });

          if (existing) {
            result.skipped++;
            continue;
          }

          // Determine routing based on product categories
          const categories = order.line_items
            .map(item => item.name.toLowerCase())
            .join(' ');
          
          let routing: PrintingMethod[] = [PrintingMethod.PRODUCTION, PrintingMethod.SHIPPING_RECEIVING];
          
          for (const [keyword, route] of Object.entries(CATEGORY_ROUTING_MAP)) {
            if (categories.includes(keyword)) {
              routing = route;
              break;
            }
          }

          // Apply routing defaults (auto-add PRODUCTION, SHIPPING_RECEIVING, etc.)
          const description = `Online order from shop.wilde-signs.com - Order #${order.number}`;
          routing = applyRoutingDefaults(routing as any, { description }) as unknown as PrintingMethod[];

          // Create customer name
          const customerName = order.billing.company || 
            `${order.billing.first_name} ${order.billing.last_name}`.trim() ||
            'Online Customer';

          // Auto-link to customer profile if possible
          const customerId = await resolveCustomerIdLocal(customerName);

          // Create work order
          await prisma.workOrder.create({
            data: {
              orderNumber,
              customerName,
              customerId: customerId || undefined,
              description: `Online order from shop.wilde-signs.com - Order #${order.number}`,
              status: 'PENDING',
              priority: 3,
              routing,
              notes: order.customer_note || `Shipping: ${order.shipping.address_1}, ${order.shipping.city}, ${order.shipping.state} ${order.shipping.postcode}`,
              createdById: adminUserId,
              lineItems: {
                create: order.line_items.map((item, index) => ({
                  itemNumber: index + 1,
                  description: item.name,
                  quantity: item.quantity,
                  unitPrice: parseFloat(item.price),
                })),
              },
              stationProgress: {
                create: routing.map((station) => ({
                  station,
                  status: 'NOT_STARTED',
                })),
              },
              events: {
                create: {
                  eventType: 'CREATED',
                  description: `Imported from WooCommerce order #${order.number}`,
                  userId: adminUserId,
                },
              },
            },
          });

          result.imported++;
        } catch (err) {
          result.errors.push(`Order ${order.number}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }
    } catch (err) {
      result.errors.push(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Update WooCommerce order status when ERP work order is shipped
   */
  async updateOrderStatus(wooOrderNumber: string, status: 'processing' | 'completed'): Promise<void> {
    // Extract the WooCommerce order number (remove WOO- prefix)
    const orderId = wooOrderNumber.replace('WOO-', '');
    
    await this.apiRequest(`/orders/${orderId}`, 'PUT', { status });
  }

  /**
   * Push inventory levels to WooCommerce
   */
  async syncInventoryToWooCommerce(): Promise<{ updated: number; errors: string[] }> {
    const result = { updated: 0, errors: [] as string[] };

    try {
      // Get all inventory items with SKUs that might be in WooCommerce
      const inventory = await prisma.inventoryItem.findMany({
        include: {
          itemMaster: true,
        },
      });

      for (const item of inventory) {
        try {
          const sku = item.itemMaster.sku;
          
          // Skip non-WooCommerce SKUs
          if (!sku.startsWith('WOO-')) continue;

          const productId = sku.replace('WOO-', '');
          
          await this.apiRequest(`/products/${productId}`, 'PUT', {
            stock_quantity: item.quantity,
            manage_stock: true,
          });

          result.updated++;
        } catch (err) {
          result.errors.push(`SKU ${item.itemMaster.sku}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }
    } catch (err) {
      result.errors.push(`Sync failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Get store statistics for dashboard
   */
  async getStoreStats(): Promise<{
    totalProducts: number;
    pendingOrders: number;
    processingOrders: number;
    recentOrders: WooOrder[];
  }> {
    const [products, pendingOrders, processingOrders] = await Promise.all([
      this.fetchProducts(1, 1), // Just to get count from headers
      this.fetchOrders('pending'),
      this.fetchOrders('processing'),
    ]);

    return {
      totalProducts: products.length, // Would need to parse X-WP-Total header for actual count
      pendingOrders: pendingOrders.length,
      processingOrders: processingOrders.length,
      recentOrders: processingOrders.slice(0, 5),
    };
  }
}

// Export singleton instance
export const wooCommerceService = new WooCommerceService();
export default wooCommerceService;
