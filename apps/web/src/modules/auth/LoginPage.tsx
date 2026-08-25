import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, LogIn, Eye, EyeOff, ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Card } from '../../components/common/Card';
import { Modal } from '../../components/common/Modal';
import { apiRequest } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { useTenantStore } from '../../stores/tenantStore';
import { AuthSessionResponse } from '@aescion/types';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Account Linking Modal State
  const [isLinkingModalOpen, setIsLinkingModalOpen] = useState(false);
  const [pendingGoogleToken, setPendingGoogleToken] = useState<string | null>(null);
  const [linkEmail, setLinkEmail] = useState('');
  const [linkPassword, setLinkPassword] = useState('');
  const [showLinkPassword, setShowLinkPassword] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [isLinkingSubmitting, setIsLinkingSubmitting] = useState(false);

  const googleButtonRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const { setActiveTenant } = useTenantStore();

  const googleClientId =
    (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID ||
    (import.meta as any).env?.GOOGLE_CLIENT_ID ||
    '';

  const isGoogleConfigured = Boolean(googleClientId && googleClientId.trim());

  // Process successful authenticated session
  const handleAuthSuccess = (res: AuthSessionResponse) => {
    const user = res?.user;
    if (!user || typeof user !== 'object') {
      throw new Error('Authentication response did not contain user profile.');
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

    if (res.isNewUser || !res.organizations || res.organizations.length === 0) {
      navigate('/onboarding');
      return;
    }

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
  };

  // 1. Google ID Token Verification & Sign-In Handler
  const handleGoogleCredentialResponse = async (response: { credential?: string }) => {
    if (!response?.credential) {
      setError('Google Sign-In was cancelled or failed to return credentials.');
      return;
    }

    setIsGoogleLoading(true);
    setError(null);

    try {
      const res = await apiRequest<AuthSessionResponse>('/auth/google', {
        method: 'POST',
        body: JSON.stringify({ idToken: response.credential }),
      });

      // Handle Existing Account Linking
      if (res.requiresPasswordLink) {
        setPendingGoogleToken(response.credential);
        setLinkEmail(res.googleEmail || '');
        setLinkPassword('');
        setLinkError(null);
        setIsLinkingModalOpen(true);
        return;
      }

      handleAuthSuccess(res);
    } catch (err: any) {
      const message = err?.message || 'Google authentication failed. Please try again.';
      setError(message);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // 2. Initialize Google Identity Services SDK
  useEffect(() => {
    if (!isGoogleConfigured) {
      return;
    }

    let checkInterval: NodeJS.Timeout | null = null;

    const initGsi = () => {
      if (window.google?.accounts?.id && googleClientId) {
        try {
          window.google.accounts.id.initialize({
            client_id: googleClientId,
            callback: handleGoogleCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: true,
          });

          if (googleButtonRef.current) {
            googleButtonRef.current.innerHTML = '';
            window.google.accounts.id.renderButton(googleButtonRef.current, {
              type: 'standard',
              theme: 'outline',
              size: 'large',
              text: 'continue_with',
              shape: 'rectangular',
              logo_alignment: 'left',
              width: 380,
            });
          }
        } catch (e) {
          console.warn('[Google Auth] GIS initialize error:', e);
        }
      }
    };

    if (window.google?.accounts?.id) {
      initGsi();
    } else {
      checkInterval = setInterval(() => {
        if (window.google?.accounts?.id) {
          initGsi();
          if (checkInterval) clearInterval(checkInterval);
        }
      }, 300);
    }

    return () => {
      if (checkInterval) clearInterval(checkInterval);
    };
  }, [googleClientId, isGoogleConfigured]);

  // Fallback Google Sign-In prompt trigger
  const handleManualGoogleClick = () => {
    if (!isGoogleConfigured) {
      setError('Google Sign-In is not configured. Please set the VITE_GOOGLE_CLIENT_ID environment variable.');
      return;
    }

    if (window.google?.accounts?.id) {
      setIsGoogleLoading(true);
      setError(null);
      try {
        window.google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed() || notification.isDismissedMoment() || notification.isSkippedMoment()) {
            setIsGoogleLoading(false);
          }
        });
      } catch (err) {
        setIsGoogleLoading(false);
        setError('Unable to open Google Sign-In window. Please ensure popups are enabled.');
      }
    } else {
      setError('Google Identity service is still loading. Please check your network or try again in a few seconds.');
    }
  };

  // 3. Confirm Password to Link Existing Account
  const handleConfirmAccountLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingGoogleToken || !linkPassword) return;

    setIsLinkingSubmitting(true);
    setLinkError(null);

    try {
      const res = await apiRequest<AuthSessionResponse>('/auth/google', {
        method: 'POST',
        body: JSON.stringify({
          idToken: pendingGoogleToken,
          linkPassword,
        }),
      });

      setIsLinkingModalOpen(false);
      handleAuthSuccess(res);
    } catch (err: any) {
      setLinkError(err?.message || 'Invalid password for account linking. Please verify your AESCION password.');
    } finally {
      setIsLinkingSubmitting(false);
    }
  };

  // 4. Normal Email/Password Login
  const handleNormalLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError('Please enter your work email address.');
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(cleanEmail)) {
      setError('Please enter a valid email address (e.g. name@company.com).');
      return;
    }

    if (!password) {
      setError('Please enter your account password.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await apiRequest<AuthSessionResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: cleanEmail, password }),
      });

      handleAuthSuccess(res);
    } catch (err: any) {
      const message = err?.message || 'Invalid email or password. Please check your credentials and try again.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <Card variant="solid" className="border-slate-200 shadow-xl p-5 sm:p-8 bg-white rounded-2xl">
        {/* Card Heading */}
        <div className="mb-6 text-center sm:text-left">
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Sign In to Workspace
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Access your multi-tenant point-of-sale and business operations.
          </p>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-start gap-2.5 animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed">{error}</div>
          </div>
        )}

        <div className="space-y-4">
          {/* 1. Official Google Sign-In Container */}
          <div className="w-full flex flex-col items-center justify-center">
            {isGoogleConfigured ? (
              <div className="w-full flex justify-center min-h-[44px]">
                <div ref={googleButtonRef} className="w-full flex justify-center" />
              </div>
            ) : null}

            {/* Fallback Styled Google Button if GIS iframe is initializing or if clicked directly */}
            {(!isGoogleConfigured || isGoogleLoading) && (
              <button
                type="button"
                onClick={handleManualGoogleClick}
                disabled={isGoogleLoading}
                className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:opacity-60"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.02 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                {isGoogleLoading ? 'Connecting to Google...' : 'Continue with Google'}
              </button>
            )}
          </div>

          {/* 2. Clean Divider with "OR" */}
          <div className="relative my-4 flex items-center justify-center">
            <div className="w-full border-t border-slate-200" />
            <span className="absolute bg-white px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              OR
            </span>
          </div>

          {/* 3. Normal Email/Password Form */}
          <form onSubmit={handleNormalLogin} className="space-y-4">
            <Input
              label="Work Email"
              type="email"
              placeholder="e.g. name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail className="w-4 h-4" />}
              autoComplete="email"
              required
              disabled={isLoading || isGoogleLoading}
            />

            <div>
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<Lock className="w-4 h-4" />}
                rightElement={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="p-1 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4 text-slate-500" />
                    ) : (
                      <Eye className="w-4 h-4 text-slate-500" />
                    )}
                  </button>
                }
                autoComplete="current-password"
                required
                disabled={isLoading || isGoogleLoading}
              />
            </div>

            {/* 4. Full-Width Sign In Button */}
            <Button
              type="submit"
              className="w-full mt-2 py-2.5 shadow-md shadow-brand-500/10"
              isLoading={isLoading}
              disabled={isLoading || isGoogleLoading}
              leftIcon={<LogIn className="w-4 h-4" />}
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          {/* 5. Launch Onboarding Link */}
          <div className="pt-3 border-t border-slate-100 text-center">
            <Link
              to="/onboarding"
              className="text-xs text-slate-500 hover:text-brand-600 font-medium transition-colors inline-block py-1"
            >
              Starting a new business? <strong className="text-brand-600 hover:underline">Launch Onboarding</strong>
            </Link>
          </div>
        </div>
      </Card>

      {/* Account Linking Modal (When existing email user signs in via Google) */}
      <Modal
        isOpen={isLinkingModalOpen}
        onClose={() => {
          if (!isLinkingSubmitting) {
            setIsLinkingModalOpen(false);
            setPendingGoogleToken(null);
          }
        }}
        title="Link Google to Existing Account"
        maxWidth="md"
      >
        <form onSubmit={handleConfirmAccountLink} className="space-y-4">
          <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs leading-relaxed flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              An AESCION account for <strong>{linkEmail}</strong> already exists. Please confirm your account password once to securely link Google Sign-In for future one-click access.
            </div>
          </div>

          {linkError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
              {linkError}
            </div>
          )}

          <Input
            label="AESCION Account Password"
            type={showLinkPassword ? 'text' : 'password'}
            placeholder="Enter your current password"
            value={linkPassword}
            onChange={(e) => setLinkPassword(e.target.value)}
            leftIcon={<Lock className="w-4 h-4" />}
            rightElement={
              <button
                type="button"
                onClick={() => setShowLinkPassword(!showLinkPassword)}
                tabIndex={-1}
                className="p-1 text-slate-400 hover:text-slate-600 focus:outline-none"
              >
                {showLinkPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
            required
            autoFocus
          />

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsLinkingModalOpen(false);
                setPendingGoogleToken(null);
              }}
              disabled={isLinkingSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={isLinkingSubmitting}
              leftIcon={<CheckCircle2 className="w-4 h-4" />}
            >
              Confirm & Link Account
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
