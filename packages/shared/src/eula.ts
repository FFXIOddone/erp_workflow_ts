export const EULA_VERSION = '2026-04-07-legal';

export const EULA_TITLE = 'Wilde Signs ERP End User License Agreement';

export const EULA_SUMMARY =
  'By using the ERP in production, you agree to use it only for authorized Wilde Signs business operations, keep access credentials private, follow the applicable third-party service terms, and accept that the system is provided for internal operational use.';

export const EULA_POINTS = [
  'This application is for authorized internal business use only.',
  'Do not share your account, password, token, or workstation access with anyone else.',
  'Operational data, shipment status, and integrations are provided as-is for workflow support.',
  'You are responsible for verifying orders, shipments, and production actions before acting on them.',
  'Third-party service terms apply when you use FedEx, Intuit/QuickBooks, Microsoft, or WooCommerce-connected features.',
  'No resale, sublicensing, or external commercialization is permitted unless a separate written agreement says otherwise.',
  'Acceptance is recorded per user and is required before production use of the ERP.',
];

export type EulaSection = {
  title: string;
  body: string;
  bullets: string[];
};

export type ThirdPartyTermsNotice = {
  provider: string;
  product: string;
  sourceUrl: string;
  workspaceDoc: string;
  summary: string;
  bullets: string[];
};

export const EULA_STANDARD_SECTIONS: EulaSection[] = [
  {
    title: 'Permitted use',
    body: 'The ERP is licensed for internal Wilde Signs business operations only. Production, scheduling, shipping, and integration features may be used only by authorized users acting within their assigned role.',
    bullets: [
      'No personal, consumer, or outside-business use.',
      'Use only the station, order, and shipment functions you are authorized to access.',
      'Do not share or lend your account or workstation session to anyone else.',
    ],
  },
  {
    title: 'Account and access security',
    body: 'Each user is responsible for keeping credentials, API tokens, workstation access, and login sessions private and current.',
    bullets: [
      'Keep usernames, passwords, tokens, and machine access secret.',
      'Use the ERP only on approved devices and approved network paths.',
      'Report suspected compromise, misuse, or unauthorized access immediately.',
    ],
  },
  {
    title: 'Data and operational reliance',
    body: 'Operational records are provided to support workflow decisions, but the ERP does not replace human review. You remain responsible for confirming the order, shipment, proof, print, or installation action before you act on it.',
    bullets: [
      'Treat order details, status updates, and shipment tracking as operational aids.',
      'Verify critical production and shipping actions before completion.',
      'If a source system is stale or incomplete, stop and confirm before proceeding.',
    ],
  },
  {
    title: 'Third-party services',
    body: 'When the ERP connects to FedEx, Intuit/QuickBooks, Microsoft, WooCommerce, or any other external service, the applicable provider terms and policies also apply. Those terms can change independently of this agreement.',
    bullets: [
      'Only use connected services in a way that is allowed by the provider terms.',
      'Keep external API credentials and refresh tokens secret.',
      'If a provider suspends or changes access, the ERP must follow that provider decision.',
    ],
  },
  {
    title: 'Ownership and commercialization',
    body: 'This agreement grants a limited right to use the ERP internally. It does not grant any right to resell, sublicense, publish, or commercially exploit the software outside the written permissions that the company or rights holder separately provides.',
    bullets: [
      'No external commercialization without a separate written agreement.',
      'No attempt to strip or suppress copyright, trademark, or confidentiality notices.',
      'If a different ownership or resale model is desired, it must be documented separately.',
    ],
  },
  {
    title: 'Warranty, liability, and termination',
    body: 'The ERP and all integrations are provided as-is for workflow support. Access may be limited, suspended, or terminated if the agreement is violated or if a provider requires it.',
    bullets: [
      'No guarantee of uninterrupted availability or perfect data accuracy.',
      'Follow any provider, security, or compliance requirement that applies to the connected service.',
      'Acceptance is recorded per user and may be re-required when the agreement version changes.',
    ],
  },
];

export const EULA_THIRD_PARTY_NOTICES: ThirdPartyTermsNotice[] = [
  {
    provider: 'FedEx',
    product: 'FedEx Developer APIs',
    sourceUrl: 'https://developer.fedex.com/api/legal/en-us/eula.pdf',
    workspaceDoc: 'docs/legal/provider-terms/fedex.md',
    summary:
      'FedEx requires acceptance of its EULA and authority to bind the employer before integrating APIs.',
    bullets: [
      'FedEx says the signer must be a lawful employee who can bind the employer.',
      'FedEx access may require additional registration steps.',
      'FedEx API use is subject to the current FedEx EULA and related API terms.',
    ],
  },
  {
    provider: 'Intuit',
    product: 'Intuit Developer Platform / QuickBooks',
    sourceUrl:
      'https://developer.intuit.com/app/developer/qbo/docs/legal-agreements/intuit-terms-of-service-for-intuit-developer-services',
    workspaceDoc: 'docs/legal/provider-terms/intuit.md',
    summary:
      'Intuit requires a binding developer agreement, secure credentials, and compliance with its developer policies.',
    bullets: [
      'The developer acts on behalf of the company or client they represent.',
      'Credentials and developer account access must remain secure and confidential.',
      'Intuit can suspend access if the platform is used outside the allowed terms.',
    ],
  },
  {
    provider: 'Microsoft',
    product: 'Microsoft APIs / Microsoft Graph',
    sourceUrl: 'https://learn.microsoft.com/en-us/legal/microsoft-apis/terms-of-use',
    workspaceDoc: 'docs/legal/provider-terms/microsoft.md',
    summary:
      'Microsoft requires registered applications, secret credentials, and use limited to the minimum data needed for the scenario.',
    bullets: [
      "Access credentials must be kept secret and are the developer's responsibility.",
      'Microsoft grants a limited, revocable license subject to the API terms.',
      'Scraping, data copying, and bypassing limits are not allowed except as expressly permitted.',
    ],
  },
  {
    provider: 'WooCommerce / WordPress.com',
    product: 'WordPress.com and WooCommerce.com services',
    sourceUrl: 'https://wordpress.com/tos/',
    workspaceDoc: 'docs/legal/provider-terms/woocommerce.md',
    summary:
      'Automattic terms govern Woo-related services, account security, changes, and any separate service-specific terms.',
    bullets: [
      'Woo-related products are intended for commercial use and business representatives.',
      'Additional or separate terms may apply to specific services or third-party integrations.',
      'Accounts should stay accurate and current, and access should remain secure.',
    ],
  },
];

export const EULA_OWNERSHIP_NOTE = [
  'Under U.S. copyright law, a work prepared by an employee within the scope of employment is generally a work made for hire, and the employer is the author.',
  'If a different ownership, commercialization, or resale arrangement is wanted, it should be documented in a separate written agreement signed by the relevant parties.',
  'This EULA governs user access to the ERP. It is not a substitute for a dedicated employment, assignment, or IP ownership agreement.',
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
