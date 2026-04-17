const DEFAULT_DEV_EMAIL_OVERRIDE = 'approvals@wilde-signs.com';

export interface EmailDeliveryTarget {
  originalTo: string;
  effectiveTo: string;
  overrideTo: string;
  devMode: boolean;
  overridden: boolean;
}

type EmailOverrideEnv = Record<string, string | undefined>;

export function normalizeEmailRecipientList(to: string | string[]): string {
  return Array.isArray(to) ? to.join(', ') : to;
}

function normalizeOverrideAddress(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function resolveEmailDeliveryTarget(
  to: string | string[],
  env: EmailOverrideEnv = process.env,
): EmailDeliveryTarget {
  const originalTo = normalizeEmailRecipientList(to);
  const devMode = (env.NODE_ENV ?? 'development') !== 'production';
  const overrideTo = normalizeOverrideAddress(env.EMAIL_DEV_OVERRIDE_TO) ?? DEFAULT_DEV_EMAIL_OVERRIDE;
  const effectiveTo = devMode ? overrideTo : originalTo;

  return {
    originalTo,
    effectiveTo,
    overrideTo,
    devMode,
    overridden: devMode && originalTo.trim().toLowerCase() !== overrideTo.toLowerCase(),
  };
}
