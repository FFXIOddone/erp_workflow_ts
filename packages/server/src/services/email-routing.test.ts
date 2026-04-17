import { describe, expect, it } from 'vitest';
import { normalizeEmailRecipientList, resolveEmailDeliveryTarget } from './email-routing.js';

describe('email routing', () => {
  it('normalizes recipient arrays into a comma-separated list', () => {
    expect(normalizeEmailRecipientList(['one@example.com', 'two@example.com'])).toBe(
      'one@example.com, two@example.com',
    );
  });

  it('routes all non-production email to the approvals inbox', () => {
    const result = resolveEmailDeliveryTarget('customer@example.com', {
      NODE_ENV: 'development',
      EMAIL_DEV_OVERRIDE_TO: 'approvals@wilde-signs.com',
    });

    expect(result.devMode).toBe(true);
    expect(result.overridden).toBe(true);
    expect(result.originalTo).toBe('customer@example.com');
    expect(result.effectiveTo).toBe('approvals@wilde-signs.com');
    expect(result.overrideTo).toBe('approvals@wilde-signs.com');
  });

  it('leaves recipients unchanged in production', () => {
    const result = resolveEmailDeliveryTarget('customer@example.com', {
      NODE_ENV: 'production',
      EMAIL_DEV_OVERRIDE_TO: 'approvals@wilde-signs.com',
    });

    expect(result.devMode).toBe(false);
    expect(result.overridden).toBe(false);
    expect(result.effectiveTo).toBe('customer@example.com');
  });

  it('supports overriding multiple recipients as a single dev mailbox', () => {
    const result = resolveEmailDeliveryTarget(['ops@example.com', 'sales@example.com'], {
      NODE_ENV: 'development',
      EMAIL_DEV_OVERRIDE_TO: 'approvals@wilde-signs.com',
    });

    expect(result.originalTo).toBe('ops@example.com, sales@example.com');
    expect(result.effectiveTo).toBe('approvals@wilde-signs.com');
    expect(result.overridden).toBe(true);
  });
});
