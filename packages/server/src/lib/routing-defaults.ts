/**
 * Routing defaults logic for work orders.
 *
 * Rules:
 * 1. Order Entry is included for all non-WooCommerce orders.
 * 2. If any PRINTING station exists (ROLL_TO_ROLL, FLATBED, SCREEN_PRINT) ->
 *    auto-add PRODUCTION and SHIPPING_RECEIVING + their sub-stations.
 * 3. If description contains "(INSTALL)" -> auto-add INSTALLATION.
 * 4. If description contains "(OUTSOURCED)" or the order is design only ->
 *    keep the route in the design-only lane.
 * 5. If needsProof is true -> auto-add the design proofing chain.
 *
 * The user can always remove stations later - it's easier to remove from a
 * few orders than to add routes to every single one.
 */
import { PrintingMethod, StationStatus, inferRoutingFromOrderDetails, isDesignOnlyOrder } from '@erp/shared';

export type RoutingSource = 'manual' | 'production-list' | 'spreadsheet' | 'qb' | 'recurring' | 'woocommerce';

export interface RoutingDefaultsOptions {
  description?: string;
  needsProof?: boolean;
  source?: RoutingSource;
}

export interface InitialStationProgressEntry {
  station: PrintingMethod;
  status: StationStatus;
  startedAt?: Date;
  completedAt?: Date | null;
}

const PRINTING_STATIONS = new Set<PrintingMethod>([
  PrintingMethod.ROLL_TO_ROLL,
  PrintingMethod.FLATBED,
  PrintingMethod.SCREEN_PRINT,
]);

const DESIGN_STATIONS = new Set<PrintingMethod>([
  PrintingMethod.DESIGN_ONLY,
  PrintingMethod.DESIGN,
  PrintingMethod.DESIGN_PROOF,
  PrintingMethod.DESIGN_APPROVAL,
  PrintingMethod.DESIGN_PRINT_READY,
]);

/**
 * Preferred station ordering for consistent routing display.
 * Mirrors the full workflow from Sales → Complete.
 */
const STATION_ORDER: PrintingMethod[] = [
  PrintingMethod.SALES,
  PrintingMethod.ORDER_ENTRY,
  PrintingMethod.DESIGN_ONLY,
  PrintingMethod.DESIGN,
  PrintingMethod.DESIGN_PROOF,
  PrintingMethod.DESIGN_APPROVAL,
  PrintingMethod.DESIGN_PRINT_READY,
  PrintingMethod.FLATBED,
  PrintingMethod.FLATBED_PRINTING,
  PrintingMethod.ROLL_TO_ROLL,
  PrintingMethod.ROLL_TO_ROLL_PRINTING,
  PrintingMethod.SCREEN_PRINT,
  PrintingMethod.SCREEN_PRINT_PRINTING,
  PrintingMethod.SCREEN_PRINT_ASSEMBLY,
  PrintingMethod.PRODUCTION,
  PrintingMethod.PRODUCTION_ZUND,
  PrintingMethod.PRODUCTION_FINISHING,
  PrintingMethod.SHIPPING_RECEIVING,
  PrintingMethod.SHIPPING_QC,
  PrintingMethod.SHIPPING_PACKAGING,
  PrintingMethod.SHIPPING_SHIPMENT,
  PrintingMethod.SHIPPING_INSTALL_READY,
  PrintingMethod.INSTALLATION,
  PrintingMethod.INSTALLATION_REMOTE,
  PrintingMethod.INSTALLATION_INHOUSE,
  PrintingMethod.COMPLETE,
  PrintingMethod.COMPLETE_INSTALLED,
  PrintingMethod.COMPLETE_SHIPPED,
  PrintingMethod.COMPLETE_DESIGN_ONLY,
];

/**
 * Apply default routing rules and return the final routing array.
 * Preserves any stations the user already selected and adds defaults.
 */
export function applyRoutingDefaults(
  routing: PrintingMethod[],
  options?: RoutingDefaultsOptions
): PrintingMethod[] {
  const source = options?.source ?? 'manual';
  const includeOrderEntry = source !== 'woocommerce';
  const description = options?.description ?? '';
  const descUpper = description.toUpperCase();
  const inferredRouting = inferRoutingFromDescription(description);
  const routingSet = new Set<PrintingMethod>([...routing, ...inferredRouting]);
  const hasExplicitDesign = Array.from(DESIGN_STATIONS).some((station) => routingSet.has(station));
  const hasPrinting = Array.from(PRINTING_STATIONS).some((station) => routingSet.has(station));
  const hasInstall = routingSet.has(PrintingMethod.INSTALLATION);
  const hasProductionWork = hasPrinting || hasInstall;

  if (isDesignOnlyOrder({ description, routing })) {
    return includeOrderEntry
      ? [PrintingMethod.ORDER_ENTRY, PrintingMethod.DESIGN_ONLY]
      : [PrintingMethod.DESIGN_ONLY];
  }

  if (includeOrderEntry) {
    routingSet.add(PrintingMethod.ORDER_ENTRY);
  }

  if (hasProductionWork && !hasExplicitDesign) {
    routingSet.add(PrintingMethod.DESIGN);
  }

  if (hasPrinting) {
    routingSet.add(PrintingMethod.PRODUCTION);
    routingSet.add(PrintingMethod.PRODUCTION_ZUND);
    routingSet.add(PrintingMethod.PRODUCTION_FINISHING);
    routingSet.add(PrintingMethod.SHIPPING_RECEIVING);
    routingSet.add(PrintingMethod.SHIPPING_QC);
    routingSet.add(PrintingMethod.SHIPPING_PACKAGING);
    routingSet.add(PrintingMethod.SHIPPING_SHIPMENT);
    routingSet.add(PrintingMethod.SHIPPING_INSTALL_READY);

    if (routingSet.has(PrintingMethod.FLATBED)) {
      routingSet.add(PrintingMethod.FLATBED_PRINTING);
    }
    if (routingSet.has(PrintingMethod.ROLL_TO_ROLL)) {
      routingSet.add(PrintingMethod.ROLL_TO_ROLL_PRINTING);
    }
    if (routingSet.has(PrintingMethod.SCREEN_PRINT)) {
      routingSet.add(PrintingMethod.SCREEN_PRINT_PRINTING);
      routingSet.add(PrintingMethod.SCREEN_PRINT_ASSEMBLY);
    }
  }

  if (hasInstall) {
    routingSet.add(PrintingMethod.SHIPPING_RECEIVING);
    routingSet.add(PrintingMethod.SHIPPING_QC);
    routingSet.add(PrintingMethod.SHIPPING_PACKAGING);
    routingSet.add(PrintingMethod.SHIPPING_SHIPMENT);
    routingSet.add(PrintingMethod.SHIPPING_INSTALL_READY);
    routingSet.add(PrintingMethod.INSTALLATION_REMOTE);
    routingSet.add(PrintingMethod.INSTALLATION_INHOUSE);
  }

  if (options?.needsProof) {
    routingSet.add(PrintingMethod.DESIGN);
    routingSet.add(PrintingMethod.DESIGN_PROOF);
  }

  if (routingSet.has(PrintingMethod.DESIGN) && (hasExplicitDesign || options?.needsProof)) {
    routingSet.add(PrintingMethod.DESIGN_PROOF);
    routingSet.add(PrintingMethod.DESIGN_APPROVAL);
    routingSet.add(PrintingMethod.DESIGN_PRINT_READY);
  }

  if (descUpper.includes('(INSTALL)')) {
    routingSet.add(PrintingMethod.INSTALLATION);
    routingSet.add(PrintingMethod.INSTALLATION_REMOTE);
    routingSet.add(PrintingMethod.INSTALLATION_INHOUSE);
  }

  if (descUpper.includes('(OUTSOURCED)')) {
    routingSet.add(PrintingMethod.ORDER_ENTRY);
  }

  return STATION_ORDER.filter((station) => routingSet.has(station));
}

/**
 * Infer likely stations from free-form order text.
 * This is intentionally conservative and only used to recover imports
 * that arrived without routing.
 */
export function inferRoutingFromDescription(description: string): PrintingMethod[] {
  return inferRoutingFromOrderDetails({ description });
}

/**
 * Normalize imported routing so spreadsheet rows receive the same default
 * downstream stations as manually created orders, while also recovering
 * missing print stations from description and section hints.
 */
export function resolveImportedRouting(options: {
  routing?: PrintingMethod[];
  description?: string | null;
  section?: string | null;
  needsProof?: boolean;
  source?: RoutingSource;
}): PrintingMethod[] {
  const description = options.description ?? '';
  const sectionUpper = (options.section ?? '').toUpperCase();
  const routingSet = new Set<PrintingMethod>(options.routing ?? []);
  const designOnly =
    isDesignOnlyOrder({ description, routing: options.routing ?? [] }) ||
    sectionUpper.includes('DESIGN ONLY');

  if (designOnly) {
    return options.source === 'woocommerce'
      ? [PrintingMethod.DESIGN_ONLY]
      : [PrintingMethod.ORDER_ENTRY, PrintingMethod.DESIGN_ONLY];
  }

  inferRoutingFromDescription(description).forEach((station) => routingSet.add(station));

  if (sectionUpper.includes('DESIGN')) {
    routingSet.add(PrintingMethod.DESIGN);
  }
  if (sectionUpper.includes('OUTSOURCED')) {
    routingSet.add(PrintingMethod.ORDER_ENTRY);
  }
  if (sectionUpper.includes('INSTALL')) {
    routingSet.add(PrintingMethod.INSTALLATION);
  }
  if (sectionUpper.includes('PRODUCTION') || sectionUpper.includes('ZUND')) {
    routingSet.add(PrintingMethod.PRODUCTION);
  }

  return applyRoutingDefaults(Array.from(routingSet), {
    description,
    needsProof: options.needsProof || sectionUpper.includes('DESIGN'),
    source: options.source,
  });
}

export function inferRoutingSource(orderNumber?: string | null, description?: string | null): RoutingSource {
  const text = `${orderNumber ?? ''} ${description ?? ''}`.toUpperCase();

  if (
    text.startsWith('WOO-') ||
    text.includes('WOOCOMMERCE') ||
    text.includes('SHOP.WILDE-SIGNS.COM') ||
    text.includes('ONLINE ORDER')
  ) {
    return 'woocommerce';
  }

  if (text.includes('RECURRING ORDER') || text.includes('AUTO-GENERATED FROM RECURRING')) {
    return 'recurring';
  }

  if (text.includes('PRODUCTION LIST')) {
    return 'production-list';
  }

  if (text.includes('SPREADSHEET')) {
    return 'spreadsheet';
  }

  if (text.includes('QUICKBOOKS') || text.includes('QB ')) {
    return 'qb';
  }

  return 'manual';
}

export function buildInitialStationProgress(
  routing: readonly PrintingMethod[],
  options?: {
    source?: RoutingSource;
    entryTimestamp?: Date;
  }
): InitialStationProgressEntry[] {
  const source = options?.source ?? 'manual';
  const entryTimestamp = options?.entryTimestamp ?? new Date();

  return routing.map((station) => {
    if (station === PrintingMethod.ORDER_ENTRY && source !== 'woocommerce') {
      return {
        station,
        status: StationStatus.COMPLETED,
        startedAt: entryTimestamp,
        completedAt: entryTimestamp,
      };
    }

    return {
      station,
      status: StationStatus.NOT_STARTED,
    };
  });
}
