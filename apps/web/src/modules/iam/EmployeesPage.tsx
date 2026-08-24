import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  ShieldCheck,
  Building,
  KeyRound,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  Sparkles,
  AlertTriangle,
  Edit2,
  CheckCircle2,
  Clock,
  Store,
  Layers,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Modal } from '../../components/common/Modal';
import { Table } from '../../components/common/Table';
import { apiRequest } from '../../services/api';
import { useTenantStore } from '../../stores/tenantStore';

interface MemberItem {
  membershipId: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string | null;
    isActive: boolean;
    createdAt: string;
  };
  status: string;
  joinedAt: string;
  lastLogin?: string;
  primaryRole?: {
    id: string;
    name: string;
    code: string;
    maxDiscountPercent: number;
    priceOverrideAllowed: boolean;
  } | null;
  outlets: {
    outletId: string;
    outletName: string;
    outletCode: string;
    role: string;
  }[];
  assignedProductIds?: string[];
}

export const EmployeesPage: React.FC = () => {
  const { activeOrgId, activeOrgName } = useTenantStore();

  const [members, setMembers] = useState<MemberItem[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [outlets, setOutlets] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Add Employee Form State
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [selectedOutletId, setSelectedOutletId] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Edit Employee Form State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingMembershipId, setEditingMembershipId] = useState<string | null>(null);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRoleId, setEditRoleId] = useState('');
  const [editOutletId, setEditOutletId] = useState('');
  const [editStatus, setEditStatus] = useState<'ACTIVE' | 'SUSPENDED'>('ACTIVE');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [membersRes, rolesRes, outletsRes, prodsRes] = await Promise.all([
        apiRequest<MemberItem[]>('/iam/members'),
        apiRequest<any[]>('/iam/roles'),
        apiRequest<any[]>('/tenancy/outlets'),
        apiRequest<any[]>('/products').catch(() => []),
      ]);

      setMembers(membersRes || []);
      const filteredRoles = (rolesRes || []).filter((r) => r.code !== 'SUPER_ADMIN');
      setRoles(filteredRoles);
      setOutlets(outletsRes || []);
      setProducts(prodsRes || []);

      if (filteredRoles.length > 0 && !selectedRoleId) {
        setSelectedRoleId(filteredRoles[0].id);
      }
    } catch (err) {
      console.error('Failed to load team data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeOrgId]);

  const resetForm = () => {
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setPassword('');
    setConfirmPassword('');
    setInviteError(null);
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setInviteError(null);

    if (password !== confirmPassword) {
      setInviteError('Passwords do not match.');
      setIsSubmitting(false);
      return;
    }

    try {
      await apiRequest('/iam/invite', {
        method: 'POST',
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          password,
          confirmPassword,
          roleId: selectedRoleId,
          outletId: selectedOutletId || undefined,
        }),
      });

      setIsInviteOpen(false);
      resetForm();
      setStatusMessage({ type: 'success', text: `Team member ${firstName} ${lastName} added successfully.` });
      await fetchData();
    } catch (err: any) {
      setInviteError(err.message || 'Failed to create employee account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (item: MemberItem) => {
    setEditingMembershipId(item.membershipId);
    setEditFirstName(item.user.firstName || '');
    setEditLastName(item.user.lastName || '');
    setEditEmail(item.user.email || '');
    setEditPhone(item.user.phone || '');
    setEditRoleId(item.primaryRole?.id || roles[0]?.id || '');
    setEditOutletId(item.outlets?.[0]?.outletId || '');
    setEditStatus(item.status === 'ACTIVE' ? 'ACTIVE' : 'SUSPENDED');
    setEditError(null);
    setIsEditOpen(true);
  };

  const handleEditEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMembershipId) return;

    setIsSubmittingEdit(true);
    setEditError(null);

    try {
      await apiRequest(`/iam/members/${editingMembershipId}`, {
        method: 'PUT',
        body: JSON.stringify({
          firstName: editFirstName.trim(),
          lastName: editLastName.trim(),
          email: editEmail.trim(),
          phone: editPhone.trim() || undefined,
          roleId: editRoleId,
          outletId: editOutletId || undefined,
          status: editStatus,
        }),
      });

      setIsEditOpen(false);
      setStatusMessage({
        type: 'success',
        text: `Team member ${editFirstName} ${editLastName} updated successfully. Role and permissions apply immediately.`,
      });
      await fetchData();
    } catch (err: any) {
      setEditError(err.message || 'Failed to update employee account.');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const formatLastLogin = (dateString?: string) => {
    if (!dateString) return 'Never logged in';
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) {
      return `Today at ${timeStr}`;
    }
    return `${date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}, ${timeStr}`;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header & Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Users className="w-8 h-8 text-brand-600" />
            Team & Access Control
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage authorized staff members, role assignments, and branch authorizations for{' '}
            <strong className="text-slate-800">{activeOrgName}</strong>.
          </p>
        </div>

        <Button
          onClick={() => {
            resetForm();
            setIsInviteOpen(true);
          }}
          leftIcon={<UserPlus className="w-4 h-4" />}
          className="shadow-lg shadow-brand-500/20"
        >
          Add Employee
        </Button>
      </div>

      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-medium ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
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

      {/* Employees Table */}
      <Card variant="glass" className="overflow-hidden p-0 border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 min-w-[700px]">
            <thead className="bg-slate-50/90 text-slate-500 border-b border-slate-200 text-[11px] uppercase tracking-wider font-bold">
              <tr>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Contact Info</th>
                <th className="py-3 px-4">Branch</th>
                <th className="py-3 px-4">Assigned Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Last Login</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    Loading team members...
                  </td>
                </tr>
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No team members found.
                  </td>
                </tr>
              ) : (
                members.map((item) => (
                  <tr key={item.membershipId} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-300 flex items-center justify-center font-bold text-xs text-brand-600">
                          {item.user.firstName?.[0] || 'U'}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-sm">
                            {item.user.firstName} {item.user.lastName}
                          </p>
                          <p className="text-xs text-slate-500 flex items-center gap-1">
                            <Mail className="w-3 h-3" /> {item.user.email}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="text-xs text-slate-700">
                        {item.user.phone ? (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" /> {item.user.phone}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="text-xs font-medium text-slate-800 flex items-center gap-1">
                        <Store className="w-3.5 h-3.5 text-slate-400" />
                        {item.outlets.length === 0 ? (
                          <span className="text-slate-500">All Branches (Org-wide)</span>
                        ) : (
                          item.outlets.map((o) => o.outletName).join(', ')
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <Badge
                        variant={
                          item.primaryRole?.code === 'OWNER'
                            ? 'brand'
                            : item.primaryRole?.code === 'MANAGER'
                              ? 'info'
                              : item.primaryRole?.code === 'CASHIER'
                                ? 'success'
                                : item.primaryRole?.code === 'ACCOUNTANT'
                                  ? 'warning'
                                  : 'neutral'
                        }
                        size="sm"
                      >
                        {item.primaryRole?.name || 'Member'}
                      </Badge>
                    </td>

                    <td className="py-3.5 px-4">
                      <Badge variant={item.status === 'ACTIVE' ? 'success' : 'neutral'} size="sm" dot>
                        {item.status}
                      </Badge>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="text-xs text-slate-600 flex items-center gap-1.5 font-medium">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {formatLastLogin(item.lastLogin)}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditModal(item)}
                        leftIcon={<Edit2 className="w-3.5 h-3.5" />}
                        className="text-xs py-1 px-3 hover:border-brand-500 hover:text-brand-600"
                      >
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add Employee Modal */}
      <Modal
        isOpen={isInviteOpen}
        onClose={() => {
          setIsInviteOpen(false);
          resetForm();
        }}
        title="Add Employee"
        subtitle="Create an employee account with direct credentials and branch access."
      >
        {inviteError && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-medium">
            {inviteError}
          </div>
        )}

        <form onSubmit={handleAddEmployee} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="First Name"
              placeholder="e.g. Anand"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
            <Input
              label="Last Name"
              placeholder="e.g. Kumar"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </div>

          <Input
            label="Work Email Address"
            type="email"
            placeholder="e.g. anand@novamart.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            leftIcon={<Mail className="w-4 h-4" />}
            required
          />

          <Input
            label="Phone Number (Optional)"
            placeholder="e.g. +91 98765 43210"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            leftIcon={<Phone className="w-4 h-4" />}
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Role Template"
              value={selectedRoleId}
              onChange={(e) => setSelectedRoleId(e.target.value)}
              options={roles.map((r) => ({
                value: r.id,
                label: `${r.name} (Max ${r.maxDiscountPercent}% disc)`,
              }))}
            />

            <Select
              label="Branch / Outlet"
              value={selectedOutletId}
              onChange={(e) => setSelectedOutletId(e.target.value)}
              options={[
                { value: '', label: 'All Outlets (Organization Scope)' },
                ...outlets.map((o) => ({
                  value: o.id,
                  label: `${o.name} (${o.code})`,
                })),
              ]}
            />
          </div>

          <div className="pt-2 border-t border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Account Security</span>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-xs text-slate-500 hover:text-brand-600 transition-colors flex items-center gap-1"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {showPassword ? 'Hide Passwords' : 'Show Passwords'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Min 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<Lock className="w-4 h-4" />}
                required
                minLength={8}
              />
              <Input
                label="Confirm Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Repeat password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                leftIcon={<Lock className="w-4 h-4" />}
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setIsInviteOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={isSubmitting} leftIcon={<UserPlus className="w-4 h-4" />}>
              Add Employee
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Employee Modal */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setEditError(null);
        }}
        title="Edit Employee"
        subtitle="Update employee information, assigned role, branch access, and account status."
      >
        {editError && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-medium">
            {editError}
          </div>
        )}

        <form onSubmit={handleEditEmployee} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="First Name"
              placeholder="e.g. Anand"
              value={editFirstName}
              onChange={(e) => setEditFirstName(e.target.value)}
              required
            />
            <Input
              label="Last Name"
              placeholder="e.g. Kumar"
              value={editLastName}
              onChange={(e) => setEditLastName(e.target.value)}
              required
            />
          </div>

          <Input
            label="Work Email Address"
            type="email"
            placeholder="e.g. anand@novamart.com"
            value={editEmail}
            onChange={(e) => setEditEmail(e.target.value)}
            leftIcon={<Mail className="w-4 h-4" />}
            required
          />

          <Input
            label="Phone Number (Optional)"
            placeholder="e.g. +91 98765 43210"
            value={editPhone}
            onChange={(e) => setEditPhone(e.target.value)}
            leftIcon={<Phone className="w-4 h-4" />}
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Assigned Role"
              value={editRoleId}
              onChange={(e) => setEditRoleId(e.target.value)}
              options={roles.map((r) => ({
                value: r.id,
                label: `${r.name} (Max ${r.maxDiscountPercent}% disc)`,
              }))}
            />

            <Select
              label="Assigned Branch / Outlet"
              value={editOutletId}
              onChange={(e) => setEditOutletId(e.target.value)}
              options={[
                { value: '', label: 'All Outlets (Organization Scope)' },
                ...outlets.map((o) => ({
                  value: o.id,
                  label: `${o.name} (${o.code})`,
                })),
              ]}
            />
          </div>

          <div className="pt-2 border-t border-slate-200">
            <Select
              label="Account Status"
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value as 'ACTIVE' | 'SUSPENDED')}
              options={[
                { value: 'ACTIVE', label: 'ACTIVE — Full system access permitted' },
                { value: 'SUSPENDED', label: 'SUSPENDED — Access temporarily revoked' },
              ]}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setIsEditOpen(false);
                setEditError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              isLoading={isSubmittingEdit}
              leftIcon={<CheckCircle2 className="w-4 h-4" />}
            >
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
