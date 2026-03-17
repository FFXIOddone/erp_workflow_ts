import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { Download, Printer, QrCode, X } from 'lucide-react';
import { api } from '../lib/api';
import { STATION_DISPLAY_NAMES } from '@erp/shared';

interface OrderQRCodeProps {
  orderId: string;
  orderNumber: string;
  size?: number;
  showActions?: boolean;
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

export function OrderQRCode({ orderId, orderNumber, size = 150, showActions = true }: OrderQRCodeProps) {
  const [showModal, setShowModal] = useState(false);

  // Fetch label data which includes QR code
  const { data: labelData, isLoading } = useQuery({
    queryKey: ['qrcode', 'label', orderId],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: LabelData }>(`/qrcode/order/${orderId}/label`);
      return response.data.data;
    },
    enabled: showModal,
  });

  // Generate QR code payload inline for preview (smaller)
  const qrPayload = JSON.stringify({
    type: 'WORK_ORDER',
    id: orderId,
    orderNumber: orderNumber,
    timestamp: new Date().toISOString(),
  });

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow || !labelData) return;

    // Truncate customer name if too long
    const maxCustomerLen = 28;
    const customerDisplay = labelData.label.customer.length > maxCustomerLen
      ? labelData.label.customer.substring(0, maxCustomerLen - 1) + '…'
      : labelData.label.customer;

    // Format routing as abbreviated codes
    const stationNames = labelData.label.routing
      .slice(0, 4) // Max 4 stations to fit
      .map(s => STATION_DISPLAY_NAMES[s as keyof typeof STATION_DISPLAY_NAMES] || s)
      .join(' → ');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Order Label - ${labelData.label.orderNumber}</title>
          <style>
            @page { 
              size: 4in 2in; 
              margin: 0; 
            }
            * { box-sizing: border-box; }
            body { 
              font-family: Arial, Helvetica, sans-serif; 
              margin: 0; 
              padding: 0;
              width: 4in;
              height: 2in;
            }
            .label { 
              display: flex; 
              gap: 0.15in;
              padding: 0.1in 0.15in;
              width: 4in;
              height: 2in;
              overflow: hidden;
            }
            .qr-container { 
              flex-shrink: 0;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .qr-container img { 
              width: 1.4in; 
              height: 1.4in; 
            }
            .info { 
              flex: 1;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              overflow: hidden;
              min-width: 0;
            }
            .order-number { 
              font-size: 18pt; 
              font-weight: bold;
              margin: 0;
              line-height: 1.1;
            }
            .customer { 
              font-size: 11pt;
              margin: 0.05in 0 0 0;
              line-height: 1.2;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
            .routing { 
              font-size: 7pt;
              color: #444;
              margin: 0;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
            .due-date { 
              font-size: 10pt;
              font-weight: bold;
              margin: 0.03in 0 0 0;
            }
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <div class="label">
            <div class="qr-container">
              <img src="${labelData.qrCode}" alt="QR Code" />
            </div>
            <div class="info">
              <div>
                <p class="order-number">${labelData.label.orderNumber}</p>
                <p class="customer">${customerDisplay}</p>
              </div>
              <div>
                <p class="routing">${stationNames}</p>
                ${labelData.label.dueDate ? `<p class="due-date">Due: ${labelData.label.dueDate}</p>` : ''}
              </div>
            </div>
          </div>
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
  };

  const handleDownload = () => {
    if (!labelData) return;

    // Create a link and download the QR code image
    const link = document.createElement('a');
    link.href = labelData.qrCode;
    link.download = `${labelData.label.orderNumber}-qrcode.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      {/* Small inline QR code preview */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setShowModal(true)}
          className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          title="View QR Code"
        >
          <QRCodeSVG 
            value={qrPayload} 
            size={size} 
            level="M"
            includeMargin={false}
          />
        </button>
        {showActions && (
          <div className="flex flex-col gap-1">
            <button
              onClick={() => setShowModal(true)}
              className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <QrCode className="w-3 h-3" />
              Print Label
            </button>
          </div>
        )}
      </div>

      {/* Full label modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Order Label</h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : labelData ? (
                <div className="space-y-4">
                  {/* Label preview */}
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                    <div className="flex gap-4">
                      <div className="flex-shrink-0">
                        <img 
                          src={labelData.qrCode} 
                          alt="QR Code" 
                          className="w-32 h-32"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-2xl font-bold">{labelData.label.orderNumber}</h4>
                        <p className="text-gray-700 truncate">{labelData.label.customer}</p>
                        {labelData.label.dueDate && (
                          <p className="text-sm font-medium mt-2">Due: {labelData.label.dueDate}</p>
                        )}
                        {labelData.label.routing.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {labelData.label.routing.slice(0, 3).map((station, i) => (
                              <span 
                                key={station}
                                className="text-xs bg-gray-100 px-2 py-0.5 rounded"
                              >
                                {STATION_DISPLAY_NAMES[station as keyof typeof STATION_DISPLAY_NAMES] || station}
                              </span>
                            ))}
                            {labelData.label.routing.length > 3 && (
                              <span className="text-xs text-gray-500">+{labelData.label.routing.length - 3} more</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3">
                    <button
                      onClick={handlePrint}
                      className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Printer className="w-4 h-4" />
                      Print Label
                    </button>
                    <button
                      onClick={handleDownload}
                      className="flex items-center justify-center gap-2 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">Failed to load label data</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
