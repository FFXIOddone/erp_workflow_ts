import { PrintingMethod } from './enums.js';

export interface OrderRoutingInferenceInput {
  description?: string | null;
  notes?: string | null;
  routing?: readonly (PrintingMethod | string)[] | null;
}

const CATEGORY_TAG_PATTERN = /\s*\((OUTSOURCED|DESIGN ONLY|INSTALL|INV|COM)\)/gi;
const DESIGN_ONLY_PATTERN = /\(\s*DESIGN ONLY\s*\)|\bDESIGN\s+ONLY\b/i;

const ROUTING_TAG_MAP: Record<string, PrintingMethod[]> = {
  FB: [PrintingMethod.FLATBED],
  MM: [PrintingMethod.ROLL_TO_ROLL],
  RR: [PrintingMethod.ROLL_TO_ROLL],
  SP: [PrintingMethod.SCREEN_PRINT],
  Z: [PrintingMethod.PRODUCTION],
  ZUND: [PrintingMethod.PRODUCTION],
  INSTALL: [PrintingMethod.INSTALLATION],
  OUTSOURCED: [PrintingMethod.ORDER_ENTRY],
};

const DESCRIPTION_ROUTING_PATTERNS: Array<{ pattern: RegExp; stations: PrintingMethod[] }> = [
  { pattern: /banner/i, stations: [PrintingMethod.ROLL_TO_ROLL] },
  { pattern: /vinyl|decal|wrap|window\s*(graphic|perf)/i, stations: [PrintingMethod.ROLL_TO_ROLL] },
  { pattern: /\bmimaki\b/i, stations: [PrintingMethod.ROLL_TO_ROLL] },
  { pattern: /\b(signs?|boards?|panels?|coroplast|aluminum|dibond|pvc|acrylic)\b/i, stations: [PrintingMethod.FLATBED] },
  { pattern: /poster|insert/i, stations: [PrintingMethod.FLATBED] },
  { pattern: /screen\s*print/i, stations: [PrintingMethod.SCREEN_PRINT] },
  { pattern: /\bzund\b/i, stations: [PrintingMethod.PRODUCTION] },
  { pattern: /install/i, stations: [PrintingMethod.INSTALLATION] },
];

const INFERRED_STATION_ORDER: PrintingMethod[] = [
  PrintingMethod.DESIGN,
  PrintingMethod.ORDER_ENTRY,
  PrintingMethod.ROLL_TO_ROLL,
  PrintingMethod.FLATBED,
  PrintingMethod.SCREEN_PRINT,
  PrintingMethod.PRODUCTION,
  PrintingMethod.INSTALLATION,
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
  return routing.length > 0 && routing.every((station) => station === PrintingMethod.DESIGN);
}

export function inferRoutingFromOrderDetails(input: OrderRoutingInferenceInput): PrintingMethod[] {
  if (isDesignOnlyOrder(input)) {
    return [PrintingMethod.DESIGN];
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
      return [PrintingMethod.DESIGN];
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
