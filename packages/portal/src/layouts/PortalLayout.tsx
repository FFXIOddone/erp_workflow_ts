import { useState } from 'react';
import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Package,
  FileCheck,
  MessageSquare,
  User,
  LogOut,
  Menu,
  X,
  Bell,
  ChevronDown,
  FileText,
  Truck,
  FolderOpen,
  RefreshCw,
  Sparkles,
  Calculator,
  BarChart3,
  CreditCard,
  HelpCircle,
  Home,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { messagesApi, proofsApi } from '@/lib/api';
import { cn, getInitials } from '@/lib/utils';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/hub', label: 'Self-Service Hub', icon: Sparkles },
  { to: '/intelligence', label: 'My Insights', icon: BarChart3 },
  { to: '/quotes', label: 'Quotes', icon: Calculator },
  { to: '/orders', label: 'My Orders', icon: Package },
  { to: '/invoices', label: 'Invoices', icon: FileText },
  { to: '/payments', label: 'Payments', icon: CreditCard },
  { to: '/shipments', label: 'Shipments', icon: Truck },
  { to: '/documents', label: 'Documents', icon: FolderOpen },
  { to: '/subscriptions', label: 'Subscriptions', icon: RefreshCw },
  { to: '/proofs', label: 'Proof Approvals', icon: FileCheck },
  { to: '/messages', label: 'Messages', icon: MessageSquare },
  { to: '/support', label: 'Support', icon: HelpCircle },
];

// Mobile bottom nav items (subset)
const mobileNavItems = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/orders', label: 'Orders', icon: Package },
  { to: '/proofs', label: 'Proofs', icon: FileCheck },
  { to: '/messages', label: 'Messages', icon: MessageSquare },
  { to: '/hub', label: 'Hub', icon: Sparkles },
];

export function PortalLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  // Fetch unread counts for badges
  const { data: unreadData } = useQuery({
    queryKey: ['unread-count'],
    queryFn: () => messagesApi.getUnreadCount().then((r) => r.data.data),
    refetchInterval: 60000, // Refresh every minute
  });

  const { data: pendingProofs } = useQuery({
    queryKey: ['pending-proofs'],
    queryFn: () => proofsApi.list().then((r) => r.data.data),
    refetchInterval: 60000,
  });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getBadgeCount = (path: string) => {
    if (path === '/messages') return unreadData?.count || 0;
    if (path === '/proofs') return pendingProofs?.length || 0;
    return 0;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden lg:flex flex-col bg-white border-r border-gray-200 fixed inset-y-0 left-0 z-30 transition-all duration-300',
          sidebarCollapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* Sidebar Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
          {!sidebarCollapsed && (
            <Link to="/" className="flex items-center gap-3">
              <div className="w-9 h-9 bg-primary-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-lg font-bold text-white">W</span>
              </div>
              <div>
                <div className="text-lg font-semibold text-gray-900">Wilde Signs</div>
                <div className="text-xs text-gray-500 -mt-0.5">Customer Portal</div>
              </div>
            </Link>
          )}
          {sidebarCollapsed && (
            <Link to="/" className="w-9 h-9 bg-primary-600 rounded-lg flex items-center justify-center mx-auto">
              <span className="text-lg font-bold text-white">W</span>
            </Link>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-2">
          {navItems.map((item) => {
            const badge = getBadgeCount(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                title={sidebarCollapsed ? item.label : undefined}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative mb-1',
                    isActive
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100',
                    sidebarCollapsed && 'justify-center px-2'
                  )
                }
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {!sidebarCollapsed && <span>{item.label}</span>}
                {badge > 0 && (
                  <span
                    className={cn(
                      'w-5 h-5 bg-red-500 text-white text-xs font-medium rounded-full flex items-center justify-center',
                      sidebarCollapsed ? 'absolute -top-1 -right-1' : 'ml-auto'
                    )}
                  >
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Collapse Toggle */}
        <div className="p-2 border-t border-gray-200">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? (
              <PanelLeft className="w-5 h-5" />
            ) : (
              <>
                <PanelLeftClose className="w-5 h-5" />
                <span className="text-sm">Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div
        className={cn(
          'flex-1 flex flex-col min-h-screen transition-all duration-300',
          sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'
        )}
      >
        {/* Top Header */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              {/* Mobile Logo */}
              <Link to="/" className="flex items-center gap-3 lg:hidden">
                <div className="w-9 h-9 bg-primary-600 rounded-lg flex items-center justify-center">
                  <span className="text-lg font-bold text-white">W</span>
                </div>
                <div>
                  <div className="text-lg font-semibold text-gray-900">Wilde Signs</div>
                  <div className="text-xs text-gray-500 -mt-0.5">Customer Portal</div>
                </div>
              </Link>

              {/* Desktop: Page title placeholder */}
              <div className="hidden lg:block" />

              {/* Right section */}
              <div className="flex items-center gap-3">
                {/* Notifications */}
                <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg relative">
                  <Bell className="w-5 h-5" />
                  {(unreadData?.count || 0) + (pendingProofs?.length || 0) > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                  )}
                </button>

                {/* User Menu */}
                <div className="relative">
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <div className="w-8 h-8 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-sm font-medium">
                      {getInitials(user?.firstName, user?.lastName)}
                    </div>
                    <span className="hidden sm:block text-sm font-medium text-gray-700">
                      {user?.firstName}
                    </span>
                    <ChevronDown className="w-4 h-4 text-gray-500 hidden sm:block" />
                  </button>

                  <AnimatePresence>
                    {userMenuOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setUserMenuOpen(false)}
                        />
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: -10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -10 }}
                          transition={{ duration: 0.15 }}
                          className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-50"
                        >
                          <div className="px-4 py-3 border-b border-gray-100">
                            <div className="font-medium text-gray-900">
                              {user?.firstName} {user?.lastName}
                            </div>
                            <div className="text-sm text-gray-500 truncate">
                              {user?.email}
                            </div>
                          </div>
                          <Link
                            to="/profile"
                            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            onClick={() => setUserMenuOpen(false)}
                          >
                            <User className="w-4 h-4" />
                            Profile Settings
                          </Link>
                          <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                          >
                            <LogOut className="w-4 h-4" />
                            Sign Out
                          </button>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>

                {/* Mobile menu button */}
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="lg:hidden p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  {mobileMenuOpen ? (
                    <X className="w-5 h-5" />
                  ) : (
                    <Menu className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Mobile Slide-out Navigation */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="lg:hidden fixed inset-0 bg-black/50 z-40"
                onClick={() => setMobileMenuOpen(false)}
              />
              {/* Slide-out menu */}
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="lg:hidden fixed inset-y-0 left-0 w-72 bg-white shadow-xl z-50"
              >
                <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
                  <Link to="/" className="flex items-center gap-3" onClick={() => setMobileMenuOpen(false)}>
                    <div className="w-9 h-9 bg-primary-600 rounded-lg flex items-center justify-center">
                      <span className="text-lg font-bold text-white">W</span>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-gray-900">Wilde Signs</div>
                      <div className="text-xs text-gray-500 -mt-0.5">Customer Portal</div>
                    </div>
                  </Link>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <nav className="overflow-y-auto py-4 px-2 max-h-[calc(100vh-4rem)]">
                  {navItems.map((item) => {
                    const badge = getBadgeCount(item.to);
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.to === '/'}
                        onClick={() => setMobileMenuOpen(false)}
                        className={({ isActive }) =>
                          cn(
                            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative mb-1',
                            isActive
                              ? 'bg-primary-50 text-primary-700'
                              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                          )
                        }
                      >
                        <item.icon className="w-5 h-5 flex-shrink-0" />
                        <span>{item.label}</span>
                        {badge > 0 && (
                          <span className="ml-auto w-5 h-5 bg-red-500 text-white text-xs font-medium rounded-full flex items-center justify-center">
                            {badge > 9 ? '9+' : badge}
                          </span>
                        )}
                      </NavLink>
                    );
                  })}
                </nav>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8 pb-24 lg:pb-8">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>

        {/* Footer - hidden on mobile */}
        <footer className="hidden lg:block bg-white border-t border-gray-200">
          <div className="px-4 sm:px-6 lg:px-8 py-6">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
              <div>© {new Date().getFullYear()} Wilde Signs. All rights reserved.</div>
              <div className="flex items-center gap-4">
                <a href="tel:+1234567890" className="hover:text-gray-700">
                  Contact Us
                </a>
                <a href="mailto:info@wildesigns.com" className="hover:text-gray-700">
                  Support
                </a>
              </div>
            </div>
          </div>
        </footer>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
        <div className="flex items-center justify-around py-2 pb-safe">
          {mobileNavItems.map((item) => {
            const badge = getBadgeCount(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg relative min-w-[64px]',
                    isActive ? 'text-primary-600' : 'text-gray-500'
                  )
                }
              >
                <item.icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
                {badge > 0 && (
                  <span className="absolute top-0 right-2 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
