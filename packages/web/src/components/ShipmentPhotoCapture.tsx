import { useState } from 'react';
import { Camera, X, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import toast from 'react-hot-toast';

interface Props {
  orderId: string;
  onPhotoUploaded?: () => void;
}

export function ShipmentPhotoCapture({ orderId, onPhotoUploaded }: Props) {
  const [showQR, setShowQR] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const generateQR = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/qrcode/photo-upload/${orderId}`);
      setQrDataUrl(res.data.data.qrDataUrl);
      setShowQR(true);
    } catch {
      toast.error('Failed to generate QR code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={generateQR}
        disabled={loading}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
        Take Photo (Phone)
      </button>

      {/* QR Code Modal */}
      {showQR && qrDataUrl && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowQR(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Scan with Phone</h3>
              <button onClick={() => setShowQR(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <img src={qrDataUrl} alt="QR Code for photo upload" className="mx-auto w-64 h-64" />
            <p className="text-sm text-gray-500 mt-4">
              Scan this QR code with your phone camera to take a shipment photo.
            </p>
            <p className="text-xs text-gray-400 mt-2">
              Phone must be on shop WiFi. Link expires in 10 minutes.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
