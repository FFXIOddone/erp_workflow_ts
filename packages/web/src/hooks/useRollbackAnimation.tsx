/**
 * Rollback Animation System
 * 
 * Provides visual feedback when optimistic updates fail and rollback:
 * - Shake animation for failed updates
 * - Fade-out for failed deletes (item reappears)
 * - Flash animation for restored values
 * - Undo toast with countdown
 */

import React, {
  createContext,
  useContext,
  useCallback,
  useState,
  useEffect,
  useRef,
  ReactNode,
} from 'react';
import { motion, AnimatePresence, useReducedMotion, Variants } from 'framer-motion';
import { Undo2, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { clsx } from 'clsx';

// ============================================================================
// Types
// ============================================================================

export type RollbackAnimationType = 
  | 'shake'      // Failed update
  | 'fadeRestore' // Failed delete (item restored)
  | 'flash'      // Value restored
  | 'slideBack'  // Position restored
  | 'pulse'      // Attention/warning
  | 'bounce';    // Success

export interface RollbackEvent {
  id: string;
  targetId: string;
  type: RollbackAnimationType;
  message?: string;
  showUndo?: boolean;
  undoAction?: () => void;
  undoTimeout?: number;
  timestamp: number;
}

interface RollbackContextValue {
  /** Active rollback events */
  events: RollbackEvent[];
  
  /** Trigger a rollback animation */
  triggerRollback: (event: Omit<RollbackEvent, 'id' | 'timestamp'>) => string;
  
  /** Clear a specific event */
  clearEvent: (eventId: string) => void;
  
  /** Check if an element is currently rolling back */
  isRollingBack: (targetId: string) => boolean;
  
  /** Get animation type for an element */
  getAnimationType: (targetId: string) => RollbackAnimationType | null;
}

// ============================================================================
// Animation Variants
// ============================================================================

export const rollbackAnimations: Record<RollbackAnimationType, Variants> = {
  shake: {
    initial: { x: 0 },
    animate: {
      x: [0, -10, 10, -10, 10, -5, 5, 0],
      transition: { duration: 0.5, ease: 'easeInOut' },
    },
    exit: { x: 0 },
  },
  
  fadeRestore: {
    initial: { opacity: 0, scale: 0.8 },
    animate: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.3, ease: 'easeOut' },
    },
    exit: { opacity: 0, scale: 0.8 },
  },
  
  flash: {
    initial: { backgroundColor: 'transparent' },
    animate: {
      backgroundColor: [
        'transparent',
        'rgba(251, 191, 36, 0.3)',
        'rgba(251, 191, 36, 0.5)',
        'rgba(251, 191, 36, 0.3)',
        'transparent',
      ],
      transition: { duration: 0.6, ease: 'easeInOut' },
    },
    exit: { backgroundColor: 'transparent' },
  },
  
  slideBack: {
    initial: { x: 20, opacity: 0 },
    animate: {
      x: 0,
      opacity: 1,
      transition: { type: 'spring', stiffness: 300, damping: 20 },
    },
    exit: { x: -20, opacity: 0 },
  },
  
  pulse: {
    initial: { scale: 1 },
    animate: {
      scale: [1, 1.02, 1, 1.02, 1],
      boxShadow: [
        '0 0 0 0 rgba(251, 191, 36, 0)',
        '0 0 0 4px rgba(251, 191, 36, 0.3)',
        '0 0 0 0 rgba(251, 191, 36, 0)',
      ],
      transition: { duration: 0.8, ease: 'easeInOut' },
    },
    exit: { scale: 1 },
  },
  
  bounce: {
    initial: { scale: 0.8, opacity: 0 },
    animate: {
      scale: [0.8, 1.1, 0.95, 1],
      opacity: 1,
      transition: { duration: 0.4, ease: 'easeOut' },
    },
    exit: { scale: 0.8, opacity: 0 },
  },
};

// ============================================================================
// Context
// ============================================================================

const RollbackContext = createContext<RollbackContextValue | null>(null);

export function useRollbackAnimation() {
  const context = useContext(RollbackContext);
  if (!context) {
    throw new Error('useRollbackAnimation must be used within RollbackProvider');
  }
  return context;
}

// ============================================================================
// Provider
// ============================================================================

interface RollbackProviderProps {
  children: ReactNode;
  /** Default undo timeout in ms */
  defaultUndoTimeout?: number;
  /** Maximum events to track */
  maxEvents?: number;
}

export function RollbackProvider({
  children,
  defaultUndoTimeout = 5000,
  maxEvents = 20,
}: RollbackProviderProps) {
  const [events, setEvents] = useState<RollbackEvent[]>([]);
  const eventIdRef = useRef(0);
  
  const triggerRollback = useCallback((
    eventData: Omit<RollbackEvent, 'id' | 'timestamp'>
  ): string => {
    const id = `rollback-${++eventIdRef.current}`;
    const event: RollbackEvent = {
      ...eventData,
      id,
      timestamp: Date.now(),
      undoTimeout: eventData.undoTimeout ?? defaultUndoTimeout,
    };
    
    setEvents((prev) => {
      const updated = [event, ...prev];
      return updated.slice(0, maxEvents);
    });
    
    // Auto-clear after animation completes (unless it has undo)
    if (!event.showUndo) {
      setTimeout(() => {
        setEvents((prev) => prev.filter((e) => e.id !== id));
      }, 1000);
    }
    
    return id;
  }, [defaultUndoTimeout, maxEvents]);
  
  const clearEvent = useCallback((eventId: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== eventId));
  }, []);
  
  const isRollingBack = useCallback((targetId: string) => {
    return events.some((e) => e.targetId === targetId);
  }, [events]);
  
  const getAnimationType = useCallback((targetId: string): RollbackAnimationType | null => {
    const event = events.find((e) => e.targetId === targetId);
    return event?.type ?? null;
  }, [events]);
  
  return (
    <RollbackContext.Provider
      value={{
        events,
        triggerRollback,
        clearEvent,
        isRollingBack,
        getAnimationType,
      }}
    >
      {children}
      <RollbackToastContainer />
    </RollbackContext.Provider>
  );
}

// ============================================================================
// Rollback Toast Container
// ============================================================================

function RollbackToastContainer() {
  const { events, clearEvent } = useRollbackAnimation();
  const undoEvents = events.filter((e) => e.showUndo);
  
  return (
    <div className="fixed bottom-4 left-4 z-50 flex flex-col gap-2">
      <AnimatePresence mode="popLayout">
        {undoEvents.map((event) => (
          <UndoToast
            key={event.id}
            event={event}
            onDismiss={() => clearEvent(event.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Undo Toast Component
// ============================================================================

interface UndoToastProps {
  event: RollbackEvent;
  onDismiss: () => void;
}

function UndoToast({ event, onDismiss }: UndoToastProps) {
  const [timeRemaining, setTimeRemaining] = useState(event.undoTimeout || 5000);
  const prefersReducedMotion = useReducedMotion();
  
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 100) {
          clearInterval(interval);
          onDismiss();
          return 0;
        }
        return prev - 100;
      });
    }, 100);
    
    return () => clearInterval(interval);
  }, [onDismiss]);
  
  const handleUndo = () => {
    event.undoAction?.();
    onDismiss();
  };
  
  const progress = (timeRemaining / (event.undoTimeout || 5000)) * 100;
  
  return (
    <motion.div
      layout={!prefersReducedMotion}
      initial={{ opacity: 0, x: -20, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: -20, scale: 0.9 }}
      className={clsx(
        'relative overflow-hidden',
        'w-80 bg-gray-900 dark:bg-gray-800 rounded-xl shadow-xl',
        'border border-gray-700'
      )}
    >
      <div className="p-4 flex items-center gap-3">
        <div className="flex-shrink-0 p-2 rounded-lg bg-amber-500/20">
          <AlertCircle className="h-5 w-5 text-amber-400" />
        </div>
        
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">
            {event.message || 'Action failed'}
          </p>
          <p className="text-xs text-gray-400">
            Reverted to previous state
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {event.undoAction && (
            <button
              onClick={handleUndo}
              className={clsx(
                'px-3 py-1.5 text-sm font-medium rounded-lg',
                'text-amber-400 hover:text-amber-300',
                'bg-amber-500/20 hover:bg-amber-500/30',
                'transition-colors'
              )}
            >
              <Undo2 className="h-4 w-4" />
            </button>
          )}
          
          <button
            onClick={onDismiss}
            className="p-1 text-gray-400 hover:text-gray-200 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      
      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-700">
        <motion.div
          className="h-full bg-amber-500"
          initial={{ width: '100%' }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.1 }}
        />
      </div>
    </motion.div>
  );
}

// ============================================================================
// Animated Wrapper Component
// ============================================================================

interface RollbackAnimatedProps {
  /** Unique ID for this element (used to track rollback state) */
  targetId: string;
  /** Children to animate */
  children: ReactNode;
  /** Additional class name */
  className?: string;
  /** Override animation type */
  animationType?: RollbackAnimationType;
}

/**
 * Wrapper component that applies rollback animations to children
 * 
 * @example
 * <RollbackAnimated targetId={order.id}>
 *   <OrderCard order={order} />
 * </RollbackAnimated>
 */
export function RollbackAnimated({
  targetId,
  children,
  className,
  animationType: overrideType,
}: RollbackAnimatedProps) {
  const { isRollingBack, getAnimationType } = useRollbackAnimation();
  const prefersReducedMotion = useReducedMotion();
  
  const isActive = isRollingBack(targetId);
  const type = overrideType ?? getAnimationType(targetId);
  const variants = type ? rollbackAnimations[type] : undefined;
  
  if (prefersReducedMotion || !variants) {
    return <div className={className}>{children}</div>;
  }
  
  return (
    <motion.div
      className={className}
      initial="initial"
      animate={isActive ? 'animate' : 'initial'}
      exit="exit"
      variants={variants}
    >
      {children}
    </motion.div>
  );
}

// ============================================================================
// Hook for Triggering Rollback on Mutation Error
// ============================================================================

interface UseRollbackOnErrorOptions {
  targetId: string;
  type?: RollbackAnimationType;
  message?: string;
  showUndo?: boolean;
  undoAction?: () => void;
}

/**
 * Hook to trigger rollback animation when a mutation fails
 * 
 * @example
 * const { onError } = useRollbackOnError({
 *   targetId: order.id,
 *   type: 'shake',
 *   message: 'Failed to update order',
 * });
 * 
 * const mutation = useMutation({
 *   mutationFn: updateOrder,
 *   onError,
 * });
 */
export function useRollbackOnError(options: UseRollbackOnErrorOptions) {
  const { triggerRollback } = useRollbackAnimation();
  
  const onError = useCallback((error: Error) => {
    triggerRollback({
      targetId: options.targetId,
      type: options.type ?? 'shake',
      message: options.message ?? error.message,
      showUndo: options.showUndo,
      undoAction: options.undoAction,
    });
  }, [triggerRollback, options]);
  
  return { onError };
}

// ============================================================================
// Utility: Success Animation
// ============================================================================

interface UseSuccessAnimationReturn {
  triggerSuccess: (targetId: string, message?: string) => void;
}

/**
 * Hook for triggering success animations
 */
export function useSuccessAnimation(): UseSuccessAnimationReturn {
  const { triggerRollback } = useRollbackAnimation();
  
  const triggerSuccess = useCallback((targetId: string, message?: string) => {
    triggerRollback({
      targetId,
      type: 'bounce',
      message,
      showUndo: false,
    });
  }, [triggerRollback]);
  
  return { triggerSuccess };
}

// ============================================================================
// Pre-built Animation Components
// ============================================================================

interface AnimatedListItemProps {
  id: string;
  children: ReactNode;
  isOptimistic?: boolean;
  className?: string;
}

/**
 * List item wrapper with optimistic styling and rollback animation support
 */
export function AnimatedListItem({
  id,
  children,
  isOptimistic,
  className,
}: AnimatedListItemProps) {
  return (
    <RollbackAnimated targetId={id} className={className}>
      <div
        className={clsx(
          'transition-all duration-200',
          isOptimistic && 'opacity-70 border-dashed'
        )}
      >
        {children}
      </div>
    </RollbackAnimated>
  );
}

export default RollbackProvider;
