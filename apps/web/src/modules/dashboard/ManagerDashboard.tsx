import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Store,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Check,
  X,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { useTenantStore } from '../../stores/tenantStore';
import { apiRequest } from '../../services/api';

export const ManagerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { activeOutletName, activeOrgId, activeOutletId } = useTenantStore();

  const [approvals, setApprovals] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedApproval, setSelectedApproval] = useState<any | null>(null);
  const [actionComments, setActionComments] = useState('');
  const [actionType, setActionType] = useState<'APPROVED' | 'REJECTED' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchApprovals = async () => {
    try {
      setIsLoading(true);
      const res = await apiRequest<any[]>('/approvals');
      setApprovals(res || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
  }, [activeOrgId, activeOutletId]);

  const handleResolve = async () => {
    if (!selectedApproval || !actionType) return;
    try {
      setIsSubmitting(true);
      await apiRequest(`/approvals/${selectedApproval.id}/resolve`, {
        method: 'PUT',
        body: JSON.stringify({
          status: actionType,
          comments: actionComments,
        }),
      });
      setSelectedApproval(null);
      setActionComments('');
      setActionType(null);
      await fetchApprovals();
    } catch (err: any) {
      alert(err.message || 'Failed to resolve approval.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const pendingApprovals = approvals.filter((a) => a.status === 'PENDING');

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Outlet Manager Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-xl bg-white border border-slate-200 shadow-card">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-brand-600 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-widest text-brand-600">
              Branch Operations • {activeOutletName}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Store Manager Hub
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time cashier shifts, operational exceptions, and authorization queue.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="md"
            onClick={() => navigate('/pos')}
            leftIcon={<Store className="w-4 h-4" />}
          >
            Launch POS Counter
          </Button>
          <Button
            size="md"
            variant="outline"
            onClick={() => navigate('/products')}
            leftIcon={<Users className="w-4 h-4" />}
          >
            Inventory Stock
          </Button>
        </div>
      </div>

      {/* Real-time Approvals & Cashier Shift Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card variant="solid" className="p-5 space-y-2 border-l-4 border-l-orange-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Pending Approvals
            </span>
            <Badge variant={pendingApprovals.length > 0 ? 'warning' : 'neutral'} size="sm">
              {pendingApprovals.length} Queue
            </Badge>
          </div>
          <p className="text-3xl font-black text-slate-900">{pendingApprovals.length}</p>
          <p className="text-xs text-slate-500">
            Discounts & exceptions awaiting authorization
          </p>
        </Card>

        <Card variant="solid" className="p-5 space-y-2 border-l-4 border-l-brand-600">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Active Counter Shifts
            </span>
            <Badge variant="brand" size="sm">
              Live
            </Badge>
          </div>
          <p className="text-3xl font-black text-slate-900">Register #01</p>
          <p className="text-xs text-slate-500">Cashier shift open & recording sales</p>
        </Card>

        <Card variant="solid" className="p-5 space-y-2 border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Terminal Compliance
            </span>
            <Badge variant="success" size="sm">
              Secured
            </Badge>
          </div>
          <p className="text-3xl font-black text-emerald-600">100% Verified</p>
          <p className="text-xs text-slate-500">No unauthorized price overrides reported</p>
        </Card>
      </div>

      {/* Approvals Action Board */}
      <Card variant="solid" className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-orange-500" />
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Operational Authorizations Queue
              </h2>
              <p className="text-xs text-slate-500">
                Authorizations requested by cashiers exceeding standard discounting ceilings.
              </p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={fetchApprovals}>
            Refresh Queue
          </Button>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Loading approval queue...
          </div>
        ) : pendingApprovals.length === 0 ? (
          <div className="p-8 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
            <h4 className="text-sm font-bold text-slate-800">
              All Authorizations Cleared
            </h4>
            <p className="text-xs text-slate-500">
              No pending discount overrides or exceptions require manager resolution.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingApprovals.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="warning" size="sm">
                      {item.approvalType}
                    </Badge>
                    <span className="text-xs font-bold text-slate-900 font-mono">
                      Requested: {item.requestedValue}
                    </span>
                    <span className="text-xs text-slate-400">
                      • {new Date(item.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">{item.reason}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                    onClick={() => {
                      setSelectedApproval(item);
                      setActionType('APPROVED');
                    }}
                    leftIcon={<Check className="w-3.5 h-3.5" />}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      setSelectedApproval(item);
                      setActionType('REJECTED');
                    }}
                    leftIcon={<X className="w-3.5 h-3.5" />}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Resolve Confirmation Modal */}
      <Modal
        isOpen={Boolean(selectedApproval)}
        onClose={() => {
          setSelectedApproval(null);
          setActionType(null);
          setActionComments('');
        }}
        title={`${actionType === 'APPROVED' ? 'Approve' : 'Reject'} Authorization`}
        subtitle={`Action for ${selectedApproval?.approvalType}: ${selectedApproval?.requestedValue}`}
      >
        <div className="space-y-4 py-2">
          <Input
            label="Manager Note / Audit Comment (Optional)"
            placeholder="e.g. Approved per customer relationship policy"
            value={actionComments}
            onChange={(e) => setActionComments(e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedApproval(null);
                setActionType(null);
                setActionComments('');
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant={actionType === 'APPROVED' ? 'primary' : 'danger'}
              onClick={handleResolve}
              isLoading={isSubmitting}
            >
              Confirm {actionType === 'APPROVED' ? 'Approval' : 'Rejection'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
