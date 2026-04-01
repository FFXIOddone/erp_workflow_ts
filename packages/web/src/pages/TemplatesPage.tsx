import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Plus, Copy, X, Trash2, Layers, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { STATION_DISPLAY_NAMES } from '@erp/shared';
import { ItemMasterAutocomplete, type ItemMasterOption } from '../components/ItemMasterAutocomplete';

const STATIONS = ['ROLL_TO_ROLL', 'SCREEN_PRINT', 'PRODUCTION', 'FLATBED', 'DESIGN', 'SALES', 'INSTALLATION', 'ORDER_ENTRY', 'SHIPPING_RECEIVING'] as const;

interface LineItemTemplate {
  itemMasterId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
}

interface TemplateForm {
  name: string;
  description: string;
  customerName: string;
  defaultRouting: string[];
  lineItemTemplates: LineItemTemplate[];
}

const emptyForm: TemplateForm = {
  name: '',
  description: '',
  customerName: '',
  defaultRouting: [],
  lineItemTemplates: [{ itemMasterId: null, description: '', quantity: 1, unitPrice: 0 }],
};

export function TemplatesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<TemplateForm>(emptyForm);

  const { data, isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      const response = await api.get('/templates', { params: { pageSize: 50 } });
      return response.data.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: object) => api.post('/templates', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast.success('Template created successfully');
      resetForm();
    },
    onError: () => toast.error('Failed to create template'),
  });

  const resetForm = () => {
    setShowModal(false);
    setForm(emptyForm);
  };

  const toggleStation = (station: string) => {
    if (form.defaultRouting.includes(station)) {
      setForm({ ...form, defaultRouting: form.defaultRouting.filter((s) => s !== station) });
    } else {
      setForm({ ...form, defaultRouting: [...form.defaultRouting, station] });
    }
  };

  const addLineItem = () => {
    setForm({
      ...form,
      lineItemTemplates: [...form.lineItemTemplates, { itemMasterId: null, description: '', quantity: 1, unitPrice: 0 }],
    });
  };

  const removeLineItem = (index: number) => {
    if (form.lineItemTemplates.length > 1) {
      setForm({
        ...form,
        lineItemTemplates: form.lineItemTemplates.filter((_, i) => i !== index),
      });
    }
  };

  const updateLineItem = (index: number, field: keyof LineItemTemplate, value: string | number | null) => {
    const updated = [...form.lineItemTemplates];
    const current = updated[index];
    updated[index] = { 
      itemMasterId: current?.itemMasterId ?? null,
      description: current?.description ?? '', 
      quantity: current?.quantity ?? 1, 
      unitPrice: current?.unitPrice ?? 0,
      [field]: value 
    };
    setForm({ ...form, lineItemTemplates: updated });
  };

  const selectItemForLine = (index: number, selected: ItemMasterOption) => {
    const updated = [...form.lineItemTemplates];
    const current = updated[index];
    updated[index] = {
      ...current!,
      itemMasterId: selected.id,
      description: selected.name,
      unitPrice: selected.unitPrice,
    };
    setForm({ ...form, lineItemTemplates: updated });
  };

  const clearItemForLine = (index: number) => {
    const updated = [...form.lineItemTemplates];
    const current = updated[index];
    updated[index] = {
      ...current!,
      itemMasterId: null,
      description: '',
      unitPrice: 0,
    };
    setForm({ ...form, lineItemTemplates: updated });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      ...form,
      description: form.description || null,
      customerName: form.customerName || null,
      lineItemTemplates: form.lineItemTemplates.filter((item) => item.description.trim()),
    });
  };

  const useTemplate = (template: {
    customerName: string | null;
    defaultRouting: string[];
    lineItemTemplates: LineItemTemplate[];
  }) => {
    // Store template data in session storage for the order form to pick up
    sessionStorage.setItem('orderTemplate', JSON.stringify({
      customerName: template.customerName || '',
      routing: template.defaultRouting,
      lineItems: template.lineItemTemplates,
    }));
    toast.success('Template loaded, redirecting to order form...');
    navigate('/orders/new');
  };

  const templates = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
  const totalTemplates = typeof data?.total === 'number' ? data.total : templates.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Order Templates</h1>
              <p className="text-gray-500">{totalTemplates} templates available</p>
            </div>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center px-4 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl hover:from-primary-700 hover:to-primary-800 shadow-lg shadow-primary-200 transition-all font-medium"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Template
        </button>
      </div>

      {/* Create Template Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={resetForm}>
          <div className="modal-content max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white">
                    <Plus className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Create Template</h3>
                </div>
                <button onClick={resetForm} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label-text">Template Name *</label>
                    <input
                      type="text"
                      required
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="input-field"
                      placeholder="e.g., Standard Banner Order"
                    />
                  </div>
                  <div>
                    <label className="label-text">Default Customer</label>
                    <input
                      type="text"
                      value={form.customerName}
                      onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                      className="input-field"
                      placeholder="Customer name (optional)"
                    />
                  </div>
                </div>
                <div>
                  <label className="label-text">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={2}
                    className="input-field"
                    placeholder="Brief description of this template..."
                  />
                </div>
                <div>
                  <label className="label-text mb-2">Default Routing</label>
                  <div className="flex flex-wrap gap-2">
                    {STATIONS.map((station) => (
                      <button
                        key={station}
                        type="button"
                        onClick={() => toggleStation(station)}
                        className={`px-3 py-2 text-sm rounded-xl transition-all font-medium ${
                          form.defaultRouting.includes(station)
                            ? 'bg-primary-600 text-white shadow-md shadow-primary-200'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {STATION_DISPLAY_NAMES[station]}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="label-text">Line Item Templates</label>
                    <button
                      type="button"
                      onClick={addLineItem}
                      className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                    >
                      + Add Item
                    </button>
                  </div>
                  <div className="space-y-2">
                    {form.lineItemTemplates.map((item, index) => (
                      <div key={index} className="flex gap-2 items-center">
                        <div className="flex-1">
                          <ItemMasterAutocomplete
                            selectedItemId={item.itemMasterId}
                            displayText={item.description}
                            onSelect={(selected) => selectItemForLine(index, selected)}
                            onClear={() => clearItemForLine(index)}
                            placeholder="Search items..."
                            compact
                          />
                        </div>
                        <input
                          type="number"
                          min="1"
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) => updateLineItem(index, 'quantity', parseInt(e.target.value) || 1)}
                          className="input-field w-20 text-sm"
                        />
                        <div className="w-24 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 text-right">
                          ${item.unitPrice.toFixed(2)}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeLineItem(index)}
                          disabled={form.lineItemTemplates.length === 1}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-30 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createMutation.isPending}
                    className="btn-primary"
                  >
                    {createMutation.isPending ? 'Creating...' : 'Create Template'}
                  </button>
                </div>
              </form>
            </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-soft border border-gray-100 p-6 animate-pulse">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-gray-200" />
                <div className="flex-1">
                  <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-gray-100 rounded w-full" />
                </div>
              </div>
              <div className="mt-4 flex gap-1">
                <div className="h-5 w-12 bg-gray-200 rounded" />
                <div className="h-5 w-14 bg-gray-200 rounded" />
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between">
                <div className="h-4 w-20 bg-gray-200 rounded" />
                <div className="h-6 w-24 bg-gray-200 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-100 to-purple-100 mx-auto flex items-center justify-center mb-4">
            <FileText className="h-8 w-8 text-violet-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">No templates yet</h3>
          <p className="text-gray-500 mt-2 max-w-sm mx-auto">
            Create a template to quickly generate common orders and save time on repetitive work.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-6 inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Your First Template
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template: {
            id: string;
            name: string;
            description: string | null;
            customerName: string | null;
            defaultRouting: string[];
            lineItemTemplates: Array<{ itemMasterId: string | null; description: string; quantity: number; unitPrice: number }>;
            createdBy: { displayName: string };
          }, index: number) => (
            <div
              key={template.id}
              className="bg-white rounded-xl shadow-soft border border-gray-100 p-6 hover:shadow-lg hover:border-primary-200 hover:-translate-y-0.5 transition-all duration-200 group animate-fade-in"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-violet-100 to-purple-100 text-violet-600 group-hover:from-violet-500 group-hover:to-purple-600 group-hover:text-white transition-all">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{template.name}</h3>
                    {template.description && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                        {template.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {template.customerName && (
                <p className="text-sm text-gray-600 mt-4 flex items-center gap-2">
                  <span className="text-gray-400">Customer:</span>
                  <span className="font-medium">{template.customerName}</span>
                </p>
              )}

              {/* Routing */}
              <div className="mt-4">
                <p className="text-xs text-gray-500 uppercase font-medium mb-2">Routing</p>
                <div className="flex flex-wrap gap-1">
                  {template.defaultRouting.length === 0 ? (
                    <span className="text-gray-400 text-sm italic">No routing configured</span>
                  ) : (
                    template.defaultRouting.map((station) => (
                      <span
                        key={station}
                        className="px-2 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-700 rounded border border-blue-200"
                      >
                        {STATION_DISPLAY_NAMES[station] ?? station}
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  {template.lineItemTemplates.length} line item{template.lineItemTemplates.length !== 1 ? 's' : ''}
                </p>
                <button
                  onClick={() => useTemplate(template)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary-600 hover:text-white hover:bg-primary-600 rounded-lg transition-all"
                  title="Create order from template"
                >
                  Use Template
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
