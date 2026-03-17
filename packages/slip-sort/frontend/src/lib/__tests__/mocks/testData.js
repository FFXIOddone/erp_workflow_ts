/**
 * Mock API handlers and test data
 */

// Sample test data matching backend schemas
export const mockBrands = [
  {
    id: 1,
    name: 'Kwik Fill',
    code: 'KF',
    description: 'Default brand configuration',
    created_at: '2026-01-01T00:00:00Z',
    pattern_count: 3,
    store_count: 150,
    order_count: 500,
  },
  {
    id: 2,
    name: 'Test Brand',
    code: 'TB',
    description: 'Test brand for development',
    created_at: '2026-01-15T00:00:00Z',
    pattern_count: 0,
    store_count: 0,
    order_count: 0,
  },
];

export const mockBatches = [
  {
    batch_id: 'batch-001',
    source_filename: 'packing_slips_jan.pdf',
    started_at: '2026-01-20T10:30:00Z',
    completed_at: '2026-01-20T10:32:00Z',
    status: 'completed',
    total_stores: 45,
    total_items: 120,
    total_pages: 90,
    box_counts: {
      '28x2x44': 5,
      '8x8x36': 15,
      STANDARD: 20,
      'Padded Envelope': 5,
    },
  },
  {
    batch_id: 'batch-002',
    source_filename: 'packing_slips_jan2.pdf',
    started_at: '2026-01-21T14:00:00Z',
    completed_at: null,
    status: 'processing',
    total_stores: 30,
    total_items: 0,
    total_pages: 60,
    box_counts: {},
  },
];

export const mockOrders = [
  {
    id: 1,
    store_code: 'A1234',
    store_name: 'Test Store NY',
    kit_type: 'both',
    alcohol_type: 'alcohol',
    box_category: '28x2x44',
    item_count: 5,
    processed_at: '2026-01-20T10:31:00Z',
    source_pdf: 'packing_slips_jan.pdf',
  },
  {
    id: 2,
    store_code: 'B5678',
    store_name: 'Test Store PA',
    kit_type: 'counter',
    alcohol_type: 'non_alcohol',
    box_category: '8x8x36',
    item_count: 3,
    processed_at: '2026-01-20T10:31:30Z',
    source_pdf: 'packing_slips_jan.pdf',
  },
];

export const mockSortConfig = {
  id: 1,
  brand_id: 1,
  name: 'Default Sort',
  is_default: true,
  tiers: [
    {
      name: 'Kit Type',
      field: 'kit_type',
      enabled: true,
      categories: [
        { id: 'both', label: 'Counter + Shipper', order: 0 },
        { id: 'both_limited', label: 'Counter + Shipper (Limited)', order: 1 },
        { id: 'counter', label: 'Counter Only', order: 2 },
        { id: 'counter_limited', label: 'Counter Only (Limited)', order: 3 },
        { id: 'shipper', label: 'Shipper Only', order: 4 },
        { id: 'shipper_limited', label: 'Shipper Only (Limited)', order: 5 },
        { id: 'neither', label: 'Neither', order: 6 },
      ],
    },
    {
      name: 'Alcohol Type',
      field: 'alcohol_type',
      enabled: true,
      categories: [
        { id: 'alcohol', label: 'Alcohol', order: 0 },
        { id: 'non_alcohol', label: 'Non-Alcohol', order: 1 },
        { id: 'none', label: 'None', order: 2 },
      ],
    },
    {
      name: 'Location',
      field: 'location',
      enabled: true,
      categories: [
        { id: 'NY', label: 'New York', order: 0 },
        { id: 'PA', label: 'Pennsylvania', order: 1 },
        { id: 'OH', label: 'Ohio', order: 2 },
        { id: 'other', label: 'Other', order: 3 },
      ],
    },
  ],
};

export const mockBlackoutRules = [
  {
    id: 1,
    brand_id: 1,
    rule_type: 'hide',
    name: 'Hide Test Items',
    sign_type: 'Test Sign',
    sign_version: null,
    condition_logic: { match: 'contains', value: 'test' },
    is_enabled: true,
  },
];

export const mockUploadedPdf = {
  file_id: 'upload-123',
  filename: 'test_packing_slips.pdf',
  page_count: 45,
};

export const mockProcessResult = {
  batch_id: 'batch-003',
  stores_found: 25,
  items_extracted: 75,
  errors: [],
};

/**
 * Create a mock fetch response
 * @param {any} data - Response data
 * @param {number} [status] - HTTP status code
 */
export function createMockResponse(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  };
}

/**
 * Setup fetch mock for a specific endpoint
 * @param {string} urlPattern - URL pattern to match
 * @param {any} responseData - Response data
 * @param {number} [status] - HTTP status code
 */
export function mockFetchEndpoint(urlPattern, responseData, status = 200) {
  // @ts-ignore - Mock implementation for tests
  global.fetch.mockImplementation((/** @type {string} */ url, /** @type {any} */ _options) => {
    if (url.includes(urlPattern)) {
      return Promise.resolve(createMockResponse(responseData, status));
    }
    return Promise.reject(new Error(`Unhandled fetch: ${url}`));
  });
}

/**
 * Setup multiple fetch mocks
 * @param {Record<string, {data: any, status?: number}>} endpoints - Endpoint configurations
 */
export function mockFetchEndpoints(endpoints) {
  // @ts-ignore - Mock implementation for tests
  global.fetch.mockImplementation((/** @type {string} */ url, /** @type {any} */ _options) => {
    for (const [pattern, { data, status = 200 }] of Object.entries(endpoints)) {
      if (url.includes(pattern)) {
        return Promise.resolve(createMockResponse(data, status));
      }
    }
    return Promise.reject(new Error(`Unhandled fetch: ${url}`));
  });
}
