import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Factory,
  Scissors,
  FolderOpen,
  CheckCircle,
  RefreshCw,
  AlertCircle,
  Clock,
  RotateCcw,
  Package,
  Palette,
  ChevronDown,
  ChevronUp,
  HardDrive,
  Link2,
  Loader2,
  Search,
  X,
  PlayCircle,
  Undo2,
  Printer,
} from 'lucide-react';
import { scoreSearchText } from '@erp/shared';
import {
  openZundCutQueue,
  openExternalPath,
  getOrderFileChainLinks,
  selectBestCutIdLink,
  selectBestCutLink,
  sortFileChainLinks,
  type ShopFloorFileChainLink,
} from '../lib/order-files';
import { apiGet, apiPost } from '../lib/api';
import { useConfigStore } from '../stores/config';
import { useAuthStore } from '../stores/auth';
import { useWebSocket } from '../lib/useWebSocket';
import { useBarcodeScan } from '../lib/useBarcodeScan';
import toast from 'react-hot-toast';

interface StationProgress {
  station: string;
  status: string;
}

interface LineItem {
  id: string;
  itemNumber: number;
  description: string;
  quantity: number;
}

interface ProductionOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  description: string;
  status: string;
  priority: number;
  dueDate: string | null;
  routing: string[];
  stationProgress: StationProgress[];
  lineItems: LineItem[];
  shipDate?: string | null;
  mustShipDate?: string | null;
  effectivePriority?: number | null;
  customerDefaultPriority?: number | null;
  customerPreference?: {
    defaultPriority?: number | null;
  } | null;
  customer?: {
    preference?: {
      defaultPriority?: number | null;
    } | null;
  } | null;
}

interface ProductionCutJob {
  guid: string;
  jobName: string;
  fileName?: string | null;
  device?: string | null;
  printer?: string | null;
  media?: string | null;
  width?: number | null;
  height?: number | null;
  cutId?: string | null;
  manuallyLinked?: boolean;
  linkId?: string | null;
  fileChainLinked?: boolean;
  printCutLinkId?: string | null;
  fileChainStatus?: string | null;
}

interface ProductionQueueFile {
  fileName: string;
  jobName: string;
  status: string;
  material?: string | null;
  modified?: string | null;
  cutId?: string | null;
  manuallyLinked?: boolean;
  linkId?: string | null;
  fileChainLinked?: boolean;
  printCutLinkId?: string | null;
  fileChainStatus?: string | null;
}

interface ProductionCompletedCut {
  jobId: number;
  jobName: string;
  productionStart?: string | null;
  productionEnd?: string | null;
  copyDone?: number | null;
  matchedVia?: string | null;
  cutId?: string | null;
  manuallyLinked?: boolean;
  linkId?: string | null;
  fileChainLinked?: boolean;
  printCutLinkId?: string | null;
  fileChainStatus?: string | null;
}

interface ProductionManualLink {
  id: string;
  jobType: string;
  jobIdentifier: string;
  jobName: string;
}

interface ProductionCutSummary {
  cutJobCount?: number;
  zundCompletedCount?: number;
  zundQueueFileCount?: number;
  manualLinkCount?: number;
}

interface ProductionLinkedFileChainLink {
  id: string;
  printFileName: string;
  cutFileName: string | null;
  cutId: string | null;
}

interface ProductionLinkedDataSummary {
  orderId: string;
  fileChainLinks: ProductionLinkedFileChainLink[];
  latestFileChainLinks: ProductionLinkedFileChainLink[];
}

interface ProductionCutData {
  cutJobs: ProductionCutJob[];
  zundQueueFiles: ProductionQueueFile[];
  zundCompletedJobs: ProductionCompletedCut[];
  manualLinks: ProductionManualLink[];
  summary?: ProductionCutSummary;
}

interface UnlinkedCutData {
  cutJobs: ProductionCutJob[];
  zundQueueFiles: ProductionQueueFile[];
}

interface ProductionCutCandidate {
  type: 'CUT_JOB' | 'ZUND_QUEUE';
  identifier: string;
  name: string;
  detail: string;
  source: string;
  cutId: string | null;
}

interface LiveCutMatch {
  key: string;
  source: string;
  name: string;
  detail: string;
  cutId: string | null;
  status: string | null;
  manuallyLinked: boolean;
  fileChainLinked: boolean;
  fileChainStatus: string | null;
}

const PRODUCTION_SIDE_STATIONS = [
  'PRODUCTION',
  'SCREEN_PRINT',
  'FABRICATION',
  'CUT',
  'PRODUCTION_ZUND',
  'PRODUCTION_FINISHING',
];
const STATION_LABELS: Record<string, string> = {
  ROLL_TO_ROLL: 'Roll to Roll',
  FLATBED: 'Flatbed',
  SCREEN_PRINT: 'Screen Print',
  DESIGN: 'Design',
  PRODUCTION: 'Production',
  FABRICATION: 'Fabrication',
  CUT: 'Cut',
  PRODUCTION_ZUND: 'Zund',
  PRODUCTION_FINISHING: 'Finishing',
  SHIPPING_RECEIVING: 'Shipping',
  INSTALLATION: 'Installation',
};

const LIVE_QUEUE_STATUS_PRIORITY: Record<string, number> = {
  active: 4,
  queued: 3,
  linked: 2,
  completed: 1,
};

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function normalizeCutData(value: unknown): ProductionCutData {
  const raw = (value ?? {}) as Partial<ProductionCutData>;
  return {
    cutJobs: asArray<ProductionCutJob>(raw.cutJobs),
    zundQueueFiles: asArray<ProductionQueueFile>(raw.zundQueueFiles),
    zundCompletedJobs: asArray<ProductionCompletedCut>(raw.zundCompletedJobs),
    manualLinks: asArray<ProductionManualLink>(raw.manualLinks),
    summary: raw.summary,
  };
}

function normalizeUnlinkedCutData(value: unknown): UnlinkedCutData {
  const raw = (value ?? {}) as Partial<UnlinkedCutData>;
  return {
    cutJobs: asArray<ProductionCutJob>(raw.cutJobs),
    zundQueueFiles: asArray<ProductionQueueFile>(raw.zundQueueFiles),
  };
}

function firstTrimmed(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function toSortTimestamp(value: string | null | undefined): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY;
}

function normalizePriority(value: number | null | undefined): number | null {
  if (!Number.isFinite(value)) return null;
  const numeric = Math.trunc(value as number);
  if (numeric < 1 || numeric > 5) return null;
  return numeric;
}

function resolveEffectivePriority(order: ProductionOrder): number {
  const candidates = [
    normalizePriority(order.effectivePriority),
    normalizePriority(order.customerDefaultPriority),
    normalizePriority(order.customerPreference?.defaultPriority),
    normalizePriority(order.customer?.preference?.defaultPriority),
    normalizePriority(order.priority),
  ];

  for (const candidate of candidates) {
    if (candidate !== null) return candidate;
  }

  return 5;
}

function compareProductionQueueOrder(a: ProductionOrder, b: ProductionOrder): number {
  const dateA = toSortTimestamp(a.shipDate ?? a.mustShipDate ?? a.dueDate);
  const dateB = toSortTimestamp(b.shipDate ?? b.mustShipDate ?? b.dueDate);
  if (dateA !== dateB) return dateA - dateB;

  // Lower numeric value is treated as higher urgency in existing production logic.
  const priorityA = resolveEffectivePriority(a);
  const priorityB = resolveEffectivePriority(b);
  if (priorityA !== priorityB) return priorityA - priorityB;

  const orderNumberDiff = a.orderNumber.localeCompare(b.orderNumber, undefined, {
    numeric: true,
    sensitivity: 'base',
  });
  if (orderNumberDiff !== 0) return orderNumberDiff;

  const customerDiff = a.customerName.localeCompare(b.customerName, undefined, {
    sensitivity: 'base',
  });
  if (customerDiff !== 0) return customerDiff;

  return a.id.localeCompare(b.id);
}

function getBestLiveCutId(cutData: ProductionCutData | null | undefined): string | null {
  if (!cutData) return null;

  const queueFiles = [...cutData.zundQueueFiles].sort(
    (a, b) =>
      (LIVE_QUEUE_STATUS_PRIORITY[b.status || ''] || 0) -
      (LIVE_QUEUE_STATUS_PRIORITY[a.status || ''] || 0)
  );

  const candidates = [
    ...queueFiles.map((item) => item.cutId),
    ...cutData.cutJobs.map((item) => item.cutId),
    ...cutData.zundCompletedJobs.map((item) => item.cutId),
  ];

  return firstTrimmed(...candidates);
}

function countLiveCutIds(cutData: ProductionCutData | null | undefined): number {
  if (!cutData) return 0;

  return [
    ...cutData.zundQueueFiles.map((item) => item.cutId),
    ...cutData.cutJobs.map((item) => item.cutId),
    ...cutData.zundCompletedJobs.map((item) => item.cutId),
  ].filter((value) => Boolean(value?.trim())).length;
}

function getLiveCutMatches(cutData: ProductionCutData | null | undefined): LiveCutMatch[] {
  if (!cutData) return [];

  const queueMatches = [...cutData.zundQueueFiles]
    .sort(
      (a, b) =>
        (LIVE_QUEUE_STATUS_PRIORITY[b.status || ''] || 0) -
        (LIVE_QUEUE_STATUS_PRIORITY[a.status || ''] || 0)
    )
    .map((file) => ({
      key: `queue:${file.fileName}`,
      source: 'Zund Queue',
      name: file.jobName || file.fileName,
      detail: file.material || file.fileName,
      cutId: firstTrimmed(file.cutId),
      status: file.status ? file.status.replace(/_/g, ' ') : null,
      manuallyLinked: Boolean(file.manuallyLinked),
      fileChainLinked: Boolean(file.fileChainLinked),
      fileChainStatus: file.fileChainStatus ? file.fileChainStatus.replace(/_/g, ' ') : null,
    }));

  const cutJobMatches = cutData.cutJobs.map((job) => ({
    key: `cut:${job.guid}`,
    source: 'Thrive Cut',
    name: job.jobName,
    detail: firstTrimmed(job.device, job.printer, job.fileName) || 'Pending cut job',
    cutId: firstTrimmed(job.cutId),
    status: 'Pending',
    manuallyLinked: Boolean(job.manuallyLinked),
    fileChainLinked: Boolean(job.fileChainLinked),
    fileChainStatus: job.fileChainStatus ? job.fileChainStatus.replace(/_/g, ' ') : null,
  }));

  const completedMatches = cutData.zundCompletedJobs.map((job) => ({
    key: `done:${job.jobId}`,
    source: 'Zund History',
    name: job.jobName,
    detail: job.matchedVia || 'Completed cut job',
    cutId: firstTrimmed(job.cutId),
    status: 'Completed',
    manuallyLinked: Boolean(job.manuallyLinked),
    fileChainLinked: Boolean(job.fileChainLinked),
    fileChainStatus: job.fileChainStatus ? job.fileChainStatus.replace(/_/g, ' ') : null,
  }));

  return [...queueMatches, ...cutJobMatches, ...completedMatches].slice(0, 4);
}

function buildCutCandidates(unlinkedData: UnlinkedCutData | null): ProductionCutCandidate[] {
  if (!unlinkedData) return [];

  return [
    ...unlinkedData.cutJobs.map((job) => ({
      type: 'CUT_JOB' as const,
      identifier: job.guid,
      name: job.jobName,
      detail: firstTrimmed(job.device, job.printer, job.fileName) || 'Thrive Cut',
      source: 'Thrive Cut',
      cutId: firstTrimmed(job.cutId),
    })),
    ...unlinkedData.zundQueueFiles.map((file) => ({
      type: 'ZUND_QUEUE' as const,
      identifier: file.fileName,
      name: file.jobName || file.fileName,
      detail: firstTrimmed(file.material, file.fileName) || 'Zund Queue',
      source: 'Zund Queue',
      cutId: firstTrimmed(file.cutId),
    })),
  ];
}

export function ProductionStation() {
  const { config } = useConfigStore();
  const { token } = useAuthStore();
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [fileChainByOrder, setFileChainByOrder] = useState<
    Record<string, ShopFloorFileChainLink[]>
  >({});
  const [linkedDataByOrderId, setLinkedDataByOrderId] = useState<
    Record<string, ProductionLinkedDataSummary>
  >({});
  const [cutDataByOrderNumber, setCutDataByOrderNumber] = useState<
    Record<string, ProductionCutData>
  >({});
  const [loadingFileChainOrderId, setLoadingFileChainOrderId] = useState<string | null>(null);
  const [syncingFileChainOrderId, setSyncingFileChainOrderId] = useState<string | null>(null);
  const [loadingCutDataOrderNumber, setLoadingCutDataOrderNumber] = useState<string | null>(null);
  const [linkCutModalOrder, setLinkCutModalOrder] = useState<{
    id: string;
    orderNumber: string;
  } | null>(null);
  const [unlinkedCutData, setUnlinkedCutData] = useState<UnlinkedCutData | null>(null);
  const [loadingUnlinkedCutData, setLoadingUnlinkedCutData] = useState(false);
  const [linkingCutCandidateKey, setLinkingCutCandidateKey] = useState<string | null>(null);
  const [cutLinkSearch, setCutLinkSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reprintModal, setReprintModal] = useState<{ orderId: string; orderNumber: string } | null>(
    null
  );
  const [reprintReason, setReprintReason] = useState('PRINT_DEFECT');
  const [reprintDesc, setReprintDesc] = useState('');
  const [revisionModal, setRevisionModal] = useState<{
    orderId: string;
    orderNumber: string;
  } | null>(null);
  const [revisionReason, setRevisionReason] = useState('WRONG_SIZE');
  const [revisionNotes, setRevisionNotes] = useState('');
  const [stationFilter, setStationFilter] = useState<
    'all' | 'production' | 'screen_print' | 'fabrication'
  >('all');
  const [screenPrintWorking, setScreenPrintWorking] = useState<string | null>(null);
  const [lastScan, setLastScan] = useState<{
    cutId: string | null;
    orientation: string | null;
    matched: boolean;
    orderNumber: string | null;
  } | null>(null);

  const { subscribe } = useWebSocket();
  const safeOrders = Array.isArray(orders) ? orders : [];

  const fetchOrders = useCallback(async () => {
    if (!token) return;

    try {
      const res = await fetch(`${config.apiUrl}/orders?status=IN_PROGRESS&limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`API ${res.status}`);

      const json = await res.json();
      const items = json.data?.items ?? json.data ?? [];
      setOrders(Array.isArray(items) ? items : []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [config.apiUrl, token]);

  const handleBarcodeScan = useCallback(
    async (rawBarcode: string) => {
      if (!token) return;
      try {
        const res = await fetch(`${config.apiUrl}/equipment/thrive/barcode-scan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ rawBarcode, station: 'PRODUCTION' }),
        });
        if (!res.ok) throw new Error(`API ${res.status}`);
        const json = await res.json();
        const { parsedCutId, orientation, matched, orderNumber } = json.data ?? {};

        setLastScan({
          cutId: parsedCutId ?? null,
          orientation: orientation ?? null,
          matched,
          orderNumber: orderNumber ?? null,
        });

        if (matched) {
          toast.success(
            `Scanned CutID ${parsedCutId} → ${orderNumber}${orientation ? ` (${orientation}°)` : ''}`,
            { duration: 4000 }
          );
          void fetchOrders();
        } else {
          toast(`Scanned ${parsedCutId ?? rawBarcode} — no order match found`, {
            icon: '🔍',
            duration: 4000,
          });
        }
      } catch {
        toast.error('Barcode scan failed');
      }
    },
    [config.apiUrl, token, fetchOrders]
  );

  useBarcodeScan({ onScan: handleBarcodeScan });

  const loadFileChain = useCallback(async (orderId: string, options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoadingFileChainOrderId(orderId);
    }

    try {
      const links = await getOrderFileChainLinks(orderId);
      const sortedLinks = sortFileChainLinks(links);
      setFileChainByOrder((prev) => ({
        ...prev,
        [orderId]: sortedLinks,
      }));
      return sortedLinks;
    } catch (err: any) {
      if (!options?.silent) {
        toast.error(err?.message || 'Failed to load cut links');
      }
      return null;
    } finally {
      if (!options?.silent) {
        setLoadingFileChainOrderId((current) => (current === orderId ? null : current));
      }
    }
  }, []);

  const loadOrderCutData = useCallback(
    async (orderNumber: string, options?: { silent?: boolean }) => {
      if (!options?.silent) {
        setLoadingCutDataOrderNumber(orderNumber);
      }

      try {
        const data = normalizeCutData(await apiGet(`/equipment/thrive/workorder/${orderNumber}`));
        setCutDataByOrderNumber((prev) => ({
          ...prev,
          [orderNumber]: data,
        }));
        return data;
      } catch (err: any) {
        if (!options?.silent) {
          toast.error(err?.message || 'Failed to load live cut matches');
        }
        return null;
      } finally {
        if (!options?.silent) {
          setLoadingCutDataOrderNumber((current) => (current === orderNumber ? null : current));
        }
      }
    },
    []
  );

  const loadUnlinkedCandidates = useCallback(async () => {
    setLoadingUnlinkedCutData(true);

    try {
      const data = normalizeUnlinkedCutData(await apiGet('/equipment/thrive/unlinked-jobs'));
      setUnlinkedCutData(data);
      return data;
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load available cut matches');
      return null;
    } finally {
      setLoadingUnlinkedCutData(false);
    }
  }, []);

  const loadLinkedData = useCallback(
    async (orderId: string, options?: { silent?: boolean }) => {
      try {
        const data = await apiGet<ProductionLinkedDataSummary>(`/orders/${orderId}/linked-data`);
        setLinkedDataByOrderId((prev) => ({
          ...prev,
          [orderId]: data,
        }));
        return data;
      } catch (err: any) {
        if (!options?.silent) {
          toast.error(err?.message || 'Failed to load linked order data');
        }
        return null;
      }
    },
    [],
  );

  const closeLinkCutModal = useCallback(() => {
    setLinkCutModalOrder(null);
    setCutLinkSearch('');
    setLinkingCutCandidateKey(null);
  }, []);

  const expandedOrder = expandedId
    ? (safeOrders.find((order) => order.id === expandedId) ?? null)
    : null;

  useEffect(() => {
    fetchOrders();
    const timer = setInterval(fetchOrders, 15000);
    return () => clearInterval(timer);
  }, [fetchOrders]);

  useEffect(() => {
    if (safeOrders.length === 0) {
      return;
    }

    const missingIds = safeOrders
      .filter((order) => !linkedDataByOrderId[order.id])
      .map((order) => order.id);

    if (missingIds.length === 0) {
      return;
    }

    void Promise.all(missingIds.map((orderId) => loadLinkedData(orderId, { silent: true })));
  }, [linkedDataByOrderId, loadLinkedData, safeOrders]);

  useEffect(() => {
    const unsubscribe = subscribe((msg) => {
      const shouldRefreshOrders = [
        'STATION_COMPLETED',
        'REPRINT_REQUESTED',
        'ORDER_CREATED',
        'REVISION_REQUESTED',
        'ORDER_UPDATED',
      ].includes(msg.type);

      if (shouldRefreshOrders) {
        void fetchOrders();
      }

      const payload =
        msg.payload && typeof msg.payload === 'object'
          ? (msg.payload as Record<string, unknown>)
          : null;
      const payloadOrderId =
        payload && typeof payload.orderId === 'string' ? payload.orderId : null;
      const payloadWorkOrderId =
        payload && typeof payload.workOrderId === 'string' ? payload.workOrderId : null;

      if (msg.type === 'ORDER_UPDATED') {
        setLinkedDataByOrderId((prev) => {
          if (!payloadOrderId || !prev[payloadOrderId]) {
            return prev;
          }
          const next = { ...prev };
          delete next[payloadOrderId];
          return next;
        });
      }

      if (msg.type === 'FILE_CHAIN_UPDATED') {
        setLinkedDataByOrderId((prev) => {
          if (!payloadWorkOrderId || !prev[payloadWorkOrderId]) {
            return prev;
          }
          const next = { ...prev };
          delete next[payloadWorkOrderId];
          return next;
        });
      }

      if (!expandedOrder) return;

      if (msg.type === 'ORDER_UPDATED') {
        void loadOrderCutData(expandedOrder.orderNumber, { silent: true });
      }

      if (msg.type === 'FILE_CHAIN_UPDATED') {
        if (!payloadWorkOrderId || payloadWorkOrderId === expandedOrder.id) {
          void loadFileChain(expandedOrder.id, { silent: true });
          void loadOrderCutData(expandedOrder.orderNumber, { silent: true });
        }
      }
    });

    return unsubscribe;
  }, [expandedOrder, fetchOrders, loadFileChain, loadOrderCutData, subscribe]);

  useEffect(() => {
    if (!expandedOrder) return;

    if (!fileChainByOrder[expandedOrder.id]) {
      void loadFileChain(expandedOrder.id);
    }

    if (!cutDataByOrderNumber[expandedOrder.orderNumber]) {
      void loadOrderCutData(expandedOrder.orderNumber);
    }
  }, [cutDataByOrderNumber, expandedOrder, fileChainByOrder, loadFileChain, loadOrderCutData]);

  useEffect(() => {
    if (!linkCutModalOrder) return;
    void loadUnlinkedCandidates();
  }, [linkCutModalOrder, loadUnlinkedCandidates]);

  const handleSyncFileChain = async (orderId: string) => {
    setSyncingFileChainOrderId(orderId);
    try {
      await apiPost('/file-chain/sync');
      await loadFileChain(orderId);
      toast.success('File chain sync complete');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to sync file chain');
    } finally {
      setSyncingFileChainOrderId((current) => (current === orderId ? null : current));
    }
  };

  const handleRefreshLiveMatches = async (orderNumber: string) => {
    await loadOrderCutData(orderNumber);
  };

  const handleOpenCutFile = async (order: ProductionOrder) => {
    try {
      const { selected, linkedCount, invalidCount } = await selectBestCutLink(order.id);
      const cachedLiveCutId = getBestLiveCutId(cutDataByOrderNumber[order.orderNumber]);
      const loadedLiveCutData = cachedLiveCutId
        ? null
        : await loadOrderCutData(order.orderNumber, { silent: true });
      const liveCutId = cachedLiveCutId || getBestLiveCutId(loadedLiveCutData);

      if (linkedCount === 0) {
        if (liveCutId) {
          toast.error(
            `No cut file path is linked yet. Use the queue button for CutID ${liveCutId}.`
          );
        } else {
          toast.error('No cut files linked to this order yet');
        }
        return;
      }

      if (!selected?.cutFilePath) {
        if (liveCutId) {
          toast.error(
            `A cut record exists for ${liveCutId}, but no saved cut file path is linked yet.`
          );
        } else {
          toast.error('A cut file is linked, but its saved path is missing');
        }
        return;
      }

      if (invalidCount >= linkedCount) {
        toast.error('Linked cut files were found, but none of their saved paths exist');
        return;
      }

      const result = await openExternalPath(selected.cutFilePath, 'file');
      if (result === 'opened') {
        toast.success(`Opened ${selected.cutFileName || 'cut file'}`);
      } else {
        toast.success(`${selected.cutFileName || 'Cut file'} path copied`);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to open cut file');
    }
  };

  const handleOpenFolder = async (order: ProductionOrder) => {
    try {
      const selected = await selectBestCutIdLink(order.id);
      const cachedLiveCutId = getBestLiveCutId(cutDataByOrderNumber[order.orderNumber]);
      const loadedLiveCutData =
        selected?.cutId || cachedLiveCutId
          ? null
          : await loadOrderCutData(order.orderNumber, { silent: true });
      const cutId =
        firstTrimmed(selected?.cutId, cachedLiveCutId) || getBestLiveCutId(loadedLiveCutData);

      if (!cutId) {
        toast.error('No CutID is linked or detected for this order yet');
        return;
      }

      await openZundCutQueue(cutId);
      toast.success(`Opened Zund Cut Queue for ${cutId}`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to open Zund Cut Queue');
    }
  };

  const handleMarkComplete = async (orderId: string, orderNumber: string) => {
    if (!window.confirm(`Mark ${orderNumber} as complete?`)) return;

    try {
      const res = await fetch(`${config.apiUrl}/orders/${orderId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      toast.success(`${orderNumber} marked complete`);
    } catch {
      toast.error('Failed to complete order');
    }
  };


  const handleReprintRequest = async () => {
    if (!reprintModal || !reprintDesc.trim()) return;

    try {
      const res = await fetch(`${config.apiUrl}/orders/${reprintModal.orderId}/reprint-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: reprintReason, description: reprintDesc }),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      toast.success('Reprint requested');
      setReprintModal(null);
      setReprintDesc('');
    } catch {
      toast.error('Failed to request reprint');
    }
  };

  const handleRevisionRequest = async () => {
    if (!revisionModal) return;

    try {
      const res = await fetch(`${config.apiUrl}/orders/${revisionModal.orderId}/revision-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: revisionReason, notes: revisionNotes }),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      toast.success('Revision requested - sent back to Design');
      setRevisionModal(null);
      setRevisionNotes('');
    } catch {
      toast.error('Failed to request revision');
    }
  };

  const handleMaterialRequest = async (orderId: string, orderNumber: string) => {
    const desc = window.prompt(`Material needed for ${orderNumber}:`);
    if (!desc) return;

    try {
      const res = await fetch(`${config.apiUrl}/orders/${orderId}/material-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ description: desc }),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      toast.success('Material request sent');
    } catch {
      toast.error('Failed to request material');
    }
  };

  const handleScreenPrintStation = async (
    orderId: string,
    orderNumber: string,
    action: 'start' | 'complete' | 'uncomplete'
  ) => {
    setScreenPrintWorking(orderId);
    try {
      const res = await fetch(
        `${config.apiUrl}/orders/${orderId}/stations/SCREEN_PRINT/${action}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!res.ok) throw new Error(`API ${res.status}`);
      const labels = { start: 'started', complete: 'completed', uncomplete: 'marked incomplete' };
      toast.success(`Screen Print ${labels[action]} for ${orderNumber}`);
      void fetchOrders();
    } catch {
      toast.error('Failed to update Screen Print station');
    } finally {
      setScreenPrintWorking(null);
    }
  };

  const handleLinkCutCandidate = async (candidate: ProductionCutCandidate) => {
    if (!linkCutModalOrder) return;

    const targetOrderId = linkCutModalOrder.id;
    const targetOrderNumber = linkCutModalOrder.orderNumber;
    const candidateKey = `${candidate.type}:${candidate.identifier}`;
    setLinkingCutCandidateKey(candidateKey);

    try {
      await apiPost(`/equipment/thrive/workorder/${targetOrderNumber}/link-job`, {
        jobType: candidate.type,
        jobIdentifier: candidate.identifier,
        jobName: candidate.name,
      });

      await Promise.all([
        loadOrderCutData(targetOrderNumber, { silent: true }),
        loadFileChain(targetOrderId, { silent: true }),
      ]);
      closeLinkCutModal();
      toast.success(`Linked ${candidate.cutId || candidate.name} to ${targetOrderNumber}`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to link cut match');
    } finally {
      setLinkingCutCandidateKey(null);
    }
  };

  const getStationBadge = (sp: StationProgress) => {
    const label = STATION_LABELS[sp.station] || sp.station.replace(/_/g, ' ');
    const colors =
      sp.status === 'COMPLETED'
        ? 'bg-green-100 text-green-700'
        : sp.status === 'IN_PROGRESS'
          ? 'bg-yellow-100 text-yellow-700'
          : 'bg-gray-100 text-gray-500';

    return (
      <span key={sp.station} className={`px-2 py-0.5 rounded text-xs font-medium ${colors}`}>
        {label}
      </span>
    );
  };

  const FABRICATION_STATIONS = ['FABRICATION', 'CUT', 'PRODUCTION_ZUND', 'PRODUCTION_FINISHING'];

  const productionOrders = useMemo(
    () =>
      safeOrders.filter((order) => {
        const all = [
          ...(order.routing ?? []),
          ...(order.stationProgress ?? []).map((sp) => sp.station),
        ];
        return all.some((station) => PRODUCTION_SIDE_STATIONS.includes(station));
      }),
    [safeOrders],
  );

  const filtered = useMemo(() => {
    const normalizedQuery = searchQuery.trim();
    const scored = productionOrders
      .filter((order) => {
        const all = [
          ...(order.routing ?? []),
          ...(order.stationProgress ?? []).map((sp) => sp.station),
        ];

        if (stationFilter === 'production' && !all.includes('PRODUCTION')) return false;
        if (stationFilter === 'screen_print' && !all.includes('SCREEN_PRINT')) return false;
        if (stationFilter === 'fabrication' && !all.some((station) => FABRICATION_STATIONS.includes(station)))
          return false;

        return true;
      })
      .map((order) => {
        const linkedData = linkedDataByOrderId[order.id];
        const fileChainLinks = [
          ...(fileChainByOrder[order.id] || []),
          ...(linkedData?.fileChainLinks || []),
          ...(linkedData?.latestFileChainLinks || []),
        ];
        const liveCutData = cutDataByOrderNumber[order.orderNumber];

        const searchParts = [
          order.orderNumber,
          order.customerName,
          order.description,
          ...(fileChainLinks.flatMap((link) => [link.printFileName, link.cutFileName, link.cutId])),
          ...(liveCutData?.cutJobs.flatMap((job) => [job.jobName, job.fileName, job.cutId]) || []),
          ...(liveCutData?.zundQueueFiles.flatMap((file) => [file.jobName, file.fileName, file.cutId]) || []),
          ...(liveCutData?.zundCompletedJobs.flatMap((job) => [job.jobName, job.cutId]) || []),
          ...(liveCutData?.summary?.manualLinkCount ? ['manual link'] : []),
        ].filter((value): value is string => Boolean(value && value.trim()));

        return {
          order,
          score: scoreSearchText(searchParts.join(' '), searchQuery),
        };
      });

    return normalizedQuery
      ? scored
          .filter((entry) => entry.score > 0)
          .sort(
            (a, b) =>
              b.score - a.score ||
              compareProductionQueueOrder(a.order, b.order),
          )
          .map((entry) => entry.order)
      : scored
          .map((entry) => entry.order)
          .sort(compareProductionQueueOrder);
  }, [
    cutDataByOrderNumber,
    fileChainByOrder,
    linkedDataByOrderId,
    productionOrders,
    searchQuery,
    stationFilter,
  ]);

  const cutCandidates = buildCutCandidates(unlinkedCutData).filter((candidate) => {
    if (!cutLinkSearch.trim()) return true;
    return scoreSearchText(
      [
        candidate.name,
        candidate.identifier,
        candidate.detail,
        candidate.source,
        candidate.cutId ?? '',
      ].join(' '),
      cutLinkSearch,
    ) > 0;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b px-4 py-3 flex items-center gap-4">
        <Factory className="w-5 h-5 text-orange-600" />
        <h2 className="font-semibold text-gray-900">Production</h2>
        <div className="flex-1 relative max-w-md">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search order number, customer, description, file name, or CutID..."
            className="w-full pl-4 pr-4 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <button
          onClick={fetchOrders}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="bg-white border-b px-4 py-2 flex items-center gap-2 overflow-x-auto">
        {(
          [
            { key: 'all', label: 'All' },
            { key: 'production', label: 'Production' },
            { key: 'screen_print', label: 'Screen Print' },
            { key: 'fabrication', label: 'Fabrication' },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setStationFilter(key)}
            className={`px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              stationFilter === key
                ? 'bg-orange-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-400">
          {filtered.length} order{filtered.length === 1 ? '' : 's'}
        </span>
      </div>

      {error && (
        <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {lastScan && (
        <div
          className={`mx-4 mt-2 px-4 py-2 rounded-lg flex items-center justify-between text-sm ${
            lastScan.matched
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-amber-50 border border-amber-200 text-amber-800'
          }`}
        >
          <span>
            <span className="font-medium">Last scan:</span> {lastScan.cutId ?? 'unknown CutID'}
            {lastScan.orientation ? ` · ${lastScan.orientation}°` : ''}
            {lastScan.matched ? ` → linked to ${lastScan.orderNumber}` : ' — no order match'}
          </span>
          <button onClick={() => setLastScan(null)} className="ml-4 opacity-50 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex-1 overflow-auto p-4 space-y-2">
        {filtered.length === 0 && !error && (
          <div className="text-center py-12 text-gray-400">
            <Factory className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No orders in production</p>
          </div>
        )}

        {filtered.map((order) => {
          const isScreenPrintOrder =
            (order.routing ?? []).includes('SCREEN_PRINT') ||
            (order.stationProgress ?? []).some((sp) => sp.station === 'SCREEN_PRINT');
          const productionProgress =
            order.stationProgress?.filter((sp) => PRODUCTION_SIDE_STATIONS.includes(sp.station)) ||
            [];
          const screenPrintProgress = order.stationProgress?.find(
            (sp) => sp.station === 'SCREEN_PRINT'
          );
          const fileChainLinks = fileChainByOrder[order.id] || [];
          const linkedCutLinks = fileChainLinks.filter((link) =>
            Boolean(link.cutFileName || link.cutFilePath)
          );
          const cutIdLinks = fileChainLinks.filter((link) => Boolean(link.cutId?.trim()));
          const cutData = cutDataByOrderNumber[order.orderNumber];
          const liveCutMatches = getLiveCutMatches(cutData);
          const liveCutId = getBestLiveCutId(cutData);
          const liveCutIdCount = countLiveCutIds(cutData);
          const isExpanded = expandedId === order.id;

          return (
            <div
              key={order.id}
              className="bg-white rounded-lg border border-gray-200 hover:border-orange-300"
            >
              <div
                className="p-4 cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : order.id)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-gray-900">{order.orderNumber}</span>
                      <span className="text-sm text-gray-500">{order.customerName}</span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{order.description}</p>
                    {order.dueDate && (
                      <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Due: {new Date(order.dueDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleOpenCutFile(order)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-700"
                    >
                      <Scissors className="w-4 h-4" />
                      Zund / Cut
                    </button>
                    <button
                      onClick={() => handleOpenFolder(order)}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                      title="Open Zund Cut Queue"
                    >
                      <FolderOpen className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleMarkComplete(order.id, order.orderNumber)}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm text-green-600 hover:bg-green-50 rounded-lg"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Done
                    </button>
                  </div>
                </div>

                {productionProgress.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {productionProgress.map((sp) => getStationBadge(sp))}
                  </div>
                )}
              </div>

              {isExpanded && (
                <div className="border-t px-4 py-3 bg-gray-50 space-y-3">
                  <div className="rounded-lg border border-orange-200 bg-orange-50/60 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-orange-800 uppercase">Cut Links</p>
                        <p className="text-xs text-orange-700 mt-1">
                          {linkedCutLinks.length > 0
                            ? `${linkedCutLinks.length} cut file link${linkedCutLinks.length === 1 ? '' : 's'} found`
                            : 'No cut file links found yet'}
                          {cutIdLinks.length > 0
                            ? ` - ${cutIdLinks.length} CutID link${cutIdLinks.length === 1 ? '' : 's'}`
                            : ''}
                        </p>
                      </div>
                      <button
                        onClick={() => handleSyncFileChain(order.id)}
                        disabled={syncingFileChainOrderId === order.id}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-orange-700 hover:bg-orange-100 rounded-lg disabled:opacity-60"
                      >
                        <RefreshCw
                          className={`w-4 h-4 ${syncingFileChainOrderId === order.id ? 'animate-spin' : ''}`}
                        />
                        Refresh Links
                      </button>
                    </div>

                    {loadingFileChainOrderId === order.id ? (
                      <div className="mt-3 text-sm text-orange-700 flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Loading file-chain data...
                      </div>
                    ) : fileChainLinks.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        {fileChainLinks.slice(0, 3).map((link) => (
                          <div
                            key={link.id}
                            className="rounded border border-orange-100 bg-white/90 px-3 py-2"
                          >
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              {link.cutId && (
                                <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-mono">
                                  {link.cutId}
                                </span>
                              )}
                              {link.status && (
                                <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                                  {link.status.replace(/_/g, ' ')}
                                </span>
                              )}
                              {link.linkConfidence && link.linkConfidence !== 'NONE' && (
                                <span className="px-2 py-0.5 rounded bg-green-100 text-green-700">
                                  {link.confirmed ? 'Confirmed' : link.linkConfidence}
                                </span>
                              )}
                              {link.cutFileSource && (
                                <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-700">
                                  {link.cutFileSource}
                                </span>
                              )}
                            </div>
                            <div className="mt-2 text-sm text-gray-700 space-y-1">
                              {link.printFileName && (
                                <div>
                                  <span className="font-medium text-gray-900">Print file:</span>{' '}
                                  <span className="break-all">{link.printFileName}</span>
                                </div>
                              )}
                              <div>
                                <span className="font-medium text-gray-900">Cut file:</span>{' '}
                                <span className="break-all">
                                  {link.cutFileName ? link.cutFileName : 'Cut file not linked yet'}
                                </span>
                              </div>
                              {link.cutFilePath && (
                                <div className="text-xs text-gray-500 break-all">
                                  {link.cutFilePath}
                                </div>
                              )}
                              {!link.cutId && !link.cutFilePath && (
                                <div className="text-xs text-amber-700">
                                  This chain exists, but it still needs a CutID or cut-file match.
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                        {fileChainLinks.length > 3 && (
                          <p className="text-xs text-orange-700">
                            Showing the top 3 links for this order.
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="mt-3 text-sm text-orange-700">
                        No file-chain records exist for this order yet. Use{' '}
                        <span className="font-medium">Refresh Links</span> after the print file has
                        been queued or linked.
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-sky-800 uppercase">
                          Live Cut Matches
                        </p>
                        <p className="text-xs text-sky-700 mt-1">
                          {cutData
                            ? `${liveCutIdCount} CutID${liveCutIdCount === 1 ? '' : 's'} detected across ${cutData.zundQueueFiles.length} queue, ${cutData.cutJobs.length} Thrive, and ${cutData.zundCompletedJobs.length} completed match${cutData.zundCompletedJobs.length === 1 ? '' : 'es'}`
                            : 'Load live Thrive and Zund matches for this order'}
                        </p>
                        {liveCutId && (
                          <p className="text-xs text-sky-600 mt-1">
                            Queue shortcut will use live CutID{' '}
                            <span className="font-mono font-medium">{liveCutId}</span> even if
                            file-chain has not linked it yet.
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setLinkCutModalOrder({ id: order.id, orderNumber: order.orderNumber });
                            setCutLinkSearch('');
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm text-sky-700 hover:bg-sky-100 rounded-lg"
                        >
                          <Link2 className="w-4 h-4" />
                          Link CutID
                        </button>
                        <button
                          onClick={() => handleRefreshLiveMatches(order.orderNumber)}
                          disabled={loadingCutDataOrderNumber === order.orderNumber}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm text-sky-700 hover:bg-sky-100 rounded-lg disabled:opacity-60"
                        >
                          <RefreshCw
                            className={`w-4 h-4 ${loadingCutDataOrderNumber === order.orderNumber ? 'animate-spin' : ''}`}
                          />
                          Refresh
                        </button>
                      </div>
                    </div>

                    {loadingCutDataOrderNumber === order.orderNumber ? (
                      <div className="mt-3 text-sm text-sky-700 flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading live cut matches...
                      </div>
                    ) : liveCutMatches.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        {liveCutMatches.map((match) => (
                          <div
                            key={match.key}
                            className="rounded border border-sky-100 bg-white/90 px-3 py-2"
                          >
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <span className="px-2 py-0.5 rounded bg-sky-100 text-sky-700">
                                {match.source}
                              </span>
                              {match.cutId ? (
                                <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-mono">
                                  {match.cutId}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700">
                                  No CutID yet
                                </span>
                              )}
                              {match.status && (
                                <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                                  {match.status}
                                </span>
                              )}
                              {match.manuallyLinked && (
                                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">
                                  Manual link
                                </span>
                              )}
                              {match.fileChainLinked ? (
                                <span className="px-2 py-0.5 rounded bg-green-100 text-green-700">
                                  File chain linked
                                  {match.fileChainStatus ? `: ${match.fileChainStatus}` : ''}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700">
                                  Candidate only
                                </span>
                              )}
                            </div>
                            <div className="mt-2 text-sm text-gray-800 break-all">{match.name}</div>
                            <div className="text-xs text-gray-500 break-all">{match.detail}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-3 text-sm text-sky-700">
                        No live cut matches are linked yet. Use{' '}
                        <span className="font-medium">Link CutID</span> to connect a Thrive Cut or
                        Zund Queue job when automatic matching misses it.
                      </div>
                    )}
                  </div>

                  {isScreenPrintOrder && (
                    <div className="rounded-lg border border-purple-200 bg-purple-50/60 p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold text-purple-800 uppercase flex items-center gap-1">
                            <Printer className="w-3 h-3" />
                            Screen Print
                          </p>
                          <p className="text-xs text-purple-700 mt-0.5">
                            {screenPrintProgress
                              ? screenPrintProgress.status === 'COMPLETED'
                                ? 'Completed'
                                : screenPrintProgress.status === 'IN_PROGRESS'
                                  ? 'In Progress'
                                  : 'Not Started'
                              : 'Not Started'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {(!screenPrintProgress ||
                            screenPrintProgress.status === 'NOT_STARTED') && (
                            <button
                              onClick={() =>
                                handleScreenPrintStation(order.id, order.orderNumber, 'start')
                              }
                              disabled={screenPrintWorking === order.id}
                              className="flex items-center gap-1 px-3 py-1.5 text-sm text-purple-700 hover:bg-purple-100 rounded-lg disabled:opacity-60"
                            >
                              <PlayCircle className="w-4 h-4" />
                              Start
                            </button>
                          )}
                          {screenPrintProgress?.status === 'IN_PROGRESS' && (
                            <button
                              onClick={() =>
                                handleScreenPrintStation(order.id, order.orderNumber, 'complete')
                              }
                              disabled={screenPrintWorking === order.id}
                              className="flex items-center gap-1 px-3 py-1.5 text-sm text-white bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-60"
                            >
                              <CheckCircle className="w-4 h-4" />
                              Complete
                            </button>
                          )}
                          {screenPrintProgress?.status === 'COMPLETED' && (
                            <button
                              onClick={() =>
                                handleScreenPrintStation(order.id, order.orderNumber, 'uncomplete')
                              }
                              disabled={screenPrintWorking === order.id}
                              className="flex items-center gap-1 px-3 py-1.5 text-sm text-purple-700 hover:bg-purple-100 rounded-lg disabled:opacity-60"
                            >
                              <Undo2 className="w-4 h-4" />
                              Undo
                            </button>
                          )}
                          {screenPrintWorking === order.id && (
                            <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {order.lineItems && order.lineItems.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-600 uppercase mb-1">
                        Line Items
                      </p>
                      <div className="space-y-1">
                        {order.lineItems.map((lineItem) => (
                          <div
                            key={lineItem.id}
                            className="text-sm text-gray-700 flex items-center gap-2"
                          >
                            <Package className="w-3 h-3 text-gray-400" />
                            {lineItem.description} - Qty: {lineItem.quantity}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-2 border-t">
                    <button
                      onClick={() => {
                        setReprintModal({ orderId: order.id, orderNumber: order.orderNumber });
                        setReprintDesc('');
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 bg-red-50 hover:bg-red-100 rounded-lg"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Request Reprint
                    </button>
                    <button
                      onClick={() => handleMaterialRequest(order.id, order.orderNumber)}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-lg"
                    >
                      <Package className="w-4 h-4" />
                      Request Material
                    </button>
                    <button
                      onClick={() => {
                        setRevisionModal({ orderId: order.id, orderNumber: order.orderNumber });
                        setRevisionNotes('');
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg"
                    >
                      <Palette className="w-4 h-4" />
                      Flag Revision
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {reprintModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setReprintModal(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              Request Reprint - {reprintModal.orderNumber}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <select
                  value={reprintReason}
                  onChange={(e) => setReprintReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="PRINT_DEFECT">Print Defect</option>
                  <option value="CUSTOMER_CHANGE">Customer Change</option>
                  <option value="MATERIAL_DEFECT">Material Defect</option>
                  <option value="WRONG_SIZE">Wrong Size</option>
                  <option value="DAMAGED">Damaged</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={reprintDesc}
                  onChange={(e) => setReprintDesc(e.target.value)}
                  placeholder="Describe what needs reprinting..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm h-24 resize-none"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setReprintModal(null)}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReprintRequest}
                  disabled={!reprintDesc.trim()}
                  className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
                >
                  Submit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {revisionModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setRevisionModal(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              Flag Revision - {revisionModal.orderNumber}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <select
                  value={revisionReason}
                  onChange={(e) => setRevisionReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="WRONG_SIZE">Wrong Size</option>
                  <option value="COLORS_OFF">Colors Off</option>
                  <option value="WRONG_MATERIAL">Wrong Material</option>
                  <option value="LAYOUT_ISSUE">Layout Issue</option>
                  <option value="TEXT_ERROR">Text Error</option>
                  <option value="FILE_CORRUPT">File Corrupt</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={revisionNotes}
                  onChange={(e) => setRevisionNotes(e.target.value)}
                  placeholder="Describe the issue..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm h-24 resize-none"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setRevisionModal(null)}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRevisionRequest}
                  className="px-4 py-2 text-sm text-white bg-purple-600 hover:bg-purple-700 rounded-lg"
                >
                  Submit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {linkCutModalOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={closeLinkCutModal}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Link2 className="h-5 w-5 text-sky-600" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Link CutID</h3>
                  <p className="text-xs text-gray-500">{linkCutModalOrder.orderNumber}</p>
                </div>
              </div>
              <button
                onClick={closeLinkCutModal}
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 border-b border-gray-100 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={cutLinkSearch}
                  onChange={(e) => setCutLinkSearch(e.target.value)}
                  placeholder="Search by CutID, job name, file name, or material..."
                  className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg"
                  autoFocus
                />
              </div>
              <p className="text-xs text-gray-500">
                Link a live Thrive Cut or Zund Queue job when automatic order matching misses it.
              </p>
            </div>

            <div className="flex-1 overflow-auto p-4">
              {loadingUnlinkedCutData ? (
                <div className="flex items-center justify-center py-8 text-gray-400">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Loading available cut matches...
                </div>
              ) : cutCandidates.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Scissors className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">
                    {cutLinkSearch.trim()
                      ? 'No matching cut jobs found'
                      : 'No unlinked cut jobs available'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {cutCandidates.map((candidate) => {
                    const candidateKey = `${candidate.type}:${candidate.identifier}`;
                    const isLinking = linkingCutCandidateKey === candidateKey;

                    return (
                      <button
                        key={candidateKey}
                        onClick={() => handleLinkCutCandidate(candidate)}
                        disabled={Boolean(linkingCutCandidateKey)}
                        className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-sky-300 hover:bg-sky-50 transition-all disabled:opacity-60"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 break-all">
                              {candidate.name}
                            </p>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                {candidate.source === 'Thrive Cut' ? (
                                  <Scissors className="h-3 w-3" />
                                ) : (
                                  <HardDrive className="h-3 w-3" />
                                )}
                                {candidate.source}
                              </span>
                              {candidate.cutId && (
                                <span className="font-mono text-gray-700">{candidate.cutId}</span>
                              )}
                              {candidate.detail && <span>{candidate.detail}</span>}
                            </div>
                          </div>
                          {isLinking && (
                            <Loader2 className="h-4 w-4 animate-spin text-sky-600 shrink-0" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
