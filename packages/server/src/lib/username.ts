export function normalizeUsername(username: string | null | undefined): string {
  return (username ?? '').trim().toLowerCase();
}
