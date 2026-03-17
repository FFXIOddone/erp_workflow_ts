import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  DollarSign,
  Package,
  CheckCircle,
  MessageSquare,
  FileText,
  Clock,
  ChevronRight,
  Sparkles,
  Target,
  BarChart3,
  PieChart,
  Award,
  Heart,
  RefreshCw,
  ShoppingCart,
  Bell,
  Lightbulb,
} from 'lucide-react';
import { intelligenceApi } from '@/lib/api';
import { formatCurrency, formatRelativeTime, cn } from '@/lib/utils';

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

// Tier badge colors
const tierColors: Record<string, string> = {
  PLATINUM: 'bg-gradient-to-r from-slate-400 to-slate-600 text-white',
  GOLD: 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-white',
  SILVER: 'bg-gradient-to-r from-gray-300 to-gray-400 text-gray-800',
  BRONZE: 'bg-gradient-to-r from-orange-300 to-orange-500 text-white',
  NEW: 'bg-gradient-to-r from-green-400 to-green-500 text-white',
  AT_RISK: 'bg-gradient-to-r from-red-400 to-red-500 text-white',
  INACTIVE: 'bg-gray-400 text-white',
};

// Timeline event icons
const timelineIcons: Record<string, typeof Package> = {
  ORDER: Package,
  QUOTE: FileText,
  MESSAGE: MessageSquare,
  PROOF: CheckCircle,
};

const timelineColors: Record<string, string> = {
  ORDER: 'bg-primary-100 text-primary-600',
  QUOTE: 'bg-purple-100 text-purple-600',
  MESSAGE: 'bg-blue-100 text-blue-600',
  PROOF: 'bg-green-100 text-green-600',
};

// Recommendation type icons
const recommendationIcons: Record<string, typeof Lightbulb> = {
  REORDER: RefreshCw,
  SEASONAL: Calendar,
  UPGRADE: TrendingUp,
  CROSS_SELL: ShoppingCart,
  LOYALTY: Award,
  ACTION: Bell,
};

export function CustomerIntelligencePage() {
  // Fetch all intelligence data
  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['intelligence-overview'],
    queryFn: () => intelligenceApi.getOverview().then((r) => r.data.data),
  });

  const { data: timeline } = useQuery({
    queryKey: ['intelligence-timeline'],
    queryFn: () => intelligenceApi.getTimeline(20).then((r) => r.data.data),
  });

  const { data: trends } = useQuery({
    queryKey: ['intelligence-trends'],
    queryFn: () => intelligenceApi.getTrends(12).then((r) => r.data.data),
  });

  const { data: recommendations } = useQuery({
    queryKey: ['intelligence-recommendations'],
    queryFn: () => intelligenceApi.getRecommendations().then((r) => r.data.data),
  });

  if (overviewLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-7 h-7 text-primary-500" />
            Customer Intelligence
          </h1>
          <p className="mt-1 text-gray-500">
            Your complete relationship overview with Wilde Signs
          </p>
        </div>
        {overview?.scores?.tier && (
          <div className={cn('px-4 py-2 rounded-full font-semibold flex items-center gap-2', tierColors[overview.scores.tier])}>
            <Award className="w-5 h-5" />
            {overview.scores.tier} Member
          </div>
        )}
      </motion.div>

      {/* Key Metrics Grid */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Lifetime Value"
          value={formatCurrency(overview?.metrics?.lifetimeValue || 0)}
          icon={DollarSign}
          color="bg-green-500"
          trend={overview?.metrics?.last12MonthsOrders > (overview?.metrics?.totalOrders / 2) ? 'up' : undefined}
        />
        <MetricCard
          title="Total Orders"
          value={overview?.metrics?.totalOrders || 0}
          icon={Package}
          color="bg-primary-500"
          subtitle={`${overview?.metrics?.last12MonthsOrders || 0} this year`}
        />
        <MetricCard
          title="Avg Order Value"
          value={formatCurrency(overview?.metrics?.averageOrderValue || 0)}
          icon={BarChart3}
          color="bg-purple-500"
        />
        <MetricCard
          title="Customer Since"
          value={overview?.metrics?.relationshipDays ? `${Math.floor(overview.metrics.relationshipDays / 365)} years` : 'New'}
          icon={Heart}
          color="bg-pink-500"
          subtitle={overview?.metrics?.firstOrderDate ? `Since ${new Date(overview.metrics.firstOrderDate).toLocaleDateString()}` : undefined}
        />
      </motion.div>

      {/* Scores & Recommendations Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Health Scores */}
        {overview?.scores && (
          <motion.div variants={itemVariants} className="card">
            <div className="card-header flex items-center gap-2">
              <Target className="w-5 h-5 text-primary-500" />
              <h2 className="font-semibold text-gray-900">Relationship Health</h2>
            </div>
            <div className="p-4 space-y-4">
              <ScoreBar label="Overall Score" value={overview.scores.overall} />
              <ScoreBar label="Financial Health" value={overview.scores.financial} color="green" />
              <ScoreBar label="Engagement" value={overview.scores.engagement} color="blue" />
              <ScoreBar label="Loyalty" value={overview.scores.loyalty} color="purple" />
              {overview.scores.churnRisk !== null && (
                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-600">Churn Risk</span>
                    <span className={cn(
                      'text-sm font-semibold',
                      overview.scores.churnRisk < 30 ? 'text-green-600' :
                      overview.scores.churnRisk < 60 ? 'text-yellow-600' : 'text-red-600'
                    )}>
                      {overview.scores.churnRisk < 30 ? 'Low' :
                       overview.scores.churnRisk < 60 ? 'Medium' : 'High'}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        overview.scores.churnRisk < 30 ? 'bg-green-500' :
                        overview.scores.churnRisk < 60 ? 'bg-yellow-500' : 'bg-red-500'
                      )}
                      style={{ width: `${100 - overview.scores.churnRisk}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Recommendations */}
        <motion.div variants={itemVariants} className="card">
          <div className="card-header flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-yellow-500" />
            <h2 className="font-semibold text-gray-900">Personalized Recommendations</h2>
          </div>
          <div className="divide-y divide-gray-100 max-h-[300px] overflow-y-auto">
            {!recommendations || recommendations.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-400" />
                <p>You're all caught up!</p>
              </div>
            ) : (
              recommendations.map((rec: any, idx: number) => {
                const Icon = recommendationIcons[rec.type] || Lightbulb;
                return (
                  <div key={idx} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex gap-3">
                      <div className={cn(
                        'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                        rec.priority === 'HIGH' ? 'bg-red-100 text-red-600' :
                        rec.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-600' :
                        'bg-gray-100 text-gray-600'
                      )}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900">{rec.title}</p>
                          {rec.priority === 'HIGH' && (
                            <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">
                              Action needed
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 mt-0.5">{rec.description}</p>
                        {rec.actionUrl && (
                          <Link
                            to={rec.actionUrl}
                            className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 mt-2"
                          >
                            Take action <ChevronRight className="w-4 h-4" />
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </motion.div>
      </div>

      {/* Trends Section */}
      {trends && (
        <motion.div variants={itemVariants} className="card">
          <div className="card-header flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary-500" />
              <h2 className="font-semibold text-gray-900">Spending Trends</h2>
            </div>
            <span className="text-sm text-gray-500">Last 12 months</span>
          </div>
          <div className="p-4">
            {/* Simple bar chart */}
            <div className="flex items-end gap-1 h-40 mb-4">
              {trends.monthly?.map((month: any) => {
                const maxRevenue = Math.max(...(trends.monthly?.map((m: any) => m.revenue) || [1]));
                const height = maxRevenue > 0 ? (month.revenue / maxRevenue) * 100 : 0;
                return (
                  <div
                    key={month.month}
                    className="flex-1 flex flex-col items-center"
                  >
                    <div
                      className={cn(
                        'w-full rounded-t transition-all',
                        height > 0 ? 'bg-primary-500 hover:bg-primary-600' : 'bg-gray-200'
                      )}
                      style={{ height: `${Math.max(height, 2)}%` }}
                      title={`${month.month}: ${formatCurrency(month.revenue)} (${month.orders} orders)`}
                    />
                    <span className="text-xs text-gray-400 mt-1 rotate-[-45deg] origin-top-left">
                      {month.month.split('-')[1]}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Top Categories */}
            {trends.topCategories && trends.topCategories.length > 0 && (
              <div className="border-t pt-4 mt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                  <PieChart className="w-4 h-4" />
                  Your Top Categories
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {trends.topCategories.map((cat: any) => (
                    <div key={cat.name} className="text-center p-3 bg-gray-50 rounded-lg">
                      <div className="text-lg font-bold text-gray-900">{formatCurrency(cat.revenue)}</div>
                      <div className="text-sm text-gray-500">{cat.name}</div>
                      <div className="text-xs text-gray-400">{cat.count} items</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Timeline Section */}
      <motion.div variants={itemVariants} className="card">
        <div className="card-header flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary-500" />
          <h2 className="font-semibold text-gray-900">Relationship Timeline</h2>
        </div>
        <div className="p-4">
          {!timeline || timeline.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p>No activity yet. Start your journey!</p>
              <Link to="/hub/quote" className="btn btn-primary mt-4">
                Get Your First Quote
              </Link>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200" />

              <div className="space-y-4">
                {timeline.slice(0, 10).map((event: any) => {
                  const Icon = timelineIcons[event.type] || Package;
                  const colorClass = timelineColors[event.type] || 'bg-gray-100 text-gray-600';

                  return (
                    <div key={`${event.type}-${event.id}`} className="relative pl-12">
                      {/* Icon */}
                      <div className={cn(
                        'absolute left-0 w-10 h-10 rounded-full flex items-center justify-center',
                        colorClass
                      )}>
                        <Icon className="w-5 h-5" />
                      </div>

                      {/* Content */}
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-gray-900">{event.title}</span>
                          <span className="text-xs text-gray-500">
                            {formatRelativeTime(new Date(event.date))}
                          </span>
                        </div>
                        {event.description && (
                          <p className="text-sm text-gray-600">{event.description}</p>
                        )}
                        {event.amount !== null && event.amount > 0 && (
                          <p className="text-sm font-medium text-green-600 mt-1">
                            {formatCurrency(event.amount)}
                          </p>
                        )}
                        {event.status && (
                          <span className={cn(
                            'inline-block mt-2 px-2 py-0.5 text-xs rounded-full',
                            event.status === 'COMPLETED' || event.status === 'APPROVED' || event.status === 'SHIPPED'
                              ? 'bg-green-100 text-green-700'
                              : event.status === 'IN_PROGRESS' || event.status === 'PENDING'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-gray-100 text-gray-700'
                          )}>
                            {event.status.replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {timeline.length > 10 && (
                <div className="text-center mt-6">
                  <button className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                    View Full History
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* Order Status Breakdown */}
      {overview?.ordersByStatus && Object.keys(overview.ordersByStatus).length > 0 && (
        <motion.div variants={itemVariants} className="card">
          <div className="card-header">
            <h2 className="font-semibold text-gray-900">Order Status Breakdown</h2>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {Object.entries(overview.ordersByStatus).map(([status, count]) => (
                <div key={status} className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-900">{count as number}</div>
                  <div className="text-sm text-gray-500 capitalize">
                    {status.toLowerCase().replace(/_/g, ' ')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

// Metric Card Component
function MetricCard({
  title,
  value,
  icon: Icon,
  color,
  subtitle,
  trend,
}: {
  title: string;
  value: string | number;
  icon: typeof DollarSign;
  color: string;
  subtitle?: string;
  trend?: 'up' | 'down';
}) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between">
        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', color)}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        {trend && (
          <div className={cn(
            'flex items-center text-sm',
            trend === 'up' ? 'text-green-600' : 'text-red-600'
          )}>
            {trend === 'up' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          </div>
        )}
      </div>
      <div className="mt-3">
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        <div className="text-sm text-gray-500">{title}</div>
        {subtitle && <div className="text-xs text-gray-400 mt-1">{subtitle}</div>}
      </div>
    </div>
  );
}

// Score Bar Component
function ScoreBar({
  label,
  value,
  color = 'primary',
}: {
  label: string;
  value: number;
  color?: 'primary' | 'green' | 'blue' | 'purple';
}) {
  const colorClasses = {
    primary: 'bg-primary-500',
    green: 'bg-green-500',
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-gray-600">{label}</span>
        <span className="text-sm font-semibold text-gray-900">{value}/100</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', colorClasses[color])}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

export default CustomerIntelligencePage;
