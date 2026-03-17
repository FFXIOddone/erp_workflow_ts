import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface HotfolderConfig {
  name: string;
  path: string;
  ripType: 'Onyx' | 'Flexi' | 'Caldera' | 'VersaWorks' | 'Wasatch' | 'Other';
  autoCleanup: boolean;
  cleanupMinutes: number;
}

interface PrinterConfig {
  id: string;
  name: string;
  type: 'HpLatex' | 'Roland' | 'Mimaki' | 'Epson' | 'Canon' | 'Generic';
  connectionType: 'snmp' | 'jdf' | 'folder';
  connectionDetails: {
    ip?: string;
    community?: string;
    url?: string;
    path?: string;
  };
}

interface AppConfig {
  apiUrl: string;
  networkDrivePath: string;
  hotfolders: HotfolderConfig[];
  printers: PrinterConfig[];
  defaultHotfolder: string | null;
}

interface ConfigState {
  config: AppConfig;
  isConfigured: boolean;
  setApiUrl: (url: string) => void;
  setNetworkDrivePath: (path: string) => void;
  addHotfolder: (hotfolder: HotfolderConfig) => void;
  removeHotfolder: (name: string) => void;
  updateHotfolder: (name: string, updates: Partial<HotfolderConfig>) => void;
  addPrinter: (printer: PrinterConfig) => void;
  removePrinter: (id: string) => void;
  setDefaultHotfolder: (name: string | null) => void;
}

const defaultConfig: AppConfig = {
  apiUrl: (import.meta as any).env?.PROD ? `${window.location.origin}/api/v1` : 'http://localhost:8001/api/v1',
  networkDrivePath: '',
  hotfolders: [],
  printers: [],
  defaultHotfolder: null,
};

export const useConfigStore = create<ConfigState>()(
  persist(
    (set) => ({
      config: defaultConfig,
      isConfigured: false,
      
      setApiUrl: (url) => set((state) => ({
        config: { ...state.config, apiUrl: url },
      })),
      
      setNetworkDrivePath: (path) => set((state) => ({
        config: { ...state.config, networkDrivePath: path },
        isConfigured: !!path,
      })),
      
      addHotfolder: (hotfolder) => set((state) => ({
        config: {
          ...state.config,
          hotfolders: [...state.config.hotfolders, hotfolder],
        },
      })),
      
      removeHotfolder: (name) => set((state) => ({
        config: {
          ...state.config,
          hotfolders: state.config.hotfolders.filter((h) => h.name !== name),
          defaultHotfolder: state.config.defaultHotfolder === name ? null : state.config.defaultHotfolder,
        },
      })),
      
      updateHotfolder: (name, updates) => set((state) => ({
        config: {
          ...state.config,
          hotfolders: state.config.hotfolders.map((h) =>
            h.name === name ? { ...h, ...updates } : h
          ),
        },
      })),
      
      addPrinter: (printer) => set((state) => ({
        config: {
          ...state.config,
          printers: [...state.config.printers, printer],
        },
      })),
      
      removePrinter: (id) => set((state) => ({
        config: {
          ...state.config,
          printers: state.config.printers.filter((p) => p.id !== id),
        },
      })),
      
      setDefaultHotfolder: (name) => set((state) => ({
        config: { ...state.config, defaultHotfolder: name },
      })),
    }),
    {
      name: 'order-entry-config',
    }
  )
);
