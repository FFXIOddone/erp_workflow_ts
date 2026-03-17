import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';

// Layouts
import { AuthLayout } from '@/layouts/AuthLayout';
import { PortalLayout } from '@/layouts/PortalLayout';

// Auth Pages
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage';
import { ResetPasswordPage } from '@/pages/ResetPasswordPage';

// Portal Pages
import { DashboardPage } from '@/pages/DashboardPage';
import { OrdersPage } from '@/pages/OrdersPage';
import { OrderDetailPage } from '@/pages/OrderDetailPage';
import { InvoicesPage } from '@/pages/InvoicesPage';
import { InvoiceDetailPage } from '@/pages/InvoiceDetailPage';
import { ShipmentsPage } from '@/pages/ShipmentsPage';
import { DocumentsPage } from '@/pages/DocumentsPage';
import { SubscriptionsPage } from '@/pages/SubscriptionsPage';
import { ProofsPage } from '@/pages/ProofsPage';
import { ProofDetailPage } from '@/pages/ProofDetailPage';
import { MessagesPage } from '@/pages/MessagesPage';
import { ProfilePage } from '@/pages/ProfilePage';

// Self-Service Hub Pages
import { SelfServiceHubPage } from '@/pages/SelfServiceHubPage';
import { ArtworkUploadPage } from '@/pages/ArtworkUploadPage';
import { QuickReorderPage } from '@/pages/QuickReorderPage';
import { BrandAssetsPage } from '@/pages/BrandAssetsPage';

// Quote Engine Pages
import { QuoteBuilderPage } from '@/pages/QuoteBuilderPage';
import { QuotesPage } from '@/pages/QuotesPage';
import { QuoteDetailPage } from '@/pages/QuoteDetailPage';

// Customer Intelligence
import { CustomerIntelligencePage } from '@/pages/CustomerIntelligencePage';

// Payment History
import { PaymentsPage } from '@/pages/PaymentsPage';

// Support Tickets
import { SupportTicketsPage } from '@/pages/SupportTicketsPage';

// Protected route wrapper
function ProtectedRoute() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

// Public route wrapper (redirect if already authenticated)
function PublicRoute() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

export default function App() {
  // In production, portal is served at /portal/ sub-path
  const basename = import.meta.env.BASE_URL?.replace(/\/$/, '') || '';
  
  return (
    <BrowserRouter basename={basename}>
      <Routes>
        {/* Public Auth Routes */}
        <Route element={<PublicRoute />}>
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
          </Route>
        </Route>

        {/* Protected Portal Routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<PortalLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/orders/:id" element={<OrderDetailPage />} />
            <Route path="/invoices" element={<InvoicesPage />} />
            <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
            <Route path="/shipments" element={<ShipmentsPage />} />
            <Route path="/documents" element={<DocumentsPage />} />
            <Route path="/subscriptions" element={<SubscriptionsPage />} />
            <Route path="/proofs" element={<ProofsPage />} />
            <Route path="/proofs/:id" element={<ProofDetailPage />} />
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            
            {/* Self-Service Hub Routes */}
            <Route path="/hub" element={<SelfServiceHubPage />} />
            <Route path="/hub/artwork" element={<ArtworkUploadPage />} />
            <Route path="/hub/reorder" element={<QuickReorderPage />} />
            <Route path="/hub/brand-assets" element={<BrandAssetsPage />} />
            <Route path="/hub/quote" element={<QuoteBuilderPage />} />
            
            {/* Quote Routes */}
            <Route path="/quotes" element={<QuotesPage />} />
            <Route path="/quotes/:id" element={<QuoteDetailPage />} />
            
            {/* Customer Intelligence */}
            <Route path="/intelligence" element={<CustomerIntelligencePage />} />
            
            {/* Payment History */}
            <Route path="/payments" element={<PaymentsPage />} />
            
            {/* Support */}
            <Route path="/support" element={<SupportTicketsPage />} />
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
