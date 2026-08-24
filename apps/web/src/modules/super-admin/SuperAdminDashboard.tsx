import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Shield,
  ShieldAlert,
  Building,
  Users,
  CreditCard,
  LifeBuoy,
  BarChart3,
  FileText,
  Sliders,
  Search,
  Filter,
  Plus,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ExternalLink,
  Eye,
  RefreshCw,
  Zap,
  ChevronRight,
  ArrowUpRight,
  UserCheck,
  UserX,
  Mail,
  Phone,
  Calendar,
  AlertCircle,
  Check,
  X,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Table } from '../../components/common/Table';
import { apiRequest } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { useTenantStore } from '../../stores/tenantStore';

export const SuperAdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'dashboard';

  const { setSupportSession } = useAuthStore();
  const { setActiveTenant } = useTenantStore();

  // Global State
  const [isLoading, setIsLoading] = useState(true);
  const [statsData, setStatsData] = useState<any>(null);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [platformUsers, setPlatformUsers] = useState<any[]>([]);
  const [supportIssues, setSupportIssues] = useState<any[]>([]);
  const [reportsData, setReportsData] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [plansData, setPlansData] = useState<any>({ plans: [], features: [] });
  const [systemSettings, setSystemSettings] = useState<Record<string, string>>({});

  // Filters & Search
  const [searchOrg, setSearchOrg] = useState('');
  const [filterOrgType, setFilterOrgType] = useState('ALL');
  const [filterOrgStatus, setFilterOrgStatus] = useState('ALL');
  const [subView, setSubView] = useState<'subscriptions' | 'plans'>('subscriptions');

  const [issueStatusFilter, setIssueStatusFilter] = useState('ALL');
  const [issuePriorityFilter, setIssuePriorityFilter] = useState('ALL');
  const [auditActionFilter, setAuditActionFilter] = useState('ALL');

  // Modals & Detail State
  const [selectedOrgDetail, setSelectedOrgDetail] = useState<any | null>(null);
  const [orgDetailTab, setOrgDetailTab] = useState<'overview' | 'outlets' | 'users' | 'subscription' | 'usage' | 'support' | 'audit'>('overview');
  
  const [selectedIssueDetail, setSelectedIssueDetail] = useState<any | null>(null);
  const [issueInternalNote, setIssueInternalNote] = useState('');
  const [issueStatusUpdate, setIssueStatusUpdate] = useState('');

  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserFirstName, setNewUserFirstName] = useState('');
  const [newUserLastName, setNewUserLastName] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');

  // Support Session Impersonation Modal
  const [selectedOrgForSupport, setSelectedOrgForSupport] = useState<any | null>(null);
  const [supportReason, setSupportReason] = useState('');
  const [supportDuration, setSupportDuration] = useState(30);
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [supportError, setSupportError] = useState<string | null>(null);

  // Settings Form State
  const [settingsForm, setSettingsForm] = useState<Record<string, string>>({});
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Load Tab-specific data
  const loadData = async () => {
    try {
      setIsLoading(true);
      if (activeTab === 'dashboard') {
        const res = await apiRequest<any>('/super-admin/stats');
        setStatsData(res);
      } else if (activeTab === 'organizations') {
        const res = await apiRequest<any[]>('/super-admin/organizations');
        setOrganizations(res);
      } else if (activeTab === 'subscriptions') {
        const [subsRes, plansRes] = await Promise.all([
          apiRequest<any[]>('/super-admin/subscriptions'),
          apiRequest<any>('/super-admin/plans-features'),
        ]);
        setSubscriptions(subsRes);
        setPlansData(plansRes);
      } else if (activeTab === 'platform-users') {
        const res = await apiRequest<any[]>('/super-admin/platform-users');
        setPlatformUsers(res);
      } else if (activeTab === 'support-issues') {
        const res = await apiRequest<any[]>('/super-admin/support-issues');
        setSupportIssues(res);
      } else if (activeTab === 'reports') {
        const res = await apiRequest<any>('/super-admin/reports');
        setReportsData(res);
      } else if (activeTab === 'audit-logs') {
        const res = await apiRequest<any[]>('/super-admin/audit-logs');
        setAuditLogs(res);
      } else if (activeTab === 'settings') {
        const res = await apiRequest<Record<string, string>>('/super-admin/settings');
        setSystemSettings(res);
        setSettingsForm(res);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const switchTab = (tab: string) => {
    setSearchParams({ tab });
  };

  // Open Business Detail
  const openBusinessDetail = async (orgId: string) => {
    try {
      const detail = await apiRequest<any>(`/super-admin/organizations/${orgId}`);
      setSelectedOrgDetail(detail);
      setOrgDetailTab('overview');
    } catch (e: any) {
      alert(e.message || 'Failed to load business details.');
    }
  };

  // Toggle Organization Status
  const handleToggleOrgStatus = async (orgId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    if (!confirm(`Are you sure you want to change organization status to ${newStatus}?`)) return;
    try {
      await apiRequest(`/super-admin/organizations/${orgId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      });
      loadData();
      if (selectedOrgDetail?.id === orgId) {
        openBusinessDetail(orgId);
      }
    } catch (e: any) {
      alert(e.message || 'Failed to update organization status.');
    }
  };

  // Extend Trial / Subscription
  const handleExtendSubscription = async (orgId: string, days: number) => {
    try {
      await apiRequest(`/super-admin/organizations/${orgId}/subscription`, {
        method: 'PUT',
        body: JSON.stringify({ extendDays: days, status: 'ACTIVE' }),
      });
      alert(`Extended subscription by ${days} days!`);
      loadData();
      if (selectedOrgDetail?.id === orgId) {
        openBusinessDetail(orgId);
      }
    } catch (e: any) {
      alert(e.message || 'Failed to extend subscription.');
    }
  };

  // Start Controlled Support Impersonation
  const handleStartSupportSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrgForSupport || !supportReason.trim()) return;
    setIsStartingSession(true);
    setSupportError(null);

    try {
      const res = await apiRequest<any>('/super-admin/support-session', {
        method: 'POST',
        body: JSON.stringify({
          organizationId: selectedOrgForSupport.id,
          reason: supportReason.trim(),
          durationMinutes: Number(supportDuration) || 30,
        }),
      });

      setSupportSession({
        organizationId: res.organizationId,
        organizationName: res.organizationName,
        reason: res.reason,
        expiresAt: res.expiresAt,
      });

      setActiveTenant({
        orgId: res.organizationId,
        orgName: res.organizationName,
        outletId: res.defaultOutletId || '',
        outletName: selectedOrgForSupport.outlets?.[0]?.name || 'Main',
        businessType: res.businessType,
        roles: ['SUPER_ADMIN_SUPPORT'],
      });

      setSelectedOrgForSupport(null);
      setSupportReason('');
      navigate('/dashboard');
    } catch (err: any) {
      setSupportError(err.message || 'Failed to initialize support session.');
    } finally {
      setIsStartingSession(false);
    }
  };

  // Create Platform User
  const handleCreatePlatformUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/super-admin/platform-users', {
        method: 'POST',
        body: JSON.stringify({
          email: newUserEmail,
          firstName: newUserFirstName,
          lastName: newUserLastName,
          phone: newUserPhone,
        }),
      });
      setIsAddUserModalOpen(false);
      setNewUserEmail('');
      setNewUserFirstName('');
      setNewUserLastName('');
      setNewUserPhone('');
      loadData();
    } catch (e: any) {
      alert(e.message || 'Failed to create platform user.');
    }
  };

  // Toggle Platform User Status
  const handleToggleUserActive = async (userId: string, currentActive: boolean) => {
    try {
      await apiRequest(`/super-admin/platform-users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: !currentActive }),
      });
      loadData();
    } catch (e: any) {
      alert(e.message || 'Failed to update user status.');
    }
  };

  // Update Support Issue
  const handleUpdateIssue = async () => {
    if (!selectedIssueDetail) return;
    try {
      await apiRequest(`/super-admin/support-issues/${selectedIssueDetail.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: issueStatusUpdate || selectedIssueDetail.status,
          internalNotes: issueInternalNote || selectedIssueDetail.internalNotes,
        }),
      });
      setSelectedIssueDetail(null);
      loadData();
    } catch (e: any) {
      alert(e.message || 'Failed to update issue.');
    }
  };

  // Save System Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSavingSettings(true);
      await apiRequest('/super-admin/settings', {
        method: 'PUT',
        body: JSON.stringify(settingsForm),
      });
      alert('Platform settings saved successfully.');
      loadData();
    } catch (e: any) {
      alert(e.message || 'Failed to save settings.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Filtered Organizations
  const filteredOrganizations = organizations.filter((org) => {
    const matchesSearch =
      org.name.toLowerCase().includes(searchOrg.toLowerCase()) ||
      org.slug.toLowerCase().includes(searchOrg.toLowerCase());
    const matchesType = filterOrgType === 'ALL' || org.businessType === filterOrgType;
    const matchesStatus = filterOrgStatus === 'ALL' || org.status === filterOrgStatus;
    return matchesSearch && matchesType && matchesStatus;
  });

  // Filtered Support Issues
  const filteredSupportIssues = supportIssues.filter((issue) => {
    const matchesStatus = issueStatusFilter === 'ALL' || issue.status === issueStatusFilter;
    const matchesPriority = issuePriorityFilter === 'ALL' || issue.priority === issuePriorityFilter;
    return matchesStatus && matchesPriority;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Super Admin Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl glass-panel border-rose-200 bg-gradient-to-r from-rose-950/40 via-obsidian-900/60 to-obsidian-950 shadow-2xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-600 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-widest text-rose-600">
              SaaS Control Plane • Platform Administration
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            {activeTab === 'dashboard' && 'Platform Overview & Health'}
            {activeTab === 'organizations' && 'Organizations & Client Businesses'}
            {activeTab === 'subscriptions' && 'SaaS Subscriptions & Platform Plans'}
            {activeTab === 'platform-users' && 'AESCION Platform Administrators'}
            {activeTab === 'support-issues' && 'Support & Client Issue Desk'}
            {activeTab === 'reports' && 'Platform Business & Growth Analytics'}
            {activeTab === 'audit-logs' && 'Platform Compliance Audit Trail'}
            {activeTab === 'settings' && 'Global System & Platform Settings'}
          </h1>
          <p className="text-xs text-slate-500">
            Internal operating system for AESCION SaaS governance, multi-tenant directory, and customer support.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="danger" size="md">
            Super Administrator
          </Badge>
          <Button
            size="sm"
            variant="outline"
            onClick={loadData}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. DASHBOARD TAB */}
      {/* ========================================================================= */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Top Platform KPI Cards */}
          {statsData && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card variant="glass" className="space-y-1 p-5">
                <span className="text-xs font-semibold text-slate-500 uppercase">
                  Total Businesses
                </span>
                <p className="text-3xl font-black text-slate-900">
                  {statsData.stats.totalOrganizations}
                </p>
                <div className="flex items-center gap-2 text-[11px] text-emerald-600 pt-1">
                  <span>{statsData.stats.activeBusinesses} Active</span>
                  <span>•</span>
                  <span className="text-amber-600">{statsData.stats.trialBusinesses} Trial</span>
                </div>
              </Card>

              <Card variant="glass" className="space-y-1 p-5">
                <span className="text-xs font-semibold text-slate-500 uppercase">
                  Active Subscriptions
                </span>
                <p className="text-3xl font-black text-purple-600">
                  {statsData.stats.activeSubscriptions}
                </p>
                <p className="text-xs text-slate-500">
                  {statsData.stats.expiringSubscriptions} Expiring in 7 days
                </p>
              </Card>

              <Card variant="glass" className="space-y-1 p-5">
                <span className="text-xs font-semibold text-slate-500 uppercase">
                  Platform Staff
                </span>
                <p className="text-3xl font-black text-sky-600">
                  {statsData.stats.totalPlatformUsers}
                </p>
                <p className="text-xs text-slate-500">Super Admins & Support Staff</p>
              </Card>

              <Card variant="glass" className="space-y-1 p-5">
                <span className="text-xs font-semibold text-slate-500 uppercase">
                  Open Support Issues
                </span>
                <p className="text-3xl font-black text-amber-600">
                  {statsData.stats.openSupportIssues}
                </p>
                <p className="text-xs text-rose-600 font-semibold">
                  {statsData.supportSummary.critical} Critical Severity
                </p>
              </Card>
            </div>
          )}

          {/* Business Growth & Support Summary Row */}
          {statsData && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Support Issues Status Summary */}
              <Card variant="solid" className="p-6 border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <LifeBuoy className="w-4 h-4 text-amber-600" /> Support Desk Summary
                  </h3>
                  <button
                    onClick={() => switchTab('support-issues')}
                    className="text-xs text-brand-600 hover:underline flex items-center gap-1"
                  >
                    View Tickets <ChevronRight className="w-3 h-3" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-white border border-slate-200">
                    <span className="text-xs text-slate-500">Open Tickets</span>
                    <p className="text-xl font-bold text-slate-900 mt-0.5">
                      {statsData.supportSummary.open}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-slate-200">
                    <span className="text-xs text-slate-500">In Progress</span>
                    <p className="text-xl font-bold text-sky-600 mt-0.5">
                      {statsData.supportSummary.inProgress}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-slate-200">
                    <span className="text-xs text-slate-500">Waiting for Client</span>
                    <p className="text-xl font-bold text-amber-600 mt-0.5">
                      {statsData.supportSummary.waitingClient}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-slate-200">
                    <span className="text-xs text-slate-500">Resolved</span>
                    <p className="text-xl font-bold text-emerald-600 mt-0.5">
                      {statsData.supportSummary.resolved}
                    </p>
                  </div>
                </div>
              </Card>

              {/* Recent Platform Activity */}
              <Card variant="solid" className="lg:col-span-2 p-6 border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-purple-600" /> Recent Platform Activity
                  </h3>
                  <button
                    onClick={() => switchTab('audit-logs')}
                    className="text-xs text-brand-600 hover:underline flex items-center gap-1"
                  >
                    All Audit Logs <ChevronRight className="w-3 h-3" />
                  </button>
                </div>

                <div className="space-y-2">
                  {statsData.recentActivity?.map((act: any) => (
                    <div
                      key={act.id}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant="neutral" size="sm">
                          {act.action}
                        </Badge>
                        <span className="text-slate-700 font-medium truncate max-w-xs">
                          {act.organization?.name || 'Platform'} • {act.resource}
                        </span>
                      </div>
                      <span className="text-slate-500 font-mono shrink-0">
                        {new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {/* Recently Registered Businesses Table */}
          {statsData && (
            <Card variant="solid" className="p-6 border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Recently Registered Businesses</h3>
                  <p className="text-xs text-slate-500">Newly onboarded client organizations.</p>
                </div>
                <button
                  onClick={() => switchTab('organizations')}
                  className="text-xs text-brand-600 hover:underline flex items-center gap-1"
                >
                  Manage All Businesses <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              <Table
                columns={[
                  {
                    header: 'Business Name',
                    cell: (item) => (
                      <div>
                        <p className="font-bold text-slate-900 text-sm">{item.name}</p>
                        <p className="text-xs text-slate-500 font-mono">{item.slug}</p>
                      </div>
                    ),
                  },
                  {
                    header: 'Business Type',
                    cell: (item: any) => (
                      <span className="text-xs uppercase text-slate-700 font-semibold">
                        {item.businessType}
                      </span>
                    ),
                  },
                  {
                    header: 'Plan',
                    cell: (item) => (
                      <Badge variant="info" size="sm">
                        {item.subscriptions?.[0]?.plan?.name || 'Starter'}
                      </Badge>
                    ),
                  },
                  {
                    header: 'Status',
                    cell: (item) => (
                      <Badge
                        variant={item.status === 'ACTIVE' ? 'success' : 'danger'}
                        size="sm"
                      >
                        {item.status}
                      </Badge>
                    ),
                  },
                  {
                    header: 'Created Date',
                    cell: (item) => (
                      <span className="text-xs text-slate-500">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    ),
                  },
                  {
                    header: 'Action',
                    cell: (item) => (
                      <Button
                        size="sm"
                        variant="glass"
                        onClick={() => openBusinessDetail(item.id)}
                        leftIcon={<Eye className="w-3.5 h-3.5 text-brand-600" />}
                      >
                        Details
                      </Button>
                    ),
                  },
                ]}
                data={statsData.recentOrganizations || []}
                isLoading={isLoading}
              />
            </Card>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. ORGANIZATIONS / BUSINESSES TAB */}
      {/* ========================================================================= */}
      {activeTab === 'organizations' && (
        <div className="space-y-4">
          {/* Search & Filters Bar */}
          <div className="p-4 rounded-2xl glass-panel border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex-1 w-full md:w-auto relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search businesses by name, slug or ID..."
                value={searchOrg}
                onChange={(e) => setSearchOrg(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <Select
                value={filterOrgType}
                onChange={(e) => setFilterOrgType(e.target.value)}
                options={[
                  { value: 'ALL', label: 'All Business Types' },
                  { value: 'RETAIL', label: 'Retail' },
                  { value: 'SUPERMARKET', label: 'Supermarket' },
                  { value: 'WHOLESALE', label: 'Wholesale' },
                  { value: 'RESTAURANT', label: 'Restaurant' },
                  { value: 'SERVICE', label: 'Service' },
                  { value: 'PHARMACY', label: 'Pharmacy' },
                ]}
              />

              <Select
                value={filterOrgStatus}
                onChange={(e) => setFilterOrgStatus(e.target.value)}
                options={[
                  { value: 'ALL', label: 'All Statuses' },
                  { value: 'ACTIVE', label: 'Active' },
                  { value: 'SUSPENDED', label: 'Suspended' },
                  { value: 'PENDING_ONBOARDING', label: 'Pending Onboarding' },
                ]}
              />
            </div>
          </div>

          {/* Organizations Directory Table */}
          <Card variant="solid" className="p-6 border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Client Organizations Directory</h2>
                <p className="text-xs text-slate-500">
                  {filteredOrganizations.length} businesses matching search criteria.
                </p>
              </div>
            </div>

            <Table
              columns={[
                {
                  header: 'Business Name & ID',
                  cell: (item) => (
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{item.name}</p>
                      <p className="text-[11px] text-slate-500 font-mono">ID: {item.id.slice(0, 8)}... ({item.slug})</p>
                    </div>
                  ),
                },
                {
                  header: 'Business Type',
                  cell: (item: any) => (
                    <span className="text-xs uppercase font-semibold text-slate-700">
                      {item.businessType}
                    </span>
                  ),
                },
                {
                  header: 'Outlets / Users',
                  cell: (item) => (
                    <span className="text-xs text-slate-700">
                      {item.outlets?.length || 0} Outlets • {item.memberships?.length || 0} Users
                    </span>
                  ),
                },
                {
                  header: 'Current Plan',
                  cell: (item) => (
                    <Badge variant="info" size="sm">
                      {item.subscriptions?.[0]?.plan?.name || 'Starter'}
                    </Badge>
                  ),
                },
                {
                  header: 'Status',
                  cell: (item) => (
                    <Badge
                      variant={item.status === 'ACTIVE' ? 'success' : 'danger'}
                      size="sm"
                    >
                      {item.status}
                    </Badge>
                  ),
                },
                {
                  header: 'Actions',
                  cell: (item) => (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="glass"
                        onClick={() => openBusinessDetail(item.id)}
                        leftIcon={<Eye className="w-3.5 h-3.5 text-sky-600" />}
                      >
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant="glass"
                        onClick={() => setSelectedOrgForSupport(item)}
                        leftIcon={<ExternalLink className="w-3.5 h-3.5 text-amber-600" />}
                        className="text-amber-300 hover:border-amber-400/40 hover:bg-amber-400/10"
                      >
                        Support Mode
                      </Button>
                    </div>
                  ),
                },
              ]}
              data={filteredOrganizations}
              isLoading={isLoading}
            />
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. SUBSCRIPTIONS & PLANS TAB */}
      {/* ========================================================================= */}
      {activeTab === 'subscriptions' && (
        <div className="space-y-6">
          {/* Sub Navigation Switcher */}
          <div className="flex items-center gap-2 p-1.5 rounded-xl bg-white border border-slate-200 max-w-xs">
            <button
              onClick={() => setSubView('subscriptions')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                subView === 'subscriptions'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Customer Subscriptions
            </button>
            <button
              onClick={() => setSubView('plans')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                subView === 'plans'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Platform Plans
            </button>
          </div>

          {subView === 'subscriptions' ? (
            <Card variant="solid" className="p-6 border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Active SaaS Subscriptions</h3>
                  <p className="text-xs text-slate-500">
                    Manage client renewals, trial extensions, and tier overrides.
                  </p>
                </div>
              </div>

              <Table
                columns={[
                  {
                    header: 'Business',
                    cell: (item) => (
                      <div>
                        <p className="font-bold text-slate-900 text-sm">{item.organization?.name}</p>
                        <p className="text-xs text-slate-500">{item.organization?.businessType}</p>
                      </div>
                    ),
                  },
                  {
                    header: 'Plan Tier',
                    cell: (item) => (
                      <Badge variant="brand" size="sm">
                        {item.plan?.name}
                      </Badge>
                    ),
                  },
                  {
                    header: 'Usage Limits',
                    cell: (item) => (
                      <span className="text-xs text-slate-700">
                        {item.organization?.outlets?.length || 0}/{item.plan?.maxOutlets} Outlets • {item.organization?.memberships?.length || 0}/{item.plan?.maxUsers} Users
                      </span>
                    ),
                  },
                  {
                    header: 'Status',
                    cell: (item) => (
                      <Badge
                        variant={item.status === 'ACTIVE' ? 'success' : item.status === 'TRIALING' ? 'warning' : 'danger'}
                        size="sm"
                      >
                        {item.status}
                      </Badge>
                    ),
                  },
                  {
                    header: 'Actions',
                    cell: (item) => (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="glass"
                          onClick={() => handleExtendSubscription(item.organizationId, 14)}
                          className="text-xs"
                        >
                          +14 Days
                        </Button>
                        <Button
                          size="sm"
                          variant="glass"
                          onClick={() => openBusinessDetail(item.organizationId)}
                          leftIcon={<Eye className="w-3.5 h-3.5" />}
                        >
                          Edit
                        </Button>
                      </div>
                    ),
                  },
                ]}
                data={subscriptions}
                isLoading={isLoading}
              />
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {plansData.plans?.map((plan: any) => (
                <Card key={plan.id} variant="solid" className="p-6 border-slate-200 space-y-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="brand" size="md">
                        {plan.code}
                      </Badge>
                      <span className="text-xs text-slate-500">Standard Tier</span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
                    <p className="text-xs text-slate-500 mt-1">{plan.description}</p>

                    <div className="space-y-2 pt-4 border-t border-slate-200 mt-4 text-xs text-slate-700">
                      <div className="flex justify-between">
                        <span>Max Outlets:</span>
                        <strong className="text-slate-900">{plan.maxOutlets}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Max Users:</span>
                        <strong className="text-slate-900">{plan.maxUsers}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Max Registers:</span>
                        <strong className="text-slate-900">{plan.maxRegisters}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-200">
                    <p className="text-[11px] font-bold text-slate-500 uppercase mb-2">Enabled Features</p>
                    <div className="flex flex-wrap gap-1">
                      {plan.planFeatures?.map((pf: any) => (
                        <Badge key={pf.id} variant="neutral" size="sm">
                          {pf.feature?.code}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. PLATFORM USERS TAB */}
      {/* ========================================================================= */}
      {activeTab === 'platform-users' && (
        <Card variant="solid" className="p-6 border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-900">AESCION Platform Administrators</h3>
              <p className="text-xs text-slate-500">
                Internal company staff with Super Administrator privileges. Tenant cashiers and store managers are strictly isolated within their organizations.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setIsAddUserModalOpen(true)}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Add Platform Admin
            </Button>
          </div>

          <Table
            columns={[
              {
                header: 'Name',
                cell: (item) => (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center font-bold text-xs">
                      {item.firstName[0]}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-sm">
                        {item.firstName} {item.lastName}
                      </p>
                      <p className="text-xs text-slate-500">{item.email}</p>
                    </div>
                  </div>
                ),
              },
              {
                header: 'Role',
                cell: () => <Badge variant="danger" size="sm">Super Administrator</Badge>,
              },
              {
                header: 'Status',
                cell: (item) => (
                  <Badge variant={item.isActive ? 'success' : 'neutral'} size="sm">
                    {item.isActive ? 'Active' : 'Deactivated'}
                  </Badge>
                ),
              },
              {
                header: 'Created Date',
                cell: (item) => (
                  <span className="text-xs text-slate-500">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                ),
              },
              {
                header: 'Action',
                cell: (item) => (
                  <Button
                    size="sm"
                    variant="glass"
                    onClick={() => handleToggleUserActive(item.id, item.isActive)}
                    className="text-xs"
                  >
                    {item.isActive ? 'Deactivate' : 'Activate'}
                  </Button>
                ),
              },
            ]}
            data={platformUsers}
            isLoading={isLoading}
          />
        </Card>
      )}

      {/* ========================================================================= */}
      {/* 5. SUPPORT / ISSUES TAB */}
      {/* ========================================================================= */}
      {activeTab === 'support-issues' && (
        <div className="space-y-4">
          {/* Issue Filters */}
          <div className="p-4 rounded-2xl glass-panel border-slate-200 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Select
                value={issueStatusFilter}
                onChange={(e) => setIssueStatusFilter(e.target.value)}
                options={[
                  { value: 'ALL', label: 'All Statuses' },
                  { value: 'OPEN', label: 'Open' },
                  { value: 'IN_PROGRESS', label: 'In Progress' },
                  { value: 'WAITING_CLIENT', label: 'Waiting for Client' },
                  { value: 'RESOLVED', label: 'Resolved' },
                ]}
              />

              <Select
                value={issuePriorityFilter}
                onChange={(e) => setIssuePriorityFilter(e.target.value)}
                options={[
                  { value: 'ALL', label: 'All Priorities' },
                  { value: 'CRITICAL', label: 'Critical' },
                  { value: 'HIGH', label: 'High' },
                  { value: 'MEDIUM', label: 'Medium' },
                  { value: 'LOW', label: 'Low' },
                ]}
              />
            </div>
          </div>

          <Card variant="solid" className="p-6 border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Customer Support Tickets</h3>
                <p className="text-xs text-slate-500">Issues raised by subscribed business accounts.</p>
              </div>
            </div>

            <Table
              columns={[
                {
                  header: 'Ticket & Business',
                  cell: (item) => (
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{item.title}</p>
                      <p className="text-xs text-slate-500">
                        {item.organization?.name} • Category: <strong className="text-slate-700">{item.category}</strong>
                      </p>
                    </div>
                  ),
                },
                {
                  header: 'Priority',
                  cell: (item) => (
                    <Badge
                      variant={
                        item.priority === 'CRITICAL'
                          ? 'danger'
                          : item.priority === 'HIGH'
                            ? 'warning'
                            : 'neutral'
                      }
                      size="sm"
                    >
                      {item.priority}
                    </Badge>
                  ),
                },
                {
                  header: 'Status',
                  cell: (item) => (
                    <Badge
                      variant={
                        item.status === 'RESOLVED'
                          ? 'success'
                          : item.status === 'IN_PROGRESS'
                            ? 'info'
                            : 'warning'
                      }
                      size="sm"
                    >
                      {item.status}
                    </Badge>
                  ),
                },
                {
                  header: 'Created',
                  cell: (item) => (
                    <span className="text-xs text-slate-500">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                  ),
                },
                {
                  header: 'Action',
                  cell: (item) => (
                    <Button
                      size="sm"
                      variant="glass"
                      onClick={() => {
                        setSelectedIssueDetail(item);
                        setIssueStatusUpdate(item.status);
                        setIssueInternalNote(item.internalNotes || '');
                      }}
                      leftIcon={<Eye className="w-3.5 h-3.5" />}
                    >
                      Manage Ticket
                    </Button>
                  ),
                },
              ]}
              data={filteredSupportIssues}
              isLoading={isLoading}
            />
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. REPORTS TAB */}
      {/* ========================================================================= */}
      {activeTab === 'reports' && reportsData && (
        <div className="space-y-6">
          {/* Growth Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card variant="glass" className="p-5 space-y-1">
              <span className="text-xs text-slate-500 font-semibold uppercase">Total Businesses</span>
              <p className="text-3xl font-black text-slate-900">{reportsData.businessGrowth.totalBusinesses}</p>
              <p className="text-xs text-emerald-600 font-semibold">{reportsData.businessGrowth.activeRate}% Active Rate</p>
            </Card>

            <Card variant="glass" className="p-5 space-y-1">
              <span className="text-xs text-slate-500 font-semibold uppercase">Avg Outlets / Business</span>
              <p className="text-3xl font-black text-sky-600">{reportsData.businessGrowth.averageOutletsPerOrg}</p>
              <p className="text-xs text-slate-500">Branch expansion metric</p>
            </Card>

            <Card variant="glass" className="p-5 space-y-1">
              <span className="text-xs text-slate-500 font-semibold uppercase">Avg Users / Business</span>
              <p className="text-3xl font-black text-purple-600">{reportsData.businessGrowth.averageUsersPerOrg}</p>
              <p className="text-xs text-slate-500">Seat density index</p>
            </Card>

            <Card variant="glass" className="p-5 space-y-1">
              <span className="text-xs text-slate-500 font-semibold uppercase">Plan Distribution</span>
              <p className="text-3xl font-black text-brand-600">{reportsData.planDistribution?.length || 0}</p>
              <p className="text-xs text-slate-500">Active pricing tiers</p>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Business Type Breakdown */}
            <Card variant="solid" className="p-6 border-slate-200 space-y-4">
              <h3 className="font-bold text-sm text-slate-900">Business Type Distribution</h3>
              <div className="space-y-3">
                {reportsData.typeDistribution?.map((t: any) => (
                  <div key={t.type} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold text-slate-700">
                      <span>{t.type}</span>
                      <span>{t.count} businesses</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-brand-500 rounded-full"
                        style={{ width: `${(t.count / reportsData.businessGrowth.totalBusinesses) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Plan Distribution Breakdown */}
            <Card variant="solid" className="p-6 border-slate-200 space-y-4">
              <h3 className="font-bold text-sm text-slate-900">Active Plan Tier Breakdown</h3>
              <div className="space-y-3">
                {reportsData.planDistribution?.map((p: any) => (
                  <div key={p.plan} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold text-slate-700">
                      <span>{p.plan}</span>
                      <span>{p.count} accounts</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-purple-500 rounded-full"
                        style={{ width: `${(p.count / reportsData.businessGrowth.totalBusinesses) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. AUDIT LOGS TAB */}
      {/* ========================================================================= */}
      {activeTab === 'audit-logs' && (
        <Card variant="solid" className="p-6 border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Platform Compliance Audit Trail</h3>
              <p className="text-xs text-slate-500">
                Immutable, read-only activity logs across platform operations and support impersonation events.
              </p>
            </div>
          </div>

          <Table
            columns={[
              {
                header: 'Timestamp',
                cell: (item) => (
                  <span className="text-xs text-slate-500 font-mono">
                    {new Date(item.createdAt).toLocaleString()}
                  </span>
                ),
              },
              {
                header: 'User / Actor',
                cell: (item) => (
                  <span className="text-xs text-slate-900 font-medium">
                    {item.user ? `${item.user.firstName} ${item.user.lastName}` : 'System'}
                  </span>
                ),
              },
              {
                header: 'Action',
                cell: (item) => (
                  <Badge variant="neutral" size="sm">
                    {item.action}
                  </Badge>
                ),
              },
              {
                header: 'Resource',
                cell: (item) => (
                  <span className="text-xs text-slate-700 font-medium">
                    {item.resource}
                  </span>
                ),
              },
              {
                header: 'Organization',
                cell: (item) => (
                  <span className="text-xs text-slate-500">
                    {item.organization?.name || 'Platform'}
                  </span>
                ),
              },
            ]}
            data={auditLogs}
            isLoading={isLoading}
          />
        </Card>
      )}

      {/* ========================================================================= */}
      {/* 8. SYSTEM SETTINGS TAB */}
      {/* ========================================================================= */}
      {activeTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* General Settings */}
            <Card variant="solid" className="p-6 border-slate-200 space-y-4">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-brand-600" /> General Platform Configuration
              </h3>
              <Input
                label="Platform Brand Name"
                value={settingsForm['platform_name'] || ''}
                onChange={(e) => setSettingsForm({ ...settingsForm, platform_name: e.target.value })}
              />
              <Input
                label="Default Country Code"
                value={settingsForm['default_country'] || ''}
                onChange={(e) => setSettingsForm({ ...settingsForm, default_country: e.target.value })}
              />
              <Input
                label="Default Currency"
                value={settingsForm['default_currency'] || ''}
                onChange={(e) => setSettingsForm({ ...settingsForm, default_currency: e.target.value })}
              />
              <Input
                label="Default Timezone"
                value={settingsForm['default_timezone'] || ''}
                onChange={(e) => setSettingsForm({ ...settingsForm, default_timezone: e.target.value })}
              />
            </Card>

            {/* Security & Support Settings */}
            <Card variant="solid" className="p-6 border-slate-200 space-y-4">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Shield className="w-4 h-4 text-rose-600" /> Security & Support Governance
              </h3>
              <Input
                label="Support Contact Email"
                value={settingsForm['support_email'] || ''}
                onChange={(e) => setSettingsForm({ ...settingsForm, support_email: e.target.value })}
              />
              <Input
                label="Session Timeout (Minutes)"
                type="number"
                value={settingsForm['session_timeout_minutes'] || ''}
                onChange={(e) => setSettingsForm({ ...settingsForm, session_timeout_minutes: e.target.value })}
              />
              <Input
                label="Max Support Mode Impersonation Duration (Minutes)"
                type="number"
                value={settingsForm['support_access_max_duration'] || ''}
                onChange={(e) => setSettingsForm({ ...settingsForm, support_access_max_duration: e.target.value })}
              />
              <Input
                label="Trial Expiry Alert Warning (Days)"
                type="number"
                value={settingsForm['trial_expiry_alert_days'] || ''}
                onChange={(e) => setSettingsForm({ ...settingsForm, trial_expiry_alert_days: e.target.value })}
              />
            </Card>
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              size="md"
              isLoading={isSavingSettings}
              className="bg-rose-600 hover:bg-rose-500 text-slate-900 font-bold px-6"
            >
              Save Platform Settings
            </Button>
          </div>
        </form>
      )}

      {/* ========================================================================= */}
      {/* BUSINESS DETAIL MODAL */}
      {/* ========================================================================= */}
      <Modal
        isOpen={!!selectedOrgDetail}
        onClose={() => setSelectedOrgDetail(null)}
        title={selectedOrgDetail?.name || 'Business Details'}
        subtitle={`ID: ${selectedOrgDetail?.id} • Type: ${selectedOrgDetail?.businessType}`}
      >
        {selectedOrgDetail && (
          <div className="space-y-4">
            {/* Detail Tabs */}
            <div className="flex items-center gap-1.5 border-b border-slate-200 pb-2 overflow-x-auto">
              {(['overview', 'outlets', 'users', 'subscription', 'support', 'audit'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setOrgDetailTab(tab)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg uppercase tracking-wider transition-all ${
                    orgDetailTab === tab
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab: Overview */}
            {orgDetailTab === 'overview' && (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-white border border-slate-200">
                  <div>
                    <span className="text-slate-500">Status</span>
                    <p className="font-bold text-slate-900 mt-0.5">{selectedOrgDetail.status}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Created Date</span>
                    <p className="font-bold text-slate-900 mt-0.5">{new Date(selectedOrgDetail.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Total Outlets</span>
                    <p className="font-bold text-slate-900 mt-0.5">{selectedOrgDetail.outlets?.length || 0}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Total Members</span>
                    <p className="font-bold text-slate-900 mt-0.5">{selectedOrgDetail.memberships?.length || 0}</p>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleToggleOrgStatus(selectedOrgDetail.id, selectedOrgDetail.status)}
                    className={selectedOrgDetail.status === 'ACTIVE' ? 'text-rose-600 hover:bg-rose-50' : 'text-emerald-600 hover:bg-emerald-50'}
                  >
                    {selectedOrgDetail.status === 'ACTIVE' ? 'Suspend Business' : 'Reactivate Business'}
                  </Button>
                  <Button
                    size="sm"
                    variant="glass"
                    onClick={() => {
                      setSelectedOrgForSupport(selectedOrgDetail);
                      setSelectedOrgDetail(null);
                    }}
                    className="text-amber-300"
                    leftIcon={<ExternalLink className="w-3.5 h-3.5" />}
                  >
                    Launch Support Mode
                  </Button>
                </div>
              </div>
            )}

            {/* Tab: Outlets */}
            {orgDetailTab === 'outlets' && (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {selectedOrgDetail.outlets?.map((outlet: any) => (
                  <div key={outlet.id} className="p-3 rounded-xl bg-white border border-slate-200 text-xs">
                    <p className="font-bold text-slate-900">{outlet.name} (Code: {outlet.code})</p>
                    <p className="text-slate-500 mt-0.5">{outlet.address || 'No address specified'}</p>
                    <p className="text-slate-500 font-mono text-[11px] mt-1">{outlet.registers?.length || 0} POS Register(s)</p>
                  </div>
                ))}
              </div>
            )}

            {/* Tab: Users */}
            {orgDetailTab === 'users' && (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {selectedOrgDetail.memberships?.map((m: any) => (
                  <div key={m.id} className="p-3 rounded-xl bg-white border border-slate-200 text-xs flex justify-between items-center">
                    <div>
                      <p className="font-bold text-slate-900">{m.user?.firstName} {m.user?.lastName}</p>
                      <p className="text-slate-500">{m.user?.email}</p>
                    </div>
                    <Badge variant="neutral" size="sm">
                      {m.membershipRoles?.[0]?.role?.name || 'Member'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}

            {/* Tab: Subscription */}
            {orgDetailTab === 'subscription' && (
              <div className="space-y-3 text-xs">
                <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Current Plan:</span>
                    <strong className="text-slate-900">{selectedOrgDetail.subscriptions?.[0]?.plan?.name}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Subscription Status:</span>
                    <strong className="text-emerald-600">{selectedOrgDetail.subscriptions?.[0]?.status}</strong>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="glass"
                    onClick={() => handleExtendSubscription(selectedOrgDetail.id, 14)}
                  >
                    Extend Trial / Period (+14 Days)
                  </Button>
                </div>
              </div>
            )}

            {/* Tab: Support */}
            {orgDetailTab === 'support' && (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {selectedOrgDetail.supportIssues?.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-4">No support issues recorded for this business.</p>
                ) : (
                  selectedOrgDetail.supportIssues?.map((issue: any) => (
                    <div key={issue.id} className="p-3 rounded-xl bg-white border border-slate-200 text-xs">
                      <p className="font-bold text-slate-900">{issue.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="neutral" size="sm">{issue.category}</Badge>
                        <Badge variant={issue.status === 'RESOLVED' ? 'success' : 'warning'} size="sm">{issue.status}</Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tab: Audit */}
            {orgDetailTab === 'audit' && (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {selectedOrgDetail.auditLogs?.map((log: any) => (
                  <div key={log.id} className="p-2 rounded-lg bg-white border border-slate-200 text-[11px]">
                    <div className="flex justify-between text-slate-500">
                      <span className="font-bold text-slate-700">{log.action}</span>
                      <span>{new Date(log.createdAt).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-slate-500">{log.resource}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* TICKET DETAIL & RESOLUTION MODAL */}
      {/* ========================================================================= */}
      <Modal
        isOpen={!!selectedIssueDetail}
        onClose={() => setSelectedIssueDetail(null)}
        title={`Support Ticket: ${selectedIssueDetail?.title}`}
        subtitle={`Client: ${selectedIssueDetail?.organization?.name} • Priority: ${selectedIssueDetail?.priority}`}
      >
        {selectedIssueDetail && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-2 text-xs">
              <span className="text-slate-500 font-bold uppercase">Client Description</span>
              <p className="text-slate-800">{selectedIssueDetail.description}</p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">Ticket Status</label>
              <Select
                value={issueStatusUpdate}
                onChange={(e) => setIssueStatusUpdate(e.target.value)}
                options={[
                  { value: 'OPEN', label: 'Open' },
                  { value: 'IN_PROGRESS', label: 'In Progress' },
                  { value: 'WAITING_CLIENT', label: 'Waiting for Client' },
                  { value: 'RESOLVED', label: 'Resolved' },
                  { value: 'CLOSED', label: 'Closed' },
                ]}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">Internal Support Notes / Resolution</label>
              <textarea
                rows={3}
                value={issueInternalNote}
                onChange={(e) => setIssueInternalNote(e.target.value)}
                placeholder="Add internal troubleshooting steps or customer resolution details..."
                className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <Button variant="outline" size="sm" onClick={() => setSelectedIssueDetail(null)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleUpdateIssue}>
                Save & Update Ticket
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* ADD PLATFORM USER MODAL */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isAddUserModalOpen}
        onClose={() => setIsAddUserModalOpen(false)}
        title="Add AESCION Platform Administrator"
        subtitle="Provision an internal company staff user with Super Administrator access."
      >
        <form onSubmit={handleCreatePlatformUser} className="space-y-4">
          <Input
            label="Email Address"
            type="email"
            required
            value={newUserEmail}
            onChange={(e) => setNewUserEmail(e.target.value)}
            placeholder="admin@aescion.com"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="First Name"
              required
              value={newUserFirstName}
              onChange={(e) => setNewUserFirstName(e.target.value)}
            />
            <Input
              label="Last Name"
              required
              value={newUserLastName}
              onChange={(e) => setNewUserLastName(e.target.value)}
            />
          </div>
          <Input
            label="Phone Number (Optional)"
            value={newUserPhone}
            onChange={(e) => setNewUserPhone(e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
            <Button variant="outline" size="sm" onClick={() => setIsAddUserModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm">
              Create Platform Admin
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* SUPPORT MODE IMPERSONATION MODAL */}
      {/* ========================================================================= */}
      <Modal
        isOpen={!!selectedOrgForSupport}
        onClose={() => setSelectedOrgForSupport(null)}
        title={`Authorize Support Mode: ${selectedOrgForSupport?.name}`}
        subtitle="Audited, time-limited impersonation session."
      >
        {supportError && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-medium">
            {supportError}
          </div>
        )}

        <form onSubmit={handleStartSupportSession} className="space-y-4">
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-300 text-xs space-y-1">
            <p className="font-bold flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4" /> Compliance Notice
            </p>
            <p className="text-slate-700">
              Support Mode access is logged to the immutable compliance audit trail. A prominent banner with countdown will be displayed.
            </p>
          </div>

          <Input
            label="Support Ticket / Authorized Reason"
            placeholder="e.g. Ticket #1042 - Assisting customer with tax slab configuration"
            value={supportReason}
            onChange={(e) => setSupportReason(e.target.value)}
            required
            helperText="Provide explicit customer ticket reference."
          />

          <Input
            label="Session Duration (Minutes)"
            type="number"
            min={5}
            max={120}
            value={supportDuration}
            onChange={(e) => setSupportDuration(parseInt(e.target.value, 10) || 30)}
            leftIcon={<Clock className="w-4 h-4" />}
          />

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSelectedOrgForSupport(null)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              isLoading={isStartingSession}
              className="bg-amber-500 hover:bg-amber-400 text-obsidian-950 font-bold"
            >
              Launch Support Mode
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
