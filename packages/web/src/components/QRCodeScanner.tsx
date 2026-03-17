import { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { useMutation } from '@tanstack/react-query';
import { Camera, X, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { STATION_DISPLAY_NAMES, STATUS_DISPLAY_NAMES, STATUS_COLORS } from '@erp/shared';

interface ScanResult {
  order: {
    id: string;
    orderNumber: string;
    customer: string;
    customerId?: string;
    status: string;
    priority: number;
    dueDate: string | null;
  };
  station?: {
    name: string;
    index: number;
    totalStations: number;
    isCompleted: boolean;
    completedAt: string | null;
  };
  progress?: {
    completedStations: number;
    totalStations: number;
    progressPercent: number;
    routing: string[];
  };
}

interface QRCodeScannerProps {
  station?: string;
  onScanSuccess?: (result: ScanResult) => void;
  onClose?: () => void;
}

export function QRCodeScanner({ station, onScanSuccess, onClose }: QRCodeScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const navigate = useNavigate();

  // Mutation for station check-in
  const scanMutation = useMutation({
    mutationFn: async (payload: string) => {
      if (station) {
        const response = await api.post('/qrcode/scan/station-checkin', { payload, station });
        return response.data.data as ScanResult;
      } else {
        const response = await api.post('/qrcode/scan', { payload });
        return response.data.data as ScanResult;
      }
    },
    onSuccess: (data) => {
      setScanResult(data);
      setError(null);
      if (onScanSuccess) {
        onScanSuccess(data);
      }
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Invalid QR code');
      setScanResult(null);
    },
  });

  useEffect(() => {
    if (isScanning && !scannerRef.current) {
      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1,
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      };

      const scanner = new Html5QrcodeScanner(
        'qr-reader',
        config,
        /* verbose= */ false
      );

      scanner.render(
        (decodedText) => {
          // Stop scanning on success
          scanner.clear().catch(console.error);
          scannerRef.current = null;
          setIsScanning(false);
          
          // Process the scanned code
          scanMutation.mutate(decodedText);
        },
        (error) => {
          // Ignore errors during scanning (e.g., no QR code in frame)
          console.debug('QR scan error:', error);
        }
      );

      scannerRef.current = scanner;
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
        scannerRef.current = null;
      }
    };
  }, [isScanning]);

  const handleStartScan = () => {
    setIsScanning(true);
    setScanResult(null);
    setError(null);
  };

  const handleStopScan = () => {
    if (scannerRef.current) {
      scannerRef.current.clear().catch(console.error);
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  const handleViewOrder = () => {
    if (scanResult?.order.id) {
      navigate(`/orders/${scanResult.order.id}`);
    }
  };

  const handleScanAnother = () => {
    setScanResult(null);
    setError(null);
    handleStartScan();
  };

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <div className="flex items-center gap-2">
          <Camera className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold">
            {station 
              ? `Scan Order - ${STATION_DISPLAY_NAMES[station as keyof typeof STATION_DISPLAY_NAMES] || station}`
              : 'Scan Order QR Code'
            }
          </h3>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="p-4">
        {/* Scanner area */}
        {isScanning && (
          <div className="space-y-4">
            <div 
              id="qr-reader" 
              className="mx-auto"
              style={{ maxWidth: '400px' }}
            />
            <div className="text-center">
              <button
                onClick={handleStopScan}
                className="text-sm text-red-600 hover:text-red-800"
              >
                Cancel Scan
              </button>
            </div>
          </div>
        )}

        {/* Start scan button */}
        {!isScanning && !scanResult && !error && (
          <div className="text-center py-8">
            <Camera className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">
              Position the QR code on the order label in front of your camera
            </p>
            <button
              onClick={handleStartScan}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 mx-auto"
            >
              <Camera className="w-5 h-5" />
              Start Scanning
            </button>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h4 className="text-lg font-semibold text-red-800 mb-2">Scan Failed</h4>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={handleScanAnother}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Success state with order info */}
        {scanResult && (
          <div className="space-y-4">
            {/* Success header */}
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-green-800">Order Found</p>
                <p className="text-sm text-green-600">QR code scanned successfully</p>
              </div>
            </div>

            {/* Order details */}
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">{scanResult.order.orderNumber}</span>
                <span className={`px-2 py-1 rounded-full text-sm font-medium ${
                  STATUS_COLORS[scanResult.order.status as keyof typeof STATUS_COLORS] || 'bg-gray-100 text-gray-800'
                }`}>
                  {STATUS_DISPLAY_NAMES[scanResult.order.status as keyof typeof STATUS_DISPLAY_NAMES] || scanResult.order.status}
                </span>
              </div>
              <p className="text-gray-700">{scanResult.order.customer}</p>
              {scanResult.order.dueDate && (
                <p className="text-sm">
                  <span className="text-gray-500">Due:</span>{' '}
                  <span className="font-medium">
                    {new Date(scanResult.order.dueDate).toLocaleDateString()}
                  </span>
                </p>
              )}

              {/* Station progress (if scanned for a station) */}
              {scanResult.station && scanResult.progress && (
                <div className="pt-3 border-t space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Current Station:</span>
                    <span className={`font-medium ${scanResult.station.isCompleted ? 'text-green-600' : 'text-blue-600'}`}>
                      {STATION_DISPLAY_NAMES[scanResult.station.name as keyof typeof STATION_DISPLAY_NAMES] || scanResult.station.name}
                      {scanResult.station.isCompleted && ' ✓'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Progress:</span>
                    <span className="font-medium">
                      {scanResult.progress.completedStations} / {scanResult.progress.totalStations} stations
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full transition-all"
                      style={{ width: `${scanResult.progress.progressPercent}%` }}
                    />
                  </div>
                  {/* Routing visualization */}
                  <div className="flex flex-wrap items-center gap-1 text-xs mt-2">
                    {scanResult.progress.routing.map((s, i) => {
                      const stationProgress = scanResult.progress?.routing || [];
                      const completed = i < (scanResult.progress?.completedStations || 0);
                      const isCurrent = s === scanResult.station?.name;
                      return (
                        <span key={s} className="flex items-center">
                          <span className={`px-2 py-0.5 rounded ${
                            completed 
                              ? 'bg-green-100 text-green-700' 
                              : isCurrent 
                                ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-400'
                                : 'bg-gray-100 text-gray-600'
                          }`}>
                            {STATION_DISPLAY_NAMES[s as keyof typeof STATION_DISPLAY_NAMES] || s}
                          </span>
                          {i < stationProgress.length - 1 && (
                            <ArrowRight className="w-3 h-3 text-gray-400 mx-0.5" />
                          )}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleViewOrder}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                View Order
              </button>
              <button
                onClick={handleScanAnother}
                className="flex-1 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Scan Another
              </button>
            </div>
          </div>
        )}

        {/* Loading state */}
        {scanMutation.isPending && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}
      </div>
    </div>
  );
}

// Standalone scanner page component
export function QRScannerPage() {
  const [selectedStation, setSelectedStation] = useState<string>('');

  return (
    <div className="max-w-lg mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">QR Code Scanner</h1>
      
      {/* Station selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Station (optional)
        </label>
        <select
          value={selectedStation}
          onChange={(e) => setSelectedStation(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2"
        >
          <option value="">None - Just lookup order</option>
          {Object.entries(STATION_DISPLAY_NAMES).map(([key, name]) => (
            <option key={key} value={key}>{name}</option>
          ))}
        </select>
        <p className="text-sm text-gray-500 mt-1">
          Select a station to see order progress at that station
        </p>
      </div>

      <QRCodeScanner station={selectedStation || undefined} />
    </div>
  );
}
