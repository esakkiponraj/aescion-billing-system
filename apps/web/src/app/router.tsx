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
