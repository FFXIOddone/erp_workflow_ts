import { describe, expect, it } from 'vitest';
import { normalizeActivityUserId } from './activity-logger.js';

describe('normalizeActivityUserId', () => {
  it('keeps valid UUID user ids', () => {
    expect(normalizeActivityUserId('550e8400-e29b-41d4-a716-446655440000')).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('drops synthetic system ids', () => {
    expect(normalizeActivityUserId('system')).toBeUndefined();
    expect(normalizeActivityUserId(' SYSTEM ')).toBeUndefined();
  });

  it('drops non-uuid ids', () => {
    expect(normalizeActivityUserId('alice')).toBeUndefined();
    expect(normalizeActivityUserId('123')).toBeUndefined();
  });
});
