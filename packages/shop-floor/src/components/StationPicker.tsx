import {
  Palette,
  Printer,
  Factory,
  Truck,
  ClipboardList,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { useAuthStore } from '../stores/auth';
import { useConfigStore, type StationId } from '../stores/config';

interface StationDef {
  id: StationId;
  label: string;
  description: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  /** Which allowedStations values map to this station */
  allowedKeys: string[];
}

const STATIONS: StationDef[] = [
  {
    id: 'DESIGN',
    label: 'Design',
    description: 'File management, proofing, design queue',
    icon: Palette,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100 hover:bg-purple-200 border-purple-300',
    allowedKeys: ['DESIGN'],
  },
  {
    id: 'PRINTING',
    label: 'Printing',
    description: 'Print queue, RIP hotfolders, printer status',
    icon: Printer,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100 hover:bg-blue-200 border-blue-300',
    allowedKeys: ['ROLL_TO_ROLL', 'FLATBED', 'SCREEN_PRINT', 'PRINTING'],
  },
  {
    id: 'PRODUCTION',
    label: 'Production',
    description: 'Zund cutting, lamination, finishing',
    icon: Factory,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100 hover:bg-orange-200 border-orange-300',
    allowedKeys: ['PRODUCTION', 'FINISHING', 'LAMINATION', 'CNC_ROUTING', 'ZUND_CUTTING'],
  },
  {
    id: 'SHIPPING',
    label: 'Shipping',
    description: 'Pack, label, scan, ship orders',
    icon: Truck,
    color: 'text-green-600',
    bgColor: 'bg-green-100 hover:bg-green-200 border-green-300',
    allowedKeys: ['SHIPPING'],
  },
  {
    id: 'ORDER_ENTRY',
    label: 'Order Entry',
    description: 'Create and manage work orders',
    icon: ClipboardList,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-100 hover:bg-indigo-200 border-indigo-300',
    allowedKeys: ['ORDER_ENTRY'],
  },
  {
    id: 'INSTALLATION',
    label: 'Installation',
    description: 'On-site install timer, photos, GPS',
    icon: Wrench,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100 hover:bg-amber-200 border-amber-300',
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
    : STATIONS.filter((s) =>
        s.allowedKeys.some((k) => allowedStations.includes(k)),
      );

  // If only one station, auto-select it
  if (available.length === 1) {
    setActiveStation(available[0].id);
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-8">
      <div className="max-w-3xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome, {user?.displayName}
          </h1>
          <p className="text-gray-500 mt-1">Select your station</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {available.map((station) => {
            const Icon = station.icon;
            return (
              <button
                key={station.id}
                onClick={() => setActiveStation(station.id)}
                className={`flex flex-col items-center p-6 rounded-xl border-2 transition-all ${station.bgColor}`}
              >
                <Icon className={`w-12 h-12 ${station.color} mb-3`} />
                <span className="font-semibold text-gray-900 text-lg">
                  {station.label}
                </span>
                <span className="text-sm text-gray-500 mt-1 text-center">
                  {station.description}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-8 text-center">
          <button
            onClick={logout}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
