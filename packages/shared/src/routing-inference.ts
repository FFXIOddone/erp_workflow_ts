import { PrintingMethod } from './enums.js';

export interface OrderRoutingInferenceInput {
  description?: string | null;
  notes?: string | null;
  routing?: readonly (PrintingMethod | string)[] | null;
}

const CATEGORY_TAG_PATTERN = /\s*\((OUTSOURCED|DESIGN ONLY|INSTALL|INV|COM)\)/gi;
const DESIGN_ONLY_PATTERN = /\(\s*DESIGN ONLY\s*\)|\bDESIGN\s+ONLY\b/i;

const ROUTING_TAG_MAP: Record<string, PrintingMethod[]> = {
  OE: [PrintingMethod.ORDER_ENTRY],
  'ORDER ENTRY': [PrintingMethod.ORDER_ENTRY],
  ENTRY: [PrintingMethod.ORDER_ENTRY],
  FB: [PrintingMethod.FLATBED, PrintingMethod.FLATBED_PRINTING],
  MM: [PrintingMethod.ROLL_TO_ROLL, PrintingMethod.ROLL_TO_ROLL_PRINTING],
  RR: [PrintingMethod.ROLL_TO_ROLL, PrintingMethod.ROLL_TO_ROLL_PRINTING],
  SP: [PrintingMethod.SCREEN_PRINT, PrintingMethod.SCREEN_PRINT_PRINTING, PrintingMethod.SCREEN_PRINT_ASSEMBLY],
  PROD: [PrintingMethod.PRODUCTION, PrintingMethod.PRODUCTION_ZUND, PrintingMethod.PRODUCTION_FINISHING],
  PRODUCTION: [PrintingMethod.PRODUCTION, PrintingMethod.PRODUCTION_ZUND, PrintingMethod.PRODUCTION_FINISHING],
  Z: [PrintingMethod.PRODUCTION, PrintingMethod.PRODUCTION_ZUND, PrintingMethod.PRODUCTION_FINISHING],
  ZUND: [PrintingMethod.PRODUCTION, PrintingMethod.PRODUCTION_ZUND, PrintingMethod.PRODUCTION_FINISHING],
  INSTALL: [PrintingMethod.INSTALLATION, PrintingMethod.INSTALLATION_REMOTE, PrintingMethod.INSTALLATION_INHOUSE],
  INSTALLATION: [PrintingMethod.INSTALLATION, PrintingMethod.INSTALLATION_REMOTE, PrintingMethod.INSTALLATION_INHOUSE],
  'DESIGN ONLY': [PrintingMethod.DESIGN_ONLY],
  DESIGN: [PrintingMethod.DESIGN],
  PROOF: [PrintingMethod.DESIGN, PrintingMethod.DESIGN_PROOF],
  APPROVAL: [PrintingMethod.DESIGN, PrintingMethod.DESIGN_PROOF, PrintingMethod.DESIGN_APPROVAL],
  'PRINT READY': [
    PrintingMethod.DESIGN,
    PrintingMethod.DESIGN_PROOF,
    PrintingMethod.DESIGN_APPROVAL,
    PrintingMethod.DESIGN_PRINT_READY,
  ],
  SHIP: [
    PrintingMethod.SHIPPING_RECEIVING,
    PrintingMethod.SHIPPING_QC,
    PrintingMethod.SHIPPING_PACKAGING,
    PrintingMethod.SHIPPING_SHIPMENT,
  ],
  SHIPPING: [
    PrintingMethod.SHIPPING_RECEIVING,
    PrintingMethod.SHIPPING_QC,
    PrintingMethod.SHIPPING_PACKAGING,
    PrintingMethod.SHIPPING_SHIPMENT,
  ],
  QC: [PrintingMethod.SHIPPING_RECEIVING, PrintingMethod.SHIPPING_QC],
  PACKAGING: [PrintingMethod.SHIPPING_RECEIVING, PrintingMethod.SHIPPING_QC, PrintingMethod.SHIPPING_PACKAGING],
  SHIPMENT: [
    PrintingMethod.SHIPPING_RECEIVING,
    PrintingMethod.SHIPPING_QC,
    PrintingMethod.SHIPPING_PACKAGING,
    PrintingMethod.SHIPPING_SHIPMENT,
  ],
  OUTSOURCED: [PrintingMethod.ORDER_ENTRY],
};

const DESCRIPTION_ROUTING_PATTERNS: Array<{ pattern: RegExp; stations: PrintingMethod[] }> = [
  { pattern: /\bdesign\s*only\b/i, stations: [PrintingMethod.DESIGN_ONLY] },
  { pattern: /\bproof(?:s|ing)?\b/i, stations: [PrintingMethod.DESIGN, PrintingMethod.DESIGN_PROOF] },
  { pattern: /\bapproval\b/i, stations: [PrintingMethod.DESIGN, PrintingMethod.DESIGN_PROOF, PrintingMethod.DESIGN_APPROVAL] },
  {
    pattern: /\bprint\s*ready\b/i,
    stations: [
      PrintingMethod.DESIGN,
      PrintingMethod.DESIGN_PROOF,
      PrintingMethod.DESIGN_APPROVAL,
      PrintingMethod.DESIGN_PRINT_READY,
    ],
  },
  { pattern: /banner/i, stations: [PrintingMethod.ROLL_TO_ROLL, PrintingMethod.ROLL_TO_ROLL_PRINTING] },
  { pattern: /vinyl|decal|wrap|window\s*(graphic|perf)/i, stations: [PrintingMethod.ROLL_TO_ROLL, PrintingMethod.ROLL_TO_ROLL_PRINTING] },
  { pattern: /\bmimaki\b/i, stations: [PrintingMethod.ROLL_TO_ROLL, PrintingMethod.ROLL_TO_ROLL_PRINTING] },
  {
    pattern: /\b(signs?|boards?|panels?|coroplast|aluminum|dibond|pvc|acrylic)\b/i,
    stations: [PrintingMethod.FLATBED, PrintingMethod.FLATBED_PRINTING],
  },
  { pattern: /poster|insert/i, stations: [PrintingMethod.FLATBED, PrintingMethod.FLATBED_PRINTING] },
  {
    pattern: /screen\s*print/i,
    stations: [PrintingMethod.SCREEN_PRINT, PrintingMethod.SCREEN_PRINT_PRINTING, PrintingMethod.SCREEN_PRINT_ASSEMBLY],
  },
  {
    pattern: /\bzund\b/i,
    stations: [PrintingMethod.PRODUCTION, PrintingMethod.PRODUCTION_ZUND, PrintingMethod.PRODUCTION_FINISHING],
  },
  {
    pattern: /\bproduction\b|\bfinishing\b|\bcut\b/i,
    stations: [PrintingMethod.PRODUCTION, PrintingMethod.PRODUCTION_ZUND, PrintingMethod.PRODUCTION_FINISHING],
  },
  {
    pattern: /ship(?:ping|ment)?|packaging|package|\bqc\b|install\s*ready/i,
    stations: [
      PrintingMethod.SHIPPING_RECEIVING,
      PrintingMethod.SHIPPING_QC,
      PrintingMethod.SHIPPING_PACKAGING,
      PrintingMethod.SHIPPING_SHIPMENT,
      PrintingMethod.SHIPPING_INSTALL_READY,
    ],
  },
  {
    pattern: /install(?:ation)?|onsite|on-site|in-house/i,
    stations: [PrintingMethod.INSTALLATION, PrintingMethod.INSTALLATION_REMOTE, PrintingMethod.INSTALLATION_INHOUSE],
  },
];

const INFERRED_STATION_ORDER: PrintingMethod[] = [
  PrintingMethod.ORDER_ENTRY,
  PrintingMethod.DESIGN_ONLY,
  PrintingMethod.DESIGN,
  PrintingMethod.DESIGN_PROOF,
  PrintingMethod.DESIGN_APPROVAL,
  PrintingMethod.DESIGN_PRINT_READY,
  PrintingMethod.ROLL_TO_ROLL,
  PrintingMethod.ROLL_TO_ROLL_PRINTING,
  PrintingMethod.FLATBED,
  PrintingMethod.FLATBED_PRINTING,
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
];

function normalizeToken(token: string): string {
  return token.trim().replace(/\s+/g, ' ').toUpperCase();
}

function extractParentheticalTokens(text: string): string[] {
  const tokens = new Set<string>();

  for (const match of text.matchAll(/\(([^)]+)\)/g)) {
    const content = normalizeToken(match[1] ?? '');
    if (!content) continue;

    if (content === 'DESIGN ONLY') {
      tokens.add('DESIGN ONLY');
      continue;
    }

    for (const part of content.split(/[\/,+;&]+/)) {
      const token = normalizeToken(part);
      if (!token) continue;
      tokens.add(token);
    }
  }

  return Array.from(tokens);
}

export function stripOrderCategoryTags(description: string): string {
  return description.replace(CATEGORY_TAG_PATTERN, '').replace(/\s{2,}/g, ' ').trim();
}

export function isDesignOnlyOrder(input: Pick<OrderRoutingInferenceInput, 'description' | 'routing'>): boolean {
  const description = input.description ?? '';
  if (DESIGN_ONLY_PATTERN.test(description)) {
    return true;
  }

  const routing = (input.routing ?? []).map((station) => String(station).toUpperCase());
  const nonOrderEntry = routing.filter((station) => station !== PrintingMethod.ORDER_ENTRY);
  return (
    nonOrderEntry.length > 0 &&
    nonOrderEntry.every((station) => station === PrintingMethod.DESIGN || station === PrintingMethod.DESIGN_ONLY)
  );
}

export function inferRoutingFromOrderDetails(input: OrderRoutingInferenceInput): PrintingMethod[] {
  if (isDesignOnlyOrder(input)) {
    return [PrintingMethod.DESIGN_ONLY];
  }

  const text = `${input.description ?? ''} ${input.notes ?? ''}`.trim();
  if (!text) {
    return [];
  }

  const guessed = new Set<PrintingMethod>();
  const tokens = extractParentheticalTokens(text);

  if (tokens.includes('OUTSOURCED')) {
    return [PrintingMethod.ORDER_ENTRY];
  }

  for (const token of tokens) {
    if (token === 'DESIGN ONLY') {
      return [PrintingMethod.DESIGN_ONLY];
    }
    ROUTING_TAG_MAP[token]?.forEach((station) => guessed.add(station));
  }

  for (const { pattern, stations } of DESCRIPTION_ROUTING_PATTERNS) {
    if (pattern.test(text)) {
      stations.forEach((station) => guessed.add(station));
    }
  }

  return INFERRED_STATION_ORDER.filter((station) => guessed.has(station));
}
