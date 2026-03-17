import React, { useState, useMemo } from 'react';
import {
  MapPin,
  Navigation,
  Clock,
  CheckCircle,
  AlertTriangle,
  Package,
  Truck,
  Copy,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Map as MapIcon,
} from 'lucide-react';
import clsx from 'clsx';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  type?: 'stop' | 'pickup' | 'delivery' | 'warning' | 'complete';
  label?: string;
  tooltip?: string;
  data?: Record<string, unknown>;
  routeId?: string;
}

export interface MapRoute {
  id: string;
  name: string;
  color?: string;
  stops: MapMarker[];
  eta?: string;
  status?: 'pending' | 'active' | 'delayed' | 'complete';
}

export interface MapViewProps {
  markers?: MapMarker[];
  routes?: MapRoute[];
  center?: { lat: number; lng: number };
  zoom?: number;
  className?: string;
  height?: string | number;
  selectedMarkerId?: string;
  selectedRouteId?: string;
  onMarkerClick?: (marker: MapMarker) => void;
  onRouteClick?: (route: MapRoute) => void;
  showLegend?: boolean;
  showRouteList?: boolean;
  emptyMessage?: string;
}

// ============================================================================
// Color & Icon Utilities
// ============================================================================

const markerTypeConfig: Record<string, { icon: typeof MapPin; color: string; bgColor: string }> = {
  stop: { icon: MapPin, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  pickup: { icon: Package, color: 'text-amber-600', bgColor: 'bg-amber-100' },
  delivery: { icon: Truck, color: 'text-green-600', bgColor: 'bg-green-100' },
  warning: { icon: AlertTriangle, color: 'text-red-600', bgColor: 'bg-red-100' },
  complete: { icon: CheckCircle, color: 'text-emerald-600', bgColor: 'bg-emerald-100' },
};

const routeStatusConfig: Record<string, { color: string; textColor: string; label: string }> = {
  pending: { color: 'bg-gray-200', textColor: 'text-gray-700', label: 'Pending' },
  active: { color: 'bg-blue-100', textColor: 'text-blue-700', label: 'In Progress' },
  delayed: { color: 'bg-red-100', textColor: 'text-red-700', label: 'Delayed' },
  complete: { color: 'bg-green-100', textColor: 'text-green-700', label: 'Complete' },
};

const defaultRouteColors = [
  '#3B82F6', // blue
  '#10B981', // emerald
  '#F59E0B', // amber
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
  '#6366F1', // indigo
];

function getRouteColor(index: number, customColor?: string): string {
  return customColor || defaultRouteColors[index % defaultRouteColors.length];
}

// ============================================================================
// Static Map Marker Component (SVG-based)
// ============================================================================

interface StaticMarkerProps {
  marker: MapMarker;
  x: number;
  y: number;
  isSelected?: boolean;
  onClick?: () => void;
  showLabel?: boolean;
}

function StaticMarker({ marker, x, y, isSelected, onClick, showLabel }: StaticMarkerProps) {
  const config = markerTypeConfig[marker.type || 'stop'];
  const Icon = config.icon;

  return (
    <g
      className="cursor-pointer transition-transform hover:scale-110"
      transform={`translate(${x}, ${y})`}
      onClick={onClick}
    >
      {/* Marker pin shape */}
      <path
        d="M12 0C5.4 0 0 5.4 0 12c0 7.2 12 20 12 20s12-12.8 12-20C24 5.4 18.6 0 12 0z"
        className={clsx(
          'transition-colors',
          isSelected ? 'fill-blue-600' : 'fill-gray-700',
        )}
        transform="translate(-12, -32)"
      />
      {/* Inner circle */}
      <circle
        cx="0"
        cy="-20"
        r="6"
        className="fill-white"
      />
      {/* Label */}
      {showLabel && marker.label && (
        <text
          x="0"
          y="8"
          textAnchor="middle"
          className="fill-gray-700 text-xs font-medium"
        >
          {marker.label}
        </text>
      )}
      {/* Tooltip on hover - uses title for native browser tooltip */}
      {marker.tooltip && <title>{marker.tooltip}</title>}
    </g>
  );
}

// ============================================================================
// Static Route Line Component (SVG-based)
// ============================================================================

interface StaticRouteLineProps {
  points: { x: number; y: number }[];
  color: string;
  isSelected?: boolean;
}

function StaticRouteLine({ points, color, isSelected }: StaticRouteLineProps) {
  if (points.length < 2) return null;

  const pathData = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');

  return (
    <path
      d={pathData}
      fill="none"
      stroke={color}
      strokeWidth={isSelected ? 4 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={isSelected ? 'none' : '8,4'}
      className="transition-all"
      opacity={isSelected ? 1 : 0.7}
    />
  );
}

// ============================================================================
// Route Info Panel
// ============================================================================

interface RouteInfoPanelProps {
  route: MapRoute;
  color: string;
  isSelected?: boolean;
  onClick?: () => void;
}

function RouteInfoPanel({ route, color, isSelected, onClick }: RouteInfoPanelProps) {
  const status = routeStatusConfig[route.status || 'pending'];

  return (
    <div
      className={clsx(
        'rounded-lg border p-3 transition-all cursor-pointer',
        isSelected 
          ? 'border-blue-500 bg-blue-50 shadow-md' 
          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm',
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className="h-3 w-3 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="font-medium text-gray-900">{route.name}</span>
        <span className={clsx('ml-auto text-xs px-2 py-0.5 rounded-full', status.color, status.textColor)}>
          {status.label}
        </span>
      </div>
      <div className="flex items-center gap-4 text-sm text-gray-600">
        <span className="flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5" />
          {route.stops.length} stops
        </span>
        {route.eta && (
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            ETA: {route.eta}
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Map Legend
// ============================================================================

function MapLegend() {
  return (
    <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg border border-gray-200 p-3">
      <h4 className="text-xs font-medium text-gray-700 mb-2">Legend</h4>
      <div className="space-y-1.5">
        {Object.entries(markerTypeConfig).map(([type, config]) => {
          const Icon = config.icon;
          return (
            <div key={type} className="flex items-center gap-2 text-xs">
              <div className={clsx('p-1 rounded', config.bgColor)}>
                <Icon className={clsx('h-3 w-3', config.color)} />
              </div>
              <span className="text-gray-600 capitalize">{type}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Main MapView Component
// ============================================================================

export function MapView({
  markers = [],
  routes = [],
  center,
  zoom = 12,
  className,
  height = 400,
  selectedMarkerId,
  selectedRouteId,
  onMarkerClick,
  onRouteClick,
  showLegend = false,
  showRouteList = false,
  emptyMessage = 'No locations to display',
}: MapViewProps) {
  // Combine markers from routes with standalone markers
  const allMarkers = useMemo(() => {
    const routeMarkers = routes.flatMap((route) => 
      route.stops.map((stop) => ({ ...stop, routeId: route.id }))
    );
    return [...markers, ...routeMarkers];
  }, [markers, routes]);

  // Calculate bounds and normalize coordinates for static display
  const { normalizedMarkers, normalizedRoutes, bounds } = useMemo(() => {
    if (allMarkers.length === 0) {
      return { 
        normalizedMarkers: [], 
        normalizedRoutes: [],
        bounds: { minLat: 0, maxLat: 1, minLng: 0, maxLng: 1 },
      };
    }

    // Find bounds
    const lats = allMarkers.map((m) => m.lat);
    const lngs = allMarkers.map((m) => m.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    // Add padding
    const latPadding = (maxLat - minLat) * 0.1 || 0.01;
    const lngPadding = (maxLng - minLng) * 0.1 || 0.01;

    const bounds = {
      minLat: minLat - latPadding,
      maxLat: maxLat + latPadding,
      minLng: minLng - lngPadding,
      maxLng: maxLng + lngPadding,
    };

    // Normalize to 0-100 coordinate system
    const normalize = (lat: number, lng: number) => ({
      x: ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * 100,
      y: 100 - ((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * 100, // Invert Y
    });

    const normalizedMarkers = allMarkers.map((m) => ({
      ...m,
      ...normalize(m.lat, m.lng),
    }));

    const normalizedRoutes = routes.map((route, idx) => ({
      ...route,
      color: getRouteColor(idx, route.color),
      points: route.stops.map((stop) => normalize(stop.lat, stop.lng)),
    }));

    return { normalizedMarkers, normalizedRoutes, bounds };
  }, [allMarkers, routes]);

  const hasContent = allMarkers.length > 0 || routes.length > 0;

  return (
    <div className={clsx('flex gap-4', className)}>
      {/* Main Map Area */}
      <div 
        className="relative flex-1 bg-gray-100 rounded-lg overflow-hidden border border-gray-200"
        style={{ height: typeof height === 'number' ? `${height}px` : height }}
      >
        {hasContent ? (
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="xMidYMid meet"
            className="w-full h-full"
          >
            {/* Background grid pattern */}
            <defs>
              <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                <path
                  d="M 10 0 L 0 0 0 10"
                  fill="none"
                  stroke="#e5e7eb"
                  strokeWidth="0.5"
                />
              </pattern>
            </defs>
            <rect width="100" height="100" fill="url(#grid)" />

            {/* Route lines */}
            {normalizedRoutes.map((route) => (
              <StaticRouteLine
                key={route.id}
                points={route.points}
                color={route.color}
                isSelected={route.id === selectedRouteId}
              />
            ))}

            {/* Markers */}
            {normalizedMarkers.map((marker) => (
              <StaticMarker
                key={marker.id}
                marker={marker}
                x={marker.x}
                y={marker.y}
                isSelected={marker.id === selectedMarkerId}
                onClick={() => onMarkerClick?.(marker)}
                showLabel
              />
            ))}
          </svg>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-gray-500">
              <MapIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p>{emptyMessage}</p>
            </div>
          </div>
        )}

        {showLegend && hasContent && <MapLegend />}

        {/* Map placeholder overlay */}
        <div className="absolute top-2 right-2 bg-white/90 rounded px-2 py-1 text-xs text-gray-500 border border-gray-200">
          Static Map View
        </div>
      </div>

      {/* Route List Sidebar */}
      {showRouteList && routes.length > 0 && (
        <div className="w-72 space-y-2 overflow-auto" style={{ maxHeight: typeof height === 'number' ? `${height}px` : height }}>
          <h3 className="text-sm font-medium text-gray-700 px-1">Routes</h3>
          {routes.map((route, idx) => (
            <RouteInfoPanel
              key={route.id}
              route={route}
              color={getRouteColor(idx, route.color)}
              isSelected={route.id === selectedRouteId}
              onClick={() => onRouteClick?.(route)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// RouteList Component - Standalone route/stop list
// ============================================================================

export interface RouteListProps {
  routes: MapRoute[];
  className?: string;
  selectedStopId?: string;
  expandedRouteIds?: string[];
  onStopClick?: (stop: MapMarker, route: MapRoute) => void;
  onRouteClick?: (route: MapRoute) => void;
  onRouteToggle?: (routeId: string) => void;
}

export function RouteList({
  routes,
  className,
  selectedStopId,
  expandedRouteIds: controlledExpanded,
  onStopClick,
  onRouteClick,
  onRouteToggle,
}: RouteListProps) {
  const [internalExpanded, setInternalExpanded] = useState<string[]>([]);
  
  const expandedRouteIds = controlledExpanded ?? internalExpanded;
  
  const handleToggle = (routeId: string) => {
    if (onRouteToggle) {
      onRouteToggle(routeId);
    } else {
      setInternalExpanded((prev) =>
        prev.includes(routeId)
          ? prev.filter((id) => id !== routeId)
          : [...prev, routeId]
      );
    }
  };

  return (
    <div className={clsx('space-y-2', className)}>
      {routes.map((route, idx) => {
        const isExpanded = expandedRouteIds.includes(route.id);
        const color = getRouteColor(idx, route.color);
        const status = routeStatusConfig[route.status || 'pending'];

        return (
          <div key={route.id} className="border border-gray-200 rounded-lg overflow-hidden">
            {/* Route Header */}
            <button
              onClick={() => handleToggle(route.id)}
              className="w-full flex items-center gap-2 p-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-gray-500" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-500" />
              )}
              <div
                className="h-3 w-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className="font-medium text-gray-900 flex-1">{route.name}</span>
              <span className={clsx('text-xs px-2 py-0.5 rounded-full', status.color, status.textColor)}>
                {route.stops.length} stops
              </span>
            </button>

            {/* Stops List */}
            {isExpanded && (
              <div className="divide-y divide-gray-100">
                {route.stops.map((stop, stopIdx) => {
                  const config = markerTypeConfig[stop.type || 'stop'];
                  const Icon = config.icon;
                  const isSelected = stop.id === selectedStopId;

                  return (
                    <button
                      key={stop.id}
                      onClick={() => onStopClick?.(stop, route)}
                      className={clsx(
                        'w-full flex items-center gap-3 p-3 text-left transition-colors',
                        isSelected ? 'bg-blue-50' : 'hover:bg-gray-50',
                      )}
                    >
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-xs font-medium text-gray-600">
                        {stopIdx + 1}
                      </div>
                      <div className={clsx('p-1.5 rounded', config.bgColor)}>
                        <Icon className={clsx('h-4 w-4', config.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {stop.label || `Stop ${stopIdx + 1}`}
                        </p>
                        {stop.tooltip && (
                          <p className="text-xs text-gray-500 truncate">{stop.tooltip}</p>
                        )}
                      </div>
                      {stop.type === 'complete' && (
                        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {routes.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Navigation className="h-8 w-8 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No routes available</p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// AddressPin Component - Compact address display with actions
// ============================================================================

export interface AddressPinProps {
  address: string;
  className?: string;
  onViewMap?: () => void;
  showCopy?: boolean;
  compact?: boolean;
}

export function AddressPin({
  address,
  className,
  onViewMap,
  showCopy = true,
  compact = false,
}: AddressPinProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  };

  const handleOpenMaps = () => {
    const encoded = encodeURIComponent(address);
    window.open(`https://www.google.com/maps/search/?api=1&query=${encoded}`, '_blank');
  };

  if (compact) {
    return (
      <div className={clsx('flex items-center gap-1.5 text-sm', className)}>
        <MapPin className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
        <span className="text-gray-700 truncate">{address}</span>
        {showCopy && (
          <button
            onClick={handleCopy}
            className="p-0.5 text-gray-400 hover:text-gray-600"
            title={copied ? 'Copied!' : 'Copy address'}
          >
            <Copy className="h-3 w-3" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={clsx('flex items-start gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200', className)}>
      <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-700">{address}</p>
        <div className="flex items-center gap-2 mt-1.5">
          {showCopy && (
            <button
              onClick={handleCopy}
              className={clsx(
                'flex items-center gap-1 text-xs px-2 py-0.5 rounded transition-colors',
                copied 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
              )}
            >
              <Copy className="h-3 w-3" />
              {copied ? 'Copied!' : 'Copy'}
            </button>
          )}
          <button
            onClick={onViewMap || handleOpenMaps}
            className="flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            View Map
          </button>
        </div>
      </div>
    </div>
  );
}
