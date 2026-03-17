import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  FileCheck,
  Pencil,
  Check,
  X,
  AlertTriangle,
  CheckCircle,
  Loader2,
  FileSpreadsheet,
} from 'lucide-react';
import { api } from '../lib/api';

interface TallyFileInfo {
  source: 'brenda' | 'christina' | 'pam';
  label: string;
  todayPath: string | null;
  todayExists: boolean;
  configuredBasePath: string | null;
}

interface ValidationMissedOrder {
  orderNumber: string;
  customerName: string;
  description: string;
  mustShipDate: string | null;
  sources: Array<{
    source: string;
    fileDate: string;
    fileName: string;
  }>;
}

interface ValidationResult {
  totalTallyEntries: number;
  uniqueOrderNumbers: number;
  matchedInERP: number;
  missedOrders: ValidationMissedOrder[];
  filesScanned: Array<{
    source: string;
    fileName: string;
    fileDate: string;
    rowCount: number;
    exists: boolean;
  }>;
  daysScanned: number;
  errors: string[];
}

const SOURCE_COLORS: Record<string, string> = {
  brenda: 'bg-blue-100 text-blue-700',
  christina: 'bg-purple-100 text-purple-700',
  pam: 'bg-amber-100 text-amber-700',
};

const SOURCE_LABELS: Record<string, string> = {
  brenda: 'Brenda',
  christina: 'Christina',
  pam: 'Pam',
};

export default function ValidateExcelListsCard() {
  const queryClient = useQueryClient();
  const [editingSource, setEditingSource] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [showResults, setShowResults] = useState(false);

  // Fetch tally file info
  const { data: files, isLoading: filesLoading } = useQuery({
    queryKey: ['validation-files'],
    queryFn: () => api.get('/production-list/validation/files').then(r => r.data.data as TallyFileInfo[]),
  });

  // Run validation
  const validateMutation = useMutation({
    mutationFn: () => api.post('/production-list/validation/run', { days: 28 }).then(r => r.data.data as ValidationResult),
    onSuccess: (data) => {
      setValidationResult(data);
      setShowResults(true);
      if (data.missedOrders.length === 0 && data.errors.length === 0) {
        toast.success(`All ${data.uniqueOrderNumbers} orders validated — none missed!`);
      } else if (data.missedOrders.length > 0) {
        toast.error(`Found ${data.missedOrders.length} potentially missed order(s)`);
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Validation failed');
    },
  });

  // Save path
  const savePath = useMutation({
    mutationFn: (payload: Record<string, string | null>) =>
      api.patch('/production-list/validation/paths', payload),
    onSuccess: () => {
      toast.success('Path updated');
      queryClient.invalidateQueries({ queryKey: ['validation-files'] });
      setEditingSource(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to save path');
    },
  });

  const handleEdit = (source: string, currentPath: string | null) => {
    setEditingSource(source);
    setEditValue(currentPath || '');
  };

  const handleSave = (source: string) => {
    const key = source === 'brenda' ? 'brendaTallyPath'
      : source === 'christina' ? 'christinaTallyPath'
      : 'pamTallyPath';
    savePath.mutate({ [key]: editValue || null });
  };

  const handleCancel = () => {
    setEditingSource(null);
    setEditValue('');
  };

  const existingFileCount = files?.filter(f => f.todayExists).length ?? 0;
  const totalFiles = files?.length ?? 0;

  return (
    <div className="mt-6 pt-6 border-t border-gray-200">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <FileCheck className="h-4 w-4 text-indigo-500" />
            Validate All Excel Lists
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Cross-reference Brenda's, Christina's, and Pam's daily tally files against ERP orders to find missed entries.
          </p>
        </div>
        {!filesLoading && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            existingFileCount === totalFiles ? 'bg-green-100 text-green-700' :
            existingFileCount > 0 ? 'bg-amber-100 text-amber-700' :
            'bg-red-100 text-red-700'
          }`}>
            {existingFileCount}/{totalFiles} today
          </span>
        )}
      </div>

      {/* File Paths */}
      <div className="space-y-2 mb-4">
        {filesLoading ? (
          <div className="flex items-center gap-2 py-3 text-sm text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading file paths...
          </div>
        ) : files?.map((file) => (
          <div
            key={file.source}
            className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2"
          >
            {/* Source badge */}
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${SOURCE_COLORS[file.source]}`}>
              {SOURCE_LABELS[file.source]}
            </span>

            {/* Status indicator */}
            {file.todayExists ? (
              <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
            )}

            {/* Path display or edit */}
            {editingSource === file.source ? (
              <div className="flex-1 flex items-center gap-1">
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  placeholder="Override base path (leave empty for default)"
                  className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSave(file.source);
                    if (e.key === 'Escape') handleCancel();
                  }}
                />
                <button
                  onClick={() => handleSave(file.source)}
                  className="p-1 text-green-600 hover:bg-green-50 rounded"
                  title="Save"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={handleCancel}
                  className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                  title="Cancel"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <>
                <span className="flex-1 text-xs text-gray-600 font-mono truncate" title={file.todayPath || 'Not configured'}>
                  {file.todayPath || 'Not configured — set Production List Directory above'}
                </span>
                <button
                  onClick={() => handleEdit(file.source, file.configuredBasePath)}
                  className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded shrink-0"
                  title="Edit path"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Validate Button */}
      <button
        onClick={() => validateMutation.mutate()}
        disabled={validateMutation.isPending}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {validateMutation.isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Scanning last 28 days...
          </>
        ) : (
          <>
            <FileCheck className="h-4 w-4" />
            Validate (Last 28 Workdays)
          </>
        )}
      </button>

      {/* Results */}
      {showResults && validationResult && (
        <div className="mt-4 space-y-3">
          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-gray-50 rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-gray-900">{validationResult.daysScanned}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">Days Scanned</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-gray-900">{validationResult.uniqueOrderNumbers}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">Unique WOs</p>
            </div>
            <div className="bg-green-50 rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-green-700">{validationResult.matchedInERP}</p>
              <p className="text-[10px] text-green-600 uppercase tracking-wide">In ERP</p>
            </div>
            <div className={`rounded-lg p-2 text-center ${validationResult.missedOrders.length > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
              <p className={`text-lg font-bold ${validationResult.missedOrders.length > 0 ? 'text-red-700' : 'text-green-700'}`}>
                {validationResult.missedOrders.length}
              </p>
              <p className={`text-[10px] uppercase tracking-wide ${validationResult.missedOrders.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
                Missed
              </p>
            </div>
          </div>

          {/* Errors */}
          {validationResult.errors.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              {validationResult.errors.map((err, i) => (
                <p key={i} className="text-xs text-amber-800 flex items-start gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  {err}
                </p>
              ))}
            </div>
          )}

          {/* Missed Orders Table */}
          {validationResult.missedOrders.length > 0 && (
            <div className="border border-red-200 rounded-lg overflow-hidden">
              <div className="bg-red-50 px-3 py-2 border-b border-red-200">
                <h4 className="text-xs font-semibold text-red-800 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Potentially Missed Orders ({validationResult.missedOrders.length})
                </h4>
                <p className="text-[10px] text-red-600 mt-0.5">
                  These WO#s appear in tally files but were not found in the ERP.
                </p>
              </div>
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-1.5 text-left font-medium text-gray-600">WO#</th>
                      <th className="px-3 py-1.5 text-left font-medium text-gray-600">Customer</th>
                      <th className="px-3 py-1.5 text-left font-medium text-gray-600">Description</th>
                      <th className="px-3 py-1.5 text-left font-medium text-gray-600">Sources</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {validationResult.missedOrders.map((order) => (
                      <tr key={order.orderNumber} className="hover:bg-red-50/50">
                        <td className="px-3 py-1.5 font-mono font-medium text-gray-900">
                          {order.orderNumber}
                        </td>
                        <td className="px-3 py-1.5 text-gray-700 max-w-[140px] truncate" title={order.customerName}>
                          {order.customerName}
                        </td>
                        <td className="px-3 py-1.5 text-gray-500 max-w-[180px] truncate" title={order.description}>
                          {order.description}
                        </td>
                        <td className="px-3 py-1.5">
                          <div className="flex flex-wrap gap-1">
                            {/* Deduplicate sources by name */}
                            {[...new Set(order.sources.map(s => s.source))].map(src => (
                              <span
                                key={src}
                                className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${SOURCE_COLORS[src] || 'bg-gray-100 text-gray-600'}`}
                              >
                                {SOURCE_LABELS[src] || src}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* All Good */}
          {validationResult.missedOrders.length === 0 && validationResult.errors.length === 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <CheckCircle className="h-6 w-6 text-green-500 mx-auto mb-1" />
              <p className="text-sm font-medium text-green-800">All Clear</p>
              <p className="text-xs text-green-600">
                All {validationResult.uniqueOrderNumbers} orders from tally files are present in the ERP.
              </p>
            </div>
          )}

          {/* File Scan Summary */}
          <button
            onClick={() => setShowResults(false)}
            className="text-xs text-gray-400 hover:text-gray-600 w-full text-center py-1"
          >
            Hide Results
          </button>
        </div>
      )}
    </div>
  );
}
