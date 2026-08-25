import React, { Suspense, lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '../layouts/AppShell';
import { AuthLayout } from '../layouts/AuthLayout';
import { useAuthStore } from '../stores/authStore';

const LoginPage = lazy(() => import('../modules/auth/LoginPage').then(m => ({ default: m.LoginPage })));
const OnboardingWizard = lazy(() => import('../modules/onboarding/OnboardingWizard').then(m => ({ default: m.OnboardingWizard })));
const DashboardSwitcher = lazy(() => import('../modules/dashboard/DashboardSwitcher').then(m => ({ default: m.DashboardSwitcher })));
const PosPage = lazy(() => import('../modules/pos/PosPage').then(m => ({ default: m.PosPage })));
const EmployeesPage = lazy(() => import('../modules/iam/EmployeesPage').then(m => ({ default: m.EmployeesPage })));
const RolesPage = lazy(() => import('../modules/iam/RolesPage').then(m => ({ default: m.RolesPage })));
const OrganizationSettingsPage = lazy(() => import('../modules/settings/OrganizationSettingsPage').then(m => ({ default: m.OrganizationSettingsPage })));
const SuperAdminDashboard = lazy(() => import('../modules/super-admin/SuperAdminDashboard').then(m => ({ default: m.SuperAdminDashboard })));
const ProductsPage = lazy(() => import('../modules/products/ProductsPage').then(m => ({ default: m.ProductsPage })));
const QuotationsListPage = lazy(() => import('../modules/quotations/QuotationsListPage').then(m => ({ default: m.QuotationsListPage })));
const QuotationFormPage = lazy(() => import('../modules/quotations/QuotationFormPage').then(m => ({ default: m.QuotationFormPage })));
const QuotationDetailPage = lazy(() => import('../modules/quotations/QuotationDetailPage').then(m => ({ default: m.QuotationDetailPage })));
const InvoicesListPage = lazy(() => import('../modules/invoices/InvoicesListPage').then(m => ({ default: m.InvoicesListPage })));
const InvoiceFormPage = lazy(() => import('../modules/invoices/InvoiceFormPage').then(m => ({ default: m.InvoiceFormPage })));
const InvoiceDetailPage = lazy(() => import('../modules/invoices/InvoiceDetailPage').then(m => ({ default: m.InvoiceDetailPage })));
const ReceiptsListPage = lazy(() => import('../modules/receipts/ReceiptsListPage').then(m => ({ default: m.ReceiptsListPage })));
const ReceiptDetailPage = lazy(() => import('../modules/receipts/ReceiptDetailPage').then(m => ({ default: m.ReceiptDetailPage })));

const PageLoader: React.FC = () => (
  <div className="flex h-full min-h-[300px] w-full items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
  </div>
);

const LazyRoute: React.FC<{ component: React.ComponentType }> = ({ component: Component }) => (
  <Suspense fallback={<PageLoader />}>
    <Component />
  </Suspense>
);

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <AuthLayout />,
    children: [
      {
        index: true,
        element: <LazyRoute component={LoginPage} />,
      },
    ],
  },
  {
    path: '/onboarding',
    element: <LazyRoute component={OnboardingWizard} />,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: <LazyRoute component={DashboardSwitcher} />,
      },
      {
        path: 'pos',
        element: <LazyRoute component={PosPage} />,
      },
      {
        path: 'products',
        element: <LazyRoute component={ProductsPage} />,
      },
      // Quotation Routes
      {
        path: 'quotations',
        element: <LazyRoute component={QuotationsListPage} />,
      },
      {
        path: 'quotations/new',
        element: <LazyRoute component={QuotationFormPage} />,
      },
      {
        path: 'quotations/:id',
        element: <LazyRoute component={QuotationDetailPage} />,
      },
      {
        path: 'quotations/:id/edit',
        element: <LazyRoute component={QuotationFormPage} />,
      },
      // Invoice Routes
      {
        path: 'invoices',
        element: <LazyRoute component={InvoicesListPage} />,
      },
      {
        path: 'invoices/new',
        element: <LazyRoute component={InvoiceFormPage} />,
      },
      {
        path: 'invoices/:id',
        element: <LazyRoute component={InvoiceDetailPage} />,
      },
      // Receipt Routes
      {
        path: 'receipts',
        element: <LazyRoute component={ReceiptsListPage} />,
      },
      {
        path: 'receipts/:id',
        element: <LazyRoute component={ReceiptDetailPage} />,
      },
      {
        path: 'team',
        element: <LazyRoute component={EmployeesPage} />,
      },
      {
        path: 'roles',
        element: <LazyRoute component={RolesPage} />,
      },
      {
        path: 'settings',
        element: <LazyRoute component={OrganizationSettingsPage} />,
      },
      {
        path: 'super-admin',
        element: <LazyRoute component={SuperAdminDashboard} />,
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/dashboard" replace />,
  },
]);

