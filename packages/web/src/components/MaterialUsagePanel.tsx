import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Package,
  Plus,
  Edit2,
  Trash2,
  X,
  Save,
  Layers,
  AlertCircle,
  Wand2,
} from 'lucide-react';
import clsx from 'clsx';
import { api } from '../lib/api';
import { Card, CardHeader } from './Card';
import { Spinner } from './Spinner';
import { ConfirmDialog } from './ConfirmDialog';
import { MATERIAL_UNIT_DISPLAY_NAMES } from '@erp/shared';
import { ItemMasterAutocomplete, type ItemMasterOption } from './ItemMasterAutocomplete';

interface MaterialUsage {
  id: string;
  itemMasterId: string | null;
  description: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  notes: string | null;
  usedAt: string;
  itemMaster: {
    id: string;
    sku: string;
    name: string;
  } | null;
  recordedBy: {
    id: string;
    displayName: string;
  };
}

interface BOMSuggestion {
  orderId: string;
  orderNumber: string;
  materials: Array<{
    itemMasterId: string;
    itemName: string;
    itemSku: string;
    quantity: number;
    unit: string;
    unitCost: number;
    totalCost: number;
    wastePercent: number;
    source: 'template' | 'print_analysis' | 'manual';
  }>;
  totalEstimatedCost: number;
  confidence: 'high' | 'medium' | 'low';
  matchedTemplate?: string;
}

interface MaterialUsagePanelProps {
  workOrderId: string;
  orderNumber: string;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

export function MaterialUsagePanel({ workOrderId, orderNumber }: MaterialUsagePanelProps) {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<BOMSuggestion | null>(null);
  const [formData, setFormData] = useState({
    itemMasterId: '',
    description: '',
    quantity: '',
    unit: 'SQFT',
    unitCost: '',
    notes: '',
  });

  const { data: materials, isLoading } = useQuery<MaterialUsage[]>({
    queryKey: ['materials', 'order', workOrderId],
    queryFn: () =>
      api.get(`/materials/order/${workOrderId}`).then((r) => {
        const items = r.data.data?.items ?? r.data.data ?? [];
        return Array.isArray(items) ? items : [];
      }),
  });

  const addFromBOMMutation = useMutation({
    mutationFn: () => api.post(`/materials/order/${workOrderId}/from-bom`, {}),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['materials', 'order', workOrderId] });
      queryClient.invalidateQueries({ queryKey: ['job-cost', workOrderId] });
      const count = res.data.count ?? res.data.data?.length ?? 0;
      toast.success(res.data.message || `Added ${count} materials from BOM`);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || err?.message || 'Failed to add materials from BOM');
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/materials', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials', 'order', workOrderId] });
      queryClient.invalidateQueries({ queryKey: ['job-cost', workOrderId] });
      setShowAddModal(false);
      resetForm();
      toast.success('Material usage recorded');
    },
    onError: () => {
      toast.error('Failed to record material usage');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.put(`/materials/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials', 'order', workOrderId] });
      queryClient.invalidateQueries({ queryKey: ['job-cost', workOrderId] });
      setEditingId(null);
      resetForm();
      toast.success('Material updated');
    },
    onError: () => {
      toast.error('Failed to update material');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/materials/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials', 'order', workOrderId] });
      queryClient.invalidateQueries({ queryKey: ['job-cost', workOrderId] });
      setDeleteId(null);
      toast.success('Material removed');
    },
    onError: () => {
      toast.error('Failed to remove material');
    },
  });

  // Auto-suggest materials mutation
  const suggestMutation = useMutation({
    mutationFn: () => api.get(`/materials/order/${workOrderId}/bom-suggestions`),
    onSuccess: (res) => {
      setSuggestions(res.data.data);
      setShowSuggestions(true);
    },
    onError: () => {
      toast.error('Failed to get material suggestions');
    },
  });

  // Apply suggestions mutation
  const applyMutation = useMutation({
    mutationFn: (materials: BOMSuggestion['materials']) =>
      api.post(`/materials/order/${workOrderId}/apply-bom-suggestions`, { materials }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials', 'order', workOrderId] });
      queryClient.invalidateQueries({ queryKey: ['job-cost', workOrderId] });
      setShowSuggestions(false);
      setSuggestions(null);
      toast.success('Materials applied successfully');
    },
    onError: () => {
      toast.error('Failed to apply materials');
    },
  });

  const resetForm = () => {
    setFormData({
      itemMasterId: '',
      description: '',
      quantity: '',
      unit: 'SQFT',
      unitCost: '',
      notes: '',
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const quantity = parseFloat(formData.quantity);
    const unitCost = parseFloat(formData.unitCost);

    if (isNaN(quantity) || quantity <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }
    if (isNaN(unitCost) || unitCost < 0) {
      toast.error('Please enter a valid unit cost');
      return;
    }

    const data = {
      workOrderId,
      itemMasterId: formData.itemMasterId || null,
      description: formData.description,
      quantity,
      unit: formData.unit,
      unitCost,
      notes: formData.notes || null,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const startEdit = (material: MaterialUsage) => {
    setFormData({
      itemMasterId: material.itemMasterId || '',
      description: material.description,
      quantity: material.quantity.toString(),
      unit: material.unit,
      unitCost: material.unitCost.toString(),
      notes: material.notes || '',
    });
    setEditingId(material.id);
    setShowAddModal(true);
  };

  const totalMaterialCost = materials?.reduce((sum, m) => sum + m.totalCost, 0) || 0;

  return (
    <Card padding="none">
      <div className="p-4 border-b border-gray-100">
        <CardHeader
          title="Material Usage"
          description={
            materials && materials.length > 0
              ? `${materials.length} items · ${formatCurrency(totalMaterialCost)} total`
              : undefined
          }
          icon={<Package className="h-5 w-5 text-amber-500" />}
          actions={
            <div className="flex items-center gap-2">
              <button
                onClick={() => suggestMutation.mutate()}
                disabled={suggestMutation.isPending}
                className="btn btn-ghost btn-sm"
                title="Auto-suggest materials based on order description"
              >
                {suggestMutation.isPending ? (
                  <Spinner size="sm" />
                ) : (
                  <>
                    <Wand2 className="h-4 w-4 mr-1" />
                    Auto-Suggest
                  </>
                )}
              </button>
              <button
                onClick={() => addFromBOMMutation.mutate()}
                disabled={addFromBOMMutation.isPending}
                className="btn btn-ghost btn-sm"
                title="Add materials from BOM"
              >
                {addFromBOMMutation.isPending ? (
                  <Spinner size="sm" />
                ) : (
                  <>
                    <Layers className="h-4 w-4 mr-1" />
                    From BOM
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  resetForm();
                  setEditingId(null);
                  setShowAddModal(true);
                }}
                className="btn btn-primary btn-sm"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </button>
            </div>
          }
        />
      </div>

      {/* Materials List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Spinner size="lg" />
        </div>
      ) : materials && materials.length > 0 ? (
        <div className="divide-y divide-gray-100">
          {materials.map((material) => (
            <div
              key={material.id}
              className="p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-medium text-gray-900 truncate">
                      {material.description}
                    </h4>
                    {material.itemMaster && (
                      <span className="text-xs text-gray-400 font-mono">
                        {material.itemMaster.sku}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    <span>
                      {material.quantity} {MATERIAL_UNIT_DISPLAY_NAMES[material.unit] || material.unit}
                    </span>
                    <span>@ {formatCurrency(material.unitCost)}/unit</span>
                    <span className="text-gray-400">
                      by {material.recordedBy.displayName}
                    </span>
                  </div>
                  {material.notes && (
                    <p className="text-xs text-gray-400 mt-1">{material.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <span className="text-sm font-semibold text-gray-900">
                    {formatCurrency(material.totalCost)}
                  </span>
                  <button
                    onClick={() => startEdit(material)}
                    className="p-1 text-gray-400 hover:text-gray-600"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setDeleteId(material.id)}
                    className="p-1 text-gray-400 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <Package className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No materials recorded</p>
          <p className="text-xs text-gray-400 mt-1">
            Add materials used for this order to track costs
          </p>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold">
                {editingId ? 'Edit Material' : 'Record Material Usage'}
              </h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingId(null);
                  resetForm();
                }}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {/* Item Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Material Item
                </label>
                <ItemMasterAutocomplete
                  selectedItemId={formData.itemMasterId || null}
                  displayText={formData.description}
                  onSelect={(item: ItemMasterOption) => {
                    setFormData({
                      ...formData,
                      itemMasterId: item.id,
                      description: item.name,
                      unitCost: (item.costPrice ?? item.unitPrice).toString(),
                    });
                  }}
                  onClear={() => {
                    setFormData({
                      ...formData,
                      itemMasterId: '',
                      description: '',
                      unitCost: '',
                    });
                  }}
                  useCostPrice
                  compact
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description *
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Material name or description"
                  required
                  className="input w-full"
                />
              </div>

              {/* Quantity and Unit */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quantity *
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={formData.quantity}
                    onChange={(e) =>
                      setFormData({ ...formData, quantity: e.target.value })
                    }
                    placeholder="0"
                    required
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Unit
                  </label>
                  <select
                    value={formData.unit}
                    onChange={(e) =>
                      setFormData({ ...formData, unit: e.target.value })
                    }
                    className="input w-full"
                  >
                    {Object.entries(MATERIAL_UNIT_DISPLAY_NAMES).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Unit Cost */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Unit Cost ($) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.unitCost}
                  onChange={(e) =>
                    setFormData({ ...formData, unitCost: e.target.value })
                  }
                  placeholder="0.00"
                  required
                  className="input w-full"
                />
                {formData.quantity && formData.unitCost && (
                  <p className="text-xs text-gray-500 mt-1">
                    Total: {formatCurrency(parseFloat(formData.quantity) * parseFloat(formData.unitCost))}
                  </p>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  rows={2}
                  placeholder="Optional notes..."
                  className="input w-full"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingId(null);
                    resetForm();
                  }}
                  className="btn btn-ghost"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="btn btn-primary"
                >
                  {createMutation.isPending || updateMutation.isPending ? (
                    <Spinner size="sm" />
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-1" />
                      {editingId ? 'Update' : 'Save'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        title="Delete Material Usage"
        message="Are you sure you want to remove this material usage record? This will update the job cost calculation."
        confirmText="Delete"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />

      {/* Auto-Suggest Modal */}
      {showSuggestions && suggestions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Wand2 className="h-5 w-5 text-primary-600" />
                <h3 className="text-lg font-semibold text-gray-900">Suggested Materials</h3>
              </div>
              <button
                onClick={() => {
                  setShowSuggestions(false);
                  setSuggestions(null);
                }}
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Confidence Badge */}
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={clsx(
                    'px-2 py-0.5 text-xs font-medium rounded-full',
                    suggestions.confidence === 'high' && 'bg-green-100 text-green-700',
                    suggestions.confidence === 'medium' && 'bg-yellow-100 text-yellow-700',
                    suggestions.confidence === 'low' && 'bg-gray-100 text-gray-700'
                  )}
                >
                  {suggestions.confidence.charAt(0).toUpperCase() + suggestions.confidence.slice(1)} Confidence
                </span>
                {suggestions.matchedTemplate && (
                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                    Template: {suggestions.matchedTemplate}
                  </span>
                )}
              </div>

              {/* Material List */}
              {suggestions.materials.length > 0 ? (
                <div className="space-y-2">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left border-b border-gray-200">
                        <th className="py-2 font-medium text-gray-600">Material</th>
                        <th className="py-2 font-medium text-gray-600 text-right">Qty</th>
                        <th className="py-2 font-medium text-gray-600 text-right">Unit Cost</th>
                        <th className="py-2 font-medium text-gray-600 text-right">Total</th>
                        <th className="py-2 font-medium text-gray-600 text-right">Source</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {suggestions.materials.map((mat, idx) => (
                        <tr key={idx}>
                          <td className="py-2">
                            <p className="font-medium text-gray-900">{mat.itemName}</p>
                            <p className="text-xs text-gray-500">{mat.itemSku}</p>
                          </td>
                          <td className="py-2 text-right text-gray-700">
                            {Number(mat.quantity).toFixed(2)} {mat.unit}
                          </td>
                          <td className="py-2 text-right text-gray-700">
                            {formatCurrency(Number(mat.unitCost))}
                          </td>
                          <td className="py-2 text-right font-medium text-gray-900">
                            {formatCurrency(Number(mat.totalCost))}
                          </td>
                          <td className="py-2 text-right">
                            <span
                              className={clsx(
                                'px-1.5 py-0.5 text-xs font-medium rounded',
                                mat.source === 'template' && 'bg-blue-100 text-blue-700',
                                mat.source === 'print_analysis' && 'bg-purple-100 text-purple-700',
                                mat.source === 'manual' && 'bg-gray-100 text-gray-700'
                              )}
                            >
                              {mat.source === 'template' ? 'Template' : mat.source === 'print_analysis' ? 'Auto' : 'Manual'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t border-gray-200">
                      <tr>
                        <td colSpan={3} className="py-2 text-right font-semibold text-gray-700">
                          Total Estimated:
                        </td>
                        <td className="py-2 text-right font-bold text-gray-900">
                          {formatCurrency(Number(suggestions.totalEstimatedCost))}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="font-medium">No matching materials found</p>
                  <p className="text-sm">Try adding materials to inventory first</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowSuggestions(false);
                    setSuggestions(null);
                  }}
                  className="btn btn-ghost"
                >
                  Cancel
                </button>
                {suggestions.materials.length > 0 && (
                  <button
                    onClick={() => applyMutation.mutate(suggestions.materials)}
                    disabled={applyMutation.isPending}
                    className="btn btn-primary"
                  >
                    {applyMutation.isPending ? (
                      <Spinner size="sm" />
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-1" />
                        Apply Materials
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

export default MaterialUsagePanel;
