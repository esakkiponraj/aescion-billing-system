import React, { useState, useEffect } from 'react';
import { Building, Plus, Store, Receipt, MapPin, Phone } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { apiRequest } from '../../services/api';
import { useTenantStore } from '../../stores/tenantStore';

export const OrganizationSettingsPage: React.FC = () => {
  const { activeOrgId, activeOrgName } = useTenantStore();

  const [orgDetails, setOrgDetails] = useState<any | null>(null);
  const [outlets, setOutlets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Add Outlet Modal State
  const [isOutletModalOpen, setIsOutletModalOpen] = useState(false);
  const [outletName, setOutletName] = useState('');
  const [outletCode, setOutletCode] = useState('');
  const [outletAddress, setOutletAddress] = useState('');
  const [outletPhone, setOutletPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [outletError, setOutletError] = useState<string | null>(null);

  // Add Register Modal State
  const [selectedOutletForReg, setSelectedOutletForReg] = useState<any | null>(null);
  const [registerName, setRegisterName] = useState('');
  const [registerCode, setRegisterCode] = useState('');

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [orgRes, outletsRes] = await Promise.all([
        apiRequest<any>('/tenancy/organization'),
        apiRequest<any[]>('/tenancy/outlets'),
      ]);
      setOrgDetails(orgRes);
      setOutlets(outletsRes);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeOrgId]);

  const handleCreateOutlet = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setOutletError(null);

    try {
      await apiRequest('/tenancy/outlets', {
        method: 'POST',
        body: JSON.stringify({
          name: outletName,
          code: outletCode.toUpperCase().trim(),
          address: outletAddress || undefined,
          phone: outletPhone || undefined,
        }),
      });

      setIsOutletModalOpen(false);
      setOutletName('');
      setOutletCode('');
      setOutletAddress('');
      setOutletPhone('');
      await fetchData();
    } catch (err: any) {
      setOutletError(err.message || 'Failed to create branch outlet.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOutletForReg) return;
    setIsSubmitting(true);

    try {
      await apiRequest(`/tenancy/outlets/${selectedOutletForReg.id}/registers`, {
        method: 'POST',
        body: JSON.stringify({
          name: registerName,
          code: registerCode.toUpperCase().trim(),
        }),
      });

      setSelectedOutletForReg(null);
      setRegisterName('');
      setRegisterCode('');
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to create register.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Organization & Outlets Setup
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure branches, POS registers, and company legal entities.
          </p>
        </div>

        <Button
          size="md"
          onClick={() => setIsOutletModalOpen(true)}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          Add New Branch
        </Button>
      </div>

      {/* Organization Overview Card */}
      {orgDetails && (
        <Card variant="solid" className="p-6 border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-200 flex items-center justify-center font-bold text-brand-600">
                <Building className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">{orgDetails.name}</h2>
                <p className="text-xs text-slate-500">
                  Slug: <code className="text-slate-700 font-mono">{orgDetails.slug}</code> • {orgDetails.businessType}
                </p>
              </div>
            </div>
            <Badge variant="brand" size="sm" dot>
              {orgDetails.status}
            </Badge>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-200 text-xs">
            <div>
              <span className="text-slate-500">Country:</span>
              <p className="font-semibold text-slate-900">{orgDetails.country}</p>
            </div>
            <div>
              <span className="text-slate-500">Currency:</span>
              <p className="font-semibold text-slate-900">{orgDetails.currency}</p>
            </div>
            <div>
              <span className="text-slate-500">Timezone:</span>
              <p className="font-semibold text-slate-900">{orgDetails.timezone}</p>
            </div>
            <div>
              <span className="text-slate-500">Total Branches:</span>
              <p className="font-semibold text-brand-600">{outlets.length} Outlets</p>
            </div>
          </div>
        </Card>
      )}

      {/* Outlets & Terminals Grid */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-slate-900 tracking-tight">
          Physical Branches & POS Terminals
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {outlets.map((outlet) => (
            <Card key={outlet.id} variant="glass" className="p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Store className="w-4 h-4 text-sky-600" />
                    <h3 className="text-base font-bold text-slate-900">{outlet.name}</h3>
                  </div>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    Branch Code: {outlet.code}
                  </p>
                </div>
                <Badge variant={outlet.isActive ? 'success' : 'neutral'} size="sm">
                  {outlet.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>

              {outlet.address && (
                <p className="text-xs text-slate-500 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>{outlet.address}</span>
                </p>
              )}

              {/* Registers in this Outlet */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">
                    Registers ({outlet.registers?.length ?? 0})
                  </span>
                  <button
                    onClick={() => setSelectedOutletForReg(outlet)}
                    className="text-[11px] font-semibold text-brand-600 hover:text-brand-300 transition-colors"
                  >
                    + Add Register
                  </button>
                </div>

                <div className="space-y-1.5">
                  {outlet.registers?.map((reg: any) => (
                    <div
                      key={reg.id}
                      className="p-2 rounded-lg bg-white border border-slate-200 flex items-center justify-between text-xs"
                    >
                      <span className="font-medium text-slate-800">{reg.name}</span>
                      <span className="font-mono text-[10px] text-slate-500">{reg.code}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Add Outlet Modal */}
      <Modal
        isOpen={isOutletModalOpen}
        onClose={() => setIsOutletModalOpen(false)}
        title="Add Branch / Outlet"
        subtitle="Initialize a new physical retail location or branch."
      >
        {outletError && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-medium">
            {outletError}
          </div>
        )}

        <form onSubmit={handleCreateOutlet} className="space-y-4">
          <Input
            label="Branch Name"
            placeholder="e.g. Coimbatore Flagship"
            value={outletName}
            onChange={(e) => setOutletName(e.target.value)}
            required
          />

          <Input
            label="Branch Code (Unique Identifier)"
            placeholder="e.g. CBE-01"
            value={outletCode}
            onChange={(e) => setOutletCode(e.target.value)}
            required
          />

          <Input
            label="Address (Optional)"
            placeholder="e.g. 24 Cross Cut Road, Gandhipuram"
            value={outletAddress}
            onChange={(e) => setOutletAddress(e.target.value)}
          />

          <Input
            label="Phone Contact (Optional)"
            placeholder="e.g. +91 422 2490000"
            value={outletPhone}
            onChange={(e) => setOutletPhone(e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsOutletModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={isSubmitting}>
              Create Branch
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Register Modal */}
      <Modal
        isOpen={!!selectedOutletForReg}
        onClose={() => setSelectedOutletForReg(null)}
        title={`Add Register to ${selectedOutletForReg?.name}`}
        subtitle="Provision a billing counter terminal."
      >
        <form onSubmit={handleCreateRegister} className="space-y-4">
          <Input
            label="Register Name"
            placeholder="e.g. Express Lane #02"
            value={registerName}
            onChange={(e) => setRegisterName(e.target.value)}
            required
          />

          <Input
            label="Register Code"
            placeholder="e.g. REG-02"
            value={registerCode}
            onChange={(e) => setRegisterCode(e.target.value)}
            required
          />

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSelectedOutletForReg(null)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={isSubmitting}>
              Create Register
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
