import React, { useState, useEffect } from 'react';
import { ShieldAlert, LogOut, Clock } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { Button } from './Button';

export const SupportBanner: React.FC = () => {
  const { supportSession, setSupportSession } = useAuthStore();
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    if (!supportSession?.expiresAt) return;

    const interval = setInterval(() => {
      const remainingMs = new Date(supportSession.expiresAt).getTime() - new Date().getTime();
      if (remainingMs <= 0) {
        setTimeLeft('Session Expired');
        setSupportSession(null);
      } else {
        const mins = Math.floor(remainingMs / 60000);
        const secs = Math.floor((remainingMs % 60000) / 1000);
        setTimeLeft(`${mins}m ${secs < 10 ? '0' : ''}${secs}s`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [supportSession, setSupportSession]);

  if (!supportSession) return null;

  return (
    <div className="w-full bg-amber-500 text-white px-4 py-2 flex flex-wrap items-center justify-between gap-3 shadow-sm z-40 border-b border-amber-600 flex-shrink-0">
      <div className="flex items-center gap-2.5">
        <ShieldAlert className="w-5 h-5 text-white animate-bounce" />
        <span className="font-bold text-xs uppercase tracking-wider bg-amber-700 text-white px-2 py-0.5 rounded">
          Support Mode Active
        </span>
        <span className="text-sm font-medium">
          Authorized Impersonation for: <strong className="underline font-bold">{supportSession.organizationName}</strong>
        </span>
        <span className="text-xs text-amber-100 bg-amber-600/60 px-2 py-0.5 rounded-full hidden sm:inline-block">
          Reason: {supportSession.reason}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs font-mono font-bold bg-amber-700 text-white px-2.5 py-1 rounded-lg">
          <Clock className="w-3.5 h-3.5" />
          <span>{timeLeft || '30m 00s'}</span>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setSupportSession(null)}
          className="bg-amber-800 text-white hover:bg-amber-900 border-none text-xs py-1 shadow-sm"
          leftIcon={<LogOut className="w-3.5 h-3.5" />}
        >
          Exit Support Mode
        </Button>
      </div>
    </div>
  );
};
