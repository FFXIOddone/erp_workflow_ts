import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type StationId =
  | 'DESIGN'
  | 'PRINTING'
  | 'PRODUCTION'
  | 'SHIPPING'
  | 'ORDER_ENTRY'
  | 'INSTALLATION';

interface HotfolderConfig {
  name: string;
  path: string;
  ripType: 'Onyx' | 'Flexi' | 'Caldera' | 'VersaWorks' | 'Wasatch' | 'Other';
  autoCleanup: boolean;
  cleanupMinutes: number;
}

interface AppConfig {
  apiUrl: string;
  networkDrivePath: string;
  macNetworkDrivePath: string; // SMB mount path for Mac (e.g., /Volumes/Company Files/)
  hotfolders: HotfolderConfig[];
  defaultHotfolder: string | null;
  devMode: boolean;
  devFrontendUrl: string;
}

interface ConfigState {
  config: AppConfig;
  activeStation: StationId | null;
  isConfigured: boolean;
  setApiUrl: (url: string) => void;
  setNetworkDrivePath: (path: string) => void;
  setMacNetworkDrivePath: (path: string) => void;
  setActiveStation: (s: StationId | null) => void;
  addHotfolder: (h: HotfolderConfig) => void;
  removeHotfolder: (name: string) => void;
  setDevMode: (enabled: boolean) => void;
  setDevFrontendUrl: (url: string) => void;
}

function getBrowserHostname(): string {
  if (typeof window === 'undefined') return 'localhost';
  return window.location.hostname || 'localhost';
}

function isLocalHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function getDevApiUrl(): string {
  const hostname = getBrowserHostname();
  const apiHost = isLocalHostname(hostname) ? 'localhost' : hostname;
  return `http://${apiHost}:8001/api/v1`;
}

function shouldResetApiUrl(apiUrl: string): boolean {
  return (
    !apiUrl ||
    apiUrl.includes('tauri.localhost') ||
    apiUrl.includes('tauri://') ||
    apiUrl.includes('192.168.1.100') ||
    apiUrl.includes('localhost') ||
    apiUrl.includes('127.0.0.1') ||
    apiUrl.includes('[::1]')
  );
}

function getDefaultApiUrl(): string {
  // In browser dev mode, use the same host as the page so LAN clients
  // can reach the API on the ERP machine instead of their own localhost.
  if (!(import.meta as any).env?.PROD) {
    return getDevApiUrl();
  }
  // In Tauri (desktop app), point to the ERP server on the LAN
  if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
    return 'http://192.168.254.75:8001/api/v1';
  }
  // Browser production (served by the ERP server itself)
  if (typeof window === 'undefined') {
    return 'http://192.168.254.75:8001/api/v1';
  }
  return `${window.location.origin}/api/v1`;
}

const defaultConfig: AppConfig = {
  apiUrl: getDefaultApiUrl(),
  networkDrivePath: '',
  macNetworkDrivePath: '',
  hotfolders: [],
  defaultHotfolder: null,
  devMode: false,
  devFrontendUrl: 'http://192.168.254.75:8001/shop-floor/',
};

export const useConfigStore = create<ConfigState>()(
  persist(
    (set) => ({
      config: defaultConfig,
      activeStation: null,
      isConfigured: false,
      setApiUrl: (apiUrl) =>
        set((s) => ({ config: { ...s.config, apiUrl }, isConfigured: true })),
      setNetworkDrivePath: (networkDrivePath) =>
        set((s) => ({ config: { ...s.config, networkDrivePath } })),
      setMacNetworkDrivePath: (macNetworkDrivePath) =>
        set((s) => ({ config: { ...s.config, macNetworkDrivePath } })),
      setActiveStation: (activeStation) => set({ activeStation }),
      addHotfolder: (h) =>
        set((s) => ({
          config: { ...s.config, hotfolders: [...s.config.hotfolders, h] },
        })),
      removeHotfolder: (name) =>
        set((s) => ({
          config: {
            ...s.config,
            hotfolders: s.config.hotfolders.filter((h) => h.name !== name),
          },
        })),
      setDevMode: (enabled) =>
        set((s) => ({ config: { ...s.config, devMode: enabled } })),
      setDevFrontendUrl: (url) =>
        set((s) => ({ config: { ...s.config, devFrontendUrl: url } })),
    }),
    {
      name: 'shop-floor-config',
      version: 6,
      migrate: (persisted: any, version: number) => {
        const state = persisted?.state ?? persisted;
        const apiUrl = state?.config?.apiUrl || '';
        // Fix bad API URLs from earlier versions
        if (version < 6 && shouldResetApiUrl(apiUrl)) {
          return {
            ...state,
            config: {
              ...state?.config,
              apiUrl: getDefaultApiUrl(),
            },
          };
        }
        return state;
      },
    },
  ),
);
