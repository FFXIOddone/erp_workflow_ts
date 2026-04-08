import { PrintingMethod } from './enums.js';
import { PARENT_SUB_STATIONS, SUB_STATION_PARENTS } from './constants.js';

export type StationColorFamily =
  | 'SALES'
  | 'ORDER_ENTRY'
  | 'DESIGN'
  | 'PRINTING'
  | 'PRODUCTION'
  | 'SHIPPING'
  | 'INSTALLATION'
  | 'COMPLETE'
  | 'DEFAULT';

const FAMILY_BASE_COLORS: Record<StationColorFamily, string> = {
  SALES: '#6366f1',
  ORDER_ENTRY: '#08e8de',
  DESIGN: '#8b5cf6',
  PRINTING: '#2563eb',
  PRODUCTION: '#f97316',
  SHIPPING: '#22c55e',
  INSTALLATION: '#facc15',
  COMPLETE: '#10b981',
  DEFAULT: '#64748b',
};

type ChannelRgb = { r: number; g: number; b: number };

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalizeHex(hex: string): string {
  const raw = hex.trim().replace('#', '');
  if (raw.length === 3) {
    return `#${raw
      .split('')
      .map((part) => `${part}${part}`)
      .join('')
      .toLowerCase()}`;
  }
  if (raw.length === 6) {
    return `#${raw.toLowerCase()}`;
  }
  return '#64748b';
}

function hexToRgb(hex: string): ChannelRgb {
  const normalized = normalizeHex(hex);
  const value = normalized.replace('#', '');
  const intValue = parseInt(value, 16);
  return {
    r: (intValue >> 16) & 255,
    g: (intValue >> 8) & 255,
    b: intValue & 255,
  };
}

function rgbToHex(rgb: ChannelRgb): string {
  const toHex = (channel: number): string => clamp(Math.round(channel), 0, 255).toString(16).padStart(2, '0');
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

function blendColors(base: string, target: string, amount: number): string {
  const ratio = clamp(amount, 0, 1);
  const left = hexToRgb(base);
  const right = hexToRgb(target);
  return rgbToHex({
    r: left.r + (right.r - left.r) * ratio,
    g: left.g + (right.g - left.g) * ratio,
    b: left.b + (right.b - left.b) * ratio,
  });
}

function getContrastTextColor(backgroundColor: string): string {
  const { r, g, b } = hexToRgb(backgroundColor);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.58 ? '#0f172a' : '#ffffff';
}

function resolveParentStation(station: string): string {
  const normalized = station.toUpperCase();
  return SUB_STATION_PARENTS[normalized] || normalized;
}

function resolveSubStationLevel(station: string): number {
  const normalized = station.toUpperCase();
  const parentStation = SUB_STATION_PARENTS[normalized];
  if (!parentStation) return 0;
  const siblingList = PARENT_SUB_STATIONS[parentStation] || [];
  const index = siblingList.indexOf(normalized);
  return index >= 0 ? index + 1 : 1;
}

export function getStationColorFamily(station: string): StationColorFamily {
  const normalized = resolveParentStation(station);

  if (normalized === PrintingMethod.ORDER_ENTRY) return 'ORDER_ENTRY';
  if (normalized === PrintingMethod.SALES) return 'SALES';
  if (normalized === PrintingMethod.DESIGN || normalized === PrintingMethod.DESIGN_ONLY) return 'DESIGN';
  if (normalized === 'PRINTING') return 'PRINTING';
  if (normalized === 'SHIPPING') return 'SHIPPING';
  if (
    normalized === PrintingMethod.FLATBED ||
    normalized === PrintingMethod.ROLL_TO_ROLL ||
    normalized === PrintingMethod.SCREEN_PRINT
  ) {
    return 'PRINTING';
  }
  if (normalized === PrintingMethod.PRODUCTION) return 'PRODUCTION';
  if (normalized === PrintingMethod.SHIPPING_RECEIVING) return 'SHIPPING';
  if (normalized === PrintingMethod.INSTALLATION) return 'INSTALLATION';
  if (normalized === PrintingMethod.COMPLETE) return 'COMPLETE';
  return 'DEFAULT';
}

export interface StationColorTheme {
  station: string;
  parentStation: string;
  family: StationColorFamily;
  subStationLevel: number;
  baseColor: string;
  solidColor: string;
  solidTextColor: string;
  softColor: string;
  softBorderColor: string;
  softTextColor: string;
  gradientColor: string;
  gradientBorderColor: string;
  gradientTextColor: string;
  dotColor: string;
}

export function getStationColorTheme(station: string): StationColorTheme {
  const normalized = station.toUpperCase();
  const parentStation = resolveParentStation(normalized);
  const family = getStationColorFamily(normalized);
  const subStationLevel = resolveSubStationLevel(normalized);
  const baseColor = FAMILY_BASE_COLORS[family];
  const level = Math.max(0, subStationLevel);

  const softColor = blendColors(baseColor, '#ffffff', 0.86);
  const softBorderColor = blendColors(baseColor, '#ffffff', 0.62);
  const softTextColor = blendColors(baseColor, '#0f172a', 0.58);

  const gradientStartBlend = clamp(0.92 - level * 0.09, 0.52, 0.92);
  const gradientEndBlend = clamp(0.82 - level * 0.1, 0.28, 0.82);
  const gradientStart = blendColors(baseColor, '#ffffff', gradientStartBlend);
  const gradientEnd = blendColors(baseColor, '#ffffff', gradientEndBlend);

  const gradientColor =
    level > 0
      ? `linear-gradient(135deg, ${gradientStart} 0%, ${gradientEnd} 100%)`
      : baseColor;
  const gradientBorderColor = blendColors(baseColor, '#ffffff', clamp(0.56 - level * 0.08, 0.25, 0.56));
  const gradientTextColor = level > 0 ? blendColors(baseColor, '#0f172a', 0.52) : getContrastTextColor(baseColor);

  return {
    station: normalized,
    parentStation,
    family,
    subStationLevel,
    baseColor,
    solidColor: baseColor,
    solidTextColor: getContrastTextColor(baseColor),
    softColor,
    softBorderColor,
    softTextColor,
    gradientColor,
    gradientBorderColor,
    gradientTextColor,
    dotColor: baseColor,
  };
}

export type StationProgressState = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

export function getStationStateStyle(
  station: string,
  status: StationProgressState = 'NOT_STARTED',
): { backgroundColor: string; borderColor: string; color: string } {
  const theme = getStationColorTheme(station);

  if (status === 'COMPLETED') {
    return {
      backgroundColor: blendColors(theme.baseColor, '#ffffff', 0.74),
      borderColor: blendColors(theme.baseColor, '#ffffff', 0.48),
      color: blendColors(theme.baseColor, '#0f172a', 0.5),
    };
  }

  if (status === 'IN_PROGRESS') {
    return {
      backgroundColor: blendColors(theme.baseColor, '#ffffff', 0.82),
      borderColor: blendColors(theme.baseColor, '#ffffff', 0.52),
      color: blendColors(theme.baseColor, '#0f172a', 0.58),
    };
  }

  return {
    backgroundColor: blendColors(theme.baseColor, '#ffffff', 0.92),
    borderColor: blendColors(theme.baseColor, '#ffffff', 0.7),
    color: blendColors(theme.baseColor, '#0f172a', 0.66),
  };
}
