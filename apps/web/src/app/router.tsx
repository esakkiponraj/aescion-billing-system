import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '../layouts/AppShell';
import { AuthLayout } from '../layouts/AuthLayout';
import { LoginPage } from '../modules/auth/LoginPage';
import { OnboardingWizard } from '../modules/onboarding/OnboardingWizard';
import { DashboardSwitcher } from '../modules/dashboard/DashboardSwitcher';
import { PosPage } from '../modules/pos/PosPage';
import { EmployeesPage } from '../modules/iam/EmployeesPage';
import { RolesPage } from '../modules/iam/RolesPage';
import { OrganizationSettingsPage } from '../modules/settings/OrganizationSettingsPage';
import { SuperAdminDashboard } from '../modules/super-admin/SuperAdminDashboard';
import { ProductsPage } from '../modules/products/ProductsPage';
import { QuotationsListPage } from '../modules/quotations/QuotationsListPage';
import { QuotationFormPage } from '../modules/quotations/QuotationFormPage';
import { QuotationDetailPage } from '../modules/quotations/QuotationDetailPage';
import { InvoicesListPage } from '../modules/invoices/InvoicesListPage';
import { InvoiceFormPage } from '../modules/invoices/InvoiceFormPage';
import { InvoiceDetailPage } from '../modules/invoices/InvoiceDetailPage';
import { ReceiptsListPage } from '../modules/receipts/ReceiptsListPage';
import { ReceiptDetailPage } from '../modules/receipts/ReceiptDetailPage';
import { useAuthStore } from '../stores/authStore';

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
        element: <LoginPage />,
      },
    ],
  },
  {
    path: '/onboarding',
    element: <OnboardingWizard />,
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
        element: <DashboardSwitcher />,
      },
      {
        path: 'pos',
        element: <PosPage />,
      },
      {
        path: 'products',
        element: <ProductsPage />,
      },
      // Quotation Routes
      {
        path: 'quotations',
        element: <QuotationsListPage />,
      },
      {
        path: 'quotations/new',
        element: <QuotationFormPage />,
      },
      {
        path: 'quotations/:id',
        element: <QuotationDetailPage />,
      },
      {
        path: 'quotations/:id/edit',
        element: <QuotationFormPage />,
      },
      // Invoice Routes
      {
        path: 'invoices',
        element: <InvoicesListPage />,
      },
      {
        path: 'invoices/new',
        element: <InvoiceFormPage />,
      },
      {
        path: 'invoices/:id',
        element: <InvoiceDetailPage />,
      },
      // Receipt Routes
      {
        path: 'receipts',
        element: <ReceiptsListPage />,
      },
      {
        path: 'receipts/:id',
        element: <ReceiptDetailPage />,
      },
      {
        path: 'team',
        element: <EmployeesPage />,
      },
      {
        path: 'roles',
        element: <RolesPage />,
      },
      {
        path: 'settings',
        element: <OrganizationSettingsPage />,
      },
      {
        path: 'super-admin',
        element: <SuperAdminDashboard />,
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/dashboard" replace />,
  },
]);
