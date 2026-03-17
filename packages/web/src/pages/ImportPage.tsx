import { useState, useCallback } from 'react';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  SkipForward,
  AlertTriangle,
  Loader2,
  ArrowRight,
  Eye,
  Download,
} from 'lucide-react';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';

interface ImportRowResult {
  rowNumber: number;
  orderNumber: string;
  customerName: string;
  status: 'imported' | 'updated' | 'skipped' | 'error';
  reason?: string;
}

interface ImportResult {
  totalRows: number;
  imported: number;
  updated: number;
  skipped: number;
  errors: number;
  details: ImportRowResult[];
}

type ImportStep = 'upload' | 'preview' | 'importing' | 'done';

export function ImportPage() {
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [serverPath, setServerPath] = useState('');
  const [useServerPath, setUseServerPath] = useState(false);
  const [previewResult, setPreviewResult] = useState<ImportResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      const ext = droppedFile.name.toLowerCase();
      if (ext.endsWith('.xlsx') || ext.endsWith('.xlsm') || ext.endsWith('.xls')) {
        setFile(droppedFile);
        setError(null);
      } else {
        setError('Please upload an .xlsx, .xlsm, or .xls file');
      }
    }
  }, []);

  const handlePreview = async () => {
    setLoading(true);
    setError(null);

    try {
      if (useServerPath) {
        const { data } = await api.post('/import/from-path', {
          filePath: serverPath,
          dryRun: true,
        });
        setPreviewResult(data.data);
      } else {
        if (!file) {
          setError('Please select a file');
          return;
        }
        const formData = new FormData();
        formData.append('file', file);
        const { data } = await api.post('/import/preview', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setPreviewResult(data.data);
      }
      setStep('preview');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Preview failed');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    setStep('importing');
    setLoading(true);
    setError(null);

    try {
      if (useServerPath) {
        const { data } = await api.post('/import/from-path', {
          filePath: serverPath,
          dryRun: false,
        });
        setImportResult(data.data);
      } else {
        if (!file) {
          setError('No file selected');
          return;
        }
        const formData = new FormData();
        formData.append('file', file);
        const { data } = await api.post('/import/execute', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setImportResult(data.data);
      }
      setStep('done');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Import failed');
      setStep('preview');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep('upload');
    setFile(null);
    setServerPath('');
    setPreviewResult(null);
    setImportResult(null);
    setError(null);
    setFilterStatus('all');
  };

  const currentResult = step === 'done' ? importResult : previewResult;

  const filteredDetails = currentResult?.details.filter(d => {
    if (filterStatus === 'all') return true;
    return d.status === filterStatus;
  }) || [];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Import Production List
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Import work orders from an Excel spreadsheet (.xlsm / .xlsx). Existing orders with missing data will be updated automatically.
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2 mb-8">
        {[
          { key: 'upload', label: 'Upload' },
          { key: 'preview', label: 'Preview' },
          { key: 'done', label: 'Complete' },
        ].map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === s.key || (step === 'importing' && s.key === 'done')
                  ? 'bg-blue-600 text-white'
                  : ['preview', 'importing', 'done'].indexOf(step) >=
                    ['upload', 'preview', 'done'].indexOf(s.key)
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-200 text-gray-500 dark:bg-gray-700'
              }`}
            >
              {i + 1}
            </div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{s.label}</span>
            {i < 2 && <ArrowRight className="w-4 h-4 text-gray-400 mx-2" />}
          </div>
        ))}
      </div>

      {/* Error alert */}
      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-800 dark:text-red-300">Error</p>
            <p className="text-sm text-red-700 dark:text-red-400 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div className="space-y-6">
          {/* Mode toggle */}
          <div className="flex gap-4">
            <button
              onClick={() => setUseServerPath(false)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border ${
                !useServerPath
                  ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300'
                  : 'bg-white border-gray-300 text-gray-700 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300'
              }`}
            >
              Upload File
            </button>
            <button
              onClick={() => setUseServerPath(true)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border ${
                useServerPath
                  ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300'
                  : 'bg-white border-gray-300 text-gray-700 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300'
              }`}
            >
              Server File Path
            </button>
          </div>

          {useServerPath ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                File path on this server
              </label>
              <input
                type="text"
                value={serverPath}
                onChange={(e) => setServerPath(e.target.value)}
                placeholder="C:\Users\...\Production List_02_10_26.xlsm"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          ) : (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
                file
                  ? 'border-green-400 bg-green-50 dark:bg-green-900/20 dark:border-green-700'
                  : 'border-gray-300 hover:border-blue-400 bg-gray-50 dark:bg-gray-800/50 dark:border-gray-600 dark:hover:border-blue-500'
              }`}
              onClick={() => document.getElementById('file-input')?.click()}
            >
              <input
                id="file-input"
                type="file"
                accept=".xlsx,.xlsm,.xls"
                onChange={handleFileChange}
                className="hidden"
              />
              {file ? (
                <div className="flex flex-col items-center gap-3">
                  <FileSpreadsheet className="w-12 h-12 text-green-600" />
                  <div>
                    <p className="text-lg font-medium text-green-800 dark:text-green-300">{file.name}</p>
                    <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                      {(file.size / 1024).toFixed(1)} KB — Click or drop to change
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <Upload className="w-12 h-12 text-gray-400" />
                  <div>
                    <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
                      Drop your spreadsheet here
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      or click to browse — .xlsx, .xlsm files supported
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={handlePreview}
              disabled={loading || (!file && !useServerPath) || (useServerPath && !serverPath)}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4" />
                  Preview Import
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Preview / Step 3: Results */}
      {(step === 'preview' || step === 'done' || step === 'importing') && currentResult && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-5 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Rows</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{currentResult.totalRows}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-green-200 dark:border-green-800 p-4">
              <p className="text-sm text-green-600 dark:text-green-400">
                {step === 'done' ? 'Imported' : 'Will Import'}
              </p>
              <p className="text-2xl font-bold text-green-600">{currentResult.imported}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-800 p-4">
              <p className="text-sm text-blue-600 dark:text-blue-400">
                {step === 'done' ? 'Updated' : 'Will Update'}
              </p>
              <p className="text-2xl font-bold text-blue-600">{currentResult.updated || 0}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-yellow-200 dark:border-yellow-800 p-4">
              <p className="text-sm text-yellow-600 dark:text-yellow-400">Skipped (No Changes)</p>
              <p className="text-2xl font-bold text-yellow-600">{currentResult.skipped}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-red-200 dark:border-red-800 p-4">
              <p className="text-sm text-red-600 dark:text-red-400">Errors</p>
              <p className="text-2xl font-bold text-red-600">{currentResult.errors}</p>
            </div>
          </div>

          {/* Filter */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter:</span>
            {['all', 'imported', 'updated', 'skipped', 'error'].map((f) => (
              <button
                key={f}
                onClick={() => setFilterStatus(f)}
                className={`px-3 py-1 rounded-full text-xs font-medium border ${
                  filterStatus === f
                    ? 'bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300'
                    : 'bg-white border-gray-300 text-gray-600 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
                {f !== 'all' && (
                  <span className="ml-1">
                    ({currentResult.details.filter((d) => d.status === f).length})
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Order table */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="max-h-[500px] overflow-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900/50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Row</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">WO #</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredDetails.map((row) => (
                    <tr key={`${row.orderNumber}-${row.rowNumber}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-2 text-sm text-gray-500">{row.rowNumber}</td>
                      <td className="px-4 py-2 text-sm font-mono font-medium text-gray-900 dark:text-gray-100">
                        {row.orderNumber}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{row.customerName}</td>
                      <td className="px-4 py-2">
                        {row.status === 'imported' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                            <CheckCircle2 className="w-3 h-3" />
                            {step === 'done' ? 'Imported' : 'Will Import'}
                          </span>
                        )}
                        {row.status === 'updated' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                            <CheckCircle2 className="w-3 h-3" />
                            {step === 'done' ? 'Updated' : 'Will Update'}
                          </span>
                        )}
                        {row.status === 'skipped' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                            <SkipForward className="w-3 h-3" />
                            Skipped
                          </span>
                        )}
                        {row.status === 'error' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                            <XCircle className="w-3 h-3" />
                            Error
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                        {row.reason}
                      </td>
                    </tr>
                  ))}
                  {filteredDetails.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                        No rows match the selected filter
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex justify-between">
            <button
              onClick={handleReset}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              {step === 'done' ? 'Import Another' : 'Back'}
            </button>

            {step === 'preview' && (
              <button
                onClick={handleImport}
                disabled={loading || (currentResult.imported === 0 && (currentResult.updated || 0) === 0)}
                className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Import {currentResult.imported} New, Update {currentResult.updated || 0} Existing
                  </>
                )}
              </button>
            )}

            {step === 'done' && (
              <a
                href="/orders"
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                View Orders
                <ArrowRight className="w-4 h-4" />
              </a>
            )}
          </div>

          {/* Import in progress overlay */}
          {step === 'importing' && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white dark:bg-gray-800 rounded-xl p-8 flex flex-col items-center gap-4 shadow-xl">
                <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
                <p className="text-lg font-medium text-gray-900 dark:text-gray-100">Importing orders...</p>
                <p className="text-sm text-gray-500">This may take a moment</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
