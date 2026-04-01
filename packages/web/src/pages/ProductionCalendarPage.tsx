import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { 
  ChevronLeft, ChevronRight, Calendar, Clock, Users, 
  AlertTriangle, CheckCircle, Plus, GripVertical, X,
  Play, Square, RotateCcw, Filter, Package
} from 'lucide-react';
import { api } from '../lib/api';
import { 
  STATUS_COLORS, STATION_DISPLAY_NAMES, PrintingMethod, SlotStatus
} from '@erp/shared';
import toast from 'react-hot-toast';

interface ProductionSlot {
  id: string;
  station: PrintingMethod;
  scheduledDate: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  estimatedHours: number;
  actualHours: number | null;
  status: SlotStatus;
  priority: number;
  notes: string | null;
  workOrder: {
    id: string;
    orderNumber: string;
    customerName: string;
    description: string | null;
    status: string;
    dueDate: string | null;
  };
  assignedTo: {
    id: string;
    name: string;
  } | null;
}

interface UnscheduledOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  description: string | null;
  status: string;
  dueDate: string | null;
  routing: PrintingMethod[];
}

type ViewMode = 'week' | 'day';

const SLOT_STATUS_COLORS: Record<SlotStatus, string> = {
  [SlotStatus.SCHEDULED]: 'bg-blue-100 border-blue-300 text-blue-800',
  [SlotStatus.IN_PROGRESS]: 'bg-yellow-100 border-yellow-300 text-yellow-800',
  [SlotStatus.COMPLETED]: 'bg-green-100 border-green-300 text-green-800',
  [SlotStatus.RESCHEDULED]: 'bg-purple-100 border-purple-300 text-purple-800',
  [SlotStatus.CANCELLED]: 'bg-gray-100 border-gray-300 text-gray-500 line-through',
};

const SLOT_STATUS_LABELS: Record<SlotStatus, string> = {
  [SlotStatus.SCHEDULED]: 'Scheduled',
  [SlotStatus.IN_PROGRESS]: 'In Progress',
  [SlotStatus.COMPLETED]: 'Completed',
  [SlotStatus.RESCHEDULED]: 'Rescheduled',
  [SlotStatus.CANCELLED]: 'Cancelled',
};

export function ProductionCalendarPage() {
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [stationFilter, setStationFilter] = useState<PrintingMethod | ''>('');
  const [showModal, setShowModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<UnscheduledOrder | null>(null);
  const [draggedSlot, setDraggedSlot] = useState<ProductionSlot | null>(null);

  // Get date range for current view
  const dateRange = useMemo(() => {
    const start = new Date(currentDate);
    const end = new Date(currentDate);
    
    if (viewMode === 'week') {
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1);
      start.setDate(diff);
      start.setHours(0, 0, 0, 0);
      
      end.setTime(start.getTime());
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    }
    
    return { start, end };
  }, [currentDate, viewMode]);

  // Fetch production slots
  const { data: slotsData, isLoading: slotsLoading } = useQuery({
    queryKey: ['scheduling', 'calendar', dateRange.start.toISOString(), dateRange.end.toISOString(), stationFilter],
    queryFn: async () => {
      const params: Record<string, string> = {
        startDate: dateRange.start.toISOString(),
        endDate: dateRange.end.toISOString(),
      };
      if (stationFilter) params.station = stationFilter;
      
      const response = await api.get('/scheduling/calendar', { params });
      const payload = response.data?.data;
      return {
        slots: Array.isArray(payload?.slots) ? payload.slots : [],
        groupedByDate:
          payload?.groupedByDate && typeof payload.groupedByDate === 'object'
            ? payload.groupedByDate
            : {},
      } as { slots: ProductionSlot[]; groupedByDate: Record<string, ProductionSlot[]> };
    },
  });

  // Fetch unscheduled orders
  const { data: unscheduledOrders = [] } = useQuery({
    queryKey: ['scheduling', 'unscheduled'],
    queryFn: async () => {
      const response = await api.get('/scheduling/unscheduled');
      const payload = response.data?.data;
      const orders = Array.isArray(payload) ? payload : [];
      return orders.map((order) => ({
        ...order,
        routing: Array.isArray(order?.routing) ? order.routing : [],
      })) as UnscheduledOrder[];
    },
  });

  // Fetch capacity data
  const { data: capacityData = [] } = useQuery({
    queryKey: ['scheduling', 'capacity', dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: async () => {
      const response = await api.get('/scheduling/capacity', {
        params: {
          startDate: dateRange.start.toISOString(),
          endDate: dateRange.end.toISOString(),
        },
      });
      const payload = response.data?.data;
      return (Array.isArray(payload) ? payload : []) as Array<{
        station: PrintingMethod;
        date: string;
        scheduledHours: number;
        availableHours: number;
        utilizationPercent: number;
      }>;
    },
  });

  // Create slot mutation
  const createSlotMutation = useMutation({
    mutationFn: async (data: {
      workOrderId: string;
      station: PrintingMethod;
      scheduledDate: Date;
      estimatedHours: number;
      priority?: number;
    }) => {
      const response = await api.post('/scheduling', data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduling'] });
      toast.success('Production slot created');
      setShowModal(false);
      setSelectedOrder(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create slot');
    },
  });

  // Reschedule mutation
  const rescheduleMutation = useMutation({
    mutationFn: async ({ slotId, newDate, reason }: { slotId: string; newDate: string; reason?: string }) => {
      const response = await api.post(`/scheduling/${slotId}/reschedule`, {
        newDate,
        reason,
      });
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduling'] });
      toast.success('Slot rescheduled');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to reschedule');
    },
  });

  // Start slot mutation
  const startSlotMutation = useMutation({
    mutationFn: async (slotId: string) => {
      const response = await api.post(`/scheduling/${slotId}/start`);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduling'] });
      toast.success('Production started');
    },
  });

  // Complete slot mutation
  const completeSlotMutation = useMutation({
    mutationFn: async ({ slotId, actualHours }: { slotId: string; actualHours?: number }) => {
      const response = await api.post(`/scheduling/${slotId}/complete`, { actualHours });
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduling'] });
      toast.success('Production completed');
    },
  });

  // Cancel slot mutation
  const cancelSlotMutation = useMutation({
    mutationFn: async (slotId: string) => {
      const response = await api.delete(`/scheduling/${slotId}`);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduling'] });
      toast.success('Slot cancelled');
    },
  });

  const slots = slotsData?.slots ?? [];
  const groupedByDate = slotsData?.groupedByDate ?? {};

  // Generate days for the view
  const days = useMemo(() => {
    const result: Date[] = [];
    const current = new Date(dateRange.start);
    
    while (current <= dateRange.end) {
      result.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    
    return result;
  }, [dateRange]);

  // Get stations to show
  const stations = useMemo(() => {
    if (stationFilter) return [stationFilter];
    return Object.values(PrintingMethod).filter(s => s !== 'ORDER_ENTRY');
  }, [stationFilter]);

  // Navigation
  const navigatePrev = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setDate(newDate.getDate() - 1);
    }
    setCurrentDate(newDate);
  };

  const navigateNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setDate(newDate.getDate() + 1);
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => setCurrentDate(new Date());

  const isToday = (date: Date) => date.toDateString() === new Date().toDateString();
  const isPast = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const getHeaderText = () => {
    if (viewMode === 'week' && days.length > 0) {
      const weekStart = days[0]!;
      const weekEnd = days[days.length - 1]!;
      return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    return currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };

  // Get slots for a specific station and date
  const getSlotsForCell = useCallback((station: PrintingMethod, date: Date) => {
    const dateKey = date.toISOString().split('T')[0];
    return slots.filter(
      s => s.station === station && s.scheduledDate.split('T')[0] === dateKey
    );
  }, [slots]);

  // Get capacity for station on date
  const getCapacity = useCallback((station: PrintingMethod, date: Date) => {
    const dateKey = date.toISOString().split('T')[0];
    return capacityData.find(
      c => c.station === station && c.date.split('T')[0] === dateKey
    );
  }, [capacityData]);

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, slot: ProductionSlot) => {
    setDraggedSlot(slot);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, station: PrintingMethod, date: Date) => {
    e.preventDefault();
    if (draggedSlot && draggedSlot.station === station) {
      const newDateStr = date.toISOString().split('T')[0];
      const currentDateStr = draggedSlot.scheduledDate.split('T')[0];
      
      if (newDateStr !== currentDateStr) {
        rescheduleMutation.mutate({
          slotId: draggedSlot.id,
          newDate: date.toISOString(),
          reason: 'Drag-drop reschedule',
        });
      }
    }
    setDraggedSlot(null);
  };

  // Schedule modal form state
  const [scheduleForm, setScheduleForm] = useState({
    station: '' as PrintingMethod | '',
    scheduledDate: '',
    estimatedHours: 2,
    priority: 1,
  });

  const handleScheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || !scheduleForm.station || !scheduleForm.scheduledDate) return;

    createSlotMutation.mutate({
      workOrderId: selectedOrder.id,
      station: scheduleForm.station,
      scheduledDate: new Date(scheduleForm.scheduledDate),
      estimatedHours: scheduleForm.estimatedHours,
      priority: scheduleForm.priority,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Production Calendar</h1>
          <p className="text-gray-500 mt-1">
            {slots.length} slots scheduled • {unscheduledOrders.length} awaiting scheduling
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="bg-gray-100 rounded-lg p-1 flex">
            <button
              onClick={() => setViewMode('day')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'day' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Day
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'week' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Week
            </button>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button onClick={navigatePrev} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button onClick={goToToday} className="px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 font-medium text-sm">
            Today
          </button>
          <button onClick={navigateNext} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50">
            <ChevronRight className="h-5 w-5" />
          </button>
          <span className="text-lg font-semibold text-gray-900 ml-2">{getHeaderText()}</span>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={stationFilter}
            onChange={(e) => setStationFilter(e.target.value as PrintingMethod | '')}
            className="input-field text-sm py-1.5 pr-8"
          >
            <option value="">All Stations</option>
            {Object.entries(STATION_DISPLAY_NAMES)
              .filter(([key]) => key !== 'ORDER_ENTRY')
              .map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))
            }
          </select>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Calendar Grid - Takes up 3 columns */}
        <div className="xl:col-span-3">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {slotsLoading ? (
              <div className="p-8 animate-pulse">
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-24 bg-gray-100 rounded-lg" />
                  ))}
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left p-3 font-semibold text-gray-700 bg-gray-50 w-40">
                        Station
                      </th>
                      {days.map((day) => (
                        <th
                          key={day.toISOString()}
                          className={`text-center p-3 font-medium min-w-[140px] ${
                            isToday(day) ? 'bg-primary-50' : 'bg-gray-50'
                          }`}
                        >
                          <div className="text-xs text-gray-500 uppercase">
                            {day.toLocaleDateString('en-US', { weekday: 'short' })}
                          </div>
                          <div className={`text-lg ${isToday(day) ? 'text-primary-600 font-bold' : ''}`}>
                            {day.getDate()}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stations.map((station) => (
                      <tr key={station} className="border-b border-gray-50">
                        <td className="p-3 font-medium text-gray-900 bg-gray-50/50">
                          {STATION_DISPLAY_NAMES[station] || station}
                        </td>
                        {days.map((day) => {
                          const cellSlots = getSlotsForCell(station, day);
                          const capacity = getCapacity(station, day);
                          const isPastDay = isPast(day);

                          return (
                            <td
                              key={day.toISOString()}
                              className={`p-2 align-top min-h-[100px] ${
                                isToday(day) ? 'bg-primary-50/30' : isPastDay ? 'bg-gray-50/50' : ''
                              }`}
                              onDragOver={handleDragOver}
                              onDrop={(e) => handleDrop(e, station, day)}
                            >
                              {/* Capacity indicator */}
                              {capacity && (
                                <div className={`text-xs mb-1 px-1 py-0.5 rounded ${
                                  capacity.utilizationPercent >= 100 ? 'bg-red-100 text-red-700' :
                                  capacity.utilizationPercent >= 75 ? 'bg-amber-100 text-amber-700' :
                                  'bg-green-100 text-green-700'
                                }`}>
                                  {capacity.scheduledHours}h / 8h
                                </div>
                              )}

                              {/* Slots */}
                              <div className="space-y-1">
                                {cellSlots.map((slot) => (
                                  <div
                                    key={slot.id}
                                    draggable={slot.status !== 'COMPLETED' && slot.status !== 'CANCELLED'}
                                    onDragStart={(e) => handleDragStart(e, slot)}
                                    className={`p-2 rounded border text-xs cursor-move group ${
                                      SLOT_STATUS_COLORS[slot.status as SlotStatus]
                                    }`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <Link
                                        to={`/orders/${slot.workOrder.id}`}
                                        className="font-semibold hover:underline"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {slot.workOrder.orderNumber}
                                      </Link>
                                      <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                                        {slot.status === 'SCHEDULED' && (
                                          <button
                                            onClick={() => startSlotMutation.mutate(slot.id)}
                                            className="p-0.5 hover:bg-white/50 rounded"
                                            title="Start"
                                          >
                                            <Play className="h-3 w-3" />
                                          </button>
                                        )}
                                        {slot.status === 'IN_PROGRESS' && (
                                          <button
                                            onClick={() => completeSlotMutation.mutate({ slotId: slot.id })}
                                            className="p-0.5 hover:bg-white/50 rounded"
                                            title="Complete"
                                          >
                                            <CheckCircle className="h-3 w-3" />
                                          </button>
                                        )}
                                        {slot.status !== 'COMPLETED' && slot.status !== 'CANCELLED' && (
                                          <button
                                            onClick={() => cancelSlotMutation.mutate(slot.id)}
                                            className="p-0.5 hover:bg-white/50 rounded"
                                            title="Cancel"
                                          >
                                            <X className="h-3 w-3" />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                    <div className="text-[10px] text-gray-600 truncate mt-0.5">
                                      {slot.workOrder.customerName}
                                    </div>
                                    <div className="flex items-center gap-1 mt-1 text-[10px]">
                                      <Clock className="h-2.5 w-2.5" />
                                      {slot.estimatedHours}h
                                      {slot.assignedTo && (
                                        <>
                                          <span className="mx-1">•</span>
                                          <Users className="h-2.5 w-2.5" />
                                          {slot.assignedTo.name.split(' ')[0]}
                                        </>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar - Unscheduled Orders */}
        <div className="xl:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Package className="h-5 w-5 text-gray-500" />
              Awaiting Scheduling
            </h3>
            
            {unscheduledOrders.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                All orders are scheduled!
              </p>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {unscheduledOrders.map((order) => (
                  <div
                    key={order.id}
                    className="p-3 rounded-lg border border-gray-200 hover:border-primary-300 hover:bg-primary-50/30 transition-colors cursor-pointer"
                    onClick={() => {
                      setSelectedOrder(order);
                      setScheduleForm({
                        station: order.routing[0] || '',
                        scheduledDate: new Date().toISOString().split('T')[0],
                        estimatedHours: 2,
                        priority: 1,
                      });
                      setShowModal(true);
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium text-sm">{order.orderNumber}</div>
                        <div className="text-xs text-gray-500 truncate">{order.customerName}</div>
                      </div>
                      <button className="p-1 hover:bg-gray-100 rounded">
                        <Plus className="h-4 w-4 text-gray-400" />
                      </button>
                    </div>
                    {order.dueDate && (
                      <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Due: {new Date(order.dueDate).toLocaleDateString()}
                      </div>
                    )}
                    {order.routing.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {order.routing.slice(0, 3).map((station) => (
                          <span
                            key={station}
                            className="text-[10px] px-1.5 py-0.5 bg-gray-100 rounded"
                          >
                            {STATION_DISPLAY_NAMES[station as PrintingMethod]?.split(' ')[0] || station}
                          </span>
                        ))}
                        {order.routing.length > 3 && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 rounded">
                            +{order.routing.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mt-4">
            <h3 className="font-semibold text-gray-900 mb-3">Status Legend</h3>
            <div className="space-y-2">
              {Object.entries(SLOT_STATUS_LABELS).map(([status, label]) => (
                <div key={status} className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded border ${SLOT_STATUS_COLORS[status as SlotStatus]}`} />
                  <span className="text-sm text-gray-600">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Schedule Modal */}
      {showModal && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Schedule Production</h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <div className="font-medium">{selectedOrder.orderNumber}</div>
              <div className="text-sm text-gray-500">{selectedOrder.customerName}</div>
              {selectedOrder.description && (
                <div className="text-sm text-gray-500">{selectedOrder.description}</div>
              )}
            </div>

            <form onSubmit={handleScheduleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Station
                </label>
                <select
                  value={scheduleForm.station}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, station: e.target.value as PrintingMethod })}
                  className="input-field"
                  required
                >
                  <option value="">Select station...</option>
                  {selectedOrder.routing.map((station) => (
                    <option key={station} value={station}>
                      {STATION_DISPLAY_NAMES[station as PrintingMethod] || station}
                    </option>
                  ))}
                  <option disabled>──────────</option>
                  {Object.entries(STATION_DISPLAY_NAMES)
                    .filter(([key]) => key !== 'ORDER_ENTRY' && !selectedOrder.routing.includes(key as PrintingMethod))
                    .map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))
                  }
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Scheduled Date
                </label>
                <input
                  type="date"
                  value={scheduleForm.scheduledDate}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, scheduledDate: e.target.value })}
                  className="input-field"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Estimated Hours
                  </label>
                  <input
                    type="number"
                    value={scheduleForm.estimatedHours}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, estimatedHours: Number(e.target.value) })}
                    className="input-field"
                    min="0.5"
                    max="24"
                    step="0.5"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Priority
                  </label>
                  <select
                    value={scheduleForm.priority}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, priority: Number(e.target.value) })}
                    className="input-field"
                  >
                    <option value={1}>1 - Low</option>
                    <option value={2}>2 - Normal</option>
                    <option value={3}>3 - Medium</option>
                    <option value={4}>4 - High</option>
                    <option value={5}>5 - Urgent</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary flex-1"
                  disabled={createSlotMutation.isPending}
                >
                  {createSlotMutation.isPending ? 'Scheduling...' : 'Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
