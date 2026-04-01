/**
 * Routing defaults logic for work orders.
 *
 * Rules:
 * 1. If any PRINTING station exists (ROLL_TO_ROLL, FLATBED, SCREEN_PRINT) ->
 *    auto-add PRODUCTION and SHIPPING_RECEIVING + their sub-stations
 * 2. If description contains "(INSTALL)" -> auto-add INSTALLATION
 * 3. If description contains "(OUTSOURCED)" -> auto-add ORDER_ENTRY
 * 4. If needsProof is true -> auto-add DESIGN
 *
 * The user can always remove stations later - it's easier to remove from a
 * few orders than to add routes to every single one.
 */
import { PrintingMethod, inferRoutingFromOrderDetails, isDesignOnlyOrder } from '@erp/shared';

const PRINTING_STATIONS = new Set<PrintingMethod>([
  PrintingMethod.ROLL_TO_ROLL,
  PrintingMethod.FLATBED,
  PrintingMethod.SCREEN_PRINT,
]);

/**
 * Preferred station ordering for consistent routing display.
 * Mirrors the full workflow from Sales → Complete.
 */
const STATION_ORDER: PrintingMethod[] = [
  PrintingMethod.SALES,
  PrintingMethod.DESIGN_ONLY,
  PrintingMethod.ORDER_ENTRY,
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
  options?: {
    description?: string;
    needsProof?: boolean;
  }
): PrintingMethod[] {
  const routingSet = new Set(routing);
  const description = options?.description ?? '';
  const descUpper = description.toUpperCase();

  if (isDesignOnlyOrder({ description, routing })) {
    return [PrintingMethod.DESIGN];
  }

  const hasPrinting = routing.some((station) => PRINTING_STATIONS.has(station));
  if (hasPrinting) {
    routingSet.add(PrintingMethod.PRODUCTION);
    routingSet.add(PrintingMethod.PRODUCTION_ZUND);
    routingSet.add(PrintingMethod.PRODUCTION_FINISHING);
    routingSet.add(PrintingMethod.SHIPPING_RECEIVING);
    routingSet.add(PrintingMethod.SHIPPING_QC);
    routingSet.add(PrintingMethod.SHIPPING_PACKAGING);

    if (routingSet.has(PrintingMethod.FLATBED)) {
      routingSet.add(PrintingMethod.FLATBED_PRINTING);
    }
    if (routingSet.has(PrintingMethod.ROLL_TO_ROLL)) {
      routingSet.add(PrintingMethod.ROLL_TO_ROLL_PRINTING);
    }
  }

  if (descUpper.includes('(INSTALL)')) {
    routingSet.add(PrintingMethod.INSTALLATION);
  }

  if (descUpper.includes('(OUTSOURCED)')) {
    routingSet.add(PrintingMethod.ORDER_ENTRY);
  }

  if (options?.needsProof) {
    routingSet.add(PrintingMethod.DESIGN);
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
}): PrintingMethod[] {
  const description = options.description ?? '';
  const sectionUpper = (options.section ?? '').toUpperCase();
  const routingSet = new Set<PrintingMethod>(options.routing ?? []);
  const designOnly =
    isDesignOnlyOrder({ description, routing: options.routing ?? [] }) ||
    sectionUpper.includes('DESIGN ONLY');

  if (designOnly) {
    return [PrintingMethod.DESIGN];
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
  });
}
