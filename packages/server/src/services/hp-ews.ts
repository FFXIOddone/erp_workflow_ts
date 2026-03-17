/**
 * HP Latex Embedded Web Server (EWS) Service
 * 
 * Polls the HP Latex 800W's built-in REST API for rich printer data:
 * - Real-time print status & current activity
 * - Job queue with full history (names, timestamps, ink/media usage per job)
 * - Ink cartridge levels with HP 873 part numbers, batch, warranty, expiry
 * - Printhead health with gauge levels & expiration
 * - Maintenance status (condensate collector, distilled water tank)
 * - Media system (loaded substrate, roll width, cutter status)
 * - Active alerts & event log
 * - Usage statistics (total impressions)
 * - Device identity & system uptime
 * 
 * The 800W serves its EWS on HTTPS with a self-signed cert.
 * JSON responses require Accept: application/json header.
 * Job queue paths do NOT use .json extension.
 */

import https from 'https';
import { parseJobInfo } from './thrive.js';

// TLS agent that accepts the printer's self-signed cert
const agent = new https.Agent({ rejectUnauthorized: false });

// ============ Types ============

export interface EWSInkCartridge {
  slotId: number;
  color: string;
  colorHex: string;
  levelPercent: number;
  levelCc: number;
  capacityCc: number;
  partNumber: string;
  orderNumber: string;
  serialNumber: string;
  batchId: string;
  brand: string;
  state: string;
  expirationDate: string | null;
  installDate: string | null;
  warrantyStatus: string;
  cumulativeInkUsedCc: number;
  insertionCount: number;
  supplyType: string; // "Supply" (cartridge) or "Reservoir" (internal tank)
  isPresent: boolean;
}

export interface EWSPrinthead {
  slotId: number;
  colors: string[];
  healthGaugeLevel: number; // 0-100
  healthGaugeStatus: string;
  expirationDate: string | null;
  inkConsumptionCc: number;
  expiredInkUsedCc: number;
  inWarranty: boolean;
  positionX: number;
  positionY: number;
  statusFlag: string;
  // Extended fields (800W JSON API)
  orderNumber: string;
  partNumber: string;
  serialNumber: string;
  installDate: string | null;
  manufacturingDate: string | null;
  warrantyStatus: string;
  warrantyExpirationDate: string | null;
  nominalLife: number;
  usageTime: string;
  manufacturer: string;
  state: string;
}

export interface EWSMaintenanceItem {
  id: string;
  name: string;
  type: string; // 'condensate' | 'liquid_tank' | 'maintenance_cartridge' | 'waste_collector' | 'pmk'
  levelPercent: number;
  currentCc: number;
  totalCapacityCc: number;
  state: string;
  description?: string;
  isPresent: boolean;
  partNumber?: string;
  serialNumber?: string;
  orderNumber?: string;
  liquidType?: string;
}

export interface EWSJob {
  uuid: string;
  name: string;
  workOrderNumber: string | null;
  customerName: string | null;
  status: string; // 'Completed' | 'Printing' | 'Cancelled' | 'Held' | 'Queued'
  completionStatus: string; // 'OK' | 'Cancelled'
  holdReason: string;
  submittedAt: string | null;
  arrivedAt: string | null;
  printingAt: string | null;
  completedAt: string | null;
  copies: number;
  printedCopies: number;
  printedPages: number;
  totalPages: number;
  progressPercent: number;
  estimatedTimeRemainingSec: number;
  applicationName: string;
  userName: string;
  source: string;
  inkUsage: { color: string; amountCc: number }[];
  totalInkCc: number;
  mediaUsageSqIn: number;
  colorPixelCoverage: number;
  grayPixelCoverage: number;
}

export interface EWSAlert {
  description: string;
  severity: string;
  type?: string;
}

export interface EWSDeviceStatus {
  currentActivity: string; // 'Printing' | 'Idle' | 'Drying' | 'WarmingUp' etc.
  activityDetails: string;
  remainingTimeSec: number;
  statusSeverity: string;
  mostRelevantStatus: string;
}

export interface EWSMediaInfo {
  type: string;
  width: string;
  source: string;
  cutterInstalled: boolean;
  margins: { top: number; bottom: number; left: number; right: number };
  remainingLengthIn?: number; // Remaining roll length in inches
}

export interface EWSIdentity {
  productName: string;
  productNumber: string;
  serialNumber: string;
  firmwareVersion: string;
  biosVersion: string;
  memoryMb: number;
  storageSizeGb: number;
  colorSupported: boolean;
  uptimeSeconds: number;
  systemTime: string;
}

export interface EWSData {
  available: boolean;
  lastPolled: string;
  identity: EWSIdentity | null;
  status: EWSDeviceStatus | null;
  ink: EWSInkCartridge[];
  printheads: EWSPrinthead[];
  maintenance: EWSMaintenanceItem[];
  media: EWSMediaInfo | null;
  alerts: EWSAlert[];
  jobs: EWSJob[];
  jobQueueStatus: string;
  jobQueueTotal: number;
  activeJob: EWSJob | null;
  totalImpressions: number | null;
  error?: string;
}

// ============ HTTP Fetch Helper ============

function fetchEWS(ip: string, path: string, timeoutMs: number = 8000): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = `https://${ip}${path}`;
    const req = https.get(url, {
      agent,
      headers: { 'Accept': 'application/json' },
      timeout: timeoutMs,
    }, (res) => {
      if (res.statusCode !== 200) {
        // Drain response
        res.resume();
        reject(new Error(`HTTP ${res.statusCode} for ${path}`));
        return;
      }
      let data = '';
      res.on('data', (chunk: Buffer) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error(`Invalid JSON from ${path}`));
        }
      });
    });
    req.on('error', (err: Error) => reject(err));
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout fetching ${path}`)); });
  });
}

// ============ Color Mapping ============

const INK_COLOR_HEX: Record<string, string> = {
  'cyan': '#00BCD4',
  'magenta': '#E91E63',
  'yellow': '#FFEB3B',
  'black': '#212121',
  'light-cyan': '#80DEEA',
  'light-magenta': '#F48FB1',
  'pre-treatment': '#9E9E9E',      // Optimizer
  'scratch-agent': '#BDBDBD',      // Overcoat
  'white': '#FFFFFF',
};

const INK_DISPLAY_NAMES: Record<string, string> = {
  'cyan': 'Cyan',
  'magenta': 'Magenta',
  'yellow': 'Yellow',
  'black': 'Black',
  'light-cyan': 'Light Cyan',
  'light-magenta': 'Light Magenta',
  'pre-treatment': 'Optimizer',
  'scratch-agent': 'Overcoat',
  'white': 'White',
};

// ============ Data Parsers ============

/**
 * Safely extract a numeric value from HP EWS API responses.
 * HP APIs return some fields as plain numbers and others as {Unit, Value} objects.
 * This normalizes both forms to a plain number.
 */
function numVal(v: any, fallback: number = 0): number {
  if (v == null) return fallback;
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && 'Value' in v) return numVal(v.Value, fallback);
  const parsed = parseFloat(v);
  return isNaN(parsed) ? fallback : parsed;
}

/**
 * Safely extract a string value from HP EWS API responses.
 * Some fields may be returned as {Unit, Value} objects instead of plain strings.
 */
function strVal(v: any, fallback: string = ''): string {
  if (v == null) return fallback;
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && 'Value' in v) return String(v.Value ?? fallback);
  return String(v);
}

/**
 * Parse ISO 8601 duration (e.g., "P0Y0M0DT2H39M31S") to seconds
 */
function parseISO8601Duration(duration: string | null | undefined): number {
  if (!duration) return 0;
  try {
    // Format: P[n]Y[n]M[n]DT[n]H[n]M[n]S
    const match = duration.match(/P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/);
    if (!match) return 0;
    const years = parseInt(match[1] || '0', 10);
    const months = parseInt(match[2] || '0', 10);
    const days = parseInt(match[3] || '0', 10);
    const hours = parseInt(match[4] || '0', 10);
    const minutes = parseInt(match[5] || '0', 10);
    const seconds = parseFloat(match[6] || '0');
    // Approximate: 365 days/year, 30 days/month
    return Math.round(
      years * 365 * 24 * 3600 +
      months * 30 * 24 * 3600 +
      days * 24 * 3600 +
      hours * 3600 +
      minutes * 60 +
      seconds
    );
  } catch {
    return 0;
  }
}

function parseIdentity(idData: any, discoveryData: any, configData: any): EWSIdentity | null {
  try {
    const id = idData?.Identification;
    const disc = discoveryData?.Discovery;
    if (!id) return null;

    // HP Latex 800W uses Identification.Fields and Identification.FeatureDictionaries
    const fields = id.Fields || {};
    const features = id.FeatureDictionaries || {};
    
    // Storage info from FeatureDictionaries.Storage
    const storageInfo = features.Storage || {};
    const ramMb = numVal(storageInfo.RAM?.Capacity); // Already in MB
    const storageGb = numVal(storageInfo.HardDisk?.Capacity); // Already in GB

    // Parse uptime from ISO 8601 duration format (e.g., "P0Y0M0DT2H39M31S")
    const uptimeStr = disc?.SystemTimeInfo?.Uptime || '';
    const uptimeSeconds = parseISO8601Duration(uptimeStr);

    return {
      productName: fields.ModelName || id.ProductName || '',
      productNumber: fields.PartNumber || id.ProductNumber || '',
      serialNumber: (fields.SerialNumber || id.SerialNumber || '').trim(),
      firmwareVersion: fields.FwReleaseName || fields.FirmwareVersion || id.FirmwareVersion || '',
      biosVersion: fields.BIOSVersion || id.DeviceInformation?.HWInfo?.BIOSVersion || '',
      memoryMb: ramMb,
      storageSizeGb: storageGb,
      colorSupported: features.PrinterCapabilities?.ColorFeature?.Supported === 'true' || 
                      (id.Interpreters?.Interpreter?.some?.((i: any) => i.ColorPrinting === true) ?? true),
      uptimeSeconds,
      systemTime: disc?.SystemTimeInfo?.Date || disc?.SystemTime || '',
    };
  } catch {
    return null;
  }
}

function parseDeviceStatus(data: any): EWSDeviceStatus | null {
  try {
    const ds = data?.DeviceStatus;
    if (!ds) return null;

    const activities = ds.ActivitiesOverview?.CurrentActivities?.Activity;
    const mostRelevant = ds.ActivitiesOverview?.MostRelevantActivity;
    const activity = mostRelevant || (Array.isArray(activities) ? activities[0] : activities);

    return {
      currentActivity: strVal(activity?.Name, 'Unknown'),
      activityDetails: strVal(activity?.Type),
      remainingTimeSec: numVal(activity?.RemainingTime),
      statusSeverity: strVal(ds.StatusOverview?.StatusSeverity),
      mostRelevantStatus: strVal(ds.StatusOverview?.MostRelevantStatus),
    };
  } catch {
    return null;
  }
}

function parseInk(data: any): EWSInkCartridge[] {
  try {
    // HP Latex 800W uses InkSlotGroupCollection.InkSlotGroup
    const groups = data?.InkSystem?.InkSlotGroupCollection?.InkSlotGroup 
                || data?.InkSystem?.InkSlotGroup;
    if (!groups) return [];

    const cartridges: EWSInkCartridge[] = [];
    const groupArr = Array.isArray(groups) ? groups : [groups];

    for (const group of groupArr) {
      const slots = group?.InkSlotCollection?.InkSlot;
      if (!slots) continue;
      const slotArr = Array.isArray(slots) ? slots : [slots];

      // Get color from the group level (HP Latex structure)
      const groupColor = (group.Color || '').toLowerCase();

      for (const slot of slotArr) {
        if (!slot.isPresent && !slot.isVisible) continue;

        // Only include cartridges (Supply), not internal reservoirs
        // Reservoirs are internal tanks that buffer ink from cartridges
        const supplyType = slot.SupplyType || 'Supply';
        if (supplyType === 'Reservoir') continue;

        const supplyInfo = slot.SlotInfo?.InkSupplyInfo;
        const cumInfo = slot.SlotInfo?.InkSlotCumulativeInfo;
        // Use group color if slot doesn't have one
        const color = (slot.Color || groupColor || '').toLowerCase();

        cartridges.push({
          slotId: numVal(slot.SlotId),
          color: INK_DISPLAY_NAMES[color] || strVal(slot.Color || group.Color, 'Unknown'),
          colorHex: INK_COLOR_HEX[color] || '#757575',
          levelPercent: numVal(supplyInfo?.LevelPercentage, -1),
          levelCc: numVal(supplyInfo?.Level),
          capacityCc: numVal(supplyInfo?.Capacity),
          partNumber: strVal(supplyInfo?.PartNumber),
          orderNumber: strVal(supplyInfo?.OrderNumber),
          serialNumber: strVal(supplyInfo?.SerialNumber),
          batchId: strVal(supplyInfo?.BatchID),
          brand: strVal(supplyInfo?.Brand, 'HP'),
          state: strVal(supplyInfo?.State, 'Unknown'),
          expirationDate: supplyInfo?.ExpirationDate || null,
          installDate: supplyInfo?.InstallDate || null,
          warrantyStatus: strVal(supplyInfo?.WarrantyStatus, 'Unknown'),
          cumulativeInkUsedCc: numVal(cumInfo?.HPInkUsed) || numVal(cumInfo?.InkUsed),
          insertionCount: numVal(cumInfo?.NumberOfInsertions),
          supplyType,
          isPresent: slot.isPresent ?? true,
        });
      }
    }
    return cartridges;
  } catch {
    return [];
  }
}

function parsePrintheads(data: any): EWSPrinthead[] {
  try {
    const phStatus = data?.PrintheadsStatus;
    // 800W uses PrintheadSlotCollection.PrintheadSlot, older models use PrintheadSlot directly
    const slots = phStatus?.PrintheadSlot || phStatus?.PrintheadSlotCollection?.PrintheadSlot;
    if (!slots) return [];
    const slotArr = Array.isArray(slots) ? slots : [slots];

    return slotArr.map((slot: any, idx: number) => {
      const info = slot.PrintheadInfo || {};
      const colors = slot.ColorCollection?.Color;
      const colorArr = Array.isArray(colors) ? colors : (colors ? [colors] : []);
      const inWarrantyRaw = info.InWarranty;
      const inWarranty = inWarrantyRaw === true || inWarrantyRaw === 'true';

      return {
        slotId: numVal(slot.SlotId, idx + 1),
        colors: colorArr.map((c: any) => typeof c === 'string' ? c : strVal(c?.Name, 'Unknown')),
        healthGaugeLevel: numVal(info.HealthGaugeLevel, -1),
        healthGaugeStatus: strVal(info.HealthGaugeStatus, 'Unknown'),
        expirationDate: info.ExpirationDate || null,
        inkConsumptionCc: numVal(info.InkConsumption),
        expiredInkUsedCc: numVal(info.ExpiredInkUsed),
        inWarranty,
        positionX: numVal(slot.Position?.X),
        positionY: numVal(slot.Position?.Y),
        statusFlag: strVal(info.DetailedStatus?.PHStatusFlag, 'Unknown'),
        // Extended fields
        orderNumber: strVal(info.OrderNumber),
        partNumber: strVal(info.PartNumber),
        serialNumber: strVal(info.SerialNumber),
        installDate: info.InstallDate || null,
        manufacturingDate: info.ManufacturingDate || null,
        warrantyStatus: strVal(info.WarrantyStatus, 'Unknown'),
        warrantyExpirationDate: info.WarrantyExpirationDate || null,
        nominalLife: numVal(info.NominalLife),
        usageTime: strVal(info.UsageTime),
        manufacturer: strVal(info.Manufacturer, 'HP'),
        state: strVal(info.State, 'Unknown'),
      };
    });
  } catch {
    return [];
  }
}

function parseMaintenance(data: any): EWSMaintenanceItem[] {
  try {
    const pm = data?.PrinterMaintenance;
    if (!pm) return [];

    const items: EWSMaintenanceItem[] = [];

    // Condensate Collectors
    const condensate = pm.CondensateCollectors?.CondensateCollector;
    if (condensate) {
      const cArr = Array.isArray(condensate) ? condensate : [condensate];
      for (const c of cArr) {
        items.push({
          id: strVal(c.Id, 'condensate'),
          name: 'Condensate Collector',
          type: 'condensate',
          levelPercent: numVal(c.UsagePercentage),
          currentCc: numVal(c.Level),
          totalCapacityCc: numVal(c.TotalCapacity),
          state: strVal(c.State, 'Unknown'),
          isPresent: c.IsPresent ?? true,
        });
      }
    }

    // Liquid Tanks (distilled water etc.)
    const tanks = pm.LiquidTanks?.LiquidTank;
    if (tanks) {
      const tArr = Array.isArray(tanks) ? tanks : [tanks];
      for (const t of tArr) {
        items.push({
          id: strVal(t.Id, 'tank'),
          name: strVal(t.Name, 'Liquid Tank'),
          type: 'liquid_tank',
          levelPercent: numVal(t.LevelPercentage),
          currentCc: numVal(t.Level),
          totalCapacityCc: numVal(t.Capacity),
          state: strVal(t.State, 'Unknown'),
          isPresent: t.IsPresent ?? true,
          partNumber: strVal(t.PartNumber) || undefined,
          serialNumber: strVal(t.SerialNumber) || undefined,
          orderNumber: strVal(t.OrderNumber) || undefined,
          liquidType: strVal(t.LiquidType) || undefined,
        });
      }
    }

    // Maintenance Cartridges (spittoon/web)
    const maintCart = pm.MaintenanceCartridges?.MaintenanceCartridge;
    if (maintCart) {
      const mArr = Array.isArray(maintCart) ? maintCart : [maintCart];
      for (const mc of mArr) {
        items.push({
          id: strVal(mc.Id, 'maint_cart'),
          name: 'Maintenance Cartridge',
          type: 'maintenance_cartridge',
          levelPercent: numVal(mc.LevelPercentage),
          currentCc: 0,
          totalCapacityCc: 0,
          state: strVal(mc.State || mc.Status?.MaintenanceCartridgeStatusFlag, 'Unknown'),
          isPresent: mc.IsPresent ?? true,
        });
      }
    }

    // Waste Collectors (waste ink)
    const waste = pm.WasteCollectors?.WasteCollector;
    if (waste) {
      const wArr = Array.isArray(waste) ? waste : [waste];
      for (const w of wArr) {
        items.push({
          id: strVal(w.WasteCollectorId || w.Id, 'waste'),
          name: 'Waste Collector',
          type: 'waste_collector',
          levelPercent: numVal(w.LevelPercentage),
          currentCc: numVal(w.LevelPercentage) * numVal(w.Capacity) / 100,
          totalCapacityCc: numVal(w.Capacity),
          state: strVal(w.Status, 'Unknown'),
          isPresent: w.IsPresent ?? true,
          partNumber: strVal(w.PartNumber) || undefined,
        });
      }
    }

    // Preventive Maintenance Kits (PMKs)
    const pmks = pm.PreventiveMaintenanceKits?.PreventiveMaintenanceKit;
    if (pmks) {
      const pmkArr = Array.isArray(pmks) ? pmks : [pmks];
      for (const pmk of pmkArr) {
        // Clean description - remove pipe delimiters used by HP
        const rawDesc = strVal(pmk.Description);
        const description = rawDesc.replace(/^\||\|$/g, '').trim();
        items.push({
          id: strVal(pmk.PMKId || pmk.Id, 'pmk'),
          name: description || `Preventive Maintenance Kit ${pmk.Id}`,
          type: 'pmk',
          levelPercent: numVal(pmk.PercentageConsumed),
          currentCc: 0,
          totalCapacityCc: 0,
          state: strVal(pmk.Status?.PMKStatusFlag, 'Unknown'),
          isPresent: true,
          partNumber: strVal(pmk.PartNumber || pmk.ServiceId) || undefined,
          description,
        });
      }
    }

    return items;
  } catch {
    return [];
  }
}

function parseMedia(data: any): EWSMediaInfo | null {
  try {
    const ms = data?.MediaSystem;
    if (!ms) return null;

    // HP Latex 800W uses nested DrawerCollection structure
    const drawer = ms.DrawerCollection?.Drawer;
    const roll = drawer?.InputDeviceCollection?.Roll;
    const loadedMedia = roll?.LoadedMediaCollection?.LoadedMedia;
    const settings = ms.Settings;
    const cutter = ms.CuttingDeviceCollection?.CuttingDevice;

    // Format width with unit
    const widthValue = numVal(loadedMedia?.Width?.Value ?? loadedMedia?.Width, -1);
    const widthUnit = strVal(loadedMedia?.Width?.Unit, 'in');
    const widthStr = widthValue >= 0 ? `${Math.round(widthValue * 10) / 10} ${widthUnit}` : '';

    // Get remaining length
    const remainingLength = numVal(loadedMedia?.RemainingLength?.Value ?? loadedMedia?.RemainingLength);

    // Get margins
    const margins = roll?.Attributes?.Margins;

    return {
      type: strVal(loadedMedia?.MediaTypeID, 'Unknown'),
      width: widthStr,
      source: strVal(roll?.IdForUI || drawer?.Name, 'Roll'),
      cutterInstalled: settings?.CutterEnabled ?? cutter != null,
      margins: {
        top: numVal(margins?.Top),
        bottom: numVal(margins?.Bottom),
        left: numVal(margins?.Left),
        right: numVal(margins?.Right),
      },
      // Extended info for HP Latex
      remainingLengthIn: remainingLength,
    } as EWSMediaInfo;
  } catch {
    return null;
  }
}

function parseAlerts(data: any): EWSAlert[] {
  try {
    // 800W uses ActiveAlerts.List.Alert structure
    const alertList = data?.ActiveAlerts?.List?.Alert || data?.ActiveAlerts?.Alert;
    if (!alertList) return [];
    const arr = Array.isArray(alertList) ? alertList : [alertList];
    return arr.map((a: any) => {
      // Build a human-readable description from the 800W's structured format
      let description = '';
      if (a.FullName) {
        // Parse structured names like "/IDS/CARTRIDGE_GROUPS/CARTRIDGE_GROUP_yellow_1/CARTRIDGE_4/VERYLOW"
        const fullName = strVal(a.FullName);
        const name = strVal(a.Name);
        const area = strVal(a.Area);
        
        // Extract meaningful parts
        const cartridgeMatch = fullName.match(/CARTRIDGE_GROUP_([^/]+)/);
        const pmkMatch = fullName.match(/PREVENTIVE_MAINTENANCE_KIT_(\d+)_([^/]+)/);
        const mediaMatch = fullName.match(/INTRAY_(\d+)_(\w+)/);
        
        if (cartridgeMatch) {
          const color = cartridgeMatch[1].replace(/_\d+$/, '').replace(/-/g, ' ');
          const displayColor = INK_DISPLAY_NAMES[color] || color;
          description = `${displayColor}: ${name.toLowerCase().replace(/_/g, ' ')}`;
        } else if (pmkMatch) {
          description = `Maintenance kit ${pmkMatch[2]}: ${name.toLowerCase().replace(/_/g, ' ')}`;
        } else if (mediaMatch) {
          description = `Media ${mediaMatch[2]}: ${name.toLowerCase().replace(/_/g, ' ')}`;
        } else {
          description = name.toLowerCase().replace(/_/g, ' ');
        }
      } else {
        description = strVal(a.Description || a.AlertType, 'Unknown alert');
      }
      
      return {
        description,
        severity: strVal(a.Severity, 'Warning'),
        type: strVal(a.Name || a.AlertType) || undefined,
      };
    });
  } catch {
    return [];
  }
}

function parseTimestamp(ts: string | null | undefined): string | null {
  if (!ts || ts === '1970-01-01T00:00:00Z') return null;
  return ts;
}

function parseJobs(data: any): { jobs: EWSJob[]; queueStatus: string; total: number } {
  try {
    const snapshot = data?.JobQueueSnapshot;
    if (!snapshot) return { jobs: [], queueStatus: 'Unknown', total: 0 };

    const queueStatus = snapshot.Status?.JobQueueStatus || 'Unknown';
    const total = snapshot.Status?.NumberOfJobs || 0;
    const jobList = snapshot.Jobs?.Job;
    if (!jobList) return { jobs: [], queueStatus, total };

    const jobArr = Array.isArray(jobList) ? jobList : [jobList];

    const jobs: EWSJob[] = jobArr.map((job: any) => {
      const j = job.Job2DPrint || job;
      const settings = j.Settings || {};
      const accounting = j.Accounting || {};
      const progress = j.Progress || {};
      const pages = j.Pages || {};
      const status = j.Status || {};

      // Parse ink usage
      const inkCollection = accounting.InkCollectionConsumption?.InkConsumption;
      const inkUsage: { color: string; amountCc: number }[] = [];
      let totalInkCc = 0;
      if (inkCollection) {
        const inkArr = Array.isArray(inkCollection) ? inkCollection : [inkCollection];
        for (const ink of inkArr) {
          const cc = numVal(ink.Amount);
          if (cc > 0) {
            inkUsage.push({ color: strVal(ink.InkName, 'unknown'), amountCc: cc });
            totalInkCc += cc;
          }
        }
      }

      // Media usage
      const mediaCons = accounting.MediaCollectionConsumption?.MediaConsumption;
      const mediaUsageSqIn = numVal(mediaCons?.SquareAmount);

      // Page coverage
      const page = pages.Page;
      const pageAccounting = page?.Accounting || {};

      const jobName = strVal(settings.JobName, '(unnamed)');
      const jobInfo = parseJobInfo(jobName);

      return {
        uuid: strVal(j.UUID),
        name: jobName,
        workOrderNumber: jobInfo.workOrderNumber,
        customerName: jobInfo.customerName,
        status: strVal(status.JobStatus, 'Unknown'),
        completionStatus: strVal(status.CompletionStatus),
        holdReason: strVal(status.HoldReason, 'None'),
        submittedAt: parseTimestamp(accounting.SubmissionTimestamp),
        arrivedAt: parseTimestamp(accounting.ArrivalTimestamp),
        printingAt: parseTimestamp(accounting.PrintingTimestamp),
        completedAt: parseTimestamp(accounting.CompletionTimestamp),
        copies: numVal(settings.RequestedCopies, 1),
        printedCopies: numVal(progress.NumberOfPrintedCopies),
        printedPages: numVal(progress.NumberOfPrintedPages),
        totalPages: numVal(pages.NumberOfPages, 1),
        progressPercent: numVal(progress.ProgressPercentage),
        estimatedTimeRemainingSec: numVal(progress.EstimatedPrintingTime),
        applicationName: strVal(settings.ApplicationName),
        userName: strVal(settings.UserName),
        source: strVal(settings.Source),
        inkUsage,
        totalInkCc,
        mediaUsageSqIn,
        colorPixelCoverage: numVal(pageAccounting.ColorPixelCoverage),
        grayPixelCoverage: numVal(pageAccounting.GrayPixelCoverage),
      };
    });

    // Sort by arrival time (newest first)
    jobs.sort((a, b) => {
      const ta = a.arrivedAt ? new Date(a.arrivedAt).getTime() : 0;
      const tb = b.arrivedAt ? new Date(b.arrivedAt).getTime() : 0;
      return tb - ta;
    });

    return { jobs, queueStatus, total };
  } catch {
    return { jobs: [], queueStatus: 'Error', total: 0 };
  }
}

// ============ Product Usage Parser ============

function parseProductUsage(data: any): number | null {
  try {
    const usage = data?.ProductUsageDyn;
    if (!usage) return null;

    // Try TotalImpressions directly
    const total = numVal(usage.TotalImpressions, -1);
    if (total >= 0) return total;

    // 800W nests it under PrinterSubunit
    const printerSub = usage.PrinterSubunit;
    if (printerSub) {
      const subTotal = numVal(printerSub.TotalImpressions, -1);
      if (subTotal >= 0) return subTotal;
    }

    // Some models nest it under PrintUsageInfo
    const printUsage = usage.PrintUsageInfo;
    if (printUsage) {
      const totalPrint = numVal(printUsage.TotalImpressions, -1);
      if (totalPrint >= 0) return totalPrint;
    }

    return null;
  } catch {
    return null;
  }
}

// ============ Cache ============

interface EWSCache {
  data: EWSData;
  queueUUID: string | null;
  lastFull: number; // timestamp of last full poll
}

const ewsCache = new Map<string, EWSCache>();

// ============ Queue UUID Discovery ============

async function discoverQueueUUID(ip: string): Promise<string | null> {
  try {
    const data = await fetchEWS(ip, '/LFPWebServices/PI/JQ/JobQueueCollection');
    // The response contains a JobQueueCollection with the queue URI
    const collection = data?.JobQueueCollection;
    if (!collection) return null;

    // The queue can be under "Queue" or "JobQueue" key
    const queues = collection.Queue || collection.JobQueue;
    const qArr = Array.isArray(queues) ? queues : (queues ? [queues] : []);
    for (const q of qArr) {
      const uri = q.URI || q.uri || '';
      // URI format: /LFPWebServices/PI/JQ/JobQueue/{UUID}
      const match = uri.match(/JobQueue\/([a-f0-9-]+)/i);
      if (match) return match[1];
    }

    // Try direct UUID extraction from URI string  
    const uriStr = JSON.stringify(data);
    const uuidMatch = uriStr.match(/JobQueue\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
    if (uuidMatch) return uuidMatch[1];

    return null;
  } catch {
    return null;
  }
}

// ============ Main Poll Function ============

export async function pollHPEWS(ip: string): Promise<EWSData> {
  const now = Date.now();
  const cached = ewsCache.get(ip);

  // Return cache if polled within last 10 seconds
  if (cached && (now - cached.lastFull) < 10_000) {
    return cached.data;
  }

  const result: EWSData = {
    available: false,
    lastPolled: new Date().toISOString(),
    identity: null,
    status: null,
    ink: [],
    printheads: [],
    maintenance: [],
    media: null,
    alerts: [],
    jobs: [],
    jobQueueStatus: 'Unknown',
    jobQueueTotal: 0,
    activeJob: null,
    totalImpressions: null,
  };

  try {
    // Discover queue UUID if not cached
    let queueUUID = cached?.queueUUID || null;
    if (!queueUUID) {
      queueUUID = await discoverQueueUUID(ip);
    }

    // Fetch all endpoints in parallel
    const [
      idData,
      discoveryData,
      configData,
      statusData,
      inkData,
      printheadData,
      maintenanceData,
      mediaData,
      alertData,
      jobData,
      usageData,
    ] = await Promise.allSettled([
      fetchEWS(ip, '/LFPWebServices/PI/Identification.json'),
      fetchEWS(ip, '/LFPWebServices/PI/Discovery.json'),
      fetchEWS(ip, '/DevMgmt/ProductConfigDyn.json'),
      fetchEWS(ip, '/LFPWebServices/PI/DeviceStatus.json'),
      fetchEWS(ip, '/LFPWebServices/PI/InkSystem.json'),
      fetchEWS(ip, '/LFPWebServices/PI/PrintheadsStatus.json'),
      fetchEWS(ip, '/LFPWebServices/PI/PrinterMaintenance.json'),
      fetchEWS(ip, '/LFPWebServices/PI/MediaSystem.json?units=imperial'),
      fetchEWS(ip, '/LFPWebServices/PI/Alerts.json/ActiveAlerts'),
      queueUUID
        ? fetchEWS(ip, `/LFPWebServices/PI/JQ/JobQueue/${queueUUID}/jobs/all`, 15000)
        : Promise.reject(new Error('No queue UUID')),
      fetchEWS(ip, '/DevMgmt/ProductUsageDyn.json'),
    ]);

    // Parse results
    result.identity = parseIdentity(
      idData.status === 'fulfilled' ? idData.value : null,
      discoveryData.status === 'fulfilled' ? discoveryData.value : null,
      configData.status === 'fulfilled' ? configData.value : null,
    );

    result.status = statusData.status === 'fulfilled'
      ? parseDeviceStatus(statusData.value)
      : null;

    result.ink = inkData.status === 'fulfilled'
      ? parseInk(inkData.value)
      : [];

    result.printheads = printheadData.status === 'fulfilled'
      ? parsePrintheads(printheadData.value)
      : [];

    result.maintenance = maintenanceData.status === 'fulfilled'
      ? parseMaintenance(maintenanceData.value)
      : [];

    result.media = mediaData.status === 'fulfilled'
      ? parseMedia(mediaData.value)
      : null;

    result.alerts = alertData.status === 'fulfilled'
      ? parseAlerts(alertData.value)
      : [];

    if (jobData.status === 'fulfilled') {
      const parsed = parseJobs(jobData.value);
      result.jobs = parsed.jobs;
      result.jobQueueStatus = parsed.queueStatus;
      result.jobQueueTotal = parsed.total;

      // Find the active/printing job
      result.activeJob = parsed.jobs.find(j => j.status === 'Printing') || null;
    }

    // Parse total impressions from ProductUsageDyn
    if (usageData.status === 'fulfilled') {
      result.totalImpressions = parseProductUsage(usageData.value);
    }

    result.available = true;

    // Cache
    ewsCache.set(ip, {
      data: result,
      queueUUID,
      lastFull: now,
    });

  } catch (err: any) {
    result.error = err.message || 'Unknown error polling EWS';
    // If we had cached data, return it with updated error
    if (cached) {
      cached.data.error = result.error;
      cached.data.lastPolled = result.lastPolled;
      return cached.data;
    }
  }

  return result;
}

/**
 * Check if an IP address belongs to an HP Latex with EWS.
 * Quick probe — just hits the identification endpoint.
 * Handles both 570-style (Identification.ProductName) and 800W-style (Identification.Fields.ModelName).
 */
export async function isHPLatexEWS(ip: string): Promise<boolean> {
  try {
    const data = await fetchEWS(ip, '/LFPWebServices/PI/Identification.json', 4000);
    const id = data?.Identification;
    const name = id?.ProductName || id?.Fields?.ModelName || '';
    return name.toLowerCase().includes('latex');
  } catch {
    return false;
  }
}

/**
 * Get cached EWS data without triggering a new poll
 */
export function getCachedEWSData(ip: string): EWSData | null {
  const cached = ewsCache.get(ip);
  return cached?.data || null;
}
