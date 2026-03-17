/**
 * Test setup file for Vitest + Svelte Testing Library
 * @file
 */

import '@testing-library/jest-dom';

// Helper to flush all pending promises
// @ts-ignore - Adding custom global helper for tests
global.flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

// Mock fetch globally - individual tests will override this
// @ts-ignore - Mock implementation for tests
global.fetch = vi.fn(() => Promise.resolve({
  ok: true,
  status: 200,
  json: () => Promise.resolve({}),
  text: () => Promise.resolve('{}'),
}));

// Clean up after each test - reset call history but keep implementations
afterEach(() => {
  // @ts-ignore - Accessing mock properties
  if (global.fetch && typeof global.fetch.mockClear === 'function') {
    // @ts-ignore
    global.fetch.mockClear();
  }
});

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  /** @param {number} _index */
  key: (_index) => null,
};
// @ts-ignore - Mock implementation
global.localStorage = localStorageMock;

// Mock window.open for download tests
global.open = vi.fn();

// Console error/warn spy for checking error handling
vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
