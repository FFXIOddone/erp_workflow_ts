export const EULA_VERSION = '2026-04-07';

export const EULA_TITLE = 'Wilde Signs ERP End User License Agreement';

export const EULA_SUMMARY =
  'By using the ERP in production, you agree to use it only for authorized Wilde Signs business operations, keep access credentials private, and accept that the system is provided for internal operational use.';

export const EULA_POINTS = [
  'This application is for authorized internal business use only.',
  'Do not share your account, password, token, or workstation access with anyone else.',
  'Operational data, shipment status, and integrations are provided as-is for workflow support.',
  'You are responsible for verifying orders, shipments, and production actions before acting on them.',
  'Acceptance is recorded per user and is required before production use of the ERP.',
];

type EulaAcceptance = {
  eulaAcceptedAt?: Date | string | null;
  eulaAcceptedVersion?: string | null;
};

export function hasAcceptedEula(user: EulaAcceptance | null | undefined): boolean {
  if (!user?.eulaAcceptedAt) {
    return false;
  }

  return user.eulaAcceptedVersion === EULA_VERSION;
}
