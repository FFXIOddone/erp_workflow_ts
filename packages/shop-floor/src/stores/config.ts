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
  setActiveStation: (s: StationId) => void;
  addHotfolder: (h: HotfolderConfig) => void;
  removeHotfolder: (name: string) => void;
  setDevMode: (enabled: boolean) => void;
  setDevFrontendUrl: (url: string) => void;
}

function getDefaultApiUrl(): string {
  // In dev mode, use localhost
  if (!(import.meta as any).env?.PROD) {
    return 'http://localhost:8001/api/v1';
  }
  // In Tauri (desktop app), point to the ERP server on the LAN
  if ((window as any).__TAURI_INTERNALS__) {
    return 'http://192.168.254.75:8001/api/v1';
  }
  // Browser production (served by the ERP server itself)
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
      version: 4,
      migrate: (persisted: any, version: number) => {
        const state = persisted?.state ?? persisted;
        const apiUrl = state?.config?.apiUrl || '';
        // Fix bad API URLs from earlier versions
        if (
          apiUrl.includes('tauri.localhost') ||
          apiUrl.includes('tauri://') ||
          apiUrl.includes('192.168.1.100') ||
          (apiUrl.includes('localhost') && version < 3)
        ) {
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
