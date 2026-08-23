import React from 'react';
import { Outlet } from 'react-router-dom';
import { Zap, ShieldCheck, Sparkles } from 'lucide-react';

export const AuthLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Subtle ambient backdrop lights */}
      <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] bg-brand-500/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] bg-orange-500/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Brand Header */}
      <div className="flex items-center gap-3 mb-8 z-10">
        <div className="w-12 h-12 rounded-xl bg-brand-600 flex items-center justify-center shadow-lg shadow-brand-500/20">
          <Zap className="w-7 h-7 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            AESCION
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Commerce Operations Operating System
          </p>
        </div>
      </div>

      {/* Form Container */}
      <div className="w-full max-w-md z-10">
        <Outlet />
      </div>

      {/* Footer Trust Markers */}
      <div className="mt-8 flex items-center gap-6 text-xs text-slate-500 z-10">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-brand-600" /> Multi-Tenant Isolation
        </span>
        <span className="flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-orange-500" /> Offline-First Architecture
        </span>
      </div>
    </div>
  );
};
