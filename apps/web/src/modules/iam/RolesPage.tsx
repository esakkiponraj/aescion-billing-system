import React, { useState, useEffect, useMemo } from 'react';
import {
  KeyRound,
  Plus,
  ShieldCheck,
  Check,
  Lock,
  Sliders,
  Sparkles,
  CheckCircle2,
  Copy,
  Eye,
  Edit2,
  Trash2,
  Users,
  Shield,
  Layers,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { apiRequest } from '../../services/api';
import { useTenantStore } from '../../stores/tenantStore';

interface RoleRecord {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  maxDiscountPercent: number;
  priceOverrideAllowed: boolean;
  approvalLimit: number;
  isSystemDefault: boolean;
  organizationId?: string | null;
  rolePermissions: {
    permissionId: string;
    scope: string;
    permission: {
      id: string;
      code: string;
      module: string;
      description: string;
    };
  }[];
  _count?: {
    membershipRoles: number;
  };
}

interface PermissionRecord {
  id: string;
  code: string;
  module: string;
  description: string;
}

export const RolesPage: React.FC = () => {
  const { activeOrgId, activeOrgName, roles: userRoles } = useTenantStore();
  const isOwner = userRoles.includes('OWNER');

  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [permissions, setPermissions] = useState<PermissionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Status Notification
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Create Role Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [createName, setCreateName] = useState('');
  const [createCode, setCreateCode] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createMaxDiscount, setCreateMaxDiscount] = useState(10);
  const [createPriceOverride, setCreatePriceOverride] = useState(false);
  const [createApprovalLimit, setCreateApprovalLimit] = useState(5000);
  const [createSelectedPerms, setCreateSelectedPerms] = useState<string[]>([]);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // View Role Modal
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingRole, setViewingRole] = useState<RoleRecord | null>(null);

  // Edit Role Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editMaxDiscount, setEditMaxDiscount] = useState(10);
  const [editPriceOverride, setEditPriceOverride] = useState(false);
  const [editApprovalLimit, setEditApprovalLimit] = useState(5000);
  const [editSelectedPerms, setEditSelectedPerms] = useState<string[]>([]);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete Role State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingRole, setDeletingRole] = useState<RoleRecord | null>(null);
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [rolesRes, permsRes] = await Promise.all([
        apiRequest<RoleRecord[]>('/iam/roles'),
        apiRequest<PermissionRecord[]>('/iam/permissions'),
      ]);
      setRoles(rolesRes || []);
      setPermissions(permsRes || []);
    } catch (e) {
      console.error('Failed to load roles and permissions:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeOrgId]);

  // Group permissions by module
  const permissionsByModule = useMemo(() => {
    const map = new Map<string, PermissionRecord[]>();
    for (const p of permissions) {
      const mod = p.module || 'GENERAL';
      const list = map.get(mod) || [];
      list.push(p);
      map.set(mod, list);
    }
    return map;
  }, [permissions]);

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (!templateId) return;

    const templateRole = roles.find((r) => r.id === templateId);
    if (templateRole) {
      const templatePermIds = (templateRole.rolePermissions || [])
        .map((rp) => rp.permissionId || rp.permission?.id)
        .filter(Boolean);
      setCreateSelectedPerms(templatePermIds);
      setCreateMaxDiscount(templateRole.maxDiscountPercent ?? 10);
      setCreatePriceOverride(Boolean(templateRole.priceOverrideAllowed));
      setCreateApprovalLimit(templateRole.approvalLimit ?? 5000);
    }
  };

  // Create Role
  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    const trimmedName = createName.trim();
    if (!trimmedName) {
      setCreateError('Role Name is required.');
      return;
    }

    const finalCode = (
      createCode.trim() || trimmedName.toUpperCase().replace(/[^A-Z0-9]/g, '_')
    ).replace(/_+/g, '_');

    setIsSubmittingCreate(true);

    try {
      await apiRequest('/iam/roles', {
        method: 'POST',
        body: JSON.stringify({
          name: trimmedName,
          code: finalCode,
          description: createDescription.trim() || undefined,
          maxDiscountPercent: Number(createMaxDiscount),
          priceOverrideAllowed: createPriceOverride,
          approvalLimit: Number(createApprovalLimit),
          permissions: createSelectedPerms.map((permId) => ({
            permissionId: permId,
            scope: 'ORGANIZATION',
          })),
        }),
      });

      setIsCreateModalOpen(false);
      setCreateName('');
      setCreateCode('');
      setCreateDescription('');
      setSelectedTemplateId('');
      setCreateSelectedPerms([]);
      setStatusMessage({
        type: 'success',
        text: `Role '${trimmedName}' created successfully.`,
      });
      await fetchData();
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create custom role.');
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (role: RoleRecord) => {
    setEditingRoleId(role.id);
    setEditName(role.name);
    setEditDescription(role.description || '');
    setEditMaxDiscount(role.maxDiscountPercent ?? 10);
    setEditPriceOverride(Boolean(role.priceOverrideAllowed));
    setEditApprovalLimit(role.approvalLimit ?? 5000);
    const existingPermIds = (role.rolePermissions || [])
      .map((rp) => rp.permissionId || rp.permission?.id)
      .filter(Boolean);
    setEditSelectedPerms(existingPermIds);
    setEditError(null);
    setIsEditModalOpen(true);
  };

  // Handle Update Role
  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoleId) return;
    setEditError(null);

    const trimmedName = editName.trim();
    if (!trimmedName) {
      setEditError('Role Name is required.');
      return;
    }

    setIsSubmittingEdit(true);

    try {
      await apiRequest(`/iam/roles/${editingRoleId}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: trimmedName,
          description: editDescription.trim() || undefined,
          maxDiscountPercent: Number(editMaxDiscount),
          priceOverrideAllowed: editPriceOverride,
          approvalLimit: Number(editApprovalLimit),
          permissions: editSelectedPerms.map((permId) => ({
            permissionId: permId,
            scope: 'ORGANIZATION',
          })),
        }),
      });

      setIsEditModalOpen(false);
      setStatusMessage({
        type: 'success',
        text: `Role '${trimmedName}' permissions and authority limits updated successfully. Changes apply immediately!`,
      });
      await fetchData();
    } catch (err: any) {
      setEditError(err.message || 'Failed to update role.');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Open Delete Modal
  const openDeleteModal = (role: RoleRecord) => {
    setDeletingRole(role);
    setDeleteError(null);
    setIsDeleteModalOpen(true);
  };

  // Handle Delete Role
  const handleDeleteRole = async () => {
    if (!deletingRole) return;
    setDeleteError(null);
    setIsSubmittingDelete(true);

    try {
      const res = await apiRequest<any>(`/iam/roles/${deletingRole.id}`, {
        method: 'DELETE',
      });
      setIsDeleteModalOpen(false);
      setStatusMessage({
        type: 'success',
        text: res.message || `Role '${deletingRole.name}' deleted successfully.`,
      });
      await fetchData();
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete role.');
    } finally {
      setIsSubmittingDelete(false);
    }
  };

  // Permission toggles helper
  const togglePermInList = (
    list: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>,
    permId: string,
  ) => {
    setList((prev) =>
      prev.includes(permId) ? prev.filter((id) => id !== permId) : [...prev, permId],
    );
  };

  const toggleModulePerms = (
    list: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>,
    modulePerms: PermissionRecord[],
  ) => {
    const modPermIds = modulePerms.map((p) => p.id);
    const allSelected = modPermIds.every((id) => list.includes(id));
    if (allSelected) {
      setList((prev) => prev.filter((id) => !modPermIds.includes(id)));
    } else {
      setList((prev) => Array.from(new Set([...prev, ...modPermIds])));
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <KeyRound className="w-8 h-8 text-brand-600" />
            Roles & Permissions Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure system roles, granular module permissions, discount ceilings, and approval thresholds for{' '}
            <strong className="text-slate-800">{activeOrgName}</strong>.
          </p>
        </div>

        <Button
          onClick={() => {
            setCreateName('');
            setCreateCode('');
            setCreateDescription('');
            setSelectedTemplateId('');
            setCreateSelectedPerms([]);
            setCreateError(null);
            setIsCreateModalOpen(true);
          }}
          leftIcon={<Plus className="w-4 h-4" />}
          className="shadow-lg shadow-brand-500/20"
        >
          Create Role
        </Button>
      </div>

      {/* Status Banner */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-medium ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : statusMessage.type === 'info'
                ? 'bg-sky-50 border-sky-200 text-sky-700'
                : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{statusMessage.text}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-slate-500 hover:text-slate-900 font-bold ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Roles Master Table */}
      <Card variant="glass" className="overflow-hidden p-0 border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50/90 text-slate-500 border-b border-slate-200 text-[11px] uppercase tracking-wider font-bold">
              <tr>
                <th className="py-3 px-4">Role Name & Code</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Assigned Members</th>
                <th className="py-3 px-4">Max Discount</th>
                <th className="py-3 px-4">Price Override</th>
                <th className="py-3 px-4">Granted Perms</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    Loading system roles...
                  </td>
                </tr>
              ) : roles.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No roles found.
                  </td>
                </tr>
              ) : (
                roles.map((r) => {
                  const isOwnerRole = r.code === 'OWNER';
                  const memberCount = r._count?.membershipRoles ?? 0;
                  const permsCount = r.rolePermissions?.length ?? 0;

                  return (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">{r.name}</span>
                            {isOwnerRole && (
                              <span title="Owner role is permanently protected">
                                <Shield className="w-3.5 h-3.5 text-amber-600" />
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] font-mono text-slate-500 mt-0.5">{r.code}</p>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        {r.isSystemDefault ? (
                          <Badge variant="brand" size="sm">
                            System Default
                          </Badge>
                        ) : (
                          <Badge variant="neutral" size="sm">
                            Custom Role
                          </Badge>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                          <Users className="w-3.5 h-3.5 text-slate-500" />
                          {memberCount} Member{memberCount === 1 ? '' : 's'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-bold text-brand-600">{r.maxDiscountPercent}%</span>
                      </td>

                      <td className="py-3.5 px-4">
                        <Badge variant={r.priceOverrideAllowed ? 'success' : 'neutral'} size="sm">
                          {r.priceOverrideAllowed ? 'Allowed' : 'Blocked'}
                        </Badge>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-900">{permsCount} Permissions</span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View Role */}
                          <button
                            onClick={() => {
                              setViewingRole(r);
                              setIsViewModalOpen(true);
                            }}
                            title="View Permissions"
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-brand-500 hover:text-slate-900 text-slate-700 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit Role */}
                          <button
                            onClick={() => openEditModal(r)}
                            title="Edit Role & Permissions"
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-sky-500 hover:text-white text-slate-700 transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Role */}
                          {!isOwnerRole && (
                            <button
                              onClick={() => openDeleteModal(r)}
                              title={memberCount > 0 ? 'Reassign members before deleting' : 'Delete Role'}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-500 hover:text-white text-slate-500 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Permissions Matrix Reference */}
      <Card variant="solid" className="border-slate-200 p-6 space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            Granular Permissions Reference Matrix
          </h2>
          <p className="text-xs text-slate-500">
            Enforced across all backend API controllers with real-time evaluation.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from(permissionsByModule.entries()).map(([moduleName, perms]) => (
            <div key={moduleName} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                <span className="font-bold text-slate-900 text-xs uppercase tracking-wider">{moduleName}</span>
                <span className="text-[11px] text-slate-500 font-mono">{perms.length} perms</span>
              </div>
              <div className="space-y-1.5">
                {perms.map((p) => (
                  <div key={p.id} className="text-xs">
                    <span className="font-mono text-[11px] text-brand-600 font-semibold block">{p.code}</span>
                    <span className="text-slate-500 text-[11px]">{p.description}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* View Role Modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title={`Role Details • ${viewingRole?.name}`}
        subtitle={`Code: ${viewingRole?.code} • ${viewingRole?.isSystemDefault ? 'System Default' : 'Custom Role'}`}
        maxWidth="lg"
      >
        {viewingRole && (
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <p className="text-slate-700">{viewingRole.description || 'No description provided.'}</p>
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 text-[11px]">
                <div>
                  <span className="text-slate-500 block">Max Discount:</span>
                  <strong className="text-brand-600 text-xs">{viewingRole.maxDiscountPercent}%</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Price Override:</span>
                  <strong className={viewingRole.priceOverrideAllowed ? 'text-emerald-600 text-xs' : 'text-slate-500 text-xs'}>
                    {viewingRole.priceOverrideAllowed ? 'Allowed' : 'Blocked'}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Granted Perms:</span>
                  <strong className="text-slate-900 text-xs">{viewingRole.rolePermissions?.length || 0} active</strong>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2">
                Active Module Permissions ({viewingRole.rolePermissions?.length || 0})
              </h3>
              <div className="max-h-72 overflow-y-auto space-y-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                {Array.from(permissionsByModule.entries()).map(([modName, modPerms]) => {
                  const activeModPerms = modPerms.filter((p) =>
                    viewingRole.rolePermissions?.some((rp) => rp.permissionId === p.id || rp.permission?.id === p.id),
                  );
                  if (activeModPerms.length === 0) return null;

                  return (
                    <div key={modName} className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-1.5">
                      <div className="flex items-center justify-between font-bold text-slate-900 text-xs">
                        <span>{modName}</span>
                        <span className="text-[11px] text-brand-600">{activeModPerms.length} granted</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {activeModPerms.map((p) => (
                          <div key={p.id} className="flex items-center gap-1.5 text-[11px] text-slate-700">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>{p.description}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-200">
              <Button size="sm" variant="outline" onClick={() => setIsViewModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Role Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Edit Role Permissions • ${editName}`}
        subtitle="Modify role details, authority limits, and toggle permissions grouped by module. Changes apply immediately."
        maxWidth="xl"
      >
        {editError && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-medium">
            {editError}
          </div>
        )}

        <form onSubmit={handleUpdateRole} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Role Name *"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              required
            />
            <Input
              label="Description"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Duties and responsibilities"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <Input
              label="Max Allowed Discount (%)"
              type="number"
              min={0}
              max={100}
              value={editMaxDiscount}
              onChange={(e) => setEditMaxDiscount(parseFloat(e.target.value) || 0)}
              helperText="Discounts above ceiling trigger approval"
            />
            <div className="pt-6">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={editPriceOverride}
                  onChange={(e) => setEditPriceOverride(e.target.checked)}
                  className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <span>Can Override Item Selling Price</span>
              </label>
            </div>
          </div>

          {/* Module-Grouped Permissions Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                Module Permissions ({editSelectedPerms.length} / {permissions.length} selected)
              </span>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setEditSelectedPerms(permissions.map((p) => p.id))}
                  className="text-brand-600 hover:underline font-semibold"
                >
                  Select All
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={() => setEditSelectedPerms([])}
                  className="text-slate-500 hover:underline"
                >
                  Clear All
                </button>
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              {Array.from(permissionsByModule.entries()).map(([modName, modPerms]) => {
                const modPermIds = modPerms.map((p) => p.id);
                const isAllModSelected = modPermIds.every((id) => editSelectedPerms.includes(id));
                const isSomeModSelected = modPermIds.some((id) => editSelectedPerms.includes(id));

                return (
                  <div key={modName} className="p-3 bg-white rounded-lg border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                      <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-900 text-xs">
                        <input
                          type="checkbox"
                          checked={isAllModSelected}
                          ref={(input) => {
                            if (input) {
                              input.indeterminate = isSomeModSelected && !isAllModSelected;
                            }
                          }}
                          onChange={() => toggleModulePerms(editSelectedPerms, setEditSelectedPerms, modPerms)}
                          className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                        />
                        <span>{modName}</span>
                      </label>
                      <span className="text-[11px] text-slate-400">
                        {modPerms.filter((p) => editSelectedPerms.includes(p.id)).length} / {modPerms.length}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pl-6">
                      {modPerms.map((p) => {
                        const isChecked = editSelectedPerms.includes(p.id);
                        return (
                          <label
                            key={p.id}
                            className={`p-1.5 rounded flex items-center gap-2 cursor-pointer text-[11px] transition-colors ${
                              isChecked ? 'bg-brand-50 text-slate-900 font-medium' : 'text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => togglePermInList(editSelectedPerms, setEditSelectedPerms, p.id)}
                              className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                            />
                            <span>{p.description}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEditModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={isSubmittingEdit}>
              Save Role Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Create Role Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Role"
        subtitle="Create a custom role with tailored module permissions and discount authorization ceilings."
        maxWidth="xl"
      >
        {createError && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-medium">
            {createError}
          </div>
        )}

        <form onSubmit={handleCreateRole} className="space-y-4 text-xs">
          {/* Optional Template Selector */}
          <Select
            label="Base Template (Optional Starting Point)"
            value={selectedTemplateId}
            onChange={(e) => handleTemplateChange(e.target.value)}
            options={[
              { value: '', label: 'None — Start with empty custom permissions' },
              ...roles.map((r) => ({
                value: r.id,
                label: `Clone from: ${r.name} (${r.rolePermissions?.length || 0} perms)`,
              })),
            ]}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Role Name *"
              placeholder="e.g. Senior Cashier, Floor Supervisor"
              value={createName}
              onChange={(e) => {
                setCreateName(e.target.value);
                if (!createCode || createCode === createName.toUpperCase().replace(/[^A-Z0-9]/g, '_')) {
                  setCreateCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '_'));
                }
              }}
              required
            />
            <Input
              label="Role Code *"
              placeholder="e.g. SENIOR_CASHIER"
              value={createCode}
              onChange={(e) => setCreateCode(e.target.value.toUpperCase())}
              required
            />
          </div>

          <Input
            label="Description"
            placeholder="Brief duties of this role..."
            value={createDescription}
            onChange={(e) => setCreateDescription(e.target.value)}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <Input
              label="Max Allowed Discount (%)"
              type="number"
              min={0}
              max={100}
              value={createMaxDiscount}
              onChange={(e) => setCreateMaxDiscount(parseFloat(e.target.value) || 0)}
              helperText="Discounts above ceiling trigger approval"
            />
            <div className="pt-6">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={createPriceOverride}
                  onChange={(e) => setCreatePriceOverride(e.target.checked)}
                  className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <span>Can Override Item Selling Price</span>
              </label>
            </div>
          </div>

          {/* Module-Grouped Permissions Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                Module Permissions ({createSelectedPerms.length} / {permissions.length} selected)
              </span>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setCreateSelectedPerms(permissions.map((p) => p.id))}
                  className="text-brand-600 hover:underline font-semibold"
                >
                  Select All
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={() => setCreateSelectedPerms([])}
                  className="text-slate-500 hover:underline"
                >
                  Clear All
                </button>
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              {Array.from(permissionsByModule.entries()).map(([modName, modPerms]) => {
                const modPermIds = modPerms.map((p) => p.id);
                const isAllModSelected = modPermIds.every((id) => createSelectedPerms.includes(id));
                const isSomeModSelected = modPermIds.some((id) => createSelectedPerms.includes(id));

                return (
                  <div key={modName} className="p-3 bg-white rounded-lg border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                      <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-900 text-xs">
                        <input
                          type="checkbox"
                          checked={isAllModSelected}
                          ref={(input) => {
                            if (input) {
                              input.indeterminate = isSomeModSelected && !isAllModSelected;
                            }
                          }}
                          onChange={() => toggleModulePerms(createSelectedPerms, setCreateSelectedPerms, modPerms)}
                          className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                        />
                        <span>{modName}</span>
                      </label>
                      <span className="text-[11px] text-slate-400">
                        {modPerms.filter((p) => createSelectedPerms.includes(p.id)).length} / {modPerms.length}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pl-6">
                      {modPerms.map((p) => {
                        const isChecked = createSelectedPerms.includes(p.id);
                        return (
                          <label
                            key={p.id}
                            className={`p-1.5 rounded flex items-center gap-2 cursor-pointer text-[11px] transition-colors ${
                              isChecked ? 'bg-brand-50 text-slate-900 font-medium' : 'text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => togglePermInList(createSelectedPerms, setCreateSelectedPerms, p.id)}
                              className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                            />
                            <span>{p.description}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCreateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={isSubmittingCreate}>
              Create Role
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Role Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title={`Delete Role • ${deletingRole?.name}`}
        maxWidth="md"
      >
        <div className="space-y-4 text-xs">
          {deleteError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-medium">
              {deleteError}
            </div>
          )}

          <p className="text-slate-700">
            Are you sure you want to delete the role <strong className="text-slate-900">{deletingRole?.name}</strong>?
            This action will permanently remove this role and its permission mappings.
          </p>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleDeleteRole}
              isLoading={isSubmittingDelete}
            >
              Delete Role
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
