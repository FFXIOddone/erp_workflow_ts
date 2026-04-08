import { useEffect } from 'react';
import {
  Palette,
  Printer,
  Factory,
  Truck,
  ClipboardList,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { getStationColorTheme } from '@erp/shared';
import { useAuthStore } from '../stores/auth';
import { useConfigStore, type StationId } from '../stores/config';

interface StationDef {
  id: StationId;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Which allowedStations values map to this station */
  allowedKeys: string[];
}

const STATIONS: StationDef[] = [
  {
    id: 'DESIGN',
    label: 'Design',
    description: 'File management, proofing, design queue',
    icon: Palette,
    allowedKeys: ['DESIGN'],
  },
  {
    id: 'PRINTING',
    label: 'Printing',
    description: 'Print queue, RIP hotfolders, printer status',
    icon: Printer,
    allowedKeys: ['ROLL_TO_ROLL', 'FLATBED', 'PRINTING'],
  },
  {
    id: 'PRODUCTION',
    label: 'Production',
    description: 'Zund cutting, lamination, finishing',
    icon: Factory,
    allowedKeys: [
      'PRODUCTION',
      'SCREEN_PRINT',
      'FINISHING',
      'LAMINATION',
      'CNC_ROUTING',
      'ZUND_CUTTING',
    ],
  },
  {
    id: 'SHIPPING',
    label: 'Shipping',
    description: 'Pack, label, scan, ship orders',
    icon: Truck,
    allowedKeys: ['SHIPPING'],
  },
  {
    id: 'ORDER_ENTRY',
    label: 'Order Entry',
    description: 'Create and manage work orders',
    icon: ClipboardList,
    allowedKeys: ['ORDER_ENTRY'],
  },
  {
    id: 'INSTALLATION',
    label: 'Installation',
    description: 'On-site install timer, photos, GPS',
    icon: Wrench,
    allowedKeys: ['INSTALLATION'],
  },
];

export function StationPicker() {
  const { user, logout } = useAuthStore();
  const { setActiveStation } = useConfigStore();

  const allowedStations = user?.allowedStations || [];
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  // Filter stations the user has access to (admins see all)
  const available = isAdmin
    ? STATIONS
    : STATIONS.filter((s) => s.allowedKeys.some((k) => allowedStations.includes(k)));

  const singleStationId = available.length === 1 ? available[0].id : null;

  // If only one station, auto-select it.
  useEffect(() => {
    if (singleStationId) {
      setActiveStation(singleStationId);
    }
  }, [setActiveStation, singleStationId]);

  if (singleStationId) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-5xl rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-300/30">
        <div className="border-b border-slate-200 px-8 py-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Shop Floor
          </p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-3xl font-semibold text-slate-900">Station Selection</h1>
              <p className="mt-1 text-sm text-slate-600">
                Signed in as {user?.displayName}. Choose your work area to continue.
              </p>
            </div>
            <button
              onClick={logout}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
            >
              Sign out
            </button>
          </div>
        </div>

        {available.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 px-6 py-6 md:grid-cols-2 lg:grid-cols-3">
            {available.map((station) => {
              const Icon = station.icon;
              const theme = getStationColorTheme(station.id);
              return (
                <button
                  key={station.id}
                  onClick={() => setActiveStation(station.id)}
                  className="group rounded-xl border px-5 py-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                  style={{
                    background: theme.gradientColor,
                    borderColor: theme.gradientBorderColor,
                    color: theme.gradientTextColor,
                    boxShadow: `inset 0 0 0 1px ${theme.softBorderColor}`,
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wide opacity-80">
                        Station
                      </span>
                      <h2 className="mt-1 text-xl font-semibold">{station.label}</h2>
                    </div>
                    <Icon className="h-8 w-8 opacity-90 transition-transform group-hover:scale-105" />
                  </div>
                  <p className="mt-3 text-sm leading-relaxed opacity-90">{station.description}</p>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="m-6 rounded-xl border border-amber-300 bg-amber-50 px-6 py-5 text-center text-amber-900">
            <p className="font-semibold">No station access is configured for this account.</p>
            <p className="mt-1 text-sm text-amber-800">
              Ask an admin to add one of the shop-floor station permissions, then sign in again.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
