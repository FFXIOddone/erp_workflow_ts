import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  CheckCircle,
  Circle,
  PlayCircle,
  Send,
  AlertTriangle,
  AlertCircle,
  Calendar,
  User,
  Package,
  Clock,
  Activity,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Printer,
  Monitor,
  HardDrive,
  FileText,
  FolderOpen,
  Loader2,
  RefreshCw,
  ArrowLeft,
  Wifi,
  WifiOff,
  Undo2,
  Layers,
  List,
  Wrench,
} from 'lucide-react';
import { useConfigStore } from '../stores/config';
import { useAuthStore } from '../stores/auth';
import { useWebSocket, type WsStatus } from '../lib/useWebSocket';
import toast from 'react-hot-toast';
import { PrintingMethod, inferRoutingFromOrderDetails, isDesignOnlyOrder } from '@erp/shared';

// ─── Types ────────────────────────────────────────────

interface StationProgress {
  id: string;
  station: string;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  startedAt?: string | null;
  completedAt?: string | null;
  completedById?: string | null;
}

interface LineItem {
  id: string;
  itemNumber: number;
  description: string;
  quantity: number;
  unitPrice?: number;
  notes?: string | null;
  itemMaster?: { name: string } | null;
  completions?: Array<{
    station: string;
    completed: boolean;
  }>;
}

interface WorkOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  description?: string | null;
  status: string;
  priority: number;
  dueDate: string | null;
  notes?: string | null;
  routing: string[];
  stationProgress: StationProgress[];
  lineItems: LineItem[];
  assignedTo?: { id: string; displayName: string } | null;
  nestingEnabled?: boolean;
  nestingFileName?: string | null;
}

interface HotfolderTarget {
  id: string;
  name: string;
  path: string;
  ripType: string;
  station: string;
  machineId: string;
  machineName: string;
  equipmentId?: string;
}

interface RipQueueKpis {
  totalJobs: number;
  inQueue: number;
  processing: number;
  printing: number;
  completedToday: number;
  failedToday: number;
  avgQueueToRipMinutes?: number | null;
  avgRipToPrintMinutes?: number | null;
  avgPrintMinutes?: number | null;
  avgTotalMinutes?: number | null;
}

interface RipJobSummary {
  id: string;
  workOrderId: string;
  sourceFileName: string;
  hotfolderName: string;
  ripType: string;
  status: string;
  queuedAt?: string;
  printStartedAt?: string | null;
  printCompletedAt?: string | null;
  workOrder?: {
    id: string;
    orderNumber: string;
    customerName: string;
    description?: string | null;
    dueDate?: string | null;
  } | null;
  equipment?: {
    id: string;
    name: string;
    station?: string | null;
  } | null;
}

interface RipDashboardData {
  hotfolders: HotfolderTarget[];
  activeJobs: RipJobSummary[];
  recentCompleted: RipJobSummary[];
  kpis: RipQueueKpis;
}

interface ThriveConnectivityData {
  status: Record<string, { online: boolean; error?: string }>;
  summary: {
    online: number;
    offline: number;
    total: number;
  };
}

interface EquipmentListItem {
  id: string;
  name: string;
  type: string;
  manufacturer?: string | null;
  model?: string | null;
  location?: string | null;
  station?: string | null;
  status: string;
  ipAddress?: string | null;
}

interface EquipmentListResponse {
  items: EquipmentListItem[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}

interface EquipmentLiveStatus {
  equipmentId: string;
  name: string;
  station?: string | null;
  reachable: boolean;
  state: string;
  stateMessage?: string | null;
  lastPolled?: string | null;
  alerts?: string[];
  errorMessage?: string | null;
}

interface OrderAttachment {
  id: string;
  fileName: string;
  filePath: string;
  fileType: string;
  fileSize?: number | null;
  description?: string | null;
}

interface ShopFloorFileChainLink {
  id: string;
  printFileName?: string | null;
  printFilePath?: string | null;
  linkConfidence?: string | null;
  status?: string | null;
  confirmed?: boolean | null;
}

interface RipFileValidation {
  valid: boolean;
  size?: number;
  error?: string;
  fileName?: string;
  resolvedPath?: string;
}

interface FieryDiagnostics {
  share: {
    path: string;
    accessible: boolean;
    writable: boolean;
    error?: string | null;
  };
  jmf: {
    host: string;
    port: number;
    discoveredUrl: string;
    autoDiscovered: boolean;
    discoveryRaw?: string | null;
  };
  queue: {
    status: string;
    queueSize: number;
    raw?: string | null;
  };
  workflow: {
    outputChannelName: string | null;
    colorMode: string | null;
    inkType: string | null;
    whiteInkOptions: string | null;
    discoveredWorkflows: string[];
    discoverySource: string;
    discoveryError?: string | null;
    hint?: string | null;
  };
  media: {
    media: string | null;
    mediaType: string | null;
    mediaUnit: string | null;
    mediaDimension: string | null;
    resolution: string | null;
    whiteInkEnabled: boolean;
  };
  capabilities?: {
    workflows: string[];
    colorModes: string[];
    inkTypes: string[];
    whiteInkOptions: string[];
    source: string;
    error?: string | null;
  } | null;
}

interface SendCandidate {
  id: string;
  kind: 'attachment' | 'fileChain';
  label: string;
  detail: string;
  attachmentId?: string;
  sourceFilePath?: string;
  fileTypeLabel: string;
}

type PrintStation = PrintingMethod.ROLL_TO_ROLL | PrintingMethod.FLATBED;

// ─── Constants ────────────────────────────────────────

const STATION_CONFIG: Record<
  PrintStation,
  { label: string; color: string; bg: string; border: string; icon: string; ring: string }
> = {
  ROLL_TO_ROLL: {
    label: 'Roll to Roll',
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: 'text-blue-500',
    ring: 'ring-blue-300',
  },
  FLATBED: {
    label: 'Flatbed',
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: 'text-blue-500',
    ring: 'ring-blue-300',
  },
};

const ALL_STATION_LABELS: Record<string, string> = {
  SALES: 'Sales',
  DESIGN_ONLY: 'Design Only',
  ORDER_ENTRY: 'Order Entry',
  DESIGN: 'Design',
  DESIGN_PROOF: 'Design - Proof',
  DESIGN_APPROVAL: 'Design - Approval',
  DESIGN_PRINT_READY: 'Design - Print Ready',
  FLATBED: 'Flatbed',
  FLATBED_PRINTING: 'Flatbed - Printing',
  ROLL_TO_ROLL: 'Roll to Roll',
  ROLL_TO_ROLL_PRINTING: 'Roll to Roll - Printing',
  SCREEN_PRINT: 'Screen Print',
  SCREEN_PRINT_PRINTING: 'Screen Print - Printing',
  SCREEN_PRINT_ASSEMBLY: 'Screen Print - Assembly',
  PRODUCTION: 'Production',
  PRODUCTION_ZUND: 'Production - Zund',
  PRODUCTION_FINISHING: 'Production - Finishing',
  SHIPPING_RECEIVING: 'Shipping',
  SHIPPING_QC: 'Shipping - QC',
  SHIPPING_PACKAGING: 'Shipping - Packaging',
  SHIPPING_SHIPMENT: 'Shipping - Shipment',
  SHIPPING_INSTALL_READY: 'Shipping - Install Ready',
  INSTALLATION: 'Installation',
  INSTALLATION_REMOTE: 'Installation - Remote',
  INSTALLATION_INHOUSE: 'Installation - InHouse',
  COMPLETE: 'Complete',
  COMPLETE_INSTALLED: 'Complete - Installed',
  COMPLETE_SHIPPED: 'Complete - Shipped',
  COMPLETE_DESIGN_ONLY: 'Complete - Design Only',
};

// Canonical station display order (mirrors routing-defaults.ts STATION_ORDER)
const ROUTING_ORDER: string[] = [
  'SALES',
  'DESIGN_ONLY',
  'ORDER_ENTRY',
  'DESIGN',
  'DESIGN_PROOF',
  'DESIGN_APPROVAL',
  'DESIGN_PRINT_READY',
  'FLATBED',
  'FLATBED_PRINTING',
  'ROLL_TO_ROLL',
  'ROLL_TO_ROLL_PRINTING',
  'SCREEN_PRINT',
  'SCREEN_PRINT_PRINTING',
  'SCREEN_PRINT_ASSEMBLY',
  'PRODUCTION',
  'PRODUCTION_ZUND',
  'PRODUCTION_FINISHING',
  'SHIPPING_RECEIVING',
  'SHIPPING_QC',
  'SHIPPING_PACKAGING',
  'SHIPPING_SHIPMENT',
  'SHIPPING_INSTALL_READY',
  'INSTALLATION',
  'INSTALLATION_REMOTE',
  'INSTALLATION_INHOUSE',
  'COMPLETE',
  'COMPLETE_INSTALLED',
  'COMPLETE_SHIPPED',
  'COMPLETE_DESIGN_ONLY',
];
function sortRouting(routing: string[]): string[] {
  return [...routing].sort((a, b) => {
    const ai = ROUTING_ORDER.indexOf(a);
    const bi = ROUTING_ORDER.indexOf(b);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });
}

const PRIORITY_CONFIG: Record<number, { label: string; color: string; textColor: string }> = {
  1: { label: 'RUSH', color: 'bg-red-500', textColor: 'text-white' },
  2: { label: 'HIGH', color: 'bg-orange-500', textColor: 'text-white' },
  3: { label: 'NORMAL', color: 'bg-gray-400', textColor: 'text-white' },
  4: { label: 'LOW', color: 'bg-blue-400', textColor: 'text-white' },
  5: { label: 'LOWEST', color: 'bg-gray-300', textColor: 'text-gray-700' },
};

const HIDDEN_ATTACHMENT_TYPES = new Set(['EMAIL', 'INVOICE', 'PACKING_SLIP', 'SHIPMENT_LOG']);
const PRINT_FILE_PATTERN = /\.(ai|eps|pdf|png|jpe?g|tiff?|psd)$/i;
const AUTO_SEND_CANDIDATE_ID = '__auto__';

// ─── Helpers ──────────────────────────────────────────

function isPrintStation(s: string): s is PrintStation {
  return s === 'ROLL_TO_ROLL' || s === 'FLATBED';
}

function inferPrintStations(
  order: Pick<WorkOrder, 'routing' | 'description' | 'notes'>
): PrintStation[] {
  return inferRoutingFromOrderDetails({
    description: order.description,
    notes: order.notes,
    routing: order.routing,
  }).filter((station): station is PrintStation => isPrintStation(station));
}

function getOrderPrintStations(
  order: Pick<WorkOrder, 'routing' | 'description' | 'notes'>
): PrintStation[] {
  if (isDesignOnlyOrder({ description: order.description, routing: order.routing })) {
    return [];
  }
  const explicitStations = order.routing.filter(isPrintStation) as PrintStation[];
  return explicitStations.length > 0 ? explicitStations : inferPrintStations(order);
}

function isOverdue(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(dateStr) < today;
}

function isDueToday(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  const today = new Date();
  const due = new Date(dateStr);
  return (
    due.getFullYear() === today.getFullYear() &&
    due.getMonth() === today.getMonth() &&
    due.getDate() === today.getDate()
  );
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'No date';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return 'Unknown size';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function isAbsoluteOrUncPath(pathValue: string | null | undefined): boolean {
  if (!pathValue) return false;
  return /^[A-Za-z]:[\\/]/.test(pathValue) || pathValue.startsWith('\\\\');
}

function getRipStatusClasses(status: string): string {
  switch (status) {
    case 'PRINTING':
      return 'bg-violet-100 text-violet-700';
    case 'READY':
    case 'SENDING':
      return 'bg-indigo-100 text-indigo-700';
    case 'PROCESSING':
      return 'bg-blue-100 text-blue-700';
    case 'PRINTED':
    case 'COMPLETED':
      return 'bg-green-100 text-green-700';
    case 'FAILED':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

function getEquipmentStatusClasses(status: string): string {
  switch (status) {
    case 'OPERATIONAL':
      return 'bg-green-100 text-green-700';
    case 'DEGRADED':
    case 'WARMING_UP':
      return 'bg-amber-100 text-amber-700';
    case 'DOWN':
    case 'OFFLINE':
      return 'bg-red-100 text-red-700';
    case 'MAINTENANCE':
      return 'bg-blue-100 text-blue-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

function getLiveStateClasses(state: string | null | undefined): string {
  switch (state) {
    case 'printing':
      return 'bg-violet-100 text-violet-700';
    case 'warmup':
    case 'drying':
      return 'bg-amber-100 text-amber-700';
    case 'idle':
      return 'bg-green-100 text-green-700';
    case 'paused':
      return 'bg-orange-100 text-orange-700';
    case 'error':
    case 'offline':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

function buildSendCandidates(
  attachments: OrderAttachment[],
  fileChainLinks: ShopFloorFileChainLink[]
): SendCandidate[] {
  const fileChainCandidates = fileChainLinks
    .filter((link) => Boolean(link.printFileName?.trim() || link.printFilePath?.trim()))
    .map((link) => ({
      id: `file-chain:${link.id}`,
      kind: 'fileChain' as const,
      label: link.printFileName?.trim() || 'Linked print file',
      detail:
        [link.status?.replace(/_/g, ' '), link.linkConfidence].filter(Boolean).join(' • ') ||
        'Existing file-chain print file',
      sourceFilePath: link.printFilePath?.trim() || undefined,
      fileTypeLabel: 'FILE CHAIN',
    }));

  const attachmentCandidates = attachments
    .filter((attachment) => {
      if (HIDDEN_ATTACHMENT_TYPES.has(attachment.fileType)) return false;
      return (
        attachment.fileType === 'ARTWORK' ||
        attachment.fileType === 'PROOF' ||
        attachment.fileType === 'OTHER' ||
        PRINT_FILE_PATTERN.test(attachment.fileName || '')
      );
    })
    .map((attachment) => ({
      id: `attachment:${attachment.id}`,
      kind: 'attachment' as const,
      label: attachment.fileName,
      detail: [
        attachment.fileType,
        isAbsoluteOrUncPath(attachment.filePath) ? 'network path' : 'uploaded attachment',
      ].join(' • '),
      attachmentId: attachment.id,
      sourceFilePath: isAbsoluteOrUncPath(attachment.filePath) ? attachment.filePath : undefined,
      fileTypeLabel: attachment.fileType,
    }));

  return [...fileChainCandidates, ...attachmentCandidates].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'fileChain' ? -1 : 1;
    return a.label.localeCompare(b.label);
  });
}

/**
 * Find the "active" print station for an order — the first one
 * in routing that is IN_PROGRESS, or failing that the first NOT_STARTED one.
 */
function getActivePrintStation(
  order: WorkOrder,
  userStations: PrintStation[]
): PrintStation | null {
  const relevantStations = getOrderPrintStations(order).filter((station) =>
    userStations.includes(station)
  );

  // First look for one that's in progress
  for (const st of relevantStations) {
    const prog = order.stationProgress.find((sp) => sp.station === st);
    if (prog?.status === 'IN_PROGRESS') return st;
  }
  // Then look for one that hasn't started
  for (const st of relevantStations) {
    const prog = order.stationProgress.find((sp) => sp.station === st);
    if (!prog || prog.status === 'NOT_STARTED') return st;
  }
  return null;
}

function getStationStatus(
  order: WorkOrder,
  station: string
): 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' {
  const prog = order.stationProgress.find((sp) => sp.station === station);
  return (prog?.status as 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED') || 'NOT_STARTED';
}

function buildCompletionMap(orders: WorkOrder[]): Record<string, Record<string, boolean>> {
  const completionMap: Record<string, Record<string, boolean>> = {};

  for (const order of orders) {
    for (const lineItem of order.lineItems ?? []) {
      for (const completion of lineItem.completions ?? []) {
        if (!completionMap[lineItem.id]) {
          completionMap[lineItem.id] = {};
        }
        completionMap[lineItem.id][completion.station] = completion.completed;
      }
    }
  }

  return completionMap;
}

// ─── Component ────────────────────────────────────────

export function PrintingStation() {
  const { config } = useConfigStore();
  const { token, user, logout } = useAuthStore();
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStation, setSelectedStation] = useState<PrintStation | 'ALL'>('ALL');
  const [showCompleted, setShowCompleted] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [detailOrder, setDetailOrder] = useState<WorkOrder | null>(null);
  const [updatingOrder, setUpdatingOrder] = useState<string | null>(null);
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [revisionOrderId, setRevisionOrderId] = useState<string | null>(null);
  const [revisionOrderNumber, setRevisionOrderNumber] = useState('');
  const [revisionReason, setRevisionReason] = useState('');
  const [revisionNotes, setRevisionNotes] = useState('');
  const [activeTab, setActiveTab] = useState<'orders' | 'rip-dashboard' | 'rip-jobs' | 'send'>(
    'orders'
  );
  const [viewMode, setViewMode] = useState<'orders' | 'material'>('orders');
  const [completions, setCompletions] = useState<Record<string, Record<string, boolean>>>({});
  const [ripDashboard, setRipDashboard] = useState<RipDashboardData | null>(null);
  const [thriveStatus, setThriveStatus] = useState<ThriveConnectivityData | null>(null);
  const [fieryDiagnostics, setFieryDiagnostics] = useState<FieryDiagnostics | null>(null);
  const [printEquipment, setPrintEquipment] = useState<EquipmentListItem[]>([]);
  const [liveEquipmentStatus, setLiveEquipmentStatus] = useState<
    Record<string, EquipmentLiveStatus>
  >({});
  const [operationsLoading, setOperationsLoading] = useState(true);
  const [operationsError, setOperationsError] = useState<string | null>(null);
  const [sendToRipOrder, setSendToRipOrder] = useState<WorkOrder | null>(null);
  const [sendCandidates, setSendCandidates] = useState<SendCandidate[]>([]);
  const [sendCandidatesLoading, setSendCandidatesLoading] = useState(false);
  const [sendCandidatesError, setSendCandidatesError] = useState<string | null>(null);
  const [selectedSendCandidateId, setSelectedSendCandidateId] = useState(AUTO_SEND_CANDIDATE_ID);
  const [manualSourcePath, setManualSourcePath] = useState('');
  const [showManualPathFallback, setShowManualPathFallback] = useState(false);
  const [selectedHotfolderId, setSelectedHotfolderId] = useState('');
  const [sendNotes, setSendNotes] = useState('');
  const [sendCopies, setSendCopies] = useState(1);
  const [sendValidation, setSendValidation] = useState<RipFileValidation | null>(null);
  const [sendingToRip, setSendingToRip] = useState(false);
  const [sendingBatchRip, setSendingBatchRip] = useState(false);
  const fetchRef = useRef<() => void>();
  const operationsFetchRef = useRef<() => void>();

  // Determine user's print stations
  const userStations = useMemo(() => {
    const allowed = (user?.allowedStations || []).filter(isPrintStation);
    return allowed.length > 0 ? allowed : (['ROLL_TO_ROLL', 'FLATBED'] as PrintStation[]);
  }, [user?.allowedStations]);

  const fetchJson = useCallback(
    async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
      if (!token) throw new Error('Not authenticated');

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...((options.headers as Record<string, string>) || {}),
      };

      const res = await fetch(`${config.apiUrl}${path}`, { ...options, headers });
      if (res.status === 401) {
        logout();
        throw new Error('Session expired');
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || body.message || `API error: ${res.status}`);
      }

      const json = await res.json();
      return (json.data !== undefined ? json.data : json) as T;
    },
    [config.apiUrl, token, logout]
  );

  // ─── WebSocket (live updates) ───────────────────────

  const { status: wsStatus } = useWebSocket(
    useCallback((msg: { type: string; payload?: unknown }) => {
      const t = msg.type;
      if (
        t === 'STATION_UPDATED' ||
        t === 'ORDER_UPDATED' ||
        t === 'ORDER_CREATED' ||
        t === 'ORDER_DELETED'
      ) {
        fetchRef.current?.();
      }
      if (
        t === 'FILE_CHAIN_UPDATED' ||
        t.startsWith('RIP_JOB_') ||
        t === 'EQUIPMENT_LIVE_STATUS' ||
        t === 'EQUIPMENT_UPDATED' ||
        t === 'EQUIPMENT_CREATED' ||
        t === 'EQUIPMENT_DELETED'
      ) {
        operationsFetchRef.current?.();
      }
    }, [])
  );

  // ─── Data Fetching ──────────────────────────────────

  const fetchOrders = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        pageSize: '500',
        status: 'IN_PROGRESS,PENDING,ON_HOLD',
        lightweight: 'true',
        myStations: 'true',
        includeLineItems: 'true',
        includeLineItemCompletions: 'true',
      });
      const res = await fetch(`${config.apiUrl}/orders?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        toast.error('Session expired — please log in again');
        logout();
        return;
      }
      if (!res.ok) throw new Error(`API error: ${res.status}`);

      const json = await res.json();
      const items = json.data?.items ?? json.data ?? [];
      const orderList: WorkOrder[] = Array.isArray(items) ? items : [];
      setOrders(orderList);
      setError(null);
      const compMap = buildCompletionMap(orderList);
      setCompletions(compMap);

      // Keep detail view in sync
      setDetailOrder((prev) => {
        if (!prev) return null;
        return orderList.find((o) => o.id === prev.id) || null;
      });
    } catch (err: any) {
      setError(err.message || 'Failed to fetch work orders');
    } finally {
      setLoading(false);
    }
  }, [config.apiUrl, token, logout]);

  const fetchPrintingOperations = useCallback(async () => {
    if (!token) return;
    setOperationsLoading(true);
    try {
      const [dashboardData, thriveData, fieryData, equipmentData, liveStatuses] = await Promise.all([
        fetchJson<RipDashboardData>('/rip-queue/dashboard'),
        fetchJson<ThriveConnectivityData>('/equipment/thrive/status'),
        fetchJson<FieryDiagnostics>('/rip-queue/fiery/diagnostics'),
        fetchJson<EquipmentListResponse>('/equipment?pageSize=100'),
        fetchJson<EquipmentLiveStatus[]>('/equipment/live-status'),
      ]);

      setRipDashboard(dashboardData);
      setThriveStatus(thriveData);
      setFieryDiagnostics(fieryData);
      setPrintEquipment(
        (equipmentData.items ?? []).filter(
          (item) => Boolean(item.station) && isPrintStation(item.station || '')
        )
      );
      setLiveEquipmentStatus(
        Object.fromEntries(liveStatuses.map((status) => [status.equipmentId, status]))
      );
      setOperationsError(null);
    } catch (err: any) {
      setOperationsError(err.message || 'Failed to load print operations');
    } finally {
      setOperationsLoading(false);
    }
  }, [fetchJson, token]);

  fetchRef.current = fetchOrders;
  operationsFetchRef.current = fetchPrintingOperations;

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 15000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  useEffect(() => {
    fetchPrintingOperations();
    const interval = setInterval(fetchPrintingOperations, 30000);
    return () => clearInterval(interval);
  }, [fetchPrintingOperations]);

  const closeSendToRipModal = useCallback(() => {
    setSendToRipOrder(null);
    setSendCandidates([]);
    setSendCandidatesLoading(false);
    setSendCandidatesError(null);
    setSelectedSendCandidateId(AUTO_SEND_CANDIDATE_ID);
    setManualSourcePath('');
    setShowManualPathFallback(false);
    setSelectedHotfolderId('');
    setSendNotes('');
    setSendCopies(1);
    setSendValidation(null);
    setSendingToRip(false);
    setActiveTab('orders');
  }, []);

  const openSendToRipModal = useCallback(
    async (order: WorkOrder) => {
      setSendToRipOrder(order);
      setSendCandidates([]);
      setSendCandidatesLoading(true);
      setSendCandidatesError(null);
      setSelectedSendCandidateId(AUTO_SEND_CANDIDATE_ID);
      setManualSourcePath('');
      setShowManualPathFallback(false);
      setSelectedHotfolderId('');
      setSendNotes('');
      setSendCopies(1);
      setSendValidation(null);
      setActiveTab('send');

      try {
        const [attachments, fileChainLinks] = await Promise.all([
          fetchJson<OrderAttachment[]>(`/orders/${order.id}/attachments`),
          fetchJson<ShopFloorFileChainLink[]>(`/file-chain/orders/${order.id}`),
        ]);
        const nextCandidates = buildSendCandidates(attachments, fileChainLinks);
        setSendCandidates(nextCandidates);
        setShowManualPathFallback(nextCandidates.length === 0);
      } catch (err: any) {
        setSendCandidatesError(err.message || 'Failed to load order files');
      } finally {
        setSendCandidatesLoading(false);
      }
    },
    [fetchJson]
  );

  // ─── Station Actions ────────────────────────────────

  const startStation = async (orderId: string, station: string) => {
    setUpdatingOrder(orderId);
    try {
      const res = await fetch(`${config.apiUrl}/orders/${orderId}/stations/${station}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        logout();
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || body.message || `Failed (${res.status})`);
      }
      toast.success(`Started ${ALL_STATION_LABELS[station] || station}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to start station');
    } finally {
      setUpdatingOrder(null);
    }
  };

  const completeStation = async (orderId: string, station: string) => {
    setUpdatingOrder(orderId);
    try {
      const res = await fetch(`${config.apiUrl}/orders/${orderId}/stations/${station}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        logout();
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || body.message || `Failed (${res.status})`);
      }
      toast.success(`Completed ${ALL_STATION_LABELS[station] || station}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete station');
    } finally {
      setUpdatingOrder(null);
    }
  };

  const uncompleteStation = async (orderId: string, station: string) => {
    setUpdatingOrder(orderId);
    try {
      const res = await fetch(`${config.apiUrl}/orders/${orderId}/stations/${station}/uncomplete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        logout();
        return;
      }
      if (!res.ok) throw new Error('Failed');
      toast.success(`Re-opened ${ALL_STATION_LABELS[station] || station}`);
    } catch {
      toast.error('Failed to uncomplete station');
    } finally {
      setUpdatingOrder(null);
    }
  };

  const handleMarkComplete = async (orderId: string, orderNumber: string) => {
    if (!window.confirm(`Mark ${orderNumber} as complete?`)) return;
    try {
      const res = await fetch(`${config.apiUrl}/orders/${orderId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      toast.success(`${orderNumber} marked complete`);
    } catch {
      toast.error('Failed to complete order');
    }
  };

  // ─── Line Item Completion Toggle ────────────────────

  const toggleLineItemComplete = async (orderId: string, lineItemId: string, station: string) => {
    const current = completions[lineItemId]?.[station] || false;
    try {
      await fetch(`${config.apiUrl}/orders/${orderId}/line-items/${lineItemId}/station-complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ station, completed: !current }),
      });
      setCompletions((prev) => ({
        ...prev,
        [lineItemId]: { ...prev[lineItemId], [station]: !current },
      }));
    } catch {
      toast.error('Failed to update line item');
    }
  };

  // ─── Computed Data ──────────────────────────────────

  const stationStats = useMemo(() => {
    const stats: Record<
      PrintStation,
      { notStarted: number; inProgress: number; completed: number; total: number; overdue: number }
    > = {} as any;

    userStations.forEach((station) => {
      const stationOrders = orders.filter((o) => getOrderPrintStations(o).includes(station));
      const s = {
        notStarted: 0,
        inProgress: 0,
        completed: 0,
        total: stationOrders.length,
        overdue: 0,
      };
      stationOrders.forEach((order) => {
        const progress = order.stationProgress.find((sp) => sp.station === station);
        if (!progress || progress.status === 'NOT_STARTED') s.notStarted++;
        else if (progress.status === 'IN_PROGRESS') s.inProgress++;
        else if (progress.status === 'COMPLETED') s.completed++;
        if (isOverdue(order.dueDate) && progress?.status !== 'COMPLETED') s.overdue++;
      });
      stats[station] = s;
    });
    return stats;
  }, [orders, userStations]);

  const filteredOrders = useMemo(() => {
    let filtered = orders;

    if (selectedStation !== 'ALL') {
      filtered = filtered.filter((o) => getOrderPrintStations(o).includes(selectedStation));
    } else {
      filtered = filtered.filter((o) =>
        getOrderPrintStations(o).some((station) => userStations.includes(station))
      );
    }

    if (!showCompleted) {
      if (selectedStation !== 'ALL') {
        filtered = filtered.filter((o) => {
          const progress = o.stationProgress.find((sp) => sp.station === selectedStation);
          return !progress || progress.status !== 'COMPLETED';
        });
      } else {
        // In ALL view, hide orders where every print station is completed
        filtered = filtered.filter((o) => {
          const printStations = getOrderPrintStations(o).filter((station) =>
            userStations.includes(station)
          );
          if (printStations.length === 0) return true;
          return !printStations.every((st) => {
            const prog = o.stationProgress.find((sp) => sp.station === st);
            return prog?.status === 'COMPLETED';
          });
        });
      }
    }

    return [...filtered].sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return aDate - bDate;
    });
  }, [orders, selectedStation, showCompleted, userStations]);

  const groupedOrders = useMemo(() => {
    if (selectedStation === 'ALL') return { all: filteredOrders };
    const notStarted: WorkOrder[] = [];
    const inProgress: WorkOrder[] = [];
    const completed: WorkOrder[] = [];

    filteredOrders.forEach((order) => {
      const progress = order.stationProgress.find((sp) => sp.station === selectedStation);
      if (!progress || progress.status === 'NOT_STARTED') notStarted.push(order);
      else if (progress.status === 'IN_PROGRESS') inProgress.push(order);
      else completed.push(order);
    });
    return { notStarted, inProgress, completed };
  }, [filteredOrders, selectedStation]);

  // ─── Material View Grouping ─────────────────────────

  const materialGroups = useMemo(() => {
    if (viewMode !== 'material') return {};
    const groups: Record<string, Array<{ lineItem: LineItem; order: WorkOrder }>> = {};
    for (const order of filteredOrders) {
      for (const li of order.lineItems) {
        const material = li.notes || li.itemMaster?.name || 'Uncategorized';
        if (!groups[material]) groups[material] = [];
        groups[material].push({ lineItem: li, order });
      }
    }
    return groups;
  }, [viewMode, filteredOrders]);

  // The active station key for line-item completions
  const activeStation =
    selectedStation !== 'ALL' ? selectedStation : userStations[0] || 'ROLL_TO_ROLL';

  const visibleStations = selectedStation === 'ALL' ? userStations : [selectedStation];

  const hotfolderStationMap = useMemo(() => {
    const map = new Map<string, PrintStation>();
    for (const hotfolder of ripDashboard?.hotfolders ?? []) {
      if (isPrintStation(hotfolder.station)) {
        map.set(hotfolder.name.toLowerCase(), hotfolder.station);
      }
    }
    return map;
  }, [ripDashboard?.hotfolders]);

  const filteredHotfolders = useMemo(
    () =>
      (ripDashboard?.hotfolders ?? []).filter(
        (hotfolder) =>
          isPrintStation(hotfolder.station) && visibleStations.includes(hotfolder.station)
      ),
    [ripDashboard?.hotfolders, visibleStations]
  );

  const filteredActiveRipJobs = useMemo(
    () =>
      (ripDashboard?.activeJobs ?? []).filter((job) => {
        if (job.equipment?.station && isPrintStation(job.equipment.station)) {
          return visibleStations.includes(job.equipment.station);
        }

        const mappedStation = hotfolderStationMap.get(job.hotfolderName.toLowerCase());
        return mappedStation ? visibleStations.includes(mappedStation) : true;
      }),
    [ripDashboard?.activeJobs, visibleStations, hotfolderStationMap]
  );

  const printerCards = useMemo(
    () =>
      printEquipment
        .filter(
          (equipment) =>
            Boolean(equipment.station) &&
            isPrintStation(equipment.station || '') &&
            visibleStations.includes(equipment.station as PrintStation)
        )
        .map((equipment) => ({
          equipment,
          live: liveEquipmentStatus[equipment.id] || null,
          activeJob:
            filteredActiveRipJobs.find(
              (job) =>
                job.equipment?.id === equipment.id ||
                job.hotfolderName.toLowerCase() === equipment.name.toLowerCase()
            ) || null,
        })),
    [printEquipment, liveEquipmentStatus, filteredActiveRipJobs, visibleStations]
  );

  const activeRipJobByOrderId = useMemo(() => {
    const next: Record<string, RipJobSummary> = {};
    for (const job of filteredActiveRipJobs) {
      const orderId = job.workOrder?.id || job.workOrderId;
      if (orderId && !next[orderId]) {
        next[orderId] = job;
      }
    }
    return next;
  }, [filteredActiveRipJobs]);

  const autoSelectedSendCandidate = sendCandidates[0] || null;
  const selectedSendCandidate =
    selectedSendCandidateId === AUTO_SEND_CANDIDATE_ID
      ? autoSelectedSendCandidate
      : sendCandidates.find((candidate) => candidate.id === selectedSendCandidateId) || null;

  const sendHotfolderOptions = useMemo(() => {
    if (!sendToRipOrder) return filteredHotfolders;

    const orderStations = getOrderPrintStations(sendToRipOrder).filter((station) =>
      userStations.includes(station)
    );
    const matching = filteredHotfolders.filter(
      (hotfolder) => isPrintStation(hotfolder.station) && orderStations.includes(hotfolder.station)
    );

    return matching.length > 0 ? matching : filteredHotfolders;
  }, [sendToRipOrder, filteredHotfolders, userStations]);

  const selectedHotfolder =
    sendHotfolderOptions.find((hotfolder) => hotfolder.id === selectedHotfolderId) || null;

  useEffect(() => {
    if (sendToRipOrder && !selectedHotfolderId && sendHotfolderOptions[0]) {
      setSelectedHotfolderId(sendHotfolderOptions[0].id);
    }
  }, [sendToRipOrder, selectedHotfolderId, sendHotfolderOptions]);

  useEffect(() => {
    if (!sendToRipOrder) return;

    let payload: Record<string, unknown> | null = null;
    if (selectedSendCandidateId === 'manual') {
      const trimmedManualPath = manualSourcePath.trim();
      if (!trimmedManualPath) {
        setSendValidation(null);
        return;
      }
      payload = { filePath: trimmedManualPath };
    } else if (selectedSendCandidateId === AUTO_SEND_CANDIDATE_ID) {
      payload = { workOrderId: sendToRipOrder.id };
    } else if (selectedSendCandidate?.attachmentId) {
      payload = {
        workOrderId: sendToRipOrder.id,
        attachmentId: selectedSendCandidate.attachmentId,
      };
    } else if (selectedSendCandidate?.sourceFilePath) {
      payload = { filePath: selectedSendCandidate.sourceFilePath };
    } else {
      setSendValidation(null);
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(
      async () => {
        try {
          const validation = await fetchJson<RipFileValidation>('/rip-queue/validate-file', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
          if (!cancelled) setSendValidation(validation);
        } catch (err: any) {
          if (!cancelled) {
            setSendValidation({ valid: false, error: err.message || 'Validation failed' });
          }
        }
      },
      selectedSendCandidateId === 'manual' ? 250 : 0
    );

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [fetchJson, manualSourcePath, selectedSendCandidate, selectedSendCandidateId, sendToRipOrder]);

  const canSendToRip =
    Boolean(sendToRipOrder) &&
    Boolean(selectedHotfolderId) &&
    (selectedSendCandidateId === 'manual'
      ? Boolean(manualSourcePath.trim())
      : selectedSendCandidateId === AUTO_SEND_CANDIDATE_ID
        ? true
        : Boolean(selectedSendCandidate)) &&
    Boolean(sendValidation?.valid);

  const handleSendToRip = useCallback(async () => {
    if (!sendToRipOrder) return;
    if (!selectedHotfolderId) {
      toast.error('Select a printer hotfolder first');
      return;
    }

    const payload: Record<string, unknown> = {
      workOrderId: sendToRipOrder.id,
      hotfolderId: selectedHotfolderId,
      copies: sendCopies,
      notes: sendNotes || undefined,
    };

    if (selectedSendCandidateId === 'manual') {
      payload.sourceFilePath = manualSourcePath.trim();
    } else if (selectedSendCandidateId === AUTO_SEND_CANDIDATE_ID) {
      // Let the server pick the best accessible file linked to this work order.
    } else if (selectedSendCandidate?.attachmentId) {
      payload.attachmentId = selectedSendCandidate.attachmentId;
    } else if (selectedSendCandidate?.sourceFilePath) {
      payload.sourceFilePath = selectedSendCandidate.sourceFilePath;
    } else {
      toast.error('Choose a source file first');
      return;
    }

    setSendingToRip(true);
    try {
      await fetchJson('/rip-queue/jobs', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      toast.success(`Submitted ${sendToRipOrder.orderNumber} to RIP`);
      closeSendToRipModal();
      fetchPrintingOperations();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send to RIP');
    } finally {
      setSendingToRip(false);
    }
  }, [
    closeSendToRipModal,
    fetchJson,
    fetchPrintingOperations,
    manualSourcePath,
    selectedHotfolderId,
    selectedSendCandidate,
    selectedSendCandidateId,
    sendCopies,
    sendNotes,
    sendToRipOrder,
  ]);

  // ─── Detail View ────────────────────────────────────

  if (detailOrder) {
    return (
      <OrderDetailPanel
        order={detailOrder}
        userStations={userStations}
        selectedStation={selectedStation === 'ALL' ? null : selectedStation}
        isUpdating={updatingOrder === detailOrder.id}
        wsStatus={wsStatus}
        activeRipJob={activeRipJobByOrderId[detailOrder.id] || null}
        onStart={startStation}
        onComplete={completeStation}
        onUncomplete={uncompleteStation}
        onSendToRip={openSendToRipModal}
        onBack={() => setDetailOrder(null)}
      />
    );
  }

  // ─── Render Helpers ─────────────────────────────────

  const renderOrderCard = (order: WorkOrder, station?: PrintStation) => {
    const actionStation = station || getActivePrintStation(order, userStations);
    const progress = actionStation
      ? order.stationProgress.find((sp) => sp.station === actionStation)
      : null;
    const stationStatus = actionStation ? getStationStatus(order, actionStation) : 'NOT_STARTED';
    const startedAtLabel =
      stationStatus === 'IN_PROGRESS' && progress?.startedAt
        ? ` - started ${formatDate(progress.startedAt)}`
        : '';
    const stationWasInferred = actionStation ? !order.routing.includes(actionStation) : false;
    const overdue = isOverdue(order.dueDate);
    const dueToday = isDueToday(order.dueDate);
    const isExpanded = expandedOrder === order.id;
    const isUpdating = updatingOrder === order.id;
    const activeRipJob = activeRipJobByOrderId[order.id] || null;
    const pri = PRIORITY_CONFIG[order.priority] || PRIORITY_CONFIG[3];
    const routingDisplay = sortRouting(
      order.routing.length > 0 ? order.routing : getOrderPrintStations(order)
    );

    return (
      <div
        key={order.id}
        className={`bg-white rounded-lg border transition-shadow hover:shadow-md ${
          overdue && stationStatus !== 'COMPLETED'
            ? 'border-red-200 bg-red-50/30'
            : 'border-gray-200'
        }`}
      >
        {/* Clickable main area — opens detail */}
        <button
          className="w-full text-left p-4 focus:outline-none focus:ring-2 focus:ring-blue-300 rounded-t-lg"
          onClick={() => setDetailOrder(order)}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="font-semibold text-gray-900 font-mono">{order.orderNumber}</span>
                <span
                  className={`px-2 py-0.5 text-xs font-bold rounded-full ${pri.color} ${pri.textColor}`}
                >
                  {pri.label}
                </span>
                {overdue && stationStatus !== 'COMPLETED' && (
                  <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">
                    <AlertTriangle className="h-3 w-3" /> Overdue
                  </span>
                )}
                {dueToday && !overdue && (
                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
                    Due Today
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 truncate">{order.customerName}</p>
              {order.description && (
                <p className="text-xs text-gray-500 truncate mt-0.5">{order.description}</p>
              )}
              <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Due: {formatDate(order.dueDate)}
                </span>
                {order.assignedTo && (
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" /> {order.assignedTo.displayName}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Package className="h-3 w-3" /> {order.lineItems?.length || 0} items
                </span>
              </div>
              {/* Routing station badges in ALL view */}
              {selectedStation === 'ALL' && (
                <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                  {getOrderPrintStations(order).map((st) => {
                    const stStatus = getStationStatus(order, st);
                    const cfg = STATION_CONFIG[st];
                    return (
                      <span
                        key={st}
                        className={`px-2 py-0.5 text-xs rounded-full flex items-center gap-1 ${
                          stStatus === 'COMPLETED'
                            ? 'bg-green-100 text-green-700'
                            : stStatus === 'IN_PROGRESS'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {stStatus === 'COMPLETED' ? (
                          <CheckCircle className="h-3 w-3" />
                        ) : stStatus === 'IN_PROGRESS' ? (
                          <PlayCircle className="h-3 w-3" />
                        ) : (
                          <Circle className="h-3 w-3" />
                        )}
                        {cfg?.label || st}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
            <ChevronRight className="h-5 w-5 text-gray-300 flex-shrink-0 mt-1" />
          </div>
        </button>

        {/* Action bar: Start / Complete buttons always visible */}
        {actionStation && (
          <div className="px-4 pb-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-2">
            <div className="min-w-0">
              <div className={`text-xs ${stationWasInferred ? 'text-amber-600' : 'text-gray-500'}`}>
                {STATION_CONFIG[actionStation as PrintStation]?.label || actionStation}
                {stationWasInferred ? ' - inferred from order details' : startedAtLabel}
              </div>
              {activeRipJob && (
                <div className="mt-1 flex items-center gap-2 text-xs text-indigo-700">
                  <span
                    className={`px-2 py-0.5 rounded-full ${getRipStatusClasses(activeRipJob.status)}`}
                  >
                    {activeRipJob.status.replace(/_/g, ' ')}
                  </span>
                  <span className="truncate">{activeRipJob.hotfolderName}</span>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {stationStatus === 'NOT_STARTED' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startStation(order.id, actionStation);
                  }}
                  disabled={isUpdating}
                  className="px-4 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  <PlayCircle className="h-4 w-4" /> Start
                </button>
              )}
              {stationStatus === 'IN_PROGRESS' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    completeStation(order.id, actionStation);
                  }}
                  disabled={isUpdating}
                  className="px-4 py-1.5 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  <CheckCircle className="h-4 w-4" /> Complete
                </button>
              )}
              {stationStatus === 'COMPLETED' && (
                <span className="text-sm text-green-600 flex items-center gap-1">
                  <CheckCircle className="h-4 w-4" /> Done
                </span>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleMarkComplete(order.id, order.orderNumber);
                }}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-green-600 hover:bg-green-50 rounded-lg"
                title="Mark order complete"
              >
                <CheckCircle className="w-4 h-4" />
                Done
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openSendToRipModal(order);
                }}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg"
                title="Send file to RIP"
              >
                <Send className="w-4 h-4" />
                Send
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setRevisionOrderId(order.id);
                  setRevisionOrderNumber(order.orderNumber);
                  setShowRevisionModal(true);
                }}
                className="flex items-center gap-1 px-2 py-1 text-sm text-orange-600 hover:bg-orange-50 rounded"
                title="Send back to Design"
              >
                <Undo2 className="w-3.5 h-3.5" />
                Revision
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedOrder(isExpanded ? null : order.id);
                }}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Quick peek"
              >
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        )}

        {/* Expanded inline details */}
        {isExpanded && (
          <div className="px-4 pb-4 border-t border-gray-100">
            <div className="pt-3">
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                Routing Progress
              </h4>
              <div className="flex items-center gap-1 flex-wrap mb-3">
                {routingDisplay.map((st, idx) => {
                  const stStatus = getStationStatus(order, st);
                  const label = ALL_STATION_LABELS[st] || st.replace(/_/g, ' ');
                  return (
                    <div key={st} className="flex items-center">
                      {idx > 0 && <div className="w-4 h-0.5 bg-gray-200 mx-0.5" />}
                      <span
                        className={`px-2.5 py-1 text-xs rounded-lg font-medium flex items-center gap-1 ${
                          stStatus === 'COMPLETED'
                            ? 'bg-green-100 text-green-700 border border-green-200'
                            : stStatus === 'IN_PROGRESS'
                              ? 'bg-blue-100 text-blue-700 border border-blue-200'
                              : 'bg-gray-100 text-gray-500 border border-gray-200'
                        }`}
                      >
                        {stStatus === 'COMPLETED' ? (
                          <CheckCircle className="h-3 w-3" />
                        ) : stStatus === 'IN_PROGRESS' ? (
                          <PlayCircle className="h-3 w-3" />
                        ) : (
                          <Circle className="h-3 w-3" />
                        )}
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>
              {order.notes && (
                <div className="flex items-start gap-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 mb-3">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-500" />
                  <span>{order.notes}</span>
                </div>
              )}
              {order.lineItems && order.lineItems.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Line Items</h4>
                  <div className="space-y-1">
                    {order.lineItems.map((item) => {
                      const stationKey = (station ||
                        getActivePrintStation(order, userStations)) as string;
                      return (
                        <label
                          key={item.id}
                          className="flex items-center gap-2 py-1 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={completions[item.id]?.[stationKey] || false}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleLineItemComplete(order.id, item.id, stationKey);
                            }}
                            className="w-4 h-4 text-blue-600 rounded"
                          />
                          <span
                            className={`text-xs flex-1 truncate ${completions[item.id]?.[stationKey] ? 'line-through text-gray-400' : 'text-gray-600'}`}
                          >
                            {item.description || item.itemMaster?.name || 'Item'}
                          </span>
                          <span className="text-xs font-medium">Qty: {item.quantity}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderSection = (
    title: string,
    sectionOrders: WorkOrder[],
    icon: React.ReactNode,
    bgColor: string,
    station?: PrintStation
  ) => {
    if (sectionOrders.length === 0) return null;
    return (
      <div className="space-y-2">
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${bgColor}`}>
          {icon}
          <span className="font-medium text-sm">{title}</span>
          <span className="text-sm opacity-70">({sectionOrders.length})</span>
        </div>
        <div className="space-y-2">
          {sectionOrders.map((order) => renderOrderCard(order, station))}
        </div>
      </div>
    );
  };

  // ─── Main Render ────────────────────────────────────

  if (loading && orders.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="bg-white border-b px-4 py-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Printer className="w-5 h-5 text-blue-600" />
            <h2 className="font-semibold text-gray-900">Print Queue</h2>
            <span className="text-sm text-gray-500">
              {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''}
              {selectedStation !== 'ALL' && ` at ${STATION_CONFIG[selectedStation]?.label}`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`p-1 rounded-full ${wsStatus === 'connected' ? 'text-green-500' : 'text-gray-300'}`}
              title={wsStatus === 'connected' ? 'Live updates active' : 'Reconnecting...'}
            >
              {wsStatus === 'connected' ? (
                <Wifi className="w-4 h-4" />
              ) : (
                <WifiOff className="w-4 h-4" />
              )}
            </div>
            <button
              onClick={() => {
                fetchOrders();
                fetchPrintingOperations();
              }}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading || operationsLoading ? 'animate-spin' : ''}`}
              />{' '}
              Refresh
            </button>
            <button
              onClick={async () => {
                const ordersMissingPrint = filteredOrders.filter((o) => {
                  const printStations = ['ROLL_TO_ROLL', 'FLATBED'];
                  return !o.routing.some((s) => printStations.includes(s));
                });
                if (ordersMissingPrint.length === 0) {
                  alert('All visible orders already have printing routes');
                  return;
                }
                try {
                  const res = (await fetchJson('/api/v1/orders/batch/fix-printing-routing', {
                    method: 'POST',
                    body: JSON.stringify({ orderIds: ordersMissingPrint.map((o) => o.id) }),
                  })) as { fixed: number };
                  alert(
                    `Fixed ${res.fixed} order${res.fixed !== 1 ? 's' : ''} - adding ROLL_TO_ROLL & FLATBED`
                  );
                  fetchOrders();
                } catch (err: any) {
                  alert(`Error fixing routes: ${err.message}`);
                }
              }}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-amber-600 hover:bg-amber-50 rounded-lg"
              title="Add missing printing stations to visible orders"
            >
              <Wrench className="w-4 h-4" /> Fix Routes
            </button>
            {selectedStation === PrintingMethod.FLATBED && (
              <button
                onClick={async () => {
                  setSendingBatchRip(true);
                  try {
                    const res = (await fetchJson('/rip-queue/batches/hh-global', {
                      method: 'POST',
                    })) as { success: boolean; batchesSubmitted: number; jobsCreated: number };
                    if (res.success) {
                      toast.success(
                        `Submitted ${res.batchesSubmitted} batch${res.batchesSubmitted !== 1 ? 'es' : ''} (${res.jobsCreated} job${res.jobsCreated !== 1 ? 's' : ''})`
                      );
                      fetchOrders();
                      fetchPrintingOperations();
                    } else {
                      toast.error('Failed to submit batches');
                    }
                  } catch (err: any) {
                    toast.error(`Error: ${err.message}`);
                  } finally {
                    setSendingBatchRip(false);
                  }
                }}
                disabled={sendingBatchRip}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg disabled:opacity-50"
                title="Submit HH Global orders as material batches to Fiery RIP"
              >
                {sendingBatchRip ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Send Batched HH Global
              </button>
            )}
          </div>
        </div>

        {/* Station selector cards */}
        <div className={`grid gap-3 ${userStations.length >= 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
          {userStations.map((station) => {
            const stats = stationStats[station];
            const cfg = STATION_CONFIG[station];
            const isSelected = selectedStation === station;
            return (
              <button
                key={station}
                onClick={() => setSelectedStation(isSelected ? 'ALL' : station)}
                className={`p-3 rounded-xl border-2 transition-all text-left ${
                  isSelected
                    ? `${cfg.bg} ${cfg.border} ring-2 ring-offset-1 ${cfg.ring}`
                    : 'bg-white border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Printer className={`h-4 w-4 ${isSelected ? cfg.icon : 'text-gray-400'}`} />
                  <span
                    className={`font-semibold text-sm ${isSelected ? cfg.color : 'text-gray-700'}`}
                  >
                    {cfg.label}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1 text-gray-500">
                    <Circle className="h-3 w-3 text-gray-400" /> {stats?.notStarted || 0}
                  </span>
                  <span className="flex items-center gap-1 text-blue-600">
                    <PlayCircle className="h-3 w-3" /> {stats?.inProgress || 0}
                  </span>
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle className="h-3 w-3" /> {stats?.completed || 0}
                  </span>
                </div>
                {(stats?.overdue || 0) > 0 && (
                  <div className="mt-1.5 flex items-center gap-1 text-xs text-red-600">
                    <AlertTriangle className="h-3 w-3" /> {stats.overdue} overdue
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* All stations button */}
        <button
          onClick={() => setSelectedStation('ALL')}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
            selectedStation === 'ALL'
              ? 'bg-gray-900 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          All Stations
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
          <button onClick={fetchOrders} className="ml-auto text-xs underline hover:no-underline">
            Retry
          </button>
        </div>
      )}

      {operationsError && (
        <div className="mx-4 mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-amber-800 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {operationsError}
          <button
            onClick={fetchPrintingOperations}
            className="ml-auto text-xs underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Tab bar */}
      <div className="bg-white border-b flex items-center gap-1 px-4 overflow-x-auto">
        {(
          [
            { key: 'orders', label: 'Orders', icon: <List className="w-3.5 h-3.5" /> },
            {
              key: 'rip-dashboard',
              label: 'RIP Dashboard',
              icon: <Activity className="w-3.5 h-3.5" />,
            },
            { key: 'rip-jobs', label: 'RIP Jobs', icon: <FileText className="w-3.5 h-3.5" /> },
            { key: 'send', label: 'Send to RIP', icon: <Send className="w-3.5 h-3.5" /> },
          ] as const
        ).map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {icon}
            {label}
            {key === 'orders' && (
              <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
                {filteredOrders.length}
              </span>
            )}
            {key === 'rip-jobs' && filteredActiveRipJobs.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-indigo-100 text-indigo-700">
                {filteredActiveRipJobs.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 min-h-0 overflow-auto">
        {/* ── Orders Tab ── */}
        {activeTab === 'orders' && (
          <>
            {/* Orders sub-toolbar */}
            <div className="bg-white border-b px-4 py-2 flex items-center gap-3 flex-wrap">
              <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                <button
                  onClick={() => setViewMode('orders')}
                  className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    viewMode === 'orders'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <List className="w-3.5 h-3.5" /> Orders
                </button>
                <button
                  onClick={() => setViewMode('material')}
                  className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    viewMode === 'material'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" /> Material
                </button>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showCompleted}
                  onChange={(e) => setShowCompleted(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Show completed
              </label>
            </div>

            {viewMode === 'material' ? (
              <div className="p-4 space-y-4">
                {Object.entries(materialGroups).map(([material, items]) => (
                  <div
                    key={material}
                    className="bg-white rounded-lg border border-gray-200 overflow-hidden"
                  >
                    <div className="bg-blue-50 px-4 py-2 border-b flex items-center justify-between">
                      <span className="font-semibold text-blue-900">{material}</span>
                      <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                        {items.length} item{items.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="divide-y">
                      {items.map(({ lineItem: li, order }) => (
                        <label
                          key={li.id}
                          className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={completions[li.id]?.[activeStation] || false}
                            onChange={() => toggleLineItemComplete(order.id, li.id, activeStation)}
                            className="w-4 h-4 text-blue-600 rounded"
                          />
                          <span
                            className={
                              completions[li.id]?.[activeStation]
                                ? 'line-through text-gray-400 text-sm'
                                : 'text-sm'
                            }
                          >
                            {li.description || li.itemMaster?.name || 'Item'}
                          </span>
                          <span className="text-xs text-gray-400 ml-auto">
                            {order.orderNumber} · Qty: {li.quantity}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
                {Object.keys(materialGroups).length === 0 && (
                  <div className="text-center py-12 text-gray-400">
                    <Layers className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-lg font-medium text-gray-900 mb-1">No line items to group</p>
                    <p className="text-sm text-gray-500">
                      {filteredOrders.length === 0
                        ? 'No orders in queue'
                        : 'No line items found in the current orders'}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4">
                {filteredOrders.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-lg font-medium text-gray-900 mb-1">No orders in queue</p>
                    <p className="text-sm text-gray-500">
                      {selectedStation !== 'ALL'
                        ? `No active orders at ${STATION_CONFIG[selectedStation]?.label}`
                        : 'No active orders with print stations in routing'}
                    </p>
                  </div>
                ) : selectedStation === 'ALL' ? (
                  <div className="space-y-2">
                    {filteredOrders.map((order) => renderOrderCard(order))}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {renderSection(
                      'In Progress',
                      groupedOrders.inProgress || [],
                      <PlayCircle className="h-5 w-5 text-blue-600" />,
                      'bg-blue-50 text-blue-700',
                      selectedStation
                    )}
                    {renderSection(
                      'Waiting to Start',
                      groupedOrders.notStarted || [],
                      <Clock className="h-5 w-5 text-gray-600" />,
                      'bg-gray-100 text-gray-700',
                      selectedStation
                    )}
                    {showCompleted &&
                      renderSection(
                        'Completed',
                        groupedOrders.completed || [],
                        <CheckCircle className="h-5 w-5 text-green-600" />,
                        'bg-green-50 text-green-700',
                        selectedStation
                      )}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ── RIP Dashboard Tab ── */}
        {activeTab === 'rip-dashboard' && (
          <PrintingOperationsSidebar
            visibleStations={visibleStations}
            operationsLoading={operationsLoading}
            hotfolders={filteredHotfolders}
            thriveStatus={thriveStatus}
            ripDashboard={ripDashboard}
            activeJobs={filteredActiveRipJobs}
            printerCards={printerCards}
            onRefresh={fetchPrintingOperations}
          />
        )}

        {/* ── RIP Jobs Tab ── */}
        {activeTab === 'rip-jobs' && (
          <RipJobsPanel
            activeJobs={filteredActiveRipJobs}
            recentCompleted={ripDashboard?.recentCompleted ?? []}
            operationsLoading={operationsLoading}
            onRefresh={fetchPrintingOperations}
            onSendToRip={(order) => {
              const matchedOrder = orders.find((o) => o.id === order.id);
              if (matchedOrder) openSendToRipModal(matchedOrder);
            }}
          />
        )}

        {/* ── Send to RIP Tab ── */}
        {activeTab === 'send' && (
          <div className="p-4 max-w-2xl mx-auto">
            {!sendToRipOrder ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-500">
                  Select an order from the Orders tab to send to RIP, or pick one below.
                </p>
                <div className="space-y-2">
                  {filteredOrders.slice(0, 20).map((order) => (
                    <button
                      key={order.id}
                      onClick={() => openSendToRipModal(order)}
                      className="w-full text-left rounded-lg border border-gray-200 px-4 py-3 hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 font-mono">
                            {order.orderNumber}
                          </p>
                          <p className="text-xs text-gray-500 truncate">{order.customerName}</p>
                        </div>
                        <Send className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                      </div>
                    </button>
                  ))}
                  {filteredOrders.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-8">No orders in queue</p>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Send to RIP</h3>
                    <p className="text-sm text-gray-500">
                      {sendToRipOrder.orderNumber} · {sendToRipOrder.customerName}
                    </p>
                  </div>
                  <button
                    onClick={closeSendToRipModal}
                    className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                  >
                    ← Back
                  </button>
                </div>

                <div className="space-y-5">
                  <section className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                      <FileText className="w-4 h-4 text-indigo-600" />
                      Source file
                    </div>

                    {sendCandidatesLoading ? (
                      <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-3">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading order files...
                      </div>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <button
                            onClick={() => {
                              setSelectedSendCandidateId(AUTO_SEND_CANDIDATE_ID);
                              setShowManualPathFallback(false);
                            }}
                            className={`w-full text-left rounded-lg border px-3 py-3 transition-colors ${
                              selectedSendCandidateId === AUTO_SEND_CANDIDATE_ID
                                ? 'border-indigo-400 bg-indigo-50'
                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900">
                                  Auto-select best order file
                                </p>
                                <p className="text-xs text-gray-500 truncate">
                                  {autoSelectedSendCandidate
                                    ? `${autoSelectedSendCandidate.label} · ${autoSelectedSendCandidate.detail}`
                                    : 'Use the best accessible linked file or attachment on this order'}
                                </p>
                              </div>
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                                AUTO
                              </span>
                            </div>
                          </button>

                          {sendCandidates.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 px-1">
                                Choose a specific linked file
                              </p>
                              {sendCandidates.map((candidate) => (
                                <button
                                  key={candidate.id}
                                  onClick={() => {
                                    setSelectedSendCandidateId(candidate.id);
                                    setShowManualPathFallback(false);
                                  }}
                                  className={`w-full text-left rounded-lg border px-3 py-3 transition-colors ${
                                    selectedSendCandidateId === candidate.id
                                      ? 'border-indigo-400 bg-indigo-50'
                                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium text-gray-900 truncate">
                                        {candidate.label}
                                      </p>
                                      <p className="text-xs text-gray-500 truncate">
                                        {candidate.detail}
                                      </p>
                                    </div>
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                                      {candidate.fileTypeLabel}
                                    </span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}

                          {!showManualPathFallback && (
                            <button
                              onClick={() => {
                                setSelectedSendCandidateId('manual');
                                setShowManualPathFallback(true);
                              }}
                              className="text-sm text-indigo-700 hover:text-indigo-800 font-medium"
                            >
                              Use a custom network path instead
                            </button>
                          )}
                        </div>

                        {showManualPathFallback && (
                          <div className="space-y-2">
                            <button
                              onClick={() => setSelectedSendCandidateId('manual')}
                              className={`w-full text-left rounded-lg border px-3 py-3 transition-colors ${
                                selectedSendCandidateId === 'manual'
                                  ? 'border-indigo-400 bg-indigo-50'
                                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-gray-900">
                                    Manual network path
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    Only needed when the order has no usable linked files
                                  </p>
                                </div>
                                <FolderOpen className="w-4 h-4 text-gray-400" />
                              </div>
                            </button>

                            {selectedSendCandidateId === 'manual' && (
                              <input
                                type="text"
                                value={manualSourcePath}
                                onChange={(e) => setManualSourcePath(e.target.value)}
                                placeholder="\\\\server\\share\\Customer\\WO####\\PRINT\\file.pdf"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                              />
                            )}

                            {selectedSendCandidateId === 'manual' && sendCandidates.length > 0 && (
                              <button
                                onClick={() => {
                                  setSelectedSendCandidateId(AUTO_SEND_CANDIDATE_ID);
                                  setShowManualPathFallback(false);
                                }}
                                className="text-sm text-gray-600 hover:text-gray-800"
                              >
                                Back to automatic file selection
                              </button>
                            )}
                          </div>
                        )}
                      </>
                    )}

                    {sendCandidatesError && (
                      <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        {sendCandidatesError}
                      </div>
                    )}

                    {sendValidation && (
                      <div
                        className={`text-sm rounded-lg px-3 py-2 border ${
                          sendValidation.valid
                            ? 'bg-green-50 border-green-200 text-green-700'
                            : 'bg-red-50 border-red-200 text-red-700'
                        }`}
                      >
                        {sendValidation.valid
                          ? `Ready: ${sendValidation.fileName || 'Selected file'} (${formatFileSize(sendValidation.size)})`
                          : sendValidation.error || 'File validation failed'}
                        {sendValidation.resolvedPath && (
                          <p className="mt-1 text-xs font-mono break-all text-current/80">
                            {sendValidation.resolvedPath}
                          </p>
                        )}
                      </div>
                    )}
                  </section>

                  <section className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                      <HardDrive className="w-4 h-4 text-blue-600" />
                      Select hotfolder
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {sendHotfolderOptions.map((hotfolder) => {
                        const machineStatus = thriveStatus?.status?.[hotfolder.machineId];
                        const jobCount = filteredActiveRipJobs.filter(
                          (job) => job.hotfolderName.toLowerCase() === hotfolder.name.toLowerCase()
                        ).length;
                        return (
                          <button
                            key={hotfolder.id}
                            onClick={() => setSelectedHotfolderId(hotfolder.id)}
                            className={`rounded-lg border px-3 py-3 text-left transition-colors ${
                              selectedHotfolderId === hotfolder.id
                                ? 'border-indigo-400 bg-indigo-50'
                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {hotfolder.name}
                                </p>
                                <p className="text-xs text-gray-500 truncate">
                                  {hotfolder.ripType} · {hotfolder.machineName}
                                </p>
                              </div>
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                  machineStatus?.online
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-red-100 text-red-700'
                                }`}
                              >
                                {machineStatus?.online
                                  ? jobCount > 0
                                    ? `Busy ${jobCount}`
                                    : 'Ready'
                                  : 'Offline'}
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-400 truncate mt-2">
                              {hotfolder.path}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                    {sendHotfolderOptions.length === 0 && (
                      <div className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-3">
                        No matching hotfolders are configured for the selected print stations.
                      </div>
                    )}
                  </section>

                  {selectedHotfolder?.ripType === 'Fiery' && (
                    <section className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                        <Printer className="w-4 h-4 text-violet-600" />
                        Fiery import readiness
                      </div>
                      <p className="text-xs text-gray-500">
                        Files are copied into the Fiery hotfolder and imported with the
                        controller defaults. The diagnostics below are informational only.
                      </p>

                      {!fieryDiagnostics ? (
                        <div className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-3">
                          Loading Fiery diagnostics...
                        </div>
                      ) : (
                        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            <div className="rounded-lg border border-gray-200 px-3 py-2">
                              <p className="text-[11px] uppercase tracking-wide text-gray-500">
                                Share
                              </p>
                              <p
                                className={`mt-1 text-sm font-semibold ${
                                  fieryDiagnostics.share.accessible && fieryDiagnostics.share.writable
                                    ? 'text-green-700'
                                    : 'text-red-700'
                                }`}
                              >
                                {fieryDiagnostics.share.accessible && fieryDiagnostics.share.writable
                                  ? 'Writable'
                                  : fieryDiagnostics.share.accessible
                                    ? 'Read only'
                                    : 'Offline'}
                              </p>
                            </div>
                            <div className="rounded-lg border border-gray-200 px-3 py-2">
                              <p className="text-[11px] uppercase tracking-wide text-gray-500">
                                Diagnostics
                              </p>
                              <p
                                className={`mt-1 text-sm font-semibold ${
                                  fieryDiagnostics.jmf.discoveredUrl ? 'text-green-700' : 'text-red-700'
                                }`}
                              >
                                {fieryDiagnostics.jmf.autoDiscovered ? 'Auto-discovered' : 'Fallback URL'}
                              </p>
                            </div>
                            <div className="rounded-lg border border-gray-200 px-3 py-2">
                              <p className="text-[11px] uppercase tracking-wide text-gray-500">
                                Queue
                              </p>
                              <p className="mt-1 text-sm font-semibold text-gray-900">
                                {fieryDiagnostics.queue.status} · {fieryDiagnostics.queue.queueSize}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                                Controller defaults
                              </p>
                              <p className="mt-1 font-medium text-gray-900">
                                {fieryDiagnostics.workflow.outputChannelName || 'Using Fiery defaults'}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                {fieryDiagnostics.workflow.colorMode || 'Unknown'} ·{' '}
                                {fieryDiagnostics.workflow.inkType || 'Unknown'}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                                Media
                              </p>
                              <p className="mt-1 font-medium text-gray-900">
                                {fieryDiagnostics.media.media || 'Not configured'}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                {fieryDiagnostics.media.mediaDimension || 'No size'} ·{' '}
                                {fieryDiagnostics.media.resolution || 'No resolution'}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-1 text-xs text-gray-500">
                            <p className="font-mono break-all">{fieryDiagnostics.jmf.discoveredUrl}</p>
                            <p className="font-mono break-all">{fieryDiagnostics.share.path}</p>
                          </div>

                          {(fieryDiagnostics.share.error || fieryDiagnostics.workflow.discoveryError) && (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                              {fieryDiagnostics.share.error ||
                                fieryDiagnostics.workflow.discoveryError ||
                                'Fiery diagnostics need attention'}
                          </div>
                          )}

                          {fieryDiagnostics.workflow.hint && (
                            <p className="text-xs text-gray-500">{fieryDiagnostics.workflow.hint}</p>
                          )}
                        </div>
                      )}
                    </section>
                  )}

                  <section className="grid grid-cols-1 md:grid-cols-[10rem_minmax(0,1fr)] gap-4">
                    <label className="block">
                      <span className="text-sm font-medium text-gray-700">Copies</span>
                      <input
                        type="number"
                        min={1}
                        value={sendCopies}
                        onChange={(e) => setSendCopies(Math.max(1, Number(e.target.value) || 1))}
                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm font-medium text-gray-700">Operator notes</span>
                      <textarea
                        value={sendNotes}
                        onChange={(e) => setSendNotes(e.target.value)}
                        placeholder="Optional RIP notes, media reminders, or printer instructions"
                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none h-20"
                      />
                    </label>
                  </section>
                </div>

                <div className="flex items-center justify-end gap-3 mt-6">
                  <button
                    onClick={closeSendToRipModal}
                    className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={handleSendToRip}
                    disabled={!canSendToRip || sendingToRip}
                    className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {sendingToRip ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    Send to RIP
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showRevisionModal && revisionOrderId && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowRevisionModal(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-gray-900 mb-1">Send Back to Design</h3>
            <p className="text-sm text-gray-500 mb-4">{revisionOrderNumber}</p>

            <p className="text-sm font-medium text-gray-700 mb-2">Reason:</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {[
                { value: 'WRONG_SIZE', label: 'Wrong Size' },
                { value: 'COLORS_OFF', label: 'Colors Off' },
                { value: 'WRONG_MATERIAL', label: 'Wrong Material' },
                { value: 'LAYOUT_ISSUE', label: 'Layout Issue' },
                { value: 'TEXT_ERROR', label: 'Text Error' },
                { value: 'FILE_CORRUPT', label: 'File Corrupt' },
                { value: 'OTHER', label: 'Other' },
              ].map((r) => (
                <button
                  key={r.value}
                  onClick={() => setRevisionReason(r.value)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    revisionReason === r.value
                      ? 'bg-orange-100 text-orange-800 ring-2 ring-orange-400'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <textarea
              value={revisionNotes}
              onChange={(e) => setRevisionNotes(e.target.value)}
              placeholder="Additional notes (optional)..."
              className="w-full border border-gray-300 rounded-lg p-3 text-sm resize-none h-20 mb-4"
            />

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRevisionModal(false);
                  setRevisionReason('');
                  setRevisionNotes('');
                }}
                className="flex-1 px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!revisionReason) {
                    toast.error('Please select a reason');
                    return;
                  }
                  try {
                    const res = await fetch(
                      `${config.apiUrl}/orders/${revisionOrderId}/revision-request`,
                      {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify({
                          reason: revisionReason,
                          notes: revisionNotes || undefined,
                        }),
                      }
                    );
                    if (!res.ok) throw new Error(`API ${res.status}`);
                    toast.success('Sent back to Design');
                    setShowRevisionModal(false);
                    setRevisionReason('');
                    setRevisionNotes('');
                  } catch {
                    toast.error('Failed to send revision request');
                  }
                }}
                disabled={!revisionReason}
                className="flex-1 px-4 py-2 text-sm text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50"
              >
                Send to Design
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────
// Order Detail Panel — full-screen view for a single order
// ────────────────────────────────────────────────────────

function OrderDetailPanel({
  order,
  userStations,
  selectedStation,
  isUpdating,
  wsStatus,
  activeRipJob,
  onStart,
  onComplete,
  onUncomplete,
  onSendToRip,
  onBack,
}: {
  order: WorkOrder;
  userStations: PrintStation[];
  selectedStation: PrintStation | null;
  isUpdating: boolean;
  wsStatus: WsStatus;
  activeRipJob: RipJobSummary | null;
  onStart: (orderId: string, station: string) => void;
  onComplete: (orderId: string, station: string) => void;
  onUncomplete: (orderId: string, station: string) => void;
  onSendToRip: (order: WorkOrder) => void;
  onBack: () => void;
}) {
  const dueDate = order.dueDate ? new Date(order.dueDate) : null;
  const overdue = dueDate ? dueDate < new Date() : false;
  const pri = PRIORITY_CONFIG[order.priority] || PRIORITY_CONFIG[3];
  const orderPrintStations = getOrderPrintStations(order);
  const routingDisplay = sortRouting(order.routing.length > 0 ? order.routing : orderPrintStations);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-blue-600 text-white">
        <div className="flex items-center gap-3 px-4 pt-3 pb-2">
          <button
            onClick={onBack}
            className="p-1.5 -ml-1 rounded-full hover:bg-white/20 active:bg-white/30"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold">{order.orderNumber}</h2>
              {order.priority <= 2 && (
                <span className="px-1.5 py-0.5 bg-red-500/90 text-white text-[10px] font-bold rounded uppercase">
                  {pri.label}
                </span>
              )}
            </div>
            <p className="text-white/80 text-sm truncate">{order.customerName}</p>
          </div>
          {dueDate && (
            <div
              className={`text-right text-xs px-2 py-1 rounded-lg ${overdue ? 'bg-red-600/50 text-red-100 font-bold' : 'bg-white/10 text-white/80'}`}
            >
              <Clock className="w-3 h-3 inline mr-1" />
              {overdue
                ? 'OVERDUE'
                : dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
          )}
          {!dueDate && <span className="text-xs text-white/50">No due date</span>}
        </div>
        {/* Routing breadcrumb */}
        <div className="px-4 pb-2.5 flex items-center gap-0.5 overflow-x-auto">
          {routingDisplay.map((rt, i) => {
            const stStatus = getStationStatus(order, rt);
            return (
              <div key={rt} className="flex items-center gap-0.5 flex-shrink-0">
                {i > 0 && <ChevronRight className="w-3 h-3 text-white/30" />}
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${
                    stStatus === 'COMPLETED'
                      ? 'bg-white/25 text-white'
                      : stStatus === 'IN_PROGRESS'
                        ? 'bg-white text-gray-900 font-bold'
                        : 'text-white/40'
                  }`}
                >
                  {stStatus === 'COMPLETED' && (
                    <CheckCircle className="w-2.5 h-2.5 inline mr-0.5" />
                  )}
                  {ALL_STATION_LABELS[rt] || rt}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        {/* Description + Notes */}
        <div className="px-4 pt-3 pb-2">
          {order.description && (
            <p className="text-sm text-gray-800 leading-snug">{order.description}</p>
          )}
          {order.notes && (
            <div className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-500" />
              <span>{order.notes}</span>
            </div>
          )}
        </div>

        {/* Print Station Actions — the main purpose of this view */}
        <div className="px-4 py-3">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase">Print Stations</h3>
              {activeRipJob && (
                <div className="mt-1 flex items-center gap-2 text-xs text-indigo-700">
                  <span
                    className={`px-2 py-0.5 rounded-full ${getRipStatusClasses(activeRipJob.status)}`}
                  >
                    {activeRipJob.status.replace(/_/g, ' ')}
                  </span>
                  <span className="truncate">{activeRipJob.hotfolderName}</span>
                </div>
              )}
            </div>
            <button
              onClick={() => onSendToRip(order)}
              className="px-3 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              Send to RIP
            </button>
          </div>
          <div className="space-y-3">
            {orderPrintStations.map((ps) => {
              const stStatus = getStationStatus(order, ps);
              const cfg = STATION_CONFIG[ps];
              const prog = order.stationProgress.find((sp) => sp.station === ps);
              return (
                <div
                  key={ps}
                  className={`rounded-xl border-2 p-4 ${
                    stStatus === 'IN_PROGRESS'
                      ? `${cfg.bg} ${cfg.border}`
                      : stStatus === 'COMPLETED'
                        ? 'bg-green-50 border-green-200'
                        : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Printer
                        className={`h-5 w-5 ${stStatus === 'COMPLETED' ? 'text-green-500' : cfg.icon}`}
                      />
                      <div>
                        <span
                          className={`font-semibold text-sm ${stStatus === 'COMPLETED' ? 'text-green-700' : cfg.color}`}
                        >
                          {cfg.label}
                        </span>
                        <div
                          className={`text-xs ${order.routing.includes(ps) ? 'text-gray-500' : 'text-amber-600'}`}
                        >
                          {!order.routing.includes(ps)
                            ? 'Inferred from order details'
                            : stStatus === 'COMPLETED' && prog?.completedAt
                              ? `Completed ${formatDate(prog.completedAt)}`
                              : stStatus === 'IN_PROGRESS' && prog?.startedAt
                                ? `Started ${formatDate(prog.startedAt)}`
                                : 'Waiting'}
                        </div>
                      </div>
                    </div>

                    {stStatus === 'NOT_STARTED' && (
                      <button
                        onClick={() => onStart(order.id, ps)}
                        disabled={isUpdating}
                        className="px-5 py-2.5 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
                      >
                        <PlayCircle className="h-5 w-5" /> Start
                      </button>
                    )}
                    {stStatus === 'IN_PROGRESS' && (
                      <button
                        onClick={() => onComplete(order.id, ps)}
                        disabled={isUpdating}
                        className="px-5 py-2.5 text-sm font-semibold bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
                      >
                        <CheckCircle className="h-5 w-5" /> Complete
                      </button>
                    )}
                    {stStatus === 'COMPLETED' && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-green-600 flex items-center gap-1">
                          <CheckCircle className="h-5 w-5" /> Done
                        </span>
                        <button
                          onClick={() => onUncomplete(order.id, ps)}
                          disabled={isUpdating}
                          className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                          title="Undo completion"
                        >
                          <Undo2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {orderPrintStations.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">
                No print stations found for this order
              </p>
            )}
          </div>
        </div>

        {/* Line Items */}
        {order.lineItems && order.lineItems.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-200">
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">
              Line Items ({order.lineItems.length})
            </h3>
            <div className="space-y-2">
              {order.lineItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 bg-white rounded-lg border border-gray-100 px-3 py-2"
                >
                  <span className="text-xs text-gray-400 w-5 text-right font-mono">
                    {item.itemNumber}.
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 truncate">
                      {item.description || item.itemMaster?.name || 'Item'}
                    </p>
                  </div>
                  <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
                    Qty: {item.quantity}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Order Info */}
        <div className="px-4 py-3 border-t border-gray-200">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Order Info</h3>
          <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
            <div>
              <span className="text-gray-500">Status</span>
              <p className="font-medium text-gray-800">{order.status.replace(/_/g, ' ')}</p>
            </div>
            <div>
              <span className="text-gray-500">Priority</span>
              <p className="font-medium">
                <span className={`px-2 py-0.5 text-xs rounded-full ${pri.color} ${pri.textColor}`}>
                  {pri.label}
                </span>
              </p>
            </div>
            {order.assignedTo && (
              <div>
                <span className="text-gray-500">Assigned To</span>
                <p className="font-medium text-gray-800">{order.assignedTo.displayName}</p>
              </div>
            )}
            <div>
              <span className="text-gray-500">Due Date</span>
              <p className={`font-medium ${overdue ? 'text-red-600' : 'text-gray-800'}`}>
                {order.dueDate
                  ? new Date(order.dueDate).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })
                  : 'Not set'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────
// RIP Jobs Panel — full tab view for active + recent jobs
// ────────────────────────────────────────────────────────

function RipJobsPanel({
  activeJobs,
  recentCompleted,
  operationsLoading,
  onRefresh,
  onSendToRip,
}: {
  activeJobs: RipJobSummary[];
  recentCompleted: RipJobSummary[];
  operationsLoading: boolean;
  onRefresh: () => void;
  onSendToRip: (order: { id: string }) => void;
}) {
  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">RIP Jobs</h3>
        <button
          onClick={onRefresh}
          className="p-2 text-gray-500 hover:bg-white rounded-lg border border-gray-200"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${operationsLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-indigo-600" />
          <h4 className="font-medium text-gray-900">Active ({activeJobs.length})</h4>
        </div>
        {activeJobs.length === 0 ? (
          <p className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
            No active RIP jobs.
          </p>
        ) : (
          <div className="space-y-2">
            {activeJobs.map((job) => (
              <div key={job.id} className="bg-white rounded-lg border border-gray-200 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">
                      {job.workOrder?.orderNumber || 'Unlinked'}
                      {job.workOrder?.customerName && (
                        <span className="ml-2 font-normal text-gray-500">
                          · {job.workOrder.customerName}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{job.sourceFileName}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{job.hotfolderName}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${getRipStatusClasses(job.status)}`}
                    >
                      {job.status.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {formatDateTime(job.printStartedAt || job.queuedAt)}
                    </span>
                  </div>
                </div>
                {job.workOrder && (
                  <button
                    onClick={() => onSendToRip(job.workOrder!)}
                    className="mt-2 text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                  >
                    <Send className="w-3 h-3" /> Re-send to RIP
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <h4 className="font-medium text-gray-900">Recent Completed ({recentCompleted.length})</h4>
        </div>
        {recentCompleted.length === 0 ? (
          <p className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
            No recent completed jobs.
          </p>
        ) : (
          <div className="space-y-2">
            {recentCompleted.map((job) => (
              <div
                key={job.id}
                className="bg-white rounded-lg border border-gray-200 px-4 py-3 opacity-80"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {job.workOrder?.orderNumber || 'Unlinked'}
                      {job.workOrder?.customerName && (
                        <span className="ml-2 font-normal text-gray-500">
                          · {job.workOrder.customerName}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{job.sourceFileName}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${getRipStatusClasses(job.status)}`}
                    >
                      {job.status.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {formatDateTime(job.printCompletedAt || job.printStartedAt)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function PrintingOperationsSidebar({
  visibleStations,
  operationsLoading,
  hotfolders,
  thriveStatus,
  ripDashboard,
  activeJobs,
  printerCards,
  onRefresh,
}: {
  visibleStations: PrintStation[];
  operationsLoading: boolean;
  hotfolders: HotfolderTarget[];
  thriveStatus: ThriveConnectivityData | null;
  ripDashboard: RipDashboardData | null;
  activeJobs: RipJobSummary[];
  printerCards: Array<{
    equipment: EquipmentListItem;
    live: EquipmentLiveStatus | null;
    activeJob: RipJobSummary | null;
  }>;
  onRefresh: () => void;
}) {
  const stationLabel = visibleStations
    .map((station) => STATION_CONFIG[station]?.label || station)
    .join(', ');

  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">RIP Dashboard</h3>
          <p className="text-xs text-gray-500">{stationLabel}</p>
        </div>
        <button
          onClick={onRefresh}
          className="p-2 text-gray-500 hover:bg-white rounded-lg border border-gray-200"
          title="Refresh print operations"
        >
          <RefreshCw className={`w-4 h-4 ${operationsLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <div className="flex items-center gap-2 text-xs text-gray-500 uppercase tracking-wide">
            <Activity className="w-3.5 h-3.5 text-blue-600" />
            In Queue
          </div>
          <p className="mt-2 text-2xl font-semibold text-gray-900">
            {ripDashboard?.kpis?.inQueue ?? 0}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <div className="flex items-center gap-2 text-xs text-gray-500 uppercase tracking-wide">
            <Loader2 className="w-3.5 h-3.5 text-indigo-600" />
            RIPping
          </div>
          <p className="mt-2 text-2xl font-semibold text-gray-900">
            {ripDashboard?.kpis?.processing ?? 0}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <div className="flex items-center gap-2 text-xs text-gray-500 uppercase tracking-wide">
            <Printer className="w-3.5 h-3.5 text-violet-600" />
            Printing
          </div>
          <p className="mt-2 text-2xl font-semibold text-gray-900">
            {ripDashboard?.kpis?.printing ?? 0}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <div className="flex items-center gap-2 text-xs text-gray-500 uppercase tracking-wide">
            <CheckCircle className="w-3.5 h-3.5 text-green-600" />
            Today
          </div>
          <p className="mt-2 text-2xl font-semibold text-gray-900">
            {ripDashboard?.kpis?.completedToday ?? 0}
          </p>
        </div>
      </div>

      <section className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-blue-600" />
          <h4 className="font-medium text-gray-900">Hotfolder Status</h4>
        </div>

        {hotfolders.length === 0 ? (
          <p className="text-sm text-gray-500">
            No hotfolders configured for these print stations.
          </p>
        ) : (
          <div className="space-y-2">
            {hotfolders.map((hotfolder) => {
              const machineStatus = thriveStatus?.status?.[hotfolder.machineId];
              const activeCount = activeJobs.filter(
                (job) => job.hotfolderName.toLowerCase() === hotfolder.name.toLowerCase()
              ).length;

              return (
                <div key={hotfolder.id} className="rounded-lg border border-gray-200 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{hotfolder.name}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {hotfolder.ripType} · {hotfolder.machineName}
                      </p>
                    </div>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        machineStatus?.online
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {machineStatus?.online
                        ? activeCount > 0
                          ? `Busy ${activeCount}`
                          : 'Ready'
                        : 'Offline'}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 truncate mt-2">{hotfolder.path}</p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-indigo-600" />
          <h4 className="font-medium text-gray-900">Active RIP Jobs</h4>
        </div>

        {activeJobs.length === 0 ? (
          <p className="text-sm text-gray-500">
            No active RIP jobs for the selected print stations.
          </p>
        ) : (
          <div className="space-y-2">
            {activeJobs.slice(0, 8).map((job) => (
              <div key={job.id} className="rounded-lg border border-gray-200 px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {job.workOrder?.orderNumber || 'Unlinked job'}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{job.sourceFileName}</p>
                  </div>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${getRipStatusClasses(job.status)}`}
                  >
                    {job.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 text-xs text-gray-500">
                  <span className="truncate">{job.hotfolderName}</span>
                  <span>{formatDateTime(job.printStartedAt || job.queuedAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Monitor className="w-4 h-4 text-green-600" />
          <h4 className="font-medium text-gray-900">Printer Status</h4>
        </div>

        {printerCards.length === 0 ? (
          <p className="text-sm text-gray-500">No tracked printers found for these stations.</p>
        ) : (
          <div className="space-y-2">
            {printerCards.map(({ equipment, live, activeJob }) => (
              <div key={equipment.id} className="rounded-lg border border-gray-200 px-3 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{equipment.name}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {STATION_CONFIG[equipment.station as PrintStation]?.label ||
                        equipment.station ||
                        equipment.type}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${getEquipmentStatusClasses(equipment.status)}`}
                  >
                    {equipment.status.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-2 text-xs">
                  <span
                    className={`px-2 py-0.5 rounded-full font-medium ${getLiveStateClasses(live?.state)}`}
                  >
                    {live?.state
                      ? live.state.toUpperCase()
                      : live?.reachable === false
                        ? 'OFFLINE'
                        : 'UNKNOWN'}
                  </span>
                  {live?.stateMessage && (
                    <span className="text-gray-500 truncate">{live.stateMessage}</span>
                  )}
                </div>

                {activeJob && (
                  <div className="mt-2 text-xs text-indigo-700">
                    {activeJob.workOrder?.orderNumber || 'Active job'} ·{' '}
                    {activeJob.status.replace(/_/g, ' ')}
                  </div>
                )}

                {live?.alerts && live.alerts.length > 0 && (
                  <div className="mt-2 text-xs text-amber-700 truncate">
                    Alerts: {live.alerts.slice(0, 2).join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
