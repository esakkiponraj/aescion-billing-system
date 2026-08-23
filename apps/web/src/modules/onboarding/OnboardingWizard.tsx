import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Users,
  Store,
  Receipt,
  Layers,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Zap,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { apiRequest } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { useTenantStore } from '../../stores/tenantStore';
import { BusinessType } from '@aescion/types';

export const OnboardingWizard: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState<BusinessType>(BusinessType.RETAIL);
  const [country, setCountry] = useState('IN');
  const [currency, setCurrency] = useState('INR');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [businessSize, setBusinessSize] = useState<'JUST_ME' | '2-10' | '11-50' | '50+'>('JUST_ME');
  const [outletCount, setOutletCount] = useState(1);
  const [taxIdentifier, setTaxIdentifier] = useState('');
  const [defaultTaxRate, setDefaultTaxRate] = useState(18);
  const [enabledModules, setEnabledModules] = useState<string[]>([
    'POS',
    'INVENTORY',
    'PURCHASES',
    'EXPENSES',
  ]);

  // Owner Account State (for new unauthenticated users)
  const [ownerFirstName, setOwnerFirstName] = useState('');
  const [ownerLastName, setOwnerLastName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');

  const navigate = useNavigate();
  const { user, setAuth, tokens } = useAuthStore();
  const { setActiveTenant } = useTenantStore();

  const handleNext = () => {
    if (currentStep === 1 && !businessName.trim()) {
      setError('Please provide a business name.');
      return;
    }
    if (currentStep === 6 && !user) {
      if (!ownerEmail.trim() || !ownerPassword.trim()) {
        setError('Please provide owner email and password to create your administrator account.');
        return;
      }
    }
    setError(null);
    if (currentStep < 6) {
      setCurrentStep(currentStep + 1);
    } else {
      handleCompleteOnboarding();
    }
  };

  const handleBack = () => {
    setError(null);
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const toggleModule = (mod: string) => {
    setEnabledModules((prev) =>
      prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod],
    );
  };

  const handleCompleteOnboarding = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const payload: any = {
        businessName,
        businessType,
        country,
        currency,
        timezone,
        businessSize,
        outletCount: Number(outletCount) || 1,
        taxIdentifier: taxIdentifier.trim() || undefined,
        defaultTaxRate: Number(defaultTaxRate) || undefined,
        enabledModules,
      };

      if (!user) {
        if (!ownerEmail.trim() || !ownerPassword.trim()) {
          setError('Please provide an owner email and password to create your account.');
          setIsLoading(false);
          return;
        }

        payload.ownerFirstName = ownerFirstName.trim() || 'Business';
        payload.ownerLastName = ownerLastName.trim() || 'Owner';
        payload.ownerEmail = ownerEmail.trim();
        payload.ownerPassword = ownerPassword;
        payload.ownerPhone = ownerPhone.trim() || undefined;

        const res = await apiRequest<any>('/onboarding/register-business', {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        setAuth({
          user: res.user,
          tokens: res.tokens,
          organizations: res.organizations,
        });

        setActiveTenant({
          orgId: res.organization.id,
          orgName: res.organization.name,
          outletId: res.primaryOutlet.id,
          outletName: res.primaryOutlet.name,
          businessType: res.organization.businessType,
          roles: ['OWNER'],
        });

        navigate('/dashboard');
        return;
      }

      const res = await apiRequest<any>('/onboarding/complete', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      // Refresh session data
      const sessionRes = await apiRequest<any>('/auth/session');
      if (tokens) {
        setAuth({
          user: sessionRes.user,
          tokens,
          organizations: sessionRes.organizations,
        });
      }

      setActiveTenant({
        orgId: res.organization.id,
        orgName: res.organization.name,
        outletId: res.primaryOutlet.id,
        outletName: res.primaryOutlet.name,
        businessType: res.organization.businessType,
        roles: ['OWNER'],
      });

      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to complete onboarding setup.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-brand-500/5 rounded-full blur-[140px] pointer-events-none" />

      {/* Header */}
      <div className="text-center mb-8 z-10 max-w-lg">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-50 border border-brand-200 text-brand-600 text-xs font-semibold mb-3">
          <Zap className="w-3.5 h-3.5" />
          <span>Intelligent Setup Engine</span>
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          Welcome to AESCION
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Let's tailor your high-speed billing and operations workspace.
        </p>
      </div>

      {/* Step Indicators */}
      <div className="flex items-center justify-center gap-2 mb-8 z-10">
        {[1, 2, 3, 4, 5, 6].map((step) => (
          <div
            key={step}
            className={`h-2 rounded-full transition-all duration-300 ${
              step === currentStep
                ? 'w-10 bg-brand-400'
                : step < currentStep
                  ? 'w-6 bg-brand-600/60'
                  : 'w-6 bg-slate-100'
            }`}
          />
        ))}
      </div>

      {/* Main Wizard Card */}
      <Card variant="glass" className="w-full max-w-xl border-slate-200 shadow-2xl p-6 sm:p-8 z-10">
        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-medium">
            {error}
          </div>
        )}

        {/* STEP 1: Business Profile */}
        {currentStep === 1 && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div>
              <h2 className="text-lg font-bold text-slate-900">1. Business Profile</h2>
              <p className="text-xs text-slate-500">Tell us what you sell and where you operate.</p>
            </div>

            <Input
              label="Business / Store Name"
              placeholder="e.g. Apex Supermarket"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              required
            />

            <Select
              label="Business Industry Profile"
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value as BusinessType)}
              options={[
                { value: BusinessType.RETAIL, label: 'Retail Shop (Electronics, Apparel, General)' },
                { value: BusinessType.SUPERMARKET, label: 'Supermarket / Grocery Multi-Lane' },
                { value: BusinessType.WHOLESALE, label: 'Wholesale / Distribution' },
                { value: BusinessType.RESTAURANT, label: 'Restaurant / Cafe / Food Service' },
                { value: BusinessType.SERVICE, label: 'Service / Repair Business' },
                { value: BusinessType.PHARMACY, label: 'Pharmacy / Healthcare Retail' },
              ]}
            />

            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                options={[
                  { value: 'IN', label: 'India (GST Ready)' },
                  { value: 'AE', label: 'United Arab Emirates (VAT)' },
                  { value: 'SG', label: 'Singapore' },
                  { value: 'US', label: 'United States' },
                  { value: 'GB', label: 'United Kingdom' },
                ]}
              />

              <Select
                label="Currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                options={[
                  { value: 'INR', label: 'INR (₹)' },
                  { value: 'AED', label: 'AED (د.إ)' },
                  { value: 'USD', label: 'USD ($)' },
                  { value: 'EUR', label: 'EUR (€)' },
                  { value: 'GBP', label: 'GBP (£)' },
                ]}
              />
            </div>
          </div>
        )}

        {/* STEP 2: Business Size */}
        {currentStep === 2 && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div>
              <h2 className="text-lg font-bold text-slate-900">2. Team & Business Size</h2>
              <p className="text-xs text-slate-500">We will adapt the interface complexity to your team.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { id: 'JUST_ME', title: 'Just Me', desc: 'Single owner running everything alone with zero bloat.' },
                { id: '2-10', title: '2 – 10 Staff', desc: 'Cashiers & Store Managers with role-based restrictions.' },
                { id: '11-50', title: '11 – 50 Staff', desc: 'Departmental shifts, accountants, and stock managers.' },
                { id: '50+', title: '50+ Enterprise', desc: 'Multi-branch operations with centralized approvals.' },
              ].map((s) => (
                <div
                  key={s.id}
                  onClick={() => setBusinessSize(s.id as any)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    businessSize === s.id
                      ? 'bg-brand-50 border-brand-500/50 shadow-md text-slate-900'
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <p className="font-bold text-sm">{s.title}</p>
                  <p className="text-xs text-slate-500 mt-1">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 3: Outlets & Branches */}
        {currentStep === 3 && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div>
              <h2 className="text-lg font-bold text-slate-900">3. Branch Configuration</h2>
              <p className="text-xs text-slate-500">How many locations are you launching today?</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div
                onClick={() => setOutletCount(1)}
                className={`p-4 rounded-xl border transition-all cursor-pointer text-center ${
                  outletCount === 1
                    ? 'bg-brand-50 border-brand-500/50 shadow-md text-slate-900'
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                <Store className="w-6 h-6 mx-auto mb-2 text-brand-600" />
                <p className="font-bold text-sm">Single Store</p>
                <p className="text-xs text-slate-500 mt-1">1 Main Branch</p>
              </div>

              <div
                onClick={() => setOutletCount(2)}
                className={`p-4 rounded-xl border transition-all cursor-pointer text-center ${
                  outletCount > 1
                    ? 'bg-brand-50 border-brand-500/50 shadow-md text-slate-900'
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                <Building2 className="w-6 h-6 mx-auto mb-2 text-sky-600" />
                <p className="font-bold text-sm">Multiple Branches</p>
                <p className="text-xs text-slate-500 mt-1">2+ Outlets</p>
              </div>
            </div>

            {outletCount > 1 && (
              <Input
                label="Number of Outlets to Initialize"
                type="number"
                min={2}
                max={50}
                value={outletCount}
                onChange={(e) => setOutletCount(parseInt(e.target.value, 10) || 2)}
              />
            )}
          </div>
        )}

        {/* STEP 4: Tax Configuration */}
        {currentStep === 4 && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div>
              <h2 className="text-lg font-bold text-slate-900">4. Tax & Legal Identity</h2>
              <p className="text-xs text-slate-500">Configure your regional tax identifier for compliant invoicing.</p>
            </div>

            <Input
              label="GSTIN / VAT Registration No. (Optional)"
              placeholder="e.g. 33AABCN1234F1Z5"
              value={taxIdentifier}
              onChange={(e) => setTaxIdentifier(e.target.value)}
              helperText="You can also add or update this anytime in settings."
            />

            <Select
              label="Default Tax Slab"
              value={defaultTaxRate.toString()}
              onChange={(e) => setDefaultTaxRate(parseInt(e.target.value, 10))}
              options={[
                { value: '0', label: '0% (Exempted / Zero Rated)' },
                { value: '5', label: '5% Standard Goods' },
                { value: '12', label: '12% Standard GST' },
                { value: '18', label: '18% Standard GST / Services' },
                { value: '28', label: '28% Luxury Goods' },
              ]}
            />
          </div>
        )}

        {/* STEP 5: Feature Modules */}
        {currentStep === 5 && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div>
              <h2 className="text-lg font-bold text-slate-900">5. Select Active Modules</h2>
              <p className="text-xs text-slate-500">Enable features needed for your launch day.</p>
            </div>

            <div className="space-y-2">
              {[
                { id: 'POS', title: 'High-Velocity Point of Sale (POS)', desc: 'Fast scanning, split tender, and thermal receipts.' },
                { id: 'INVENTORY', title: 'Inventory & Stock Movements', desc: 'Event-sourced ledger, batches, and reorder warnings.' },
                { id: 'PURCHASES', title: 'Purchases & Supplier Ledger', desc: 'Vendor orders, goods receipt notes, and payments.' },
                { id: 'EXPENSES', title: 'Operational Expenses & Cash Drawer', desc: 'Petty cash and daily expense classifications.' },
                ...(businessType === BusinessType.RESTAURANT
                  ? [{ id: 'RESTAURANT_PACK', title: 'Restaurant Pack (Tables & KOT)', desc: 'Floor plans, kitchen display tickets, and recipes.' }]
                  : []),
              ].map((m) => (
                <div
                  key={m.id}
                  onClick={() => toggleModule(m.id)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                    enabledModules.includes(m.id)
                      ? 'bg-brand-50 border-brand-500/40 text-slate-900'
                      : 'bg-slate-50 border-slate-200 text-slate-500'
                  }`}
                >
                  <div>
                    <p className="font-bold text-sm">{m.title}</p>
                    <p className="text-xs text-slate-500">{m.desc}</p>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                      enabledModules.includes(m.id)
                        ? 'bg-brand-500 border-brand-500 text-obsidian-950 font-bold'
                        : 'border-slate-300'
                    }`}
                  >
                    {enabledModules.includes(m.id) && '✓'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 6: Owner Account & Confirmation */}
        {currentStep === 6 && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-brand-50 border border-brand-200 text-brand-600 mx-auto flex items-center justify-center shadow-lg shadow-brand-500/10 mb-2">
                <Sparkles className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-extrabold text-slate-900">6. Owner Account & Launch</h2>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                {user ? 'Confirm and auto-provision your workspace.' : 'Set up your administrator credentials to manage your business.'}
              </p>
            </div>

            {!user && (
              <div className="space-y-3 p-4 rounded-xl bg-white border border-slate-200">
                <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">Business Owner Account</p>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="First Name"
                    placeholder="e.g. Priya"
                    value={ownerFirstName}
                    onChange={(e) => setOwnerFirstName(e.target.value)}
                    required
                  />
                  <Input
                    label="Last Name"
                    placeholder="e.g. Raman"
                    value={ownerLastName}
                    onChange={(e) => setOwnerLastName(e.target.value)}
                    required
                  />
                </div>
                <Input
                  label="Owner Work Email"
                  type="email"
                  placeholder="e.g. priya@mycompany.com"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  required
                />
                <Input
                  label="Password"
                  type="password"
                  placeholder="Create a strong password (min 6 chars)"
                  value={ownerPassword}
                  onChange={(e) => setOwnerPassword(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-left space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500">Business:</span>
                <span className="font-bold text-slate-900">{businessName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500">Profile:</span>
                <span className="font-bold text-slate-900">{businessType}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500">Branches Initialized:</span>
                <span className="font-bold text-slate-900">{outletCount} Outlet(s)</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Your Role:</span>
                <span className="font-bold text-brand-600">Business Owner (Full Authority)</span>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between pt-6 border-t border-slate-200 mt-6">
          {currentStep > 1 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleBack}
              leftIcon={<ArrowLeft className="w-4 h-4" />}
            >
              Back
            </Button>
          ) : (
            <Button
              variant="glass"
              size="sm"
              onClick={() => navigate('/login')}
              leftIcon={<ArrowLeft className="w-4 h-4" />}
            >
              Back to Sign In
            </Button>
          )}

          <Button
            size="md"
            onClick={handleNext}
            isLoading={isLoading}
            rightIcon={currentStep === 6 ? <Sparkles className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
          >
            {currentStep === 6 ? 'Launch My Business' : 'Continue'}
          </Button>
        </div>
      </Card>

      {/* Back to Login link */}
      <div className="mt-6 text-center z-10">
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="text-xs text-slate-500 hover:text-slate-900 transition-colors"
        >
          Already have an account? <span className="text-brand-600 font-semibold underline">Sign In</span>
        </button>
      </div>
    </div>
  );
};
