import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, LogIn, Sparkles, Building, UserCheck, Shield } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { apiRequest } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { useTenantStore } from '../../stores/tenantStore';
import { AuthSessionResponse } from '@aescion/types';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const { setActiveTenant } = useTenantStore();

  const handleLogin = async (loginEmail?: string, loginPassword?: string) => {
    setIsLoading(true);
    setError(null);

    const submitEmail = loginEmail || email;
    const submitPassword = loginPassword || password;

    try {
      const res = await apiRequest<AuthSessionResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: submitEmail, password: submitPassword }),
      });

      const user = res?.user;
      if (!user || typeof user !== 'object') {
        throw new Error('Authentication response did not contain user information.');
      }

      setAuth({
        user: res.user,
        tokens: res.tokens,
        organizations: res.organizations || [],
      });

      if (user.isSuperAdmin) {
        navigate('/super-admin');
        return;
      }

      if (res.organizations && res.organizations.length > 0) {
        const primaryOrg = res.organizations[0];
        const primaryOutlet = primaryOrg.outlets?.[0];

        setActiveTenant({
          orgId: primaryOrg.organizationId,
          orgName: primaryOrg.organizationName,
          outletId: primaryOutlet?.outletId || '',
          outletName: primaryOutlet?.outletName || 'Main',
          businessType: primaryOrg.businessType,
          roles: [primaryOrg.roleCode],
        });

        navigate('/dashboard');
      } else {
        navigate('/onboarding');
      }
    } catch (err: any) {
      const message = err?.message || 'Invalid email or password. Please try again.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const demoPersonas = [
    {
      role: 'Owner',
      name: 'Priya (Nova Supermarket)',
      email: 'priya@novamart.com',
      badge: 'Multi-Outlet',
      variant: 'brand' as const,
    },
    {
      role: 'Manager',
      name: 'Karthik (Tenkasi Branch)',
      email: 'karthik@novamart.com',
      badge: 'Approvals & Ops',
      variant: 'info' as const,
    },
    {
      role: 'Cashier',
      name: 'Anand (Counter Cashier)',
      email: 'anand@novamart.com',
      badge: 'Fast Billing',
      variant: 'success' as const,
    },
    {
      role: 'Accountant',
      name: 'Suresh (Financials)',
      email: 'suresh@novamart.com',
      badge: 'Taxes & Ledgers',
      variant: 'warning' as const,
    },
    {
      role: 'Single-Shop',
      name: 'Ramesh (Apex QuickStore)',
      email: 'ramesh@apexquick.com',
      badge: 'Progressive MVP',
      variant: 'neutral' as const,
    },
    {
      role: 'Super Admin',
      name: 'SaaS Platform Admin',
      email: 'admin@aescion.com',
      badge: 'Support Mode',
      variant: 'danger' as const,
    },
  ];

  return (
    <div className="space-y-6">
      <Card variant="solid" className="border-slate-200 shadow-xl p-4 sm:p-8">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Sign In to Workspace
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Access your multi-tenant point-of-sale and business operations.
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
            {error}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleLogin();
          }}
          className="space-y-4"
        >
          <Input
            label="Work Email"
            type="email"
            placeholder="e.g. priya@novamart.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            leftIcon={<Mail className="w-4 h-4" />}
            required
          />

          <Input
            label="Password"
            type="password"
            placeholder="••••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            leftIcon={<Lock className="w-4 h-4" />}
            required
          />

          <Button
            type="submit"
            className="w-full mt-2"
            isLoading={isLoading}
            leftIcon={<LogIn className="w-4 h-4" />}
          >
            Sign In
          </Button>
        </form>

        <div className="mt-5 text-center">
          <Link
            to="/onboarding"
            className="text-xs text-slate-500 hover:text-brand-600 font-medium transition-colors"
          >
            Starting a new business? <strong className="text-brand-600">Launch Onboarding</strong>
          </Link>
        </div>
      </Card>

      {/* 1-Click Persona Quick Logins for Testing */}
      <Card variant="solid" className="border-slate-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              1-Click Demo Personas
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">Dev QuickSwitch</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {demoPersonas.map((p) => (
            <button
              key={p.email}
              onClick={() => {
                setEmail(p.email);
                const pwd = p.email === 'admin@aescion.com' ? 'Admin@12345' : 'Password@123';
                setPassword(pwd);
                handleLogin(p.email, pwd);
              }}
              className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-brand-500 hover:bg-brand-50/50 text-left transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 group-hover:text-brand-700">
                  {p.role}
                </span>
                <Badge variant={p.variant} size="sm">
                  {p.badge}
                </Badge>
              </div>
              <p className="text-[11px] text-slate-500 truncate mt-0.5">{p.name}</p>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
};
