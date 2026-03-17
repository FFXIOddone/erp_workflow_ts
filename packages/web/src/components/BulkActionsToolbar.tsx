import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Play, UserPlus, Flag, Trash2, Check, AlertTriangle, Loader2, Printer, Layers, ChevronRight, Square, CheckSquare } from 'lucide-react';
import { api } from '../lib/api';
import { STATUS_DISPLAY_NAMES, STATUS_COLORS, PRIORITY_LABELS, PRIORITY_COLORS, STATION_DISPLAY_NAMES, OrderStatus, PrintingMethod, StationStatus } from '@erp/shared';
import { BatchLabelPrint } from './BatchLabelPrint';

interface BulkActionsToolbarProps {
  selectedIds: string[];
  onClear: () => void;
  users: Array<{ id: string; displayName: string }>;
}

type BulkAction = 'status' | 'assign' | 'priority' | 'cancel' | 'station';

const STATION_LIST: PrintingMethod[] = [
  PrintingMethod.DESIGN,
  PrintingMethod.FLATBED,
  PrintingMethod.ROLL_TO_ROLL,
  PrintingMethod.SCREEN_PRINT,
  PrintingMethod.PRODUCTION,
  PrintingMethod.INSTALLATION,
  PrintingMethod.SHIPPING_RECEIVING,
  PrintingMethod.ORDER_ENTRY,
];

const STATUS_OPTIONS = [
  { value: StationStatus.NOT_STARTED, label: 'Not Started', color: 'bg-gray-400' },
  { value: StationStatus.IN_PROGRESS, label: 'In Progress', color: 'bg-blue-500' },
  { value: StationStatus.COMPLETED, label: 'Completed', color: 'bg-green-500' },
];

export function BulkActionsToolbar({ selectedIds, onClear, users }: BulkActionsToolbarProps) {
  const queryClient = useQueryClient();
  const [activeAction, setActiveAction] = useState<BulkAction | null>(null);
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);
  const [showLabelPrint, setShowLabelPrint] = useState(false);
  
  // Multi-station state
  const [pendingStationChanges, setPendingStationChanges] = useState<Record<string, StationStatus>>({});
  const [expandedStation, setExpandedStation] = useState<PrintingMethod | null>(null);

  const statusMutation = useMutation({
    mutationFn: async (status: OrderStatus) => {
      const response = await api.post('/orders/bulk/status', {
        orderIds: selectedIds,
        status,
      });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      onClear();
      setActiveAction(null);
    },
  });

  const assignMutation = useMutation({
    mutationFn: async (assignedToId: string | null) => {
      const response = await api.post('/orders/bulk/assign', {
        orderIds: selectedIds,
        assignedToId,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      onClear();
      setActiveAction(null);
    },
  });

  const priorityMutation = useMutation({
    mutationFn: async (priority: number) => {
      const response = await api.post('/orders/bulk/priority', {
        orderIds: selectedIds,
        priority,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      onClear();
      setActiveAction(null);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/orders/bulk/cancel', {
        orderIds: selectedIds,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      onClear();
      setActiveAction(null);
      setShowConfirmCancel(false);
    },
  });

  const stationStatusMutation = useMutation({
    mutationFn: async (stationUpdates: Array<{ station: PrintingMethod; status: StationStatus }>) => {
      const response = await api.post('/orders/bulk/multi-station-status', {
        orderIds: selectedIds,
        stationUpdates,
      });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['shop-floor-orders'] });
      onClear();
      setActiveAction(null);
      setPendingStationChanges({});
      setExpandedStation(null);
    },
  });

  const isLoading = statusMutation.isPending || assignMutation.isPending || priorityMutation.isPending || cancelMutation.isPending || stationStatusMutation.isPending;

  const handleStatusChange = (status: OrderStatus) => {
    statusMutation.mutate(status);
  };

  const handleAssign = (userId: string | null) => {
    assignMutation.mutate(userId);
  };

  const handlePriorityChange = (priority: number) => {
    priorityMutation.mutate(priority);
  };

  const handleCancel = () => {
    cancelMutation.mutate();
  };

  const hasPendingStationChanges = Object.keys(pendingStationChanges).length > 0;

  const handleToggleStation = (station: PrintingMethod) => {
    if (pendingStationChanges[station] !== undefined) {
      // Uncheck - remove the pending change
      const next = { ...pendingStationChanges };
      delete next[station];
      setPendingStationChanges(next);
      if (expandedStation === station) setExpandedStation(null);
    } else {
      // Expand to pick status
      setExpandedStation(station);
    }
  };

  const handleStationStatusPick = (station: PrintingMethod, status: StationStatus) => {
    setPendingStationChanges(prev => ({ ...prev, [station]: status }));
    setExpandedStation(null);
  };

  const handleApplyStationChanges = () => {
    const stationUpdates = Object.entries(pendingStationChanges).map(([station, status]) => ({
      station: station as PrintingMethod,
      status,
    }));
    stationStatusMutation.mutate(stationUpdates);
  };

  const openStationAction = () => {
    if (activeAction === 'station' && !hasPendingStationChanges) {
      setActiveAction(null);
      setPendingStationChanges({});
      setExpandedStation(null);
    } else if (activeAction === 'station' && hasPendingStationChanges) {
      // Apply button clicked
      handleApplyStationChanges();
    } else {
      setActiveAction('station');
      setPendingStationChanges({});
      setExpandedStation(null);
    }
  };

  if (selectedIds.length === 0) return null;

  return (
    <>
      {/* Floating toolbar */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
        <div className="bg-gray-900 text-white rounded-xl shadow-2xl px-4 py-3 flex items-center gap-4">
          {/* Selection count */}
          <div className="flex items-center gap-2 border-r border-gray-700 pr-4">
            <div className="bg-primary-500 text-white text-sm font-bold w-7 h-7 rounded-full flex items-center justify-center">
              {selectedIds.length}
            </div>
            <span className="text-sm font-medium">selected</span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {/* Status dropdown */}
            <div className="relative">
              <button
                onClick={() => setActiveAction(activeAction === 'status' ? null : 'status')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeAction === 'status' ? 'bg-gray-700' : 'hover:bg-gray-800'
                }`}
                disabled={isLoading}
              >
                <Play className="h-4 w-4" />
                Status
              </button>
              {activeAction === 'status' && (
                <div className="absolute bottom-full left-0 mb-2 bg-white rounded-xl shadow-xl border border-gray-200 py-2 min-w-[160px] animate-fade-in">
                  {(['PENDING', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'SHIPPED'] as OrderStatus[]).map((status) => (
                    <button
                      key={status}
                      onClick={() => handleStatusChange(status)}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: STATUS_COLORS[status] }}
                      />
                      {STATUS_DISPLAY_NAMES[status]}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Assign dropdown */}
            <div className="relative">
              <button
                onClick={() => setActiveAction(activeAction === 'assign' ? null : 'assign')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeAction === 'assign' ? 'bg-gray-700' : 'hover:bg-gray-800'
                }`}
                disabled={isLoading}
              >
                <UserPlus className="h-4 w-4" />
                Assign
              </button>
              {activeAction === 'assign' && (
                <div className="absolute bottom-full left-0 mb-2 bg-white rounded-xl shadow-xl border border-gray-200 py-2 min-w-[180px] max-h-64 overflow-y-auto animate-fade-in">
                  <button
                    onClick={() => handleAssign(null)}
                    className="w-full px-4 py-2 text-left text-sm text-gray-500 hover:bg-gray-50"
                  >
                    Unassign
                  </button>
                  <div className="border-t border-gray-100 my-1" />
                  {users.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleAssign(user.id)}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                    >
                      {user.displayName}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Priority dropdown */}
            <div className="relative">
              <button
                onClick={() => setActiveAction(activeAction === 'priority' ? null : 'priority')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeAction === 'priority' ? 'bg-gray-700' : 'hover:bg-gray-800'
                }`}
                disabled={isLoading}
              >
                <Flag className="h-4 w-4" />
                Priority
              </button>
              {activeAction === 'priority' && (
                <div className="absolute bottom-full left-0 mb-2 bg-white rounded-xl shadow-xl border border-gray-200 py-2 min-w-[140px] animate-fade-in">
                  {[5, 4, 3, 2, 1].map((priority) => (
                    <button
                      key={priority}
                      onClick={() => handlePriorityChange(priority)}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: PRIORITY_COLORS[priority] }}
                      />
                      <span style={{ color: PRIORITY_COLORS[priority] }} className="font-medium">
                        {PRIORITY_LABELS[priority]}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Print Labels button */}
            <button
              onClick={() => setShowLabelPrint(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-blue-400 hover:bg-blue-500/20 transition-colors"
              disabled={isLoading}
            >
              <Printer className="h-4 w-4" />
              Print Labels
            </button>

            {/* Stations dropdown */}
            <div className="relative">
              <button
                onClick={openStationAction}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  hasPendingStationChanges
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : activeAction === 'station' ? 'bg-gray-700' : 'hover:bg-gray-800'
                }`}
                disabled={isLoading}
              >
                {hasPendingStationChanges ? (
                  <>
                    <Check className="h-4 w-4" />
                    Apply ({Object.keys(pendingStationChanges).length})
                  </>
                ) : (
                  <>
                    <Layers className="h-4 w-4" />
                    Stations
                  </>
                )}
              </button>
              {activeAction === 'station' && (
                <div className="absolute bottom-full left-0 mb-2 bg-white rounded-xl shadow-xl border border-gray-200 py-2 min-w-[240px] animate-fade-in">
                  <div className="px-4 py-1.5 text-xs font-semibold text-gray-400 uppercase">Select Stations</div>
                  {STATION_LIST.map((st) => {
                    const isChecked = pendingStationChanges[st] !== undefined;
                    const isExpanded = expandedStation === st;
                    const selectedStatus = pendingStationChanges[st];
                    return (
                      <div key={st}>
                        <div className="flex items-center w-full px-3 py-1.5 hover:bg-gray-50">
                          <button
                            onClick={() => handleToggleStation(st)}
                            className="flex items-center gap-2 flex-1 text-left text-sm text-gray-700"
                          >
                            {isChecked ? (
                              <CheckSquare className="h-4 w-4 text-green-600 flex-shrink-0" />
                            ) : (
                              <Square className="h-4 w-4 text-gray-400 flex-shrink-0" />
                            )}
                            <span className={isChecked ? 'font-medium text-gray-900' : ''}>
                              {STATION_DISPLAY_NAMES[st] || st}
                            </span>
                            {isChecked && selectedStatus && (
                              <span className="ml-auto text-xs text-gray-500">
                                {STATUS_OPTIONS.find(s => s.value === selectedStatus)?.label}
                              </span>
                            )}
                          </button>
                          <button
                            onClick={() => setExpandedStation(isExpanded ? null : st)}
                            className="p-1 hover:bg-gray-200 rounded ml-1"
                          >
                            <ChevronRight className={`h-3.5 w-3.5 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                          </button>
                        </div>
                        {isExpanded && (
                          <div className="ml-8 mr-3 mb-1 bg-gray-50 rounded-lg border border-gray-100">
                            {STATUS_OPTIONS.map(({ value, label, color }) => (
                              <button
                                key={value}
                                onClick={() => handleStationStatusPick(st, value)}
                                className={`w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 flex items-center gap-2 first:rounded-t-lg last:rounded-b-lg ${
                                  selectedStatus === value ? 'bg-gray-100 font-medium' : 'text-gray-600'
                                }`}
                              >
                                <span className={`w-2 h-2 rounded-full ${color}`} />
                                {label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Cancel/Delete button */}
            <button
              onClick={() => setShowConfirmCancel(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/20 transition-colors"
              disabled={isLoading}
            >
              <Trash2 className="h-4 w-4" />
              Cancel
            </button>
          </div>

          {/* Loading indicator */}
          {isLoading && (
            <div className="border-l border-gray-700 pl-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary-400" />
            </div>
          )}

          {/* Clear selection button */}
          <button
            onClick={onClear}
            className="ml-2 p-2 rounded-lg hover:bg-gray-800 transition-colors"
            title="Clear selection"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Cancel confirmation modal */}
      {showConfirmCancel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 animate-scale-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 p-2 rounded-full">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Cancel Orders?</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to cancel <strong>{selectedIds.length}</strong> order(s)? 
              This action will change their status to Cancelled.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirmCancel(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
              >
                Keep Orders
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {cancelMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Yes, Cancel Orders
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Label Print Modal */}
      {showLabelPrint && (
        <BatchLabelPrint
          selectedOrderIds={selectedIds}
          onClose={() => setShowLabelPrint(false)}
        />
      )}
    </>
  );
}
