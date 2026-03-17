import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Upload,
  FileImage,
  RefreshCw,
  Palette,
  Activity,
  Package,
  Clock,
  CheckCircle2,
  ArrowRight,
  Zap,
  Sparkles,
  Calculator,
  BarChart3,
  ShoppingBag,
  Tag,
} from 'lucide-react';
import { ordersApi, selfServiceApi, quoteApi } from '@/lib/api';
import { formatDate, formatCurrency, cn } from '@/lib/utils';

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: typeof Upload;
  color: string;
  href?: string;
  action?: () => void;
}

export function SelfServiceHubPage() {
  const { data: ordersData } = useQuery({
    queryKey: ['orders', { pageSize: 5 }],
    queryFn: () => ordersApi.list({ pageSize: 5 }).then((r) => r.data.data),
  });

  const { data: brandAssets } = useQuery({
    queryKey: ['brand-assets'],
    queryFn: () => selfServiceApi.getBrandAssets().then((r) => r.data.data),
  });

  // Product catalog data
  const { data: categoriesData } = useQuery({
    queryKey: ['quote-categories'],
    queryFn: () => quoteApi.getCategories().then((r) => r.data.data),
  });

  const { data: featuredProductsData } = useQuery({
    queryKey: ['quote-products-featured'],
    queryFn: () => quoteApi.getProducts().then((r) => r.data.data),
  });

  const categories = categoriesData || [];
  const featuredProducts = (featuredProductsData || []).slice(0, 6);

  const recentOrders = ordersData?.orders || [];
  const completedOrders = recentOrders.filter((o: any) => 
    ['COMPLETED', 'SHIPPED', 'DELIVERED'].includes(o.status)
  );

  const quickActions: QuickAction[] = [
    {
      id: 'instant-quote',
      title: 'Instant Quote',
      description: 'Get real-time pricing for your project',
      icon: Calculator,
      color: 'bg-primary-500',
      href: '/hub/quote',
    },
    {
      id: 'upload-artwork',
      title: 'Upload Artwork',
      description: 'Submit design files for your orders',
      icon: Upload,
      color: 'bg-blue-500',
      href: '/hub/artwork',
    },
    {
      id: 'annotate-proof',
      title: 'Annotate Proofs',
      description: 'Mark up proofs with change requests',
      icon: FileImage,
      color: 'bg-purple-500',
      href: '/proofs',
    },
    {
      id: 'quick-reorder',
      title: 'Quick Reorder',
      description: 'Reorder from past orders in one click',
      icon: RefreshCw,
      color: 'bg-green-500',
      href: '/hub/reorder',
    },
    {
      id: 'brand-assets',
      title: 'Brand Library',
      description: 'Manage your logos and brand files',
      icon: Palette,
      color: 'bg-amber-500',
      href: '/hub/brand-assets',
    },
    {
      id: 'my-insights',
      title: 'My Insights',
      description: 'View your relationship analytics',
      icon: BarChart3,
      color: 'bg-indigo-500',
      href: '/intelligence',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary-500" />
            Self-Service Hub
          </h1>
          <p className="mt-1 text-gray-500">
            Upload artwork, annotate proofs, reorder, and manage your brand assets
          </p>
        </div>
      </div>

      {/* Quick Actions Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {quickActions.map((action, index) => {
          const Icon = action.icon;
          return (
            <motion.div
              key={action.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Link
                to={action.href || '#'}
                className="block p-6 bg-white rounded-xl border border-gray-200 hover:shadow-lg hover:border-primary-200 transition-all group"
              >
                <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center mb-4', action.color)}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
                  {action.title}
                </h3>
                <p className="text-sm text-gray-500 mt-1">{action.description}</p>
                <div className="mt-4 flex items-center text-sm text-primary-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  Get Started
                  <ArrowRight className="w-4 h-4 ml-1" />
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>

      {/* Browse Products Section */}
      {categories.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-gradient-to-br from-primary-50 to-blue-50 rounded-xl border border-primary-200 p-6"
        >
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-primary-600" />
                Browse Our Products
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Explore our catalog and get instant pricing
              </p>
            </div>
            <Link
              to="/hub/quote"
              className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
            >
              View All
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-3">
            {categories.map((cat: any, index: number) => (
              <Link
                key={cat.id}
                to="/hub/quote"
                className="group flex flex-col items-center text-center p-3 bg-white/80 rounded-xl border border-white hover:shadow-md hover:border-primary-300 hover:bg-white transition-all"
              >
                <span className="text-2xl mb-2">{cat.icon || '📦'}</span>
                <span className="text-xs font-medium text-gray-700 group-hover:text-primary-700 leading-tight">
                  {cat.name}
                </span>
                {cat.children?.length > 0 && (
                  <span className="text-[10px] text-gray-400 mt-0.5">
                    {cat.children.length} types
                  </span>
                )}
              </Link>
            ))}
          </div>
        </motion.div>
      )}

      {/* Popular Products */}
      {featuredProducts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.38 }}
          className="bg-white rounded-xl border border-gray-200 overflow-hidden"
        >
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-primary-500" />
              <h2 className="font-semibold text-gray-900">Popular Products</h2>
            </div>
            <Link to="/hub/quote" className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
              See All Products
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 divide-x divide-y divide-gray-100">
            {featuredProducts.map((product: any) => (
              <Link
                key={product.id}
                to="/hub/quote"
                className="p-4 hover:bg-gray-50 transition-colors group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate group-hover:text-primary-600 transition-colors">
                      {product.name}
                    </p>
                    {product.description && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{product.description}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">SKU: {product.sku}</p>
                  </div>
                  <div className="text-right ml-3 flex-shrink-0">
                    <p className="font-bold text-primary-600 text-sm">
                      {formatCurrency(Number(product.basePrice))}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      {product.pricingUnit === 'EACH' ? 'each' :
                       product.pricingUnit === 'SQFT' ? '/sq ft' :
                       product.pricingUnit === 'LNFT' ? '/lin ft' :
                       product.pricingUnit?.toLowerCase()}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </motion.div>
      )}

      {/* Live Order Status */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-white rounded-xl border border-gray-200 overflow-hidden"
      >
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary-500" />
            <h2 className="font-semibold text-gray-900">Live Order Tracking</h2>
          </div>
          <Link to="/orders" className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
            View All
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="divide-y divide-gray-100">
          {recentOrders.slice(0, 3).map((order: any) => (
            <LiveOrderRow key={order.id} order={order} />
          ))}
          {recentOrders.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No active orders to track</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Quick Reorder Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200 p-6"
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Zap className="w-5 h-5 text-green-600" />
              Quick Reorder
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Reorder any past order with one click
            </p>
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {completedOrders.slice(0, 3).map((order: any) => (
            <ReorderCard key={order.id} order={order} />
          ))}
          {completedOrders.length === 0 && (
            <div className="md:col-span-3 text-center py-8 text-gray-500">
              <RefreshCw className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p>Complete orders will appear here for quick reorder</p>
            </div>
          )}
        </div>
        {completedOrders.length > 0 && (
          <Link
            to="/hub/reorder"
            className="mt-4 inline-flex items-center text-sm text-green-700 font-medium hover:text-green-800"
          >
            See all reorderable items
            <ArrowRight className="w-4 h-4 ml-1" />
          </Link>
        )}
      </motion.div>

      {/* Brand Assets Preview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="bg-white rounded-xl border border-gray-200 overflow-hidden"
      >
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-amber-500" />
            <h2 className="font-semibold text-gray-900">Brand Library</h2>
          </div>
          <Link to="/hub/brand-assets" className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
            Manage
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="p-4">
          {brandAssets?.assets?.length > 0 || brandAssets?.documents?.length > 0 ? (
            <div className="grid grid-cols-4 md:grid-cols-6 gap-4">
              {[...(brandAssets?.assets || []), ...(brandAssets?.documents || [])].slice(0, 6).map((asset: any) => (
                <div
                  key={asset.id}
                  className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden"
                >
                  {asset.filePath?.match(/\.(jpg|jpeg|png|gif|svg)$/i) ? (
                    <img
                      src={`/api/v1/uploads/${asset.filePath}`}
                      alt={asset.fileName || asset.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <FileImage className="w-8 h-8 text-gray-400" />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Palette className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p>Upload logos, brand guides, and style files</p>
              <Link to="/hub/brand-assets" className="btn btn-primary btn-sm mt-3">
                Add Brand Assets
              </Link>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// Live order tracking row with progress
function LiveOrderRow({ order }: { order: any }) {
  const { data: liveStatus } = useQuery({
    queryKey: ['live-status', order.id],
    queryFn: () => selfServiceApi.getLiveStatus(order.id).then((r) => r.data.data),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const progress = liveStatus?.completionPercent || 0;
  const currentStation = liveStatus?.currentStation?.name;

  return (
    <Link
      to={`/orders/${order.id}`}
      className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors"
    >
      <div className="flex-shrink-0">
        <div className="relative w-12 h-12">
          <svg className="w-12 h-12 transform -rotate-90">
            <circle
              cx="24"
              cy="24"
              r="20"
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="4"
            />
            <circle
              cx="24"
              cy="24"
              r="20"
              fill="none"
              stroke="#3b82f6"
              strokeWidth="4"
              strokeDasharray={`${progress * 1.25} 125`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-gray-700">
            {progress}%
          </div>
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 truncate">
          #{order.orderNumber}
        </p>
        <p className="text-sm text-gray-500 truncate">{order.description}</p>
      </div>
      <div className="text-right">
        {currentStation ? (
          <div className="flex items-center gap-1 text-sm text-blue-600">
            <Activity className="w-4 h-4 animate-pulse" />
            {currentStation.replace(/_/g, ' ')}
          </div>
        ) : order.status === 'COMPLETED' || order.status === 'SHIPPED' ? (
          <div className="flex items-center gap-1 text-sm text-green-600">
            <CheckCircle2 className="w-4 h-4" />
            {order.status}
          </div>
        ) : (
          <div className="flex items-center gap-1 text-sm text-gray-500">
            <Clock className="w-4 h-4" />
            {order.status.replace(/_/g, ' ')}
          </div>
        )}
        {order.dueDate && (
          <p className="text-xs text-gray-400 mt-1">
            Due: {formatDate(order.dueDate)}
          </p>
        )}
      </div>
      <ArrowRight className="w-5 h-5 text-gray-300" />
    </Link>
  );
}

// Reorder card
function ReorderCard({ order }: { order: any }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="font-medium text-gray-900 truncate text-sm">
        #{order.orderNumber}
      </p>
      <p className="text-xs text-gray-500 truncate mt-1">{order.description}</p>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {formatDate(order.createdAt)}
        </span>
        <Link
          to={`/hub/reorder?orderId=${order.id}`}
          className="text-xs font-medium text-green-600 hover:text-green-700 flex items-center gap-1"
        >
          <RefreshCw className="w-3 h-3" />
          Reorder
        </Link>
      </div>
    </div>
  );
}

export default SelfServiceHubPage;
