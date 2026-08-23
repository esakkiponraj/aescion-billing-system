import { create } from 'zustand';
import { PermissionCode, PermissionScope } from '@aescion/types';

interface TenantState {
  activeOrgId: string | null;
  activeOrgName: string | null;
  activeOutletId: string | null;
  activeOutletName: string | null;
  businessType: string | null;
  roles: string[];
  permissions: { code: PermissionCode; scope: PermissionScope }[];
  authorityLimits: {
    maxDiscountPercent: number;
    canOverridePrice: boolean;
    approvalLimit: number;
  };

  setActiveTenant: (data: {
    orgId: string;
    orgName: string;
    outletId: string;
    outletName: string;
    businessType?: string;
    roles?: string[];
    permissions?: { code: PermissionCode; scope: PermissionScope }[];
    authorityLimits?: {
      maxDiscountPercent: number;
      canOverridePrice: boolean;
      approvalLimit: number;
    };
  }) => void;
  setActiveOutlet: (outletId: string, outletName: string) => void;
  clearTenant: () => void;
  hasPermission: (permission: PermissionCode) => boolean;
  hasRole: (roleCode: string) => boolean;
}

const STORED_TENANT_KEY = 'aescion_active_tenant';

const loadPersistedTenant = () => {
  try {
    const raw = localStorage.getItem(STORED_TENANT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const persisted = loadPersistedTenant();

export const useTenantStore = create<TenantState>((set, get) => ({
  activeOrgId: persisted?.activeOrgId || null,
  activeOrgName: persisted?.activeOrgName || null,
  activeOutletId: persisted?.activeOutletId || null,
  activeOutletName: persisted?.activeOutletName || null,
  businessType: persisted?.businessType || 'RETAIL',
  roles: persisted?.roles || [],
  permissions: persisted?.permissions || [],
  authorityLimits: persisted?.authorityLimits || {
    maxDiscountPercent: 0,
    canOverridePrice: false,
    approvalLimit: 0,
  },

  setActiveTenant: (data) => {
    const tenantData = {
      activeOrgId: data.orgId,
      activeOrgName: data.orgName,
      activeOutletId: data.outletId,
      activeOutletName: data.outletName,
      businessType: data.businessType || 'RETAIL',
      roles: data.roles || ['MEMBER'],
      permissions: data.permissions || [],
      authorityLimits: data.authorityLimits || {
        maxDiscountPercent: 0,
        canOverridePrice: false,
        approvalLimit: 0,
      },
    };

    try {
      localStorage.setItem(STORED_TENANT_KEY, JSON.stringify(tenantData));
    } catch (e) {}

    set(tenantData);
  },

  setActiveOutlet: (outletId, outletName) => {
    set((state) => {
      const updated = {
        ...state,
        activeOutletId: outletId,
        activeOutletName: outletName,
      };
      try {
        localStorage.setItem(STORED_TENANT_KEY, JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  },

  clearTenant: () => {
    try {
      localStorage.removeItem(STORED_TENANT_KEY);
    } catch (e) {}
    set({
      activeOrgId: null,
      activeOrgName: null,
      activeOutletId: null,
      activeOutletName: null,
      businessType: 'RETAIL',
      roles: [],
      permissions: [],
      authorityLimits: {
        maxDiscountPercent: 0,
        canOverridePrice: false,
        approvalLimit: 0,
      },
    });
  },

  hasPermission: (permission) => {
    const state = get();
    if (state.roles.includes('SUPER_ADMIN') || state.roles.includes('OWNER') || state.roles.includes('SUPER_ADMIN_SUPPORT')) {
      return true;
    }
    return state.permissions.some((p) => p.code === permission);
  },

  hasRole: (roleCode) => {
    const state = get();
    return state.roles.includes(roleCode);
  },
}));
