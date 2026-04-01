import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Calculator,
  DollarSign,
  Clock,
  Package,
  Truck,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Edit2,
  Save,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import clsx from 'clsx';
import { api } from '../lib/api';
import { Card, CardHeader } from './Card';
import { Spinner } from './Spinner';
import { DEFAULT_LABOR_RATE, DEFAULT_OVERHEAD_PERCENT } from '@erp/shared';

interface JobCost {
  id: string;
  quotedAmount: number;
  invoicedAmount: number | null;
  laborHours: number;
  laborRate: number;
  laborCost: number;
  materialCost: number;
  subcontractCost: number | null;
  shippingCost: number | null;
  otherDirectCost: number | null;
  overheadPercent: number;
  overheadCost: number;
  totalCost: number;
  grossProfit: number;
  grossMargin: number;
  calculatedAt?: string | null;
}

interface JobCostCardProps {
  workOrderId: string;
  orderNumber: string;
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(num)) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num);
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(num)) return '-';
  return `${num.toFixed(1)}%`;
}

function toNumber(value: any): number {
  if (typeof value === 'number') return value;
  if (value === null || value === undefined) return 0;
  const num = parseFloat(String(value));
  return isNaN(num) ? 0 : num;
}

function formatHours(value: any): string {
  const num = toNumber(value);
  return `${num.toFixed(1)} hrs`;
}

function formatCalculatedAt(value: string | null | undefined): string {
  if (!value) {
    return 'Pending first saved calculation';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Pending first saved calculation';
  }

  return parsed.toLocaleString();
}

export function JobCostCard({ workOrderId, orderNumber }: JobCostCardProps) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({
    invoicedAmount: '',
    subcontractCost: '',
    shippingCost: '',
    otherDirectCost: '',
    laborRate: DEFAULT_LABOR_RATE.toString(),
    overheadPercent: DEFAULT_OVERHEAD_PERCENT.toString(),
  });

  const { data: jobCost, isLoading, error } = useQuery<JobCost | null>({
    queryKey: ['job-cost', workOrderId],
    queryFn: async () => {
      try {
        const res = await api.get(`/job-costs/order/${workOrderId}`);
        return res.data.data;
      } catch (err: any) {
        if (err?.response?.status === 404) return null;
        throw err;
      }
    },
  });

  const calculateMutation = useMutation({
    mutationFn: () => api.post(`/job-costs/order/${workOrderId}/calculate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-cost', workOrderId] });
      toast.success('Job cost calculated');
    },
    onError: () => {
      toast.error('Failed to calculate job cost');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.put(`/job-costs/order/${workOrderId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-cost', workOrderId] });
      setEditing(false);
      toast.success('Job cost updated');
    },
    onError: () => {
      toast.error('Failed to update job cost');
    },
  });

  const startEditing = () => {
    if (jobCost) {
      setEditData({
        invoicedAmount: jobCost.invoicedAmount != null ? String(jobCost.invoicedAmount) : '',
        subcontractCost: jobCost.subcontractCost != null ? String(jobCost.subcontractCost) : '',
        shippingCost: jobCost.shippingCost != null ? String(jobCost.shippingCost) : '',
        otherDirectCost: jobCost.otherDirectCost != null ? String(jobCost.otherDirectCost) : '',
        laborRate: String(toNumber(jobCost.laborRate) || DEFAULT_LABOR_RATE),
        overheadPercent: String(toNumber(jobCost.overheadPercent) || DEFAULT_OVERHEAD_PERCENT),
      });
    }
    setEditing(true);
  };

  const handleSave = () => {
    updateMutation.mutate({
      invoicedAmount: editData.invoicedAmount ? parseFloat(editData.invoicedAmount) : null,
      subcontractCost: editData.subcontractCost ? parseFloat(editData.subcontractCost) : null,
      shippingCost: editData.shippingCost ? parseFloat(editData.shippingCost) : null,
      otherDirectCost: editData.otherDirectCost ? parseFloat(editData.otherDirectCost) : null,
      laborRate: parseFloat(editData.laborRate) || DEFAULT_LABOR_RATE,
      overheadPercent: parseFloat(editData.overheadPercent) || DEFAULT_OVERHEAD_PERCENT,
    });
  };

  const profitStatus = useMemo(() => {
    if (!jobCost) return 'neutral';
    const margin = toNumber(jobCost.grossMargin);
    if (margin >= 20) return 'good';
    if (margin >= 10) return 'warning';
    return 'bad';
  }, [jobCost]);

  if (isLoading) {
    return (
      <Card>
        <div className="flex items-center justify-center py-8">
          <Spinner size="lg" />
        </div>
      </Card>
    );
  }

  if (error && !jobCost) {
    return (
      <Card>
        <CardHeader
          title="Job Costing"
          icon={<Calculator className="h-5 w-5 text-gray-400" />}
          actions={
            <button
              onClick={() => calculateMutation.mutate()}
              disabled={calculateMutation.isPending}
              className="btn btn-primary btn-sm"
            >
              {calculateMutation.isPending ? (
                <Spinner size="sm" />
              ) : (
                <>
                  <Calculator className="h-4 w-4 mr-1" />
                  Calculate
                </>
              )}
            </button>
          }
        />
        <p className="text-sm text-gray-500">
          No job cost data available. Click Calculate to generate.
        </p>
      </Card>
    );
  }

  if (!jobCost) {
    return (
      <Card>
        <CardHeader
          title="Job Costing"
          icon={<Calculator className="h-5 w-5 text-gray-400" />}
          actions={
            <button
              onClick={() => calculateMutation.mutate()}
              disabled={calculateMutation.isPending}
              className="btn btn-primary btn-sm"
            >
              {calculateMutation.isPending ? (
                <Spinner size="sm" />
              ) : (
                <>
                  <Calculator className="h-4 w-4 mr-1" />
                  Calculate
                </>
              )}
            </button>
          }
        />
        <p className="text-sm text-gray-500 text-center py-4">
          No cost data yet. Calculate to analyze this order's profitability.
        </p>
      </Card>
    );
  }

  return (
    <Card padding="none">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <CardHeader
          title="Job Costing"
          icon={<Calculator className="h-5 w-5 text-primary-500" />}
          actions={
            <div className="flex items-center gap-2">
              {editing ? (
                <>
                  <button
                    onClick={() => setEditing(false)}
                    className="btn btn-ghost btn-sm"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={updateMutation.isPending}
                    className="btn btn-primary btn-sm"
                  >
                    {updateMutation.isPending ? <Spinner size="sm" /> : <Save className="h-4 w-4" />}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={startEditing}
                    className="btn btn-ghost btn-sm"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => calculateMutation.mutate()}
                    disabled={calculateMutation.isPending}
                    className="btn btn-ghost btn-sm"
                    title="Recalculate"
                  >
                    {calculateMutation.isPending ? (
                      <Spinner size="sm" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </button>
                </>
              )}
            </div>
          }
        />

        {/* Profit Summary */}
        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="text-center p-3 rounded-lg bg-gray-50">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Revenue</p>
            <p className="text-lg font-semibold text-gray-900">
              {formatCurrency(jobCost.invoicedAmount ?? jobCost.quotedAmount)}
            </p>
            {jobCost.invoicedAmount ? (
              <p className="text-xs text-gray-400">Invoiced</p>
            ) : (
              <p className="text-xs text-gray-400">Quoted</p>
            )}
          </div>
          <div className="text-center p-3 rounded-lg bg-gray-50">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Total Cost</p>
            <p className="text-lg font-semibold text-gray-900">
              {formatCurrency(jobCost.totalCost)}
            </p>
            <p className="text-xs text-gray-400">All-in</p>
          </div>
          <div
            className={clsx(
              'text-center p-3 rounded-lg',
              profitStatus === 'good' && 'bg-green-50',
              profitStatus === 'warning' && 'bg-yellow-50',
              profitStatus === 'bad' && 'bg-red-50',
              profitStatus === 'neutral' && 'bg-gray-50'
            )}
          >
            <p className="text-xs text-gray-500 uppercase tracking-wide">Gross Profit</p>
            <div className="flex items-center justify-center gap-1">
              {toNumber(jobCost.grossProfit) >= 0 ? (
                <TrendingUp
                  className={clsx(
                    'h-4 w-4',
                    profitStatus === 'good' && 'text-green-500',
                    profitStatus === 'warning' && 'text-yellow-500',
                    profitStatus === 'bad' && 'text-red-500'
                  )}
                />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
              <p
                className={clsx(
                  'text-lg font-semibold',
                  profitStatus === 'good' && 'text-green-600',
                  profitStatus === 'warning' && 'text-yellow-600',
                  profitStatus === 'bad' && 'text-red-600'
                )}
              >
                {formatCurrency(jobCost.grossProfit)}
              </p>
            </div>
            <p
              className={clsx(
                'text-xs',
                profitStatus === 'good' && 'text-green-500',
                profitStatus === 'warning' && 'text-yellow-500',
                profitStatus === 'bad' && 'text-red-500'
              )}
            >
              {formatPercent(jobCost.grossMargin)} margin
            </p>
          </div>
        </div>
      </div>

      {/* Expandable Details */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-center gap-1 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
      >
        {expanded ? (
          <>
            <ChevronUp className="h-4 w-4" /> Hide Details
          </>
        ) : (
          <>
            <ChevronDown className="h-4 w-4" /> Show Details
          </>
        )}
      </button>

      {expanded && (
        <div className="p-4 border-t border-gray-100 space-y-4">
          {/* Cost Breakdown */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Cost Breakdown</h4>
            <div className="space-y-2">
              <CostRow
                icon={<Clock className="h-4 w-4 text-blue-500" />}
                label="Labor"
                value={jobCost.laborCost}
                detail={`${formatHours(jobCost.laborHours)} @ ${formatCurrency(jobCost.laborRate)}/hr`}
                editing={editing}
                editField="laborRate"
                editValue={editData.laborRate}
                onEdit={(val) => setEditData({ ...editData, laborRate: val })}
                editLabel="Rate/hr"
              />
              <CostRow
                icon={<Package className="h-4 w-4 text-amber-500" />}
                label="Materials"
                value={jobCost.materialCost}
              />
              {(editing || jobCost.subcontractCost) && (
                <CostRow
                  icon={<DollarSign className="h-4 w-4 text-purple-500" />}
                  label="Subcontract"
                  value={jobCost.subcontractCost}
                  editing={editing}
                  editField="subcontractCost"
                  editValue={editData.subcontractCost}
                  onEdit={(val) => setEditData({ ...editData, subcontractCost: val })}
                />
              )}
              {(editing || jobCost.shippingCost) && (
                <CostRow
                  icon={<Truck className="h-4 w-4 text-teal-500" />}
                  label="Shipping"
                  value={jobCost.shippingCost}
                  editing={editing}
                  editField="shippingCost"
                  editValue={editData.shippingCost}
                  onEdit={(val) => setEditData({ ...editData, shippingCost: val })}
                />
              )}
              {(editing || jobCost.otherDirectCost) && (
                <CostRow
                  icon={<DollarSign className="h-4 w-4 text-gray-500" />}
                  label="Other Direct"
                  value={jobCost.otherDirectCost}
                  editing={editing}
                  editField="otherDirectCost"
                  editValue={editData.otherDirectCost}
                  onEdit={(val) => setEditData({ ...editData, otherDirectCost: val })}
                />
              )}
              <CostRow
                icon={<DollarSign className="h-4 w-4 text-gray-400" />}
                label="Overhead"
                value={jobCost.overheadCost}
                detail={`${formatPercent(jobCost.overheadPercent)} of direct costs`}
                editing={editing}
                editField="overheadPercent"
                editValue={editData.overheadPercent}
                onEdit={(val) => setEditData({ ...editData, overheadPercent: val })}
                editLabel="Overhead %"
              />
            </div>
          </div>

          {/* Revenue Section */}
          {editing && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Revenue</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Quoted Amount</span>
                  <span className="text-sm font-medium">
                    {formatCurrency(jobCost.quotedAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Invoiced Amount</span>
                  <input
                    type="number"
                    step="0.01"
                    value={editData.invoicedAmount}
                    onChange={(e) =>
                      setEditData({ ...editData, invoicedAmount: e.target.value })
                    }
                    placeholder={String(toNumber(jobCost.quotedAmount))}
                    className="input input-sm w-32 text-right"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Last Calculated */}
          <p className="text-xs text-gray-400 pt-2 border-t border-gray-100">
            Last calculated:{' '}
            {formatCalculatedAt(jobCost.calculatedAt)}
          </p>
        </div>
      )}
    </Card>
  );
}

interface CostRowProps {
  icon: React.ReactNode;
  label: string;
  value: number | null;
  detail?: string;
  editing?: boolean;
  editField?: string;
  editValue?: string;
  editLabel?: string;
  onEdit?: (value: string) => void;
}

function CostRow({
  icon,
  label,
  value,
  detail,
  editing,
  editField,
  editValue,
  editLabel,
  onEdit,
}: CostRowProps) {
  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm text-gray-600">{label}</span>
        {detail && !editing && (
          <span className="text-xs text-gray-400">({detail})</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {editing && editField && onEdit ? (
          <div className="flex items-center gap-1">
            {editLabel && (
              <span className="text-xs text-gray-400">{editLabel}:</span>
            )}
            <input
              type="number"
              step="0.01"
              value={editValue}
              onChange={(e) => onEdit(e.target.value)}
              className="input input-sm w-20 text-right"
            />
          </div>
        ) : (
          <span className="text-sm font-medium text-gray-900">
            {formatCurrency(value)}
          </span>
        )}
      </div>
    </div>
  );
}

export default JobCostCard;
