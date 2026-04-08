import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Clock, AlertCircle, ArrowLeft, Calendar, User, Hash, FileText, Lock, Copy, Printer, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import { useEffect } from 'react';
import { api } from '../lib/api';
import { formatDate } from '../lib/date';
import {
  STATUS_DISPLAY_NAMES,
  STATUS_COLORS,
  STATION_DISPLAY_NAMES,
  UserRole,
  PrintingMethod,
  SUB_STATION_PARENTS,
  PARENT_SUB_STATIONS,
  getStationColorTheme,
  getStationStateStyle,
  type StationProgressState,
} from '@erp/shared';
import { buildDesignFollowOnPayload, buildDuplicateOrderPayload, isDesignOnlySource, type OrderRecreationSource } from '../lib/order-recreation';
import { useAuthStore } from '../stores/auth';
import { NetworkFileBrowser } from '../components/NetworkFileBrowser';
import { ShippingPanel } from '../components/ShippingPanel';
import { RoutingRecommendationCard } from '../components/RoutingRecommendationCard';
import { PrinterInfoCard } from '../components/PrinterInfoCard';
import { ZundInfoCard } from '../components/ZundInfoCard';
import { HorizontalActivityTimeline } from '../components/HorizontalActivityTimeline';
import { FileChainTimeline } from '../components/FileChainTimeline';
import { OrderLinkedDataCard } from '../components/OrderLinkedDataCard';

const PRIORITY_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'Low', color: 'text-gray-500' },
  2: { label: 'Normal', color: 'text-blue-600' },
  3: { label: 'Medium', color: 'text-yellow-600' },
  4: { label: 'High', color: 'text-orange-600' },
  5: { label: 'Urgent', color: 'text-red-600' },
};

const DEFAULT_PRIORITY = { label: 'Normal', color: 'text-blue-600' };

function toProgressState(status: string): StationProgressState {
  if (status === 'COMPLETED') return 'COMPLETED';
  if (status === 'IN_PROGRESS') return 'IN_PROGRESS';
  return 'NOT_STARTED';
}

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  
  // Permission check for order creation/duplication
  const canCreateOrder = user?.role === UserRole.ADMIN || 
    user?.role === UserRole.MANAGER || 
    user?.allowedStations?.includes(PrintingMethod.ORDER_ENTRY);
  

  
  // Check if user can interact with a station
  const canAccessStation = (station: string) => {
    if (!user) return false;
    // Admins and Managers can access all stations
    if (user.role === UserRole.ADMIN || user.role === UserRole.MANAGER) return true;
    // Operators can only access their assigned stations
    return user.allowedStations?.includes(station as PrintingMethod) ?? false;
  };

  const { data: order, isLoading } = useQuery({
    queryKey: ['orders', id],
    queryFn: async () => {
      const response = await api.get(`/orders/${id}`);
      return response.data.data;
    },
    enabled: !!id,
  });

  // Scroll to hash target (e.g. #zund) once order data is loaded
  useEffect(() => {
    if (order && location.hash) {
      const elementId = location.hash.replace('#', '');
      // Small delay to let child components render
      const timer = setTimeout(() => {
        const el = document.getElementById(elementId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Brief highlight effect
          el.classList.add('ring-2', 'ring-orange-400', 'rounded-xl');
          setTimeout(() => el.classList.remove('ring-2', 'ring-orange-400', 'rounded-xl'), 2500);
        }
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [order, location.hash]);

  const completeStationMutation = useMutation({
    mutationFn: async (station: string) => {
      await api.post(`/orders/${id}/stations/${station}/complete`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders', id] });
      toast.success('Station completed');
    },
    onError: () => {
      toast.error('Failed to complete station');
    },
  });

  const handleCompleteStation = async (station: string) => {
    if (!order) return;

    const isDesignOnlyDesignStation =
      station === PrintingMethod.DESIGN && isDesignOnlySource(order as OrderRecreationSource);

    if (isDesignOnlyDesignStation) {
      const confirmed = window.confirm(
        `Mark design complete for ${order.orderNumber}? This will close the design-only order.`,
      );
      if (!confirmed) return;
    }

    try {
      await completeStationMutation.mutateAsync(station);
    } catch {
      return;
    }

    if (!isDesignOnlyDesignStation) {
      return;
    }

    const shouldCreateFollowOn = window.confirm(
      `Create a new work order from ${order.orderNumber} now?`,
    );
    if (!shouldCreateFollowOn) {
      return;
    }

    try {
      const response = await api.post('/orders', buildDesignFollowOnPayload(order as OrderRecreationSource));
      const newOrder = response.data.data;
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success(`Created ${newOrder.orderNumber} from ${order.orderNumber}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || 'Failed to create follow-on order');
    }
  };

  const uncompleteStationMutation = useMutation({
    mutationFn: async (station: string) => {
      await api.post(`/orders/${id}/stations/${station}/uncomplete`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders', id] });
      toast.success('Station marked incomplete');
    },
    onError: () => {
      toast.error('Failed to update station');
    },
  });

  const completeOrderMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/orders/${id}/complete`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders', id] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Order marked complete');
    },
    onError: () => {
      toast.error('Failed to complete order');
    },
  });



  const duplicateOrderMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/orders', buildDuplicateOrderPayload(order as OrderRecreationSource));
      return response.data.data;
    },
    onSuccess: (newOrder) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success(`Order duplicated as #${newOrder.orderNumber}`);
      navigate(`/orders/${newOrder.id}`);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || err?.message || 'Failed to duplicate order');
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        {/* Header skeleton */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-gray-200 rounded-lg" />
            <div>
              <div className="h-8 bg-gray-200 rounded w-48 mb-2" />
              <div className="h-4 bg-gray-100 rounded w-32" />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="h-10 bg-gray-200 rounded-lg w-24" />
            <div className="h-10 bg-gray-200 rounded-lg w-20" />
          </div>
        </div>
        {/* Content skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl border border-gray-100 p-6">
              <div className="h-5 bg-gray-200 rounded w-24 mb-4" />
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex justify-between">
                    <div className="h-4 bg-gray-100 rounded w-20" />
                    <div className="h-4 bg-gray-200 rounded w-32" />
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-6">
              <div className="h-5 bg-gray-200 rounded w-32 mb-4" />
              <div className="h-24 bg-gray-100 rounded" />
            </div>
          </div>
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-100 p-6">
              <div className="h-5 bg-gray-200 rounded w-28 mb-4" />
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-12 bg-gray-100 rounded-lg" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <span className="text-4xl">📋</span>
          <span className="text-gray-500 text-lg">Order not found</span>
          <Link to="/orders" className="text-primary-600 hover:text-primary-700 font-medium">
            ← Back to orders
          </Link>
        </div>
      </div>
    );
  }

  const priorityInfo = PRIORITY_LABELS[order.priority] ?? DEFAULT_PRIORITY;
  const sectionCardClass = 'bg-white rounded-xl shadow-soft border border-gray-100 p-6';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
        <div className="flex items-start gap-4">
          <Link
            to="/orders"
            className="mt-1 rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">#{order.orderNumber}</h1>
              <span
                className="rounded-full px-3 py-1 text-sm font-medium"
                style={{
                  backgroundColor: `${STATUS_COLORS[order.status]}15`,
                  color: STATUS_COLORS[order.status],
                }}
              >
                {STATUS_DISPLAY_NAMES[order.status]}
              </span>
            </div>
            {order.companyId ? (
              <Link
                to={`/companies/${order.companyId}`}
                className="mt-1 inline-block text-lg text-primary-600 transition-colors hover:text-primary-800 hover:underline"
              >
                {order.customerName}
              </Link>
            ) : order.customerId ? (
              <Link
                to={`/sales/customers/${order.customerId}`}
                className="mt-1 inline-block text-lg text-primary-600 transition-colors hover:text-primary-800 hover:underline"
              >
                {order.customerName}
              </Link>
            ) : (
              <p className="mt-1 text-lg text-gray-600">{order.customerName}</p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 text-sm sm:gap-3">
          <span className={`font-semibold ${priorityInfo.color}`}>
            {priorityInfo.label} Priority
          </span>
          {canCreateOrder && (
            <>
              <button
                onClick={() => navigate(`/orders/${id}/edit`)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-primary-200 bg-primary-50 px-3 py-1.5 text-sm font-medium text-primary-700 transition-colors hover:bg-primary-100"
              >
                <Pencil className="h-4 w-4" />
                Edit
              </button>
              <button
                onClick={() => duplicateOrderMutation.mutate()}
                disabled={duplicateOrderMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg border border-primary-200 bg-primary-50 px-3 py-1.5 text-sm font-medium text-primary-700 transition-colors hover:bg-primary-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Copy className="h-4 w-4" />
                {duplicateOrderMutation.isPending ? 'Duplicating...' : 'Duplicate'}
              </button>
            </>
          )}
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
          {order.status !== 'COMPLETED' && order.status !== 'CANCELLED' && (
            <button
              onClick={() => {
                if (window.confirm(`Mark order ${order.orderNumber} as complete?`)) {
                  completeOrderMutation.mutate();
                }
              }}
              disabled={completeOrderMutation.isPending}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white transition-colors hover:bg-green-700 disabled:opacity-50"
            >
              <CheckCircle className="h-4 w-4" />
              {completeOrderMutation.isPending ? 'Completing...' : 'Mark Complete'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className={`${sectionCardClass} min-w-0 xl:col-span-7`}>
          <div className="mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">Details</h2>
          </div>
          <p className="text-gray-700 leading-relaxed">{order.description}</p>
          {order.notes && (
            <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50 p-4">
              <p className="mb-1 text-sm font-medium text-amber-800">Notes</p>
              <p className="text-sm text-amber-700">{order.notes}</p>
            </div>
          )}
        </div>

        <div className="space-y-6 xl:col-span-5">
          <div className={sectionCardClass}>
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Order Info</h2>
            <dl className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <dt className="flex items-center gap-2 text-gray-500">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100">
                    <AlertCircle className="h-4 w-4 text-orange-600" />
                  </span>
                  Priority
                </dt>
                <dd className={`font-semibold ${priorityInfo.color}`}>{priorityInfo.label}</dd>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <dt className="flex items-center gap-2 text-gray-500">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100">
                    <Calendar className="h-4 w-4 text-red-600" />
                  </span>
                  Due Date
                </dt>
                <dd className="font-medium text-gray-900">
                  {order.dueDate ? formatDate(order.dueDate) : 'Not scheduled'}
                </dd>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <dt className="flex items-center gap-2 text-gray-500">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100">
                    <Calendar className="h-4 w-4 text-green-600" />
                  </span>
                  Created
                </dt>
                <dd className="font-medium text-gray-900">{formatDate(order.createdAt)}</dd>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <dt className="flex items-center gap-2 text-gray-500">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100">
                    <User className="h-4 w-4 text-purple-600" />
                  </span>
                  Created By
                </dt>
                <dd className="font-medium text-gray-900">{order.createdBy.displayName}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="min-w-0 xl:col-span-12">
          <OrderLinkedDataCard orderId={order.id} orderNumber={order.orderNumber} />
        </div>
      </div>

      <HorizontalActivityTimeline orderNumber={order.orderNumber} orderEvents={order.events} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-6">
          <PrinterInfoCard orderNumber={order.orderNumber} />
        </div>
        <div id="zund" className="min-w-0 xl:col-span-6">
          <ZundInfoCard orderNumber={order.orderNumber} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-6">
          <RoutingRecommendationCard
            workOrderId={order.id}
            orderNumber={order.orderNumber}
            description={order.description}
            priority={order.priority}
            dueDate={order.dueDate ?? null}
            notes={order.notes ?? null}
            currentRoute={order.routing ?? []}
          />
        </div>
        <div className="min-w-0 xl:col-span-6">
          <ShippingPanel workOrderId={order.id} orderNumber={order.orderNumber} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className={`${sectionCardClass} min-w-0`}>
          <div className="mb-4 flex items-center gap-2">
            <Hash className="h-5 w-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">Station Progress</h2>
          </div>
          <div className="space-y-3">
            {(() => {
              type StationEntry = { station: string; id: string; status: string; completedAt: string | null };
              const stationMap = new Map<string, StationEntry>(
                order.stationProgress.map((sp: StationEntry) => [sp.station, sp] as [string, StationEntry])
              );
              const subStationKeys = new Set(Object.keys(SUB_STATION_PARENTS));

              return order.stationProgress
                .filter((sp: { station: string }) => !subStationKeys.has(sp.station))
                .map((sp: { id: string; station: string; status: string; completedAt: string | null }) => {
                  const subs = PARENT_SUB_STATIONS[sp.station as keyof typeof PARENT_SUB_STATIONS];
                  const hasSubStations = subs && subs.length > 0;
                  const hasAccess = canAccessStation(sp.station);
                  const parentTheme = getStationColorTheme(sp.station);
                  const parentStyle = getStationStateStyle(sp.station, toProgressState(sp.status));

                  return (
                    <div key={sp.id} className="space-y-1.5">
                      <div
                        className="flex flex-col gap-3 rounded-lg border p-3 transition-all sm:flex-row sm:items-center sm:justify-between"
                        style={{
                          backgroundColor: parentStyle.backgroundColor,
                          borderColor: parentStyle.borderColor,
                        }}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          {sp.status === 'COMPLETED' ? (
                            <CheckCircle className="h-5 w-5" style={{ color: parentTheme.baseColor }} />
                          ) : sp.status === 'IN_PROGRESS' ? (
                            <Clock className="h-5 w-5" style={{ color: parentTheme.baseColor }} />
                          ) : (
                            <AlertCircle className="h-5 w-5" style={{ color: parentStyle.color }} />
                          )}
                          <span className="min-w-0 break-words font-medium" style={{ color: parentStyle.color }}>
                            {STATION_DISPLAY_NAMES[sp.station] ?? sp.station}
                          </span>
                        </div>
                        {hasSubStations ? (
                          <span className="self-end text-xs italic text-gray-400 sm:self-auto">Auto</span>
                        ) : hasAccess ? (
                          <button
                            onClick={() =>
                              sp.status === 'COMPLETED'
                                ? uncompleteStationMutation.mutate(sp.station)
                                : handleCompleteStation(sp.station)
                            }
                            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                              sp.status === 'COMPLETED'
                                ? 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-100'
                                : 'shadow-sm'
                            }`}
                            style={
                              sp.status === 'COMPLETED'
                                ? undefined
                                : {
                                    backgroundColor: parentTheme.solidColor,
                                    color: parentTheme.solidTextColor,
                                  }
                            }
                          >
                            {sp.status === 'COMPLETED' ? 'Undo' : 'Complete'}
                          </button>
                        ) : (
                          <div className="flex self-end items-center gap-1.5 px-3 py-1.5 text-sm text-gray-400 sm:self-auto">
                            <Lock className="h-3.5 w-3.5" />
                            <span>No Access</span>
                          </div>
                        )}
                      </div>

                      {hasSubStations && subs.map((subStation) => {
                        const sub = stationMap.get(subStation);
                        if (!sub) return null;
                        const subAccess = canAccessStation(sub.station);
                        const subTheme = getStationColorTheme(sub.station);
                        const subStyle = getStationStateStyle(sub.station, toProgressState(sub.status));
                        const subBackground =
                          subTheme.subStationLevel > 0 ? subTheme.gradientColor : subStyle.backgroundColor;

                        return (
                          <div
                            key={sub.id}
                            className="ml-6 flex flex-col gap-2.5 rounded-lg border p-2.5 transition-all sm:flex-row sm:items-center sm:justify-between"
                            style={{
                              background: subBackground,
                              borderColor: subTheme.subStationLevel > 0 ? subTheme.gradientBorderColor : subStyle.borderColor,
                            }}
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              {sub.status === 'COMPLETED' ? (
                                <CheckCircle className="h-4 w-4" style={{ color: subTheme.baseColor }} />
                              ) : sub.status === 'IN_PROGRESS' ? (
                                <Clock className="h-4 w-4" style={{ color: subTheme.baseColor }} />
                              ) : (
                                <AlertCircle className="h-4 w-4" style={{ color: subTheme.softTextColor }} />
                              )}
                              <span className="min-w-0 break-words text-sm font-medium" style={{ color: subStyle.color }}>
                                {STATION_DISPLAY_NAMES[sub.station] ?? sub.station}
                              </span>
                            </div>
                            {subAccess ? (
                              <button
                                onClick={() =>
                                  sub.status === 'COMPLETED'
                                    ? uncompleteStationMutation.mutate(sub.station)
                                    : handleCompleteStation(sub.station)
                                }
                                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                                  sub.status === 'COMPLETED'
                                    ? 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-100'
                                  : 'shadow-sm'
                                }`}
                                style={
                                  sub.status === 'COMPLETED'
                                    ? undefined
                                    : {
                                        backgroundColor: subTheme.solidColor,
                                        color: subTheme.solidTextColor,
                                      }
                                }
                              >
                                {sub.status === 'COMPLETED' ? 'Undo' : 'Complete'}
                              </button>
                            ) : (
                              <div className="flex self-end items-center gap-1 px-2.5 py-1 text-xs text-gray-400 sm:self-auto">
                                <Lock className="h-3 w-3" />
                                <span>No Access</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                });
            })()}
          </div>
        </div>
      </div>

      <div className="min-w-0">
        <FileChainTimeline orderId={id!} />
      </div>

      <NetworkFileBrowser orderId={order.id} orderNumber={order.orderNumber} />
    </div>
  );
}
