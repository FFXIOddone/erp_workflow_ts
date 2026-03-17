import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Menu, X, ChevronLeft, ArrowLeft } from 'lucide-react';
import { useWindowSize, useDisableBodyScroll, useViewportHeight } from '../hooks/useResponsive';

// ============================================================================
// Responsive Container Component
// ============================================================================

export interface ResponsiveContainerProps {
  children: React.ReactNode;
  /** Maximum width constraint */
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full' | 'none';
  /** Horizontal padding */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
  /** Use full height on mobile */
  fullHeight?: boolean;
}

const maxWidthClasses = {
  sm: 'max-w-screen-sm',
  md: 'max-w-screen-md',
  lg: 'max-w-screen-lg',
  xl: 'max-w-screen-xl',
  '2xl': 'max-w-screen-2xl',
  full: 'max-w-full',
  none: '',
};

const paddingClasses = {
  none: 'px-0',
  sm: 'px-2 sm:px-4',
  md: 'px-4 sm:px-6 lg:px-8',
  lg: 'px-4 sm:px-8 lg:px-12',
};

/**
 * Responsive container with proper padding and max-width constraints
 */
export function ResponsiveContainer({
  children,
  maxWidth = 'xl',
  padding = 'md',
  className = '',
  fullHeight = false,
}: ResponsiveContainerProps) {
  useViewportHeight();

  return (
    <div
      className={`
        mx-auto w-full
        ${maxWidthClasses[maxWidth]}
        ${paddingClasses[padding]}
        ${fullHeight ? 'min-h-[calc(var(--vh,1vh)*100)]' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

// ============================================================================
// Mobile Sidebar / Drawer
// ============================================================================

export interface MobileSidebarProps {
  children: React.ReactNode;
  /** Whether the sidebar is open */
  isOpen: boolean;
  /** Called when sidebar should close */
  onClose: () => void;
  /** Sidebar title */
  title?: string;
  /** Position of the sidebar */
  position?: 'left' | 'right';
  /** Width of the sidebar */
  width?: 'sm' | 'md' | 'lg' | 'full';
}

const widthClasses = {
  sm: 'w-64',
  md: 'w-80',
  lg: 'w-96',
  full: 'w-full',
};

/**
 * Mobile-optimized sidebar/drawer component
 */
export function MobileSidebar({
  children,
  isOpen,
  onClose,
  title,
  position = 'left',
  width = 'md',
}: MobileSidebarProps) {
  useDisableBodyScroll(isOpen);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`
          fixed inset-0 z-40 bg-black/50 backdrop-blur-sm
          transition-opacity duration-300
          ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        `}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <div
        className={`
          fixed top-0 bottom-0 z-50 bg-white dark:bg-gray-900
          shadow-xl flex flex-col
          transition-transform duration-300 ease-out
          ${widthClasses[width]}
          ${position === 'left' ? 'left-0' : 'right-0'}
          ${position === 'left'
            ? isOpen ? 'translate-x-0' : '-translate-x-full'
            : isOpen ? 'translate-x-0' : 'translate-x-full'
          }
        `}
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Sidebar'}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          {title && (
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {title}
            </h2>
          )}
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800
                       focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {children}
        </div>
      </div>
    </>
  );
}

// ============================================================================
// Mobile Header / Navigation
// ============================================================================

export interface MobileHeaderProps {
  /** Left content (usually menu button) */
  leftContent?: React.ReactNode;
  /** Title */
  title?: string;
  /** Right content (usually action buttons) */
  rightContent?: React.ReactNode;
  /** Whether to show back button instead of menu */
  showBackButton?: boolean;
  /** Back button handler */
  onBack?: () => void;
  /** Whether the header is sticky */
  sticky?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Mobile-optimized header component
 */
export function MobileHeader({
  leftContent,
  title,
  rightContent,
  showBackButton = false,
  onBack,
  sticky = true,
  className = '',
}: MobileHeaderProps) {
  return (
    <header
      className={`
        flex items-center gap-2 p-4 bg-white dark:bg-gray-900
        border-b border-gray-200 dark:border-gray-700
        ${sticky ? 'sticky top-0 z-30' : ''}
        ${className}
      `}
    >
      {/* Left */}
      <div className="flex-shrink-0">
        {showBackButton && onBack ? (
          <button
            onClick={onBack}
            className="p-2 -ml-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        ) : (
          leftContent
        )}
      </div>

      {/* Title */}
      {title && (
        <h1 className="flex-1 text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
          {title}
        </h1>
      )}

      {/* Right */}
      <div className="flex-shrink-0 flex items-center gap-2">
        {rightContent}
      </div>
    </header>
  );
}

// ============================================================================
// Mobile Bottom Navigation
// ============================================================================

export interface BottomNavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  href?: string;
  onClick?: () => void;
  badge?: number | string;
}

export interface MobileBottomNavProps {
  items: BottomNavItem[];
  activeItem?: string;
  onItemClick?: (item: BottomNavItem) => void;
}

/**
 * Mobile bottom navigation bar
 */
export function MobileBottomNav({
  items,
  activeItem,
  onItemClick,
}: MobileBottomNavProps) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-900
                 border-t border-gray-200 dark:border-gray-700
                 safe-area-bottom"
      aria-label="Bottom navigation"
    >
      <div className="flex items-center justify-around h-16">
        {items.map((item) => {
          const isActive = activeItem === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                item.onClick?.();
                onItemClick?.(item);
              }}
              className={`
                flex flex-col items-center justify-center flex-1 h-full gap-1
                transition-colors
                ${isActive
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 dark:text-gray-400'
                }
              `}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="relative">
                {item.icon}
                {item.badge !== undefined && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1
                                   flex items-center justify-center
                                   bg-red-500 text-white text-xs font-bold rounded-full">
                    {item.badge}
                  </span>
                )}
              </span>
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// ============================================================================
// Responsive Stack
// ============================================================================

export interface ResponsiveStackProps {
  children: React.ReactNode;
  /** Gap between items */
  gap?: 'none' | 'sm' | 'md' | 'lg';
  /** Direction - stacks vertically on mobile, optionally horizontal on larger screens */
  direction?: 'vertical' | 'horizontal' | 'responsive';
  /** Additional CSS classes */
  className?: string;
}

const gapClasses = {
  none: 'gap-0',
  sm: 'gap-2',
  md: 'gap-4',
  lg: 'gap-6',
};

/**
 * Responsive stack component that changes direction based on viewport
 */
export function ResponsiveStack({
  children,
  gap = 'md',
  direction = 'responsive',
  className = '',
}: ResponsiveStackProps) {
  const directionClasses = {
    vertical: 'flex-col',
    horizontal: 'flex-row',
    responsive: 'flex-col md:flex-row',
  };

  return (
    <div className={`flex ${directionClasses[direction]} ${gapClasses[gap]} ${className}`}>
      {children}
    </div>
  );
}

// ============================================================================
// Show/Hide Components
// ============================================================================

export interface ResponsiveShowProps {
  children: React.ReactNode;
  /** Show on these breakpoints and above */
  above?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  /** Show on these breakpoints and below */
  below?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  /** Additional CSS classes */
  className?: string;
}

/**
 * Show content only on certain breakpoints
 */
export function ResponsiveShow({
  children,
  above,
  below,
  className = '',
}: ResponsiveShowProps) {
  const aboveClasses: Record<string, string> = {
    sm: 'hidden sm:block',
    md: 'hidden md:block',
    lg: 'hidden lg:block',
    xl: 'hidden xl:block',
    '2xl': 'hidden 2xl:block',
  };

  const belowClasses: Record<string, string> = {
    sm: 'sm:hidden',
    md: 'md:hidden',
    lg: 'lg:hidden',
    xl: 'xl:hidden',
    '2xl': '2xl:hidden',
  };

  let displayClass = '';
  if (above) displayClass = aboveClasses[above];
  if (below) displayClass = belowClasses[below];

  return <div className={`${displayClass} ${className}`}>{children}</div>;
}

// ============================================================================
// Touch-Friendly Button
// ============================================================================

export interface TouchButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button variant */
  variant?: 'primary' | 'secondary' | 'ghost';
  /** Size - mobile has larger touch targets */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show full width on mobile */
  fullWidthMobile?: boolean;
  /** Icon before text */
  icon?: React.ReactNode;
}

/**
 * Touch-optimized button with proper touch targets (44px minimum)
 */
export function TouchButton({
  children,
  variant = 'primary',
  size = 'md',
  fullWidthMobile = false,
  icon,
  className = '',
  ...props
}: TouchButtonProps) {
  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800',
    secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300 dark:bg-gray-800 dark:text-gray-200',
    ghost: 'bg-transparent text-gray-600 hover:bg-gray-100 active:bg-gray-200 dark:text-gray-300',
  };

  // Sizes ensure minimum 44px touch target on mobile
  const sizeClasses = {
    sm: 'min-h-[44px] sm:min-h-[36px] px-3 py-2 text-sm',
    md: 'min-h-[48px] sm:min-h-[40px] px-4 py-2.5 text-base',
    lg: 'min-h-[52px] sm:min-h-[44px] px-6 py-3 text-lg',
  };

  return (
    <button
      className={`
        inline-flex items-center justify-center gap-2
        font-medium rounded-lg
        transition-colors duration-150
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${fullWidthMobile ? 'w-full sm:w-auto' : ''}
        ${className}
      `}
      {...props}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </button>
  );
}

// ============================================================================
// Pull to Refresh (mobile)
// ============================================================================

export interface PullToRefreshProps {
  children: React.ReactNode;
  onRefresh: () => Promise<void>;
  disabled?: boolean;
}

/**
 * Pull-to-refresh container for mobile
 */
export function PullToRefresh({ children, onRefresh, disabled = false }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const threshold = 80;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled || window.scrollY > 0) return;
    const touch = e.touches[0];
    (e.currentTarget as HTMLElement).dataset.startY = String(touch.clientY);
  }, [disabled]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (disabled || isRefreshing) return;
    const startY = Number((e.currentTarget as HTMLElement).dataset.startY);
    if (!startY || window.scrollY > 0) return;

    const currentY = e.touches[0].clientY;
    const distance = Math.max(0, (currentY - startY) * 0.5);
    setPullDistance(Math.min(distance, threshold * 1.5));
  }, [disabled, isRefreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }
    setPullDistance(0);
  }, [pullDistance, isRefreshing, onRefresh]);

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ transform: `translateY(${pullDistance}px)` }}
      className="transition-transform duration-200"
    >
      {/* Refresh indicator */}
      <div
        className={`
          absolute left-1/2 -translate-x-1/2 -top-10
          w-8 h-8 flex items-center justify-center
          rounded-full bg-white shadow-lg
          transition-all duration-200
          ${pullDistance > 0 ? 'opacity-100' : 'opacity-0'}
        `}
        style={{ transform: `translateY(${pullDistance}px) rotate(${pullDistance * 3}deg)` }}
      >
        <svg
          className={`w-5 h-5 text-blue-600 ${isRefreshing ? 'animate-spin' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </div>

      {children}
    </div>
  );
}

// ============================================================================
// Mobile Layout Context
// ============================================================================

interface MobileLayoutContextValue {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  sidebarOpen: boolean;
  openSidebar: () => void;
  closeSidebar: () => void;
  toggleSidebar: () => void;
}

const MobileLayoutContext = createContext<MobileLayoutContextValue | null>(null);

export function useMobileLayout() {
  const context = useContext(MobileLayoutContext);
  if (!context) {
    throw new Error('useMobileLayout must be used within a MobileLayoutProvider');
  }
  return context;
}

export interface MobileLayoutProviderProps {
  children: React.ReactNode;
}

export function MobileLayoutProvider({ children }: MobileLayoutProviderProps) {
  const { isMobile, isTablet, isDesktop } = useWindowSize();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar when switching to desktop
  useEffect(() => {
    if (isDesktop) setSidebarOpen(false);
  }, [isDesktop]);

  const openSidebar = useCallback(() => setSidebarOpen(true), []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const toggleSidebar = useCallback(() => setSidebarOpen((prev) => !prev), []);

  return (
    <MobileLayoutContext.Provider
      value={{
        isMobile,
        isTablet,
        isDesktop,
        sidebarOpen,
        openSidebar,
        closeSidebar,
        toggleSidebar,
      }}
    >
      {children}
    </MobileLayoutContext.Provider>
  );
}

// ============================================================================
// Hamburger Menu Button
// ============================================================================

export interface HamburgerButtonProps {
  isOpen?: boolean;
  onClick: () => void;
  className?: string;
}

export function HamburgerButton({ isOpen = false, onClick, className = '' }: HamburgerButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        p-2 rounded-lg text-gray-500 
        hover:bg-gray-100 dark:hover:bg-gray-800
        focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
        ${className}
      `}
      aria-label={isOpen ? 'Close menu' : 'Open menu'}
      aria-expanded={isOpen}
    >
      {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
    </button>
  );
}
