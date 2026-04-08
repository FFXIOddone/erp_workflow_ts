import { useState, useEffect, useCallback, useRef } from 'react';
import {
  AlertCircle,
  Camera,
  CheckCircle,
  Copy,
  Eye,
  FileImage,
  FolderOpen,
  Link2,
  Loader2,
  MapPin,
  QrCode,
  RefreshCw,
  Wrench,
} from 'lucide-react';
import { apiFetch, apiGet } from '../lib/api';
import { openExternalPath } from '../lib/order-files';
import { useConfigStore } from '../stores/config';
import { useAuthStore } from '../stores/auth';
import { useWebSocket } from '../lib/useWebSocket';
import { PARENT_SUB_STATIONS, getStationColorTheme } from '@erp/shared';
import toast from 'react-hot-toast';

interface StationProgress {
  station: string;
  status: string;
}

interface InstallJob {
  id: string;
  orderNumber: string;
  customerName: string;
  description: string;
  address?: string;
  routing: string[];
  stationProgress: StationProgress[];
  notes?: string | null;
}

interface OrderAttachment {
  id: string;
  fileName: string;
  filePath?: string | null;
  fileType: string;
  uploadedAt: string;
  uploadedBy?: { displayName: string } | null;
}

interface InstallOrderDetails extends InstallJob {
  attachments?: OrderAttachment[];
}

interface PhotoUploadData {
  qrDataUrl: string;
  photoUrl: string;
  expiresIn: number;
}

function getStationFamily(station: string): string[] {
  return [...new Set([station, ...(PARENT_SUB_STATIONS[station] || [])])];
}

function isCurrentStation(order: InstallJob, station: string): boolean {
  const family = getStationFamily(station);
  for (const routeStation of order.routing) {
    const progress = order.stationProgress.find((entry) => entry.station === routeStation);
    if (!progress || progress.status !== 'COMPLETED') {
      return family.includes(routeStation);
    }
  }
  return false;
}

function formatDateTime(value?: string | null): string {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleString();
}

export function InstallationStation() {
  const { config } = useConfigStore();
  const { token } = useAuthStore();
  const installationTheme = getStationColorTheme('INSTALLATION');
  const [jobs, setJobs] = useState<InstallJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<InstallJob | null>(null);
  const [selectedDetails, setSelectedDetails] = useState<InstallOrderDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [installerNote, setInstallerNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [completingOrderId, setCompletingOrderId] = useState<string | null>(null);
  const [photoUploadOpen, setPhotoUploadOpen] = useState(false);
  const [photoUploadData, setPhotoUploadData] = useState<PhotoUploadData | null>(null);
  const [photoUploadLoading, setPhotoUploadLoading] = useState(false);

  const { subscribe } = useWebSocket();
  const fetchJobsRef = useRef<() => void | Promise<void>>(() => {});
  const loadDetailsRef = useRef<
    ((orderId: string, options?: { silent?: boolean }) => Promise<InstallOrderDetails | null>) | null
  >(null);
  const selectedJobRef = useRef<InstallJob | null>(null);

  useEffect(() => {
    selectedJobRef.current = selectedJob;
  }, [selectedJob]);

  const fetchJobs = useCallback(async () => {
    if (!token) return;

    try {
      const params = new URLSearchParams({
        status: 'PENDING,IN_PROGRESS',
        station: 'INSTALLATION',
        limit: '100',
        lightweight: 'true',
      });
      const data = await apiGet<{ items?: InstallJob[] }>(`/orders?${params.toString()}`);
      const items = Array.isArray(data.items) ? data.items : [];
      const installJobs = items.filter((order) => isCurrentStation(order, 'INSTALLATION'));
      setJobs(installJobs);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to load installation jobs');
    } finally {
      setLoading(false);
    }
  }, [token]);
  fetchJobsRef.current = fetchJobs;

  const loadSelectedOrderDetails = useCallback(
    async (orderId: string, options?: { silent?: boolean }) => {
      if (!options?.silent) {
        setDetailsLoading(true);
      }

      try {
        const details = await apiGet<InstallOrderDetails>(`/orders/${orderId}`);
        setSelectedDetails(details);
        return details;
      } catch (err: any) {
        if (!options?.silent) {
          toast.error(err?.message || 'Failed to load order details');
        }
        return null;
      } finally {
        if (!options?.silent) {
          setDetailsLoading(false);
        }
      }
    },
    [],
  );
  loadDetailsRef.current = loadSelectedOrderDetails;

  useEffect(() => {
    const unsubscribe = subscribe((msg) => {
      if (
        [
          'ORDER_CREATED',
          'ORDER_UPDATED',
          'STATION_COMPLETED',
          'PHOTO_UPLOADED',
          'ATTACHMENT_ADDED',
          'NOTE_ADDED',
        ].includes(msg.type)
      ) {
        void fetchJobsRef.current();
      }

      const currentSelected = selectedJobRef.current;
      if (!currentSelected) {
        return;
      }

      if (
        ['ORDER_UPDATED', 'PHOTO_UPLOADED', 'ATTACHMENT_ADDED', 'NOTE_ADDED', 'STATION_COMPLETED'].includes(
          msg.type,
        )
      ) {
        const payload = msg.payload && typeof msg.payload === 'object' ? (msg.payload as Record<string, unknown>) : null;
        const orderId = payload && typeof payload.orderId === 'string' ? payload.orderId : null;

        if (!orderId || orderId === currentSelected.id) {
          void loadDetailsRef.current?.(currentSelected.id, { silent: true });
        }
      }
    });

    return unsubscribe;
  }, [subscribe]);

  useEffect(() => {
    void fetchJobs();
    const timer = setInterval(fetchJobs, 15000);
    return () => clearInterval(timer);
  }, [fetchJobs]);

  useEffect(() => {
    if (!selectedJob) {
      setSelectedDetails(null);
      setInstallerNote('');
      return;
    }

    setInstallerNote('');
    void loadSelectedOrderDetails(selectedJob.id);
  }, [loadSelectedOrderDetails, selectedJob]);

  const handleSelectJob = (job: InstallJob) => {
    setSelectedJob(job);
    setPhotoUploadOpen(false);
    setPhotoUploadData(null);
  };

  const handleMarkComplete = async () => {
    if (!selectedJob) return;
    if (!window.confirm(`Mark ${selectedJob.orderNumber} installation complete?`)) return;

    setCompletingOrderId(selectedJob.id);
    try {
      await apiFetch(`/orders/${selectedJob.id}/stations/INSTALLATION/complete`, {
        method: 'POST',
      });
      await apiFetch(`/orders/${selectedJob.id}/complete`, {
        method: 'POST',
      });
      toast.success(`${selectedJob.orderNumber} installation complete`);
      setSelectedJob(null);
      setSelectedDetails(null);
      setPhotoUploadOpen(false);
      setPhotoUploadData(null);
      await fetchJobs();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to complete installation');
    } finally {
      setCompletingOrderId(null);
    }
  };

  const handleSaveInstallerNote = async () => {
    if (!selectedJob) return;
    const note = installerNote.trim();
    if (!note) {
      toast.error('Enter an installer note first');
      return;
    }

    setSavingNote(true);
    try {
      await apiFetch(`/orders/${selectedJob.id}/installation-notes`, {
        method: 'POST',
        body: JSON.stringify({ note }),
      });
      toast.success('Installer note saved');
      setInstallerNote('');
      await loadSelectedOrderDetails(selectedJob.id);
      await fetchJobs();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save installer note');
    } finally {
      setSavingNote(false);
    }
  };

  const handleOpenPhotoUpload = async () => {
    if (!selectedJob) return;

    setPhotoUploadOpen(true);
    setPhotoUploadLoading(true);
    setPhotoUploadData(null);

    try {
      const data = await apiGet<PhotoUploadData>(`/qrcode/photo-upload/${selectedJob.id}`);
      setPhotoUploadData(data);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to prepare photo upload link');
      setPhotoUploadOpen(false);
    } finally {
      setPhotoUploadLoading(false);
    }
  };

  const handleCopyPhotoLink = async () => {
    if (!photoUploadData?.photoUrl) return;

    try {
      await navigator.clipboard.writeText(photoUploadData.photoUrl);
      toast.success('Photo upload link copied');
    } catch {
      window.prompt('Copy photo upload link', photoUploadData.photoUrl);
    }
  };

  const handleOpenProof = async (attachment: OrderAttachment) => {
    if (!attachment.filePath) {
      toast.error('Proof file path is missing');
      return;
    }

    try {
      const result = await openExternalPath(attachment.filePath, 'file');
      if (result === 'opened') {
        toast.success(`Opened ${attachment.fileName}`);
      } else {
        toast.success(`${attachment.fileName} path copied`);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to open proof file');
    }
  };

  const proofAttachments = (selectedDetails?.attachments || [])
    .filter((attachment) => attachment.fileType === 'PROOF')
    .sort((a, b) => {
      const left = Date.parse(b.uploadedAt) || 0;
      const right = Date.parse(a.uploadedAt) || 0;
      return left - right;
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex h-full bg-gray-50">
      <aside className="w-80 border-r bg-white overflow-auto">
        <div
          className="p-3 border-b"
          style={{ backgroundColor: installationTheme.softColor, borderColor: installationTheme.softBorderColor }}
        >
          <h3 className="font-semibold flex items-center gap-2" style={{ color: installationTheme.softTextColor }}>
            <Wrench className="w-4 h-4" style={{ color: installationTheme.baseColor }} />
            Install Jobs
          </h3>
        </div>

        {error && (
          <div className="m-3 p-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {jobs.length === 0 && !error && (
          <div className="p-8 text-center text-gray-400 text-sm">No install jobs</div>
        )}

        {jobs.map((job) => (
          <button
            key={job.id}
            onClick={() => handleSelectJob(job)}
            className="w-full text-left p-3 border-b transition-colors"
            style={
              selectedJob?.id === job.id
                ? {
                    backgroundColor: installationTheme.softColor,
                    borderLeftWidth: '4px',
                    borderLeftColor: installationTheme.baseColor,
                  }
                : undefined
            }
          >
            <div className="font-bold text-sm">{job.orderNumber}</div>
            <div className="text-xs text-gray-500 truncate">{job.customerName}</div>
            <div className="text-xs text-gray-400 truncate">{job.description}</div>
          </button>
        ))}
      </aside>

      <main className="flex-1 overflow-auto">
        {!selectedJob ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <Wrench className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <p>Select an install job to begin</p>
            </div>
          </div>
        ) : (
          <div className="max-w-6xl mx-auto p-6 space-y-6">
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide" style={{ color: installationTheme.baseColor }}>
                    <Wrench className="w-4 h-4" style={{ color: installationTheme.baseColor }} />
                    Installation
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">{selectedJob.orderNumber}</h2>
                  <p className="text-sm text-gray-600">{selectedJob.customerName}</p>
                  <p className="text-sm text-gray-500 max-w-3xl">{selectedJob.description}</p>
                  {selectedDetails?.address && (
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {selectedDetails.address}
                    </p>
                  )}
                  {selectedJob.routing.length > 0 && (
                    <p className="text-xs text-gray-400">
                      Route: {selectedJob.routing.join(' > ')}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleMarkComplete}
                    disabled={Boolean(completingOrderId)}
                    className="flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
                  >
                    {completingOrderId === selectedJob.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    Done
                  </button>
                  <button
                    onClick={handleOpenPhotoUpload}
                    className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium"
                    style={{
                      backgroundColor: installationTheme.solidColor,
                      color: installationTheme.solidTextColor,
                    }}
                  >
                    <Camera className="w-4 h-4" />
                    Camera Upload
                  </button>
                  <button
                    onClick={() => void loadSelectedOrderDetails(selectedJob.id)}
                    disabled={detailsLoading}
                    className="flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                  >
                    <RefreshCw className={`w-4 h-4 ${detailsLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </div>
              </div>
            </section>

            <div className="grid gap-6 lg:grid-cols-2">
              <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <FileImage className="w-4 h-4" style={{ color: installationTheme.baseColor }} />
                    <h3 className="font-semibold text-gray-900">Proof Files</h3>
                  </div>
                  <span className="text-xs rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">
                    {proofAttachments.length} files
                  </span>
                </div>

                {detailsLoading ? (
                  <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading order details...
                  </div>
                ) : proofAttachments.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {proofAttachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className="rounded-xl border p-4"
                        style={{
                          borderColor: installationTheme.softBorderColor,
                          backgroundColor: installationTheme.softColor,
                        }}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 break-all">{attachment.fileName}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {formatDateTime(attachment.uploadedAt)}
                              {attachment.uploadedBy?.displayName
                                ? ` • ${attachment.uploadedBy.displayName}`
                                : ''}
                            </p>
                          </div>
                          <button
                            onClick={() => handleOpenProof(attachment)}
                            className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm"
                            style={{ color: installationTheme.baseColor }}
                          >
                            <Eye className="w-4 h-4" />
                            Open
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                    No proof files have been linked yet.
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Link2 className="w-4 h-4" style={{ color: installationTheme.baseColor }} />
                    <h3 className="font-semibold text-gray-900">Order Notes</h3>
                  </div>
                  <span className="text-xs rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">
                    Installer saved notes
                  </span>
                </div>

                <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                    Current Notes
                  </p>
                  <div className="whitespace-pre-wrap text-sm text-gray-700 min-h-24">
                    {selectedDetails?.notes?.trim() || 'No notes on this order yet.'}
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                    Add Installer Note
                  </label>
                  <textarea
                    value={installerNote}
                    onChange={(e) => setInstallerNote(e.target.value)}
                    placeholder="Measurements, install issues, customer feedback, site notes..."
                    className="w-full h-32 resize-none rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2"
                    style={{
                      borderColor: installationTheme.softBorderColor,
                    }}
                  />
                  <div className="mt-3 flex items-center justify-end gap-2">
                    <button
                      onClick={() => setInstallerNote('')}
                      className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
                    >
                      Clear
                    </button>
                    <button
                      onClick={handleSaveInstallerNote}
                      disabled={!installerNote.trim() || savingNote}
                      className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
                      style={{
                        backgroundColor: installationTheme.solidColor,
                        color: installationTheme.solidTextColor,
                      }}
                    >
                      {savingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      Save Note
                    </button>
                  </div>
                </div>
              </section>
            </div>

            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <QrCode className="w-4 h-4" style={{ color: installationTheme.baseColor }} />
                  <h3 className="font-semibold text-gray-900">Phone Photo Upload</h3>
                </div>
                <button
                  onClick={handleOpenPhotoUpload}
                  className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm"
                  style={{ color: installationTheme.baseColor }}
                >
                  <Camera className="w-4 h-4" />
                  Open QR
                </button>
              </div>

              <p className="mt-3 text-sm text-gray-600">
                Open the QR code, scan it with the installer&apos;s phone camera, and the mobile
                upload page will attach photos directly to this order.
              </p>
            </section>
          </div>
        )}
      </main>

      {photoUploadOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={() => {
            setPhotoUploadOpen(false);
            setPhotoUploadData(null);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Phone Upload QR</h3>
                <p className="text-sm text-gray-500">{selectedJob?.orderNumber}</p>
              </div>
              <button
                onClick={() => {
                  setPhotoUploadOpen(false);
                  setPhotoUploadData(null);
                }}
                className="rounded-lg px-2 py-1 text-sm text-gray-500 hover:bg-gray-100"
              >
                Close
              </button>
            </div>

            <div className="space-y-4 p-5">
              {photoUploadLoading ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                  <Loader2 className="w-6 h-6 animate-spin" style={{ color: installationTheme.baseColor }} />
                  <p className="mt-2 text-sm">Preparing photo upload link...</p>
                </div>
              ) : photoUploadData ? (
                <>
                  <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 p-3">
                    <img
                      src={photoUploadData.qrDataUrl}
                      alt="Photo upload QR code"
                      className="w-full rounded-xl bg-white"
                    />
                  </div>
                  <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                    Scan this QR code with the installer&apos;s phone camera. The mobile page opens
                    the camera on the phone so they can take and upload photos directly to the ERP.
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={photoUploadData.photoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium"
                      style={{
                        backgroundColor: installationTheme.solidColor,
                        color: installationTheme.solidTextColor,
                      }}
                    >
                      <Eye className="w-4 h-4" />
                      Open Link
                    </a>
                    <button
                      onClick={handleCopyPhotoLink}
                      className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <Copy className="w-4 h-4" />
                      Copy Link
                    </button>
                  </div>
                  <p className="text-xs text-gray-400">
                    Link expires in about {Math.ceil(photoUploadData.expiresIn / 60)} minutes.
                  </p>
                </>
              ) : (
                <div className="flex items-center justify-center py-8 text-gray-500">
                  No photo upload link available.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
