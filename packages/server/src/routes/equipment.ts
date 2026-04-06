import { Router, Response } from 'express';
import { promises as fs } from 'fs';
import { prisma } from '../db/client.js';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { BadRequestError, NotFoundError } from '../middleware/error-handler.js';
import { logActivity, ActivityAction, EntityType } from '../lib/activity-logger.js';
import { broadcast } from '../ws/server.js';
import {
  pollPrinterStatus,
  checkDeviceConnectivity,
  pollAllEquipment,
  getAllCachedStatuses,
  setCachedStatus,
  getLastPollTime,
  setLastPollTime,
  POLL_INTERVAL_MS,
  deepPollPrinterStatus,
  setCachedEWSData,
} from '../services/printer-monitor.js';
import { TtlCache } from '../lib/ttl-cache.js';

// Cache live-detail results for 60s (stale-while-revalidate serves stale data while refreshing)
const liveDetailCache = new TtlCache<any>(60_000);
const portScanCache = new TtlCache<Record<string, boolean>>(86_400_000); // 24h TTL
const deepSnmpCache = new TtlCache<any>(86_400_000); // 24h TTL for deep SNMP data
import {
  getZundDashboard,
  getAvailableZunds,
  isZundStatsAccessible,
} from '../services/zund-stats.js';
import { pollHPEWS } from '../services/hp-ews.js';
import { pollHPLEDM } from '../services/hp-ledm.js';
import { pollVUTEk, isVUTEkIP } from '../services/vutek.js';
import { pollVUTEkInk, forceRefreshVUTEkInk } from '../services/vutek-ink.js';
import {
  getAllFieryJobs,
  linkFieryJobsToOrders,
  type FieryJob,
  type FieryJobLinked,
} from '../services/fiery.js';
import {
  CreateEquipmentSchema,
  UpdateEquipmentSchema,
  EquipmentFilterSchema,
  CreateMaintenanceScheduleSchema,
  UpdateMaintenanceScheduleSchema,
  MaintenanceScheduleFilterSchema,
  CreateMaintenanceLogSchema,
  UpdateMaintenanceLogSchema,
  MaintenanceLogFilterSchema,
  CreateDowntimeEventSchema,
  UpdateDowntimeEventSchema,
  ResolveDowntimeEventSchema,
  DowntimeEventFilterSchema,
  EquipmentStatus,
} from '@erp/shared';

const router = Router();
const REMOTE_SHARE_REACHABILITY_TIMEOUT_MS = 3000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout: ${label} (${ms}ms)`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function isRemotePathAccessible(path: string, label: string): Promise<boolean> {
  try {
    await withTimeout(fs.access(path), REMOTE_SHARE_REACHABILITY_TIMEOUT_MS, label);
    return true;
  } catch {
    return false;
  }
}

// All routes require authentication
router.use(authenticate);

// ============ Equipment ============

// GET /equipment - List all equipment
router.get('/', async (req: AuthRequest, res) => {
  const filters = EquipmentFilterSchema.parse(req.query);
  const { page, pageSize, search, type, station, status, includeRetired, sortBy, sortOrder } =
    filters;
  const skip = (page - 1) * pageSize;

  const where: any = {};

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { manufacturer: { contains: search, mode: 'insensitive' } },
      { model: { contains: search, mode: 'insensitive' } },
      { serialNumber: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (type) {
    where.type = type;
  }

  if (station) {
    where.station = station;
  }

  if (status) {
    where.status = status;
  } else if (!includeRetired) {
    where.status = { not: 'RETIRED' };
  }

  const [items, total] = await Promise.all([
    prisma.equipment.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { [sortBy]: sortOrder },
      include: {
        _count: {
          select: {
            maintenanceSchedules: true,
            maintenanceLogs: true,
            downtimeEvents: true,
          },
        },
      },
    }),
    prisma.equipment.count({ where }),
  ]);

  res.json({
    success: true,
    data: {
      items,
      total,
      page,
      pageSize,
      pages: Math.ceil(total / pageSize),
    },
  });
});

// GET /equipment/stats - Get equipment statistics
router.get('/stats', async (req: AuthRequest, res) => {
  const [
    totalEquipment,
    operational,
    maintenance,
    down,
    retired,
    activeDowntime,
    overdueSchedules,
  ] = await Promise.all([
    prisma.equipment.count(),
    prisma.equipment.count({ where: { status: 'OPERATIONAL' } }),
    prisma.equipment.count({ where: { status: 'MAINTENANCE' } }),
    prisma.equipment.count({ where: { status: 'DOWN' } }),
    prisma.equipment.count({ where: { status: 'RETIRED' } }),
    prisma.downtimeEvent.count({ where: { endedAt: null } }),
    prisma.maintenanceSchedule.count({
      where: {
        isActive: true,
        nextDue: { lt: new Date() },
      },
    }),
  ]);

  res.json({
    success: true,
    data: {
      totalEquipment,
      operational,
      maintenance,
      down,
      retired,
      activeDowntime,
      overdueSchedules,
    },
  });
});

// GET /equipment/live-status — Get live connectivity status of ALL equipment with IPs
let lastEquipmentPollTime = 0;
const EQUIPMENT_POLL_INTERVAL = 20000; // 20 seconds

router.get('/live-status', async (req: AuthRequest, res: Response) => {
  const { force } = req.query;

  // Get all equipment that have IP addresses configured
  const equipment = await prisma.equipment.findMany({
    where: { ipAddress: { not: null } },
    orderBy: { name: 'asc' },
  });

  if (equipment.length === 0) {
    res.json({ success: true, data: [], message: 'No equipment with IP addresses configured' });
    return;
  }

  const now = Date.now();
  const shouldPoll = force === 'true' || now - lastEquipmentPollTime > EQUIPMENT_POLL_INTERVAL;

  if (shouldPoll) {
    const toPoll = equipment
      .filter((e) => e.ipAddress)
      .map((e) => ({
        id: e.id,
        ipAddress: e.ipAddress!,
        connectionType: (e as any).connectionType || 'PING',
        snmpCommunity: (e as any).snmpCommunity || 'public',
      }));

    const results = await pollAllEquipment(toPoll);

    // Update cache and sync DB status
    for (const [eqId, status] of results) {
      setCachedStatus(eqId, status);
    }

    setLastPollTime(now);
    lastEquipmentPollTime = now;
    const statusArray = Array.from(results.entries()).map(([id, s]) => ({ ...s, equipmentId: id }));
    broadcast({ type: 'EQUIPMENT_LIVE_STATUS', payload: statusArray, timestamp: new Date() });

    // Persist to EquipmentDataCache for cold-start hydration (fire-and-forget)
    Promise.allSettled(
      Array.from(results.entries()).map(([eqId, status]) =>
        prisma.equipmentDataCache.upsert({
          where: { sourceType_sourceKey: { sourceType: 'PRINTER_STATUS', sourceKey: eqId } },
          update: { data: status as any, capturedAt: new Date(), cachedAt: new Date() },
          create: {
            equipmentId: eqId,
            sourceType: 'PRINTER_STATUS',
            sourceKey: eqId,
            data: status as any,
            capturedAt: new Date(),
          },
        })
      )
    ).catch(() => {});
  }

  // Return cached statuses
  const allStatuses = getAllCachedStatuses();
  const response = equipment.map((e) => {
    const cached = allStatuses.get(e.id);
    return {
      equipmentId: e.id,
      name: e.name,
      type: e.type,
      ipAddress: e.ipAddress,
      connectionType: (e as any).connectionType || 'PING',
      station: e.station,
      reachable: cached?.reachable ?? false,
      state: cached?.state ?? 'offline',
      stateMessage: cached?.stateMessage ?? null,
      systemName: cached?.systemName ?? null,
      systemDescription: cached?.systemDescription ?? null,
      lastPolled: cached?.lastPolled ?? null,
      supplies: cached?.supplies ?? [],
      alerts: cached?.alerts ?? [],
      errorMessage: cached?.errorMessage ?? null,
    };
  });

  res.json({ success: true, data: response });
});

// ============ VUTEk Ink Data ============
// These must be registered BEFORE /:id routes to avoid Express matching 'vutek' as an :id param

// GET /equipment/vutek/ink - Get VuTek ink data (bags, usage, RFID status)
router.get('/vutek/ink', async (_req: AuthRequest, res) => {
  try {
    const inkData = await pollVUTEkInk();
    res.json({ success: true, data: inkData });
  } catch (err: any) {
    console.error('[VUTEk-Ink] Error:', err.message);
    res
      .status(500)
      .json({ success: false, message: 'Failed to get VuTek ink data', error: err.message });
  }
});

// POST /equipment/vutek/ink/refresh - Force refresh VuTek ink data
router.post('/vutek/ink/refresh', async (_req: AuthRequest, res) => {
  try {
    const inkData = await forceRefreshVUTEkInk();
    res.json({ success: true, data: inkData });
  } catch (err: any) {
    console.error('[VUTEk-Ink] Refresh error:', err.message);
    res
      .status(500)
      .json({ success: false, message: 'Failed to refresh VuTek ink data', error: err.message });
  }
});

// PUT /equipment/:id/connectivity — Set IP address and connection type for any equipment
router.put('/:id/connectivity', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { ipAddress, connectionType, snmpCommunity } = req.body;

  const updated = await prisma.equipment.update({
    where: { id },
    data: {
      ipAddress: ipAddress || null,
      snmpCommunity: snmpCommunity || 'public',
      connectionType: connectionType || 'PING',
    },
  });

  // Immediately poll the device if IP was set
  if (ipAddress) {
    try {
      const connType = connectionType || 'PING';
      const status =
        connType === 'SNMP'
          ? await pollPrinterStatus(id, ipAddress, snmpCommunity || 'public')
          : await checkDeviceConnectivity(id, ipAddress, connType, snmpCommunity || 'public');
      setCachedStatus(id, status);

      res.json({
        success: true,
        data: updated,
        liveStatus: {
          reachable: status.reachable,
          state: status.state,
          systemName: status.systemName,
          systemDescription: status.systemDescription,
        },
      });
      return;
    } catch {
      // Poll failed but IP was saved
    }
  }

  res.json({ success: true, data: updated });
});

// POST /equipment/bulk-assign-ips — Assign IPs to multiple equipment at once
router.post('/bulk-assign-ips', async (req: AuthRequest, res: Response) => {
  const { assignments } = req.body;
  // assignments: Array<{ equipmentId: string, ipAddress: string, connectionType?: string }>

  if (!Array.isArray(assignments) || assignments.length === 0) {
    throw BadRequestError('assignments array is required');
  }

  const results = [];
  for (const a of assignments) {
    try {
      const updated = await prisma.equipment.update({
        where: { id: a.equipmentId },
        data: {
          ipAddress: a.ipAddress,
          connectionType: a.connectionType || 'PING',
          snmpCommunity: a.snmpCommunity || 'public',
        },
      });
      results.push({ equipmentId: a.equipmentId, success: true, name: updated.name });
    } catch (err: any) {
      results.push({ equipmentId: a.equipmentId, success: false, error: err.message });
    }
  }

  res.json({ success: true, data: results });
});

// GET /equipment/:id - Get equipment by ID
router.get('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;

  const equipment = await prisma.equipment.findUnique({
    where: { id },
    include: {
      maintenanceSchedules: {
        where: { isActive: true },
        orderBy: { nextDue: 'asc' },
      },
      maintenanceLogs: {
        take: 10,
        orderBy: { performedAt: 'desc' },
        include: {
          performedBy: { select: { id: true, displayName: true } },
        },
      },
      downtimeEvents: {
        take: 10,
        orderBy: { startedAt: 'desc' },
        include: {
          reportedBy: { select: { id: true, displayName: true } },
          resolvedBy: { select: { id: true, displayName: true } },
        },
      },
    },
  });

  if (!equipment) {
    throw NotFoundError('Equipment not found');
  }

  res.json({ success: true, data: equipment });
});

// GET /equipment/:id/live-detail - Deep live status for a single piece of equipment
// Uses stale-while-revalidate: returns cached/stale data instantly, refreshes in background
router.get('/:id/live-detail', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  try {
    const data = await liveDetailCache.getOrFetchStale(id, async () => {
      const equipment = await prisma.equipment.findUnique({
        where: { id },
      });

      if (!equipment) {
        throw NotFoundError('Equipment not found');
      }

      const result: any = {
        equipmentId: id,
        name: equipment.name,
        connectionType: (equipment as any).connectionType || null,
        ipAddress: equipment.ipAddress || null,
      };

      const connType = ((equipment as any).connectionType || '').toUpperCase();
      const ip = equipment.ipAddress;

      // ── Run all independent network probes in parallel ──
      const probes: Promise<void>[] = [];

      // Probe 1: Basic live status (SNMP or connectivity check)
      if (ip) {
        probes.push(
          (async () => {
            try {
              let liveStatus;
              if (connType === 'SNMP') {
                liveStatus = await pollPrinterStatus(
                  id,
                  ip,
                  (equipment as any).snmpCommunity || 'public'
                );
              } else {
                liveStatus = await checkDeviceConnectivity(
                  id,
                  ip,
                  connType,
                  (equipment as any).snmpCommunity || 'public'
                );
              }
              setCachedStatus(id, liveStatus);
              result.live = {
                reachable: liveStatus.reachable,
                state: liveStatus.state,
                stateMessage: liveStatus.stateMessage,
                systemName: liveStatus.systemName,
                systemDescription: liveStatus.systemDescription,
                lastPolled: liveStatus.lastPolled,
                supplies: liveStatus.supplies,
                alerts: liveStatus.alerts,
                errorMessage: liveStatus.errorMessage,
              };
            } catch (err: any) {
              result.live = { reachable: false, state: 'offline', errorMessage: err.message };
            }
          })()
        );
      }

      // Probe 2: Deep SNMP data (page count, media trays, uptime, cover status) — 24h cache
      if (ip && connType === 'SNMP') {
        probes.push(
          (async () => {
            try {
              result.deep = await deepSnmpCache.getOrFetchStale(ip, async () => {
                return await Promise.race([
                  deepPollPrinterStatus(ip, (equipment as any).snmpCommunity || 'public'),
                  new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('Deep SNMP poll timed out after 30s')), 30000)
                  ),
                ]);
              });
            } catch (err: any) {
              result.deep = { error: err.message };
            }
          })()
        );
      }

      // Probe 3: Zund stats
      const nameLower = equipment.name.toLowerCase();
      if (nameLower.includes('zund') || nameLower.includes('cutter')) {
        probes.push(
          (async () => {
            try {
              const availableZunds = getAvailableZunds();
              let zundId: string | null = null;
              if (nameLower.includes('2') || nameLower.includes('second')) {
                zundId = 'zund2';
              } else if (nameLower.includes('1') || nameLower.includes('first')) {
                zundId = 'zund1';
              } else if (availableZunds.length > 0) {
                zundId = availableZunds[0];
              }

              if (zundId && availableZunds.includes(zundId)) {
                const accessible = await isZundStatsAccessible(zundId);
                if (accessible) {
                  result.zund = await getZundDashboard(zundId);
                  result.zund.zundId = zundId;
                  result.zund.accessible = true;
                } else {
                  result.zund = {
                    zundId,
                    accessible: false,
                    message: 'Statistics database not accessible',
                  };
                }
              } else {
                result.zund = {
                  available: availableZunds,
                  message: 'No matching Zund stats found',
                };
              }
            } catch (err: any) {
              result.zund = { error: err.message };
            }
          })()
        );
      }

      // Probe 4: Port scan + NetBIOS (all devices with IP) — 24h cache
      if (ip) {
        probes.push(
          (async () => {
            try {
              const cachedPorts = portScanCache.get(ip);
              if (cachedPorts) {
                result.ports = cachedPorts;
                return;
              }

              const net = await import('net');
              const tcpCheck = (port: number, timeout = 2000): Promise<boolean> =>
                new Promise((resolve) => {
                  const s = new net.Socket();
                  s.setTimeout(timeout);
                  s.on('connect', () => {
                    s.destroy();
                    resolve(true);
                  });
                  s.on('timeout', () => {
                    s.destroy();
                    resolve(false);
                  });
                  s.on('error', () => {
                    s.destroy();
                    resolve(false);
                  });
                  s.connect(port, ip);
                });

              const portDefs = [
                { key: 'http', port: 80 },
                { key: 'https', port: 443 },
                { key: 'smb', port: 445 },
                { key: 'rdp', port: 3389 },
                { key: 'vnc', port: 5900 },
                { key: 'ssh', port: 22 },
                { key: 'ipp', port: 631 },
                { key: 'winrm', port: 5985 },
                { key: 'snmp', port: 161 },
                { key: 'rpc', port: 135 },
              ];

              const checks = await Promise.allSettled(portDefs.map(({ port }) => tcpCheck(port)));

              result.ports = {};
              portDefs.forEach(({ key }, i) => {
                result.ports[key] = (checks[i] as any).value ?? false;
              });

              portScanCache.set(ip, result.ports);

              // NetBIOS hostname lookup if SMB port is open
              if (result.ports.smb || connType === 'SMB') {
                try {
                  const { exec } = await import('child_process');
                  const { promisify } = await import('util');
                  const execAsync = promisify(exec);
                  const { stdout } = await execAsync(`nbtstat -A ${ip}`, { timeout: 5000 });
                  const match = stdout.match(/^\s+(\S+)\s+<00>\s+UNIQUE/m);
                  if (match) {
                    result.smb = { hostname: match[1].trim() };
                  }
                } catch {}
              }
            } catch {}
          })()
        );
      }

      // Probe 5: HP EWS / LEDM — only for printers (SNMP/HTTP), not SMB file shares or cutters
      if (ip && connType !== 'SMB') {
        probes.push(
          (async () => {
            let ewsAvailable = false;

            // Try modern EWS (JSON) first
            try {
              const ewsData = await pollHPEWS(ip);
              if (ewsData.available && (ewsData.identity || ewsData.ink.length > 0)) {
                result.ews = ewsData;
                setCachedEWSData(id, ewsData);
                prisma.equipmentDataCache
                  .upsert({
                    where: { sourceType_sourceKey: { sourceType: 'HP_EWS', sourceKey: id } },
                    update: { data: ewsData as any, capturedAt: new Date(), cachedAt: new Date() },
                    create: {
                      equipmentId: id,
                      sourceType: 'HP_EWS',
                      sourceKey: id,
                      data: ewsData as any,
                      capturedAt: new Date(),
                    },
                  })
                  .catch(() => {});
                ewsAvailable = true;
              }
            } catch {}

            // Fall back to LEDM XML API for older HP Latex printers
            if (!ewsAvailable) {
              try {
                const ledmData = await pollHPLEDM(ip);
                if (ledmData.available) {
                  result.ews = ledmData;
                  setCachedEWSData(id, ledmData);
                  prisma.equipmentDataCache
                    .upsert({
                      where: { sourceType_sourceKey: { sourceType: 'HP_EWS', sourceKey: id } },
                      update: {
                        data: ledmData as any,
                        capturedAt: new Date(),
                        cachedAt: new Date(),
                      },
                      create: {
                        equipmentId: id,
                        sourceType: 'HP_EWS',
                        sourceKey: id,
                        data: ledmData as any,
                        capturedAt: new Date(),
                      },
                    })
                    .catch(() => {});
                }
              } catch {}
            }
          })()
        );
      }

      // Probe 6: VUTEk
      if (ip && isVUTEkIP(ip)) {
        probes.push(
          (async () => {
            try {
              const vutekData = await pollVUTEk();
              if (vutekData.available) {
                (result as any).vutek = vutekData;
              }
            } catch (err: any) {
              console.error('[VUTEk] Error polling VUTEk data:', err.message);
            }
          })()
        );

        // Probe 7: Fiery print logs (recent jobs with WO linking)
        probes.push(
          (async () => {
            try {
              const fieryJobs = await getAllFieryJobs();
              const linked = await linkFieryJobsToOrders(fieryJobs);
              // Most recent first, limit to 50
              const sorted = linked
                .sort((a, b) => {
                  const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
                  const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
                  return tb - ta;
                })
                .slice(0, 50);
              (result as any).fieryJobs = sorted;
            } catch (err: any) {
              console.error('[Fiery] Error fetching print logs:', err.message);
              (result as any).fieryJobs = [];
            }
          })()
        );
      }

      // Wait for all probes to settle (don't fail if one times out)
      await Promise.allSettled(probes);

      // Post-processing that depends on multiple probe results
      if (connType === 'SNMP') {
        // Enrich supply data with all raw fields
        if (result.live?.supplies) {
          result.live.supplies = result.live.supplies.map((s: any) => ({
            ...s,
            rawLevel: s.currentLevel,
            rawMax: s.maxCapacity,
            colorHex: s.colorHex || s.color || null,
            supplyType: s.type || 'unknown',
          }));
        }

        // Expose raw SNMP metadata
        result.snmpMeta = {
          protocol: 'SNMPv2c',
          community: (equipment as any).snmpCommunity || 'public',
          pollTimestamp: new Date().toISOString(),
          oids: {
            SYS_DESCR: '1.3.6.1.2.1.1.1.0',
            SYS_NAME: '1.3.6.1.2.1.1.5.0',
            SYS_UPTIME: '1.3.6.1.2.1.1.3.0',
            HR_PRINTER_STATUS: '1.3.6.1.2.1.25.3.5.1.1.1',
            HR_DEVICE_STATUS: '1.3.6.1.2.1.25.3.2.1.5.1',
            PRT_COVER_STATUS: '1.3.6.1.2.1.43.6.1.1.3.1.1',
            PRT_CONSOLE_DISPLAY: '1.3.6.1.2.1.43.16.5.1.2.1.1',
            PRT_MARKER_SUPPLIES: '1.3.6.1.2.1.43.11.1.1.*',
            PRT_MARKER_COUNTER: '1.3.6.1.2.1.43.10.2.1.4',
            PRT_INPUT: '1.3.6.1.2.1.43.8.2.1.*',
            PRT_ALERT: '1.3.6.1.2.1.43.18.1.1.*',
          },
        };

        // EWS provides richer ink data than SNMP - clear SNMP supplies to avoid duplicates
        if (result.ews?.ink?.length > 0 && result.live?.supplies) {
          result.live.supplies = [];
        }
      }

      return result;
    });

    res.json({ success: true, data });
  } catch (err: any) {
    if (err.status === 404) {
      res.status(404).json({ success: false, error: err.message });
    } else {
      console.error('[LiveDetail] Error:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  }
});

// POST /equipment - Create equipment
router.post('/', async (req: AuthRequest, res) => {
  const data = CreateEquipmentSchema.parse(req.body);

  const equipment = await prisma.equipment.create({
    data,
  });

  await logActivity({
    action: ActivityAction.CREATE,
    entityType: EntityType.OTHER,
    entityId: equipment.id,
    description: `Created equipment: ${equipment.name}`,
    userId: req.userId,
    req,
  });

  broadcast({ type: 'EQUIPMENT_CREATED', payload: equipment });

  res.status(201).json({ success: true, data: equipment });
});

// PUT /equipment/:id - Update equipment
router.put('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;
  const data = UpdateEquipmentSchema.parse(req.body);

  const existing = await prisma.equipment.findUnique({ where: { id } });
  if (!existing) {
    throw NotFoundError('Equipment not found');
  }

  const equipment = await prisma.equipment.update({
    where: { id },
    data,
  });

  await logActivity({
    action: ActivityAction.UPDATE,
    entityType: EntityType.OTHER,
    entityId: equipment.id,
    description: `Updated equipment: ${equipment.name}`,
    userId: req.userId,
    req,
  });

  broadcast({ type: 'EQUIPMENT_UPDATED', payload: equipment });

  res.json({ success: true, data: equipment });
});

// PUT /equipment/:id/status - Update equipment status
router.put('/:id/status', async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { status, reason } = req.body;

  if (!Object.values(EquipmentStatus).includes(status)) {
    throw BadRequestError('Invalid status');
  }

  const existing = await prisma.equipment.findUnique({ where: { id } });
  if (!existing) {
    throw NotFoundError('Equipment not found');
  }

  const equipment = await prisma.equipment.update({
    where: { id },
    data: { status },
  });

  await logActivity({
    action: ActivityAction.UPDATE,
    entityType: EntityType.OTHER,
    entityId: equipment.id,
    description: `Changed equipment status: ${existing.status} → ${status}${reason ? ` (${reason})` : ''}`,
    userId: req.userId,
    req,
  });

  broadcast({ type: 'EQUIPMENT_STATUS_CHANGED', payload: equipment });

  res.json({ success: true, data: equipment });
});

// DELETE /equipment/:id - Delete equipment
router.delete('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;

  const existing = await prisma.equipment.findUnique({ where: { id } });
  if (!existing) {
    throw NotFoundError('Equipment not found');
  }

  await prisma.equipment.delete({ where: { id } });

  await logActivity({
    action: ActivityAction.DELETE,
    entityType: EntityType.OTHER,
    entityId: id,
    description: `Deleted equipment: ${existing.name}`,
    userId: req.userId,
    req,
  });

  broadcast({ type: 'EQUIPMENT_DELETED', payload: { id } });

  res.json({ success: true, message: 'Equipment deleted' });
});

// ============ Maintenance Schedules ============

// GET /equipment/schedules - List all maintenance schedules
router.get('/schedules/all', async (req: AuthRequest, res) => {
  const filters = MaintenanceScheduleFilterSchema.parse(req.query);
  const { page, pageSize, equipmentId, frequency, isActive, overdue, dueSoon, sortBy, sortOrder } =
    filters;
  const skip = (page - 1) * pageSize;

  const where: any = {};

  if (equipmentId) {
    where.equipmentId = equipmentId;
  }

  if (frequency) {
    where.frequency = frequency;
  }

  if (isActive !== undefined) {
    where.isActive = isActive;
  }

  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  if (overdue) {
    where.nextDue = { lt: now };
    where.isActive = true;
  } else if (dueSoon) {
    where.nextDue = { gte: now, lte: weekFromNow };
    where.isActive = true;
  }

  const [items, total] = await Promise.all([
    prisma.maintenanceSchedule.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { [sortBy]: sortOrder },
      include: {
        equipment: { select: { id: true, name: true, type: true, status: true } },
      },
    }),
    prisma.maintenanceSchedule.count({ where }),
  ]);

  res.json({
    success: true,
    data: {
      items,
      total,
      page,
      pageSize,
      pages: Math.ceil(total / pageSize),
    },
  });
});

// POST /equipment/:equipmentId/schedules - Create maintenance schedule
router.post('/:equipmentId/schedules', async (req: AuthRequest, res) => {
  const { equipmentId } = req.params;
  const data = CreateMaintenanceScheduleSchema.parse({ ...req.body, equipmentId });

  const equipment = await prisma.equipment.findUnique({ where: { id: equipmentId } });
  if (!equipment) {
    throw NotFoundError('Equipment not found');
  }

  const schedule = await prisma.maintenanceSchedule.create({
    data,
    include: {
      equipment: { select: { id: true, name: true } },
    },
  });

  await logActivity({
    action: ActivityAction.CREATE,
    entityType: EntityType.OTHER,
    entityId: schedule.id,
    description: `Created maintenance schedule "${schedule.taskName}" for ${equipment.name}`,
    userId: req.userId,
    req,
  });

  res.status(201).json({ success: true, data: schedule });
});

// PUT /equipment/schedules/:id - Update maintenance schedule
router.put('/schedules/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;
  const data = UpdateMaintenanceScheduleSchema.parse(req.body);

  const existing = await prisma.maintenanceSchedule.findUnique({
    where: { id },
    include: { equipment: { select: { name: true } } },
  });
  if (!existing) {
    throw NotFoundError('Maintenance schedule not found');
  }

  const schedule = await prisma.maintenanceSchedule.update({
    where: { id },
    data,
    include: {
      equipment: { select: { id: true, name: true } },
    },
  });

  await logActivity({
    action: ActivityAction.UPDATE,
    entityType: EntityType.OTHER,
    entityId: schedule.id,
    description: `Updated maintenance schedule "${schedule.taskName}"`,
    userId: req.userId,
    req,
  });

  res.json({ success: true, data: schedule });
});

// DELETE /equipment/schedules/:id - Delete maintenance schedule
router.delete('/schedules/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;

  const existing = await prisma.maintenanceSchedule.findUnique({ where: { id } });
  if (!existing) {
    throw NotFoundError('Maintenance schedule not found');
  }

  await prisma.maintenanceSchedule.delete({ where: { id } });

  await logActivity({
    action: ActivityAction.DELETE,
    entityType: EntityType.OTHER,
    entityId: id,
    description: `Deleted maintenance schedule "${existing.taskName}"`,
    userId: req.userId,
    req,
  });

  res.json({ success: true, message: 'Maintenance schedule deleted' });
});

// ============ Maintenance Logs ============

// GET /equipment/logs - List all maintenance logs
router.get('/logs/all', async (req: AuthRequest, res) => {
  const filters = MaintenanceLogFilterSchema.parse(req.query);
  const {
    page,
    pageSize,
    equipmentId,
    scheduleId,
    performedById,
    fromDate,
    toDate,
    sortBy,
    sortOrder,
  } = filters;
  const skip = (page - 1) * pageSize;

  const where: any = {};

  if (equipmentId) {
    where.equipmentId = equipmentId;
  }

  if (scheduleId) {
    where.scheduleId = scheduleId;
  }

  if (performedById) {
    where.performedById = performedById;
  }

  if (fromDate || toDate) {
    where.performedAt = {};
    if (fromDate) where.performedAt.gte = fromDate;
    if (toDate) where.performedAt.lte = toDate;
  }

  const [items, total] = await Promise.all([
    prisma.maintenanceLog.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { [sortBy]: sortOrder },
      include: {
        equipment: { select: { id: true, name: true, type: true } },
        performedBy: { select: { id: true, displayName: true } },
        schedule: { select: { id: true, taskName: true } },
      },
    }),
    prisma.maintenanceLog.count({ where }),
  ]);

  res.json({
    success: true,
    data: {
      items,
      total,
      page,
      pageSize,
      pages: Math.ceil(total / pageSize),
    },
  });
});

// POST /equipment/:equipmentId/logs - Create maintenance log
router.post('/:equipmentId/logs', async (req: AuthRequest, res) => {
  const { equipmentId } = req.params;
  const data = CreateMaintenanceLogSchema.parse({ ...req.body, equipmentId });

  const equipment = await prisma.equipment.findUnique({ where: { id: equipmentId } });
  if (!equipment) {
    throw NotFoundError('Equipment not found');
  }

  // If this is for a scheduled task, update the schedule
  let schedule = null;
  if (data.scheduleId) {
    schedule = await prisma.maintenanceSchedule.findUnique({ where: { id: data.scheduleId } });
    if (!schedule) {
      throw NotFoundError('Maintenance schedule not found');
    }
  }

  const log = await prisma.maintenanceLog.create({
    data: {
      ...data,
      performedById: req.userId!,
    },
    include: {
      equipment: { select: { id: true, name: true } },
      performedBy: { select: { id: true, displayName: true } },
    },
  });

  // Update schedule if this was a scheduled task
  if (schedule) {
    let nextDue = new Date(data.performedAt || new Date());
    switch (schedule.frequency) {
      case 'DAILY':
        nextDue.setDate(nextDue.getDate() + 1);
        break;
      case 'WEEKLY':
        nextDue.setDate(nextDue.getDate() + 7);
        break;
      case 'BIWEEKLY':
        nextDue.setDate(nextDue.getDate() + 14);
        break;
      case 'MONTHLY':
        nextDue.setMonth(nextDue.getMonth() + 1);
        break;
      case 'QUARTERLY':
        nextDue.setMonth(nextDue.getMonth() + 3);
        break;
      case 'BIANNUALLY':
        nextDue.setMonth(nextDue.getMonth() + 6);
        break;
      case 'YEARLY':
        nextDue.setFullYear(nextDue.getFullYear() + 1);
        break;
      case 'CUSTOM':
        if (schedule.intervalDays) {
          nextDue.setDate(nextDue.getDate() + schedule.intervalDays);
        }
        break;
    }

    await prisma.maintenanceSchedule.update({
      where: { id: schedule.id },
      data: {
        lastCompleted: data.performedAt || new Date(),
        nextDue,
      },
    });
  }

  await logActivity({
    action: ActivityAction.CREATE,
    entityType: EntityType.OTHER,
    entityId: log.id,
    description: `Logged maintenance "${log.taskName}" for ${equipment.name}`,
    userId: req.userId,
    req,
  });

  res.status(201).json({ success: true, data: log });
});

// PUT /equipment/logs/:id - Update maintenance log
router.put('/logs/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;
  const data = UpdateMaintenanceLogSchema.parse(req.body);

  const existing = await prisma.maintenanceLog.findUnique({ where: { id } });
  if (!existing) {
    throw NotFoundError('Maintenance log not found');
  }

  const log = await prisma.maintenanceLog.update({
    where: { id },
    data,
    include: {
      equipment: { select: { id: true, name: true } },
      performedBy: { select: { id: true, displayName: true } },
    },
  });

  res.json({ success: true, data: log });
});

// DELETE /equipment/logs/:id - Delete maintenance log
router.delete('/logs/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;

  const existing = await prisma.maintenanceLog.findUnique({ where: { id } });
  if (!existing) {
    throw NotFoundError('Maintenance log not found');
  }

  await prisma.maintenanceLog.delete({ where: { id } });

  res.json({ success: true, message: 'Maintenance log deleted' });
});

// ============ Downtime Events ============

// GET /equipment/downtime - List all downtime events
router.get('/downtime/all', async (req: AuthRequest, res) => {
  const filters = DowntimeEventFilterSchema.parse(req.query);
  const {
    page,
    pageSize,
    equipmentId,
    reason,
    impactLevel,
    isActive,
    fromDate,
    toDate,
    sortBy,
    sortOrder,
  } = filters;
  const skip = (page - 1) * pageSize;

  const where: any = {};

  if (equipmentId) {
    where.equipmentId = equipmentId;
  }

  if (reason) {
    where.reason = reason;
  }

  if (impactLevel) {
    where.impactLevel = impactLevel;
  }

  if (isActive !== undefined) {
    where.endedAt = isActive ? null : { not: null };
  }

  if (fromDate || toDate) {
    where.startedAt = {};
    if (fromDate) where.startedAt.gte = fromDate;
    if (toDate) where.startedAt.lte = toDate;
  }

  const [items, total] = await Promise.all([
    prisma.downtimeEvent.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { [sortBy]: sortOrder },
      include: {
        equipment: { select: { id: true, name: true, type: true, status: true } },
        reportedBy: { select: { id: true, displayName: true } },
        resolvedBy: { select: { id: true, displayName: true } },
      },
    }),
    prisma.downtimeEvent.count({ where }),
  ]);

  res.json({
    success: true,
    data: {
      items,
      total,
      page,
      pageSize,
      pages: Math.ceil(total / pageSize),
    },
  });
});

// POST /equipment/:equipmentId/downtime - Create downtime event
router.post('/:equipmentId/downtime', async (req: AuthRequest, res) => {
  const { equipmentId } = req.params;
  const data = CreateDowntimeEventSchema.parse({ ...req.body, equipmentId });

  const equipment = await prisma.equipment.findUnique({ where: { id: equipmentId } });
  if (!equipment) {
    throw NotFoundError('Equipment not found');
  }

  const event = await prisma.downtimeEvent.create({
    data: {
      ...data,
      reportedById: req.userId!,
    },
    include: {
      equipment: { select: { id: true, name: true } },
      reportedBy: { select: { id: true, displayName: true } },
    },
  });

  // Update equipment status to DOWN
  await prisma.equipment.update({
    where: { id: equipmentId },
    data: { status: 'DOWN' },
  });

  await logActivity({
    action: ActivityAction.CREATE,
    entityType: EntityType.OTHER,
    entityId: event.id,
    description: `Reported downtime for ${equipment.name}: ${data.reason}`,
    userId: req.userId,
    req,
  });

  broadcast({ type: 'EQUIPMENT_DOWN', payload: { equipment, event } });

  res.status(201).json({ success: true, data: event });
});

// PUT /equipment/downtime/:id - Update downtime event
router.put('/downtime/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;
  const data = UpdateDowntimeEventSchema.parse(req.body);

  const existing = await prisma.downtimeEvent.findUnique({ where: { id } });
  if (!existing) {
    throw NotFoundError('Downtime event not found');
  }

  if (existing.endedAt) {
    throw BadRequestError('Cannot update resolved downtime event');
  }

  const event = await prisma.downtimeEvent.update({
    where: { id },
    data,
    include: {
      equipment: { select: { id: true, name: true } },
      reportedBy: { select: { id: true, displayName: true } },
    },
  });

  res.json({ success: true, data: event });
});

// POST /equipment/downtime/:id/resolve - Resolve downtime event
router.post('/downtime/:id/resolve', async (req: AuthRequest, res) => {
  const { id } = req.params;
  const data = ResolveDowntimeEventSchema.parse(req.body);

  const existing = await prisma.downtimeEvent.findUnique({
    where: { id },
    include: { equipment: true },
  });
  if (!existing) {
    throw NotFoundError('Downtime event not found');
  }

  if (existing.endedAt) {
    throw BadRequestError('Downtime event already resolved');
  }

  const event = await prisma.downtimeEvent.update({
    where: { id },
    data: {
      ...data,
      resolvedById: req.userId!,
    },
    include: {
      equipment: { select: { id: true, name: true } },
      reportedBy: { select: { id: true, displayName: true } },
      resolvedBy: { select: { id: true, displayName: true } },
    },
  });

  // Check if there are other active downtime events for this equipment
  const otherActiveDowntime = await prisma.downtimeEvent.count({
    where: {
      equipmentId: existing.equipmentId,
      endedAt: null,
      id: { not: id },
    },
  });

  // If no other active downtime, set equipment to operational
  if (otherActiveDowntime === 0) {
    await prisma.equipment.update({
      where: { id: existing.equipmentId },
      data: { status: 'OPERATIONAL' },
    });
  }

  await logActivity({
    action: ActivityAction.UPDATE,
    entityType: EntityType.OTHER,
    entityId: event.id,
    description: `Resolved downtime for ${existing.equipment.name}: ${data.resolution}`,
    userId: req.userId,
    req,
  });

  broadcast({ type: 'EQUIPMENT_RESTORED', payload: { equipment: existing.equipment, event } });

  res.json({ success: true, data: event });
});

// DELETE /equipment/downtime/:id - Delete downtime event
router.delete('/downtime/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;

  const existing = await prisma.downtimeEvent.findUnique({ where: { id } });
  if (!existing) {
    throw NotFoundError('Downtime event not found');
  }

  await prisma.downtimeEvent.delete({ where: { id } });

  await logActivity({
    action: ActivityAction.DELETE,
    entityType: EntityType.OTHER,
    entityId: id,
    description: `Deleted downtime event`,
    userId: req.userId,
    req,
  });

  res.json({ success: true, message: 'Downtime event deleted' });
});

// ============ Zund Live Data ============

import { getZundLiveData, scanZundQueueFiles, type ZundLiveJob } from '../services/zund-live.js';

// GET /equipment/zund/cut-queue - Unified cut queue from ALL Zund sources (both machines)
router.get('/zund/cut-queue', async (req: AuthRequest, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;

    // Get data from both Zund machines
    const availableZunds = getAvailableZunds();
    const zundIds = availableZunds.length > 0 ? availableZunds : ['zund1', 'zund2'];

    const allJobs: ZundLiveJob[] = [];
    const seenIds = new Set<string>();
    let hasStatsDb = false;

    for (const zundId of zundIds) {
      try {
        const data = await getZundLiveData(zundId, {
          recentJobLimit: limit,
          zccLimit: limit,
        });
        if (data.hasStatsDb) hasStatsDb = true;

        for (const job of data.jobs) {
          if (!seenIds.has(job.id)) {
            seenIds.add(job.id);
            allJobs.push(job);
          }
        }
      } catch (err) {
        console.warn(`[Zund Cut Queue] Error getting data for ${zundId}:`, (err as Error).message);
      }
    }

    // Sort: active first, then queued, then completed (newest first)
    allJobs.sort((a, b) => {
      const statusOrder = { active: 0, queued: 1, completed: 2 };
      const sDiff = (statusOrder[a.status] ?? 2) - (statusOrder[b.status] ?? 2);
      if (sDiff !== 0) return sDiff;
      // Within same status, newest first
      const aTime = a.startTime || a.fileModified || '';
      const bTime = b.startTime || b.fileModified || '';
      return bTime.localeCompare(aTime);
    });

    const activeCount = allJobs.filter((j) => j.status === 'active').length;
    const queuedCount = allJobs.filter((j) => j.status === 'queued').length;
    const completedCount = allJobs.filter((j) => j.status === 'completed').length;
    const linkedCount = allJobs.filter((j) => j.workOrderNumber).length;

    res.json({
      success: true,
      data: {
        jobs: allJobs,
        hasStatsDb,
        summary: {
          activeCount,
          queuedCount,
          completedCount,
          totalJobs: allJobs.length,
          linkedCount,
          unlinkedCount: allJobs.length - linkedCount,
        },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    console.error('[Zund Cut Queue]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /equipment/zund/:zundId/live - Comprehensive live data for a Zund cutter
router.get('/zund/:zundId/live', async (req: AuthRequest, res) => {
  try {
    const { zundId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const zccLimit = parseInt(req.query.zccLimit as string) || 50;
    const data = await getZundLiveData(zundId, { recentJobLimit: limit, zccLimit, statsOnly: true });

    res.json({ success: true, data });
  } catch (err: any) {
    console.error('[Zund Live]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============ Thrive RIP Integration ============

import { thriveService, parseJobInfo } from '../services/thrive.js';
import { zundMatchService, normalizeJobName, extractCutId } from '../services/zund-match.js';
import {
  clearManualCutFileLinkForOrder,
  syncManualJobLinksToPrintCutLinks,
} from '../services/file-chain.js';

// GET /equipment/thrive/config - Get Thrive equipment configuration
router.get('/thrive/config', async (_req, res) => {
  res.json({
    success: true,
    data: {
      thrive: thriveService.config.machines,
      zund: thriveService.config.zundMachines,
      fiery: thriveService.config.fiery,
    },
  });
});

// GET /equipment/thrive/jobs - Get all print jobs from Thrive RIP queues
router.get('/thrive/jobs', async (_req, res) => {
  try {
    const { printJobs, cutJobs } = await thriveService.getAllJobs();

    // Link to work orders
    const linkedJobs = await thriveService.linkJobsToWorkOrders(printJobs);

    res.json({
      success: true,
      data: {
        printJobs: linkedJobs,
        cutJobs,
        summary: {
          totalPrintJobs: printJobs.length,
          totalCutJobs: cutJobs.length,
          linkedToWorkOrders: linkedJobs.filter((j) => j.workOrder).length,
        },
      },
    });
  } catch (error: any) {
    console.error('Error fetching Thrive jobs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Thrive jobs',
      message: error.message,
    });
  }
});

// GET /equipment/thrive/machine/:ip - Get print jobs for a specific RIP machine by IP
router.get('/thrive/machine/:ip', async (req: AuthRequest, res) => {
  try {
    const { ip } = req.params;

    // Find the machine config matching this IP
    const machine = thriveService.config.machines.find((m) => m.ip === ip);
    if (!machine) {
      return res.status(404).json({
        success: false,
        error: `No Thrive machine configured for IP ${ip}`,
      });
    }

    // Get print jobs for each printer on this machine
    const allJobs: any[] = [];
    for (const printer of machine.printers) {
      try {
        const jobs = await thriveService.parseQueueFile(printer.queuePath);
        allJobs.push(
          ...jobs.map((j) => ({
            ...j,
            printer: printer.name,
            printingMethod: printer.printingMethod,
          }))
        );
      } catch {
        // Skip inaccessible printer queues
      }
    }

    // Link to work orders
    const linkedJobs = await thriveService.linkJobsToWorkOrders(allJobs);

    // Flatten { job, workOrder } into the shape the frontend expects
    const flatPrintJobs = linkedJobs.map(({ job, workOrder }: any) => ({
      ...job,
      workOrder: workOrder
        ? {
            id: workOrder.id,
            orderNumber: workOrder.orderNumber,
            title: workOrder.description || workOrder.orderNumber,
            status: workOrder.status,
            customerName: workOrder.customerName,
          }
        : undefined,
    }));

    // Get cut jobs if this machine has a cutter path
    let cutJobs: any[] = [];
    if (machine.cutterPath) {
      try {
        cutJobs = await thriveService.scanCutFolder(machine.cutterPath);
      } catch {
        /* ignore */
      }
    }

    res.json({
      success: true,
      data: {
        machine: { id: machine.id, name: machine.name, ip: machine.ip },
        printJobs: flatPrintJobs,
        cutJobs,
        summary: {
          totalPrintJobs: allJobs.length,
          totalCutJobs: cutJobs.length,
          linkedToWorkOrders: flatPrintJobs.filter((j: any) => j.workOrder).length,
          printers: machine.printers.map((p) => p.name),
        },
      },
    });
  } catch (error: any) {
    console.error('Error fetching Thrive machine jobs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch machine jobs',
      message: error.message,
    });
  }
});

// GET /equipment/thrive/queue/:printer - Get queue for a specific printer
router.get('/thrive/queue/:printer', async (req, res) => {
  const { printer } = req.params;

  try {
    // Find the printer config
    let queuePath: string | null = null;
    for (const machine of thriveService.config.machines) {
      const printerConfig = machine.printers.find(
        (p) => p.name.toLowerCase() === printer.toLowerCase()
      );
      if (printerConfig) {
        queuePath = printerConfig.queuePath;
        break;
      }
    }

    if (!queuePath) {
      return res.status(404).json({
        success: false,
        error: `Printer "${printer}" not found in configuration`,
      });
    }

    const jobs = await thriveService.parseQueueFile(queuePath);
    const linkedJobs = await thriveService.linkJobsToWorkOrders(jobs);

    res.json({
      success: true,
      data: {
        printer,
        jobs: linkedJobs,
        count: jobs.length,
      },
    });
  } catch (error: any) {
    console.error(`Error fetching queue for ${printer}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch printer queue',
      message: error.message,
    });
  }
});

// GET /equipment/thrive/cuts - Get pending cut jobs
router.get('/thrive/cuts', async (req, res) => {
  try {
    const allCuts: any[] = [];

    for (const machine of thriveService.config.machines) {
      if (machine.cutterPath) {
        const cuts = await thriveService.scanCutFolder(machine.cutterPath);
        allCuts.push(
          ...cuts.map((cut) => ({
            ...cut,
            sourceMachine: machine.name,
          }))
        );
      }
    }

    res.json({
      success: true,
      data: {
        cuts: allCuts,
        count: allCuts.length,
      },
    });
  } catch (error: any) {
    console.error('Error fetching cut jobs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch cut jobs',
      message: error.message,
    });
  }
});

// GET /equipment/thrive/workorder/:orderNumber - Get jobs for specific work order
router.get('/thrive/workorder/:orderNumber', async (req, res) => {
  const { orderNumber } = req.params;

  try {
    // Run Thrive fetch and DB queries in parallel (they're independent)
    const [thriveResult, order] = await Promise.all([
      thriveService.getAllJobs(),
      prisma.workOrder.findFirst({
        where: { orderNumber },
        select: { id: true },
      }),
    ]);
    const { printJobs, cutJobs } = thriveResult;

    // Fetch dismissed jobs (depends on order result)
    const dismissedLinks = order
      ? await prisma.dismissedJobLink.findMany({
          where: { workOrderId: order.id },
          select: { jobType: true, jobIdentifier: true, id: true, reason: true },
        })
      : [];
    const dismissedSet = new Set(dismissedLinks.map((d) => `${d.jobType}:${d.jobIdentifier}`));

    // Filter by work order number — use parseJobInfo (same as file chain system)
    const bareNumber = orderNumber.replace(/^WO/i, '');
    const matchingPrintJobs = printJobs.filter((job) => {
      if (job.workOrderNumber === bareNumber) return true;
      const fromFile = parseJobInfo(job.fileName);
      const fromName = parseJobInfo(job.jobName);
      return fromFile.workOrderNumber === bareNumber || fromName.workOrderNumber === bareNumber;
    });

    // Collect GUIDs from matching print jobs for cut file cross-reference
    const printJobGuids = new Set<string>();
    for (const pj of matchingPrintJobs) {
      if (pj.jobGuid) printJobGuids.add(pj.jobGuid.toLowerCase());
    }

    // Pending cuts in Thrive queue — match by WO number OR by GUID link to print jobs
    const matchingCutJobs = cutJobs.filter((job) => {
      // Direct WO match via parseJobInfo
      if (job.workOrderNumber === bareNumber) return true;
      const cutInfo = parseJobInfo(job.jobName);
      if (cutInfo.workOrderNumber === bareNumber) return true;
      // GUID match: cut file GUID matches a print job for this WO
      if (job.guid && printJobGuids.has(job.guid.toLowerCase())) return true;
      return false;
    });

    // Track which GUIDs we've matched as cut files
    const matchedCutGuids = new Set<string>();
    for (const cj of matchingCutJobs) {
      if (cj.guid) matchedCutGuids.add(cj.guid.toLowerCase());
    }

    // ─── Parallel I/O: Zund queue, Zund completed, and Fiery are independent ───
    // Pre-compute shared data needed by all three branches
    const normalizedPrintNames = new Set<string>();
    for (const pj of matchingPrintJobs) {
      const norm = normalizeJobName(pj.jobName);
      if (norm.length >= 5) normalizedPrintNames.add(norm);
      const fnorm = normalizeJobName(pj.fileName);
      if (fnorm.length >= 5) normalizedPrintNames.add(fnorm);
    }
    const printJobNames = matchingPrintJobs.map((pj) => ({
      original: pj.jobName,
      normalized: zundMatchService.normalizeJobName(pj.jobName),
    }));
    // Build CutID index from this order's print jobs for cross-referencing with Zund cuts
    const printCutIdMap = new Map<string, string>();
    for (const pj of matchingPrintJobs) {
      const cutId = extractCutId(pj.jobName) || extractCutId(pj.fileName);
      if (cutId) printCutIdMap.set(cutId.toLowerCase(), pj.jobName);
    }

    const [zundQueueResult, zundCompletedResult, fieryResult] = await Promise.all([
      // ─── Zund Queue Files ───
      (async () => {
        try {
          const allQueueFiles = await scanZundQueueFiles(100);
          return allQueueFiles
            .filter((f) => {
              const name = f.zccData.jobName || f.fileName;
              const orderId = f.zccData.orderId || '';
              const parsedFromName = parseJobInfo(name);
              const parsedFromFile = parseJobInfo(f.fileName);
              if (
                parsedFromName.workOrderNumber === bareNumber ||
                parsedFromFile.workOrderNumber === bareNumber
              )
                return true;
              const normalizedOrderId = orderId.trim().toLowerCase();
              if (
                normalizedOrderId &&
                (normalizedOrderId === orderNumber.toLowerCase() ||
                  normalizedOrderId === bareNumber.toLowerCase() ||
                  normalizedOrderId === `wo${bareNumber}`.toLowerCase())
              ) {
                return true;
              }
              const zundCutId = extractCutId(name) || extractCutId(f.fileName);
              if (zundCutId && printCutIdMap.has(zundCutId.toLowerCase())) return true;
              return false;
            })
            .map((f) => ({
              fileName: f.fileName,
              jobName: f.zccData.jobName || f.fileName.replace(/\.zcc$/i, ''),
              status: f.status,
              material: f.zccData.material,
              creationDate: f.zccData.creationDate,
              modified: f.modified.toISOString(),
              copyDone: f.busyInfo?.copyDone ?? 0,
              copyTotal: f.busyInfo?.copyTotal ?? 0,
              cutterName: f.busyInfo?.cutterName ?? null,
              remainingTimeMs: f.busyInfo?.remainingTimeMs ?? null,
            }));
        } catch (queueError) {
          console.log(`Warning: Could not scan Zund queue files: ${queueError}`);
          return [];
        }
      })(),

      // ─── Zund Completed Jobs ───
      (async () => {
        try {
          const allZundJobs = await zundMatchService.getZundCompletedJobs(90);
          const seenZundJobs = new Set<number>();
          const matched: Array<{
            jobId: number;
            jobName: string;
            productionStart: Date;
            productionEnd: Date;
            copyDone: number;
            matchedVia?: string;
          }> = [];
          for (const zj of allZundJobs) {
            if (seenZundJobs.has(zj.jobId)) continue;
            // Strategy 1: CutID cross-reference (highest confidence)
            const zundCutId = extractCutId(zj.jobName);
            if (zundCutId) {
              const printJobName = printCutIdMap.get(zundCutId.toLowerCase());
              if (printJobName) {
                seenZundJobs.add(zj.jobId);
                matched.push({
                  ...zj,
                  matchedVia: `CutID match: ${printJobName.substring(0, 50)}`,
                });
                continue;
              }
              // Strategy 2: CutID lookup in Thrive print history logs
              const thriveLogEntry = await withTimeout(
                thriveService.findJobByCutId(zundCutId),
                2000,
                `findJobByCutId ${zundCutId}`,
              ).catch(() => null);
              if (thriveLogEntry) {
                const woInfo = parseJobInfo(
                  thriveLogEntry.sourceFilePath ||
                    thriveLogEntry.fileName ||
                    thriveLogEntry.customizedName
                );
                if (woInfo.workOrderNumber === bareNumber) {
                  seenZundJobs.add(zj.jobId);
                  matched.push({ ...zj, matchedVia: `CutID match via Thrive print log` });
                  continue;
                }
              }
            }
          }
          return matched;
        } catch (zundError) {
          console.log(`Warning: Could not fetch Zund completed jobs: ${zundError}`);
          return [];
        }
      })(),

      // ─── Fiery Jobs (pass pre-fetched Thrive data to avoid duplicate network call) ───
      (async () => {
        try {
          const allFieryJobs = await withTimeout(
            getAllFieryJobs(printJobs),
            3000,
            'getAllFieryJobs',
          ).catch(() => []);
          return allFieryJobs
            .filter((fj) => {
              if (fj.workOrderNumber === orderNumber || fj.workOrderNumber === `WO${bareNumber}`)
                return true;
              if (fj.jobName.includes(orderNumber) || fj.jobName.includes(bareNumber)) return true;
              const normalizedFiery = normalizeJobName(fj.jobName);
              for (const printNorm of normalizedPrintNames) {
                if (
                  normalizedFiery === printNorm ||
                  normalizedFiery.includes(printNorm) ||
                  printNorm.includes(normalizedFiery)
                )
                  return true;
              }
              return false;
            })
            .map((fj) => {
              let matchedVia = 'Fiery RIP';
              if (fj.workOrderNumber === orderNumber || fj.workOrderNumber === `WO${bareNumber}`) {
                matchedVia = 'WO number from Thrive path';
              } else if (fj.jobName.includes(orderNumber) || fj.jobName.includes(bareNumber)) {
                matchedVia = 'Order number in job name';
              } else {
                matchedVia = 'Cross-reference with Thrive print job';
              }
              return { ...fj, matchedVia };
            });
        } catch (fieryError) {
          console.log(`Warning: Could not fetch Fiery jobs: ${fieryError}`);
          return [] as Array<FieryJob & { matchedVia?: string }>;
        }
      })(),
    ]);

    let zundQueueFiles = zundQueueResult;
    let zundCompletedJobs = zundCompletedResult;
    let fieryJobs = fieryResult;

    // Merge manually-linked jobs
    const manualLinks = await prisma.manualJobLink.findMany({
      where: { workOrder: { orderNumber } },
    });
    const fileChainLinks = order
      ? await prisma.printCutLink.findMany({
          where: { workOrderId: order.id },
          select: {
            id: true,
            printFileName: true,
            cutFileName: true,
            cutId: true,
            status: true,
            linkConfidence: true,
            confirmed: true,
          },
        })
      : [];

    const matchedPrintGuids = new Set(matchingPrintJobs.map((j: any) => j.jobGuid?.toLowerCase()));
    const matchedCutGuidsSet = new Set(matchingCutJobs.map((j: any) => j.guid?.toLowerCase()));
    const matchedZundFileNames = new Set(zundQueueFiles.map((f) => f.fileName));
    const matchedZundJobIds = new Set(zundCompletedJobs.map((j) => j.jobId));

    for (const link of manualLinks) {
      if (link.jobType === 'PRINT_JOB') {
        if (!matchedPrintGuids.has(link.jobIdentifier.toLowerCase())) {
          const found = printJobs.find(
            (j) => j.jobGuid?.toLowerCase() === link.jobIdentifier.toLowerCase()
          );
          if (found) {
            matchingPrintJobs.push({ ...found, manuallyLinked: true, linkId: link.id } as any);
          }
        } else {
          // Already auto-matched — tag it so we know there's also a manual link
          const existing = matchingPrintJobs.find(
            (j: any) => j.jobGuid?.toLowerCase() === link.jobIdentifier.toLowerCase()
          );
          if (existing) (existing as any).linkId = link.id;
        }
      } else if (link.jobType === 'CUT_JOB') {
        if (!matchedCutGuidsSet.has(link.jobIdentifier.toLowerCase())) {
          const found = cutJobs.find(
            (j) => j.guid?.toLowerCase() === link.jobIdentifier.toLowerCase()
          );
          if (found) {
            matchingCutJobs.push({ ...found, manuallyLinked: true, linkId: link.id } as any);
          }
        } else {
          const existing = matchingCutJobs.find(
            (j: any) => j.guid?.toLowerCase() === link.jobIdentifier.toLowerCase()
          );
          if (existing) (existing as any).linkId = link.id;
        }
      } else if (link.jobType === 'ZUND_QUEUE') {
        if (!matchedZundFileNames.has(link.jobIdentifier)) {
          // Job may no longer be in queue — add a placeholder entry
          zundQueueFiles.push({
            fileName: link.jobIdentifier,
            jobName: link.jobName,
            status: 'linked',
            material: null,
            creationDate: null,
            modified: link.linkedAt.toISOString(),
            copyDone: 0,
            copyTotal: 0,
            cutterName: null,
            remainingTimeMs: null,
            manuallyLinked: true,
            linkId: link.id,
          } as any);
        } else {
          const existing = zundQueueFiles.find((f: any) => f.fileName === link.jobIdentifier);
          if (existing) {
            (existing as any).manuallyLinked = true;
            (existing as any).linkId = link.id;
          }
        }
      } else if (link.jobType === 'ZUND_COMPLETED') {
        const jobIdNum = parseInt(link.jobIdentifier, 10);
        if (!matchedZundJobIds.has(jobIdNum)) {
          zundCompletedJobs.push({
            jobId: jobIdNum,
            jobName: link.jobName,
            productionStart: link.linkedAt,
            productionEnd: link.linkedAt,
            copyDone: 0,
            matchedVia: 'Manual link',
            manuallyLinked: true,
            linkId: link.id,
          } as any);
        } else {
          const existing = zundCompletedJobs.find((j: any) => j.jobId === jobIdNum);
          if (existing) {
            (existing as any).manuallyLinked = true;
            (existing as any).linkId = link.id;
          }
        }
      } else if (link.jobType === 'FIERY_JOB') {
        const matchedFieryIds = new Set(fieryJobs.map((f) => f.jobId));
        if (!matchedFieryIds.has(link.jobIdentifier)) {
          fieryJobs.push({
            jobId: link.jobIdentifier,
            jobName: link.jobName,
            fileName: link.jobIdentifier,
            timestamp: null,
            dimensions: null,
            media: null,
            inks: [],
            previewUrl: null,
            rtlUrl: null,
            hasZccCutFile: false,
            zccFileName: null,
            workOrderNumber: orderNumber,
            customerName: null,
            thriveFilePath: null,
            thriveJobMatch: false,
            matchedVia: 'Manual link',
            manuallyLinked: true,
            linkId: link.id,
          } as any);
        } else {
          const existing = fieryJobs.find((j: any) => j.jobId === link.jobIdentifier);
          if (existing) {
            (existing as any).manuallyLinked = true;
            (existing as any).linkId = link.id;
          }
        }
      }
    }

    // Filter out dismissed auto-matched jobs (keep manually-linked ones)
    const filteredPrintJobs = matchingPrintJobs.filter(
      (j: any) => j.manuallyLinked || !dismissedSet.has(`PRINT_JOB:${j.jobGuid}`)
    );
    const filteredCutJobs = matchingCutJobs.filter(
      (j: any) => j.manuallyLinked || !dismissedSet.has(`CUT_JOB:${j.guid}`)
    );
    const filteredZundQueue = zundQueueFiles.filter(
      (f: any) => f.manuallyLinked || !dismissedSet.has(`ZUND_QUEUE:${f.fileName}`)
    );
    const filteredZundCompleted = zundCompletedJobs.filter(
      (j: any) => j.manuallyLinked || !dismissedSet.has(`ZUND_COMPLETED:${String(j.jobId)}`)
    );
    const filteredFieryJobs = fieryJobs.filter(
      (j: any) => j.manuallyLinked || !dismissedSet.has(`FIERY_JOB:${j.jobId}`)
    );

    const findFileChainLink = (names: Array<string | null | undefined>, cutId?: string | null) => {
      const normalizedCutId = cutId?.toLowerCase() || null;
      const normalizedNames = names
        .map((name) => name?.toLowerCase())
        .filter((name): name is string => Boolean(name));

      return (
        fileChainLinks.find((link) => {
          if (normalizedCutId && link.cutId?.toLowerCase() === normalizedCutId) {
            return true;
          }

          const fileNames = [link.cutFileName, link.printFileName]
            .map((name) => name?.toLowerCase())
            .filter((name): name is string => Boolean(name));

          return normalizedNames.some((name) => fileNames.includes(name));
        }) || null
      );
    };

    const enrichedCutJobs = filteredCutJobs.map((job: any) => {
      const cutId = extractCutId(job.jobName || '') || extractCutId(job.fileName || '');
      const fileChainLink = findFileChainLink([job.jobName, job.fileName], cutId);
      return {
        ...job,
        cutId,
        fileChainLinked: Boolean(fileChainLink),
        printCutLinkId: fileChainLink?.id || null,
        fileChainStatus: fileChainLink?.status || null,
      };
    });

    const enrichedZundQueue = filteredZundQueue.map((job: any) => {
      const cutId = extractCutId(job.jobName || '') || extractCutId(job.fileName || '');
      const fileChainLink = findFileChainLink([job.jobName, job.fileName], cutId);
      return {
        ...job,
        cutId,
        fileChainLinked: Boolean(fileChainLink),
        printCutLinkId: fileChainLink?.id || null,
        fileChainStatus: fileChainLink?.status || null,
      };
    });

    const enrichedZundCompleted = filteredZundCompleted.map((job: any) => {
      const cutId = extractCutId(job.jobName || '');
      const fileChainLink = findFileChainLink([job.jobName], cutId);
      return {
        ...job,
        cutId,
        fileChainLinked: Boolean(fileChainLink),
        printCutLinkId: fileChainLink?.id || null,
        fileChainStatus: fileChainLink?.status || null,
      };
    });

    const enrichedFieryJobs = filteredFieryJobs.map((job: any) => {
      const cutId = extractCutId(job.zccFileName || '') || extractCutId(job.jobName || '');
      const fileChainLink = findFileChainLink([job.zccFileName, job.jobName, job.fileName], cutId);
      return {
        ...job,
        cutId,
        fileChainLinked: Boolean(fileChainLink),
        printCutLinkId: fileChainLink?.id || null,
        fileChainStatus: fileChainLink?.status || null,
      };
    });

    res.json({
      success: true,
      data: {
        orderNumber,
        printJobs: filteredPrintJobs,
        cutJobs: enrichedCutJobs,
        zundCompletedJobs: enrichedZundCompleted,
        zundQueueFiles: enrichedZundQueue,
        fieryJobs: enrichedFieryJobs,
        manualLinks: manualLinks.map((l) => ({
          id: l.id,
          jobType: l.jobType,
          jobIdentifier: l.jobIdentifier,
          jobName: l.jobName,
        })),
        dismissedJobs: dismissedLinks,
        summary: {
          printJobCount: filteredPrintJobs.length,
          cutJobCount: enrichedCutJobs.length,
          zundCompletedCount: enrichedZundCompleted.length,
          zundQueueFileCount: enrichedZundQueue.length,
          fieryJobCount: enrichedFieryJobs.length,
          manualLinkCount: manualLinks.length,
          dismissedCount: dismissedLinks.length,
        },
      },
    });
  } catch (error: any) {
    console.error(`Error fetching jobs for WO ${orderNumber}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch work order jobs',
      message: error.message,
    });
  }
});

// GET /equipment/thrive/trace-file - Search for a specific file in RIP logs and Zund stats
router.get('/thrive/trace-file', async (req, res) => {
  const fileName = req.query.fileName as string;
  if (!fileName) {
    return res.status(400).json({ success: false, error: 'fileName query param required' });
  }

  try {
    const normalized = zundMatchService.normalizeJobName(fileName);

    // 1. Search Thrive RIP queues for this file
    const { printJobs, cutJobs } = await thriveService.getAllJobs();
    const matchingPrintJobs = printJobs.filter((job) => {
      const normalizedJob = zundMatchService.normalizeJobName(job.jobName);
      return (
        normalizedJob === normalized ||
        normalizedJob.includes(normalized) ||
        normalized.includes(normalizedJob) ||
        job.fileName.toLowerCase().includes(fileName.toLowerCase()) ||
        job.jobName.toLowerCase().includes(fileName.toLowerCase())
      );
    });

    // 2. Search pending cut jobs
    const matchingCutJobs = cutJobs.filter((job) => {
      const normalizedJob = zundMatchService.normalizeJobName(job.jobName);
      return (
        normalizedJob === normalized ||
        normalizedJob.includes(normalized) ||
        normalized.includes(normalizedJob) ||
        job.jobName.toLowerCase().includes(fileName.toLowerCase())
      );
    });

    // 3. Search Zund completed jobs
    let zundCompletedJobs: Array<{
      jobId: number;
      jobName: string;
      productionStart: Date;
      productionEnd: Date;
      copyDone: number;
      matchedVia?: string;
    }> = [];

    try {
      const allZundJobs = await zundMatchService.getZundCompletedJobs(180);
      for (const zj of allZundJobs) {
        const normalizedZund = zundMatchService.normalizeJobName(zj.jobName);
        if (
          normalizedZund === normalized ||
          normalizedZund.includes(normalized) ||
          normalized.includes(normalizedZund)
        ) {
          zundCompletedJobs.push({
            ...zj,
            matchedVia: `Filename match`,
          });
        }
      }
    } catch (zundError) {
      console.log(`Warning: Could not fetch Zund completed jobs: ${zundError}`);
    }

    // 4. Search RipJob DB records
    const ripJobs = await prisma.ripJob.findMany({
      where: {
        OR: [
          { sourceFileName: { contains: fileName, mode: 'insensitive' } },
          { sourceFileName: { contains: normalized, mode: 'insensitive' } },
        ],
      },
      include: {
        workOrder: { select: { id: true, orderNumber: true, customerName: true } },
      },
      take: 20,
      orderBy: { createdAt: 'desc' },
    });

    const hasPrinted = matchingPrintJobs.length > 0 || ripJobs.length > 0;
    const hasCut = matchingCutJobs.length > 0 || zundCompletedJobs.length > 0;

    res.json({
      success: true,
      data: {
        fileName,
        normalized,
        hasPrinted,
        hasCut,
        printJobs: matchingPrintJobs,
        cutJobs: matchingCutJobs,
        zundCompletedJobs,
        ripJobs,
        status: hasPrinted ? (hasCut ? 'PRINTED_AND_CUT' : 'PRINTED_NOT_CUT') : 'NOT_PRINTED',
      },
    });
  } catch (error: any) {
    console.error(`Error tracing file "${fileName}":`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to trace file',
      message: error.message,
    });
  }
});

// GET /equipment/thrive/status - Check connectivity to all production equipment
router.get('/thrive/status', async (_req, res) => {
  const status: Record<string, { online: boolean; error?: string }> = {};

  for (const machine of thriveService.config.machines) {
    const reachable = await isRemotePathAccessible(machine.share, `access ${machine.id}`);
    if (reachable) {
      status[machine.id] = { online: true };
    } else {
      status[machine.id] = { online: false, error: 'timeout-or-unreachable' };
    }
  }

  for (const zund of thriveService.config.zundMachines) {
    if (zund.statisticsPath) {
      const reachable = await isRemotePathAccessible(zund.statisticsPath, `access ${zund.id}`);
      if (reachable) {
        status[zund.id] = { online: true };
      } else {
        status[zund.id] = { online: false, error: 'timeout-or-unreachable' };
      }
    }
  }

  if (thriveService.config.fiery.exportPath) {
    const reachable = await isRemotePathAccessible(thriveService.config.fiery.exportPath, 'access fiery');
    if (reachable) {
      status['fiery'] = { online: true };
    } else {
      status['fiery'] = { online: false, error: 'timeout-or-unreachable' };
    }
  }

  const onlineCount = Object.values(status).filter((s) => s.online).length;

  res.json({
    success: true,
    data: {
      status,
      summary: {
        online: onlineCount,
        offline: Object.keys(status).length - onlineCount,
        total: Object.keys(status).length,
      },
    },
  });
});

// ============ Manual Job Linking ============

// POST /equipment/thrive/workorder/:orderNumber/link-job - Manually link a job to a work order
router.post('/thrive/workorder/:orderNumber/link-job', async (req: AuthRequest, res) => {
  const { orderNumber } = req.params;
  const { jobType, jobIdentifier, jobName } = req.body;

  if (!jobType || !jobIdentifier || !jobName) {
    throw BadRequestError('jobType, jobIdentifier, and jobName are required');
  }

  const validTypes = ['PRINT_JOB', 'CUT_JOB', 'ZUND_QUEUE', 'ZUND_COMPLETED', 'FIERY_JOB'];
  if (!validTypes.includes(jobType)) {
    throw BadRequestError(`jobType must be one of: ${validTypes.join(', ')}`);
  }

  const order = await prisma.workOrder.findFirst({ where: { orderNumber } });
  if (!order) throw NotFoundError(`Work order ${orderNumber} not found`);

  const link = await prisma.manualJobLink.upsert({
    where: {
      workOrderId_jobType_jobIdentifier: {
        workOrderId: order.id,
        jobType,
        jobIdentifier,
      },
    },
    update: { jobName },
    create: {
      workOrderId: order.id,
      jobType,
      jobIdentifier,
      jobName,
      linkedById: req.userId!,
    },
  });

  await syncManualJobLinksToPrintCutLinks({ workOrderId: order.id });

  broadcast({ type: 'FILE_CHAIN_UPDATED', payload: { workOrderId: order.id } });
  broadcast({ type: 'ORDER_UPDATED', payload: { id: order.id, orderNumber } });

  res.json({ success: true, data: link });
});

// DELETE /equipment/thrive/workorder/:orderNumber/link-job/:linkId - Remove a manual job link
router.delete('/thrive/workorder/:orderNumber/link-job/:linkId', async (req: AuthRequest, res) => {
  const { linkId, orderNumber } = req.params;

  const link = await prisma.manualJobLink.findUnique({ where: { id: linkId } });
  if (!link) throw NotFoundError('Manual job link not found');

  const cutId = extractCutId(link.jobName || '') || extractCutId(link.jobIdentifier || '') || null;
  const cutFileName = link.jobType === 'ZUND_QUEUE' ? link.jobIdentifier : link.jobName;

  await clearManualCutFileLinkForOrder({
    workOrderId: link.workOrderId,
    cutFileName,
    cutId,
  });

  await prisma.manualJobLink.delete({ where: { id: linkId } });

  broadcast({ type: 'FILE_CHAIN_UPDATED', payload: { workOrderId: link.workOrderId } });
  broadcast({ type: 'ORDER_UPDATED', payload: { id: link.workOrderId, orderNumber } });

  res.json({ success: true, data: { message: 'Job unlinked' } });
});

// GET /equipment/thrive/workorder/:orderNumber/manual-links - Get manual links for a work order
router.get('/thrive/workorder/:orderNumber/manual-links', async (req: AuthRequest, res) => {
  const { orderNumber } = req.params;

  const order = await prisma.workOrder.findFirst({ where: { orderNumber } });
  if (!order) throw NotFoundError(`Work order ${orderNumber} not found`);

  const links = await prisma.manualJobLink.findMany({
    where: { workOrderId: order.id },
    include: { linkedBy: { select: { id: true, displayName: true } } },
    orderBy: { linkedAt: 'desc' },
  });

  res.json({ success: true, data: links });
});

// ============ Job Dismissal ============

// POST /equipment/thrive/workorder/:orderNumber/dismiss-job - Dismiss an auto-matched job
router.post('/thrive/workorder/:orderNumber/dismiss-job', async (req: AuthRequest, res) => {
  const { orderNumber } = req.params;
  const { jobType, jobIdentifier, reason } = req.body;

  if (!jobType || !jobIdentifier) {
    throw BadRequestError('jobType and jobIdentifier are required');
  }

  const validTypes = ['PRINT_JOB', 'CUT_JOB', 'ZUND_QUEUE', 'ZUND_COMPLETED', 'FIERY_JOB'];
  if (!validTypes.includes(jobType)) {
    throw BadRequestError(`jobType must be one of: ${validTypes.join(', ')}`);
  }

  const order = await prisma.workOrder.findFirst({ where: { orderNumber } });
  if (!order) throw NotFoundError(`Work order ${orderNumber} not found`);

  const dismissed = await prisma.dismissedJobLink.upsert({
    where: {
      workOrderId_jobType_jobIdentifier: {
        workOrderId: order.id,
        jobType,
        jobIdentifier,
      },
    },
    update: { reason, dismissedById: req.userId! },
    create: {
      workOrderId: order.id,
      jobType,
      jobIdentifier,
      reason: reason || null,
      dismissedById: req.userId!,
    },
  });

  broadcast({ type: 'ORDER_UPDATED', payload: { id: order.id, orderNumber } });

  res.json({ success: true, data: dismissed });
});

// DELETE /equipment/thrive/workorder/:orderNumber/dismiss-job/:dismissId - Restore a dismissed job
router.delete(
  '/thrive/workorder/:orderNumber/dismiss-job/:dismissId',
  async (req: AuthRequest, res) => {
    const { dismissId } = req.params;

    await prisma.dismissedJobLink.delete({ where: { id: dismissId } });

    broadcast({ type: 'ORDER_UPDATED', payload: { orderNumber: req.params.orderNumber } });

    res.json({ success: true, data: { message: 'Job restored' } });
  }
);

// GET /equipment/thrive/workorder/:orderNumber/dismissed-jobs - Get dismissed jobs for a work order
router.get('/thrive/workorder/:orderNumber/dismissed-jobs', async (req: AuthRequest, res) => {
  const { orderNumber } = req.params;

  const order = await prisma.workOrder.findFirst({ where: { orderNumber } });
  if (!order) throw NotFoundError(`Work order ${orderNumber} not found`);

  const dismissed = await prisma.dismissedJobLink.findMany({
    where: { workOrderId: order.id },
    include: { dismissedBy: { select: { id: true, displayName: true } } },
    orderBy: { dismissedAt: 'desc' },
  });

  res.json({ success: true, data: dismissed });
});

// POST /equipment/thrive/barcode-scan - Process a barcode scan from a production station
// Parses CutID + orientation, auto-links to order, records the scan event.
router.post('/thrive/barcode-scan', authenticate, async (req: AuthRequest, res) => {
  const { rawBarcode, station } = req.body as { rawBarcode?: string; station?: string };
  if (!rawBarcode?.trim()) throw BadRequestError('rawBarcode is required');

  // ── Parse CutID and orientation from barcode ───────────────────────────────
  // Zund barcodes often encode: "<CutID>;<Orientation>" or just "<CutID>"
  // Separators seen in the wild: ; , \t | space
  const parts = rawBarcode.trim().split(/[;,|\t]/);
  // Strip trailing F/B — Zund barcode suffix indicating sheet facing direction, not part of CutID
  const rawCutPart = parts[0].trim().replace(/[FB]$/i, '');
  const rawOrientationPart = parts[1]?.trim() ?? null;

  // Orientation: normalise to one of 0/90/180/270 if present
  const orientationNum = rawOrientationPart ? parseInt(rawOrientationPart, 10) : null;
  const orientation =
    orientationNum !== null && !isNaN(orientationNum) && [0, 90, 180, 270].includes(orientationNum)
      ? String(orientationNum)
      : rawOrientationPart || null;

  // Extract CutID: try the whole raw part first, then run through extractCutId
  // (handles both bare CutIDs like "0DGPMDD2632" and filenames like "WO1234_0DGPMDD2632")
  const parsedCutId =
    extractCutId(rawCutPart) ??
    // If rawCutPart itself looks like a valid CutID (7+ alphanum, has both letters+digits) use it directly
    (/^[A-Z0-9]{7,}$/i.test(rawCutPart) && /\d/.test(rawCutPart) && /[A-Za-z]/.test(rawCutPart)
      ? rawCutPart
      : null);

  // ── Attempt to match CutID → Thrive job → Work Order ──────────────────────
  let workOrderId: string | null = null;
  let orderNumber: string | null = null;
  let matched = false;

  if (parsedCutId) {
    // Look up in Thrive job log cache
    const thriveEntry = await thriveService.findJobByCutId(parsedCutId);
    // ThriveJobLogEntry uses fileName / customizedName (no jobName field)
    const jobName = thriveEntry?.customizedName || thriveEntry?.fileName || null;

    if (jobName) {
      const extractedOrderNum = thriveService.extractWorkOrderNumber(jobName);
      if (extractedOrderNum) {
        const order = await prisma.workOrder.findFirst({
          where: {
            OR: [
              { orderNumber: extractedOrderNum },
              { orderNumber: `WO${extractedOrderNum}` },
              { orderNumber: { endsWith: extractedOrderNum } },
            ],
          },
        });

        if (order) {
          workOrderId = order.id;
          orderNumber = order.orderNumber;
          matched = true;

          // Create a ManualJobLink so the CutID is recorded against this order
          await prisma.manualJobLink.upsert({
            where: {
              workOrderId_jobType_jobIdentifier: {
                workOrderId: order.id,
                jobType: 'CUT_JOB',
                jobIdentifier: parsedCutId,
              },
            },
            update: { jobName: jobName ?? parsedCutId },
            create: {
              workOrderId: order.id,
              jobType: 'CUT_JOB',
              jobIdentifier: parsedCutId,
              jobName: jobName ?? parsedCutId,
              linkedById: req.userId!,
            },
          });

          await syncManualJobLinksToPrintCutLinks({ workOrderId: order.id });
          broadcast({ type: 'FILE_CHAIN_UPDATED', payload: { workOrderId: order.id } });
          broadcast({
            type: 'ORDER_UPDATED',
            payload: { id: order.id, orderNumber: order.orderNumber },
          });
        }
      }
    }
  }

  // ── Record the scan event ──────────────────────────────────────────────────
  const scan = await prisma.barcodeScan.create({
    data: {
      rawBarcode: rawBarcode.trim(),
      parsedCutId,
      orientation,
      station: station ?? null,
      matched,
      workOrderId,
    },
  });

  await logActivity({
    userId: req.userId!,
    action: ActivityAction.UPDATE,
    entityType: EntityType.WORK_ORDER,
    entityId: workOrderId ?? 'none',
    description: matched
      ? `Barcode scan linked CutID ${parsedCutId} to ${orderNumber}${orientation ? ` (${orientation}°)` : ''}`
      : `Barcode scan recorded CutID ${parsedCutId ?? rawBarcode.trim()} — no order match found`,
  });

  res.json({
    success: true,
    data: {
      scanId: scan.id,
      rawBarcode: rawBarcode.trim(),
      parsedCutId,
      orientation,
      matched,
      orderNumber,
      workOrderId,
    },
  });
});

// GET /equipment/thrive/unlinked-jobs - Get all current jobs NOT linked to any work order
router.get('/thrive/unlinked-jobs', async (req: AuthRequest, res) => {
  const jobType = req.query.type as string | undefined;

  try {
    const { printJobs, cutJobs } = await thriveService.getAllJobs();

    // Get all existing manual links to filter out already-linked jobs
    const existingLinks = await prisma.manualJobLink.findMany({
      select: { jobIdentifier: true, jobType: true },
    });
    const existingFileChainLinks = await prisma.printCutLink.findMany({
      where: { cutFileName: { not: null } },
      select: { cutFileName: true, cutId: true },
    });
    const linkedPrintGuids = new Set(
      existingLinks.filter((l) => l.jobType === 'PRINT_JOB').map((l) => l.jobIdentifier)
    );
    const linkedCutGuids = new Set(
      existingLinks.filter((l) => l.jobType === 'CUT_JOB').map((l) => l.jobIdentifier)
    );
    const linkedZundFiles = new Set(
      existingLinks.filter((l) => l.jobType === 'ZUND_QUEUE').map((l) => l.jobIdentifier)
    );
    const linkedFieryIds = new Set(
      existingLinks.filter((l) => l.jobType === 'FIERY_JOB').map((l) => l.jobIdentifier)
    );
    const linkedCutNames = new Set(
      existingFileChainLinks
        .map((link) => link.cutFileName?.toLowerCase())
        .filter((name): name is string => Boolean(name))
    );
    const linkedCutIds = new Set(
      existingFileChainLinks
        .map((link) => link.cutId?.toLowerCase())
        .filter((cutId): cutId is string => Boolean(cutId))
    );

    const result: {
      printJobs?: any[];
      cutJobs?: any[];
      zundQueueFiles?: any[];
      fieryJobs?: any[];
    } = {};

    if (!jobType || jobType === 'PRINT_JOB') {
      // Return print jobs that have no WO# auto-match AND aren't manually linked
      result.printJobs = printJobs
        .filter((j) => !j.workOrderNumber && !linkedPrintGuids.has(j.jobGuid))
        .map((j) => ({
          jobGuid: j.jobGuid,
          jobName: j.jobName,
          fileName: j.fileName,
          status: j.status,
          printer: j.printer,
          printMedia: j.printMedia,
          createTime: j.createTime,
        }));
    }

    if (!jobType || jobType === 'CUT_JOB') {
      result.cutJobs = cutJobs
        .filter((j) => {
          const cutId = extractCutId(j.jobName || '') || extractCutId(j.fileName || '');
          return (
            !j.workOrderNumber &&
            !linkedCutGuids.has(j.guid) &&
            !linkedCutNames.has((j.jobName || '').toLowerCase()) &&
            !(cutId && linkedCutIds.has(cutId.toLowerCase()))
          );
        })
        .map((j) => ({
          guid: j.guid,
          jobName: j.jobName,
          fileName: j.fileName,
          device: j.device,
          printer: j.printer,
          media: j.media,
          width: j.width,
          height: j.height,
          cutId: extractCutId(j.jobName || '') || extractCutId(j.fileName || ''),
        }));
    }

    if (!jobType || jobType === 'ZUND_QUEUE') {
      try {
        const allQueueFiles = await scanZundQueueFiles(200);
        result.zundQueueFiles = allQueueFiles
          .filter((f) => {
            const cutId = extractCutId(f.zccData.jobName || '') || extractCutId(f.fileName || '');
            return (
              !linkedZundFiles.has(f.fileName) &&
              !linkedCutNames.has(f.fileName.toLowerCase()) &&
              !(cutId && linkedCutIds.has(cutId.toLowerCase()))
            );
          })
          .map((f) => ({
            fileName: f.fileName,
            jobName: f.zccData.jobName || f.fileName.replace(/\.zcc$/i, ''),
            status: f.status,
            material: f.zccData.material,
            modified: f.modified.toISOString(),
            cutId: extractCutId(f.zccData.jobName || '') || extractCutId(f.fileName || ''),
          }));
      } catch {
        result.zundQueueFiles = [];
      }
    }

    if (!jobType || jobType === 'FIERY_JOB') {
      try {
        const allFieryJobs = await getAllFieryJobs();
        result.fieryJobs = allFieryJobs
          .filter((fj) => !fj.workOrderNumber && !linkedFieryIds.has(fj.jobId))
          .map((fj) => ({
            jobId: fj.jobId,
            jobName: fj.jobName,
            fileName: fj.fileName,
            timestamp: fj.timestamp,
            hasZccCutFile: fj.hasZccCutFile,
            zccFileName: fj.zccFileName,
            dimensions: fj.dimensions,
            media: fj.media,
            inks: fj.inks,
          }));
      } catch {
        result.fieryJobs = [];
      }
    }

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error fetching unlinked jobs:', error);
    res
      .status(500)
      .json({ success: false, error: 'Failed to fetch unlinked jobs', message: error.message });
  }
});

// GET /equipment/workorder/:orderNumber/activity - Get equipment activity timeline for an order
router.get('/workorder/:orderNumber/activity', async (req, res) => {
  const { orderNumber } = req.params;
  const bareNumber = orderNumber.replace(/^WO/i, '');

  try {
    const { printJobs, cutJobs } = await thriveService.getAllJobs();

    // Filter jobs for this work order
    const matchingPrintJobs = printJobs.filter(
      (job) =>
        job.workOrderNumber === orderNumber ||
        job.fileName.includes(orderNumber) ||
        job.jobName.includes(orderNumber)
    );

    const matchingCutJobs = cutJobs.filter(
      (job) => job.workOrderNumber === orderNumber || job.jobName.includes(orderNumber)
    );

    // Create activity timeline entries
    type ActivityType =
      | 'PRINT_QUEUED'
      | 'PRINT_PROCESSING'
      | 'PRINT_READY'
      | 'PRINT_PRINTING'
      | 'PRINT_COMPLETED'
      | 'CUT_QUEUED'
      | 'CUT_COMPLETED'
      | 'EMAIL_SENT'
      | 'FILE_CREATED';

    const activity: Array<{
      id: string;
      type: ActivityType;
      description: string;
      timestamp: string;
      source: 'thrive' | 'zund' | 'email' | 'network';
      details?: Record<string, unknown>;
    }> = [];

    // Convert print jobs to timeline entries
    for (const job of matchingPrintJobs) {
      const statusMap: Record<
        number,
        'PRINT_QUEUED' | 'PRINT_PROCESSING' | 'PRINT_READY' | 'PRINT_PRINTING' | 'PRINT_COMPLETED'
      > = {
        0: 'PRINT_QUEUED',
        4: 'PRINT_PROCESSING',
        8: 'PRINT_READY',
        16: 'PRINT_PRINTING',
        32: 'PRINT_COMPLETED',
      };

      const type = statusMap[job.statusCode] || 'PRINT_QUEUED';
      const timestamp = `${job.createDate}T${job.createTime}`;

      activity.push({
        id: job.jobGuid,
        type,
        description: `${job.status}: ${job.jobName.slice(0, 50)}${job.jobName.length > 50 ? '...' : ''} on ${job.printer}`,
        timestamp,
        source: 'thrive',
        details: {
          printer: job.printer,
          media: job.printMedia,
          copies: job.numCopies,
          inkCoverage: job.inkCoverage,
          size: job.jobSize,
        },
      });
    }

    // Convert pending cut jobs to timeline entries
    for (const job of matchingCutJobs) {
      activity.push({
        id: job.guid || `cut-${job.jobName}`,
        type: 'CUT_QUEUED',
        description: `Cut job queued: ${job.jobName.slice(0, 50)}${job.jobName.length > 50 ? '...' : ''}`,
        timestamp: new Date().toISOString(), // Cut files don't have timestamps, use now
        source: 'zund',
        details: {
          device: job.device,
          media: job.media,
          width: job.width,
          height: job.height,
        },
      });
    }

    // Add Zund completed cut jobs from statistics database
    let zundCompletedCount = 0;
    try {
      const allZundJobs = await zundMatchService.getZundCompletedJobs(90);

      // Build CutID index from this order's print jobs
      const timelinePrintCutIdMap = new Map<string, string>();
      for (const pj of matchingPrintJobs) {
        const cutId = extractCutId(pj.jobName) || extractCutId(pj.fileName);
        if (cutId) timelinePrintCutIdMap.set(cutId.toLowerCase(), pj.jobName);
      }

      for (const zj of allZundJobs) {
        let matched = false;

        // Match via CutID cross-reference with this order's print jobs
        const zundCutId = extractCutId(zj.jobName);
        if (zundCutId) {
          if (timelinePrintCutIdMap.has(zundCutId.toLowerCase())) {
            matched = true;
          } else {
            // Fallback: CutID lookup in Thrive print history logs
            const thriveLogEntry = await thriveService.findJobByCutId(zundCutId);
            if (thriveLogEntry) {
              const woInfo = parseJobInfo(
                thriveLogEntry.sourceFilePath ||
                  thriveLogEntry.fileName ||
                  thriveLogEntry.customizedName
              );
              if (woInfo.workOrderNumber === bareNumber) {
                matched = true;
              }
            }
          }
        }

        if (matched) {
          zundCompletedCount++;
          activity.push({
            id: `zund-${zj.jobId}`,
            type: 'CUT_COMPLETED',
            description: `Cut completed: ${zj.jobName.slice(0, 50)}${zj.jobName.length > 50 ? '...' : ''} (${zj.copyDone} copies)`,
            timestamp: zj.productionEnd.toISOString(),
            source: 'zund',
            details: {
              cutter: zj.cutter,
              copyDone: zj.copyDone,
              copyTotal: zj.copyTotal,
              productionStart: zj.productionStart.toISOString(),
            },
          });
        }
      }
    } catch (zundError) {
      console.log(`Warning: Could not fetch Zund completed jobs for activity: ${zundError}`);
    }

    // Add emails from EmailQueue
    let emailCount = 0;
    try {
      // Get the order to find its ID
      const order = await prisma.workOrder.findFirst({
        where: { orderNumber },
        select: { id: true, customerName: true },
      });

      if (order) {
        const emails = await prisma.emailQueue.findMany({
          where: {
            orderId: order.id,
            status: 'SENT',
          },
          orderBy: { sentAt: 'desc' },
        });

        for (const email of emails) {
          if (email.sentAt) {
            emailCount++;
            activity.push({
              id: `email-${email.id}`,
              type: 'EMAIL_SENT',
              description: `Email sent: ${email.subject?.slice(0, 50) || 'No subject'}`,
              timestamp: email.sentAt.toISOString(),
              source: 'email',
              details: {
                recipient: email.recipientEmail,
                subject: email.subject,
                templateId: email.templateId,
              },
            });
          }
        }
      }
    } catch (emailError) {
      console.log(`Warning: Could not fetch emails for activity: ${emailError}`);
    }

    // Add network file creation dates (Proofs, Print Files, Emails folders)
    let fileCount = 0;
    try {
      const settings = await prisma.systemSettings.findFirst();
      const order = await prisma.workOrder.findFirst({
        where: { orderNumber },
        select: { customerName: true },
      });

      if (settings?.networkDriveBasePath && order) {
        const fs = await import('fs');
        const path = await import('path');

        // Extract WO number and find folder
        const woNumber = orderNumber.replace(/\D/g, '');
        const woPattern = new RegExp(`^WO${woNumber}([_\\s\\-]|$)`, 'i');

        // Find customer folder
        const customerFolders = fs
          .readdirSync(settings.networkDriveBasePath, { withFileTypes: true })
          .filter((e) => e.isDirectory() && !e.name.startsWith('.'));

        const customerFolder = customerFolders.find(
          (f) =>
            f.name.toLowerCase().includes(order.customerName.toLowerCase()) ||
            order.customerName.toLowerCase().includes(f.name.toLowerCase())
        );

        if (customerFolder) {
          const customerPath = path.join(settings.networkDriveBasePath, customerFolder.name);
          const woFolders = fs
            .readdirSync(customerPath, { withFileTypes: true })
            .filter((e) => e.isDirectory() && woPattern.test(e.name));

          if (woFolders.length > 0) {
            const woFolderPath = path.join(customerPath, woFolders[0].name);

            // Scan specific subfolders for timeline-relevant files
            const relevantFolders = ['Proofs', 'Print Files', 'Emails', 'PRINTCUT'];

            for (const subfolder of relevantFolders) {
              const subfolderPath = path.join(woFolderPath, subfolder);
              if (fs.existsSync(subfolderPath)) {
                try {
                  const files = fs.readdirSync(subfolderPath, { withFileTypes: true });
                  for (const file of files) {
                    if (file.isFile()) {
                      const filePath = path.join(subfolderPath, file.name);
                      const stats = fs.statSync(filePath);
                      fileCount++;

                      activity.push({
                        id: `file-${Buffer.from(filePath).toString('base64').slice(0, 20)}`,
                        type: 'FILE_CREATED',
                        description: `${subfolder}: ${file.name.slice(0, 40)}${file.name.length > 40 ? '...' : ''}`,
                        timestamp: stats.mtime.toISOString(),
                        source: 'network',
                        details: {
                          folder: subfolder,
                          fileName: file.name,
                          size: stats.size,
                        },
                      });
                    }
                  }
                } catch {}
              }
            }
          }
        }
      }
    } catch (fileError) {
      console.log(`Warning: Could not scan network files for activity: ${fileError}`);
    }

    // Sort by timestamp descending
    activity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json({
      success: true,
      data: {
        orderNumber,
        activity,
        summary: {
          printJobs: matchingPrintJobs.length,
          cutJobs: matchingCutJobs.length,
          zundCompleted: zundCompletedCount,
          emails: emailCount,
          files: fileCount,
        },
      },
    });
  } catch (error: any) {
    console.error(`Error fetching equipment activity for ${orderNumber}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch equipment activity',
      message: error.message,
    });
  }
});

// ============ Remote Connection Actions ============

/**
 * POST /equipment/:id/launch-rdp - Launch an RDP session to the equipment's IP
 * Runs mstsc.exe on the ERP server machine (local network).
 */
router.post('/:id/launch-rdp', async (req: AuthRequest, res: Response) => {
  const equipment = await prisma.equipment.findUnique({ where: { id: req.params.id } });
  if (!equipment) throw NotFoundError('Equipment not found');
  if (!equipment.ipAddress) throw BadRequestError('Equipment has no IP address');

  // Allow targeting a different IP (e.g., Fiery controller)
  const ip = (req.query.targetIp as string) || equipment.ipAddress;

  try {
    const { exec } = await import('child_process');
    // Launch mstsc.exe detached — don't wait for it
    exec(`mstsc /v:${ip}`, { windowsHide: false });

    await logActivity({
      action: ActivityAction.UPDATE,
      entityType: EntityType.EQUIPMENT,
      entityId: equipment.id,
      entityName: equipment.name,
      description: `Launched Remote Desktop session to ${ip}`,
      userId: req.userId,
      req,
    });

    res.json({ success: true, message: `RDP session launched to ${ip}` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Failed to launch RDP: ${err.message}` });
  }
});

/**
 * POST /equipment/:id/launch-vnc - Launch a VNC viewer session to the equipment's IP
 * Tries common VNC viewer paths on the ERP server machine.
 */
router.post('/:id/launch-vnc', async (req: AuthRequest, res: Response) => {
  const equipment = await prisma.equipment.findUnique({ where: { id: req.params.id } });
  if (!equipment) throw NotFoundError('Equipment not found');
  if (!equipment.ipAddress) throw BadRequestError('Equipment has no IP address');

  // Allow targeting a different IP (e.g., VUTEk printer IP)
  const ip = (req.query.targetIp as string) || equipment.ipAddress;

  try {
    const { exec } = await import('child_process');
    const fs = await import('fs');

    // Check common VNC viewer locations (including user-local install)
    const localAppData = process.env.LOCALAPPDATA || '';
    const vncPaths = [
      `${localAppData}\\TigerVNC\\vncviewer.exe`,
      'C:\\Program Files\\TigerVNC\\vncviewer.exe',
      'C:\\Program Files\\RealVNC\\VNC Viewer\\vncviewer.exe',
      'C:\\Program Files (x86)\\RealVNC\\VNC Viewer\\vncviewer.exe',
      'C:\\Program Files\\TightVNC\\tvnviewer.exe',
      'C:\\Program Files (x86)\\TightVNC\\tvnviewer.exe',
      'C:\\Program Files (x86)\\UltraVNC\\vncviewer.exe',
    ];

    let vncExe: string | null = null;
    for (const p of vncPaths) {
      if (fs.existsSync(p)) {
        vncExe = p;
        break;
      }
    }

    if (vncExe) {
      exec(`"${vncExe}" ${ip}`, { windowsHide: false });

      await logActivity({
        action: ActivityAction.UPDATE,
        entityType: EntityType.EQUIPMENT,
        entityId: equipment.id,
        entityName: equipment.name,
        description: `Launched VNC remote display session to ${ip}`,
        userId: req.userId,
        req,
      });

      res.json({ success: true, message: `VNC session launched to ${ip}`, viewer: vncExe });
    } else {
      res.status(400).json({
        success: false,
        error:
          'No VNC viewer installed on the server. Install RealVNC Viewer, TightVNC, TigerVNC, or UltraVNC to use this feature.',
      });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: `Failed to launch VNC: ${err.message}` });
  }
});

/**
 * GET /equipment/:id/smb-shares - List SMB file shares on the equipment (read-only)
 * Uses `net view \\<ip>` to enumerate visible shares.
 */
router.get('/:id/smb-shares', async (req: AuthRequest, res: Response) => {
  const equipment = await prisma.equipment.findUnique({ where: { id: req.params.id } });
  if (!equipment) throw NotFoundError('Equipment not found');
  if (!equipment.ipAddress) throw BadRequestError('Equipment has no IP address');

  // Allow targeting a different IP (e.g., Fiery controller)
  const ip = (req.query.targetIp as string) || equipment.ipAddress;

  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    // List shares
    const { stdout: shareOutput } = await execAsync(`net view \\\\${ip} /all`, { timeout: 10000 });
    const shares: Array<{ name: string; type: string; remark: string }> = [];

    // Parse "net view" output — format is: ShareName  Type  Remark
    const lines = shareOutput.split('\n');
    let inShareList = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('---')) {
        inShareList = true;
        continue;
      }
      if (!inShareList || !trimmed || trimmed.startsWith('The command')) continue;

      // Parse share line: "ShareName     Disk     Some remark"
      const match = trimmed.match(/^(\S+)\s+(Disk|Print|IPC)\s*(.*)?$/i);
      if (match) {
        shares.push({
          name: match[1],
          type: match[2],
          remark: (match[3] || '').trim(),
        });
      }
    }

    // For each Disk share, try to list top-level contents (read-only)
    const shareDetails = await Promise.all(
      shares
        .filter((s) => s.type.toLowerCase() === 'disk')
        .map(async (share) => {
          try {
            const { stdout } = await execAsync(
              `powershell -NoProfile -Command "Get-ChildItem '\\\\${ip}\\${share.name}' -ErrorAction Stop | Select-Object Name, Length, LastWriteTime, @{N='IsDir';E={$_.PSIsContainer}} | ConvertTo-Json -Compress"`,
              { timeout: 10000 }
            );
            let items: any[] = [];
            try {
              const parsed = JSON.parse(stdout.trim());
              items = Array.isArray(parsed) ? parsed : [parsed];
            } catch {
              items = [];
            }

            return {
              ...share,
              accessible: true,
              items: items.map((item: any) => ({
                name: item.Name,
                size: item.Length || null,
                modified: item.LastWriteTime,
                isDirectory: item.IsDir || false,
              })),
              itemCount: items.length,
            };
          } catch {
            return { ...share, accessible: false, items: [], itemCount: 0 };
          }
        })
    );

    // Include non-Disk shares (IPC$, Print) without contents
    const nonDiskShares = shares
      .filter((s) => s.type.toLowerCase() !== 'disk')
      .map((s) => ({ ...s, accessible: null, items: [], itemCount: 0 }));

    res.json({
      success: true,
      data: {
        ip,
        hostname: equipment.name,
        shares: [...shareDetails, ...nonDiskShares],
        totalShares: shares.length,
        scannedAt: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    res.json({
      success: true,
      data: {
        ip,
        hostname: equipment.name,
        shares: [],
        totalShares: 0,
        error: err.message?.includes('System error 53')
          ? 'Network path not found — device may be offline or SMB disabled'
          : err.message?.includes('denied')
            ? 'Access denied — insufficient permissions to view shares'
            : `Unable to enumerate shares: ${err.message}`,
        scannedAt: new Date().toISOString(),
      },
    });
  }
});

/**
 * GET /equipment/:id/win-services - List Windows services on the equipment (read-only)
 * Uses PowerShell Get-WmiObject to query services remotely.
 */
router.get('/:id/win-services', async (req: AuthRequest, res: Response) => {
  const equipment = await prisma.equipment.findUnique({ where: { id: req.params.id } });
  if (!equipment) throw NotFoundError('Equipment not found');
  if (!equipment.ipAddress) throw BadRequestError('Equipment has no IP address');

  // Allow targeting a different IP (e.g., Fiery controller)
  const ip = (req.query.targetIp as string) || equipment.ipAddress;
  const filter = (req.query.filter as string) || 'running'; // 'running' | 'all' | 'stopped'

  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    // WMI query via PowerShell (works across the local network)
    const statusFilter =
      filter === 'all'
        ? ''
        : filter === 'stopped'
          ? "| Where-Object { \\$_.State -eq 'Stopped' }"
          : "| Where-Object { \\$_.State -eq 'Running' }";

    const { stdout } = await execAsync(
      `powershell -NoProfile -Command "Get-WmiObject Win32_Service -ComputerName '${ip}' -ErrorAction Stop ${statusFilter} | Select-Object Name, DisplayName, State, StartMode, ProcessId, Description | Sort-Object DisplayName | ConvertTo-Json -Compress"`,
      { timeout: 15000 }
    );

    let services: any[] = [];
    try {
      const parsed = JSON.parse(stdout.trim());
      services = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      services = [];
    }

    // Categorize services for the UI
    const categorized = services.map((svc: any) => ({
      name: svc.Name,
      displayName: svc.DisplayName,
      state: svc.State,
      startMode: svc.StartMode,
      pid: svc.ProcessId || null,
      description: svc.Description || null,
      category: categorizeService(svc.Name, svc.DisplayName),
    }));

    res.json({
      success: true,
      data: {
        ip,
        hostname: equipment.name,
        filter,
        services: categorized,
        totalServices: categorized.length,
        summary: {
          running: categorized.filter((s: any) => s.state === 'Running').length,
          stopped: categorized.filter((s: any) => s.state === 'Stopped').length,
          total: categorized.length,
        },
        scannedAt: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    res.json({
      success: true,
      data: {
        ip,
        hostname: equipment.name,
        filter,
        services: [],
        totalServices: 0,
        error: err.message?.includes('RPC server')
          ? 'RPC server unavailable — device may be offline or WMI disabled'
          : err.message?.includes('denied')
            ? 'Access denied — insufficient permissions to query services'
            : `Unable to query services: ${err.message}`,
        scannedAt: new Date().toISOString(),
      },
    });
  }
});

// ============ IPP Print Job Submission ============

/**
 * GET /equipment/:id/ipp-printer-info - Get IPP printer attributes (capabilities)
 */
router.get('/:id/ipp-printer-info', async (req: AuthRequest, res: Response) => {
  const equipment = await prisma.equipment.findUnique({ where: { id: req.params.id } });
  if (!equipment) throw NotFoundError('Equipment not found');
  if (!equipment.ipAddress) throw BadRequestError('Equipment has no IP address');

  const ip = (req.query.targetIp as string) || equipment.ipAddress;

  try {
    // @ts-ignore -- no @types/ipp available
    const ipp = await import('ipp');
    const printerUrl = `ipp://${ip}:631/ipp/print`;

    const printer = new ipp.default.Printer(printerUrl);
    const msg: any = {
      'operation-attributes-tag': {
        'attributes-charset': 'utf-8',
        'attributes-natural-language': 'en',
        'requesting-user-name': 'ERP System',
      },
    };

    printer.execute('Get-Printer-Attributes', msg, (err: any, result: any) => {
      if (err) {
        // Try alternate endpoint for HP printers
        const altPrinter = new ipp.default.Printer(`ipp://${ip}:631/ipp/printer`);
        altPrinter.execute('Get-Printer-Attributes', msg, (err2: any, result2: any) => {
          if (err2) {
            return res.json({
              success: true,
              data: {
                available: false,
                error: `IPP service not responding: ${err2.message || err.message}`,
                ip,
              },
            });
          }
          return res.json({ success: true, data: parseIppAttributes(result2, ip) });
        });
        return;
      }
      res.json({ success: true, data: parseIppAttributes(result, ip) });
    });
  } catch (err: any) {
    res.json({
      success: true,
      data: { available: false, error: `IPP error: ${err.message}`, ip },
    });
  }
});

/**
 * POST /equipment/:id/ipp-print - Submit a print job via IPP
 * Accepts multipart file upload (PDF, JPEG, PNG, PS, TIFF)
 */
router.post('/:id/ipp-print', async (req: AuthRequest, res: Response) => {
  const equipment = await prisma.equipment.findUnique({ where: { id: req.params.id } });
  if (!equipment) throw NotFoundError('Equipment not found');
  if (!equipment.ipAddress) throw BadRequestError('Equipment has no IP address');

  const ip = (req.query.targetIp as string) || equipment.ipAddress;

  // Use multer for file upload
  const multer = (await import('multer')).default;
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 500 * 1024 * 1024 }, // 500MB max
    fileFilter: (_req, file, cb) => {
      const allowed = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/tiff',
        'application/postscript',
        'application/octet-stream',
      ];
      if (
        allowed.includes(file.mimetype) ||
        file.originalname.match(/\.(pdf|jpg|jpeg|png|tif|tiff|ps|eps)$/i)
      ) {
        cb(null, true);
      } else {
        cb(new Error(`Unsupported file type: ${file.mimetype}`));
      }
    },
  }).single('file');

  upload(req as any, res as any, async (uploadErr: any) => {
    if (uploadErr) {
      return res.status(400).json({ success: false, error: uploadErr.message });
    }

    const file = (req as any).file;
    if (!file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    // Determine MIME type
    let mimeType = file.mimetype;
    const ext = file.originalname.split('.').pop()?.toLowerCase();
    if (mimeType === 'application/octet-stream') {
      const mimeMap: Record<string, string> = {
        pdf: 'application/pdf',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        tif: 'image/tiff',
        tiff: 'image/tiff',
        ps: 'application/postscript',
        eps: 'application/postscript',
      };
      mimeType = mimeMap[ext || ''] || mimeType;
    }

    // Job settings from query params
    const copies = parseInt(req.query.copies as string) || 1;
    const jobName = (req.query.jobName as string) || file.originalname;

    try {
      // @ts-ignore -- no @types/ipp available
      const ipp = await import('ipp');
      const printerUrl = `ipp://${ip}:631/ipp/print`;
      const printer = new ipp.default.Printer(printerUrl);

      const msg: any = {
        'operation-attributes-tag': {
          'attributes-charset': 'utf-8',
          'attributes-natural-language': 'en',
          'requesting-user-name': 'ERP System',
          'job-name': jobName,
          'document-format': mimeType,
        },
        'job-attributes-tag': {
          copies,
        },
        data: file.buffer,
      };

      printer.execute('Print-Job', msg, async (err: any, result: any) => {
        if (err) {
          // Try alternate endpoint
          const altPrinter = new ipp.default.Printer(`ipp://${ip}:631/ipp/printer`);
          altPrinter.execute('Print-Job', msg, async (err2: any, result2: any) => {
            if (err2) {
              return res.status(500).json({
                success: false,
                error: `IPP print failed: ${err2.message || err.message}`,
              });
            }
            await logIppJob(req, equipment, ip, jobName, file, result2);
            return res.json(formatIppResult(result2, jobName, file));
          });
          return;
        }
        await logIppJob(req, equipment, ip, jobName, file, result);
        res.json(formatIppResult(result, jobName, file));
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: `IPP error: ${err.message}` });
    }
  });
});

/**
 * GET /equipment/:id/ipp-jobs - List current print jobs on the IPP printer
 */
router.get('/:id/ipp-jobs', async (req: AuthRequest, res: Response) => {
  const equipment = await prisma.equipment.findUnique({ where: { id: req.params.id } });
  if (!equipment) throw NotFoundError('Equipment not found');
  if (!equipment.ipAddress) throw BadRequestError('Equipment has no IP address');

  const ip = (req.query.targetIp as string) || equipment.ipAddress;

  try {
    // @ts-ignore -- no @types/ipp available
    const ipp = await import('ipp');
    const printerUrl = `ipp://${ip}:631/ipp/print`;
    const printer = new ipp.default.Printer(printerUrl);

    const msg: any = {
      'operation-attributes-tag': {
        'attributes-charset': 'utf-8',
        'attributes-natural-language': 'en',
        'requesting-user-name': 'ERP System',
        'requested-attributes': [
          'job-id',
          'job-name',
          'job-state',
          'job-state-reasons',
          'job-originating-user-name',
          'time-at-creation',
          'job-media-sheets-completed',
          'copies',
        ],
      },
    };

    printer.execute('Get-Jobs', msg, (err: any, result: any) => {
      if (err) {
        return res.json({ success: true, data: { jobs: [], error: err.message } });
      }

      const jobs: any[] = [];
      const jobAttrs = result?.['job-attributes-tag'];
      if (jobAttrs) {
        const jobList = Array.isArray(jobAttrs) ? jobAttrs : [jobAttrs];
        for (const job of jobList) {
          jobs.push({
            id: job['job-id'],
            name: job['job-name'],
            state: job['job-state'],
            stateReasons: job['job-state-reasons'],
            user: job['job-originating-user-name'],
            createdAt: job['time-at-creation'],
            sheetsCompleted: job['job-media-sheets-completed'],
            copies: job['copies'],
          });
        }
      }

      res.json({ success: true, data: { jobs, total: jobs.length } });
    });
  } catch (err: any) {
    res.json({ success: true, data: { jobs: [], error: err.message } });
  }
});

// ---- IPP helper functions ----

function parseIppAttributes(result: any, ip: string) {
  const attrs = result?.['printer-attributes-tag'] || {};
  return {
    available: true,
    ip,
    printerName: attrs['printer-name'] || 'Unknown',
    printerInfo: attrs['printer-info'] || '',
    printerMakeModel: attrs['printer-make-and-model'] || '',
    printerState: attrs['printer-state'],
    printerStateReasons: attrs['printer-state-reasons'],
    printerLocation: attrs['printer-location'] || '',
    documentFormats: attrs['document-format-supported'] || [],
    colorSupported: attrs['color-supported'] ?? null,
    sidesSupported: attrs['sides-supported'] || [],
    copiesSupported: attrs['copies-supported'] || null,
    mediaSupported: attrs['media-supported'] || [],
    mediaReady: attrs['media-ready'] || [],
    printerUri: attrs['printer-uri-supported'] || `ipp://${ip}:631/ipp/print`,
    pagesPerMinute: attrs['pages-per-minute'] ?? null,
    pagesPerMinuteColor: attrs['pages-per-minute-color'] ?? null,
    queued: attrs['queued-job-count'] ?? null,
  };
}

function formatIppResult(result: any, jobName: string, file: any) {
  const jobAttrs = result?.['job-attributes-tag'] || {};
  return {
    success: true,
    data: {
      jobId: jobAttrs['job-id'],
      jobState: jobAttrs['job-state'],
      jobUri: jobAttrs['job-uri'],
      jobName,
      fileName: file.originalname,
      fileSize: file.size,
      message: `Print job "${jobName}" submitted successfully (Job #${jobAttrs['job-id'] || '?'})`,
    },
  };
}

async function logIppJob(
  req: any,
  equipment: any,
  ip: string,
  jobName: string,
  file: any,
  result: any
) {
  const jobId = result?.['job-attributes-tag']?.['job-id'] || '?';
  await logActivity({
    action: ActivityAction.UPDATE,
    entityType: EntityType.EQUIPMENT,
    entityId: equipment.id,
    entityName: equipment.name,
    description: `Sent IPP print job "${jobName}" (${(file.size / 1024).toFixed(0)} KB) to ${ip} — Job #${jobId}`,
    userId: req.userId,
    req,
  });
}

/** Categorize a Windows service by name pattern for UI grouping */
function categorizeService(name: string, displayName: string): string {
  const n = (name + ' ' + displayName).toLowerCase();
  if (n.includes('print') || n.includes('spooler')) return 'Printing';
  if (n.includes('efi') || n.includes('fiery')) return 'EFI/Fiery';
  if (n.includes('vutek') || n.includes('efi')) return 'EFI/Fiery';
  if (
    n.includes('network') ||
    n.includes('dns') ||
    n.includes('dhcp') ||
    n.includes('tcp') ||
    n.includes('lan')
  )
    return 'Networking';
  if (n.includes('remote') || n.includes('rdp') || n.includes('terminal')) return 'Remote Access';
  if (n.includes('sql') || n.includes('database') || n.includes('postgres') || n.includes('mysql'))
    return 'Database';
  if (n.includes('web') || n.includes('http') || n.includes('iis') || n.includes('apache'))
    return 'Web Server';
  if (n.includes('update') || n.includes('windows update')) return 'Updates';
  if (
    n.includes('antivirus') ||
    n.includes('defender') ||
    n.includes('security') ||
    n.includes('firewall')
  )
    return 'Security';
  if (n.includes('audio') || n.includes('sound')) return 'Audio';
  if (n.includes('bluetooth')) return 'Bluetooth';
  return 'System';
}

export default router;
