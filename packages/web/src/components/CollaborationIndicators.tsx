/**
 * Real-time Collaboration Indicators
 * 
 * Show who else is viewing/editing the same content:
 * - Live presence avatars
 * - Cursor/selection sharing
 * - Edit conflict warnings
 * - "Someone is typing" indicators
 * - Lock status for exclusive editing
 */

import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
  createContext,
  useContext,
  ReactNode,
  useRef,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Eye,
  Edit3,
  Lock,
  Unlock,
  AlertTriangle,
  Circle,
  MessageCircle,
  RefreshCw,
} from 'lucide-react';
import { clsx } from 'clsx';

// ============================================================================
// Types
// ============================================================================

export interface CollaboratorUser {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  color: string;
}

export interface PresenceData {
  user: CollaboratorUser;
  status: 'viewing' | 'editing' | 'idle' | 'away';
  currentField?: string;
  cursorPosition?: { x: number; y: number };
  lastActivity: number;
  sessionId: string;
}

export interface EditLock {
  entityId: string;
  entityType: string;
  lockedBy: CollaboratorUser;
  lockedAt: number;
  expiresAt: number;
  fieldLocks?: Record<string, CollaboratorUser>;
}

export interface TypingIndicator {
  userId: string;
  fieldId: string;
  startedAt: number;
}

export interface CollaborationState {
  /** Current user */
  currentUser: CollaboratorUser | null;
  
  /** Other users present on this entity */
  collaborators: Map<string, PresenceData>;
  
  /** Edit lock status */
  lock: EditLock | null;
  
  /** Who is typing where */
  typingIndicators: Map<string, TypingIndicator>;
  
  /** Pending changes from others */
  pendingChanges: number;
  
  /** Connection status */
  isConnected: boolean;
}

export interface CollaborationContextValue extends CollaborationState {
  // Presence
  updatePresence: (status: PresenceData['status'], fieldId?: string) => void;
  setCurrentUser: (user: CollaboratorUser) => void;
  
  // Locking
  acquireLock: () => Promise<boolean>;
  releaseLock: () => Promise<void>;
  acquireFieldLock: (fieldId: string) => Promise<boolean>;
  releaseFieldLock: (fieldId: string) => Promise<void>;
  isFieldLocked: (fieldId: string) => boolean;
  getFieldLocker: (fieldId: string) => CollaboratorUser | null;
  
  // Typing
  startTyping: (fieldId: string) => void;
  stopTyping: (fieldId: string) => void;
  isTyping: (userId: string, fieldId: string) => boolean;
  
  // Conflict detection
  hasConflict: boolean;
  refreshData: () => Promise<void>;
}

// ============================================================================
// Color Palette for Users
// ============================================================================

const USER_COLORS = [
  '#3B82F6', // blue
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
  '#6366F1', // indigo
  '#14B8A6', // teal
];

export function getUserColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i);
    hash = hash & hash;
  }
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
}

// ============================================================================
// Context
// ============================================================================

const CollaborationContext = createContext<CollaborationContextValue | null>(null);

export function useCollaboration() {
  const context = useContext(CollaborationContext);
  if (!context) {
    throw new Error('useCollaboration must be used within CollaborationProvider');
  }
  return context;
}

// ============================================================================
// Provider
// ============================================================================

interface CollaborationProviderProps {
  children: ReactNode;
  entityId: string;
  entityType: string;
  currentUser?: CollaboratorUser;
  onPresenceChange?: (collaborators: PresenceData[]) => void;
  onLockChange?: (lock: EditLock | null) => void;
  onConflict?: () => void;
  onRefresh?: () => Promise<void>;
  
  /** WebSocket or polling implementation */
  transport?: {
    subscribe: (
      entityId: string,
      handlers: {
        onPresence: (data: PresenceData) => void;
        onLock: (lock: EditLock | null) => void;
        onTyping: (indicator: TypingIndicator | null, userId: string) => void;
        onChange: () => void;
      }
    ) => () => void;
    sendPresence: (data: Partial<PresenceData>) => void;
    sendLock: (action: 'acquire' | 'release', fieldId?: string) => Promise<boolean>;
    sendTyping: (fieldId: string, isTyping: boolean) => void;
  };
}

export function CollaborationProvider({
  children,
  entityId,
  entityType,
  currentUser: initialUser,
  onPresenceChange,
  onLockChange,
  onConflict,
  onRefresh,
  transport,
}: CollaborationProviderProps) {
  const [currentUser, setCurrentUser] = useState<CollaboratorUser | null>(initialUser ?? null);
  const [collaborators, setCollaborators] = useState<Map<string, PresenceData>>(new Map());
  const [lock, setLock] = useState<EditLock | null>(null);
  const [typingIndicators, setTypingIndicators] = useState<Map<string, TypingIndicator>>(new Map());
  const [pendingChanges, setPendingChanges] = useState(0);
  const [isConnected, setIsConnected] = useState(true);
  const [hasConflict, setHasConflict] = useState(false);

  const sessionId = useRef(Math.random().toString(36).slice(2));
  const typingTimeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Subscribe to collaboration events
  useEffect(() => {
    if (!transport) return;

    const unsubscribe = transport.subscribe(entityId, {
      onPresence: (data) => {
        if (data.sessionId === sessionId.current) return;
        
        setCollaborators((prev) => {
          const next = new Map(prev);
          if (data.status === 'away') {
            next.delete(data.user.id);
          } else {
            next.set(data.user.id, data);
          }
          return next;
        });
      },
      onLock: (newLock) => {
        setLock(newLock);
        onLockChange?.(newLock);
      },
      onTyping: (indicator, userId) => {
        setTypingIndicators((prev) => {
          const next = new Map(prev);
          if (indicator) {
            next.set(`${userId}:${indicator.fieldId}`, indicator);
          } else {
            // Remove all indicators for this user
            for (const key of next.keys()) {
              if (key.startsWith(`${userId}:`)) {
                next.delete(key);
              }
            }
          }
          return next;
        });
      },
      onChange: () => {
        setPendingChanges((prev) => prev + 1);
        setHasConflict(true);
        onConflict?.();
      },
    });

    return () => {
      unsubscribe();
    };
  }, [entityId, transport, onLockChange, onConflict]);

  // Notify on collaborator changes
  useEffect(() => {
    onPresenceChange?.(Array.from(collaborators.values()));
  }, [collaborators, onPresenceChange]);

  // Update presence
  const updatePresence = useCallback(
    (status: PresenceData['status'], fieldId?: string) => {
      if (!currentUser || !transport) return;

      const data: Partial<PresenceData> = {
        user: currentUser,
        status,
        currentField: fieldId,
        lastActivity: Date.now(),
        sessionId: sessionId.current,
      };

      transport.sendPresence(data);
    },
    [currentUser, transport]
  );

  // Lock management
  const acquireLock = useCallback(async (): Promise<boolean> => {
    if (!transport) return true;
    return transport.sendLock('acquire');
  }, [transport]);

  const releaseLock = useCallback(async (): Promise<void> => {
    if (!transport) return;
    await transport.sendLock('release');
  }, [transport]);

  const acquireFieldLock = useCallback(
    async (fieldId: string): Promise<boolean> => {
      if (!transport) return true;
      return transport.sendLock('acquire', fieldId);
    },
    [transport]
  );

  const releaseFieldLock = useCallback(
    async (fieldId: string): Promise<void> => {
      if (!transport) return;
      await transport.sendLock('release', fieldId);
    },
    [transport]
  );

  const isFieldLocked = useCallback(
    (fieldId: string): boolean => {
      if (!lock?.fieldLocks) return false;
      const locker = lock.fieldLocks[fieldId];
      return locker !== undefined && locker.id !== currentUser?.id;
    },
    [lock, currentUser]
  );

  const getFieldLocker = useCallback(
    (fieldId: string): CollaboratorUser | null => {
      if (!lock?.fieldLocks) return null;
      const locker = lock.fieldLocks[fieldId];
      return locker?.id !== currentUser?.id ? locker : null;
    },
    [lock, currentUser]
  );

  // Typing indicators
  const startTyping = useCallback(
    (fieldId: string) => {
      if (!transport || !currentUser) return;

      transport.sendTyping(fieldId, true);

      // Clear existing timeout
      const timeoutKey = `${currentUser.id}:${fieldId}`;
      const existingTimeout = typingTimeoutRef.current.get(timeoutKey);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      // Auto-stop typing after 5 seconds of inactivity
      const timeout = setTimeout(() => {
        transport.sendTyping(fieldId, false);
        typingTimeoutRef.current.delete(timeoutKey);
      }, 5000);

      typingTimeoutRef.current.set(timeoutKey, timeout);
    },
    [transport, currentUser]
  );

  const stopTyping = useCallback(
    (fieldId: string) => {
      if (!transport || !currentUser) return;

      transport.sendTyping(fieldId, false);

      const timeoutKey = `${currentUser.id}:${fieldId}`;
      const existingTimeout = typingTimeoutRef.current.get(timeoutKey);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
        typingTimeoutRef.current.delete(timeoutKey);
      }
    },
    [transport, currentUser]
  );

  const isTyping = useCallback(
    (userId: string, fieldId: string): boolean => {
      return typingIndicators.has(`${userId}:${fieldId}`);
    },
    [typingIndicators]
  );

  // Refresh data
  const refreshData = useCallback(async () => {
    if (onRefresh) {
      await onRefresh();
      setPendingChanges(0);
      setHasConflict(false);
    }
  }, [onRefresh]);

  const contextValue = useMemo<CollaborationContextValue>(
    () => ({
      currentUser,
      collaborators,
      lock,
      typingIndicators,
      pendingChanges,
      isConnected,
      hasConflict,
      updatePresence,
      setCurrentUser,
      acquireLock,
      releaseLock,
      acquireFieldLock,
      releaseFieldLock,
      isFieldLocked,
      getFieldLocker,
      startTyping,
      stopTyping,
      isTyping,
      refreshData,
    }),
    [
      currentUser,
      collaborators,
      lock,
      typingIndicators,
      pendingChanges,
      isConnected,
      hasConflict,
      updatePresence,
      acquireLock,
      releaseLock,
      acquireFieldLock,
      releaseFieldLock,
      isFieldLocked,
      getFieldLocker,
      startTyping,
      stopTyping,
      isTyping,
      refreshData,
    ]
  );

  return (
    <CollaborationContext.Provider value={contextValue}>
      {children}
    </CollaborationContext.Provider>
  );
}

// ============================================================================
// Presence Avatars Component
// ============================================================================

interface PresenceAvatarsProps {
  className?: string;
  maxVisible?: number;
  showStatus?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function PresenceAvatars({
  className,
  maxVisible = 5,
  showStatus = true,
  size = 'md',
}: PresenceAvatarsProps) {
  const { collaborators, currentUser } = useCollaboration();

  const sortedCollaborators = useMemo(
    () =>
      Array.from(collaborators.values())
        .filter((c) => c.user.id !== currentUser?.id)
        .sort((a, b) => b.lastActivity - a.lastActivity),
    [collaborators, currentUser]
  );

  const visible = sortedCollaborators.slice(0, maxVisible);
  const overflow = sortedCollaborators.length - maxVisible;

  const sizeClasses = {
    sm: 'h-6 w-6 text-xs',
    md: 'h-8 w-8 text-sm',
    lg: 'h-10 w-10 text-base',
  };

  const statusSizeClasses = {
    sm: 'h-2 w-2',
    md: 'h-2.5 w-2.5',
    lg: 'h-3 w-3',
  };

  if (sortedCollaborators.length === 0) return null;

  return (
    <div className={clsx('flex items-center', className)}>
      <div className="flex -space-x-2">
        {visible.map((presence) => (
          <div
            key={presence.user.id}
            className="relative"
            title={`${presence.user.name} (${presence.status})`}
          >
            {presence.user.avatar ? (
              <img
                src={presence.user.avatar}
                alt={presence.user.name}
                className={clsx(
                  sizeClasses[size],
                  'rounded-full ring-2 ring-white dark:ring-gray-800'
                )}
              />
            ) : (
              <div
                className={clsx(
                  sizeClasses[size],
                  'rounded-full ring-2 ring-white dark:ring-gray-800',
                  'flex items-center justify-center font-medium text-white'
                )}
                style={{ backgroundColor: presence.user.color }}
              >
                {presence.user.name.charAt(0).toUpperCase()}
              </div>
            )}

            {showStatus && (
              <span
                className={clsx(
                  'absolute bottom-0 right-0',
                  statusSizeClasses[size],
                  'rounded-full ring-2 ring-white dark:ring-gray-800',
                  presence.status === 'editing'
                    ? 'bg-green-500'
                    : presence.status === 'viewing'
                    ? 'bg-blue-500'
                    : 'bg-gray-400'
                )}
              />
            )}
          </div>
        ))}

        {overflow > 0 && (
          <div
            className={clsx(
              sizeClasses[size],
              'rounded-full ring-2 ring-white dark:ring-gray-800',
              'flex items-center justify-center',
              'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
            )}
          >
            +{overflow}
          </div>
        )}
      </div>

      <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
        {sortedCollaborators.length === 1
          ? '1 person viewing'
          : `${sortedCollaborators.length} people viewing`}
      </span>
    </div>
  );
}

// ============================================================================
// Typing Indicator Component
// ============================================================================

interface TypingIndicatorProps {
  fieldId: string;
  className?: string;
}

export function TypingIndicatorDisplay({ fieldId, className }: TypingIndicatorProps) {
  const { typingIndicators, collaborators } = useCollaboration();

  const typingUsers = useMemo(() => {
    const users: CollaboratorUser[] = [];
    for (const [key, indicator] of typingIndicators.entries()) {
      if (indicator.fieldId === fieldId) {
        const presence = collaborators.get(indicator.userId);
        if (presence) {
          users.push(presence.user);
        }
      }
    }
    return users;
  }, [typingIndicators, collaborators, fieldId]);

  if (typingUsers.length === 0) return null;

  const names = typingUsers.map((u) => u.name);
  const displayText =
    names.length === 1
      ? `${names[0]} is typing...`
      : names.length === 2
      ? `${names[0]} and ${names[1]} are typing...`
      : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} are typing...`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 5 }}
      className={clsx(
        'flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400',
        className
      )}
    >
      <div className="flex items-center gap-0.5">
        <motion.span
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.2, repeat: Infinity }}
          className="w-1.5 h-1.5 rounded-full bg-gray-400"
        />
        <motion.span
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}
          className="w-1.5 h-1.5 rounded-full bg-gray-400"
        />
        <motion.span
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }}
          className="w-1.5 h-1.5 rounded-full bg-gray-400"
        />
      </div>
      <span>{displayText}</span>
    </motion.div>
  );
}

// ============================================================================
// Lock Status Component
// ============================================================================

interface LockStatusProps {
  className?: string;
}

export function LockStatus({ className }: LockStatusProps) {
  const { lock, currentUser, acquireLock, releaseLock } = useCollaboration();
  const [isRequesting, setIsRequesting] = useState(false);

  const isLockedByMe = lock?.lockedBy.id === currentUser?.id;
  const isLockedByOther = lock && !isLockedByMe;

  const handleToggleLock = async () => {
    setIsRequesting(true);
    try {
      if (isLockedByMe) {
        await releaseLock();
      } else if (!lock) {
        await acquireLock();
      }
    } finally {
      setIsRequesting(false);
    }
  };

  if (!lock && !isRequesting) return null;

  return (
    <div
      className={clsx(
        'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm',
        isLockedByOther
          ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
          : isLockedByMe
          ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
          : 'bg-gray-100 dark:bg-gray-700',
        className
      )}
    >
      {isLockedByOther ? (
        <>
          <Lock className="h-4 w-4" />
          <span>Locked by {lock.lockedBy.name}</span>
        </>
      ) : isLockedByMe ? (
        <>
          <Lock className="h-4 w-4" />
          <span>You have edit lock</span>
          <button
            onClick={handleToggleLock}
            disabled={isRequesting}
            className="ml-2 text-xs underline hover:no-underline"
          >
            Release
          </button>
        </>
      ) : (
        <button
          onClick={handleToggleLock}
          disabled={isRequesting}
          className="flex items-center gap-2 hover:opacity-80"
        >
          <Unlock className="h-4 w-4" />
          <span>Acquire lock</span>
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Conflict Banner Component
// ============================================================================

interface ConflictBannerProps {
  className?: string;
}

export function ConflictBanner({ className }: ConflictBannerProps) {
  const { hasConflict, pendingChanges, refreshData } = useCollaboration();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshData();
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!hasConflict) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={clsx(
          'flex items-center justify-between gap-4 px-4 py-3',
          'bg-amber-50 dark:bg-amber-900/20',
          'border-l-4 border-amber-400',
          'rounded-r-lg',
          className
        )}
      >
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              Changes detected
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-300">
              {pendingChanges} update{pendingChanges !== 1 ? 's' : ''} made by others
            </p>
          </div>
        </div>

        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className={clsx(
            'flex items-center gap-2 px-3 py-1.5',
            'text-sm font-medium text-amber-700 dark:text-amber-300',
            'bg-amber-100 dark:bg-amber-800/30',
            'rounded-lg hover:bg-amber-200 dark:hover:bg-amber-800/50',
            'disabled:opacity-50'
          )}
        >
          <RefreshCw
            className={clsx('h-4 w-4', isRefreshing && 'animate-spin')}
          />
          Refresh
        </button>
      </motion.div>
    </AnimatePresence>
  );
}

// ============================================================================
// Field Collaboration Wrapper
// ============================================================================

interface CollaborativeFieldProps {
  fieldId: string;
  children: ReactNode;
  className?: string;
  showTyping?: boolean;
  showLock?: boolean;
}

export function CollaborativeField({
  fieldId,
  children,
  className,
  showTyping = true,
  showLock = true,
}: CollaborativeFieldProps) {
  const {
    isFieldLocked,
    getFieldLocker,
    startTyping,
    stopTyping,
    updatePresence,
  } = useCollaboration();

  const locked = isFieldLocked(fieldId);
  const locker = getFieldLocker(fieldId);

  const handleFocus = () => {
    updatePresence('editing', fieldId);
  };

  const handleBlur = () => {
    stopTyping(fieldId);
    updatePresence('viewing');
  };

  const handleInput = () => {
    startTyping(fieldId);
  };

  return (
    <div
      className={clsx(
        'relative',
        locked && 'opacity-50 pointer-events-none',
        className
      )}
    >
      <div
        onFocus={handleFocus}
        onBlur={handleBlur}
        onInput={handleInput}
      >
        {children}
      </div>

      {showLock && locker && (
        <div className="absolute -top-2 -right-2 px-2 py-0.5 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full">
          Editing: {locker.name}
        </div>
      )}

      {showTyping && (
        <div className="mt-1">
          <TypingIndicatorDisplay fieldId={fieldId} />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Collaboration Status Bar
// ============================================================================

interface CollaborationStatusBarProps {
  className?: string;
}

export function CollaborationStatusBar({ className }: CollaborationStatusBarProps) {
  const { collaborators, isConnected, currentUser } = useCollaboration();

  const activeCount = Array.from(collaborators.values()).filter(
    (c) => c.user.id !== currentUser?.id && c.status !== 'away'
  ).length;

  return (
    <div
      className={clsx(
        'flex items-center gap-4 px-4 py-2',
        'bg-gray-50 dark:bg-gray-800/50',
        'border-t border-gray-200 dark:border-gray-700',
        className
      )}
    >
      {/* Connection status */}
      <div className="flex items-center gap-2 text-sm">
        <Circle
          className={clsx(
            'h-2 w-2',
            isConnected ? 'text-green-500 fill-green-500' : 'text-red-500 fill-red-500'
          )}
        />
        <span className="text-gray-500 dark:text-gray-400">
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      {/* Active collaborators */}
      {activeCount > 0 && (
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Users className="h-4 w-4" />
          <span>
            {activeCount} other{activeCount !== 1 ? 's' : ''} viewing
          </span>
        </div>
      )}

      {/* Presence avatars */}
      <div className="flex-1 flex justify-end">
        <PresenceAvatars size="sm" showStatus={false} maxVisible={3} />
      </div>
    </div>
  );
}

export default CollaborationProvider;
