import { useRef, useState, useCallback } from 'react';
import clsx from 'clsx';

/**
 * Skip link configuration
 */
export interface SkipLink {
  /** Unique identifier */
  id: string;
  /** Display label for the link */
  label: string;
  /** Target element ID to skip to (without #) */
  targetId: string;
}

/**
 * Default skip links for ERP application
 */
export const DEFAULT_SKIP_LINKS: SkipLink[] = [
  { id: 'skip-to-main', label: 'Skip to main content', targetId: 'main-content' },
  { id: 'skip-to-nav', label: 'Skip to navigation', targetId: 'main-navigation' },
  { id: 'skip-to-search', label: 'Skip to search', targetId: 'global-search' },
];

interface SkipLinksProps {
  /** Custom skip links (defaults to DEFAULT_SKIP_LINKS) */
  links?: SkipLink[];
  /** Additional CSS classes */
  className?: string;
}

/**
 * SkipLinks component provides keyboard users with quick navigation
 * to important sections of the page.
 *
 * WAI-ARIA: These links are visually hidden until focused,
 * allowing keyboard users to bypass repetitive navigation.
 *
 * @example
 * ```tsx
 * // In Layout.tsx, add at the very top of the component:
 * <SkipLinks />
 * 
 * // Then add IDs to your main sections:
 * <main id="main-content">...</main>
 * <nav id="main-navigation">...</nav>
 * ```
 */
export function SkipLinks({ links = DEFAULT_SKIP_LINKS, className }: SkipLinksProps) {
  const handleClick = useCallback((targetId: string) => {
    const target = document.getElementById(targetId);
    if (target) {
      // Set tabindex temporarily to make it focusable
      const previousTabIndex = target.getAttribute('tabindex');
      target.setAttribute('tabindex', '-1');
      target.focus();
      
      // Restore original tabindex
      if (previousTabIndex === null) {
        target.removeAttribute('tabindex');
      } else {
        target.setAttribute('tabindex', previousTabIndex);
      }
      
      // Scroll into view
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  return (
    <nav
      aria-label="Skip links"
      className={clsx(
        'fixed top-0 left-0 z-[9999]',
        className
      )}
    >
      <ul className="list-none m-0 p-0">
        {links.map((link) => (
          <li key={link.id}>
            <a
              href={`#${link.targetId}`}
              onClick={(e) => {
                e.preventDefault();
                handleClick(link.targetId);
              }}
              className={clsx(
                // Visually hidden by default
                'absolute left-0 top-0 -translate-y-full',
                'px-4 py-2 bg-primary-600 text-white font-medium',
                'rounded-b-lg shadow-lg',
                'transition-transform duration-200',
                // Show on focus
                'focus:translate-y-0 focus:outline-none',
                'focus:ring-2 focus:ring-primary-300 focus:ring-offset-2'
              )}
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * Landmark wrapper for main content area
 * Provides proper ARIA landmark and skip link target
 */
interface MainContentProps {
  children: React.ReactNode;
  className?: string;
}

export function MainContent({ children, className }: MainContentProps) {
  return (
    <main
      id="main-content"
      role="main"
      aria-label="Main content"
      className={className}
      tabIndex={-1}
    >
      {children}
    </main>
  );
}

/**
 * Landmark wrapper for navigation
 * Provides proper ARIA landmark and skip link target
 */
interface NavigationLandmarkProps {
  children: React.ReactNode;
  className?: string;
  label?: string;
}

export function NavigationLandmark({
  children,
  className,
  label = 'Main navigation',
}: NavigationLandmarkProps) {
  return (
    <nav
      id="main-navigation"
      role="navigation"
      aria-label={label}
      className={className}
    >
      {children}
    </nav>
  );
}

/**
 * Wrapper for search areas that provides skip link target
 */
interface SearchLandmarkProps {
  children: React.ReactNode;
  className?: string;
  label?: string;
}

export function SearchLandmark({
  children,
  className,
  label = 'Search',
}: SearchLandmarkProps) {
  return (
    <search
      id="global-search"
      role="search"
      aria-label={label}
      className={className}
    >
      {children}
    </search>
  );
}

/**
 * Hook for announcing dynamic content changes to screen readers
 */
export function useAnnounce() {
  const announcerRef = useRef<HTMLDivElement | null>(null);

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    // Create announcer element if it doesn't exist
    if (!announcerRef.current) {
      const announcer = document.createElement('div');
      announcer.setAttribute('aria-live', priority);
      announcer.setAttribute('aria-atomic', 'true');
      announcer.setAttribute('role', priority === 'assertive' ? 'alert' : 'status');
      announcer.style.cssText = `
        position: absolute;
        left: -10000px;
        width: 1px;
        height: 1px;
        overflow: hidden;
      `;
      document.body.appendChild(announcer);
      announcerRef.current = announcer;
    }

    // Update the priority if needed
    announcerRef.current.setAttribute('aria-live', priority);
    announcerRef.current.setAttribute('role', priority === 'assertive' ? 'alert' : 'status');

    // Clear and set message (forces screen reader to announce)
    announcerRef.current.textContent = '';
    requestAnimationFrame(() => {
      if (announcerRef.current) {
        announcerRef.current.textContent = message;
      }
    });
  }, []);

  return { announce };
}

/**
 * Live region for announcing status messages
 */
interface LiveRegionProps {
  /** The message to announce */
  message: string;
  /** Priority of the announcement */
  priority?: 'polite' | 'assertive';
  /** Additional class name */
  className?: string;
}

export function LiveRegion({ message, priority = 'polite', className }: LiveRegionProps) {
  return (
    <div
      role={priority === 'assertive' ? 'alert' : 'status'}
      aria-live={priority}
      aria-atomic="true"
      className={clsx(
        // Visually hidden but accessible to screen readers
        'sr-only',
        className
      )}
    >
      {message}
    </div>
  );
}

/**
 * VisuallyHidden component for screen reader only content
 */
interface VisuallyHiddenProps {
  children: React.ReactNode;
  /** Render as a different element */
  as?: 'span' | 'div' | 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
}

export function VisuallyHidden({ children, as: Component = 'span' }: VisuallyHiddenProps) {
  return (
    <Component className="sr-only">
      {children}
    </Component>
  );
}
