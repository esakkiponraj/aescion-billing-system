import React, { useState, useEffect } from 'react';
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
import {
  getSocket,
  sendCashierHeartbeat,
  sendCashierLogout,
  disconnectSocket,
} from '../services/socket';

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

  const currentOrg = organizations.find((o) => o.organizationId === activeOrgId);
  const availableOutlets = currentOrg?.outlets || [];

  // Determine Role Context
  const isSuperAdminMode = Boolean(user?.isSuperAdmin && !supportSession);
  const isOwner = roles.includes('OWNER');
  const isManager = roles.includes('MANAGER');
  const isCashier = roles.includes('CASHIER');
  const isAccountant = roles.includes('ACCOUNTANT');

  // Real-time WebSocket connection & Heartbeat for active session
  useEffect(() => {
    if (!user) {
      disconnectSocket();
      return;
    }

    getSocket();

    // Send heartbeat immediately, then every 15 seconds to keep presence alive and update lastSeenAt
    sendCashierHeartbeat();
    const heartbeatTimer = setInterval(() => {
      sendCashierHeartbeat();
    }, 15000);

    return () => {
      clearInterval(heartbeatTimer);
    };
  }, [user]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  const handleLogout = async () => {
    await sendCashierLogout();
    clearAuth();
    navigate('/login');
  };

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

        {/* Core Financial & Billing Modules */}
        <div className="pt-3 px-3 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Billing & Documents
        </div>

        <NavLink
          to="/quotations"
          onClick={() => setIsMobileMenuOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              isActive || location.pathname.startsWith('/quotations')
                ? 'bg-brand-50 text-brand-700 font-bold border border-brand-200/80 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`
          }
        >
          <FileText className="w-4 h-4 text-amber-600" />
          <span>Quotations</span>
        </NavLink>

        <NavLink
          to="/invoices"
          onClick={() => setIsMobileMenuOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              isActive || location.pathname.startsWith('/invoices')
                ? 'bg-brand-50 text-brand-700 font-bold border border-brand-200/80 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`
          }
        >
          <CreditCard className="w-4 h-4 text-blue-600" />
          <span>Invoices</span>
        </NavLink>

        <NavLink
          to="/receipts"
          onClick={() => setIsMobileMenuOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              isActive || location.pathname.startsWith('/receipts')
                ? 'bg-brand-50 text-brand-700 font-bold border border-brand-200/80 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`
          }
        >
          <Shield className="w-4 h-4 text-emerald-600" />
          <span>Receipts</span>
        </NavLink>

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
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-slate-50 text-slate-800 selection:bg-brand-500/20 selection:text-brand-700">
      {/* Support Mode Impersonation Banner */}
      <SupportBanner />

      {/* Top Navigation Bar */}
      <header className="flex-shrink-0 z-30 h-16 border-b border-slate-200 bg-white px-3 sm:px-4 lg:px-6 flex items-center justify-between gap-2 sm:gap-4 shadow-xs sticky top-0">
        {/* Brand Logo, Mobile Toggle & Switchers */}
        <div className="flex-1 flex items-center gap-2 sm:gap-3 min-w-0">
          {/* Mobile Menu Toggle (44px min touch target) */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 shrink-0 transition-colors"
            aria-label="Toggle navigation menu"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Logo */}
          <div
            onClick={() => navigate(isSuperAdminMode ? '/super-admin' : '/dashboard')}
            className="flex items-center gap-2 cursor-pointer group shrink-0"
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-brand-600 flex items-center justify-center shadow-md shadow-brand-500/20 group-hover:scale-105 transition-transform shrink-0">
              <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <span className="text-base sm:text-lg font-black tracking-tight text-slate-900 hidden sm:inline-block">
              AESCION
            </span>
          </div>

          <div className="h-5 w-[1px] bg-slate-200 hidden md:block" />

          {/* Tenant Organization & Outlet Switchers */}
          {!isSuperAdminMode && activeOrgName && (
            <div className="flex-1 min-w-0 flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={() => setIsOrgModalOpen(true)}
                className="flex-1 sm:flex-initial flex items-center justify-between sm:justify-start gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 h-9 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100 hover:border-slate-300 transition-all text-xs font-semibold text-slate-700 shadow-xs group min-w-0"
                title={`Organization: ${activeOrgName}`}
              >
                <div className="flex items-center gap-1.5 min-w-0 truncate">
                  <Building className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                  <span className="truncate font-bold text-slate-800">
                    {activeOrgName}
                  </span>
                </div>
                <ChevronDown className="w-3 h-3 text-slate-400 group-hover:text-slate-600 transition-transform shrink-0 ml-1" />
              </button>

              {/* Outlet Switcher Dropdown Button */}
              {activeOutletName && (
                <button
                  onClick={() => setIsOutletModalOpen(true)}
                  className="hidden md:flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 h-9 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100 hover:border-slate-300 transition-all text-xs font-semibold text-slate-700 shadow-xs group min-w-0 shrink-0"
                  title={`Branch: ${activeOutletName}`}
                >
                  <Store className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                  <span className="max-w-[120px] truncate font-bold">
                    {activeOutletName}
                  </span>
                  <ChevronDown className="w-3 h-3 text-slate-400 group-hover:text-slate-600 transition-transform shrink-0" />
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
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
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
          <div className="flex items-center gap-1 sm:gap-2 pl-1.5 sm:pl-2 border-l border-slate-200">
            <div className="w-8 h-8 rounded-lg bg-brand-50 border border-brand-200 flex items-center justify-center font-bold text-xs text-brand-700 shadow-xs shrink-0">
              {user?.firstName?.[0] || 'U'}
            </div>
            <button
              onClick={handleLogout}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0"
              title="Sign Out"
              aria-label="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden relative min-h-0">
        {/* Left Navigation Sidebar (Desktop) */}
        <aside className="w-64 h-full border-r border-slate-200 bg-white p-4 hidden md:flex flex-col justify-between shrink-0 shadow-xs overflow-hidden">
          <div className="flex-1 overflow-y-auto pr-1 min-h-0">{renderNavLinks()}</div>

          {/* Bottom Organization Details */}
          {!isSuperAdminMode && activeOrgName && (
            <div className="pt-4 mt-auto border-t border-slate-200 flex-shrink-0">
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
            {/* Dark Backdrop */}
            <div
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            {/* Drawer Container */}
            <div className="relative w-72 max-w-[85vw] bg-white border-r border-slate-200 p-4 flex flex-col justify-between z-50 shadow-2xl h-full animate-in slide-in-from-left duration-200">
              {/* Drawer Top Header */}
              <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-200 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center text-white shadow-xs">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-black text-slate-900 text-sm">AESCION</span>
                    <span className="block text-[10px] text-slate-500 font-medium">Navigation</span>
                  </div>
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  aria-label="Close navigation menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pr-1 min-h-0">{renderNavLinks()}</div>

              {/* Drawer Footer */}
              <div className="pt-3 mt-auto border-t border-slate-200 shrink-0 space-y-2">
                {!isSuperAdminMode && activeOrgName && (
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                    <p className="font-bold text-slate-900 truncate">{activeOrgName}</p>
                    <p className="text-[11px] text-slate-500 truncate">{activeOutletName || 'Headquarters'}</p>
                  </div>
                )}
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 p-2.5 rounded-lg bg-rose-50 text-rose-700 font-bold text-xs border border-rose-200"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content Pane */}
        <main className="flex-1 h-full overflow-y-auto px-4 sm:px-6 md:px-8 py-4 sm:py-6 pb-16 sm:pb-8 bg-slate-50 min-w-0">
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
