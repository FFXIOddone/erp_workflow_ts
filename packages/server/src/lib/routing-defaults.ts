/**
 * Routing defaults logic for work orders.
 *
 * Rules:
 * 1. If any PRINTING station exists (ROLL_TO_ROLL, FLATBED, SCREEN_PRINT) →
 *    auto-add PRODUCTION and SHIPPING_RECEIVING + their sub-stations
 * 2. If description contains "(INSTALL)" → auto-add INSTALLATION
 * 3. If description contains "(OUTSOURCED)" → auto-add ORDER_ENTRY
 * 4. If needsProof is true → auto-add DESIGN
 *
 * The user can always remove stations later — it's easier to remove from a
 * few orders than to add routes to every single one.
 */
import { PrintingMethod } from '@erp/shared';

const PRINTING_STATIONS = new Set<PrintingMethod>([
  PrintingMethod.ROLL_TO_ROLL,
  PrintingMethod.FLATBED,
  PrintingMethod.SCREEN_PRINT,
]);

/**
 * Preferred station ordering for consistent routing display.
 * ORDER_ENTRY → DESIGN → printing stations → sub-stations → PRODUCTION → INSTALLATION → SHIPPING_RECEIVING
 */
const STATION_ORDER: PrintingMethod[] = [
  PrintingMethod.ORDER_ENTRY,
  PrintingMethod.SALES,
  PrintingMethod.DESIGN,
  PrintingMethod.FLATBED,
  PrintingMethod.FLATBED_PRINTING,
  PrintingMethod.ROLL_TO_ROLL,
  PrintingMethod.ROLL_TO_ROLL_PRINTING,
  PrintingMethod.SCREEN_PRINT,
  PrintingMethod.PRODUCTION,
  PrintingMethod.PRODUCTION_ZUND,
  PrintingMethod.PRODUCTION_FINISHING,
  PrintingMethod.INSTALLATION,
  PrintingMethod.SHIPPING_RECEIVING,
  PrintingMethod.SHIPPING_QC,
  PrintingMethod.SHIPPING_PACKAGING,
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
  },
): PrintingMethod[] {
  const routingSet = new Set(routing);
  const description = options?.description ?? '';
  const descUpper = description.toUpperCase();

  // Rule 1: Any printing station → add PRODUCTION + SHIPPING_RECEIVING + sub-stations
  const hasPrinting = routing.some(s => PRINTING_STATIONS.has(s));
  if (hasPrinting) {
    routingSet.add(PrintingMethod.PRODUCTION);
    routingSet.add(PrintingMethod.PRODUCTION_ZUND);
    routingSet.add(PrintingMethod.PRODUCTION_FINISHING);
    routingSet.add(PrintingMethod.SHIPPING_RECEIVING);
    routingSet.add(PrintingMethod.SHIPPING_QC);
    routingSet.add(PrintingMethod.SHIPPING_PACKAGING);

    // Add printing sub-station that matches the parent
    if (routingSet.has(PrintingMethod.FLATBED)) {
      routingSet.add(PrintingMethod.FLATBED_PRINTING);
    }
    if (routingSet.has(PrintingMethod.ROLL_TO_ROLL)) {
      routingSet.add(PrintingMethod.ROLL_TO_ROLL_PRINTING);
    }
  }

  // Rule 2: Description contains "(INSTALL)" → add INSTALLATION
  if (descUpper.includes('(INSTALL)')) {
    routingSet.add(PrintingMethod.INSTALLATION);
  }

  // Rule 3: Description contains "(OUTSOURCED)" → add ORDER_ENTRY
  if (descUpper.includes('(OUTSOURCED)')) {
    routingSet.add(PrintingMethod.ORDER_ENTRY);
  }

  // Rule 4: Needs proof → add DESIGN
  if (options?.needsProof) {
    routingSet.add(PrintingMethod.DESIGN);
  }

  // Sort into standard station order
  return STATION_ORDER.filter(s => routingSet.has(s));
}
