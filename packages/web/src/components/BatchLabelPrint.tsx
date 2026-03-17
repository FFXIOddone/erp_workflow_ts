import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Printer, X, Check, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { STATION_DISPLAY_NAMES } from '@erp/shared';

interface BatchLabelPrintProps {
  selectedOrderIds: string[];
  onClose: () => void;
}

interface LabelData {
  qrCode: string;
  label: {
    orderNumber: string;
    customer: string;
    description: string;
    dueDate: string;
    routing: string[];
  };
}

/**
 * BatchLabelPrint - Prints multiple order labels on 8.5"x11" sheets
 * Layout: 2 columns x 5 rows = 10 labels per page
 * Each label: 4"W x 2"H
 */
export function BatchLabelPrint({ selectedOrderIds, onClose }: BatchLabelPrintProps) {
  const [isPrinting, setIsPrinting] = useState(false);

  // Fetch label data for all selected orders
  const { data: labelsData, isLoading } = useQuery({
    queryKey: ['batch-labels', selectedOrderIds],
    queryFn: async () => {
      const results = await Promise.all(
        selectedOrderIds.map(async (orderId) => {
          try {
            const response = await api.get<{ success: boolean; data: LabelData }>(
              `/qrcode/order/${orderId}/label`
            );
            return { orderId, ...response.data.data };
          } catch (e) {
            console.error(`Failed to get label for ${orderId}:`, e);
            return null;
          }
        })
      );
      return results.filter(Boolean) as (LabelData & { orderId: string })[];
    },
    enabled: selectedOrderIds.length > 0,
  });

  const truncateText = (text: string, maxLen: number) => {
    if (!text) return '';
    return text.length > maxLen ? text.substring(0, maxLen - 1) + '…' : text;
  };

  const generateLabelHTML = (label: LabelData) => {
    const customerDisplay = truncateText(label.label.customer, 26);
    const stationNames = label.label.routing
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
            <div class="order-number">${label.label.orderNumber}</div>
            <div class="customer">${customerDisplay}</div>
          </div>
          <div class="bottom">
            <div class="routing">${stationNames}</div>
            ${label.label.dueDate ? `<div class="due-date">Due: ${label.label.dueDate}</div>` : ''}
          </div>
        </div>
      </div>
    `;
  };

  const handlePrint = () => {
    if (!labelsData || labelsData.length === 0) return;
    setIsPrinting(true);

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setIsPrinting(false);
      return;
    }

    // Generate pages with up to 10 labels each (5 rows x 2 columns)
    const labelsPerPage = 10;
    const totalPages = Math.ceil(labelsData.length / labelsPerPage);
    
    let pagesHTML = '';
    for (let page = 0; page < totalPages; page++) {
      const pageLabels = labelsData.slice(page * labelsPerPage, (page + 1) * labelsPerPage);
      
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
      
      pagesHTML += `<div class="page">${rowsHTML}</div>`;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Order Labels - Batch Print</title>
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
              padding: 0.5in 0.1875in; /* Top/bottom: 1/2", Left/right: 3/16" */
              display: grid;
              grid-template-columns: 1fr 0.1875in 1fr; /* Two columns with 3/16" center gutter */
              grid-template-rows: repeat(5, 2in);
              page-break-after: always;
            }
            .page:last-child {
              page-break-after: avoid;
            }
            .gutter {
              /* Empty gutter column */
            }
            .label { 
              width: 100%;
              height: 2in;
              display: flex; 
              gap: 0.12in;
              padding: 0.1in 0.15in;
              overflow: hidden;
            }
            .label.empty {
              /* Empty placeholder */
            }
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
            .top, .bottom {
              overflow: hidden;
            }
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
    onClose();
  };

  const pageCount = labelsData ? Math.ceil(labelsData.length / 10) : 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Print Order Labels</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <p className="text-gray-600">Loading label data...</p>
            </div>
          ) : labelsData && labelsData.length > 0 ? (
            <div className="space-y-4">
              {/* Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-green-600 mb-2">
                  <Check className="w-5 h-5" />
                  <span className="font-medium">{labelsData.length} labels ready</span>
                </div>
                <p className="text-sm text-gray-600">
                  Will print on {pageCount} page{pageCount !== 1 ? 's' : ''} 
                  (10 labels per 8.5" × 11" sheet, 2×5 layout)
                </p>
              </div>

              {/* Label preview list */}
              <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
                {labelsData.map((label, i) => (
                  <div key={label.orderId} className="p-2 text-sm flex items-center gap-2">
                    <span className="text-gray-400 w-6 text-right">{i + 1}.</span>
                    <span className="font-medium">{label.label.orderNumber}</span>
                    <span className="text-gray-500 truncate">{label.label.customer}</span>
                  </div>
                ))}
              </div>

              {/* Print button */}
              <button
                onClick={handlePrint}
                disabled={isPrinting}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isPrinting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Printer className="w-5 h-5" />
                )}
                Print {labelsData.length} Labels
              </button>

              <p className="text-xs text-gray-500 text-center">
                Make sure your printer is set to Letter (8.5" × 11") paper size
              </p>
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">
              No orders selected or failed to load label data
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default BatchLabelPrint;
