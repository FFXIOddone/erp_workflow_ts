/**
 * Signature.tsx - CRITICAL-36
 * 
 * Signature capture component for the ERP application.
 * Canvas-based signature pad with touch/mouse support.
 * 
 * Features:
 * - 36.1: Canvas signature pad
 * - 36.2: Touch and mouse support
 * - 36.3: Stroke customization
 * - 36.4: Export as image
 * - 36.5: Signature display and verification
 * 
 * @module Signature
 */

import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
  type ReactNode,
  type MouseEvent,
  type TouchEvent,
} from 'react';
import { clsx } from 'clsx';
import {
  Eraser,
  Download,
  Undo,
  Redo,
  PenTool,
  Check,
  X,
  RefreshCw,
} from 'lucide-react';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/** Point on canvas */
export interface Point {
  x: number;
  y: number;
  pressure?: number;
}

/** Stroke data */
export interface Stroke {
  points: Point[];
  color: string;
  width: number;
}

/** Signature pad ref */
export interface SignaturePadRef {
  /** Clear the signature */
  clear: () => void;
  /** Undo last stroke */
  undo: () => void;
  /** Redo last undone stroke */
  redo: () => void;
  /** Check if empty */
  isEmpty: () => boolean;
  /** Get signature as data URL */
  toDataURL: (type?: string, quality?: number) => string;
  /** Get signature as blob */
  toBlob: (type?: string, quality?: number) => Promise<Blob | null>;
  /** Get stroke data */
  getStrokes: () => Stroke[];
  /** Load stroke data */
  loadStrokes: (strokes: Stroke[]) => void;
}

/** Signature pad props */
export interface SignaturePadProps {
  /** Width */
  width?: number | string;
  /** Height */
  height?: number;
  /** Background color */
  backgroundColor?: string;
  /** Stroke color */
  penColor?: string;
  /** Stroke width */
  penWidth?: number;
  /** Min stroke width (for pressure) */
  minWidth?: number;
  /** Max stroke width (for pressure) */
  maxWidth?: number;
  /** Velocity filter weight */
  velocityFilterWeight?: number;
  /** On change callback */
  onChange?: (isEmpty: boolean) => void;
  /** On end stroke callback */
  onEnd?: () => void;
  /** Disabled */
  disabled?: boolean;
  /** Show toolbar */
  showToolbar?: boolean;
  /** Show border */
  showBorder?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Class name */
  className?: string;
}

/** Signature display props */
export interface SignatureDisplayProps {
  /** Signature data URL or image URL */
  src: string;
  /** Alt text */
  alt?: string;
  /** Width */
  width?: number | string;
  /** Height */
  height?: number | string;
  /** Signed by name */
  signedBy?: string;
  /** Signed date */
  signedAt?: Date | string;
  /** Show verification badge */
  showVerified?: boolean;
  /** Class name */
  className?: string;
}

// ============================================================================
// 36.1-36.4: SIGNATURE PAD COMPONENT
// ============================================================================

/**
 * Canvas-based signature capture component
 * 
 * @example
 * ```tsx
 * const signatureRef = useRef<SignaturePadRef>(null);
 * 
 * <SignaturePad
 *   ref={signatureRef}
 *   width={400}
 *   height={200}
 *   onEnd={() => console.log('Signed!')}
 * />
 * 
 * // Get signature as image
 * const dataUrl = signatureRef.current?.toDataURL();
 * ```
 */
export const SignaturePad = forwardRef<SignaturePadRef, SignaturePadProps>(
  function SignaturePad(
    {
      width = '100%',
      height = 200,
      backgroundColor = '#ffffff',
      penColor = '#000000',
      penWidth = 2.5,
      minWidth = 0.5,
      maxWidth = 4,
      velocityFilterWeight = 0.7,
      onChange,
      onEnd,
      disabled = false,
      showToolbar = true,
      showBorder = true,
      placeholder = 'Sign here',
      className,
    },
    ref
  ) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [strokes, setStrokes] = useState<Stroke[]>([]);
    const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
    const [undoneStrokes, setUndoneStrokes] = useState<Stroke[]>([]);
    const [lastPoint, setLastPoint] = useState<Point | null>(null);
    const [lastVelocity, setLastVelocity] = useState(0);

    const isEmpty = strokes.length === 0 && !currentStroke;

    // Initialize canvas
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Set canvas size
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);

      // Redraw all strokes
      redrawCanvas();
    }, [width, height]);

    // Redraw canvas when strokes change
    const redrawCanvas = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const rect = canvas.getBoundingClientRect();

      // Clear canvas
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, rect.width, rect.height);

      // Draw all strokes
      strokes.forEach((stroke) => drawStroke(ctx, stroke));
      if (currentStroke) drawStroke(ctx, currentStroke);
    }, [strokes, currentStroke, backgroundColor]);

    useEffect(() => {
      redrawCanvas();
    }, [redrawCanvas]);

    // Draw a single stroke
    const drawStroke = (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
      if (stroke.points.length < 2) return;

      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = stroke.width;

      const [first, ...rest] = stroke.points;
      ctx.moveTo(first.x, first.y);

      rest.forEach((point, i) => {
        // Use quadratic curve for smoothness
        const prev = stroke.points[i];
        const midX = (prev.x + point.x) / 2;
        const midY = (prev.y + point.y) / 2;
        ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
      });

      ctx.stroke();
    };

    // Get point from event
    const getPoint = (
      e: MouseEvent<HTMLCanvasElement> | TouchEvent<HTMLCanvasElement>
    ): Point => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();

      let clientX: number, clientY: number, pressure = 0.5;

      if ('touches' in e) {
        const touch = e.touches[0] || e.changedTouches[0];
        clientX = touch.clientX;
        clientY = touch.clientY;
        // @ts-expect-error - force is not always available
        pressure = touch.force || 0.5;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      return {
        x: clientX - rect.left,
        y: clientY - rect.top,
        pressure,
      };
    };

    // Calculate stroke width based on velocity
    const getStrokeWidth = (point: Point, prevPoint: Point | null): number => {
      if (!prevPoint) return penWidth;

      const distance = Math.sqrt(
        Math.pow(point.x - prevPoint.x, 2) + Math.pow(point.y - prevPoint.y, 2)
      );
      const velocity = distance;

      // Filter velocity for smoother lines
      const newVelocity = velocityFilterWeight * velocity + (1 - velocityFilterWeight) * lastVelocity;
      setLastVelocity(newVelocity);

      // Map velocity to width
      const normalizedVelocity = Math.min(1, newVelocity / 100);
      const width = maxWidth - (maxWidth - minWidth) * normalizedVelocity;

      // Consider pressure if available
      if (point.pressure) {
        return width * point.pressure;
      }

      return width;
    };

    // Start drawing
    const handleStart = (
      e: MouseEvent<HTMLCanvasElement> | TouchEvent<HTMLCanvasElement>
    ) => {
      if (disabled) return;
      e.preventDefault();

      const point = getPoint(e);
      setIsDrawing(true);
      setLastPoint(point);
      setCurrentStroke({
        points: [point],
        color: penColor,
        width: penWidth,
      });
      setUndoneStrokes([]); // Clear redo stack
    };

    // Continue drawing
    const handleMove = (
      e: MouseEvent<HTMLCanvasElement> | TouchEvent<HTMLCanvasElement>
    ) => {
      if (!isDrawing || disabled || !currentStroke) return;
      e.preventDefault();

      const point = getPoint(e);
      const strokeWidth = getStrokeWidth(point, lastPoint);

      setCurrentStroke((prev) => ({
        ...prev!,
        points: [...prev!.points, point],
        width: strokeWidth,
      }));
      setLastPoint(point);
    };

    // End drawing
    const handleEnd = (
      e: MouseEvent<HTMLCanvasElement> | TouchEvent<HTMLCanvasElement>
    ) => {
      if (!isDrawing || !currentStroke) return;
      e.preventDefault();

      setIsDrawing(false);
      setStrokes((prev) => [...prev, currentStroke]);
      setCurrentStroke(null);
      setLastPoint(null);
      setLastVelocity(0);
      onChange?.(false);
      onEnd?.();
    };

    // Clear canvas
    const clear = useCallback(() => {
      setStrokes([]);
      setCurrentStroke(null);
      setUndoneStrokes([]);
      onChange?.(true);
    }, [onChange]);

    // Undo last stroke
    const undo = useCallback(() => {
      if (strokes.length === 0) return;

      const lastStroke = strokes[strokes.length - 1];
      setStrokes((prev) => prev.slice(0, -1));
      setUndoneStrokes((prev) => [lastStroke, ...prev]);
      onChange?.(strokes.length === 1);
    }, [strokes, onChange]);

    // Redo last undone stroke
    const redo = useCallback(() => {
      if (undoneStrokes.length === 0) return;

      const strokeToRedo = undoneStrokes[0];
      setUndoneStrokes((prev) => prev.slice(1));
      setStrokes((prev) => [...prev, strokeToRedo]);
      onChange?.(false);
    }, [undoneStrokes, onChange]);

    // Export as data URL
    const toDataURL = useCallback(
      (type = 'image/png', quality = 1): string => {
        const canvas = canvasRef.current;
        if (!canvas) return '';
        return canvas.toDataURL(type, quality);
      },
      []
    );

    // Export as blob
    const toBlob = useCallback(
      async (type = 'image/png', quality = 1): Promise<Blob | null> => {
        const canvas = canvasRef.current;
        if (!canvas) return null;

        return new Promise((resolve) => {
          canvas.toBlob(resolve, type, quality);
        });
      },
      []
    );

    // Get stroke data
    const getStrokes = useCallback(() => strokes, [strokes]);

    // Load stroke data
    const loadStrokes = useCallback((newStrokes: Stroke[]) => {
      setStrokes(newStrokes);
      setUndoneStrokes([]);
      onChange?.(newStrokes.length === 0);
    }, [onChange]);

    // Expose ref methods
    useImperativeHandle(
      ref,
      () => ({
        clear,
        undo,
        redo,
        isEmpty: () => isEmpty,
        toDataURL,
        toBlob,
        getStrokes,
        loadStrokes,
      }),
      [clear, undo, redo, isEmpty, toDataURL, toBlob, getStrokes, loadStrokes]
    );

    return (
      <div className={clsx('relative', className)}>
        {/* Toolbar */}
        {showToolbar && (
          <div className="flex items-center gap-2 mb-2">
            <button
              type="button"
              onClick={undo}
              disabled={disabled || strokes.length === 0}
              className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Undo"
            >
              <Undo className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={disabled || undoneStrokes.length === 0}
              className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Redo"
            >
              <Redo className="w-4 h-4" />
            </button>
            <div className="w-px h-5 bg-gray-300" />
            <button
              type="button"
              onClick={clear}
              disabled={disabled || isEmpty}
              className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Clear"
            >
              <Eraser className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Canvas container */}
        <div
          className={clsx(
            'relative overflow-hidden rounded-lg',
            showBorder && 'border-2 border-dashed border-gray-300',
            disabled && 'opacity-60 cursor-not-allowed'
          )}
          style={{ width, height }}
        >
          {/* Placeholder */}
          {isEmpty && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="flex items-center gap-2 text-gray-400">
                <PenTool className="w-5 h-5" />
                <span className="text-sm">{placeholder}</span>
              </div>
            </div>
          )}

          {/* Canvas */}
          <canvas
            ref={canvasRef}
            className={clsx('w-full h-full touch-none', !disabled && 'cursor-crosshair')}
            style={{ backgroundColor }}
            onMouseDown={handleStart}
            onMouseMove={handleMove}
            onMouseUp={handleEnd}
            onMouseLeave={handleEnd}
            onTouchStart={handleStart}
            onTouchMove={handleMove}
            onTouchEnd={handleEnd}
          />
        </div>
      </div>
    );
  }
);

// ============================================================================
// 36.5: SIGNATURE DISPLAY COMPONENT
// ============================================================================

/**
 * Display a captured signature with optional verification
 * 
 * @example
 * ```tsx
 * <SignatureDisplay
 *   src={signatureDataUrl}
 *   signedBy="John Doe"
 *   signedAt={new Date()}
 *   showVerified
 * />
 * ```
 */
export function SignatureDisplay({
  src,
  alt = 'Signature',
  width = 200,
  height = 100,
  signedBy,
  signedAt,
  showVerified = false,
  className,
}: SignatureDisplayProps) {
  const formattedDate = signedAt
    ? new Date(signedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div className={clsx('inline-block', className)}>
      {/* Signature image */}
      <div
        className="bg-white border border-gray-200 rounded-lg overflow-hidden"
        style={{ width, height }}
      >
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-contain"
        />
      </div>

      {/* Signature info */}
      {(signedBy || signedAt || showVerified) && (
        <div className="mt-2 text-sm text-gray-600">
          {signedBy && (
            <p className="font-medium">{signedBy}</p>
          )}
          {formattedDate && (
            <p className="text-xs text-gray-500">{formattedDate}</p>
          )}
          {showVerified && (
            <div className="flex items-center gap-1 mt-1 text-green-600">
              <Check className="w-3 h-3" />
              <span className="text-xs">Verified</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SIGNATURE MODAL
// ============================================================================

export interface SignatureModalProps {
  /** Is open */
  isOpen: boolean;
  /** On close */
  onClose: () => void;
  /** On save */
  onSave: (dataUrl: string) => void;
  /** Title */
  title?: string;
  /** Save button text */
  saveText?: string;
  /** Cancel button text */
  cancelText?: string;
  /** Signature pad props */
  padProps?: Partial<SignaturePadProps>;
}

/**
 * Modal dialog for capturing signatures
 * 
 * @example
 * ```tsx
 * <SignatureModal
 *   isOpen={showSignature}
 *   onClose={() => setShowSignature(false)}
 *   onSave={(dataUrl) => {
 *     setSignature(dataUrl);
 *     setShowSignature(false);
 *   }}
 * />
 * ```
 */
export function SignatureModal({
  isOpen,
  onClose,
  onSave,
  title = 'Add Signature',
  saveText = 'Save Signature',
  cancelText = 'Cancel',
  padProps,
}: SignatureModalProps) {
  const signatureRef = useRef<SignaturePadRef>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  const handleSave = () => {
    if (signatureRef.current && !signatureRef.current.isEmpty()) {
      const dataUrl = signatureRef.current.toDataURL();
      onSave(dataUrl);
    }
  };

  const handleClear = () => {
    signatureRef.current?.clear();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg bg-white rounded-lg shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4">
          <SignaturePad
            ref={signatureRef}
            height={200}
            showToolbar={false}
            onChange={(empty) => setIsEmpty(empty)}
            {...padProps}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
          <button
            type="button"
            onClick={handleClear}
            disabled={isEmpty}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50"
          >
            <RefreshCw className="w-4 h-4" />
            Clear
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isEmpty}
              className="px-4 py-2 text-sm text-white bg-blue-500 hover:bg-blue-600 rounded disabled:opacity-50"
            >
              {saveText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SIGNATURE FIELD (Form Input)
// ============================================================================

export interface SignatureFieldProps {
  /** Field value (data URL) */
  value?: string;
  /** On change */
  onChange?: (dataUrl: string | null) => void;
  /** Label */
  label?: string;
  /** Required */
  required?: boolean;
  /** Error message */
  error?: string;
  /** Helper text */
  helperText?: string;
  /** Disabled */
  disabled?: boolean;
  /** Class name */
  className?: string;
}

/**
 * Form field for signature capture
 * 
 * @example
 * ```tsx
 * <SignatureField
 *   label="Customer Signature"
 *   value={signature}
 *   onChange={setSignature}
 *   required
 * />
 * ```
 */
export function SignatureField({
  value,
  onChange,
  label,
  required = false,
  error,
  helperText,
  disabled = false,
  className,
}: SignatureFieldProps) {
  const [showModal, setShowModal] = useState(false);

  const handleSave = (dataUrl: string) => {
    onChange?.(dataUrl);
    setShowModal(false);
  };

  const handleClear = () => {
    onChange?.(null);
  };

  return (
    <div className={className}>
      {/* Label */}
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {/* Signature display or add button */}
      {value ? (
        <div className="relative inline-block">
          <SignatureDisplay
            src={value}
            width={200}
            height={80}
          />
          {!disabled && (
            <div className="absolute top-1 right-1 flex gap-1">
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="p-1 bg-white rounded shadow hover:bg-gray-50"
                title="Edit signature"
              >
                <PenTool className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="p-1 bg-white rounded shadow hover:bg-gray-50"
                title="Remove signature"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowModal(true)}
          disabled={disabled}
          className={clsx(
            'flex items-center justify-center gap-2 w-full max-w-xs py-6',
            'border-2 border-dashed rounded-lg',
            'text-gray-500 hover:text-gray-700 hover:border-gray-400',
            'transition-colors',
            disabled && 'opacity-50 cursor-not-allowed',
            error && 'border-red-300'
          )}
        >
          <PenTool className="w-5 h-5" />
          <span>Click to sign</span>
        </button>
      )}

      {/* Error message */}
      {error && (
        <p className="mt-1 text-sm text-red-500">{error}</p>
      )}

      {/* Helper text */}
      {helperText && !error && (
        <p className="mt-1 text-sm text-gray-500">{helperText}</p>
      )}

      {/* Modal */}
      <SignatureModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSave={handleSave}
      />
    </div>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================
// All types and interfaces are exported inline above
