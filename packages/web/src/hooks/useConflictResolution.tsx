/**
 * Conflict Resolution System for Optimistic Updates
 * 
 * Handles scenarios where the server state diverges from the client's
 * optimistic state, providing:
 * - Conflict detection based on version/timestamp
 * - Resolution strategies (client wins, server wins, merge)
 * - User-facing conflict resolution UI
 * - Automatic retry with conflict awareness
 */

import React, {
  createContext,
  useContext,
  useCallback,
  useState,
  useRef,
  ReactNode,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, RefreshCw, Check, X, GitMerge, ArrowRight } from 'lucide-react';
import { clsx } from 'clsx';
import { useQueryClient, QueryKey } from '@tanstack/react-query';

// ============================================================================
// Types
// ============================================================================

export type ConflictResolutionStrategy = 'client-wins' | 'server-wins' | 'manual' | 'merge';

export interface ConflictField<T = unknown> {
  field: string;
  label: string;
  clientValue: T;
  serverValue: T;
  resolvedValue?: T;
}

export interface Conflict<TData = unknown> {
  id: string;
  entityType: string;
  entityId: string;
  queryKey: QueryKey;
  clientData: TData;
  serverData: TData;
  fields: ConflictField[];
  timestamp: number;
  resolved: boolean;
  strategy?: ConflictResolutionStrategy;
}

export interface ConflictResolution<TData = unknown> {
  conflictId: string;
  strategy: ConflictResolutionStrategy;
  resolvedData: TData;
  fieldResolutions?: Record<string, 'client' | 'server'>;
}

export interface ConflictContextValue {
  conflicts: Conflict[];
  hasConflicts: boolean;
  addConflict: <TData>(conflict: Omit<Conflict<TData>, 'id' | 'timestamp' | 'resolved'>) => string;
  resolveConflict: (resolution: ConflictResolution) => void;
  dismissConflict: (conflictId: string) => void;
  clearAllConflicts: () => void;
  getConflictsForEntity: (entityType: string, entityId: string) => Conflict[];
}

// ============================================================================
// Context
// ============================================================================

const ConflictContext = createContext<ConflictContextValue | null>(null);

export function useConflictResolution() {
  const context = useContext(ConflictContext);
  if (!context) {
    throw new Error('useConflictResolution must be used within ConflictProvider');
  }
  return context;
}

// ============================================================================
// Provider
// ============================================================================

interface ConflictProviderProps {
  children: ReactNode;
  /** Default resolution strategy */
  defaultStrategy?: ConflictResolutionStrategy;
  /** Auto-resolve conflicts using default strategy */
  autoResolve?: boolean;
  /** Maximum conflicts to keep in history */
  maxConflicts?: number;
}

export function ConflictProvider({
  children,
  defaultStrategy = 'manual',
  autoResolve = false,
  maxConflicts = 50,
}: ConflictProviderProps) {
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const queryClient = useQueryClient();
  const conflictIdRef = useRef(0);
  
  const addConflict = useCallback(<TData,>(
    conflictData: Omit<Conflict<TData>, 'id' | 'timestamp' | 'resolved'>
  ): string => {
    const id = `conflict-${++conflictIdRef.current}`;
    const conflict: Conflict<TData> = {
      ...conflictData,
      id,
      timestamp: Date.now(),
      resolved: false,
    };
    
    setConflicts((prev) => {
      const updated = [conflict as Conflict, ...prev];
      return updated.slice(0, maxConflicts);
    });
    
    // Auto-resolve if enabled
    if (autoResolve && defaultStrategy !== 'manual') {
      setTimeout(() => {
        const resolvedData = defaultStrategy === 'client-wins'
          ? conflictData.clientData
          : conflictData.serverData;
          
        resolveConflict({
          conflictId: id,
          strategy: defaultStrategy,
          resolvedData: resolvedData as TData,
        });
      }, 0);
    }
    
    return id;
  }, [autoResolve, defaultStrategy, maxConflicts]);
  
  const resolveConflict = useCallback((resolution: ConflictResolution) => {
    setConflicts((prev) => 
      prev.map((conflict) => 
        conflict.id === resolution.conflictId
          ? { ...conflict, resolved: true, strategy: resolution.strategy }
          : conflict
      )
    );
    
    // Update query cache with resolved data
    const conflict = conflicts.find((c) => c.id === resolution.conflictId);
    if (conflict) {
      queryClient.setQueryData(conflict.queryKey, (oldData: unknown) => {
        if (Array.isArray(oldData)) {
          return oldData.map((item: Record<string, unknown>) =>
            item.id === conflict.entityId ? resolution.resolvedData : item
          );
        }
        return resolution.resolvedData;
      });
    }
  }, [conflicts, queryClient]);
  
  const dismissConflict = useCallback((conflictId: string) => {
    setConflicts((prev) => prev.filter((c) => c.id !== conflictId));
  }, []);
  
  const clearAllConflicts = useCallback(() => {
    setConflicts([]);
  }, []);
  
  const getConflictsForEntity = useCallback((entityType: string, entityId: string) => {
    return conflicts.filter(
      (c) => c.entityType === entityType && c.entityId === entityId && !c.resolved
    );
  }, [conflicts]);
  
  const hasConflicts = conflicts.some((c) => !c.resolved);
  
  return (
    <ConflictContext.Provider
      value={{
        conflicts,
        hasConflicts,
        addConflict,
        resolveConflict,
        dismissConflict,
        clearAllConflicts,
        getConflictsForEntity,
      }}
    >
      {children}
    </ConflictContext.Provider>
  );
}

// ============================================================================
// Conflict Detection Utilities
// ============================================================================

export interface VersionedEntity {
  id: string;
  version?: number;
  updatedAt?: string | Date;
  [key: string]: unknown;
}

/**
 * Detect if there's a conflict between client and server data
 */
export function detectConflict<T extends VersionedEntity>(
  clientData: T,
  serverData: T,
  originalData: T
): boolean {
  // Version-based detection
  if (
    typeof clientData.version === 'number' &&
    typeof serverData.version === 'number' &&
    typeof originalData.version === 'number'
  ) {
    // Conflict if server version is newer than what client was editing
    return serverData.version > originalData.version;
  }
  
  // Timestamp-based detection
  if (clientData.updatedAt && serverData.updatedAt && originalData.updatedAt) {
    const serverTime = new Date(serverData.updatedAt).getTime();
    const originalTime = new Date(originalData.updatedAt).getTime();
    return serverTime > originalTime;
  }
  
  // No version info, assume no conflict
  return false;
}

/**
 * Find which fields have conflicts between client and server
 */
export function findConflictingFields<T extends Record<string, unknown>>(
  clientData: T,
  serverData: T,
  originalData: T,
  fieldLabels: Record<string, string> = {}
): ConflictField[] {
  const conflicts: ConflictField[] = [];
  
  // Only check fields that client modified
  for (const key of Object.keys(clientData)) {
    if (key.startsWith('_') || key === 'id' || key === 'version' || key === 'updatedAt') {
      continue;
    }
    
    const clientValue = clientData[key];
    const serverValue = serverData[key];
    const originalValue = originalData[key];
    
    // Client modified this field
    const clientModified = JSON.stringify(clientValue) !== JSON.stringify(originalValue);
    // Server also modified this field
    const serverModified = JSON.stringify(serverValue) !== JSON.stringify(originalValue);
    // Values are different
    const valuesDiffer = JSON.stringify(clientValue) !== JSON.stringify(serverValue);
    
    if (clientModified && serverModified && valuesDiffer) {
      conflicts.push({
        field: key,
        label: fieldLabels[key] || key,
        clientValue,
        serverValue,
      });
    }
  }
  
  return conflicts;
}

/**
 * Merge client and server data with field-level resolution
 */
export function mergeConflictData<T extends Record<string, unknown>>(
  clientData: T,
  serverData: T,
  fieldResolutions: Record<string, 'client' | 'server'>
): T {
  const merged = { ...serverData };
  
  for (const [field, winner] of Object.entries(fieldResolutions)) {
    if (winner === 'client') {
      merged[field as keyof T] = clientData[field] as T[keyof T];
    }
  }
  
  return merged;
}

// ============================================================================
// Conflict Resolution Dialog
// ============================================================================

interface ConflictDialogProps {
  conflict: Conflict;
  onResolve: (resolution: ConflictResolution) => void;
  onDismiss: () => void;
  fieldLabels?: Record<string, string>;
  formatValue?: (field: string, value: unknown) => string;
}

export function ConflictDialog({
  conflict,
  onResolve,
  onDismiss,
  fieldLabels = {},
  formatValue = (_, value) => String(value ?? '-'),
}: ConflictDialogProps) {
  const [fieldResolutions, setFieldResolutions] = useState<Record<string, 'client' | 'server'>>({});
  
  const allFieldsResolved = conflict.fields.every(
    (f) => fieldResolutions[f.field] !== undefined
  );
  
  const handleFieldResolution = (field: string, winner: 'client' | 'server') => {
    setFieldResolutions((prev) => ({ ...prev, [field]: winner }));
  };
  
  const handleResolve = (strategy: ConflictResolutionStrategy) => {
    let resolvedData = conflict.serverData;
    
    switch (strategy) {
      case 'client-wins':
        resolvedData = conflict.clientData;
        break;
      case 'server-wins':
        resolvedData = conflict.serverData;
        break;
      case 'merge':
        resolvedData = mergeConflictData(
          conflict.clientData as Record<string, unknown>,
          conflict.serverData as Record<string, unknown>,
          fieldResolutions
        );
        break;
    }
    
    onResolve({
      conflictId: conflict.id,
      strategy,
      resolvedData,
      fieldResolutions: strategy === 'merge' ? fieldResolutions : undefined,
    });
  };
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className={clsx(
          'w-full max-w-2xl m-4',
          'bg-white dark:bg-gray-900 rounded-xl shadow-2xl',
          'border border-gray-200 dark:border-gray-700',
          'overflow-hidden'
        )}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Conflict Detected
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {conflict.entityType} was modified by someone else while you were editing.
              </p>
            </div>
          </div>
        </div>
        
        {/* Content */}
        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
          {/* Field comparison table */}
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                  Field
                </th>
                <th className="py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                  Your Changes
                </th>
                <th className="py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-400">
                  Server Value
                </th>
                <th className="py-2 text-center text-sm font-medium text-gray-500 dark:text-gray-400">
                  Keep
                </th>
              </tr>
            </thead>
            <tbody>
              {conflict.fields.map((field) => (
                <tr
                  key={field.field}
                  className="border-b border-gray-100 dark:border-gray-800"
                >
                  <td className="py-3 text-sm font-medium text-gray-900 dark:text-white">
                    {fieldLabels[field.field] || field.label}
                  </td>
                  <td className="py-3">
                    <button
                      onClick={() => handleFieldResolution(field.field, 'client')}
                      className={clsx(
                        'px-3 py-1.5 text-sm rounded-lg transition-colors',
                        'border',
                        fieldResolutions[field.field] === 'client'
                          ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-200'
                          : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      )}
                    >
                      {formatValue(field.field, field.clientValue)}
                    </button>
                  </td>
                  <td className="py-3">
                    <button
                      onClick={() => handleFieldResolution(field.field, 'server')}
                      className={clsx(
                        'px-3 py-1.5 text-sm rounded-lg transition-colors',
                        'border',
                        fieldResolutions[field.field] === 'server'
                          ? 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700 text-green-800 dark:text-green-200'
                          : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      )}
                    >
                      {formatValue(field.field, field.serverValue)}
                    </button>
                  </td>
                  <td className="py-3 text-center">
                    {fieldResolutions[field.field] && (
                      <Check className="h-4 w-4 text-green-500 mx-auto" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <button
              onClick={onDismiss}
              className={clsx(
                'px-4 py-2 text-sm font-medium rounded-lg',
                'text-gray-700 dark:text-gray-300',
                'hover:bg-gray-100 dark:hover:bg-gray-700',
                'transition-colors'
              )}
            >
              Cancel
            </button>
            
            <div className="flex items-center gap-2">
              {/* Quick actions */}
              <button
                onClick={() => handleResolve('server-wins')}
                className={clsx(
                  'px-4 py-2 text-sm font-medium rounded-lg',
                  'text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800',
                  'border border-gray-200 dark:border-gray-600',
                  'hover:bg-gray-50 dark:hover:bg-gray-700',
                  'flex items-center gap-2',
                  'transition-colors'
                )}
              >
                <RefreshCw className="h-4 w-4" />
                Use Server
              </button>
              
              <button
                onClick={() => handleResolve('client-wins')}
                className={clsx(
                  'px-4 py-2 text-sm font-medium rounded-lg',
                  'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30',
                  'border border-blue-200 dark:border-blue-700',
                  'hover:bg-blue-100 dark:hover:bg-blue-900/50',
                  'flex items-center gap-2',
                  'transition-colors'
                )}
              >
                <ArrowRight className="h-4 w-4" />
                Use Mine
              </button>
              
              {allFieldsResolved && (
                <button
                  onClick={() => handleResolve('merge')}
                  className={clsx(
                    'px-4 py-2 text-sm font-medium rounded-lg',
                    'text-white bg-green-600',
                    'hover:bg-green-700',
                    'flex items-center gap-2',
                    'transition-colors'
                  )}
                >
                  <GitMerge className="h-4 w-4" />
                  Merge Selected
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ============================================================================
// Conflict Banner Component
// ============================================================================

interface ConflictBannerProps {
  className?: string;
  onViewConflicts?: () => void;
}

export function ConflictBanner({ className, onViewConflicts }: ConflictBannerProps) {
  const { conflicts, hasConflicts, dismissConflict, resolveConflict } = useConflictResolution();
  const [showDialog, setShowDialog] = useState(false);
  const [activeConflict, setActiveConflict] = useState<Conflict | null>(null);
  
  const unresolvedConflicts = conflicts.filter((c) => !c.resolved);
  
  if (!hasConflicts) return null;
  
  const handleViewConflict = (conflict: Conflict) => {
    setActiveConflict(conflict);
    setShowDialog(true);
  };
  
  return (
    <>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className={clsx(
          'bg-amber-50 dark:bg-amber-900/20',
          'border-b border-amber-200 dark:border-amber-800',
          className
        )}
      >
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
              {unresolvedConflicts.length} conflict{unresolvedConflicts.length !== 1 ? 's' : ''} detected
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => onViewConflicts?.() || handleViewConflict(unresolvedConflicts[0])}
              className={clsx(
                'px-3 py-1.5 text-sm font-medium rounded-lg',
                'text-amber-700 dark:text-amber-300',
                'bg-amber-100 dark:bg-amber-900/30',
                'hover:bg-amber-200 dark:hover:bg-amber-900/50',
                'transition-colors'
              )}
            >
              Resolve
            </button>
            <button
              onClick={() => unresolvedConflicts.forEach((c) => dismissConflict(c.id))}
              className="p-1.5 text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200"
              aria-label="Dismiss all conflicts"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </motion.div>
      
      <AnimatePresence>
        {showDialog && activeConflict && (
          <ConflictDialog
            conflict={activeConflict}
            onResolve={(resolution) => {
              resolveConflict(resolution);
              setShowDialog(false);
              setActiveConflict(null);
            }}
            onDismiss={() => {
              setShowDialog(false);
              setActiveConflict(null);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

export default ConflictProvider;
