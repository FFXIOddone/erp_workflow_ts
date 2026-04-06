function parseUrlLike(value: string): URL | null {
  if (!value) return null;

  try {
    if (value.includes('://')) {
      return new URL(value);
    }

    return new URL(`http://${value}`);
  } catch {
    return null;
  }
}

export function getHostnameFromOrigin(value: string): string {
  return parseUrlLike(value)?.hostname.toLowerCase() ?? '';
}

function isLoopbackHostname(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '::1' ||
    hostname === '[::1]' ||
    hostname.endsWith('.localhost')
  );
}

function isPrivateIpv4Hostname(hostname: string): boolean {
  const parts = hostname.split('.').map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return false;
  }

  const [first, second] = parts;
  return (
    first === 10 ||
    first === 127 ||
    (first === 192 && second === 168) ||
    (first === 172 && second >= 16 && second <= 31)
  );
}

function isBareLanHostname(hostname: string): boolean {
  if (!hostname) return false;
  if (hostname.endsWith('.local')) return true;
  return /^[a-z0-9-]+$/i.test(hostname);
}

export function isAllowedLanOrigin(origin: string): boolean {
  const hostname = getHostnameFromOrigin(origin);
  return (
    isLoopbackHostname(hostname) ||
    isPrivateIpv4Hostname(hostname) ||
    isBareLanHostname(hostname)
  );
}

export function parseAllowedOrigins(rawOrigins: string | undefined): string[] {
  return (rawOrigins || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function isOriginAllowed(
  origin: string | undefined,
  allowedOrigins: string[],
  requestHost?: string,
): boolean {
  if (!origin) {
    return true;
  }

  if (allowedOrigins.includes(origin)) {
    return true;
  }

  if (isAllowedLanOrigin(origin)) {
    return true;
  }

  if (requestHost) {
    const originHostname = getHostnameFromOrigin(origin);
    const requestHostname = getHostnameFromOrigin(requestHost);
    if (originHostname && requestHostname && originHostname === requestHostname) {
      return true;
    }
  }

  return false;
}
