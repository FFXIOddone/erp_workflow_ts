/**
 * Print.tsx - CRITICAL-20
 * 
 * Print utilities and components for the ERP application.
 * Provides print stylesheets, print-only/screen-only components,
 * page break utilities, and print preview functionality.
 * 
 * Features:
 * - 20.1: Print/Screen visibility components
 * - 20.2: Page break utilities
 * - 20.3: Print header/footer components
 * - 20.4: usePrint hook for programmatic printing
 * - 20.5: Print preview modal
 * 
 * @module Print
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
  type CSSProperties,
} from 'react';
import { clsx } from 'clsx';
import { Printer, X, ZoomIn, ZoomOut, Download } from 'lucide-react';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/** Print options */
export interface PrintOptions {
  /** Document title for printing */
  title?: string;
  /** Page orientation */
  orientation?: 'portrait' | 'landscape';
  /** Page size */
  pageSize?: 'letter' | 'legal' | 'a4' | 'a3';
  /** Margins in CSS units */
  margins?: string | { top?: string; right?: string; bottom?: string; left?: string };
  /** Whether to include background colors/images */
  includeBackground?: boolean;
  /** Custom CSS to inject */
  customCSS?: string;
  /** Callback before print */
  onBeforePrint?: () => void | Promise<void>;
  /** Callback after print */
  onAfterPrint?: () => void;
}

/** Print context value */
export interface PrintContextValue {
  /** Whether currently in print mode */
  isPrinting: boolean;
  /** Trigger print */
  print: (options?: PrintOptions) => void;
  /** Print a specific element by ref */
  printElement: (element: HTMLElement, options?: PrintOptions) => void;
}

/** Page break type */
export type PageBreakType = 'before' | 'after' | 'avoid' | 'auto';

// ============================================================================
// PRINT CONTEXT
// ============================================================================

const PrintContext = createContext<PrintContextValue | null>(null);

/**
 * Hook to access print context
 */
export function usePrintContext(): PrintContextValue {
  const context = useContext(PrintContext);
  if (!context) {
    throw new Error('usePrintContext must be used within a PrintProvider');
  }
  return context;
}

/**
 * Provider for print functionality
 */
export function PrintProvider({ children }: { children: ReactNode }) {
  const [isPrinting, setIsPrinting] = useState(false);

  // Listen for print media changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('print');

    const handleChange = (e: MediaQueryListEvent) => {
      setIsPrinting(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Listen for beforeprint/afterprint events
  useEffect(() => {
    const handleBeforePrint = () => setIsPrinting(true);
    const handleAfterPrint = () => setIsPrinting(false);

    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);

    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, []);

  const print = useCallback((options?: PrintOptions) => {
    if (options?.onBeforePrint) {
      Promise.resolve(options.onBeforePrint()).then(() => {
        window.print();
      });
    } else {
      window.print();
    }
  }, []);

  const printElement = useCallback((element: HTMLElement, options?: PrintOptions) => {
    // Create a hidden iframe for printing
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.top = '-10000px';
    iframe.style.left = '-10000px';
    iframe.style.width = '0';
    iframe.style.height = '0';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) return;

    // Build print styles
    const pageSize = options?.pageSize || 'letter';
    const orientation = options?.orientation || 'portrait';
    const margins = typeof options?.margins === 'string'
      ? options.margins
      : options?.margins
        ? `${options.margins.top || '1cm'} ${options.margins.right || '1cm'} ${options.margins.bottom || '1cm'} ${options.margins.left || '1cm'}`
        : '1cm';

    const printCSS = `
      @page {
        size: ${pageSize} ${orientation};
        margin: ${margins};
      }
      body {
        margin: 0;
        padding: 0;
        ${options?.includeBackground ? '-webkit-print-color-adjust: exact; print-color-adjust: exact;' : ''}
      }
      ${options?.customCSS || ''}
    `;

    // Copy stylesheets
    const stylesheets = Array.from(document.styleSheets);
    let stylesHTML = `<style>${printCSS}</style>`;

    stylesheets.forEach((stylesheet) => {
      try {
        if (stylesheet.href) {
          stylesHTML += `<link rel="stylesheet" href="${stylesheet.href}">`;
        } else if (stylesheet.cssRules) {
          const rules = Array.from(stylesheet.cssRules)
            .map((rule) => rule.cssText)
            .join('\n');
          stylesHTML += `<style>${rules}</style>`;
        }
      } catch {
        // CORS issue with stylesheet, skip it
      }
    });

    // Write content
    iframeDoc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${options?.title || document.title}</title>
          ${stylesHTML}
        </head>
        <body>
          ${element.outerHTML}
        </body>
      </html>
    `);
    iframeDoc.close();

    // Wait for images to load
    const images = iframeDoc.querySelectorAll('img');
    const imagePromises = Array.from(images).map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
      });
    });

    Promise.all(imagePromises).then(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();

      // Clean up after a delay
      setTimeout(() => {
        document.body.removeChild(iframe);
        options?.onAfterPrint?.();
      }, 1000);
    });
  }, []);

  return (
    <PrintContext.Provider value={{ isPrinting, print, printElement }}>
      {children}
    </PrintContext.Provider>
  );
}

// ============================================================================
// 20.1: PRINT/SCREEN VISIBILITY COMPONENTS
// ============================================================================

/** Props for visibility components */
export interface VisibilityProps {
  children: ReactNode;
  className?: string;
}

/**
 * Content that only appears when printing
 * 
 * @example
 * ```tsx
 * <PrintOnly>
 *   <p>This text only appears when printed</p>
 * </PrintOnly>
 * ```
 */
export function PrintOnly({ children, className }: VisibilityProps) {
  return (
    <div className={clsx('hidden print:block', className)}>
      {children}
    </div>
  );
}

/**
 * Content that only appears on screen (hidden when printing)
 * 
 * @example
 * ```tsx
 * <ScreenOnly>
 *   <button>This button doesn't print</button>
 * </ScreenOnly>
 * ```
 */
export function ScreenOnly({ children, className }: VisibilityProps) {
  return (
    <div className={clsx('print:hidden', className)}>
      {children}
    </div>
  );
}

/**
 * Inline span version of PrintOnly
 */
export function PrintOnlySpan({ children, className }: VisibilityProps) {
  return (
    <span className={clsx('hidden print:inline', className)}>
      {children}
    </span>
  );
}

/**
 * Inline span version of ScreenOnly
 */
export function ScreenOnlySpan({ children, className }: VisibilityProps) {
  return (
    <span className={clsx('print:hidden', className)}>
      {children}
    </span>
  );
}

// ============================================================================
// 20.2: PAGE BREAK UTILITIES
// ============================================================================

/** Page break props */
export interface PageBreakProps {
  /** Type of page break */
  type?: PageBreakType;
  /** Additional CSS class */
  className?: string;
}

/**
 * Insert a page break
 * 
 * @example
 * ```tsx
 * <Section>First page content</Section>
 * <PageBreak type="after" />
 * <Section>Second page content</Section>
 * ```
 */
export function PageBreak({ type = 'after', className }: PageBreakProps) {
  const styles: CSSProperties = {};

  switch (type) {
    case 'before':
      styles.breakBefore = 'page';
      break;
    case 'after':
      styles.breakAfter = 'page';
      break;
    case 'avoid':
      styles.breakInside = 'avoid';
      break;
    default:
      break;
  }

  return <div className={className} style={styles} aria-hidden="true" />;
}

/** No page break props */
export interface NoPageBreakProps {
  children: ReactNode;
  className?: string;
}

/**
 * Wrap content to prevent page breaks inside
 * 
 * @example
 * ```tsx
 * <NoPageBreak>
 *   <TableRow /> // This row won't be split across pages
 * </NoPageBreak>
 * ```
 */
export function NoPageBreak({ children, className }: NoPageBreakProps) {
  return (
    <div className={className} style={{ breakInside: 'avoid' }}>
      {children}
    </div>
  );
}

/**
 * Force a page break before this content
 */
export function PageBreakBefore({ children, className }: NoPageBreakProps) {
  return (
    <div className={className} style={{ breakBefore: 'page' }}>
      {children}
    </div>
  );
}

/**
 * Force a page break after this content
 */
export function PageBreakAfter({ children, className }: NoPageBreakProps) {
  return (
    <div className={className} style={{ breakAfter: 'page' }}>
      {children}
    </div>
  );
}

// ============================================================================
// 20.3: PRINT HEADER/FOOTER COMPONENTS
// ============================================================================

/** Print header props */
export interface PrintHeaderProps {
  /** Title to display */
  title?: string;
  /** Subtitle or description */
  subtitle?: string;
  /** Logo URL or element */
  logo?: string | ReactNode;
  /** Date to display (defaults to current date) */
  date?: Date | string;
  /** Show page number placeholder */
  showPageNumber?: boolean;
  /** Additional content */
  children?: ReactNode;
  /** Additional CSS class */
  className?: string;
}

/**
 * Header that appears on printed pages
 * 
 * @example
 * ```tsx
 * <PrintHeader 
 *   title="Work Order #12345"
 *   subtitle="Wilde Signs"
 *   logo="/logo.png"
 *   showPageNumber
 * />
 * ```
 */
export function PrintHeader({
  title,
  subtitle,
  logo,
  date,
  showPageNumber = false,
  children,
  className,
}: PrintHeaderProps) {
  const formattedDate = date
    ? typeof date === 'string'
      ? date
      : date.toLocaleDateString()
    : new Date().toLocaleDateString();

  return (
    <PrintOnly>
      <header
        className={clsx(
          'flex items-center justify-between border-b border-gray-300 pb-4 mb-6',
          className
        )}
      >
        {/* Left: Logo and Title */}
        <div className="flex items-center gap-4">
          {logo && (
            typeof logo === 'string' ? (
              <img src={logo} alt="Logo" className="h-12 w-auto" />
            ) : (
              logo
            )
          )}
          <div>
            {title && (
              <h1 className="text-xl font-bold text-gray-900">{title}</h1>
            )}
            {subtitle && (
              <p className="text-sm text-gray-600">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Right: Date and Page Number */}
        <div className="text-right text-sm text-gray-600">
          <div>Printed: {formattedDate}</div>
          {showPageNumber && (
            <div className="print-page-number">
              {/* Page numbers are typically handled by @page CSS */}
            </div>
          )}
        </div>

        {children}
      </header>
    </PrintOnly>
  );
}

/** Print footer props */
export interface PrintFooterProps {
  /** Footer text */
  text?: string;
  /** Show page number */
  showPageNumber?: boolean;
  /** Additional content */
  children?: ReactNode;
  /** Additional CSS class */
  className?: string;
}

/**
 * Footer that appears on printed pages
 * 
 * @example
 * ```tsx
 * <PrintFooter 
 *   text="Confidential - Do Not Distribute"
 *   showPageNumber
 * />
 * ```
 */
export function PrintFooter({
  text,
  showPageNumber = false,
  children,
  className,
}: PrintFooterProps) {
  return (
    <PrintOnly>
      <footer
        className={clsx(
          'fixed bottom-0 left-0 right-0 border-t border-gray-300 pt-2 mt-6',
          'text-sm text-gray-600 flex items-center justify-between',
          className
        )}
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
        }}
      >
        <div>{text}</div>
        {showPageNumber && (
          <div className="print-page-number">
            {/* Page numbers handled by @page CSS */}
          </div>
        )}
        {children}
      </footer>
    </PrintOnly>
  );
}

// ============================================================================
// 20.4: usePrint HOOK
// ============================================================================

/** Print hook options */
export interface UsePrintOptions extends PrintOptions {
  /** Ref to the element to print (optional, defaults to body) */
  contentRef?: React.RefObject<HTMLElement>;
}

/** Print hook result */
export interface UsePrintResult {
  /** Whether currently printing */
  isPrinting: boolean;
  /** Trigger print */
  handlePrint: () => void;
  /** Ref to attach to printable content */
  printRef: React.RefObject<HTMLDivElement>;
}

/**
 * Hook for programmatic printing
 * 
 * @example
 * ```tsx
 * const { handlePrint, printRef, isPrinting } = usePrint({
 *   title: 'Work Order Report',
 *   orientation: 'landscape',
 * });
 * 
 * return (
 *   <>
 *     <button onClick={handlePrint}>Print</button>
 *     <div ref={printRef}>
 *       <PrintableContent />
 *     </div>
 *   </>
 * );
 * ```
 */
export function usePrint(options: UsePrintOptions = {}): UsePrintResult {
  const [isPrinting, setIsPrinting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const contentRef = options.contentRef || printRef;

  // Listen for print media query
  useEffect(() => {
    const mediaQuery = window.matchMedia('print');
    const handleChange = (e: MediaQueryListEvent) => setIsPrinting(e.matches);

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const handlePrint = useCallback(() => {
    const element = contentRef.current;

    if (element) {
      // Print specific element
      const { title, orientation, pageSize, margins, includeBackground, customCSS, onBeforePrint, onAfterPrint } = options;

      const run = async () => {
        if (onBeforePrint) {
          await Promise.resolve(onBeforePrint());
        }

        // Create iframe for isolated printing
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:absolute;width:0;height:0;border:0;left:-10000px;top:-10000px;';
        document.body.appendChild(iframe);

        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!iframeDoc) {
          document.body.removeChild(iframe);
          return;
        }

        // Build CSS
        const pageSizeValue = pageSize || 'letter';
        const orientationValue = orientation || 'portrait';
        const marginsValue = typeof margins === 'string'
          ? margins
          : margins
            ? `${margins.top || '1cm'} ${margins.right || '1cm'} ${margins.bottom || '1cm'} ${margins.left || '1cm'}`
            : '1cm';

        const printStyles = `
          @page {
            size: ${pageSizeValue} ${orientationValue};
            margin: ${marginsValue};
          }
          @media print {
            body {
              margin: 0;
              padding: 0;
              ${includeBackground ? '-webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact;' : ''}
            }
            .print\\:hidden { display: none !important; }
            .print\\:block { display: block !important; }
            .hidden.print\\:block { display: block !important; }
          }
          ${customCSS || ''}
        `;

        // Copy stylesheets from parent
        let stylesheetHTML = `<style>${printStyles}</style>`;
        
        try {
          const sheets = Array.from(document.styleSheets);
          sheets.forEach((sheet) => {
            try {
              if (sheet.href) {
                stylesheetHTML += `<link rel="stylesheet" href="${sheet.href}">`;
              } else if (sheet.cssRules) {
                const rules = Array.from(sheet.cssRules).map((r) => r.cssText).join('\n');
                stylesheetHTML += `<style>${rules}</style>`;
              }
            } catch {
              // CORS error, skip
            }
          });
        } catch {
          // Error accessing stylesheets
        }

        iframeDoc.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>${title || document.title}</title>
              ${stylesheetHTML}
            </head>
            <body>${element.innerHTML}</body>
          </html>
        `);
        iframeDoc.close();

        // Wait for resources
        await new Promise<void>((resolve) => {
          if (iframeDoc.readyState === 'complete') {
            resolve();
          } else {
            iframe.onload = () => resolve();
          }
        });

        // Additional delay for images
        await new Promise((r) => setTimeout(r, 100));

        // Print
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();

        // Cleanup
        setTimeout(() => {
          document.body.removeChild(iframe);
          onAfterPrint?.();
        }, 500);
      };

      run();
    } else {
      // Print entire page
      if (options.onBeforePrint) {
        Promise.resolve(options.onBeforePrint()).then(() => {
          window.print();
          options.onAfterPrint?.();
        });
      } else {
        window.print();
        options.onAfterPrint?.();
      }
    }
  }, [contentRef, options]);

  return { isPrinting, handlePrint, printRef };
}

// ============================================================================
// 20.5: PRINT PREVIEW MODAL
// ============================================================================

/** Print preview props */
export interface PrintPreviewProps {
  /** Whether preview is open */
  open: boolean;
  /** Callback to close preview */
  onClose: () => void;
  /** Content to preview */
  children: ReactNode;
  /** Print options */
  printOptions?: PrintOptions;
  /** Modal title */
  title?: string;
  /** Initial zoom level (percentage) */
  initialZoom?: number;
}

/**
 * Print preview modal
 * 
 * @example
 * ```tsx
 * <PrintPreview
 *   open={showPreview}
 *   onClose={() => setShowPreview(false)}
 *   printOptions={{ orientation: 'landscape' }}
 * >
 *   <ReportContent />
 * </PrintPreview>
 * ```
 */
export function PrintPreview({
  open,
  onClose,
  children,
  printOptions = {},
  title = 'Print Preview',
  initialZoom = 100,
}: PrintPreviewProps) {
  const [zoom, setZoom] = useState(initialZoom);
  const contentRef = useRef<HTMLDivElement>(null);
  const { handlePrint } = usePrint({
    ...printOptions,
    contentRef,
  });

  const handleZoomIn = () => setZoom((z) => Math.min(z + 10, 200));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 10, 50));

  if (!open) return null;

  const pageWidth = printOptions.orientation === 'landscape' ? '11in' : '8.5in';
  const pageHeight = printOptions.orientation === 'landscape' ? '8.5in' : '11in';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-100">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>

        <div className="flex items-center gap-4">
          {/* Zoom controls */}
          <div className="flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-lg">
            <button
              onClick={handleZoomOut}
              className="p-1 text-gray-600 hover:text-gray-900 rounded"
              aria-label="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium text-gray-700 min-w-[3rem] text-center">
              {zoom}%
            </span>
            <button
              onClick={handleZoomIn}
              className="p-1 text-gray-600 hover:text-gray-900 rounded"
              aria-label="Zoom in"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          {/* Print button */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>

          {/* Close button */}
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Preview area */}
      <div className="flex-1 overflow-auto p-8 bg-gray-200">
        <div
          className="mx-auto bg-white shadow-lg"
          style={{
            width: pageWidth,
            minHeight: pageHeight,
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top center',
          }}
        >
          <div ref={contentRef} className="p-8">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// PRINT BUTTON COMPONENT
// ============================================================================

/** Print button props */
export interface PrintButtonProps {
  /** Element to print (optional, prints page if not provided) */
  printRef?: React.RefObject<HTMLElement>;
  /** Print options */
  options?: PrintOptions;
  /** Button text */
  text?: string;
  /** Show icon */
  showIcon?: boolean;
  /** Button variant */
  variant?: 'primary' | 'secondary' | 'ghost';
  /** Button size */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS class */
  className?: string;
  /** Disabled state */
  disabled?: boolean;
}

/**
 * Print button component
 * 
 * @example
 * ```tsx
 * <PrintButton 
 *   printRef={reportRef}
 *   options={{ title: 'Sales Report' }}
 * />
 * ```
 */
export function PrintButton({
  printRef,
  options = {},
  text = 'Print',
  showIcon = true,
  variant = 'secondary',
  size = 'md',
  className,
  disabled = false,
}: PrintButtonProps) {
  const { handlePrint } = usePrint({
    ...options,
    contentRef: printRef,
  });

  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50',
    ghost: 'text-gray-600 hover:text-gray-900 hover:bg-gray-100',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-base',
  };

  return (
    <button
      type="button"
      onClick={handlePrint}
      disabled={disabled}
      className={clsx(
        'inline-flex items-center gap-2 font-medium rounded-lg transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'print:hidden',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
    >
      {showIcon && <Printer className={size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'} />}
      {text}
    </button>
  );
}

// ============================================================================
// PRINTABLE DOCUMENT WRAPPER
// ============================================================================

/** Printable document props */
export interface PrintableDocumentProps {
  children: ReactNode;
  /** Document title (shown in header) */
  title?: string;
  /** Document subtitle */
  subtitle?: string;
  /** Show header on all pages */
  showHeader?: boolean;
  /** Show footer on all pages */
  showFooter?: boolean;
  /** Logo for header */
  logo?: string | ReactNode;
  /** Footer text */
  footerText?: string;
  /** Additional CSS class */
  className?: string;
}

/**
 * Wrapper for printable documents with headers/footers
 * 
 * @example
 * ```tsx
 * <PrintableDocument
 *   title="Work Order #12345"
 *   subtitle="Wilde Signs"
 *   logo="/logo.png"
 *   showHeader
 *   showFooter
 * >
 *   <OrderDetails />
 * </PrintableDocument>
 * ```
 */
export function PrintableDocument({
  children,
  title,
  subtitle,
  showHeader = true,
  showFooter = true,
  logo,
  footerText = 'Confidential',
  className,
}: PrintableDocumentProps) {
  return (
    <div className={clsx('printable-document', className)}>
      {showHeader && (
        <PrintHeader
          title={title}
          subtitle={subtitle}
          logo={logo}
          showPageNumber
        />
      )}

      <main className="print-content">{children}</main>

      {showFooter && (
        <PrintFooter text={footerText} showPageNumber />
      )}
    </div>
  );
}

// ============================================================================
// CSS INJECTION FOR PRINT STYLES
// ============================================================================

/**
 * Inject global print styles
 * Call this once in your app to set up print-specific CSS
 */
export function injectPrintStyles(): void {
  if (typeof document === 'undefined') return;

  const styleId = 'erp-print-styles';
  if (document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    @media print {
      /* Hide elements that shouldn't print */
      .no-print,
      .print\\:hidden,
      [data-print="false"] {
        display: none !important;
      }

      /* Show print-only elements */
      .print-only,
      .print\\:block,
      [data-print="only"] {
        display: block !important;
      }

      /* Ensure backgrounds print */
      .print-bg,
      [data-print-bg="true"] {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }

      /* Page break utilities */
      .print-break-before { break-before: page !important; }
      .print-break-after { break-after: page !important; }
      .print-break-avoid { break-inside: avoid !important; }

      /* Reset some styles for cleaner printing */
      body {
        background: white !important;
      }

      /* Ensure links are visible */
      a[href]:after {
        content: none !important;
      }

      /* Table improvements */
      table {
        break-inside: auto;
      }
      tr {
        break-inside: avoid;
        break-after: auto;
      }
      thead {
        display: table-header-group;
      }
      tfoot {
        display: table-footer-group;
      }
    }
  `;

  document.head.appendChild(style);
}

// ============================================================================
// EXPORTS
// ============================================================================

// Types are exported inline at their definitions
