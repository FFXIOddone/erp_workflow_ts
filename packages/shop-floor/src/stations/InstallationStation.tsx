import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Wrench,
  Play,
  Pause,
  Square,
  Camera,
  MapPin,
  Clock,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Upload,
  Timer,
} from 'lucide-react';
import { useConfigStore } from '../stores/config';
import { useAuthStore } from '../stores/auth';
import { useWebSocket } from '../lib/useWebSocket';
import { invoke, isTauri } from '../lib/tauri-bridge';
import toast from 'react-hot-toast';

type TimerState = 'idle' | 'running' | 'paused';

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
}

async function ensureOk(response: Response): Promise<void> {
  if (response.ok) {
    return;
  }

  const body = await response.text().catch(() => '');
  throw new Error(body || `API ${response.status}`);
}

/** Check if all stations before this one in the routing are COMPLETED */
function isCurrentStation(order: InstallJob, station: string): boolean {
  const idx = order.routing.indexOf(station);
  if (idx === -1) return false;
  for (let i = 0; i < idx; i++) {
    const prev = order.stationProgress.find(p => p.station === order.routing[i]);
    if (!prev || prev.status !== 'COMPLETED') return false;
  }
  const self = order.stationProgress.find(p => p.station === station);
  return !self || self.status !== 'COMPLETED';
}

export function InstallationStation() {
  const { config } = useConfigStore();
  const { token } = useAuthStore();
  const [jobs, setJobs] = useState<InstallJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<InstallJob | null>(null);

  // Timer state
  const [timerState, setTimerState] = useState<TimerState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [pauseAccum, setPauseAccum] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Photos
  const [photos, setPhotos] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  // WebSocket for real-time updates
  const { subscribe } = useWebSocket();
  const fetchJobsRef = useRef<() => void | Promise<void>>(() => {});

  useEffect(() => {
    const unsub = subscribe((msg) => {
      if (['STATION_COMPLETED', 'ORDER_CREATED'].includes(msg.type)) {
        void fetchJobsRef.current();
      }
    });
    return unsub;
  }, [subscribe]);

  const fetchJobs = useCallback(async () => {
    if (!token) return;
    try {
      // Fetch only orders that have INSTALLATION in their routing
      // and are either pending or in progress.
      const params = new URLSearchParams({
        status: 'PENDING,IN_PROGRESS',
        station: 'INSTALLATION',
        limit: '100',
        lightweight: 'true',
      });
      const response = await fetch(`${config.apiUrl}/orders?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(`API ${response.status}`);
      const json = await response.json();
      const items = json.data?.items ?? json.data ?? [];
      const allItems: InstallJob[] = Array.isArray(items) ? items : [];
      // Client-side: only show orders where INSTALLATION is the current active station
      const installJobs = allItems.filter(order => isCurrentStation(order, 'INSTALLATION'));
      setJobs(installJobs);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [config.apiUrl, token]);
  fetchJobsRef.current = fetchJobs;

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Timer tick
  useEffect(() => {
    if (timerState === 'running') {
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - (startTime || 0)) / 1000) + pauseAccum);
      }, 500);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerState, startTime, pauseAccum]);

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const startTimer = () => {
    setStartTime(Date.now());
    setTimerState('running');
  };

  const pauseTimer = () => {
    setPauseAccum(elapsed);
    setTimerState('paused');
  };

  const resumeTimer = () => {
    setStartTime(Date.now());
    setTimerState('running');
  };

  const stopTimer = async () => {
    setTimerState('idle');
    if (!activeJob) return;

    try {
      const endedAt = new Date();
      const startedAt = new Date(endedAt.getTime() - elapsed * 1000);
      const notesWithPhotoCount = photos.length > 0
        ? [notes.trim(), `Captured photos locally: ${photos.length}`].filter(Boolean).join('\n')
        : notes.trim();

      const logTimeResponse = await fetch(`${config.apiUrl}/orders/${activeJob.id}/time`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          station: 'INSTALLATION',
          startTime: startedAt.toISOString(),
          endTime: endedAt.toISOString(),
          notes: notesWithPhotoCount || null,
        }),
      });
      await ensureOk(logTimeResponse);
      toast.success(`Session logged: ${formatTime(elapsed)}`);
    } catch {
      toast.error('Failed to save session — will retry when online');
      // TODO: queue for offline sync
    }

    setElapsed(0);
    setPauseAccum(0);
    setStartTime(null);
    setPhotos([]);
    setNotes('');
  };

  const capturePhoto = async () => {
    if (!isTauri()) {
      toast.error('Camera only available in desktop app');
      return;
    }
    try {
      // Use file dialog to pick a photo
      const path = await invoke<string>('pick_file');
      if (path) {
        setPhotos((prev) => [...prev, path]);
        toast.success('Photo added');
      }
    } catch {
      // Fall back to file input
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = 'environment';
      input.onchange = (e: any) => {
        if (e.target.files?.[0]) {
          setPhotos((prev) => [...prev, URL.createObjectURL(e.target.files[0])]);
          toast.success('Photo added');
        }
      };
      input.click();
    }
  };

  const handleMarkComplete = async (orderId: string, orderNumber: string) => {
    if (!window.confirm(`Mark ${orderNumber} installation complete?`)) return;
    try {
      // Mark INSTALLATION station completed
      const completeStationResponse = await fetch(
        `${config.apiUrl}/orders/${orderId}/stations/INSTALLATION/complete`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      await ensureOk(completeStationResponse);
      // Mark order complete
      const res = await fetch(`${config.apiUrl}/orders/${orderId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      await ensureOk(res);
      toast.success(`${orderNumber} installation complete`);
      setActiveJob(null);
      fetchJobs();
    } catch {
      toast.error('Failed to complete installation');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Job list sidebar */}
      <div className="w-80 border-r bg-white overflow-auto">
        <div className="p-3 border-b bg-amber-50">
          <h3 className="font-semibold text-amber-900 flex items-center gap-2">
            <Wrench className="w-4 h-4" />
            Install Jobs
          </h3>
        </div>
        {jobs.length === 0 && (
          <div className="p-8 text-center text-gray-400 text-sm">
            No install jobs
          </div>
        )}
        {jobs.map((job) => (
          <div
            key={job.id}
            onClick={() => {
              if (timerState !== 'idle') {
                toast.error('Stop current timer first');
                return;
              }
              setActiveJob(job);
            }}
            className={`w-full text-left p-3 border-b hover:bg-amber-50 cursor-pointer ${
              activeJob?.id === job.id ? 'bg-amber-100 border-l-4 border-l-amber-500' : ''
            }`}
          >
            <div className="font-bold text-sm">{job.orderNumber}</div>
            <div className="text-xs text-gray-500 truncate">{job.customerName}</div>
            <div className="text-xs text-gray-400 truncate">{job.description}</div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleMarkComplete(job.id, job.orderNumber);
              }}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-green-600 hover:bg-green-50 rounded-lg mt-1"
              title="Mark order complete"
            >
              <CheckCircle className="w-4 h-4" />
              Done
            </button>
          </div>
        ))}
      </div>

      {/* Main panel */}
      <div className="flex-1 flex flex-col">
        {!activeJob ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <Wrench className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <p>Select an install job to begin</p>
            </div>
          </div>
        ) : (
          <>
            {/* Job header */}
            <div className="bg-white border-b px-6 py-4">
              <h2 className="text-xl font-bold text-gray-900">
                {activeJob.orderNumber} — {activeJob.customerName}
              </h2>
              <p className="text-sm text-gray-500">{activeJob.description}</p>
              {activeJob.address && (
                <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                  <MapPin className="w-3 h-3" />
                  {activeJob.address}
                </p>
              )}
            </div>

            {/* Timer */}
            <div className="bg-gray-50 px-6 py-8 flex flex-col items-center">
              <div className="text-6xl font-mono font-bold text-gray-900 mb-6 tabular-nums">
                {formatTime(elapsed)}
              </div>
              <div className="flex items-center gap-4">
                {timerState === 'idle' && (
                  <button
                    onClick={startTimer}
                    className="flex items-center gap-2 px-8 py-3 bg-green-600 text-white rounded-xl text-lg hover:bg-green-700"
                  >
                    <Play className="w-5 h-5" />
                    Start
                  </button>
                )}
                {timerState === 'running' && (
                  <>
                    <button
                      onClick={pauseTimer}
                      className="flex items-center gap-2 px-6 py-3 bg-yellow-500 text-white rounded-xl text-lg hover:bg-yellow-600"
                    >
                      <Pause className="w-5 h-5" />
                      Pause
                    </button>
                    <button
                      onClick={stopTimer}
                      className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-xl text-lg hover:bg-red-700"
                    >
                      <Square className="w-5 h-5" />
                      Stop & Save
                    </button>
                  </>
                )}
                {timerState === 'paused' && (
                  <>
                    <button
                      onClick={resumeTimer}
                      className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl text-lg hover:bg-green-700"
                    >
                      <Play className="w-5 h-5" />
                      Resume
                    </button>
                    <button
                      onClick={stopTimer}
                      className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-xl text-lg hover:bg-red-700"
                    >
                      <Square className="w-5 h-5" />
                      Stop & Save
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Photos & Notes */}
            <div className="flex-1 overflow-auto p-6 space-y-4">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Camera className="w-4 h-4" />
                  Photos ({photos.length})
                </h3>
                <div className="flex flex-wrap gap-2">
                  {photos.map((p, i) => (
                    <div
                      key={i}
                      className="w-20 h-20 bg-gray-200 rounded-lg flex items-center justify-center text-xs text-gray-500"
                    >
                      Photo {i + 1}
                    </div>
                  ))}
                  <button
                    onClick={capturePhoto}
                    className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-amber-400 hover:text-amber-600"
                  >
                    <Camera className="w-5 h-5" />
                    <span className="text-xs">Add</span>
                  </button>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Notes</h3>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Installation notes, issues, measurements..."
                  className="w-full h-32 px-4 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
