import { Outlet, NavLink, useNavigate, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  ClipboardList,
  Package,
  Users,
  FileText,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Settings,
  Bell,
  CalendarDays,
  BarChart3,
  Activity,
  Building2,
  Truck,
  Factory,
  FileSpreadsheet,
  Monitor,
  Wrench,
  Eye,
  type LucideIcon,
} from 'lucide-react';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../stores/auth';
import { useWebSocket } from '../hooks/useWebSocket';
import { UserRole, PrintingMethod } from '@erp/shared';
import { api } from '../lib/api';
import clsx from 'clsx';

// Navigation item interface
interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  roles: 'all' | UserRole[];
  stations?: PrintingMethod[];
}

// Navigation category interface
interface NavCategory {
  name: string;
  icon: LucideIcon;
  roles: 'all' | UserRole[];
  items: NavItem[];
}

// Standalone navigation items (no submenu)
const standaloneNavigation: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, roles: 'all' },
];

// Category-based navigation
const categoryNavigation: NavCategory[] = [
  {
    name: 'Orders',
    icon: ClipboardList,
    roles: 'all',
    items: [
      { name: 'Work Orders', href: '/orders', icon: ClipboardList, roles: 'all' },
    ],
  },
  {
    name: 'Production',
    icon: Factory,
    roles: [UserRole.ADMIN, UserRole.MANAGER],
    items: [
      { name: 'Schedule', href: '/schedule', icon: CalendarDays, roles: [UserRole.ADMIN, UserRole.MANAGER] },
      { name: 'RIP Queue', href: '/rip-queue', icon: Monitor, roles: [UserRole.ADMIN, UserRole.MANAGER] },
      { name: 'Production List', href: '/production-list', icon: FileSpreadsheet, roles: [UserRole.ADMIN, UserRole.MANAGER] },
    ],
  },
  {
    name: 'Equipment',
    icon: Wrench,
    roles: [UserRole.ADMIN, UserRole.MANAGER],
    items: [
      { name: 'Equipment', href: '/equipment', icon: Wrench, roles: [UserRole.ADMIN, UserRole.MANAGER] },
    ],
  },
  {
    name: 'Inventory',
    icon: Package,
    roles: 'all',
    items: [
      { name: 'Inventory', href: '/inventory', icon: Package, roles: 'all' },
    ],
  },
  {
    name: 'Shipping',
    icon: Truck,
    roles: [UserRole.ADMIN, UserRole.MANAGER],
    items: [
      { name: 'Shipments', href: '/shipments', icon: Truck, roles: [UserRole.ADMIN, UserRole.MANAGER] },
    ],
  },
  {
    name: 'Reports',
    icon: BarChart3,
    roles: [UserRole.ADMIN, UserRole.MANAGER],
    items: [
      { name: 'Reports', href: '/reports', icon: BarChart3, roles: [UserRole.ADMIN, UserRole.MANAGER] },
    ],
  },
  {
    name: 'Admin',
    icon: Settings,
    roles: [UserRole.ADMIN, UserRole.MANAGER],
    items: [
      { name: 'Users', href: '/users', icon: Users, roles: [UserRole.ADMIN, UserRole.MANAGER] },
      { name: 'Activity', href: '/activity', icon: Activity, roles: [UserRole.ADMIN, UserRole.MANAGER] },
      { name: 'Companies', href: '/companies', icon: Building2, roles: [UserRole.ADMIN, UserRole.MANAGER] },
      { name: 'Watch Rules', href: '/equipment-watch', icon: Eye, roles: [UserRole.ADMIN, UserRole.MANAGER] },
      { name: 'Templates', href: '/templates', icon: FileText, roles: [UserRole.ADMIN, UserRole.MANAGER], stations: [PrintingMethod.ORDER_ENTRY] },
      { name: 'Import Spreadsheet', href: '/import', icon: FileSpreadsheet, roles: [UserRole.ADMIN, UserRole.MANAGER] },
      { name: 'Settings', href: '/settings', icon: Settings, roles: [UserRole.ADMIN] },
    ],
  },
];

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  // Connect to WebSocket for real-time updates
  const { status: wsStatus } = useWebSocket();

  // Fetch unread notification count
  const { data: notificationCountData } = useQuery({
    queryKey: ['notifications', 'count'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: { count: number } }>('/notifications/count');
      return res.data.data;
    },
    refetchInterval: 60000,
  });

  const unreadCount = notificationCountData?.count ?? 0;

  // Check if user has role access to an item
  const hasRoleAccess = useCallback((roles: 'all' | UserRole[]): boolean => {
    if (!user) return false;
    if (roles === 'all') return true;
    return roles.includes(user.role as UserRole);
  }, [user]);

  // Check if user has station access
  const hasStationAccess = useCallback((stations?: PrintingMethod[]): boolean => {
    if (!stations) return true;
    if (!user?.allowedStations) return false;
    return stations.some(s => user.allowedStations?.includes(s));
  }, [user]);

  // Filter standalone navigation items
  const filteredStandalone = useMemo(() => {
    return standaloneNavigation.filter(item => 
      hasRoleAccess(item.roles) && hasStationAccess(item.stations)
    );
  }, [hasRoleAccess, hasStationAccess]);

  // Filter category navigation based on user permissions
  const filteredCategories = useMemo(() => {
    return categoryNavigation
      .filter(category => hasRoleAccess(category.roles))
      .map(category => ({
        ...category,
        items: category.items.filter(item => 
          hasRoleAccess(item.roles) && hasStationAccess(item.stations)
        ),
      }))
      .filter(category => category.items.length > 0);
  }, [hasRoleAccess, hasStationAccess]);

  // Auto-expand the category that contains the current page
  useEffect(() => {
    const currentPath = location.pathname;
    const matchingCategory = filteredCategories.find(cat => 
      cat.items.some(item => {
        if (item.href === '/') return currentPath === '/';
        return currentPath.startsWith(item.href);
      })
    );
    if (matchingCategory && !expandedCategories.includes(matchingCategory.name)) {
      setExpandedCategories(prev => [...prev, matchingCategory.name]);
    }
  }, [location.pathname, filteredCategories]);

  // Toggle category expansion
  const toggleCategory = (categoryName: string) => {
    setExpandedCategories(prev => 
      prev.includes(categoryName)
        ? prev.filter(name => name !== categoryName)
        : [...prev, categoryName]
    );
  };

  // Check if a category contains the active page
  const isCategoryActive = (category: NavCategory): boolean => {
    return category.items.some(item => {
      if (item.href === '/') return location.pathname === '/';
      return location.pathname.startsWith(item.href);
    });
  };

  // Close sidebar on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-gray-900/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 w-64 flex-shrink-0 bg-white border-r border-gray-200 transform transition-transform lg:translate-x-0 flex flex-col h-screen',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo Header */}
        <div className="flex flex-col h-20 justify-center px-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-cyan-500 bg-clip-text text-transparent tracking-tight">
              BUNDA™
            </h1>
            <button
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
          <p className="text-[9px] text-gray-400 leading-tight tracking-wide">
            Business Unification via Next-Generation Data Architecture
          </p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {/* Standalone navigation items (Dashboard) */}
          {filteredStandalone.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              end={item.href === '/'}
              className={({ isActive }) =>
                clsx(
                  'flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all group',
                  isActive
                    ? 'bg-primary-50 text-primary-700 shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                )
              }
              onClick={() => setSidebarOpen(false)}
            >
              {({ isActive }) => (
                <>
                  <item.icon className={clsx(
                    "mr-3 h-5 w-5 transition-colors",
                    isActive ? "text-primary-600" : "text-gray-400 group-hover:text-gray-600"
                  )} />
                  <span className="flex-1">{item.name}</span>
                </>
              )}
            </NavLink>
          ))}

          {/* Divider */}
          {filteredStandalone.length > 0 && filteredCategories.length > 0 && (
            <div className="my-2 border-t border-gray-100" />
          )}

          {/* Category-based navigation */}
          {filteredCategories.map((category) => {
            const isExpanded = expandedCategories.includes(category.name);
            const isActive = isCategoryActive(category);

            // Single-item categories render as standalone links (no dropdown)
            if (category.items.length === 1) {
              const item = category.items[0];
              return (
                <NavLink
                  key={category.name}
                  to={item.href}
                  end={item.href === '/'}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all group',
                      isActive
                        ? 'bg-primary-50 text-primary-700 shadow-sm'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    )
                  }
                  onClick={() => setSidebarOpen(false)}
                >
                  {({ isActive }) => (
                    <>
                      <item.icon className={clsx(
                        "mr-3 h-5 w-5 transition-colors",
                        isActive ? "text-primary-600" : "text-gray-400 group-hover:text-gray-600"
                      )} />
                      <span className="flex-1">{item.name}</span>
                    </>
                  )}
                </NavLink>
              );
            }

            return (
              <div key={category.name} className="space-y-1">
                {/* Category header button */}
                <button
                  onClick={() => toggleCategory(category.name)}
                  className={clsx(
                    'flex items-center w-full px-3 py-2.5 text-sm font-medium rounded-lg transition-all group',
                    isActive
                      ? 'bg-primary-50/50 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  )}
                >
                  <category.icon className={clsx(
                    "mr-3 h-5 w-5 transition-colors",
                    isActive ? "text-primary-600" : "text-gray-400 group-hover:text-gray-600"
                  )} />
                  <span className="flex-1 text-left">{category.name}</span>
                  <ChevronDown className={clsx(
                    "h-4 w-4 transition-transform duration-200",
                    isActive ? "text-primary-400" : "text-gray-400",
                    isExpanded && "rotate-180"
                  )} />
                </button>

                {/* Category items (collapsible) */}
                <div className={clsx(
                  'overflow-hidden transition-all duration-200',
                  isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                )}>
                  <div className="pl-4 space-y-0.5">
                    {category.items.map((item) => (
                      <NavLink
                        key={item.href}
                        to={item.href}
                        end={item.href === '/'}
                        className={({ isActive }) =>
                          clsx(
                            'flex items-center px-3 py-2 text-sm rounded-lg transition-all group',
                            isActive
                              ? 'bg-primary-50 text-primary-700 font-medium'
                              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                          )
                        }
                        onClick={() => setSidebarOpen(false)}
                      >
                        {({ isActive }) => (
                          <>
                            <item.icon className={clsx(
                              "mr-3 h-4 w-4 transition-colors",
                              isActive ? "text-primary-600" : "text-gray-400 group-hover:text-gray-500"
                            )} />
                            <span className="flex-1">{item.name}</span>
                          </>
                        )}
                      </NavLink>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </nav>

        {/* User Section */}
        <div className="border-t border-gray-100 p-4 bg-gray-50/50 space-y-3">
          {/* Connection Status */}
          <div className="flex items-center gap-2 px-2">
            <span 
              className={`w-2 h-2 rounded-full ${
                wsStatus === 'connected' 
                  ? 'bg-green-500' 
                  : wsStatus === 'connecting' 
                  ? 'bg-amber-500 animate-pulse' 
                  : 'bg-red-500'
              }`} 
            />
            <span className="text-xs text-gray-500">
              {wsStatus === 'connected' 
                ? 'Live updates active' 
                : wsStatus === 'connecting' 
                ? 'Connecting...' 
                : 'Reconnecting...'}
            </span>
          </div>
          
          <div className="flex items-center gap-3">
            <Link 
              to="/profile"
              className="h-9 w-9 rounded-full bg-gradient-to-br from-primary-500 to-cyan-500 flex items-center justify-center text-white font-semibold text-sm shadow-sm hover:ring-2 hover:ring-primary-300 transition-all"
              title="View Profile"
            >
              {user?.displayName?.charAt(0)?.toUpperCase() ?? 'U'}
            </Link>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{user?.displayName}</p>
              <p className="text-xs text-gray-500">{user?.role}</p>
            </div>
            <Link
              to="/notifications"
              className="relative p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
              title="Notifications"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center text-xs font-bold text-white bg-red-500 rounded-full">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
            <Link
              to="/profile"
              className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
              title="Profile Settings"
            >
              <Settings className="h-4 w-4" />
            </Link>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0 lg:ml-64">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center justify-between h-14 px-4 bg-white border-b border-gray-100">
          <button
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5 text-gray-600" />
          </button>
          <h1 className="text-lg font-bold bg-gradient-to-r from-primary-600 to-cyan-500 bg-clip-text text-transparent">
            BUNDA™
          </h1>
          <div className="w-9" /> {/* Spacer for centering */}
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-x-hidden overflow-y-auto">
          <div className="max-w-full mx-auto animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
