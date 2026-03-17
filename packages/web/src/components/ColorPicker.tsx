/**
 * ColorPicker.tsx - CRITICAL-31
 * 
 * Color selection component for the ERP application.
 * Supports various input methods and color formats.
 * 
 * Features:
 * - 31.1: Color swatch presets
 * - 31.2: Hex/RGB/HSL input modes
 * - 31.3: Gradient color picker (hue/saturation)
 * - 31.4: Opacity/alpha slider
 * - 31.5: Recently used colors
 * 
 * @module ColorPicker
 */

import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  type ReactNode,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { clsx } from 'clsx';
import { Pipette, Check, ChevronDown, X } from 'lucide-react';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/** Color value in different formats */
export interface ColorValue {
  hex: string;
  rgb: { r: number; g: number; b: number };
  hsl: { h: number; s: number; l: number };
  alpha: number;
}

/** Color preset */
export interface ColorPreset {
  name: string;
  color: string;
}

/** Color picker props */
export interface ColorPickerProps {
  /** Selected color (hex) */
  value?: string;
  /** Default color */
  defaultValue?: string;
  /** On color change */
  onChange?: (color: string) => void;
  /** On change complete (after drag) */
  onChangeComplete?: (color: string) => void;
  /** Color presets */
  presets?: ColorPreset[];
  /** Show preset palette */
  showPresets?: boolean;
  /** Show hex input */
  showHexInput?: boolean;
  /** Show RGB inputs */
  showRgbInput?: boolean;
  /** Show alpha slider */
  showAlpha?: boolean;
  /** Show recent colors */
  showRecent?: boolean;
  /** Max recent colors */
  maxRecent?: number;
  /** Disabled state */
  disabled?: boolean;
  /** Size */
  size?: 'sm' | 'md' | 'lg';
  /** Class name */
  className?: string;
}

/** Color swatch props */
export interface ColorSwatchProps {
  /** Color value (hex) */
  color: string;
  /** Is selected */
  selected?: boolean;
  /** On click */
  onClick?: () => void;
  /** Size */
  size?: 'sm' | 'md' | 'lg';
  /** Show tooltip */
  tooltip?: string;
  /** Disabled */
  disabled?: boolean;
  /** Class name */
  className?: string;
}

/** Color input props */
export interface ColorInputProps {
  /** Current color (hex) */
  value?: string;
  /** On change */
  onChange?: (color: string) => void;
  /** Placeholder */
  placeholder?: string;
  /** Disabled */
  disabled?: boolean;
  /** Class name */
  className?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Default color presets */
export const DEFAULT_PRESETS: ColorPreset[] = [
  { name: 'Red', color: '#EF4444' },
  { name: 'Orange', color: '#F97316' },
  { name: 'Amber', color: '#F59E0B' },
  { name: 'Yellow', color: '#EAB308' },
  { name: 'Lime', color: '#84CC16' },
  { name: 'Green', color: '#22C55E' },
  { name: 'Emerald', color: '#10B981' },
  { name: 'Teal', color: '#14B8A6' },
  { name: 'Cyan', color: '#06B6D4' },
  { name: 'Sky', color: '#0EA5E9' },
  { name: 'Blue', color: '#3B82F6' },
  { name: 'Indigo', color: '#6366F1' },
  { name: 'Violet', color: '#8B5CF6' },
  { name: 'Purple', color: '#A855F7' },
  { name: 'Fuchsia', color: '#D946EF' },
  { name: 'Pink', color: '#EC4899' },
  { name: 'Rose', color: '#F43F5E' },
  { name: 'Gray', color: '#6B7280' },
  { name: 'Slate', color: '#64748B' },
  { name: 'Zinc', color: '#71717A' },
];

/** Grayscale presets */
export const GRAYSCALE_PRESETS: ColorPreset[] = [
  { name: 'Black', color: '#000000' },
  { name: 'Gray 900', color: '#111827' },
  { name: 'Gray 800', color: '#1F2937' },
  { name: 'Gray 700', color: '#374151' },
  { name: 'Gray 600', color: '#4B5563' },
  { name: 'Gray 500', color: '#6B7280' },
  { name: 'Gray 400', color: '#9CA3AF' },
  { name: 'Gray 300', color: '#D1D5DB' },
  { name: 'Gray 200', color: '#E5E7EB' },
  { name: 'Gray 100', color: '#F3F4F6' },
  { name: 'White', color: '#FFFFFF' },
];

// ============================================================================
// COLOR UTILITIES
// ============================================================================

/** Parse hex to RGB */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/** RGB to hex */
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((x) => {
    const hex = Math.round(Math.max(0, Math.min(255, x))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

/** RGB to HSL */
function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/** HSL to RGB */
function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  h /= 360;
  s /= 100;
  l /= 100;

  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

/** Parse any color to hex */
function parseColor(color: string): string {
  // Already hex
  if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
    return color.toUpperCase();
  }
  
  // Short hex
  if (/^#[0-9A-Fa-f]{3}$/.test(color)) {
    return ('#' + color.slice(1).split('').map(c => c + c).join('')).toUpperCase();
  }

  // RGB
  const rgbMatch = color.match(/^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
  if (rgbMatch) {
    return rgbToHex(parseInt(rgbMatch[1]), parseInt(rgbMatch[2]), parseInt(rgbMatch[3]));
  }

  return color;
}

/** Check if color is valid hex */
function isValidHex(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}

/** Get contrast color (black or white) */
function getContrastColor(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#000000';
  
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

// ============================================================================
// 31.1: COLOR SWATCH
// ============================================================================

/**
 * Individual color swatch
 */
export function ColorSwatch({
  color,
  selected = false,
  onClick,
  size = 'md',
  tooltip,
  disabled = false,
  className,
}: ColorSwatchProps) {
  const sizeClasses = {
    sm: 'w-5 h-5',
    md: 'w-7 h-7',
    lg: 'w-9 h-9',
  };

  const contrastColor = getContrastColor(color);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={tooltip}
      className={clsx(
        'rounded-md transition-transform',
        'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500',
        'hover:scale-110',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100',
        sizeClasses[size],
        selected && 'ring-2 ring-offset-2 ring-blue-500',
        className
      )}
      style={{ backgroundColor: color }}
    >
      {selected && (
        <Check className="w-full h-full p-0.5" style={{ color: contrastColor }} />
      )}
    </button>
  );
}

// ============================================================================
// 31.2: COLOR INPUT
// ============================================================================

/**
 * Hex color input field
 */
export function ColorInput({
  value = '',
  onChange,
  placeholder = '#000000',
  disabled = false,
  className,
}: ColorInputProps) {
  const [inputValue, setInputValue] = useState(value);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = e.target.value;
    
    // Add # if missing
    if (newValue && !newValue.startsWith('#')) {
      newValue = '#' + newValue;
    }
    
    setInputValue(newValue);

    // Only trigger onChange for valid colors
    if (isValidHex(newValue)) {
      onChange?.(newValue.toUpperCase());
    }
  };

  const handleBlur = () => {
    if (inputValue && isValidHex(inputValue)) {
      onChange?.(inputValue.toUpperCase());
    } else if (value) {
      setInputValue(value);
    }
  };

  return (
    <div className={clsx('flex items-center gap-2', className)}>
      {/* Color preview */}
      <div
        className="w-8 h-8 rounded border border-gray-300 dark:border-gray-600 flex-shrink-0"
        style={{ backgroundColor: isValidHex(inputValue) ? inputValue : value || '#FFFFFF' }}
      />

      {/* Input */}
      <input
        type="text"
        value={inputValue}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={7}
        className={clsx(
          'flex-1 px-2 py-1.5 text-sm font-mono',
          'border border-gray-300 dark:border-gray-600 rounded-md',
          'bg-white dark:bg-gray-800',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      />
    </div>
  );
}

// ============================================================================
// 31.3: GRADIENT PICKER
// ============================================================================

interface GradientPickerProps {
  hue: number;
  saturation: number;
  lightness: number;
  onSaturationLightnessChange: (s: number, l: number) => void;
  className?: string;
}

function GradientPicker({
  hue,
  saturation,
  lightness,
  onSaturationLightnessChange,
  className,
}: GradientPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = (e: ReactMouseEvent) => {
    setIsDragging(true);
    updatePosition(e);
  };

  const updatePosition = useCallback((e: MouseEvent | ReactMouseEvent) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    // X = saturation (0-100), Y = lightness inverted (100-0)
    const s = Math.round(x * 100);
    const l = Math.round((1 - y) * 50 + 25); // Map Y to 25-75 range for better color distribution

    onSaturationLightnessChange(s, l);
  }, [onSaturationLightnessChange]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => updatePosition(e);
    const handleMouseUp = () => setIsDragging(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, updatePosition]);

  // Position of the selector (convert sat/light back to x/y)
  const selectorX = saturation;
  const selectorY = 100 - ((lightness - 25) / 50 * 100);

  return (
    <div
      ref={containerRef}
      className={clsx(
        'relative w-full h-40 rounded-lg cursor-crosshair overflow-hidden',
        className
      )}
      style={{
        background: `
          linear-gradient(to top, #000 0%, transparent 100%),
          linear-gradient(to right, #fff 0%, hsl(${hue}, 100%, 50%) 100%)
        `,
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Selector */}
      <div
        className={clsx(
          'absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2',
          'rounded-full border-2 border-white shadow-md pointer-events-none'
        )}
        style={{
          left: `${selectorX}%`,
          top: `${selectorY}%`,
          backgroundColor: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
        }}
      />
    </div>
  );
}

// ============================================================================
// 31.4: HUE/ALPHA SLIDER
// ============================================================================

interface ColorSliderProps {
  type: 'hue' | 'alpha';
  value: number;
  onChange: (value: number) => void;
  color?: string;
  className?: string;
}

function ColorSlider({
  type,
  value,
  onChange,
  color = '#FF0000',
  className,
}: ColorSliderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = (e: ReactMouseEvent) => {
    setIsDragging(true);
    updatePosition(e);
  };

  const updatePosition = useCallback((e: MouseEvent | ReactMouseEvent) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    
    if (type === 'hue') {
      onChange(Math.round(x * 360));
    } else {
      onChange(Math.round(x * 100) / 100);
    }
  }, [onChange, type]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => updatePosition(e);
    const handleMouseUp = () => setIsDragging(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, updatePosition]);

  const percentage = type === 'hue' ? (value / 360) * 100 : value * 100;

  const background = type === 'hue'
    ? 'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)'
    : `linear-gradient(to right, transparent, ${color})`;

  return (
    <div
      ref={containerRef}
      className={clsx(
        'relative h-3 rounded-full cursor-pointer',
        type === 'alpha' && 'bg-[url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'8\' height=\'8\' fill-opacity=\'.1\'%3E%3Crect x=\'4\' width=\'4\' height=\'4\'/%3E%3Crect y=\'4\' width=\'4\' height=\'4\'/%3E%3C/svg%3E")]',
        className
      )}
      onMouseDown={handleMouseDown}
    >
      <div
        className="absolute inset-0 rounded-full"
        style={{ background }}
      />
      <div
        className={clsx(
          'absolute top-1/2 w-4 h-4 -translate-x-1/2 -translate-y-1/2',
          'rounded-full border-2 border-white shadow-md'
        )}
        style={{
          left: `${percentage}%`,
          backgroundColor: type === 'hue' ? `hsl(${value}, 100%, 50%)` : color,
        }}
      />
    </div>
  );
}

// ============================================================================
// 31.5: RECENT COLORS
// ============================================================================

const RECENT_COLORS_KEY = 'erp-recent-colors';

function useRecentColors(maxColors = 8): [string[], (color: string) => void] {
  const [recentColors, setRecentColors] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(RECENT_COLORS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const addRecentColor = useCallback((color: string) => {
    setRecentColors((prev) => {
      const filtered = prev.filter((c) => c.toUpperCase() !== color.toUpperCase());
      const updated = [color.toUpperCase(), ...filtered].slice(0, maxColors);
      try {
        localStorage.setItem(RECENT_COLORS_KEY, JSON.stringify(updated));
      } catch {
        // Ignore storage errors
      }
      return updated;
    });
  }, [maxColors]);

  return [recentColors, addRecentColor];
}

// ============================================================================
// 31.1-31.5: COLOR PICKER COMPONENT
// ============================================================================

/**
 * Full-featured color picker
 * 
 * @example
 * ```tsx
 * const [color, setColor] = useState('#3B82F6');
 * 
 * <ColorPicker
 *   value={color}
 *   onChange={setColor}
 *   showPresets
 *   showRecent
 * />
 * ```
 */
export function ColorPicker({
  value,
  defaultValue = '#3B82F6',
  onChange,
  onChangeComplete,
  presets = DEFAULT_PRESETS,
  showPresets = true,
  showHexInput = true,
  showRgbInput = false,
  showAlpha = false,
  showRecent = true,
  maxRecent = 8,
  disabled = false,
  size = 'md',
  className,
}: ColorPickerProps) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [recentColors, addRecentColor] = useRecentColors(maxRecent);
  const [alpha, setAlpha] = useState(1);

  const currentColor = value ?? internalValue;

  // Parse current color to HSL
  const rgb = useMemo(() => hexToRgb(currentColor), [currentColor]);
  const hsl = useMemo(() => {
    if (!rgb) return { h: 0, s: 100, l: 50 };
    return rgbToHsl(rgb.r, rgb.g, rgb.b);
  }, [rgb]);

  const [hue, setHue] = useState(hsl.h);
  const [saturation, setSaturation] = useState(hsl.s);
  const [lightness, setLightness] = useState(hsl.l);

  // Update HSL when value changes externally
  useEffect(() => {
    if (rgb) {
      const newHsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
      setHue(newHsl.h);
      setSaturation(newHsl.s);
      setLightness(newHsl.l);
    }
  }, [currentColor, rgb]);

  // Handle color change
  const handleColorChange = useCallback((newColor: string) => {
    if (!isValidHex(newColor)) return;

    if (value === undefined) {
      setInternalValue(newColor);
    }
    onChange?.(newColor);
  }, [value, onChange]);

  // Handle HSL changes
  const handleHslChange = useCallback(() => {
    const newRgb = hslToRgb(hue, saturation, lightness);
    const newHex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
    handleColorChange(newHex);
  }, [hue, saturation, lightness, handleColorChange]);

  const handleSaturationLightnessChange = useCallback((s: number, l: number) => {
    setSaturation(s);
    setLightness(l);
    const newRgb = hslToRgb(hue, s, l);
    const newHex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
    handleColorChange(newHex);
  }, [hue, handleColorChange]);

  const handleHueChange = useCallback((h: number) => {
    setHue(h);
    const newRgb = hslToRgb(h, saturation, lightness);
    const newHex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
    handleColorChange(newHex);
  }, [saturation, lightness, handleColorChange]);

  // Handle preset click
  const handlePresetClick = useCallback((color: string) => {
    handleColorChange(color);
    addRecentColor(color);
    onChangeComplete?.(color);
  }, [handleColorChange, addRecentColor, onChangeComplete]);

  return (
    <div className={clsx('w-64 p-3 space-y-3', disabled && 'opacity-50 pointer-events-none', className)}>
      {/* Gradient picker */}
      <GradientPicker
        hue={hue}
        saturation={saturation}
        lightness={lightness}
        onSaturationLightnessChange={handleSaturationLightnessChange}
      />

      {/* Hue slider */}
      <div className="space-y-2">
        <label className="text-xs text-gray-500 dark:text-gray-400">Hue</label>
        <ColorSlider
          type="hue"
          value={hue}
          onChange={handleHueChange}
        />
      </div>

      {/* Alpha slider */}
      {showAlpha && (
        <div className="space-y-2">
          <label className="text-xs text-gray-500 dark:text-gray-400">Opacity</label>
          <ColorSlider
            type="alpha"
            value={alpha}
            onChange={setAlpha}
            color={currentColor}
          />
        </div>
      )}

      {/* Hex input */}
      {showHexInput && (
        <ColorInput
          value={currentColor}
          onChange={handleColorChange}
        />
      )}

      {/* RGB inputs */}
      {showRgbInput && rgb && (
        <div className="flex gap-2">
          <div>
            <label className="text-xs text-gray-500">R</label>
            <input
              type="number"
              min={0}
              max={255}
              value={rgb.r}
              onChange={(e) => {
                const newRgb = { ...rgb, r: parseInt(e.target.value) || 0 };
                handleColorChange(rgbToHex(newRgb.r, newRgb.g, newRgb.b));
              }}
              className="w-full px-2 py-1 text-sm border rounded"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">G</label>
            <input
              type="number"
              min={0}
              max={255}
              value={rgb.g}
              onChange={(e) => {
                const newRgb = { ...rgb, g: parseInt(e.target.value) || 0 };
                handleColorChange(rgbToHex(newRgb.r, newRgb.g, newRgb.b));
              }}
              className="w-full px-2 py-1 text-sm border rounded"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">B</label>
            <input
              type="number"
              min={0}
              max={255}
              value={rgb.b}
              onChange={(e) => {
                const newRgb = { ...rgb, b: parseInt(e.target.value) || 0 };
                handleColorChange(rgbToHex(newRgb.r, newRgb.g, newRgb.b));
              }}
              className="w-full px-2 py-1 text-sm border rounded"
            />
          </div>
        </div>
      )}

      {/* Recent colors */}
      {showRecent && recentColors.length > 0 && (
        <div className="space-y-2">
          <label className="text-xs text-gray-500 dark:text-gray-400">Recent</label>
          <div className="flex flex-wrap gap-1">
            {recentColors.map((color, index) => (
              <ColorSwatch
                key={`${color}-${index}`}
                color={color}
                selected={color === currentColor}
                onClick={() => handlePresetClick(color)}
                size="sm"
              />
            ))}
          </div>
        </div>
      )}

      {/* Presets */}
      {showPresets && presets.length > 0 && (
        <div className="space-y-2">
          <label className="text-xs text-gray-500 dark:text-gray-400">Presets</label>
          <div className="flex flex-wrap gap-1">
            {presets.map((preset) => (
              <ColorSwatch
                key={preset.color}
                color={preset.color}
                selected={preset.color.toUpperCase() === currentColor.toUpperCase()}
                onClick={() => handlePresetClick(preset.color)}
                size={size}
                tooltip={preset.name}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// COLOR PICKER TRIGGER (button + dropdown)
// ============================================================================

export interface ColorPickerTriggerProps extends Omit<ColorPickerProps, 'className'> {
  /** Button label */
  label?: string;
  /** Show color name/hex */
  showLabel?: boolean;
  /** Trigger class name */
  triggerClassName?: string;
  /** Dropdown class name */
  dropdownClassName?: string;
}

/**
 * Color picker with trigger button
 * 
 * @example
 * ```tsx
 * <ColorPickerTrigger
 *   value={color}
 *   onChange={setColor}
 *   label="Background Color"
 * />
 * ```
 */
export function ColorPickerTrigger({
  value,
  label,
  showLabel = true,
  triggerClassName,
  dropdownClassName,
  ...pickerProps
}: ColorPickerTriggerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const currentColor = value || pickerProps.defaultValue || '#3B82F6';

  return (
    <div className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'flex items-center gap-2 px-3 py-2 rounded-md border',
          'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600',
          'hover:border-gray-400 dark:hover:border-gray-500',
          'focus:outline-none focus:ring-2 focus:ring-blue-500',
          triggerClassName
        )}
      >
        <div
          className="w-5 h-5 rounded border border-gray-300 dark:border-gray-600"
          style={{ backgroundColor: currentColor }}
        />
        {showLabel && (
          <span className="text-sm text-gray-700 dark:text-gray-200">
            {label || currentColor}
          </span>
        )}
        <ChevronDown className="w-4 h-4 text-gray-400" />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div
            className={clsx(
              'absolute top-full left-0 mt-1 z-20',
              'bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700',
              dropdownClassName
            )}
          >
            <ColorPicker
              value={value}
              {...pickerProps}
              onChangeComplete={(color) => {
                pickerProps.onChangeComplete?.(color);
                setIsOpen(false);
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  // Utilities
  hexToRgb,
  rgbToHex,
  rgbToHsl,
  hslToRgb,
  parseColor,
  isValidHex,
  getContrastColor,
  // Constants are exported inline
};

// Types are already exported inline
