import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Zap,
  Shield,
  Users,
  Building,
  ShoppingCart,
  BarChart3,
  KeyRound,
  ArrowRight,
  LifeBuoy,
  FileText,
  CreditCard,
  Sliders,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useTenantStore } from '../../stores/tenantStore';

interface CommandItem {
  id: string;
  title: string;
  category: 'Actions' | 'Navigation' | 'Analytics' | 'Settings';
  icon: React.ReactNode;
  action: () => void;
  shortcut?: string;
}

export const CommandBar: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const { user, supportSession } = useAuthStore();
  const { roles } = useTenantStore();
  const isSuperAdminMode = Boolean(user?.isSuperAdmin && !supportSession);
  const isAccountantMode = Boolean(roles.includes('ACCOUNTANT') && !roles.includes('OWNER') && !isSuperAdminMode);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const tenantCommands: CommandItem[] = [
    {
      id: 'billing',
      title: 'Fast Billing / Point of Sale',
      category: 'Actions',
      icon: <ShoppingCart className="w-4 h-4 text-brand-600" />,
      action: () => {
        navigate('/pos');
        onClose();
      },
      shortcut: 'F2',
    },
    {
      id: 'products',
      title: 'Products & Catalog Management',
      category: 'Actions',
      icon: <ShoppingCart className="w-4 h-4 text-emerald-600" />,
      action: () => {
        navigate('/products');
        onClose();
      },
      shortcut: 'G P',
    },
    {
      id: 'pulse',
      title: 'Business Pulse & KPI Overview',
      category: 'Analytics',
      icon: <Zap className="w-4 h-4 text-orange-500" />,
      action: () => {
        navigate('/dashboard');
        onClose();
      },
      shortcut: 'G D',
    },
    {
      id: 'employees',
      title: 'Manage Team & Access',
      category: 'Settings',
      icon: <Users className="w-4 h-4 text-sky-600" />,
      action: () => {
        navigate('/team');
        onClose();
      },
      shortcut: 'G T',
    },
    {
      id: 'roles',
      title: 'Roles & Permission Matrix',
      category: 'Settings',
      icon: <KeyRound className="w-4 h-4 text-purple-600" />,
      action: () => {
        navigate('/roles');
        onClose();
      },
      shortcut: 'G R',
    },
    {
      id: 'outlets',
      title: 'Outlets & Branch Configuration',
      category: 'Settings',
      icon: <Building className="w-4 h-4 text-slate-600" />,
      action: () => {
        navigate('/settings');
        onClose();
      },
    },
  ];

  const accountantCommands: CommandItem[] = [
    {
      id: 'acct-dash',
      title: 'Financial Overview Dashboard',
      category: 'Navigation',
      icon: <Zap className="w-4 h-4 text-orange-500" />,
      action: () => {
        navigate('/dashboard?tab=dashboard');
        onClose();
      },
      shortcut: 'G D',
    },
    {
      id: 'acct-sales',
      title: 'Sales Invoices & Tax Breakdown',
      category: 'Navigation',
      icon: <FileText className="w-4 h-4 text-emerald-600" />,
      action: () => {
        navigate('/dashboard?tab=sales-invoices');
        onClose();
      },
    },
    {
      id: 'acct-purchases',
      title: 'Supplier Purchase Bills',
      category: 'Navigation',
      icon: <CreditCard className="w-4 h-4 text-sky-600" />,
      action: () => {
        navigate('/dashboard?tab=purchase-bills');
        onClose();
      },
    },
    {
      id: 'acct-payments',
      title: 'Payments & Receipts',
      category: 'Actions',
      icon: <ArrowRight className="w-4 h-4 text-brand-600" />,
      action: () => {
        navigate('/dashboard?tab=payments');
        onClose();
      },
    },
    {
      id: 'acct-receivables',
      title: 'Accounts Receivable (Aging)',
      category: 'Analytics',
      icon: <Users className="w-4 h-4 text-indigo-600" />,
      action: () => {
        navigate('/dashboard?tab=receivables');
        onClose();
      },
    },
    {
      id: 'acct-payables',
      title: 'Accounts Payable (Aging)',
      category: 'Analytics',
      icon: <Building className="w-4 h-4 text-rose-600" />,
      action: () => {
        navigate('/dashboard?tab=payables');
        onClose();
      },
    },
    {
      id: 'acct-expenses',
      title: 'Expenses Ledger',
      category: 'Actions',
      icon: <Sliders className="w-4 h-4 text-amber-600" />,
      action: () => {
        navigate('/dashboard?tab=expenses');
        onClose();
      },
    },
    {
      id: 'acct-cash',
      title: 'Cash & Bank Activity',
      category: 'Analytics',
      icon: <Zap className="w-4 h-4 text-yellow-600" />,
      action: () => {
        navigate('/dashboard?tab=cash-bank');
        onClose();
      },
    },
    {
      id: 'acct-tax',
      title: 'GST & Tax Position',
      category: 'Analytics',
      icon: <Shield className="w-4 h-4 text-purple-600" />,
      action: () => {
        navigate('/dashboard?tab=gst-tax');
        onClose();
      },
    },
    {
      id: 'acct-reports',
      title: 'Financial Reports & P&L',
      category: 'Analytics',
      icon: <BarChart3 className="w-4 h-4 text-sky-600" />,
      action: () => {
        navigate('/dashboard?tab=reports');
        onClose();
      },
    },
  ];

  const superAdminCommands: CommandItem[] = [
    {
      id: 'sa-dash',
      title: 'Super Admin Dashboard',
      category: 'Navigation',
      icon: <Shield className="w-4 h-4 text-rose-600" />,
      action: () => {
        navigate('/super-admin?tab=dashboard');
        onClose();
      },
      shortcut: 'G D',
    },
    {
      id: 'sa-orgs',
      title: 'Organizations / Businesses Directory',
      category: 'Navigation',
      icon: <Building className="w-4 h-4 text-brand-600" />,
      action: () => {
        navigate('/super-admin?tab=organizations');
        onClose();
      },
      shortcut: 'G O',
    },
    {
      id: 'sa-subs',
      title: 'Subscriptions & SaaS Plans',
      category: 'Navigation',
      icon: <CreditCard className="w-4 h-4 text-purple-600" />,
      action: () => {
        navigate('/super-admin?tab=subscriptions');
        onClose();
      },
    },
    {
      id: 'sa-users',
      title: 'Platform Users (AESCION Staff)',
      category: 'Settings',
      icon: <Users className="w-4 h-4 text-sky-600" />,
      action: () => {
        navigate('/super-admin?tab=platform-users');
        onClose();
      },
    },
    {
      id: 'sa-support',
      title: 'Support / Issues Tickets',
      category: 'Actions',
      icon: <LifeBuoy className="w-4 h-4 text-amber-600" />,
      action: () => {
        navigate('/super-admin?tab=support-issues');
        onClose();
      },
    },
    {
      id: 'sa-reports',
      title: 'Platform Analytics & Reports',
      category: 'Analytics',
      icon: <BarChart3 className="w-4 h-4 text-emerald-600" />,
      action: () => {
        navigate('/super-admin?tab=reports');
        onClose();
      },
    },
    {
      id: 'sa-audit',
      title: 'Platform Compliance Audit Logs',
      category: 'Settings',
      icon: <FileText className="w-4 h-4 text-slate-500" />,
      action: () => {
        navigate('/super-admin?tab=audit-logs');
        onClose();
      },
    },
    {
      id: 'sa-settings',
      title: 'System Settings',
      category: 'Settings',
      icon: <Sliders className="w-4 h-4 text-indigo-600" />,
      action: () => {
        navigate('/super-admin?tab=settings');
        onClose();
      },
    },
  ];

  const commands = isSuperAdminMode
    ? superAdminCommands
    : isAccountantMode
      ? accountantCommands
      : tenantCommands;

  const filtered = commands.filter(
    (c) =>
      c.title.toLowerCase().includes(query.toLowerCase()) ||
      c.category.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Command Palette Box */}
      <div className="relative w-full max-w-xl bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-150">
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-200 bg-slate-50">
          <Search className="w-5 h-5 text-slate-400 mr-3" />
          <input
            autoFocus
            type="text"
            placeholder={
              isSuperAdminMode
                ? "Search platform modules... (e.g., 'organizations', 'support', 'reports')"
                : "Search or ask your business... (e.g., 'billing', 'roles', 'pulse')"
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-none"
          />
          <kbd className="px-2 py-0.5 text-xs font-mono bg-slate-200 text-slate-600 rounded border border-slate-300">
            ESC
          </kbd>
        </div>

        {/* Command Items List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              No matching command or shortcut found.
            </div>
          ) : (
            filtered.map((cmd) => (
              <button
                key={cmd.id}
                onClick={cmd.action}
                className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-slate-100 border border-slate-200 group-hover:border-slate-300">
                    {cmd.icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800 group-hover:text-brand-600">
                      {cmd.title}
                    </p>
                    <p className="text-xs text-slate-500">{cmd.category}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {cmd.shortcut && (
                    <kbd className="px-2 py-0.5 text-[11px] font-mono bg-slate-100 text-slate-600 rounded border border-slate-200">
                      {cmd.shortcut}
                    </kbd>
                  )}
                  <ArrowRight className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
