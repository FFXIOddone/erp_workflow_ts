import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/auth';
import { Layout, ErrorBoundary, ToastContainer, GlobalLoadingIndicator } from './components';
import { LoginPage } from './pages/LoginPage';

// Lazy-loaded pages — each becomes its own chunk
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const OrdersPage = lazy(() => import('./pages/OrdersPage').then(m => ({ default: m.OrdersPage })));
const OrderFormPage = lazy(() => import('./pages/OrderFormPage').then(m => ({ default: m.OrderFormPage })));
const OrderDetailPage = lazy(() => import('./pages/OrderDetailPage').then(m => ({ default: m.OrderDetailPage })));
const InventoryPage = lazy(() => import('./pages/InventoryPage').then(m => ({ default: m.InventoryPage })));
const ItemDetailPage = lazy(() => import('./pages/ItemDetailPage').then(m => ({ default: m.ItemDetailPage })));
const UsersPage = lazy(() => import('./pages/UsersPage').then(m => ({ default: m.UsersPage })));
const TemplatesPage = lazy(() => import('./pages/TemplatesPage').then(m => ({ default: m.TemplatesPage })));
const CompaniesPage = lazy(() => import('./pages/CompaniesPage').then(m => ({ default: m.CompaniesPage })));
const CompanyDetailPage = lazy(() => import('./pages/CompanyDetailPage').then(m => ({ default: m.CompanyDetailPage })));

const ProfilePage = lazy(() => import('./pages/ProfilePage').then(m => ({ default: m.ProfilePage })));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage').then(m => ({ default: m.NotificationsPage })));
const ReportsPage = lazy(() => import('./pages/ReportsPage').then(m => ({ default: m.ReportsPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const ActivityPage = lazy(() => import('./pages/ActivityPage').then(m => ({ default: m.ActivityPage })));
const ShipmentsPage = lazy(() => import('./pages/ShipmentsPage').then(m => ({ default: m.ShipmentsPage })));

const ProductionCalendarPage = lazy(() => import('./pages/ProductionCalendarPage').then(m => ({ default: m.ProductionCalendarPage })));
const ImportPage = lazy(() => import('./pages/ImportPage').then(m => ({ default: m.ImportPage })));

const ProductionListPage = lazy(() => import('./pages/ProductionListPage').then(m => ({ default: m.ProductionListPage })));
const RipQueuePage = lazy(() => import('./pages/RipQueuePage').then(m => ({ default: m.RipQueuePage })));
const EquipmentPage = lazy(() => import('./pages/EquipmentPage'));
const EquipmentDetailPage = lazy(() => import('./pages/EquipmentDetailPage'));
const EquipmentFormPage = lazy(() => import('./pages/EquipmentFormPage'));
const EquipmentWatchPage = lazy(() => import('./pages/EquipmentWatchPage'));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

/**
 * AdminRoute — only ADMIN and MANAGER roles can access the full ERP.
 * Operators and Viewers are redirected to /shop-floor.
 */
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role === 'OPERATOR' || user?.role === 'VIEWER') {
    return <Navigate to="/shop-floor" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <ErrorBoundary>
      <GlobalLoadingIndicator />
      <ToastContainer />
      <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>}>
        <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <AdminRoute>
              <Layout />
            </AdminRoute>
          }
        >
          <Route index element={<ErrorBoundary><DashboardPage /></ErrorBoundary>} />
          <Route path="orders" element={<ErrorBoundary><OrdersPage /></ErrorBoundary>} />
          <Route path="orders/new" element={<ErrorBoundary><OrderFormPage /></ErrorBoundary>} />
          <Route path="orders/:id" element={<ErrorBoundary><OrderDetailPage /></ErrorBoundary>} />
          <Route path="orders/:id/edit" element={<ErrorBoundary><OrderFormPage /></ErrorBoundary>} />
          <Route path="schedule" element={<ErrorBoundary><ProductionCalendarPage /></ErrorBoundary>} />
          <Route path="reports" element={<ErrorBoundary><ReportsPage /></ErrorBoundary>} />
          <Route path="inventory" element={<ErrorBoundary><InventoryPage /></ErrorBoundary>} />
          <Route path="inventory/items/:id" element={<ErrorBoundary><ItemDetailPage /></ErrorBoundary>} />
          <Route path="users" element={<ErrorBoundary><UsersPage /></ErrorBoundary>} />
          <Route path="templates" element={<ErrorBoundary><TemplatesPage /></ErrorBoundary>} />
          <Route path="companies" element={<ErrorBoundary><CompaniesPage /></ErrorBoundary>} />
          <Route path="companies/:id" element={<ErrorBoundary><CompanyDetailPage /></ErrorBoundary>} />
          <Route path="profile" element={<ErrorBoundary><ProfilePage /></ErrorBoundary>} />
          <Route path="notifications" element={<ErrorBoundary><NotificationsPage /></ErrorBoundary>} />
          <Route path="settings" element={<ErrorBoundary><SettingsPage /></ErrorBoundary>} />
          <Route path="activity" element={<ErrorBoundary><ActivityPage /></ErrorBoundary>} />
          <Route path="shipments" element={<ErrorBoundary><ShipmentsPage /></ErrorBoundary>} />
          <Route path="import" element={<ErrorBoundary><ImportPage /></ErrorBoundary>} />
          <Route path="production-list" element={<ErrorBoundary><ProductionListPage /></ErrorBoundary>} />

          <Route path="rip-queue" element={<ErrorBoundary><RipQueuePage /></ErrorBoundary>} />
          <Route path="equipment" element={<ErrorBoundary><EquipmentPage /></ErrorBoundary>} />
          <Route path="equipment/new" element={<ErrorBoundary><EquipmentFormPage /></ErrorBoundary>} />
          <Route path="equipment/:id" element={<ErrorBoundary><EquipmentDetailPage /></ErrorBoundary>} />
          <Route path="equipment/:id/edit" element={<ErrorBoundary><EquipmentFormPage /></ErrorBoundary>} />
          <Route path="equipment-watch" element={<ErrorBoundary><EquipmentWatchPage /></ErrorBoundary>} />

        </Route>
      </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

export default App;
