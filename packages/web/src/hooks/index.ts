/**
 * Custom React Hooks for ERP Workflow
 * 
 * This module exports all custom hooks used throughout the application.
 * Hooks are organized by functionality for easy discovery.
 */

// ============================================================================
// Accessibility Hooks
// ============================================================================
export {
  useKeyboardNavigation,
  useGridNavigation,
  useRovingTabIndex,
  useMenuNavigation,
  type KeyboardNavigationOptions,
  type KeyboardNavigationReturn,
  type MenuNavigationOptions,
} from './useKeyboardNavigation';

export {
  useFocusTrap,
  useFocusOnMount,
  useRestoreFocus,
  useFocusLeave,
  useDialogFocus,
  getFocusableElements,
  FocusTrap,
  type FocusTrapOptions,
} from './useFocusTrap';

// ============================================================================
// Data Management Hooks
// ============================================================================
export { useSavedFilters, type OrderFilterState, type SavedFilter } from './useSavedFilters';

// ============================================================================
// Utility Hooks
// ============================================================================
export { useDebounce } from './useDebounce';

// ============================================================================
// Real-time Hooks
// ============================================================================
export { useWebSocket } from './useWebSocket';

// ============================================================================
// Error Handling Hooks
// ============================================================================
export {
  useErrorState,
  useOnlineStatus,
  useOfflineData,
  useCategorizedError,
  categorizeError,
  getErrorMessage,
  type ErrorState,
  type UseErrorStateOptions,
  type ErrorCategory,
} from './useErrorState';

export {
  useNetworkStatus,
  useRefetchOnReconnect,
  useSlowNetwork,
  useAdaptiveValue,
  useOfflineQueue,
  type NetworkStatus,
  type ConnectionType,
  type UseNetworkStatusOptions,
  type AdaptiveOptions,
  type QueuedAction,
} from './useNetworkStatus';

// ============================================================================
// Responsive / Mobile Hooks
// ============================================================================
export {
  BREAKPOINTS,
  useWindowSize,
  useMediaQuery,
  useBreakpoint,
  useBreakpointDown,
  useBreakpointBetween,
  useResponsiveValue,
  useTouchDetection,
  useOrientation,
  usePrefersReducedMotion,
  usePrefersDarkMode,
  useMobileSidebar,
  useViewportHeight,
  useDisableBodyScroll,
  useSafeAreaInsets,
  type Breakpoint,
} from './useResponsive';

// ============================================================================
// Theme / Dark Mode Hooks
// ============================================================================
export {
  useTheme,
  useThemeState,
  ThemeProvider,
  ThemeToggle,
  ThemeSelector,
  themeVariables,
  themeScript,
  type ThemeMode,
  type ThemeContextValue,
  type ThemeProviderProps,
  type ThemeToggleProps,
} from './useTheme';

// ============================================================================
// Notification Hooks
// ============================================================================
export {
  useNotifications,
  useToast,
  useNotificationPreferences,
  useUnreadCount,
  useCategoryNotifications,
} from './useNotifications';

export {
  usePushNotifications,
  isPushSupported,
  isPushPermissionGranted,
  getPushPermission,
  registerServiceWorker,
  subscribeToPush,
  unsubscribeFromPush,
  showLocalNotification,
  showServiceWorkerNotification,
  PushNotificationToggle,
} from './usePushNotifications';

// ============================================================================
// Optimistic UI Hooks
// ============================================================================
export {
  useOptimisticMutation,
  useOptimisticList,
  useOptimisticToggle,
  optimisticAdd,
  optimisticUpdate,
  optimisticDelete,
  optimisticReorder,
  markOptimistic,
  isOptimistic,
  type OptimisticMutationOptions,
  type OptimisticMutationResult,
  type UseOptimisticListOptions,
  type UseOptimisticListResult,
  type OptimisticContext,
} from './useOptimistic';

export {
  ConflictProvider,
  useConflictResolution,
  ConflictDialog,
  ConflictBanner,
  detectConflict,
  findConflictingFields,
  mergeConflictData,
  type Conflict,
  type ConflictField,
  type ConflictResolution,
  type ConflictResolutionStrategy,
} from './useConflictResolution';

export {
  RollbackProvider,
  useRollbackAnimation,
  useRollbackOnError,
  useSuccessAnimation,
  RollbackAnimated,
  AnimatedListItem,
  rollbackAnimations,
  type RollbackEvent,
  type RollbackAnimationType,
} from './useRollbackAnimation';

// ============================================================================
// Table Keyboard Navigation Hooks
// ============================================================================
export {
  KeyboardNavigationProvider,
  useKeyboardNavigation as useTableKeyboardNavigation,
  NavigableCell,
  useTableKeyboard,
  type CellPosition,
  type CellRange,
  type KeyboardNavigationState,
  type KeyboardNavigationOptions as TableKeyboardNavigationOptions,
  type UseTableKeyboardOptions,
} from './useTableKeyboard';

// ============================================================================
// Form Autosave & Draft Recovery
// ============================================================================
export {
  useAutosave,
  useAutosaveContext,
  AutosaveProvider,
  AutosaveStatus,
  DraftRecoveryDialog,
  ConflictDialog as AutosaveConflictDialog,
  useUnsavedChangesWarning,
  AutosaveField,
  type FormDraft,
  type AutosaveOptions,
  type AutosaveState,
  type AutosaveActions,
  type UseAutosaveReturn,
} from './useAutosave';

// ============================================================================
// Breadcrumb State Persistence - CRITICAL-05
// ============================================================================
export {
  useBreadcrumbPersistence,
  useBreadcrumbsWithPersistence,
  useBreadcrumbSuggestions,
  type NavigationHistoryEntry,
  type PathFrequency,
  type CustomLabel,
  type BreadcrumbPreferences,
  type BreadcrumbPersistenceState,
} from './useBreadcrumbPersistence';
