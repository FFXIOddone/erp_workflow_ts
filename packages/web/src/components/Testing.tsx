/**
 * Testing.tsx - CRITICAL-17
 * 
 * Comprehensive testing utilities for the ERP system.
 * Provides mock providers, render wrappers, accessibility testing helpers,
 * and component testing utilities for reliable, fast tests.
 * 
 * Features:
 * - 17.1: Mock providers (QueryClient, Theme, Auth, Router)
 * - 17.2: Custom render wrapper with all providers
 * - 17.3: Accessibility testing helpers
 * - 17.4: Event simulation utilities
 * - 17.5: Snapshot and visual regression helpers
 * 
 * @module Testing
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
  type ReactElement,
  type ComponentType,
} from 'react';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/** User mock for auth testing */
export interface MockUser {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'MANAGER' | 'OPERATOR' | 'VIEWER';
  avatarUrl?: string;
}

/** Auth context mock value */
export interface MockAuthContextValue {
  user: MockUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (user: MockUser | null) => void;
}

/** Theme mock value */
export interface MockThemeContextValue {
  theme: 'light' | 'dark' | 'system';
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

/** Router mock value */
export interface MockRouterContextValue {
  pathname: string;
  query: Record<string, string>;
  params: Record<string, string>;
  push: (path: string) => void;
  replace: (path: string) => void;
  back: () => void;
  forward: () => void;
}

/** Test wrapper options */
export interface TestWrapperOptions {
  /** Initial route path */
  initialPath?: string;
  /** Initial query parameters */
  initialQuery?: Record<string, string>;
  /** Initial route params */
  initialParams?: Record<string, string>;
  /** Mock authenticated user */
  user?: MockUser | null;
  /** Initial theme */
  theme?: 'light' | 'dark' | 'system';
  /** Additional providers to wrap */
  additionalProviders?: ComponentType<{ children: ReactNode }>[];
}

/** Render result type */
export interface RenderResult {
  container: HTMLElement;
  rerender: (ui: ReactElement) => void;
  unmount: () => void;
  /** Debug helper - prints current DOM */
  debug: () => void;
  /** Find element by test ID */
  getByTestId: (testId: string) => HTMLElement;
  /** Query element by test ID (returns null if not found) */
  queryByTestId: (testId: string) => HTMLElement | null;
  /** Find all elements by test ID */
  getAllByTestId: (testId: string) => HTMLElement[];
  /** Find element by role */
  getByRole: (role: string, options?: { name?: string | RegExp }) => HTMLElement;
  /** Query element by role */
  queryByRole: (role: string, options?: { name?: string | RegExp }) => HTMLElement | null;
  /** Find element by text content */
  getByText: (text: string | RegExp) => HTMLElement;
  /** Query element by text */
  queryByText: (text: string | RegExp) => HTMLElement | null;
  /** Find element by label text */
  getByLabelText: (text: string | RegExp) => HTMLElement;
  /** Find element by placeholder */
  getByPlaceholderText: (text: string | RegExp) => HTMLElement;
}

/** Accessibility test result */
export interface A11yTestResult {
  passed: boolean;
  violations: A11yViolation[];
  warnings: A11yWarning[];
}

/** Accessibility violation */
export interface A11yViolation {
  id: string;
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
  description: string;
  element: HTMLElement;
  help: string;
}

/** Accessibility warning */
export interface A11yWarning {
  id: string;
  description: string;
  element: HTMLElement;
  suggestion: string;
}

/** Event simulation options */
export interface SimulateEventOptions {
  bubbles?: boolean;
  cancelable?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
}

// ============================================================================
// 17.1: MOCK PROVIDERS
// ============================================================================

// Mock Auth Context
const MockAuthContext = createContext<MockAuthContextValue | null>(null);

/** Default mock user for testing */
export const DEFAULT_MOCK_USER: MockUser = {
  id: 'test-user-1',
  email: 'test@example.com',
  name: 'Test User',
  role: 'ADMIN',
};

/** Props for MockAuthProvider */
export interface MockAuthProviderProps {
  children: ReactNode;
  /** Initial user state */
  user?: MockUser | null;
  /** Initial loading state */
  isLoading?: boolean;
}

/**
 * Mock authentication provider for testing
 * 
 * @example
 * ```tsx
 * <MockAuthProvider user={mockUser}>
 *   <ComponentUnderTest />
 * </MockAuthProvider>
 * ```
 */
export function MockAuthProvider({
  children,
  user: initialUser = null,
  isLoading: initialLoading = false,
}: MockAuthProviderProps) {
  const [user, setUser] = useState<MockUser | null>(initialUser);
  const [isLoading, setIsLoading] = useState(initialLoading);

  const login = useCallback(async (_email: string, _password: string) => {
    setIsLoading(true);
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 100));
    setUser(DEFAULT_MOCK_USER);
    setIsLoading(false);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  const value = useMemo<MockAuthContextValue>(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      logout,
      setUser,
    }),
    [user, isLoading, login, logout]
  );

  return (
    <MockAuthContext.Provider value={value}>
      {children}
    </MockAuthContext.Provider>
  );
}

/**
 * Hook to access mock auth context in tests
 */
export function useMockAuth(): MockAuthContextValue {
  const context = useContext(MockAuthContext);
  if (!context) {
    throw new Error('useMockAuth must be used within MockAuthProvider');
  }
  return context;
}

// Mock Theme Context
const MockThemeContext = createContext<MockThemeContextValue | null>(null);

/** Props for MockThemeProvider */
export interface MockThemeProviderProps {
  children: ReactNode;
  /** Initial theme */
  theme?: 'light' | 'dark' | 'system';
}

/**
 * Mock theme provider for testing
 * 
 * @example
 * ```tsx
 * <MockThemeProvider theme="dark">
 *   <ComponentUnderTest />
 * </MockThemeProvider>
 * ```
 */
export function MockThemeProvider({
  children,
  theme: initialTheme = 'light',
}: MockThemeProviderProps) {
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(initialTheme);

  const resolvedTheme = useMemo<'light' | 'dark'>(() => {
    if (theme === 'system') {
      // In tests, default to light for system
      return 'light';
    }
    return theme;
  }, [theme]);

  const value = useMemo<MockThemeContextValue>(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
    }),
    [theme, resolvedTheme]
  );

  return (
    <MockThemeContext.Provider value={value}>
      <div data-theme={resolvedTheme}>{children}</div>
    </MockThemeContext.Provider>
  );
}

/**
 * Hook to access mock theme context in tests
 */
export function useMockTheme(): MockThemeContextValue {
  const context = useContext(MockThemeContext);
  if (!context) {
    throw new Error('useMockTheme must be used within MockThemeProvider');
  }
  return context;
}

// Mock Router Context
const MockRouterContext = createContext<MockRouterContextValue | null>(null);

/** Props for MockRouterProvider */
export interface MockRouterProviderProps {
  children: ReactNode;
  /** Initial pathname */
  pathname?: string;
  /** Initial query params */
  query?: Record<string, string>;
  /** Initial route params */
  params?: Record<string, string>;
}

/**
 * Mock router provider for testing navigation
 * 
 * @example
 * ```tsx
 * <MockRouterProvider pathname="/orders/123" params={{ id: '123' }}>
 *   <ComponentUnderTest />
 * </MockRouterProvider>
 * ```
 */
export function MockRouterProvider({
  children,
  pathname: initialPathname = '/',
  query: initialQuery = {},
  params: initialParams = {},
}: MockRouterProviderProps) {
  const [pathname, setPathname] = useState(initialPathname);
  const [query, setQuery] = useState(initialQuery);
  const [params] = useState(initialParams);
  const [history, setHistory] = useState<string[]>([initialPathname]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const push = useCallback((path: string) => {
    const url = new URL(path, 'http://localhost');
    setPathname(url.pathname);
    setQuery(Object.fromEntries(url.searchParams));
    setHistory((prev) => [...prev.slice(0, historyIndex + 1), path]);
    setHistoryIndex((i) => i + 1);
  }, [historyIndex]);

  const replace = useCallback((path: string) => {
    const url = new URL(path, 'http://localhost');
    setPathname(url.pathname);
    setQuery(Object.fromEntries(url.searchParams));
    setHistory((prev) => {
      const newHistory = [...prev];
      newHistory[historyIndex] = path;
      return newHistory;
    });
  }, [historyIndex]);

  const back = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      const path = history[newIndex];
      const url = new URL(path, 'http://localhost');
      setPathname(url.pathname);
      setQuery(Object.fromEntries(url.searchParams));
      setHistoryIndex(newIndex);
    }
  }, [history, historyIndex]);

  const forward = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      const path = history[newIndex];
      const url = new URL(path, 'http://localhost');
      setPathname(url.pathname);
      setQuery(Object.fromEntries(url.searchParams));
      setHistoryIndex(newIndex);
    }
  }, [history, historyIndex]);

  const value = useMemo<MockRouterContextValue>(
    () => ({
      pathname,
      query,
      params,
      push,
      replace,
      back,
      forward,
    }),
    [pathname, query, params, push, replace, back, forward]
  );

  return (
    <MockRouterContext.Provider value={value}>
      {children}
    </MockRouterContext.Provider>
  );
}

/**
 * Hook to access mock router context in tests
 */
export function useMockRouter(): MockRouterContextValue {
  const context = useContext(MockRouterContext);
  if (!context) {
    throw new Error('useMockRouter must be used within MockRouterProvider');
  }
  return context;
}

// Mock Query Client Provider (simplified)
const MockQueryContext = createContext<{
  queries: Map<string, unknown>;
  setQuery: (key: string, data: unknown) => void;
  invalidate: (key: string) => void;
} | null>(null);

/** Props for MockQueryProvider */
export interface MockQueryProviderProps {
  children: ReactNode;
  /** Pre-populated query cache */
  initialQueries?: Record<string, unknown>;
}

/**
 * Simplified mock query provider for testing data fetching
 * 
 * @example
 * ```tsx
 * <MockQueryProvider initialQueries={{ 'orders': mockOrders }}>
 *   <ComponentUnderTest />
 * </MockQueryProvider>
 * ```
 */
export function MockQueryProvider({
  children,
  initialQueries = {},
}: MockQueryProviderProps) {
  const [queries, setQueries] = useState<Map<string, unknown>>(
    new Map(Object.entries(initialQueries))
  );

  const setQuery = useCallback((key: string, data: unknown) => {
    setQueries((prev) => new Map(prev).set(key, data));
  }, []);

  const invalidate = useCallback((key: string) => {
    setQueries((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ queries, setQuery, invalidate }),
    [queries, setQuery, invalidate]
  );

  return (
    <MockQueryContext.Provider value={value}>
      {children}
    </MockQueryContext.Provider>
  );
}

/**
 * Hook to access mock query data in tests
 */
export function useMockQuery<T>(key: string): T | undefined {
  const context = useContext(MockQueryContext);
  if (!context) {
    throw new Error('useMockQuery must be used within MockQueryProvider');
  }
  return context.queries.get(key) as T | undefined;
}

// ============================================================================
// 17.2: CUSTOM RENDER WRAPPER
// ============================================================================

/**
 * Create a test wrapper component with all providers
 * 
 * @example
 * ```tsx
 * const wrapper = createTestWrapper({
 *   user: mockUser,
 *   theme: 'dark',
 *   initialPath: '/orders',
 * });
 * 
 * render(<MyComponent />, { wrapper });
 * ```
 */
export function createTestWrapper(options: TestWrapperOptions = {}): ComponentType<{ children: ReactNode }> {
  const {
    initialPath = '/',
    initialQuery = {},
    initialParams = {},
    user = null,
    theme = 'light',
    additionalProviders = [],
  } = options;

  return function TestWrapper({ children }: { children: ReactNode }) {
    let content = children;

    // Wrap with additional providers (innermost first)
    for (const Provider of [...additionalProviders].reverse()) {
      content = <Provider>{content}</Provider>;
    }

    return (
      <MockQueryProvider>
        <MockRouterProvider
          pathname={initialPath}
          query={initialQuery}
          params={initialParams}
        >
          <MockThemeProvider theme={theme}>
            <MockAuthProvider user={user}>
              {content}
            </MockAuthProvider>
          </MockThemeProvider>
        </MockRouterProvider>
      </MockQueryProvider>
    );
  };
}

/**
 * All-in-one test providers component
 * 
 * @example
 * ```tsx
 * <AllProviders user={mockUser} theme="dark">
 *   <ComponentUnderTest />
 * </AllProviders>
 * ```
 */
export function AllProviders({
  children,
  ...options
}: TestWrapperOptions & { children: ReactNode }) {
  const Wrapper = createTestWrapper(options);
  return <Wrapper>{children}</Wrapper>;
}

// ============================================================================
// 17.3: ACCESSIBILITY TESTING HELPERS
// ============================================================================

/**
 * Check if an element has an accessible name
 */
export function hasAccessibleName(element: HTMLElement): boolean {
  const ariaLabel = element.getAttribute('aria-label');
  const ariaLabelledBy = element.getAttribute('aria-labelledby');
  const title = element.getAttribute('title');
  const textContent = element.textContent?.trim();

  return !!(ariaLabel || ariaLabelledBy || title || textContent);
}

/**
 * Check if an element is keyboard accessible
 */
export function isKeyboardAccessible(element: HTMLElement): boolean {
  const tabIndex = element.getAttribute('tabindex');
  const isNativelyFocusable = [
    'A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA',
  ].includes(element.tagName);

  const isDisabled = element.hasAttribute('disabled') ||
    element.getAttribute('aria-disabled') === 'true';

  if (isDisabled) return false;
  if (isNativelyFocusable) return true;
  if (tabIndex !== null && parseInt(tabIndex) >= 0) return true;

  return false;
}

/**
 * Check if an element has valid ARIA attributes
 */
export function hasValidAriaAttributes(element: HTMLElement): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // Check for invalid aria-* attributes
  const attributes = Array.from(element.attributes);
  for (const attr of attributes) {
    if (attr.name.startsWith('aria-')) {
      const value = attr.value;

      // aria-hidden should be "true" or "false"
      if (attr.name === 'aria-hidden' && !['true', 'false'].includes(value)) {
        issues.push(`Invalid aria-hidden value: "${value}"`);
      }

      // aria-expanded should be "true" or "false"
      if (attr.name === 'aria-expanded' && !['true', 'false'].includes(value)) {
        issues.push(`Invalid aria-expanded value: "${value}"`);
      }

      // aria-disabled should be "true" or "false"
      if (attr.name === 'aria-disabled' && !['true', 'false'].includes(value)) {
        issues.push(`Invalid aria-disabled value: "${value}"`);
      }

      // aria-labelledby should reference existing elements
      if (attr.name === 'aria-labelledby') {
        const ids = value.split(/\s+/);
        for (const id of ids) {
          if (!document.getElementById(id)) {
            issues.push(`aria-labelledby references non-existent element: "${id}"`);
          }
        }
      }

      // aria-describedby should reference existing elements
      if (attr.name === 'aria-describedby') {
        const ids = value.split(/\s+/);
        for (const id of ids) {
          if (!document.getElementById(id)) {
            issues.push(`aria-describedby references non-existent element: "${id}"`);
          }
        }
      }
    }
  }

  return { valid: issues.length === 0, issues };
}

/**
 * Check if an image has alt text
 */
export function hasAltText(element: HTMLImageElement): boolean {
  const alt = element.getAttribute('alt');
  // Empty alt is valid for decorative images
  return alt !== null;
}

/**
 * Check if a form field has a label
 */
export function hasLabel(element: HTMLElement): {
  hasLabel: boolean;
  labelType?: 'label' | 'aria-label' | 'aria-labelledby' | 'title' | 'placeholder';
} {
  // Check for aria-label
  if (element.getAttribute('aria-label')) {
    return { hasLabel: true, labelType: 'aria-label' };
  }

  // Check for aria-labelledby
  if (element.getAttribute('aria-labelledby')) {
    return { hasLabel: true, labelType: 'aria-labelledby' };
  }

  // Check for title
  if (element.getAttribute('title')) {
    return { hasLabel: true, labelType: 'title' };
  }

  // Check for associated label element
  const id = element.getAttribute('id');
  if (id) {
    const label = document.querySelector(`label[for="${id}"]`);
    if (label) {
      return { hasLabel: true, labelType: 'label' };
    }
  }

  // Check if wrapped in label
  if (element.closest('label')) {
    return { hasLabel: true, labelType: 'label' };
  }

  // Placeholder is not ideal but counts
  if (element.getAttribute('placeholder')) {
    return { hasLabel: true, labelType: 'placeholder' };
  }

  return { hasLabel: false };
}

/**
 * Run basic accessibility checks on an element
 * 
 * @example
 * ```tsx
 * const { container } = render(<MyForm />);
 * const result = runA11yChecks(container);
 * expect(result.passed).toBe(true);
 * ```
 */
export function runA11yChecks(element: HTMLElement): A11yTestResult {
  const violations: A11yViolation[] = [];
  const warnings: A11yWarning[] = [];

  // Check images for alt text
  const images = element.querySelectorAll('img');
  images.forEach((img) => {
    if (!hasAltText(img as HTMLImageElement)) {
      violations.push({
        id: 'image-alt',
        impact: 'critical',
        description: 'Image is missing alt attribute',
        element: img as HTMLElement,
        help: 'Add an alt attribute to describe the image, or alt="" for decorative images',
      });
    }
  });

  // Check buttons for accessible names
  const buttons = element.querySelectorAll('button');
  buttons.forEach((button) => {
    if (!hasAccessibleName(button as HTMLElement)) {
      violations.push({
        id: 'button-name',
        impact: 'critical',
        description: 'Button has no accessible name',
        element: button as HTMLElement,
        help: 'Add text content, aria-label, or aria-labelledby to the button',
      });
    }
  });

  // Check links for accessible names
  const links = element.querySelectorAll('a');
  links.forEach((link) => {
    if (!hasAccessibleName(link as HTMLElement)) {
      violations.push({
        id: 'link-name',
        impact: 'serious',
        description: 'Link has no accessible name',
        element: link as HTMLElement,
        help: 'Add text content or aria-label to the link',
      });
    }
  });

  // Check form inputs for labels
  const inputs = element.querySelectorAll('input, select, textarea');
  inputs.forEach((input) => {
    const type = (input as HTMLInputElement).type;
    // Skip hidden and submit inputs
    if (type === 'hidden' || type === 'submit') return;

    const labelInfo = hasLabel(input as HTMLElement);
    if (!labelInfo.hasLabel) {
      violations.push({
        id: 'form-label',
        impact: 'critical',
        description: 'Form field has no label',
        element: input as HTMLElement,
        help: 'Add a label element or aria-label to the form field',
      });
    } else if (labelInfo.labelType === 'placeholder') {
      warnings.push({
        id: 'placeholder-label',
        description: 'Form field uses placeholder as only label',
        element: input as HTMLElement,
        suggestion: 'Use a visible label in addition to placeholder',
      });
    }
  });

  // Check for valid ARIA attributes
  const allElements = element.querySelectorAll('*');
  allElements.forEach((el) => {
    const ariaCheck = hasValidAriaAttributes(el as HTMLElement);
    if (!ariaCheck.valid) {
      ariaCheck.issues.forEach((issue) => {
        violations.push({
          id: 'aria-valid',
          impact: 'moderate',
          description: issue,
          element: el as HTMLElement,
          help: 'Fix the ARIA attribute value',
        });
      });
    }
  });

  // Check heading hierarchy
  const headings = element.querySelectorAll('h1, h2, h3, h4, h5, h6');
  let lastLevel = 0;
  headings.forEach((heading) => {
    const level = parseInt(heading.tagName[1]);
    if (level > lastLevel + 1 && lastLevel > 0) {
      warnings.push({
        id: 'heading-order',
        description: `Heading level jumps from h${lastLevel} to h${level}`,
        element: heading as HTMLElement,
        suggestion: `Use h${lastLevel + 1} instead of h${level}`,
      });
    }
    lastLevel = level;
  });

  return {
    passed: violations.length === 0,
    violations,
    warnings,
  };
}

/**
 * Assert that an element passes accessibility checks
 * Throws if there are violations
 */
export function assertAccessible(element: HTMLElement): void {
  const result = runA11yChecks(element);
  if (!result.passed) {
    const messages = result.violations.map(
      (v) => `[${v.impact.toUpperCase()}] ${v.description}: ${v.help}`
    );
    throw new Error(`Accessibility violations found:\n${messages.join('\n')}`);
  }
}

// ============================================================================
// 17.4: EVENT SIMULATION UTILITIES
// ============================================================================

/**
 * Simulate a click event on an element
 */
export function simulateClick(
  element: HTMLElement,
  options: SimulateEventOptions = {}
): void {
  const event = new MouseEvent('click', {
    bubbles: options.bubbles ?? true,
    cancelable: options.cancelable ?? true,
    ctrlKey: options.ctrlKey,
    shiftKey: options.shiftKey,
    altKey: options.altKey,
    metaKey: options.metaKey,
  });
  element.dispatchEvent(event);
}

/**
 * Simulate a keyboard event
 */
export function simulateKeyDown(
  element: HTMLElement,
  key: string,
  options: SimulateEventOptions & { code?: string } = {}
): void {
  const event = new KeyboardEvent('keydown', {
    key,
    code: options.code ?? key,
    bubbles: options.bubbles ?? true,
    cancelable: options.cancelable ?? true,
    ctrlKey: options.ctrlKey,
    shiftKey: options.shiftKey,
    altKey: options.altKey,
    metaKey: options.metaKey,
  });
  element.dispatchEvent(event);
}

/**
 * Simulate typing into an input
 */
export function simulateType(
  element: HTMLInputElement | HTMLTextAreaElement,
  text: string
): void {
  element.focus();
  element.value = text;
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Simulate clearing an input
 */
export function simulateClear(
  element: HTMLInputElement | HTMLTextAreaElement
): void {
  element.focus();
  element.value = '';
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Simulate focus on an element
 */
export function simulateFocus(element: HTMLElement): void {
  element.focus();
  element.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
}

/**
 * Simulate blur on an element
 */
export function simulateBlur(element: HTMLElement): void {
  element.blur();
  element.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
}

/**
 * Simulate form submission
 */
export function simulateSubmit(form: HTMLFormElement): void {
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

/**
 * Simulate mouse hover
 */
export function simulateHover(element: HTMLElement): void {
  element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
  element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
}

/**
 * Simulate mouse leave
 */
export function simulateUnhover(element: HTMLElement): void {
  element.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
  element.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
}

/**
 * Simulate a drag and drop operation
 */
export function simulateDragAndDrop(
  source: HTMLElement,
  target: HTMLElement
): void {
  // Create data transfer object
  const dataTransfer = new DataTransfer();

  // Dispatch drag start on source
  source.dispatchEvent(
    new DragEvent('dragstart', {
      bubbles: true,
      cancelable: true,
      dataTransfer,
    })
  );

  // Dispatch drag enter and over on target
  target.dispatchEvent(
    new DragEvent('dragenter', {
      bubbles: true,
      cancelable: true,
      dataTransfer,
    })
  );

  target.dispatchEvent(
    new DragEvent('dragover', {
      bubbles: true,
      cancelable: true,
      dataTransfer,
    })
  );

  // Dispatch drop on target
  target.dispatchEvent(
    new DragEvent('drop', {
      bubbles: true,
      cancelable: true,
      dataTransfer,
    })
  );

  // Dispatch drag end on source
  source.dispatchEvent(
    new DragEvent('dragend', {
      bubbles: true,
      cancelable: true,
      dataTransfer,
    })
  );
}

// ============================================================================
// 17.5: SNAPSHOT & VISUAL HELPERS
// ============================================================================

/**
 * Get a clean snapshot of an element's HTML
 * Removes dynamic attributes that change between test runs
 */
export function getCleanSnapshot(element: HTMLElement): string {
  const clone = element.cloneNode(true) as HTMLElement;

  // Remove dynamic IDs
  const elementsWithIds = clone.querySelectorAll('[id]');
  elementsWithIds.forEach((el) => {
    const id = el.getAttribute('id');
    if (id && /^:r[0-9a-z]+:?/.test(id)) {
      el.removeAttribute('id');
    }
  });

  // Remove dynamic aria-labelledby/describedby that reference dynamic IDs
  const elementsWithAriaRefs = clone.querySelectorAll(
    '[aria-labelledby], [aria-describedby], [aria-controls]'
  );
  elementsWithAriaRefs.forEach((el) => {
    ['aria-labelledby', 'aria-describedby', 'aria-controls'].forEach((attr) => {
      const value = el.getAttribute(attr);
      if (value && /^:r[0-9a-z]+:?/.test(value)) {
        el.setAttribute(attr, '[DYNAMIC_ID]');
      }
    });
  });

  // Remove style attributes with dynamic values
  // (e.g., random animation delays)

  return formatHTML(clone.innerHTML);
}

/**
 * Simple HTML formatter for readable snapshots
 */
function formatHTML(html: string): string {
  let formatted = '';
  let indent = 0;
  const tokens = html.match(/<[^>]+>|[^<]+/g) || [];

  for (const token of tokens) {
    if (token.startsWith('</')) {
      indent--;
      formatted += '  '.repeat(indent) + token + '\n';
    } else if (token.startsWith('<') && !token.endsWith('/>') && !token.includes('</')) {
      formatted += '  '.repeat(indent) + token + '\n';
      if (!token.match(/<(img|br|hr|input|meta|link)/i)) {
        indent++;
      }
    } else if (token.startsWith('<')) {
      formatted += '  '.repeat(indent) + token + '\n';
    } else {
      const trimmed = token.trim();
      if (trimmed) {
        formatted += '  '.repeat(indent) + trimmed + '\n';
      }
    }
  }

  return formatted.trim();
}

/**
 * Check if an element is visible in the viewport
 */
export function isInViewport(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

/**
 * Check if an element is visually hidden
 */
export function isVisuallyHidden(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  return (
    style.display === 'none' ||
    style.visibility === 'hidden' ||
    style.opacity === '0' ||
    (parseFloat(style.width) === 0 && parseFloat(style.height) === 0)
  );
}

/**
 * Wait for an element to appear in the DOM
 */
export async function waitForElement(
  selector: string,
  options: { timeout?: number; container?: HTMLElement } = {}
): Promise<HTMLElement> {
  const { timeout = 5000, container = document.body } = options;

  return new Promise((resolve, reject) => {
    const element = container.querySelector(selector);
    if (element) {
      resolve(element as HTMLElement);
      return;
    }

    const observer = new MutationObserver(() => {
      const element = container.querySelector(selector);
      if (element) {
        observer.disconnect();
        resolve(element as HTMLElement);
      }
    });

    observer.observe(container, {
      childList: true,
      subtree: true,
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element "${selector}" not found within ${timeout}ms`));
    }, timeout);
  });
}

/**
 * Wait for an element to be removed from the DOM
 */
export async function waitForElementToBeRemoved(
  selector: string,
  options: { timeout?: number; container?: HTMLElement } = {}
): Promise<void> {
  const { timeout = 5000, container = document.body } = options;

  return new Promise((resolve, reject) => {
    const element = container.querySelector(selector);
    if (!element) {
      resolve();
      return;
    }

    const observer = new MutationObserver(() => {
      const element = container.querySelector(selector);
      if (!element) {
        observer.disconnect();
        resolve();
      }
    });

    observer.observe(container, {
      childList: true,
      subtree: true,
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element "${selector}" still present after ${timeout}ms`));
    }, timeout);
  });
}

// ============================================================================
// MOCK DATA FACTORIES
// ============================================================================

/**
 * Create a mock user with optional overrides
 */
export function createMockUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: `user-${Date.now()}`,
    email: 'test@example.com',
    name: 'Test User',
    role: 'OPERATOR',
    ...overrides,
  };
}

/**
 * Create multiple mock users
 */
export function createMockUsers(count: number): MockUser[] {
  return Array.from({ length: count }, (_, i) =>
    createMockUser({
      id: `user-${i + 1}`,
      email: `user${i + 1}@example.com`,
      name: `Test User ${i + 1}`,
    })
  );
}

// ============================================================================
// TEST UTILITIES
// ============================================================================

/**
 * Wait for a specified duration
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Flush all pending microtasks
 */
export async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
}

/**
 * Flush all pending macrotasks (timers)
 */
export function flushTimers(): void {
  // Note: This requires jest.useFakeTimers() in tests
  if (typeof globalThis !== 'undefined' && 'jest' in globalThis) {
    (globalThis as unknown as { jest: { runAllTimers: () => void } }).jest.runAllTimers();
  }
}

/**
 * Advance timers by a specific amount
 */
export function advanceTimers(ms: number): void {
  // Note: This requires jest.useFakeTimers() in tests
  if (typeof globalThis !== 'undefined' && 'jest' in globalThis) {
    (globalThis as unknown as { jest: { advanceTimersByTime: (ms: number) => void } }).jest.advanceTimersByTime(ms);
  }
}

// ============================================================================
// EXPORTS - Only non-inline exports
// ============================================================================
