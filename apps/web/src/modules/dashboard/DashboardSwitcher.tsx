import React from 'react';
import { Navigate } from 'react-router-dom';
import { useTenantStore } from '../../stores/tenantStore';
import { useAuthStore } from '../../stores/authStore';
import { OwnerPulseDashboard } from './OwnerPulseDashboard';
import { ManagerDashboard } from './ManagerDashboard';
import { CashierWorkspace } from './CashierWorkspace';
import { AccountantDashboard } from './AccountantDashboard';

export const DashboardSwitcher: React.FC = () => {
  const { roles } = useTenantStore();
  const { user, supportSession } = useAuthStore();

  // If Super Admin without an active support session, direct to Super Admin Portal
  if (user?.isSuperAdmin && !supportSession) {
    return <Navigate to="/super-admin" replace />;
  }

  if (roles.includes('CASHIER') && !roles.includes('OWNER') && !roles.includes('MANAGER')) {
    return <CashierWorkspace />;
  }

  if (roles.includes('MANAGER') && !roles.includes('OWNER')) {
    return <ManagerDashboard />;
  }

  if (roles.includes('ACCOUNTANT') && !roles.includes('OWNER')) {
    return <AccountantDashboard />;
  }

  // Default to Owner / Business Pulse view
  return <OwnerPulseDashboard />;
};
