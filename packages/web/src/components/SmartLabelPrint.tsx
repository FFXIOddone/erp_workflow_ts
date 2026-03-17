import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Printer, X, Loader2, Calendar, Filter, Layers } from 'lucide-react';
import { api } from '../lib/api';
import { STATION_DISPLAY_NAMES, PrintingMethod } from '@erp/shared';

interface SmartLabelPrintProps {
  onClose: () => void;
}

interface LabelData {
  orderId: string;
  qrCode: string;
  orderNumber: string;
  customer: string;
  description: string;
  dueDate: string;
  routing: string[];
  printingMethod: string | null;
}

interface SmartBatchResponse {
  labels?: LabelData[];
  grouped?: Record<string, LabelData[]>;
  count?: number;
  totalCount?: number;
  dateRange: { from: string; to: string };
}

/**
 * Add business days to a date (skips weekends)
 */
function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dayOfWeek = result.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      added++;
    }
  }
  return result;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

const PRINTING_METHODS = [
  { value: '', label: 'All Methods' },
  { value: 'ROLL_TO_ROLL', label: 'Roll to Roll' },
  { value: 'FLATBED', label: 'Flatbed' },
  { value: 'SCREEN_PRINT', label: 'Screen Printing' },
  { value: 'VINYL', label: 'Vinyl' },
  { value: 'CNC_ROUTER', label: 'CNC Router' },
  { value: 'LASER', label: 'Laser' },
];

// Create display names map from the methods array
const PRINTING_METHOD_DISPLAY_NAMES: Record<string, string> = Object.fromEntries(
  PRINTING_METHODS.filter(m => m.value).map(m => [m.value, m.label])
);

export function SmartLabelPrint({ onClose }: SmartLabelPrintProps) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [dueDateFrom, setDueDateFrom] = useState(formatDate(today));
  const [dueDateTo, setDueDateTo] = useState(formatDate(addBusinessDays(today, 7)));
  const [printingMethod, setPrintingMethod] = useState('');
  const [groupByMethod, setGroupByMethod] = useState(true);
  const [isPrinting, setIsPrinting] = useState(false);

  // Fetch labels based on filters
  const { data, isLoading, refetch } = useQuery<SmartBatchResponse>({
    queryKey: ['smart-labels', dueDateFrom, dueDateTo, printingMethod, groupByMethod],
    queryFn: async () => {
      const params = new URLSearchParams({
        dueDateFrom,
        dueDateTo,
        groupByMethod: String(groupByMethod),
      });
      if (printingMethod) {
        params.set('printingMethod', printingMethod);
      }
      const response = await api.get(`/qrcode/batch/smart?${params}`);
      return response.data.data;
    },
  });

  const totalCount = data?.totalCount || data?.count || 0;
  const pageCount = Math.ceil(totalCount / 10);

  const truncateText = (text: string, maxLen: number) => {
    if (!text) return '';
    return text.length > maxLen ? text.substring(0, maxLen - 1) + '…' : text;
  };

  const generateLabelHTML = (label: LabelData) => {
    const customerDisplay = truncateText(label.customer, 26);
    const stationNames = label.routing
      .slice(0, 4)
      .map((s) => STATION_DISPLAY_NAMES[s as keyof typeof STATION_DISPLAY_NAMES] || s)
      .join(' → ');

    return `
      <div class="label">
        <div class="qr-container">
          <img src="${label.qrCode}" alt="QR" />
        </div>
        <div class="info">
          <div class="top">
            <div class="order-number">${label.orderNumber}</div>
            <div class="customer">${customerDisplay}</div>
          </div>
          <div class="bottom">
            <div class="routing">${stationNames}</div>
            ${label.dueDate ? `<div class="due-date">Due: ${label.dueDate}</div>` : ''}
          </div>
        </div>
      </div>
    `;
  };

  const generatePageHTML = (labels: LabelData[], title?: string): string => {
    const labelsPerPage = 10;
    const totalPages = Math.ceil(labels.length / labelsPerPage);
    
    let pagesHTML = '';
    for (let page = 0; page < totalPages; page++) {
      const pageLabels = labels.slice(page * labelsPerPage, (page + 1) * labelsPerPage);
      
      // Build rows with left label, gutter, right label
      let rowsHTML = '';
      for (let row = 0; row < 5; row++) {
        const leftIndex = row * 2;
        const rightIndex = row * 2 + 1;
        
        const leftLabel = pageLabels[leftIndex] 
          ? generateLabelHTML(pageLabels[leftIndex]) 
          : '<div class="label empty"></div>';
        const rightLabel = pageLabels[rightIndex] 
          ? generateLabelHTML(pageLabels[rightIndex]) 
          : '<div class="label empty"></div>';
        
        rowsHTML += `${leftLabel}<div class="gutter"></div>${rightLabel}`;
      }
      
      // Add header on first page if title provided
      const headerHTML = title && page === 0 
        ? `<div class="sheet-header">${title} - ${labels.length} labels</div>` 
        : '';
      
      pagesHTML += `<div class="page">${rowsHTML}</div>`;
    }
    
    return pagesHTML;
  };

  const handlePrint = (labelsToprint?: LabelData[], title?: string) => {
    let labels: LabelData[];
    let printTitle = title;

    if (labelsToprint) {
      labels = labelsToprint;
    } else if (data?.grouped && groupByMethod) {
      // Print all grouped - each method gets its own section
      labels = Object.values(data.grouped).flat();
    } else if (data?.labels) {
      labels = data.labels;
    } else {
      return;
    }

    if (labels.length === 0) return;
    setIsPrinting(true);

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setIsPrinting(false);
      return;
    }

    let pagesHTML = '';
    if (data?.grouped && groupByMethod && !labelsToprint) {
      // Print each method group separately with headers
      for (const [method, methodLabels] of Object.entries(data.grouped)) {
        const methodName = PRINTING_METHOD_DISPLAY_NAMES[method as keyof typeof PRINTING_METHOD_DISPLAY_NAMES] || method;
        pagesHTML += generatePageHTML(methodLabels, methodName);
      }
    } else {
      pagesHTML = generatePageHTML(labels, printTitle);
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Production Labels - ${dueDateFrom} to ${dueDateTo}</title>
          <style>
            @page { 
              size: letter; 
              margin: 0;
            }
            * { 
              box-sizing: border-box; 
              margin: 0; 
              padding: 0; 
            }
            body { 
              font-family: Arial, Helvetica, sans-serif;
              width: 8.5in;
              margin: 0;
              padding: 0;
            }
            .page {
              width: 8.5in;
              height: 11in;
              padding: 0.5in 0.1875in;
              display: grid;
              grid-template-columns: 1fr 0.1875in 1fr;
              grid-template-rows: repeat(5, 2in);
              page-break-after: always;
            }
            .page:last-child {
              page-break-after: avoid;
            }
            .gutter { }
            .label { 
              width: 100%;
              height: 2in;
              display: flex; 
              gap: 0.12in;
              padding: 0.1in 0.15in;
              overflow: hidden;
            }
            .label.empty { }
            .qr-container { 
              flex-shrink: 0;
              display: flex;
              align-items: center;
              justify-content: center;
              width: 1.4in;
            }
            .qr-container img { 
              width: 1.35in; 
              height: 1.35in; 
            }
            .info { 
              flex: 1;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              overflow: hidden;
              min-width: 0;
              padding: 0.05in 0;
            }
            .top, .bottom { overflow: hidden; }
            .order-number { 
              font-size: 16pt; 
              font-weight: bold;
              line-height: 1.1;
            }
            .customer { 
              font-size: 10pt;
              margin-top: 0.03in;
              line-height: 1.2;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
            .routing { 
              font-size: 7pt;
              color: #444;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
            .due-date { 
              font-size: 9pt;
              font-weight: bold;
              margin-top: 0.02in;
            }
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          ${pagesHTML}
          <script>
            window.onload = function() { 
              window.print(); 
              window.onafterprint = function() { window.close(); }
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
    setIsPrinting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Print Production Labels</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* Filters */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Calendar className="w-4 h-4 inline mr-1" />
                Due Date From
              </label>
              <input
                type="date"
                value={dueDateFrom}
                onChange={(e) => setDueDateFrom(e.target.value)}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Calendar className="w-4 h-4 inline mr-1" />
                Due Date To
              </label>
              <input
                type="date"
                value={dueDateTo}
                onChange={(e) => setDueDateTo(e.target.value)}
                className="input w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Filter className="w-4 h-4 inline mr-1" />
                Printing Method
              </label>
              <select
                value={printingMethod}
                onChange={(e) => setPrintingMethod(e.target.value)}
                className="input w-full"
              >
                {PRINTING_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={groupByMethod}
                  onChange={(e) => setGroupByMethod(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">
                  <Layers className="w-4 h-4 inline mr-1" />
                  Group by printing method
                </span>
              </label>
            </div>
          </div>

          {/* Results */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : data ? (
            <div className="space-y-4">
              {/* Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900">
                    {totalCount} orders found
                  </span>
                  <span className="text-sm text-gray-500">
                    {pageCount} sheet{pageCount !== 1 ? 's' : ''} (10 labels/sheet)
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  Due dates: {data.dateRange.from} to {data.dateRange.to}
                </p>
              </div>

              {/* Grouped results */}
              {data.grouped && groupByMethod ? (
                <div className="space-y-3">
                  {Object.entries(data.grouped).map(([method, labels]) => {
                    const methodName = PRINTING_METHOD_DISPLAY_NAMES[method as keyof typeof PRINTING_METHOD_DISPLAY_NAMES] || method;
                    const methodPages = Math.ceil(labels.length / 10);
                    
                    return (
                      <div key={method} className="border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <span className="font-medium">{methodName}</span>
                            <span className="text-sm text-gray-500 ml-2">
                              {labels.length} labels ({methodPages} sheet{methodPages !== 1 ? 's' : ''})
                            </span>
                          </div>
                          <button
                            onClick={() => handlePrint(labels, methodName)}
                            className="btn btn-sm btn-secondary flex items-center gap-1"
                          >
                            <Printer className="w-3 h-3" />
                            Print
                          </button>
                        </div>
                        <div className="text-xs text-gray-500 space-x-2">
                          {labels.slice(0, 5).map((l) => (
                            <span key={l.orderId} className="inline-block bg-gray-100 px-1.5 py-0.5 rounded">
                              {l.orderNumber}
                            </span>
                          ))}
                          {labels.length > 5 && (
                            <span className="text-gray-400">+{labels.length - 5} more</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : data.labels && data.labels.length > 0 ? (
                <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
                  {data.labels.map((label, i) => (
                    <div key={label.orderId} className="p-2 text-sm flex items-center gap-2">
                      <span className="text-gray-400 w-6 text-right">{i + 1}.</span>
                      <span className="font-medium">{label.orderNumber}</span>
                      <span className="text-gray-500 truncate flex-1">{label.customer}</span>
                      <span className="text-xs text-gray-400">{label.dueDate}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-4">
                  No orders match the selected filters
                </p>
              )}

              {/* Print all button */}
              {totalCount > 0 && (
                <button
                  onClick={() => handlePrint()}
                  disabled={isPrinting}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {isPrinting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Printer className="w-5 h-5" />
                  )}
                  Print All {totalCount} Labels
                </button>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default SmartLabelPrint;
