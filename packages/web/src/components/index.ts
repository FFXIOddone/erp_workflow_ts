// Layout
export { Layout } from './Layout';
export { PageHeader, PageSection } from './PageHeader';
export { Card, CardHeader, CardFooter, StatCard } from './Card';

// Feedback
export { ConfirmDialog } from './ConfirmDialog';
export { Spinner, LoadingOverlay, PageLoader, ButtonSpinner } from './Spinner';
export { ErrorBoundary, ErrorMessage } from './ErrorBoundary';
export { ToastContainer } from './Toast';
export { GlobalLoadingIndicator } from './GlobalLoadingIndicator';

// Data Display
export { Skeleton, TableRowSkeleton, CardSkeleton, StatCardSkeleton, DashboardSkeleton, OrderDetailSkeleton } from './Skeleton';
export { Badge, StatusBadge } from './Badge';
export { StatusDot, ConnectionStatus, OrderStatusIndicator } from './StatusIndicator';
export { DataTable, type Column } from './DataTable';
export { Pagination } from './Pagination';

// Navigation
export { Breadcrumbs, OrderBreadcrumbs, InventoryBreadcrumbs, type BreadcrumbItem } from './Breadcrumbs';

// Inputs
export { SearchInput, InlineSearch } from './SearchInput';
export { Tooltip } from './Tooltip';

// Empty States
export { EmptyState, NoOrdersFound, NoInventoryFound, NoResultsFound } from './EmptyState';

// ============================================================================
// ADVANCED TABLE SYSTEM - CRITICAL-03
// ============================================================================
export {
  // Main Component
  AdvancedTable,
  ColumnVisibilityToggle,
  // Types
  type ColumnDef,
  type CellProps,
  type HeaderCellProps,
  type EditorProps,
  type TableState,
  type AdvancedTableProps,
  type SortDirection,
  type PinPosition,
  type CellAlignment,
} from './AdvancedTable';

export {
  // Export Functions
  exportToCSV,
  exportToExcel,
  exportToPDF,
  exportToJSON,
  copyToClipboard,
  // Export Component
  ExportButton,
  // Export Hook
  useTableExport,
  // Types
  type ExportFormat,
  type ExportOptions,
  type ExportButtonProps,
} from './TableExport';

export {
  // Filter Functions
  applyFilters,
  // Filter Components
  TableFilters,
  // Filter Hook
  useTableFilters,
  // Date Presets
  datePresets,
  // Types
  type FilterOperator,
  type ColumnFilter,
  type FilterPreset,
  type FilterState,
  type TableFiltersProps,
} from './TableFilters';

// ============================================================================
// ENHANCED BREADCRUMB NAVIGATION - CRITICAL-05
// ============================================================================
export {
  // Main Component
  EnhancedBreadcrumbs,
  // Provider
  BreadcrumbProvider,
  // Hooks
  useBreadcrumbs,
  useRouteBreadcrumbs,
  useEntityBreadcrumbs,
  // Types
  type BreadcrumbItem as EnhancedBreadcrumbItem,
  type BreadcrumbConfig,
  type BreadcrumbContextValue,
} from './EnhancedBreadcrumbs';

export {
  // Quick Nav Components
  QuickNavProvider,
  QuickNavTrigger,
  // Hook
  useQuickNav,
  // Default Pages
  defaultERPPages,
  // Types
  type NavigationPage,
  type RecentPage,
  type PinnedPage,
  type QuickNavContextValue,
} from './BreadcrumbQuickNav';

// ============================================================================
// BULK ACTIONS SYSTEM - CRITICAL-06
// ============================================================================
export {
  // Provider
  BulkActionsProvider,
  // Hook
  useBulkActions,
  // Selection Components
  SelectionCheckbox,
  SelectAllCheckbox,
  // Floating Action Bar
  FloatingActionBar,
  // Action Creators
  createDeleteAction,
  createArchiveAction,
  createExportAction,
  createDuplicateAction,
  createEmailAction,
  // Keyboard Hook
  useBulkKeyboardShortcuts,
  // Types
  type SelectableItem,
  type BulkAction,
  type BulkActionResult,
  type BulkSelectionState,
  type BulkContextValue,
  type BulkProgress,
  type UndoEntry,
} from './BulkActions';

// ============================================================================
// REAL-TIME COLLABORATION INDICATORS - CRITICAL-07
// ============================================================================
export {
  // Provider
  CollaborationProvider,
  // Hook
  useCollaboration,
  // Components
  PresenceAvatars,
  TypingIndicatorDisplay,
  LockStatus,
  ConflictBanner,
  CollaborativeField,
  CollaborationStatusBar,
  // Utilities
  getUserColor,
  // Types
  type CollaboratorUser,
  type PresenceData,
  type EditLock,
  type TypingIndicator,
  type CollaborationState,
  type CollaborationContextValue,
} from './CollaborationIndicators';

// ============================================================================
// ENHANCED SEARCH WITH HISTORY & SUGGESTIONS - CRITICAL-08
// ============================================================================
export {
  // Provider
  EnhancedSearchProvider,
  // Hook
  useEnhancedSearch,
  useSearchHistory,
  // Components
  EnhancedSearchInput,
  // Utilities
  fuzzyMatch,
  fuzzySearch,
  // Types
  type SearchHistoryEntry,
  type SearchSuggestion,
  type SearchScope,
  type SearchConfig,
  type SearchContextValue,
} from './EnhancedSearch';

// ============================================================================
// PAGE TRANSITION ANIMATIONS - CRITICAL-09
// ============================================================================
export {
  // Provider
  PageTransitionProvider,
  // Hook
  usePageTransition,
  useTransitionPreset,
  // Components
  PageTransition,
  RouteTransition,
  StaggeredAnimation,
  AnimateOnScroll,
  SkeletonPulse,
  PageLoading,
  SharedLayout,
  ExpandableCard,
  Entrance,
  AnimatedListItem,
  // Types
  type TransitionType,
  type TransitionSpeed,
  type TransitionConfig,
  type PageTransitionContextValue,
} from './PageTransitions';

// ============================================================================
// TREE VIEW - CRITICAL-26
// ============================================================================
export {
  // Main Component
  TreeView,
  // Hook
  useTreeView,
  // Types
  type TreeNode,
  type TreeViewProps,
  type TreeContextValue,
} from './TreeView';

// ============================================================================
// CALENDAR - CRITICAL-27 (Module not found - commented out)
// ============================================================================
// export {
//   // Main Components
//   Calendar,
//   DatePicker,
//   MiniCalendar,
//   // Hook
//   useCalendar,
//   // Date Utilities
//   isSameDay,
//   addDays,
//   addMonths,
//   startOfMonth,
//   endOfMonth,
//   startOfWeek,
//   endOfWeek,
//   getDaysInMonth,
//   formatDate,
//   parseDate,
//   // Types
//   type CalendarEvent,
//   type CalendarView,
//   type CalendarProps,
//   type DatePickerProps,
// } from './Calendar';

// ============================================================================
// CAROUSEL - CRITICAL-28
// ============================================================================
export {
  // Main Component
  Carousel,
  CarouselSlide,
  ImageCarousel,
  ContentCarousel,
  // Hook
  useCarousel,
  // Types
  type CarouselProps,
  type CarouselContextValue,
} from './Carousel';

// ============================================================================
// STEPPER - CRITICAL-29
// ============================================================================
export {
  // Main Component
  Stepper,
  StepNavigation,
  StepProgress,
  SimpleStepper,
  TimelineStepper,
  // Hook
  useStepper,
  // Types
  type Step,
  type StepperProps,
  type StepperContextValue,
} from './Stepper';

// ============================================================================
// TIMELINE - CRITICAL-30
// ============================================================================
export {
  // Main Component
  Timeline,
  ActivityFeed,
  HistoryLog,
  // Hook
  useTimeline,
  // Utilities
  formatTimestamp,
  getRelativeTime,
  groupByDate,
  STATUS_STYLES,
  STATUS_ICONS,
  // Types
  type TimelineStatus,
  type TimelineLayout,
  type TimelineItem,
  type TimelineGroup,
  type TimelineProps,
  type TimelineContextValue,
  type TimelineItemProps,
  type ActivityItem,
  type ActivityFeedProps,
  type HistoryEntry,
  type HistoryLogProps,
} from './Timeline';

// ============================================================================
// COLOR PICKER - CRITICAL-31
// ============================================================================
export {
  // Main Component
  ColorPicker,
  ColorSwatch,
  ColorInput,
  ColorPickerTrigger,
  // Color Utilities
  hexToRgb,
  rgbToHex,
  rgbToHsl,
  hslToRgb,
  parseColor,
  isValidHex,
  getContrastColor,
  // Presets
  DEFAULT_PRESETS,
  GRAYSCALE_PRESETS,
  // Types
  type ColorValue,
  type ColorPreset,
  type ColorPickerProps,
  type ColorSwatchProps,
  type ColorInputProps,
  type ColorPickerTriggerProps,
} from './ColorPicker';

// ============================================================================
// RICH TEXT - CRITICAL-32
// ============================================================================
export {
  // Main Component
  RichTextEditor,
  FormattingToolbar,
  RichTextDisplay,
  MarkdownText,
  // MarkdownEditor is exported from MarkdownRenderer instead
  // Text Utilities
  wrapText,
  stripFormatting,
  htmlToText,
  textToHtml,
  sanitizeHtml,
  truncateHtml,
  markdownToHtml,
  htmlToMarkdown,
  // Constants
  DEFAULT_TOOLBAR_BUTTONS,
  BUTTON_GROUPS,
  // Types
  type TextFormat,
  type ToolbarButton,
  type FormattingToolbarProps,
  type RichTextEditorProps,
  type RichTextDisplayProps,
  type MarkdownTextProps,
} from './RichText';

// ============================================================================
// DATA GRID - CRITICAL-33
// ============================================================================
export {
  // Main Component
  DataGrid,
  // Cell Editors
  CellEditors,
  // Hook
  useDataGrid,
  // Types
  type GridColumn,
  type CellEditorProps,
  type GridSortState,
  type GridFilterState,
  type GridRowGroup,
  type DataGridProps,
} from './DataGrid';

// ============================================================================
// IMAGE GALLERY - CRITICAL-34
// ============================================================================
export {
  // Main Component
  ImageGallery,
  Lightbox,
  ThumbnailStrip,
  // Hook
  useImageGallery,
  // Types
  type GalleryImage,
  type ImageGalleryProps,
  type LightboxProps,
} from './ImageGallery';

// ============================================================================
// KANBAN BOARD - CRITICAL-35
// ============================================================================
export {
  // Main Component
  KanbanBoard,
  SimpleKanban,
  // Hook
  useKanban,
  // Types
  type KanbanCard,
  type KanbanColumn,
  type KanbanSwimlane,
  type KanbanBoardProps,
} from './Kanban';

// ============================================================================
// WIDGET DASHBOARD SYSTEM - CRITICAL-10
// ============================================================================
export {
  // Provider & Context
  DashboardProvider,
  useDashboard,
  // Layout Components
  DashboardGrid,
  WidgetLibrary,
  DashboardToolbar,
  // Sample Widgets
  StatsWidget,
  ChartWidget,
  ListWidget,
  // Defaults
  defaultWidgetDefinitions,
  // Types
  type WidgetSize,
  type WidgetPosition,
  type WidgetConfig,
  type WidgetDefinition,
  type WidgetComponentProps,
  type WidgetSettingsProps,
  type DashboardLayout,
  type DashboardContextValue,
} from './WidgetDashboard';
// ============================================================================
// SIGNATURE CAPTURE - CRITICAL-36
// ============================================================================
export {
  // Components
  SignaturePad,
  SignatureDisplay,
  SignatureModal,
  SignatureField,
  // Types
  type Point,
  type Stroke,
  type SignaturePadRef,
  type SignaturePadProps,
  type SignatureDisplayProps,
  type SignatureModalProps,
  type SignatureFieldProps,
} from './Signature';

// ============================================================================
// THREADED COMMENTS SYSTEM - CRITICAL-37
// ============================================================================
export {
  // Components
  CommentsList,
  CommentComposer,
  CommentCount,
  // Hook
  useComments,
  // Types
  type Comment,
  type CommentAuthor,
  type CommentReaction,
  type CommentsListProps,
  type CommentComposerProps,
} from './Comments';

// ============================================================================
// @MENTION SYSTEM - CRITICAL-38
// ============================================================================
export {
  // Components
  MentionInput,
  MentionDisplay,
  MentionChip,
  MentionSuggestionsProvider,
  // Utilities
  parseMentions,
  formatMention,
  mentionsToPlainText,
  extractMentionIds,
  // Types
  type MentionableEntity,
  type Mention,
  type MentionTrigger,
  type MentionInputProps,
  type MentionDisplayProps,
} from './Mention';

// ============================================================================
// FILE PREVIEW SYSTEM - CRITICAL-39
// ============================================================================
export {
  // Components
  FilePreview,
  ImagePreview,
  VideoPreview,
  AudioPreview,
  PdfPreview,
  FileThumbnail,
  FileListItem,
  FilePreviewModal,
  // Utilities
  getFileCategory,
  getFileIcon,
  formatFileSize,
  formatDuration,
  // Types
  type FileCategory,
  type FileInfo,
  type FilePreviewProps,
  type ImagePreviewProps,
  type VideoPreviewProps,
} from './FilePreview';

// ============================================================================
// MARKDOWN RENDERER - CRITICAL-40
// ============================================================================
export {
  // Components
  MarkdownRenderer,
  MarkdownEditor,
  TableOfContents,
  InlineMarkdown,
  // Utilities
  parseMarkdown,
  highlightCode,
  extractToc,
  // Styles
  markdownStyles,
  // Types
  type MarkdownRendererProps,
  type MarkdownEditorProps,
  type MarkdownRenderers,
  type TocItem,
} from './MarkdownRenderer';

// ============================================================================
// CRON EXPRESSION BUILDER - CRITICAL-41
// ============================================================================
export {
  // Components
  CronBuilder,
  CronDisplay,
  // Utilities
  parseCron,
  buildCron,
  validateCron,
  describeCron,
  getNextRuns,
  // Types
  type CronField,
  type CronExpression,
  type CronBuilderProps,
  type CronPreset,
} from './CronBuilder';

// ============================================================================
// TAG/CHIP INPUT - CRITICAL-42
// ============================================================================
export {
  // Components
  TagInput,
  Tag,
  TagGroup,
  TagSelector,
  ColoredTagInput,
  // Types
  type TagItem,
  type TagInputProps,
  type TagProps,
} from './TagInput';

// ============================================================================
// NUMERIC INPUT COMPONENTS - CRITICAL-43
// ============================================================================
export {
  // Components
  NumberInput,
  CurrencyInput,
  PercentageInput,
  RangeInput,
  QuantityInput,
  NumberDisplay,
  // Utilities
  formatNumber,
  parseNumber,
  clamp,
  // Types
  type NumberInputBaseProps,
  type NumberInputProps,
  type CurrencyInputProps,
  type PercentageInputProps,
  type QuantityInputProps,
} from './NumberInput';

// ============================================================================
// PHONE INPUT - CRITICAL-44
// ============================================================================
export {
  // Components
  PhoneInput,
  PhoneDisplay,
  PhoneLink,
  // Utilities
  formatPhone,
  parsePhone,
  validatePhoneLength,
  toE164,
  formatPhoneDisplay,
  // Data
  COUNTRIES,
  getCountry,
  getCountryByDialCode,
  // Types
  type Country,
  type PhoneValue,
  type PhoneInputProps,
  type PhoneDisplayProps,
} from './PhoneInput';

// ============================================================================
// ADDRESS INPUT - CRITICAL-45
// ============================================================================
export {
  // Components
  AddressInput,
  AddressDisplay,
  AddressCard,
  // Utilities
  formatAddress,
  getGoogleMapsUrl,
  validateAddress,
  // Data
  COUNTRIES as ADDRESS_COUNTRIES,
  getCountryData,
  EMPTY_ADDRESS,
  // Types
  type AddressValue,
  type AddressInputProps,
  type AddressDisplayProps,
  type CountryData,
} from './AddressInput';

// ============================================================================
// RATING COMPONENTS - CRITICAL-46
// ============================================================================
export {
  // Components
  StarRating,
  HeartRating,
  ThumbsRating,
  EmojiRating,
  YesNoRating,
  NPSRating,
  RatingDistributionBar,
  RatingSummary,
  ReviewCard,
  TrendIndicator,
  // Hook
  useRating,
  // Types
  type RatingSize,
  type RatingColor,
  type RatingValue,
  type Review,
  type RatingDistribution,
  type RatingStats,
  type StarRatingProps,
  type HeartRatingProps,
  type ThumbsValue,
  type ThumbsRatingProps,
  type EmojiValue,
  type EmojiRatingProps,
  type YesNoValue,
  type YesNoRatingProps,
  type NPSRatingProps,
  type RatingDistributionBarProps,
  type RatingSummaryProps,
  type ReviewCardProps,
  type TrendIndicatorProps,
  type UseRatingOptions,
  type UseRatingReturn,
} from './Rating';

// ============================================================================
// VIRTUAL LIST COMPONENTS - CRITICAL-47
// ============================================================================
export {
  // Hook
  useVirtualList,
  useVirtualListContext,
  // Components
  VirtualList,
  VirtualGrid,
  VirtualTable,
  WindowedList,
  // Types
  type VirtualItem,
  type VirtualRange,
  type VirtualListState,
  type UseVirtualListOptions,
  type UseVirtualListReturn,
  type VirtualListProps,
  type VirtualGridProps,
  type VirtualTableProps,
  type WindowedListProps,
} from './VirtualList';

// ============================================================================
// TOUR & ONBOARDING COMPONENTS - CRITICAL-48
// ============================================================================
export {
  // Provider
  TourProvider,
  // Hook
  useTour,
  // Components
  TourTrigger,
  Hotspot,
  FeatureHighlight,
  OnboardingChecklist,
  // Types
  type TourStep,
  type TourPlacement,
  type TourConfig,
  type TourState,
  type HotspotProps,
  type FeatureHighlightProps,
  type OnboardingChecklistProps,
  type OnboardingTask,
} from './Tour';

// ============================================================================
// COUNTDOWN COMPONENTS - CRITICAL-49
// ============================================================================
export {
  // Hook
  useCountdown,
  useCountdownContext,
  // Components
  Countdown,
  CountdownTimer,
  Stopwatch,
  DeadlineDisplay,
  DurationDisplay,
  // Utilities
  formatTime,
  parseTimeString,
  // Types
  type CountdownVariant,
  type CountdownSize,
  type UseCountdownOptions,
  type UseCountdownReturn,
  type TimeComponents,
  type CountdownProps,
  type CountdownTimerProps,
  type StopwatchProps,
  type DeadlineDisplayProps,
  type DurationDisplayProps,
} from './Countdown';

// ============================================================================
// MASONRY LAYOUT COMPONENTS - CRITICAL-50
// ============================================================================
export {
  // Hook
  useMasonry,
  // Components
  Masonry,
  MasonryGrid,
  MasonryColumns,
  ResponsiveMasonry,
  ImageMasonry,
  // Types
  type MasonryItem,
  type UseMasonryOptions,
  type UseMasonryReturn,
  type MasonryProps,
  type MasonryGridProps,
  type ResponsiveMasonryProps,
  type ImageMasonryProps,
  type ImageItem,
} from './Masonry';

// ============================================================================
// INFINITE SCROLL & PAGINATION - CRITICAL-51
// ============================================================================
export {
  // Hooks
  useInfiniteScroll,
  usePagination,
  // Components
  InfiniteScroll,
  Pagination as AdvancedPagination,
  LoadMoreButton,
  // Types
  type UseInfiniteScrollOptions,
  type InfiniteScrollState,
  type InfiniteScrollProps,
  type UsePaginationOptions,
  type PaginationState,
  type PaginationProps as AdvancedPaginationProps,
  type LoadMoreButtonProps,
} from './InfiniteScroll';

// ============================================================================
// CONFETTI & CELEBRATION ANIMATIONS - CRITICAL-52
// ============================================================================
export {
  // Provider
  ConfettiProvider,
  // Hook
  useConfetti,
  useConfettiOnMount,
  useConfettiOnSuccess,
  // Components
  ConfettiButton,
  Sparkle,
  CelebrationBanner,
  SuccessAnimation,
  // Types
  type ConfettiPreset,
  type ConfettiConfig,
  type ConfettiProviderProps,
  type ConfettiButtonProps,
  type SparkleProps,
  type CelebrationBannerProps,
  type SuccessAnimationProps,
} from './Confetti';

// ============================================================================
// SPOTLIGHT & HIGHLIGHT COMPONENTS - CRITICAL-53
// ============================================================================
export {
  // Provider
  SpotlightProvider,
  // Hook
  useSpotlight,
  useSpotlightElement,
  // Components
  SpotlightTrigger,
  Highlight,
  Beacon,
  FeatureCallout,
  NewBadge,
  // Types
  type SpotlightShape,
  type SpotlightPlacement,
  type SpotlightTarget,
  type SpotlightConfig,
  type SpotlightProviderProps,
  type SpotlightTriggerProps,
  type HighlightProps,
  type BeaconProps,
  type FeatureCalloutProps,
  type NewBadgeProps,
} from './Spotlight';

// ============================================================================
// FLOATING ACTION BUTTON COMPONENTS - CRITICAL-54
// ============================================================================
export {
  // Components
  FAB,
  SpeedDial,
  ScrollToTop,
  SupportFAB,
  BottomBar,
  FloatingPanel,
  // Hook
  useFABVisibility,
  // Types
  type FABSize,
  type FABPosition,
  type FABVariant,
  type SpeedDialDirection,
  type SpeedDialAction,
  type FABProps,
  type SpeedDialProps,
  type ScrollToTopProps,
  type SupportFABProps,
  type BottomBarAction,
  type BottomBarProps,
  type FloatingPanelProps,
  type FABVisibilityOptions,
} from './FloatingActions';

// ============================================================================
// WATERMARK & CONTENT PROTECTION - CRITICAL-55
// ============================================================================
export {
  // Provider
  WatermarkProvider,
  // Hook
  useWatermark,
  useWatermarkGenerator,
  // Components
  Watermark,
  UserWatermark,
  ProtectedImage,
  ConfidentialBadge,
  AntiScreenshot,
  CopyProtection,
  BrandedWatermark,
  // Types
  type WatermarkType,
  type WatermarkPosition,
  type WatermarkConfig,
  type WatermarkProviderProps,
  type WatermarkProps,
  type UserWatermarkProps,
  type ProtectedImageProps,
  type ConfidentialBadgeProps,
  type AntiScreenshotProps,
  type CopyProtectionProps,
  type BrandedWatermarkProps,
} from './Watermark';
