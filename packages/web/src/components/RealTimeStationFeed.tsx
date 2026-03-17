/**
 * RealTimeStationFeed (SSS-COMP-003)
 * 
 * Live production dashboard component for sign shop stations:
 * - Real-time station status via WebSocket
 * - Active job displays with live timers
 * - Operator avatars and assignments
 * - Quality metrics and throughput tracking
 * - Connection status indicator
 * - Sub-second update capability
 * 
 * @example
 * <RealTimeStationFeed
 *   stations={stations}
 *   onStationClick={handleStationClick}
 *   showMetrics
 * />
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { clsx } from 'clsx';
import {
  Activity,
  Wifi,
  WifiOff,
  Clock,
  User,
  Users,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Play,
  Pause,
  ChevronRight,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  Package,
  Zap,
  Timer,
  BarChart3,
  Circle,
  ArrowRight,
} from 'lucide-react';
import { PrintingMethod, StationStatus } from '@erp/shared';
import { STATION_DISPLAY_NAMES } from '@erp/shared';

// ============================================================
// Types
// ============================================================

export interface ActiveJob {
  id: string;
  orderNumber: string;
  customerName: string;
  description: string;
  priority: 'normal' | 'rush' | 'urgent';
  startedAt: Date;
  estimatedDuration?: number; // minutes
  progress?: number; // 0-100
  notes?: string;
}

export interface Operator {
  id: string;
  name: string;
  avatar?: string;
  initials: string;
  status: 'active' | 'idle' | 'away' | 'offline';
  color?: string;
}

export interface QualityMetrics {
  passRate: number; // 0-100
  defectCount: number;
  reworkCount: number;
  trend: 'up' | 'down' | 'stable';
}

export interface ThroughputMetrics {
  completedToday: number;
  averageTime: number; // minutes
  efficiency: number; // 0-100 (actual vs estimated)
  trend: 'up' | 'down' | 'stable';
}

export interface StationData {
  id: string;
  name: PrintingMethod;
  displayName?: string;
  status: StationStatus;
  activeJobs: ActiveJob[];
  queuedJobs: number;
  operators: Operator[];
  quality?: QualityMetrics;
  throughput?: ThroughputMetrics;
  lastUpdate?: Date;
  alerts?: StationAlert[];
}

export interface StationAlert {
  id: string;
  type: 'warning' | 'error' | 'info';
  message: string;
  timestamp: Date;
}

export interface WsStationUpdate {
  type: 'STATION_UPDATE' | 'JOB_STARTED' | 'JOB_COMPLETED' | 'OPERATOR_CHANGE' | 'ALERT';
  stationId: string;
  payload: Partial<StationData> | ActiveJob | Operator | StationAlert;
}

// ============================================================
// Connection Status Hook
// ============================================================

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

function useConnectionPulse(status: ConnectionStatus) {
  const [pulse, setPulse] = useState(false);
  
  useEffect(() => {
    if (status === 'connected') {
      const interval = setInterval(() => {
        setPulse(p => !p);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [status]);
  
  return pulse;
}

// ============================================================
// Live Timer Hook
// ============================================================

function useLiveTimer(startedAt: Date | null) {
  const [elapsed, setElapsed] = useState(0);
  
  useEffect(() => {
    if (!startedAt) {
      setElapsed(0);
      return;
    }
    
    const update = () => {
      const now = new Date();
      const diff = Math.floor((now.getTime() - startedAt.getTime()) / 1000);
      setElapsed(diff);
    };
    
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);
  
  return elapsed;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// ============================================================
// Connection Status Indicator
// ============================================================

interface ConnectionIndicatorProps {
  status: ConnectionStatus;
  lastUpdate?: Date;
  onReconnect?: () => void;
  className?: string;
}

export function ConnectionIndicator({
  status,
  lastUpdate,
  onReconnect,
  className,
}: ConnectionIndicatorProps) {
  const pulse = useConnectionPulse(status);
  
  const statusConfig = {
    connecting: {
      icon: RefreshCw,
      label: 'Connecting...',
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
      animate: true,
    },
    connected: {
      icon: Wifi,
      label: 'Live',
      color: 'text-green-500',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      animate: false,
    },
    disconnected: {
      icon: WifiOff,
      label: 'Disconnected',
      color: 'text-red-500',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      animate: false,
    },
  };
  
  const config = statusConfig[status];
  const Icon = config.icon;
  
  return (
    <div
      className={clsx(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium',
        config.bgColor,
        config.color,
        className
      )}
    >
      <span className="relative flex h-2 w-2">
        {status === 'connected' && (
          <span
            className={clsx(
              'absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75',
              pulse && 'animate-ping'
            )}
          />
        )}
        <span
          className={clsx(
            'relative inline-flex rounded-full h-2 w-2',
            status === 'connected' ? 'bg-green-500' : status === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
          )}
        />
      </span>
      
      <Icon className={clsx('w-4 h-4', config.animate && 'animate-spin')} />
      <span>{config.label}</span>
      
      {lastUpdate && status === 'connected' && (
        <span className="text-xs opacity-70">
          Updated {formatRelativeTime(lastUpdate)}
        </span>
      )}
      
      {status === 'disconnected' && onReconnect && (
        <button
          onClick={onReconnect}
          className="ml-2 underline hover:no-underline"
        >
          Retry
        </button>
      )}
    </div>
  );
}

function formatRelativeTime(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

// ============================================================
// Station Card
// ============================================================

interface StationCardProps {
  station: StationData;
  onClick?: () => void;
  showMetrics?: boolean;
  compact?: boolean;
  className?: string;
}

export function StationCard({
  station,
  onClick,
  showMetrics = true,
  compact = false,
  className,
}: StationCardProps) {
  const displayName = station.displayName || STATION_DISPLAY_NAMES[station.name] || station.name;
  const activeJob = station.activeJobs[0];
  const hasActiveWork = station.status === StationStatus.IN_PROGRESS && activeJob;
  
  const statusColors = {
    [StationStatus.NOT_STARTED]: 'border-gray-200 dark:border-gray-700',
    [StationStatus.IN_PROGRESS]: 'border-blue-500 dark:border-blue-400',
    [StationStatus.COMPLETED]: 'border-green-500 dark:border-green-400',
  };
  
  const statusBadgeColors = {
    [StationStatus.NOT_STARTED]: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
    [StationStatus.IN_PROGRESS]: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    [StationStatus.COMPLETED]: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  };
  
  return (
    <div
      onClick={onClick}
      className={clsx(
        'bg-white dark:bg-gray-800 rounded-xl border-2 transition-all duration-200',
        statusColors[station.status],
        onClick && 'cursor-pointer hover:shadow-lg hover:-translate-y-0.5',
        hasActiveWork && 'ring-2 ring-blue-500/20',
        className
      )}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={clsx(
                'w-10 h-10 rounded-lg flex items-center justify-center',
                hasActiveWork ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'
              )}
            >
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {displayName}
              </h3>
              <span
                className={clsx(
                  'inline-block text-xs font-medium px-2 py-0.5 rounded-full',
                  statusBadgeColors[station.status]
                )}
              >
                {station.status === StationStatus.IN_PROGRESS ? 'Active' : 
                 station.status === StationStatus.COMPLETED ? 'Complete' : 'Idle'}
              </span>
            </div>
          </div>
          
          {/* Queue indicator */}
          {station.queuedJobs > 0 && (
            <div className="flex items-center gap-1 text-sm text-gray-500">
              <Package className="w-4 h-4" />
              <span>{station.queuedJobs} queued</span>
            </div>
          )}
        </div>
      </div>
      
      {/* Active Job */}
      {hasActiveWork && activeJob && (
        <div className="px-4 py-3 bg-blue-50/50 dark:bg-blue-900/10">
          <ActiveJobDisplay job={activeJob} compact={compact} />
        </div>
      )}
      
      {/* Operators */}
      {station.operators.length > 0 && (
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <OperatorList operators={station.operators} />
        </div>
      )}
      
      {/* Metrics */}
      {showMetrics && !compact && (station.quality || station.throughput) && (
        <div className="px-4 py-3 grid grid-cols-2 gap-4">
          {station.throughput && (
            <MetricBlock
              label="Completed Today"
              value={station.throughput.completedToday}
              trend={station.throughput.trend}
              icon={<CheckCircle className="w-4 h-4" />}
            />
          )}
          {station.quality && (
            <MetricBlock
              label="Pass Rate"
              value={`${station.quality.passRate}%`}
              trend={station.quality.trend}
              icon={<Zap className="w-4 h-4" />}
            />
          )}
        </div>
      )}
      
      {/* Alerts */}
      {station.alerts && station.alerts.length > 0 && (
        <div className="px-4 py-2 bg-yellow-50 dark:bg-yellow-900/20 border-t border-yellow-100 dark:border-yellow-800">
          <div className="flex items-center gap-2 text-sm text-yellow-700 dark:text-yellow-400">
            <AlertTriangle className="w-4 h-4" />
            <span>{station.alerts[0].message}</span>
            {station.alerts.length > 1 && (
              <span className="text-xs">+{station.alerts.length - 1} more</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Active Job Display
// ============================================================

interface ActiveJobDisplayProps {
  job: ActiveJob;
  compact?: boolean;
  className?: string;
}

export function ActiveJobDisplay({ job, compact = false, className }: ActiveJobDisplayProps) {
  const elapsed = useLiveTimer(job.startedAt);
  const estimatedSeconds = (job.estimatedDuration || 0) * 60;
  const isOvertime = estimatedSeconds > 0 && elapsed > estimatedSeconds;
  
  const priorityColors = {
    normal: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
    rush: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    urgent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };
  
  return (
    <div className={clsx('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono font-medium text-gray-900 dark:text-white">
            {job.orderNumber}
          </span>
          {job.priority !== 'normal' && (
            <span
              className={clsx(
                'text-xs font-medium px-2 py-0.5 rounded-full uppercase',
                priorityColors[job.priority]
              )}
            >
              {job.priority}
            </span>
          )}
        </div>
        
        {/* Live timer */}
        <div
          className={clsx(
            'flex items-center gap-1 font-mono text-sm',
            isOvertime ? 'text-red-600' : 'text-gray-600 dark:text-gray-400'
          )}
        >
          <Timer className={clsx('w-4 h-4', isOvertime && 'animate-pulse')} />
          <span>{formatDuration(elapsed)}</span>
          {estimatedSeconds > 0 && (
            <span className="text-gray-400">/ {formatDuration(estimatedSeconds)}</span>
          )}
        </div>
      </div>
      
      {!compact && (
        <>
          <div className="text-sm text-gray-600 dark:text-gray-400 truncate">
            {job.customerName} - {job.description}
          </div>
          
          {job.progress !== undefined && (
            <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={clsx(
                  'h-full rounded-full transition-all duration-500',
                  isOvertime ? 'bg-red-500' : 'bg-blue-500'
                )}
                style={{ width: `${Math.min(100, job.progress)}%` }}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================
// Operator List
// ============================================================

interface OperatorListProps {
  operators: Operator[];
  maxDisplay?: number;
  className?: string;
}

export function OperatorList({ operators, maxDisplay = 4, className }: OperatorListProps) {
  const displayed = operators.slice(0, maxDisplay);
  const remaining = operators.length - maxDisplay;
  
  const statusColors = {
    active: 'ring-green-500',
    idle: 'ring-yellow-500',
    away: 'ring-gray-400',
    offline: 'ring-red-500',
  };
  
  return (
    <div className={clsx('flex items-center gap-2', className)}>
      <Users className="w-4 h-4 text-gray-400" />
      <div className="flex -space-x-2">
        {displayed.map(op => (
          <div
            key={op.id}
            className={clsx(
              'w-8 h-8 rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center text-xs font-medium ring-2',
              statusColors[op.status]
            )}
            style={{ backgroundColor: op.color || '#6B7280' }}
            title={`${op.name} (${op.status})`}
          >
            {op.avatar ? (
              <img src={op.avatar} alt={op.name} className="w-full h-full rounded-full object-cover" />
            ) : (
              <span className="text-white">{op.initials}</span>
            )}
          </div>
        ))}
        {remaining > 0 && (
          <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 border-2 border-white dark:border-gray-800 flex items-center justify-center text-xs font-medium text-gray-600 dark:text-gray-300">
            +{remaining}
          </div>
        )}
      </div>
      <span className="text-sm text-gray-500">
        {operators.filter(o => o.status === 'active').length} active
      </span>
    </div>
  );
}

// ============================================================
// Metric Block
// ============================================================

interface MetricBlockProps {
  label: string;
  value: string | number;
  trend?: 'up' | 'down' | 'stable';
  icon?: React.ReactNode;
  className?: string;
}

function MetricBlock({ label, value, trend, icon, className }: MetricBlockProps) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-green-500' : trend === 'down' ? 'text-red-500' : 'text-gray-400';
  
  return (
    <div className={clsx('space-y-1', className)}>
      <div className="flex items-center gap-1 text-xs text-gray-500">
        {icon}
        <span>{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-lg font-semibold text-gray-900 dark:text-white">{value}</span>
        {trend && <TrendIcon className={clsx('w-4 h-4', trendColor)} />}
      </div>
    </div>
  );
}

// ============================================================
// Station Grid
// ============================================================

interface StationGridProps {
  stations: StationData[];
  onStationClick?: (station: StationData) => void;
  showMetrics?: boolean;
  compact?: boolean;
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}

export function StationGrid({
  stations,
  onStationClick,
  showMetrics = true,
  compact = false,
  columns = 3,
  className,
}: StationGridProps) {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  };
  
  return (
    <div className={clsx('grid gap-4', gridCols[columns], className)}>
      {stations.map(station => (
        <StationCard
          key={station.id}
          station={station}
          onClick={() => onStationClick?.(station)}
          showMetrics={showMetrics}
          compact={compact}
        />
      ))}
    </div>
  );
}

// ============================================================
// Station Timeline
// ============================================================

interface StationTimelineProps {
  stations: StationData[];
  currentStationId?: string;
  className?: string;
}

export function StationTimeline({ stations, currentStationId, className }: StationTimelineProps) {
  return (
    <div className={clsx('flex items-center gap-1 overflow-x-auto pb-2', className)}>
      {stations.map((station, index) => {
        const isCurrent = station.id === currentStationId;
        const isComplete = station.status === StationStatus.COMPLETED;
        const isActive = station.status === StationStatus.IN_PROGRESS;
        
        return (
          <React.Fragment key={station.id}>
            {index > 0 && (
              <ArrowRight
                className={clsx(
                  'w-4 h-4 flex-shrink-0',
                  isComplete ? 'text-green-500' : 'text-gray-300'
                )}
              />
            )}
            <div
              className={clsx(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium flex-shrink-0 transition-colors',
                isCurrent && 'ring-2 ring-blue-500',
                isComplete && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                isActive && !isCurrent && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                !isComplete && !isActive && 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
              )}
            >
              {isComplete ? (
                <CheckCircle className="w-4 h-4" />
              ) : isActive ? (
                <Play className="w-4 h-4" />
              ) : (
                <Circle className="w-4 h-4" />
              )}
              <span>{STATION_DISPLAY_NAMES[station.name] || station.name}</span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ============================================================
// Summary Stats Bar
// ============================================================

interface SummaryStatsProps {
  stations: StationData[];
  className?: string;
}

export function SummaryStatsBar({ stations, className }: SummaryStatsProps) {
  const stats = useMemo(() => {
    const active = stations.filter(s => s.status === StationStatus.IN_PROGRESS).length;
    const idle = stations.filter(s => s.status === StationStatus.NOT_STARTED).length;
    const totalJobs = stations.reduce((sum, s) => sum + s.activeJobs.length, 0);
    const totalQueued = stations.reduce((sum, s) => sum + s.queuedJobs, 0);
    const totalOperators = stations.reduce((sum, s) => sum + s.operators.filter(o => o.status === 'active').length, 0);
    const avgEfficiency = stations.reduce((sum, s) => sum + (s.throughput?.efficiency || 0), 0) / stations.length;
    
    return { active, idle, totalJobs, totalQueued, totalOperators, avgEfficiency };
  }, [stations]);
  
  return (
    <div className={clsx('flex items-center gap-6 px-4 py-3 bg-gray-50 dark:bg-gray-900 rounded-lg', className)}>
      <div className="flex items-center gap-2">
        <Activity className="w-5 h-5 text-blue-500" />
        <div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.active}</div>
          <div className="text-xs text-gray-500">Active Stations</div>
        </div>
      </div>
      
      <div className="h-8 w-px bg-gray-200 dark:bg-gray-700" />
      
      <div className="flex items-center gap-2">
        <Package className="w-5 h-5 text-green-500" />
        <div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalJobs}</div>
          <div className="text-xs text-gray-500">Jobs In Progress</div>
        </div>
      </div>
      
      <div className="h-8 w-px bg-gray-200 dark:bg-gray-700" />
      
      <div className="flex items-center gap-2">
        <Clock className="w-5 h-5 text-yellow-500" />
        <div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalQueued}</div>
          <div className="text-xs text-gray-500">Queued</div>
        </div>
      </div>
      
      <div className="h-8 w-px bg-gray-200 dark:bg-gray-700" />
      
      <div className="flex items-center gap-2">
        <Users className="w-5 h-5 text-purple-500" />
        <div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalOperators}</div>
          <div className="text-xs text-gray-500">Active Operators</div>
        </div>
      </div>
      
      <div className="h-8 w-px bg-gray-200 dark:bg-gray-700" />
      
      <div className="flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-teal-500" />
        <div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {Math.round(stats.avgEfficiency)}%
          </div>
          <div className="text-xs text-gray-500">Avg Efficiency</div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Main RealTimeStationFeed Component
// ============================================================

export interface RealTimeStationFeedProps {
  stations: StationData[];
  connectionStatus?: ConnectionStatus;
  lastUpdate?: Date;
  onStationClick?: (station: StationData) => void;
  onReconnect?: () => void;
  showMetrics?: boolean;
  showSummary?: boolean;
  layout?: 'grid' | 'list';
  columns?: 1 | 2 | 3 | 4;
  autoRefresh?: boolean;
  refreshInterval?: number;
  className?: string;
}

export function RealTimeStationFeed({
  stations,
  connectionStatus = 'connected',
  lastUpdate,
  onStationClick,
  onReconnect,
  showMetrics = true,
  showSummary = true,
  layout = 'grid',
  columns = 3,
  autoRefresh = false,
  refreshInterval = 5000,
  className,
}: RealTimeStationFeedProps) {
  const [localLastUpdate, setLocalLastUpdate] = useState(lastUpdate || new Date());
  
  // Simulate receiving updates for demo
  useEffect(() => {
    if (connectionStatus === 'connected') {
      setLocalLastUpdate(new Date());
    }
  }, [stations, connectionStatus]);
  
  // Sort stations: active first, then by name
  const sortedStations = useMemo(() => {
    return [...stations].sort((a, b) => {
      // Active stations first
      if (a.status === StationStatus.IN_PROGRESS && b.status !== StationStatus.IN_PROGRESS) return -1;
      if (b.status === StationStatus.IN_PROGRESS && a.status !== StationStatus.IN_PROGRESS) return 1;
      // Then by display name
      const aName = STATION_DISPLAY_NAMES[a.name] || a.name;
      const bName = STATION_DISPLAY_NAMES[b.name] || b.name;
      return aName.localeCompare(bName);
    });
  }, [stations]);
  
  return (
    <div className={clsx('space-y-4', className)}>
      {/* Header with connection status */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-500" />
          Live Station Feed
        </h2>
        <ConnectionIndicator
          status={connectionStatus}
          lastUpdate={localLastUpdate}
          onReconnect={onReconnect}
        />
      </div>
      
      {/* Summary stats */}
      {showSummary && <SummaryStatsBar stations={stations} />}
      
      {/* Station grid/list */}
      <StationGrid
        stations={sortedStations}
        onStationClick={onStationClick}
        showMetrics={showMetrics}
        compact={layout === 'list'}
        columns={columns}
      />
      
      {/* Empty state */}
      {stations.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No stations configured</p>
          <p className="text-sm mt-1">Add stations to see live production data</p>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Export Default
// ============================================================

export default RealTimeStationFeed;
