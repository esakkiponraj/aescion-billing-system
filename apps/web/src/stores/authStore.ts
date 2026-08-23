import { create } from 'zustand';
import { AuthenticatedUser, AuthTokens, UserOrganizationSummary } from '@aescion/types';

interface SupportSession {
  organizationId: string;
  organizationName: string;
  reason: string;
  expiresAt: string;
}

interface AuthState {
  user: AuthenticatedUser | null;
  tokens: AuthTokens | null;
  organizations: UserOrganizationSummary[];
  supportSession: SupportSession | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  setAuth: (data: {
    user: AuthenticatedUser;
    tokens?: AuthTokens | null;
    organizations: UserOrganizationSummary[];
  }) => void;
  setSupportSession: (session: SupportSession | null) => void;
  clearAuth: () => void;
}

const STORED_AUTH_KEY = 'aescion_auth_state';

const loadPersistedAuth = () => {
  try {
    const raw = localStorage.getItem(STORED_AUTH_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const persisted = loadPersistedAuth();

export const useAuthStore = create<AuthState>((set, get) => ({
  user: persisted?.user || null,
  tokens: persisted?.tokens || null,
  organizations: persisted?.organizations || [],
  supportSession: persisted?.supportSession || null,
  isAuthenticated: !!persisted?.tokens?.accessToken,
  isLoading: false,

  setAuth: ({ user, tokens, organizations }) => {
    const currentTokens = tokens !== undefined ? tokens : get().tokens;
    const stateData = {
      user,
      tokens: currentTokens || null,
      organizations,
      isAuthenticated: !!currentTokens?.accessToken,
      isLoading: false,
    };
    try {
      localStorage.setItem(
        STORED_AUTH_KEY,
        JSON.stringify({ user, tokens: currentTokens, organizations }),
      );
    } catch (e) {
      console.error('Failed to persist auth state', e);
    }
    set(stateData);
  },

  setSupportSession: (session) => {
    set((state) => {
      const updated = { ...state, supportSession: session };
      try {
        localStorage.setItem(
          STORED_AUTH_KEY,
          JSON.stringify({
            user: updated.user,
            tokens: updated.tokens,
            organizations: updated.organizations,
            supportSession: session,
          }),
        );
      } catch (e) {}
      return updated;
    });
  },

  clearAuth: () => {
    try {
      localStorage.removeItem(STORED_AUTH_KEY);
      localStorage.removeItem('aescion_active_tenant');
    } catch (e) {}
    set({
      user: null,
      tokens: null,
      organizations: [],
      supportSession: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },
}));
