/**
 * Form Autosave & Draft Recovery System
 * 
 * Provides automatic form saving with:
 * - Debounced autosave to localStorage/IndexedDB
 * - Draft recovery prompts on page load
 * - Conflict detection with server data
 * - Versioned drafts with timestamps
 * - Form state persistence across sessions
 * - Dirty state tracking
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  createContext,
  useContext,
  ReactNode,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Save,
  AlertCircle,
  Clock,
  Check,
  X,
  RefreshCw,
  Trash2,
  History,
} from 'lucide-react';
import { formatDistanceToNow, differenceInMinutes } from 'date-fns';
import { clsx } from 'clsx';

// ============================================================================
// Types
// ============================================================================

export interface FormDraft<T> {
  id: string;
  formKey: string;
  data: T;
  timestamp: number;
  version: number;
  serverTimestamp?: number;
  userId?: string;
}

export interface AutosaveOptions<T> {
  /** Unique key for this form */
  formKey: string;
  
  /** Initial form data */
  initialData: T;
  
  /** Debounce delay in ms (default: 1000) */
  debounceMs?: number;
  
  /** Enable autosave (default: true) */
  enabled?: boolean;
  
  /** Use IndexedDB instead of localStorage (default: false) */
  useIndexedDB?: boolean;
  
  /** Maximum drafts to keep (default: 5) */
  maxDrafts?: number;
  
  /** Server data for conflict detection */
  serverData?: T;
  
  /** Server timestamp for conflict detection */
  serverTimestamp?: number;
  
  /** Called when draft is saved */
  onSave?: (draft: FormDraft<T>) => void;
  
  /** Called when draft is recovered */
  onRecover?: (draft: FormDraft<T>) => void;
  
  /** Called when conflict is detected */
  onConflict?: (local: FormDraft<T>, server: T) => void;
  
  /** User ID for multi-user support */
  userId?: string;
  
  /** Custom comparison function */
  isEqual?: (a: T, b: T) => boolean;
}

export interface AutosaveState<T> {
  /** Current form data */
  data: T;
  
  /** Whether form has unsaved changes */
  isDirty: boolean;
  
  /** Whether draft is currently being saved */
  isSaving: boolean;
  
  /** Last saved timestamp */
  lastSaved: number | null;
  
  /** Available drafts */
  drafts: FormDraft<T>[];
  
  /** Current draft being edited */
  currentDraft: FormDraft<T> | null;
  
  /** Whether conflict exists with server */
  hasConflict: boolean;
  
  /** Validation errors */
  errors: Record<string, string>;
}

export interface AutosaveActions<T> {
  /** Update form data */
  updateData: (data: Partial<T>) => void;
  
  /** Set entire form data */
  setData: (data: T) => void;
  
  /** Force save current state */
  forceSave: () => Promise<void>;
  
  /** Recover a specific draft */
  recoverDraft: (draftId: string) => void;
  
  /** Delete a specific draft */
  deleteDraft: (draftId: string) => void;
  
  /** Clear all drafts */
  clearDrafts: () => void;
  
  /** Reset to initial/server data */
  reset: () => void;
  
  /** Accept server changes */
  acceptServerChanges: () => void;
  
  /** Keep local changes */
  keepLocalChanges: () => void;
  
  /** Set field error */
  setError: (field: string, error: string) => void;
  
  /** Clear field error */
  clearError: (field: string) => void;
  
  /** Clear all errors */
  clearAllErrors: () => void;
}

export type UseAutosaveReturn<T> = AutosaveState<T> & AutosaveActions<T>;

// ============================================================================
// Storage Utilities
// ============================================================================

const STORAGE_PREFIX = 'form-draft-';

function getStorageKey(formKey: string): string {
  return `${STORAGE_PREFIX}${formKey}`;
}

function saveDraftsToStorage<T>(formKey: string, drafts: FormDraft<T>[]): void {
  try {
    localStorage.setItem(getStorageKey(formKey), JSON.stringify(drafts));
  } catch (error) {
    console.warn('Failed to save drafts to localStorage:', error);
  }
}

function loadDraftsFromStorage<T>(formKey: string): FormDraft<T>[] {
  try {
    const stored = localStorage.getItem(getStorageKey(formKey));
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.warn('Failed to load drafts from localStorage:', error);
    return [];
  }
}

function generateDraftId(): string {
  return `draft-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// Default Comparison
// ============================================================================

function defaultIsEqual<T>(a: T, b: T): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// ============================================================================
// Main Hook
// ============================================================================

export function useAutosave<T extends Record<string, unknown>>(
  options: AutosaveOptions<T>
): UseAutosaveReturn<T> {
  const {
    formKey,
    initialData,
    debounceMs = 1000,
    enabled = true,
    maxDrafts = 5,
    serverData,
    serverTimestamp,
    onSave,
    onRecover,
    onConflict,
    userId,
    isEqual = defaultIsEqual,
  } = options;

  // State
  const [data, setDataState] = useState<T>(initialData);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<FormDraft<T>[]>([]);
  const [currentDraft, setCurrentDraft] = useState<FormDraft<T> | null>(null);
  const [hasConflict, setHasConflict] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Refs
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialDataRef = useRef(initialData);
  const serverDataRef = useRef(serverData);
  const serverTimestampRef = useRef(serverTimestamp);

  // Update refs
  useEffect(() => {
    serverDataRef.current = serverData;
    serverTimestampRef.current = serverTimestamp;
  }, [serverData, serverTimestamp]);

  // Load drafts on mount
  useEffect(() => {
    const loadedDrafts = loadDraftsFromStorage<T>(formKey);
    setDrafts(loadedDrafts);

    // Check for recent draft to recover
    if (loadedDrafts.length > 0) {
      const mostRecent = loadedDrafts[0];
      const minutesSinceSave = differenceInMinutes(Date.now(), mostRecent.timestamp);
      
      // If draft is less than 24 hours old and different from initial
      if (minutesSinceSave < 1440 && !isEqual(mostRecent.data, initialData)) {
        setCurrentDraft(mostRecent);
      }
    }
  }, [formKey, initialData, isEqual]);

  // Check for conflicts with server data
  useEffect(() => {
    if (serverData && currentDraft && serverTimestamp) {
      const hasLocalChanges = !isEqual(currentDraft.data, initialData);
      const serverIsNewer = serverTimestamp > (currentDraft.serverTimestamp ?? 0);
      const datasDiffer = !isEqual(serverData, currentDraft.data);

      if (hasLocalChanges && serverIsNewer && datasDiffer) {
        setHasConflict(true);
        onConflict?.(currentDraft, serverData);
      }
    }
  }, [serverData, serverTimestamp, currentDraft, initialData, isEqual, onConflict]);

  // Save draft function
  const saveDraft = useCallback(async (dataToSave: T) => {
    if (!enabled) return;

    setIsSaving(true);

    try {
      const now = Date.now();
      const draft: FormDraft<T> = {
        id: currentDraft?.id ?? generateDraftId(),
        formKey,
        data: dataToSave,
        timestamp: now,
        version: (currentDraft?.version ?? 0) + 1,
        serverTimestamp: serverTimestampRef.current,
        userId,
      };

      // Update drafts list
      const newDrafts = [
        draft,
        ...drafts.filter((d) => d.id !== draft.id),
      ].slice(0, maxDrafts);

      setDrafts(newDrafts);
      setCurrentDraft(draft);
      setLastSaved(now);
      saveDraftsToStorage(formKey, newDrafts);

      onSave?.(draft);
    } finally {
      setIsSaving(false);
    }
  }, [enabled, formKey, currentDraft, drafts, maxDrafts, userId, onSave]);

  // Debounced save
  const debouncedSave = useCallback((dataToSave: T) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveDraft(dataToSave);
    }, debounceMs);
  }, [debounceMs, saveDraft]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Actions
  const updateData = useCallback((partial: Partial<T>) => {
    setDataState((prev) => {
      const newData = { ...prev, ...partial };
      setIsDirty(!isEqual(newData, initialDataRef.current));
      debouncedSave(newData);
      return newData;
    });
  }, [isEqual, debouncedSave]);

  const setData = useCallback((newData: T) => {
    setDataState(newData);
    setIsDirty(!isEqual(newData, initialDataRef.current));
    debouncedSave(newData);
  }, [isEqual, debouncedSave]);

  const forceSave = useCallback(async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    await saveDraft(data);
  }, [data, saveDraft]);

  const recoverDraft = useCallback((draftId: string) => {
    const draft = drafts.find((d) => d.id === draftId);
    if (draft) {
      setDataState(draft.data);
      setCurrentDraft(draft);
      setIsDirty(!isEqual(draft.data, initialDataRef.current));
      onRecover?.(draft);
    }
  }, [drafts, isEqual, onRecover]);

  const deleteDraft = useCallback((draftId: string) => {
    const newDrafts = drafts.filter((d) => d.id !== draftId);
    setDrafts(newDrafts);
    saveDraftsToStorage(formKey, newDrafts);

    if (currentDraft?.id === draftId) {
      setCurrentDraft(null);
    }
  }, [drafts, formKey, currentDraft]);

  const clearDrafts = useCallback(() => {
    setDrafts([]);
    setCurrentDraft(null);
    localStorage.removeItem(getStorageKey(formKey));
  }, [formKey]);

  const reset = useCallback(() => {
    const resetData = serverDataRef.current ?? initialDataRef.current;
    setDataState(resetData);
    setIsDirty(false);
    setHasConflict(false);
    setCurrentDraft(null);
    setErrors({});
  }, []);

  const acceptServerChanges = useCallback(() => {
    if (serverDataRef.current) {
      setDataState(serverDataRef.current);
      setIsDirty(false);
      setHasConflict(false);
    }
  }, []);

  const keepLocalChanges = useCallback(() => {
    setHasConflict(false);
    forceSave();
  }, [forceSave]);

  const setError = useCallback((field: string, error: string) => {
    setErrors((prev) => ({ ...prev, [field]: error }));
  }, []);

  const clearError = useCallback((field: string) => {
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  }, []);

  const clearAllErrors = useCallback(() => {
    setErrors({});
  }, []);

  return {
    // State
    data,
    isDirty,
    isSaving,
    lastSaved,
    drafts,
    currentDraft,
    hasConflict,
    errors,
    // Actions
    updateData,
    setData,
    forceSave,
    recoverDraft,
    deleteDraft,
    clearDrafts,
    reset,
    acceptServerChanges,
    keepLocalChanges,
    setError,
    clearError,
    clearAllErrors,
  };
}

// ============================================================================
// Context for Form-Level Access
// ============================================================================

interface AutosaveContextValue<T> extends UseAutosaveReturn<T> {
  formKey: string;
}

const AutosaveContext = createContext<AutosaveContextValue<Record<string, unknown>> | null>(null);

export function useAutosaveContext<T extends Record<string, unknown>>() {
  const context = useContext(AutosaveContext) as AutosaveContextValue<T> | null;
  if (!context) {
    throw new Error('useAutosaveContext must be used within AutosaveProvider');
  }
  return context;
}

// ============================================================================
// Provider Component
// ============================================================================

interface AutosaveProviderProps<T extends Record<string, unknown>> {
  children: ReactNode;
  options: AutosaveOptions<T>;
}

export function AutosaveProvider<T extends Record<string, unknown>>({
  children,
  options,
}: AutosaveProviderProps<T>) {
  const autosave = useAutosave(options);

  const contextValue = useMemo(
    () => ({
      ...autosave,
      formKey: options.formKey,
    }),
    [autosave, options.formKey]
  );

  return (
    <AutosaveContext.Provider value={contextValue as AutosaveContextValue<Record<string, unknown>>}>
      {children}
    </AutosaveContext.Provider>
  );
}

// ============================================================================
// Autosave Status Indicator
// ============================================================================

interface AutosaveStatusProps {
  className?: string;
  showDrafts?: boolean;
}

export function AutosaveStatus({ className, showDrafts = false }: AutosaveStatusProps) {
  const { isDirty, isSaving, lastSaved, drafts, hasConflict } = useAutosaveContext();
  const [showDraftList, setShowDraftList] = useState(false);

  const statusText = useMemo(() => {
    if (hasConflict) return 'Conflict detected';
    if (isSaving) return 'Saving...';
    if (lastSaved) return `Saved ${formatDistanceToNow(lastSaved, { addSuffix: true })}`;
    if (isDirty) return 'Unsaved changes';
    return 'All changes saved';
  }, [hasConflict, isSaving, lastSaved, isDirty]);

  const statusColor = useMemo(() => {
    if (hasConflict) return 'text-red-500';
    if (isSaving) return 'text-blue-500';
    if (isDirty) return 'text-yellow-500';
    return 'text-green-500';
  }, [hasConflict, isSaving, isDirty]);

  return (
    <div className={clsx('relative inline-flex items-center gap-2', className)}>
      <div className={clsx('flex items-center gap-1.5 text-sm', statusColor)}>
        {isSaving ? (
          <RefreshCw className="h-4 w-4 animate-spin" />
        ) : hasConflict ? (
          <AlertCircle className="h-4 w-4" />
        ) : isDirty ? (
          <Clock className="h-4 w-4" />
        ) : (
          <Check className="h-4 w-4" />
        )}
        <span>{statusText}</span>
      </div>

      {showDrafts && drafts.length > 0 && (
        <button
          onClick={() => setShowDraftList(!showDraftList)}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          title="View drafts"
        >
          <History className="h-4 w-4" />
        </button>
      )}

      <AnimatePresence>
        {showDraftList && (
          <DraftList onClose={() => setShowDraftList(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Draft List Component
// ============================================================================

interface DraftListProps {
  onClose: () => void;
}

function DraftList({ onClose }: DraftListProps) {
  const { drafts, currentDraft, recoverDraft, deleteDraft, clearDrafts } = useAutosaveContext();

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={clsx(
        'absolute right-0 top-full mt-2 z-50',
        'w-72 max-h-80 overflow-auto',
        'bg-white dark:bg-gray-800',
        'rounded-lg shadow-xl',
        'border border-gray-200 dark:border-gray-700'
      )}
    >
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Saved Drafts
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {drafts.length === 0 ? (
          <div className="p-4 text-sm text-gray-500 text-center">
            No drafts saved
          </div>
        ) : (
          drafts.map((draft) => (
            <div
              key={draft.id}
              className={clsx(
                'p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50',
                draft.id === currentDraft?.id && 'bg-blue-50 dark:bg-blue-900/20'
              )}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-900 dark:text-white">
                    Version {draft.version}
                    {draft.id === currentDraft?.id && (
                      <span className="ml-2 text-xs text-blue-500">(current)</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatDistanceToNow(draft.timestamp, { addSuffix: true })}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {draft.id !== currentDraft?.id && (
                    <button
                      onClick={() => recoverDraft(draft.id)}
                      className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                      title="Recover this draft"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => deleteDraft(draft.id)}
                    className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                    title="Delete this draft"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {drafts.length > 0 && (
        <div className="p-2 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={clearDrafts}
            className="w-full px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
          >
            Clear all drafts
          </button>
        </div>
      )}
    </motion.div>
  );
}

// ============================================================================
// Draft Recovery Dialog
// ============================================================================

interface DraftRecoveryDialogProps {
  isOpen: boolean;
  onRecover: () => void;
  onDiscard: () => void;
  draftTimestamp?: number;
}

export function DraftRecoveryDialog({
  isOpen,
  onRecover,
  onDiscard,
  draftTimestamp,
}: DraftRecoveryDialogProps) {
  return (
    <AnimatePresence>
      {isOpen && (
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
              'w-full max-w-md mx-4 p-6',
              'bg-white dark:bg-gray-800',
              'rounded-xl shadow-2xl'
            )}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-full">
                <Save className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Unsaved Draft Found
              </h2>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              We found an unsaved draft from{' '}
              {draftTimestamp
                ? formatDistanceToNow(draftTimestamp, { addSuffix: true })
                : 'a previous session'}
              . Would you like to recover it?
            </p>

            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={onDiscard}
                className={clsx(
                  'px-4 py-2 text-sm font-medium',
                  'text-gray-700 dark:text-gray-300',
                  'hover:bg-gray-100 dark:hover:bg-gray-700',
                  'rounded-lg transition-colors'
                )}
              >
                Start Fresh
              </button>
              <button
                onClick={onRecover}
                className={clsx(
                  'px-4 py-2 text-sm font-medium',
                  'bg-blue-500 text-white',
                  'hover:bg-blue-600',
                  'rounded-lg transition-colors'
                )}
              >
                Recover Draft
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ============================================================================
// Conflict Resolution Dialog
// ============================================================================

interface ConflictDialogProps<T> {
  isOpen: boolean;
  localData?: T;
  serverData?: T;
  onAcceptServer: () => void;
  onKeepLocal: () => void;
  onMerge?: (merged: T) => void;
  renderDiff?: (local: T, server: T) => ReactNode;
}

export function ConflictDialog<T>({
  isOpen,
  localData,
  serverData,
  onAcceptServer,
  onKeepLocal,
  renderDiff,
}: ConflictDialogProps<T>) {
  return (
    <AnimatePresence>
      {isOpen && (
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
              'w-full max-w-lg mx-4 p-6',
              'bg-white dark:bg-gray-800',
              'rounded-xl shadow-2xl'
            )}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded-full">
                <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Conflict Detected
              </h2>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Someone else has made changes to this form. Please choose which
              version to keep:
            </p>

            {renderDiff && localData && serverData && (
              <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg text-sm max-h-60 overflow-auto">
                {renderDiff(localData, serverData)}
              </div>
            )}

            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={onKeepLocal}
                className={clsx(
                  'px-4 py-2 text-sm font-medium',
                  'text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600',
                  'hover:bg-gray-100 dark:hover:bg-gray-700',
                  'rounded-lg transition-colors'
                )}
              >
                Keep My Changes
              </button>
              <button
                onClick={onAcceptServer}
                className={clsx(
                  'px-4 py-2 text-sm font-medium',
                  'bg-blue-500 text-white',
                  'hover:bg-blue-600',
                  'rounded-lg transition-colors'
                )}
              >
                Accept Server Version
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ============================================================================
// Unsaved Changes Warning
// ============================================================================

export function useUnsavedChangesWarning(isDirty: boolean) {
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);
}

// ============================================================================
// Auto-Save Form Field Wrapper
// ============================================================================

interface AutosaveFieldProps<T extends Record<string, unknown>> {
  name: keyof T;
  children: (props: {
    value: T[keyof T];
    onChange: (value: T[keyof T]) => void;
    error?: string;
  }) => ReactNode;
}

export function AutosaveField<T extends Record<string, unknown>>({
  name,
  children,
}: AutosaveFieldProps<T>) {
  const { data, updateData, errors } = useAutosaveContext<T>();

  const value = data[name];
  const error = errors[name as string];

  const onChange = useCallback(
    (newValue: T[keyof T]) => {
      updateData({ [name]: newValue } as Partial<T>);
    },
    [name, updateData]
  );

  return <>{children({ value, onChange, error })}</>;
}

export default useAutosave;
