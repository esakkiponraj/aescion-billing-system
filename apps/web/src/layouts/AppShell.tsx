import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  KeyRound,
  Building,
  Shield,
  LogOut,
  ChevronDown,
  Store,
  CreditCard,
  LifeBuoy,
  BarChart3,
  FileText,
  Sliders,
  Zap,
  ArrowUpRight,
  Package,
  Menu,
  X,
  Layers,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useTenantStore } from '../stores/tenantStore';
import { SupportBanner } from '../components/common/SupportBanner';
import { CommandBar } from '../components/common/CommandBar';
import { Modal } from '../components/common/Modal';
import { Badge } from '../components/common/Badge';
import { getBusinessTypeCapability } from '@aescion/types';

export const AppShell: React.FC = () => {
  const { user, organizations, supportSession, clearAuth } = useAuthStore();
  const {
    activeOrgId,
    activeOrgName,
    activeOutletId,
    activeOutletName,
    businessType,
    roles,
    setActiveTenant,
    setActiveOutlet,
  } = useTenantStore();

  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [isOrgModalOpen, setIsOrgModalOpen] = useState(false);
  const [isOutletModalOpen, setIsOutletModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  const currentOrg = organizations.find((o) => o.organizationId === activeOrgId);
  const availableOutlets = currentOrg?.outlets || [];

  // Determine Role Context
  const isSuperAdminMode = Boolean(user?.isSuperAdmin && !supportSession);
  const isOwner = roles.includes('OWNER');
  const isManager = roles.includes('MANAGER');
  const isCashier = roles.includes('CASHIER');
  const isAccountant = roles.includes('ACCOUNTANT');

  const capabilities = getBusinessTypeCapability(businessType || currentOrg?.businessType);

  const roleLabel = isSuperAdminMode
    ? 'SaaS Super Admin'
    : isOwner
      ? `${capabilities.label} Owner`
      : isManager
        ? 'Manager'
        : isCashier
          ? 'Cashier'
          : isAccountant
            ? 'Accountant'
            : 'Team Member';

  const currentTab = searchParams.get('tab') || 'dashboard';

  const renderNavLinks = () => {
    if (isSuperAdminMode) {
      return (
        <div className="space-y-1">
          <div className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-rose-600">
            Platform Control
          </div>

          <button
            onClick={() => {
              navigate('/super-admin?tab=dashboard');
              setIsMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all text-left ${
              location.pathname === '/super-admin' && currentTab === 'dashboard'
                ? 'bg-rose-50 text-rose-700 font-bold border border-rose-200 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 text-rose-600" />
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => {
              navigate('/super-admin?tab=organizations');
              setIsMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all text-left ${
              location.pathname === '/super-admin' && currentTab === 'organizations'
                ? 'bg-rose-50 text-rose-700 font-bold border border-rose-200 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Building className="w-4 h-4 text-brand-600" />
            <span>Organizations / Businesses</span>
          </button>

          <button
            onClick={() => {
              navigate('/super-admin?tab=subscriptions');
              setIsMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all text-left ${
              location.pathname === '/super-admin' && currentTab === 'subscriptions'
                ? 'bg-rose-50 text-rose-700 font-bold border border-rose-200 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <CreditCard className="w-4 h-4 text-purple-600" />
            <span>Subscriptions & Plans</span>
          </button>

          <button
            onClick={() => {
              navigate('/super-admin?tab=platform-users');
              setIsMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all text-left ${
              location.pathname === '/super-admin' && currentTab === 'platform-users'
                ? 'bg-rose-50 text-rose-700 font-bold border border-rose-200 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Users className="w-4 h-4 text-sky-600" />
            <span>Platform Users</span>
          </button>

          <button
            onClick={() => {
              navigate('/super-admin?tab=support-issues');
              setIsMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all text-left ${
              location.pathname === '/super-admin' && currentTab === 'support-issues'
                ? 'bg-rose-50 text-rose-700 font-bold border border-rose-200 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <LifeBuoy className="w-4 h-4 text-orange-500" />
            <span>Support / Issues</span>
          </button>

          <button
            onClick={() => {
              navigate('/super-admin?tab=reports');
              setIsMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all text-left ${
              location.pathname === '/super-admin' && currentTab === 'reports'
                ? 'bg-rose-50 text-rose-700 font-bold border border-rose-200 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-emerald-600" />
            <span>Reports</span>
          </button>

          <button
            onClick={() => {
              navigate('/super-admin?tab=audit-logs');
              setIsMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all text-left ${
              location.pathname === '/super-admin' && currentTab === 'audit-logs'
                ? 'bg-rose-50 text-rose-700 font-bold border border-rose-200 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-4 h-4 text-slate-500" />
            <span>Audit Logs</span>
          </button>

          <button
            onClick={() => {
              navigate('/super-admin?tab=settings');
              setIsMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all text-left ${
              location.pathname === '/super-admin' && currentTab === 'settings'
                ? 'bg-rose-50 text-rose-700 font-bold border border-rose-200 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Sliders className="w-4 h-4 text-indigo-600" />
            <span>System Settings</span>
          </button>
        </div>
      );
    }

    if (isAccountant) {
      return (
        <div className="space-y-1">
          <div className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-brand-600">
            Financial Suite
          </div>

          {[
            { tab: 'dashboard', label: 'Financial Overview', icon: <Zap className="w-4 h-4 text-orange-500" /> },
            { tab: 'sales-invoices', label: 'Sales Invoices', icon: <FileText className="w-4 h-4 text-emerald-600" /> },
            { tab: 'purchase-bills', label: 'Purchase Bills', icon: <CreditCard className="w-4 h-4 text-sky-600" /> },
            { tab: 'payments', label: 'Payments & Receipts', icon: <ArrowUpRight className="w-4 h-4 text-brand-600" /> },
            { tab: 'receivables', label: 'Accounts Receivable', icon: <Users className="w-4 h-4 text-indigo-600" /> },
            { tab: 'payables', label: 'Accounts Payable', icon: <Building className="w-4 h-4 text-rose-600" /> },
            { tab: 'expenses', label: 'Expenses', icon: <Sliders className="w-4 h-4 text-amber-600" /> },
            { tab: 'cash-bank', label: 'Cash & Bank', icon: <Zap className="w-4 h-4 text-yellow-600" /> },
            { tab: 'ledger', label: 'Ledger', icon: <FileText className="w-4 h-4 text-teal-600" /> },
            { tab: 'gst-tax', label: 'GST & Tax', icon: <Shield className="w-4 h-4 text-purple-600" /> },
            { tab: 'reports', label: 'Reports', icon: <BarChart3 className="w-4 h-4 text-sky-600" /> },
            { tab: 'export', label: 'Export', icon: <LifeBuoy className="w-4 h-4 text-pink-600" /> },
          ].map((item) => (
            <button
              key={item.tab}
              onClick={() => {
                navigate(`/dashboard?tab=${item.tab}`);
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all text-left ${
                currentTab === item.tab
                  ? 'bg-brand-50 text-brand-700 font-bold border border-brand-200/80 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-1">
        <div className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-brand-600">
          {capabilities.label} Operations
        </div>

        <NavLink
          to="/dashboard"
          onClick={() => setIsMobileMenuOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              isActive
                ? 'bg-brand-50 text-brand-700 font-bold border border-brand-200/80 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`
          }
        >
          <LayoutDashboard className="w-4 h-4 text-brand-600" />
          <span>
            {isCashier
              ? 'Cashier Workspace'
              : isOwner
                ? `${capabilities.label} Pulse`
                : 'Dashboard'}
          </span>
        </NavLink>

        <NavLink
          to="/products"
          onClick={() => setIsMobileMenuOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              isActive
                ? 'bg-brand-50 text-brand-700 font-bold border border-brand-200/80 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`
          }
        >
          <Package className="w-4 h-4 text-emerald-600" />
          <span>{capabilities.terminology.itemPluralLabel}</span>
        </NavLink>

        {capabilities.enabledModules.pos && (
          <NavLink
            to="/pos"
            onClick={() => setIsMobileMenuOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-brand-50 text-brand-700 font-bold border border-brand-200/80 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`
            }
          >
            <ShoppingCart className="w-4 h-4 text-orange-500" />
            <span>{capabilities.terminology.posAction}</span>
          </NavLink>
        )}

        {(isOwner || isManager) && (
          <>
            <div className="pt-4 px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Management
            </div>

            <NavLink
              to="/team"
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-brand-50 text-brand-700 font-bold border border-brand-200/80 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`
              }
            >
              <Users className="w-4 h-4 text-sky-600" />
              <span>Team & Access</span>
            </NavLink>

            <NavLink
              to="/roles"
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-brand-50 text-brand-700 font-bold border border-brand-200/80 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`
              }
            >
              <KeyRound className="w-4 h-4 text-purple-600" />
              <span>Roles & Limits</span>
            </NavLink>

            <NavLink
              to="/settings"
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-brand-50 text-brand-700 font-bold border border-brand-200/80 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`
              }
            >
              <Building className="w-4 h-4 text-slate-500" />
              <span>Outlets & Branches</span>
            </NavLink>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800 selection:bg-brand-500/20 selection:text-brand-700">
      {/* Support Mode Impersonation Banner */}
      <SupportBanner />

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 h-16 border-b border-slate-200 bg-white px-4 lg:px-6 flex items-center justify-between gap-4 shadow-xs">
        {/* Brand Logo, Mobile Toggle & Switchers */}
        <div className="flex items-center gap-3 md:gap-5">
          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div
            onClick={() => navigate(isSuperAdminMode ? '/super-admin' : '/dashboard')}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-lg bg-brand-600 flex items-center justify-center shadow-md shadow-brand-500/20 group-hover:scale-105 transition-transform">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-black tracking-tight text-slate-900 hidden sm:inline-block">
              AESCION
            </span>
          </div>

          <div className="h-5 w-[1px] bg-slate-200 hidden md:block" />

          {/* If NOT Super Admin Mode, Show Tenant Organization & Outlet Switchers */}
          {!isSuperAdminMode && activeOrgName && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsOrgModalOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100 hover:border-slate-300 transition-all text-xs font-semibold text-slate-700 shadow-xs group"
              >
                <Building className="w-3.5 h-3.5 text-brand-600" />
                <span className="max-w-[120px] sm:max-w-[160px] truncate font-bold">
                  {activeOrgName}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-transform" />
              </button>

              {/* Outlet Switcher Dropdown Button */}
              {activeOutletName && (
                <button
                  onClick={() => setIsOutletModalOpen(true)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100 hover:border-slate-300 transition-all text-xs font-semibold text-slate-700 shadow-xs group"
                >
                  <Store className="w-3.5 h-3.5 text-orange-500" />
                  <span className="max-w-[100px] sm:max-w-[140px] truncate font-bold">
                    {activeOutletName}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-transform" />
                </button>
              )}
            </div>
          )}

          {isSuperAdminMode && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold shadow-xs">
              <Shield className="w-3.5 h-3.5 text-rose-600" />
              <span>Platform Administration</span>
            </div>
          )}
        </div>

        {/* User Profile & Actions */}
        <div className="flex items-center gap-3">
          <Badge
            variant={
              isSuperAdminMode
                ? 'danger'
                : isOwner
                  ? 'brand'
                  : isManager
                    ? 'info'
                    : isCashier
                      ? 'success'
                      : isAccountant
                        ? 'warning'
                        : 'neutral'
            }
            size="sm"
            className="hidden sm:inline-flex shadow-xs"
          >
            {roleLabel}
          </Badge>

          {/* User Avatar & Logout */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <div className="w-8 h-8 rounded-lg bg-brand-50 border border-brand-200 flex items-center justify-center font-bold text-xs text-brand-700 shadow-xs">
              {user?.firstName?.[0] || 'U'}
            </div>
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Navigation Sidebar (Desktop) */}
        <aside className="w-64 border-r border-slate-200 bg-white p-4 hidden md:flex flex-col justify-between shrink-0 shadow-xs">
          <div className="overflow-y-auto pr-1">{renderNavLinks()}</div>

          {/* Bottom Organization Details */}
          {!isSuperAdminMode && activeOrgName && (
            <div className="pt-4 mt-auto border-t border-slate-200">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1 shadow-xs">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Active Workspace
                </div>
                <div className="font-bold text-slate-900 truncate">
                  {activeOrgName}
                </div>
                <div className="text-[11px] text-slate-500 flex items-center gap-1">
                  <Store className="w-3 h-3 text-orange-500" />
                  <span className="truncate">{activeOutletName || 'Headquarters'}</span>
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-40 md:hidden flex">
            <div
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <div className="relative w-64 bg-white border-r border-slate-200 p-4 flex flex-col justify-between z-50 shadow-2xl h-full">
              <div className="overflow-y-auto pr-1">{renderNavLinks()}</div>
              <button
                onClick={handleLogout}
                className="mt-4 w-full flex items-center justify-center gap-2 p-2.5 rounded-lg bg-rose-50 text-rose-700 font-bold text-xs border border-rose-200"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}

        {/* Content Pane */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50 min-w-0">
          <Outlet />
        </main>
      </div>

      {/* Global Shortcut Palette (Ctrl+K) */}
      <CommandBar isOpen={isCommandOpen} onClose={() => setIsCommandOpen(false)} />

      {/* Organization Switcher Modal */}
      <Modal
        isOpen={isOrgModalOpen}
        onClose={() => setIsOrgModalOpen(false)}
        title="Switch Business Organization"
        subtitle="Select the enterprise or tenant context you wish to manage."
      >
        <div className="space-y-2 py-2">
          {organizations.map((org) => {
            const isSelected = org.organizationId === activeOrgId;
            return (
              <div
                key={org.organizationId}
                onClick={() => {
                  setActiveTenant({
                    orgId: org.organizationId,
                    orgName: org.organizationName,
                    outletId: org.outlets?.[0]?.outletId || '',
                    outletName: org.outlets?.[0]?.outletName || 'Main',
                    businessType: org.businessType,
                    roles: [org.roleCode],
                  });
                  setIsOrgModalOpen(false);
                }}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                  isSelected
                    ? 'bg-brand-50 border-brand-500 text-brand-900 shadow-xs'
                    : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm ${
                      isSelected
                        ? 'bg-brand-600 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <Building className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">{org.organizationName}</h4>
                    <p className="text-xs text-slate-500 capitalize">
                      {org.businessType.toLowerCase()} • {org.outlets?.length || 0} Outlets
                    </p>
                  </div>
                </div>
                {isSelected && (
                  <Badge variant="brand" size="sm">
                    Active
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      </Modal>

      {/* Outlet Switcher Modal */}
      <Modal
        isOpen={isOutletModalOpen}
        onClose={() => setIsOutletModalOpen(false)}
        title="Switch Store / Branch Outlet"
        subtitle={`Switch physical branch within ${activeOrgName}.`}
      >
        <div className="space-y-2 py-2">
          {availableOutlets.map((outlet) => {
            const isSelected = outlet.outletId === activeOutletId;
            return (
              <div
                key={outlet.outletId}
                onClick={() => {
                  setActiveOutlet(outlet.outletId, outlet.outletName);
                  setIsOutletModalOpen(false);
                }}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                  isSelected
                    ? 'bg-orange-50 border-orange-500 text-orange-900 shadow-xs'
                    : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm ${
                      isSelected
                        ? 'bg-orange-500 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <Store className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">{outlet.outletName}</h4>
                    <p className="text-xs text-slate-500">
                      Code: <strong className="text-slate-700">{outlet.outletCode}</strong>
                    </p>
                  </div>
                </div>
                {isSelected && (
                  <Badge variant="warning" size="sm">
                    Active
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      </Modal>
    </div>
  );
};
