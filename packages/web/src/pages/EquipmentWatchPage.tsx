import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  Plus,
  Trash2,
  Edit,
  Play,
  Send,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Eye,
  Settings2,
  Droplets,
  Cpu,
  Wrench,
  Wifi,
  Layers,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { Spinner } from '../components/Spinner';
import {
  WatchRuleOperator,
  WatchRuleDataSource,
  WATCH_RULE_OPERATOR_LABELS,
  WATCH_RULE_DATA_SOURCE_LABELS,
  WATCH_RULE_METRICS,
  WATCH_RULE_DEFAULT_METRIC,
} from '@erp/shared';

// ─── Types ─────────────────────────────────────────────────────────────────

interface WatchRule {
  id: string;
  name: string;
  description: string | null;
  dataSources: string[];
  metricField: string | null;
  operator: string;
  threshold: number;
  equipmentId: string | null;
  recipients: string[];
  emailSubject: string;
  emailBodyHtml: string | null;
  scheduleTime: string;
  scheduleDays: number[];
  isActive: boolean;
  lastNotifiedAt: string | null;
  lastEvaluatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  equipment?: { id: string; name: string } | null;
  createdBy?: { id: string; displayName: string };
  _count?: { notifications: number };
}

interface WatchNotification {
  id: string;
  sentAt: string;
  recipients: string[];
  subject: string;
  triggeredItems: Array<{ label: string; currentValue: number; threshold: number; equipmentName: string }>;
  success: boolean;
  error: string | null;
}

interface EquipmentOption {
  id: string;
  name: string;
  type: string;
  manufacturer: string | null;
  ipAddress: string | null;
}

// ─── Defaults ──────────────────────────────────────────────────────────────

const DAY_LABELS = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DEFAULT_FORM = {
  name: '',
  description: '',
  dataSources: [WatchRuleDataSource.VUTEK_INK] as WatchRuleDataSource[],
  metricField: '' as string,
  operator: WatchRuleOperator.LESS_THAN_OR_EQUAL,
  threshold: 30,
  equipmentId: '',
  recipients: [''],
  emailSubject: 'Equipment Alert: {{ruleName}}',
  emailBodyHtml: '',
  scheduleTime: '17:00',
  scheduleDays: [1, 2, 3, 4, 5],
  isActive: true,
};

// ─── Data source icons ─────────────────────────────────────────────────────

const DATA_SOURCE_ICONS: Record<string, React.ReactNode> = {
  VUTEK_INK: <Droplets className="h-4 w-4 text-purple-500" />,
  HP_INK: <Droplets className="h-4 w-4 text-blue-500" />,
  HP_PRINTHEAD: <Cpu className="h-4 w-4 text-blue-500" />,
  HP_MAINTENANCE: <Wrench className="h-4 w-4 text-blue-500" />,
  EQUIPMENT_STATUS: <Wifi className="h-4 w-4 text-gray-500" />,
};

// ═══════════════════════════════════════════════════════════════════════════
// Page Component
// ═══════════════════════════════════════════════════════════════════════════

export default function EquipmentWatchPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [formData, setFormData] = useState(DEFAULT_FORM);

  // ─── Queries ───────────────────────────────────────────────────────

  const { data: rulesData, isLoading } = useQuery({
    queryKey: ['equipment-watch-rules'],
    queryFn: () => api.get('/equipment-watch').then(r => r.data.data),
  });

  const { data: equipment } = useQuery<EquipmentOption[]>({
    queryKey: ['equipment-watch-meta'],
    queryFn: () => api.get('/equipment-watch/meta/equipment').then(r => r.data.data),
  });

  const rules: WatchRule[] = rulesData || [];

  // ─── Mutations ─────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/equipment-watch', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment-watch-rules'] });
      toast.success('Watch rule created');
      resetForm();
    },
    onError: () => toast.error('Failed to create rule'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.put(`/equipment-watch/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment-watch-rules'] });
      toast.success('Watch rule updated');
      resetForm();
    },
    onError: () => toast.error('Failed to update rule'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/equipment-watch/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment-watch-rules'] });
      toast.success('Watch rule deleted');
    },
    onError: () => toast.error('Failed to delete rule'),
  });

  const testMutation = useMutation({
    mutationFn: (id: string) => api.post(`/equipment-watch/${id}/test`),
    onSuccess: (res) => {
      const count = res.data.data.count;
      if (count > 0) {
        toast.success(`Test found ${count} triggered item${count === 1 ? '' : 's'}`, { duration: 5000 });
      } else {
        toast.success('No items currently trigger this rule', { icon: '✓' });
      }
    },
    onError: () => toast.error('Test failed'),
  });

  const sendMutation = useMutation({
    mutationFn: (id: string) => api.post(`/equipment-watch/${id}/send`),
    onSuccess: (res) => {
      const d = res.data.data;
      if (d.sent) {
        toast.success(`Alert email sent (${d.count} items)`);
        queryClient.invalidateQueries({ queryKey: ['equipment-watch-rules'] });
      } else {
        toast(d.reason || 'No items triggered — email not sent', { icon: 'ℹ️' });
      }
    },
    onError: () => toast.error('Failed to send alert'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.put(`/equipment-watch/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment-watch-rules'] });
    },
  });

  // ─── Form helpers ──────────────────────────────────────────────────

  function resetForm() {
    setFormData(DEFAULT_FORM);
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(rule: WatchRule) {
    setFormData({
      name: rule.name,
      description: rule.description || '',
      dataSources: (rule.dataSources || []) as WatchRuleDataSource[],
      metricField: rule.metricField || '',
      operator: rule.operator as WatchRuleOperator,
      threshold: rule.threshold,
      equipmentId: rule.equipmentId || '',
      recipients: rule.recipients.length > 0 ? rule.recipients : [''],
      emailSubject: rule.emailSubject,
      emailBodyHtml: rule.emailBodyHtml || '',
      scheduleTime: rule.scheduleTime,
      scheduleDays: rule.scheduleDays,
      isActive: rule.isActive,
    });
    setEditingId(rule.id);
    setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      ...formData,
      description: formData.description || null,
      equipmentId: formData.equipmentId || null,
      emailBodyHtml: formData.emailBodyHtml || null,
      recipients: formData.recipients.filter(r => r.trim()),
      metricField: formData.dataSources.length === 1 && formData.metricField ? formData.metricField : null,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  // When dataSources changes and exactly 1 source is selected, reset metricField
  useEffect(() => {
    if (formData.dataSources.length === 1) {
      const ds = formData.dataSources[0] as WatchRuleDataSource;
      const metrics = WATCH_RULE_METRICS[ds];
      if (metrics?.length && !formData.metricField) {
        setFormData(f => ({ ...f, metricField: metrics[0].field }));
      }
    } else {
      // Multiple sources: clear metricField (each uses its default)
      setFormData(f => ({ ...f, metricField: '' }));
    }
  }, [formData.dataSources.join(',')]);

  // ─── Render ────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── Page Header ─── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bell className="h-6 w-6 text-purple-600" />
            Equipment Watch Rules
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Configurable monitors that send daily email digests when equipment metrics cross thresholds
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Watch Rule
        </button>
      </div>

      {/* How it works */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Settings2 className="h-5 w-5 text-purple-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-purple-800">
            <p className="font-medium mb-1">How Watch Rules Work</p>
            <p className="text-purple-700">
              Each rule monitors one or more <strong>data sources</strong> (e.g., VUTEk ink bags, HP cartridges)
              for their <strong>level metric</strong> crossing a <strong>threshold</strong> you define.
              Select multiple sources to combine them into a single consolidated digest.
              A single daily digest email is sent at the <strong>scheduled time</strong> on the
              selected <strong>days of the week</strong>, only if items are currently triggering.
            </p>
          </div>
        </div>
      </div>

      {/* ─── Create/Edit Form ─── */}
      {showForm && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {editingId ? 'Edit Watch Rule' : 'Create Watch Rule'}
            </h2>
            <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Row 1: Name + Description */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rule Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g., VUTEk Ink Low Alert"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={e => setFormData(f => ({ ...f, description: e.target.value }))}
                  placeholder="Optional description for the email body"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Row 2: The "Mad Lib" — Data Sources + Metric + Operator + Threshold */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                <Eye className="h-4 w-4 text-gray-400" />
                What to Watch
              </div>

              {/* Data Sources — checkboxes */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-500 mb-2">Data Sources (select one or more)</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {Object.entries(WATCH_RULE_DATA_SOURCE_LABELS).map(([val, label]) => {
                    const checked = formData.dataSources.includes(val as WatchRuleDataSource);
                    return (
                      <label
                        key={val}
                        className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                          checked
                            ? 'bg-purple-50 border-purple-300 text-purple-800'
                            : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setFormData(f => {
                              const next = checked
                                ? f.dataSources.filter(d => d !== val)
                                : [...f.dataSources, val as WatchRuleDataSource];
                              // Don't allow deselecting all
                              if (next.length === 0) return f;
                              return { ...f, dataSources: next };
                            });
                          }}
                          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="flex items-center gap-1.5 text-sm">
                          {DATA_SOURCE_ICONS[val]}
                          {label}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Metric + Operator + Threshold row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Metric — only show when 1 source selected */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Metric</label>
                  {formData.dataSources.length === 1 ? (
                    <select
                      value={formData.metricField}
                      onChange={e => setFormData(f => ({ ...f, metricField: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    >
                      {(WATCH_RULE_METRICS[formData.dataSources[0] as WatchRuleDataSource] || []).map(m => (
                        <option key={m.field} value={m.field}>{m.label} ({m.unit})</option>
                      ))}
                    </select>
                  ) : (
                    <div className="w-full border border-gray-200 bg-gray-100 rounded-lg px-3 py-2 text-sm text-gray-500 italic">
                      Default per source (level %)
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Operator</label>
                  <select
                    value={formData.operator}
                    onChange={e => setFormData(f => ({ ...f, operator: e.target.value as WatchRuleOperator }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    {Object.entries(WATCH_RULE_OPERATOR_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Threshold</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formData.threshold}
                    onChange={e => setFormData(f => ({ ...f, threshold: parseFloat(e.target.value) || 0 }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {/* Rule reads as */}
              <div className="mt-3 p-3 bg-white border border-gray-200 rounded text-sm text-gray-600">
                <strong>Rule reads as:</strong> Alert when{' '}
                <span className="text-purple-700 font-medium">
                  {formData.dataSources.map(ds => WATCH_RULE_DATA_SOURCE_LABELS[ds as WatchRuleDataSource] || ds).join(', ')}
                </span>{' '}
                {formData.dataSources.length === 1 && formData.metricField ? (
                  <em>{(WATCH_RULE_METRICS[formData.dataSources[0] as WatchRuleDataSource] || []).find(m => m.field === formData.metricField)?.label || formData.metricField}{' '}</em>
                ) : (
                  <em>level{' '}</em>
                )}
                is{' '}
                <span className="font-semibold">{WATCH_RULE_OPERATOR_LABELS[formData.operator as WatchRuleOperator] || formData.operator}</span>{' '}
                <span className="text-red-600 font-bold">{formData.threshold}</span>
              </div>
            </div>

            {/* Row 3: Equipment filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Specific Equipment <span className="text-gray-400 font-normal">(optional — leave blank for all)</span>
              </label>
              <select
                value={formData.equipmentId}
                onChange={e => setFormData(f => ({ ...f, equipmentId: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">All equipment of this type</option>
                {(equipment || []).map(eq => (
                  <option key={eq.id} value={eq.id}>
                    {eq.name} ({eq.manufacturer || eq.type}) — {eq.ipAddress}
                  </option>
                ))}
              </select>
            </div>

            {/* Row 4: Recipients */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Recipients *
              </label>
              {formData.recipients.map((email, i) => (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <input
                    type="email"
                    required={i === 0}
                    value={email}
                    onChange={e => {
                      const next = [...formData.recipients];
                      next[i] = e.target.value;
                      setFormData(f => ({ ...f, recipients: next }));
                    }}
                    placeholder="email@example.com"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                  {formData.recipients.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const next = formData.recipients.filter((_, ii) => ii !== i);
                        setFormData(f => ({ ...f, recipients: next }));
                      }}
                      className="text-red-400 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setFormData(f => ({ ...f, recipients: [...f.recipients, ''] }))}
                className="text-sm text-purple-600 hover:text-purple-800 font-medium"
              >
                + Add recipient
              </button>
            </div>

            {/* Row 5: Schedule */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Send Time (24h)
                </label>
                <input
                  type="time"
                  required
                  value={formData.scheduleTime}
                  onChange={e => setFormData(f => ({ ...f, scheduleTime: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Days of Week
                </label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5, 6, 7].map(day => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => {
                        setFormData(f => ({
                          ...f,
                          scheduleDays: f.scheduleDays.includes(day)
                            ? f.scheduleDays.filter(d => d !== day)
                            : [...f.scheduleDays, day].sort(),
                        }));
                      }}
                      className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                        formData.scheduleDays.includes(day)
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {DAY_LABELS[day]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Row 6: Email Subject */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Subject Line
              </label>
              <input
                type="text"
                value={formData.emailSubject}
                onChange={e => setFormData(f => ({ ...f, emailSubject: e.target.value }))}
                placeholder="Equipment Alert: {{ruleName}}"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">
                Placeholders: {'{{ruleName}}'}, {'{{itemCount}}'}, {'{{threshold}}'}
              </p>
            </div>

            {/* Row 7: Custom Email Body (optional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Custom Email Body <span className="text-gray-400 font-normal">(HTML, optional — leave blank for auto-generated)</span>
              </label>
              <textarea
                value={formData.emailBodyHtml}
                onChange={e => setFormData(f => ({ ...f, emailBodyHtml: e.target.value }))}
                placeholder="Leave blank for auto-generated email. Use {{ruleName}}, {{threshold}}, {{metricField}}, {{itemCount}}, {{itemList}} as placeholders."
                rows={4}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
              />
            </div>

            {/* Row 8: Active toggle */}
            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={e => setFormData(f => ({ ...f, isActive: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
              <span className="text-sm text-gray-700">{formData.isActive ? 'Active' : 'Paused'}</span>
            </div>

            {/* Submit */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="px-6 py-2 text-sm text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {createMutation.isPending || updateMutation.isPending
                  ? 'Saving...'
                  : editingId
                    ? 'Update Rule'
                    : 'Create Rule'
                }
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── Rules List ─── */}
      {rules.length === 0 && !showForm ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <Bell className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No Watch Rules Yet</h3>
          <p className="text-sm text-gray-500 mb-4">
            Create your first rule to start monitoring equipment metrics and receiving daily email alerts.
          </p>
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            <Plus className="h-4 w-4" />
            Create First Rule
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map(rule => (
            <RuleCard
              key={rule.id}
              rule={rule}
              isExpanded={expandedId === rule.id}
              onToggleExpand={() => setExpandedId(expandedId === rule.id ? null : rule.id)}
              onEdit={() => startEdit(rule)}
              onDelete={() => {
                if (confirm(`Delete watch rule "${rule.name}"?`)) {
                  deleteMutation.mutate(rule.id);
                }
              }}
              onTest={() => testMutation.mutate(rule.id)}
              onSendNow={() => sendMutation.mutate(rule.id)}
              onToggleActive={(active) => toggleMutation.mutate({ id: rule.id, isActive: active })}
              isTestPending={testMutation.isPending}
              isSendPending={sendMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Rule Card Component
// ═══════════════════════════════════════════════════════════════════════════

function RuleCard({
  rule,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onTest,
  onSendNow,
  onToggleActive,
  isTestPending,
  isSendPending,
}: {
  rule: WatchRule;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTest: () => void;
  onSendNow: () => void;
  onToggleActive: (active: boolean) => void;
  isTestPending: boolean;
  isSendPending: boolean;
}) {
  const dataSources = rule.dataSources || [];
  const dsLabels = dataSources.map(ds => WATCH_RULE_DATA_SOURCE_LABELS[ds as WatchRuleDataSource] || ds);
  const dsLabel = dsLabels.join(', ');
  const dsIcon = dataSources.length === 1
    ? (DATA_SOURCE_ICONS[dataSources[0]] || <Eye className="h-4 w-4 text-gray-400" />)
    : <Layers className="h-4 w-4 text-purple-500" />;
  const metricLabel = rule.metricField
    ? ((WATCH_RULE_METRICS[dataSources[0] as WatchRuleDataSource] || []).find(m => m.field === rule.metricField)?.label || rule.metricField)
    : 'level';
  const opLabel = WATCH_RULE_OPERATOR_LABELS[rule.operator as WatchRuleOperator] || rule.operator;
  const dayStr = rule.scheduleDays.map(d => DAY_LABELS[d]).join(', ');

  // Fetch notifications when expanded
  const { data: ruleDetail } = useQuery<WatchRule & { notifications: WatchNotification[] }>({
    queryKey: ['equipment-watch-rule', rule.id],
    queryFn: () => api.get(`/equipment-watch/${rule.id}`).then(r => r.data.data),
    enabled: isExpanded,
  });

  const notifications = ruleDetail?.notifications || [];

  return (
    <div className={`bg-white rounded-lg shadow-sm border ${rule.isActive ? 'border-gray-200' : 'border-gray-100 opacity-70'}`}>
      {/* Header */}
      <div className="p-4 flex items-center gap-4">
        {/* Active toggle */}
        <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
          <input
            type="checkbox"
            checked={rule.isActive}
            onChange={e => onToggleActive(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-gray-200 peer-focus:ring-2 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
        </label>

        {/* Icon + Info */}
        <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={onToggleExpand}>
          <div className="flex-shrink-0">{dsIcon}</div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900 truncate">{rule.name}</h3>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                rule.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {rule.isActive ? 'Active' : 'Paused'}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5 flex-wrap">
              <span>{dataSources.length > 1 ? `${dataSources.length} sources` : dsLabel}</span>
              <span>·</span>
              <span>{metricLabel} {opLabel.split(' ')[0]} {rule.threshold}</span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" /> {rule.scheduleTime} {dayStr}
              </span>
              <span>·</span>
              <span>{rule.recipients.length} recipient{rule.recipients.length !== 1 ? 's' : ''}</span>
              {rule._count?.notifications !== undefined && (
                <>
                  <span>·</span>
                  <span>{rule._count.notifications} sent</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={onTest}
            disabled={isTestPending}
            title="Test rule (dry run)"
            className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
          >
            <Play className="h-4 w-4" />
          </button>
          <button
            onClick={onSendNow}
            disabled={isSendPending}
            title="Send alert now"
            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <Send className="h-4 w-4" />
          </button>
          <button
            onClick={onEdit}
            title="Edit rule"
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            title="Delete rule"
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            onClick={onToggleExpand}
            className="p-2 text-gray-400 hover:text-gray-600"
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="border-t border-gray-100 px-4 py-4 bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <div className="text-xs text-gray-500 mb-1">Rule Configuration</div>
              <div className="text-sm">
                <div><span className="text-gray-500">Sources:</span> <span className="font-medium">{dsLabel}</span></div>
                <div><span className="text-gray-500">Metric:</span> <span className="font-medium">{metricLabel}</span></div>
                <div><span className="text-gray-500">Condition:</span> <span className="font-medium">{opLabel} {rule.threshold}</span></div>
                {rule.equipment && (
                  <div><span className="text-gray-500">Equipment:</span> <span className="font-medium">{rule.equipment.name}</span></div>
                )}
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <div className="text-xs text-gray-500 mb-1">Schedule</div>
              <div className="text-sm">
                <div><span className="text-gray-500">Time:</span> <span className="font-medium">{rule.scheduleTime}</span></div>
                <div><span className="text-gray-500">Days:</span> <span className="font-medium">{dayStr}</span></div>
                <div><span className="text-gray-500">Last sent:</span> <span className="font-medium">{
                  rule.lastNotifiedAt ? new Date(rule.lastNotifiedAt).toLocaleString() : 'Never'
                }</span></div>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <div className="text-xs text-gray-500 mb-1">Recipients</div>
              <div className="text-sm space-y-0.5">
                {rule.recipients.map((r, i) => (
                  <div key={i} className="text-gray-700 truncate">{r}</div>
                ))}
              </div>
            </div>
          </div>

          {/* Notification History */}
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Recent Notifications</h4>
            {notifications.length === 0 ? (
              <p className="text-xs text-gray-400">No notifications sent yet.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {notifications.map(n => (
                  <div key={n.id} className="flex items-start gap-3 text-xs border-b border-gray-50 pb-2">
                    {n.success ? (
                      <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-gray-700 truncate">{n.subject}</div>
                      <div className="text-gray-500">
                        {new Date(n.sentAt).toLocaleString()} · {n.recipients.join(', ')} ·{' '}
                        {Array.isArray(n.triggeredItems) ? n.triggeredItems.length : 0} items
                      </div>
                      {n.error && <div className="text-red-500 mt-0.5">{n.error}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
