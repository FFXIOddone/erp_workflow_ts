# Equipment Live-Detail Performance Optimization

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make equipment detail pages load instantly by skipping useless probes for non-SNMP devices and using cached data from background warmers.

**Architecture:** Skip SNMP probes for SMB-connected equipment (Zunds, file servers). Extend the existing Zund cache warmer to warm both machines. Use `getOrFetchStale` on the live-detail endpoint so cached data returns instantly with background refresh. For SNMP printers, cache deep SNMP data for 24 hours and only refresh on explicit detail page visits.

**Tech Stack:** Express, TtlCache (existing), existing Zund live cache warmer

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `packages/server/src/routes/equipment.ts` | Modify (lines 376-635) | Skip SNMP probes for non-SNMP devices; use stale-while-revalidate for live-detail cache |
| `packages/server/src/services/zund-live.ts` | Modify (lines 819-843) | Warm both zund1 AND zund2 in cache warmer |
| `packages/server/src/routes/equipment.ts` | Modify (line 22) | Increase liveDetailCache TTL for non-SNMP devices |

---

### Task 1: Extend Zund Cache Warmer to Include Zund 1

The cache warmer currently only warms `zund2`. Add `zund1`.

**Files:**
- Modify: `packages/server/src/services/zund-live.ts:819-836`

- [ ] **Step 1: Update `startZundLiveCacheWarmer` to warm both Zunds**

Replace the warmer body to iterate both machines:

```typescript
export function startZundLiveCacheWarmer(intervalMs = 45_000): void {
  if (warmerInterval) return; // Already running

  const zundIds = ['zund1', 'zund2'];

  // Warm immediately on start
  for (const id of zundIds) {
    fetchZundLiveData(id, {}, `${id}-{}`).catch(
      err => console.warn(`[ZundLive] Initial cache warm failed for ${id}:`, err.message)
    );
  }

  warmerInterval = setInterval(() => {
    for (const id of zundIds) {
      fetchZundLiveData(id, {}, `${id}-{}`).catch(
        err => console.warn(`[ZundLive] Cache warmer failed for ${id}:`, err.message)
      );
    }
  }, intervalMs);

  // Don't block process exit
  if (warmerInterval?.unref) warmerInterval.unref();
  console.log(`[ZundLive] Cache warmer started for ${zundIds.join(', ')} (${intervalMs}ms interval)`);
}
```

- [ ] **Step 2: Verify server starts and logs both Zunds warming**

Run: `npm run dev:server` — check console output for:
```
[ZundLive] Cache warmer started for zund1, zund2 (45000ms interval)
```

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/services/zund-live.ts
git commit -m "feat: warm both zund1 and zund2 in live cache warmer"
```

---

### Task 2: Skip SNMP Probes for Non-SNMP Equipment

The live-detail endpoint runs SNMP probes, deep SNMP walks, HP EWS polling, and VUTEk polling for ALL equipment. For SMB-connected devices (Zunds, file servers), these probes return nothing and waste time. Gate them behind connection type checks.

**Files:**
- Modify: `packages/server/src/routes/equipment.ts:407-587`

- [ ] **Step 1: Gate Probe 1 (basic SNMP) to only run for SNMP or when no connType**

Replace lines 407-433. The basic connectivity check should still run for all devices with IPs, but SNMP-specific polling only for SNMP equipment:

```typescript
  // Probe 1: Basic live status
  if (ip) {
    probes.push((async () => {
      try {
        let liveStatus;
        if (connType === 'SNMP') {
          liveStatus = await pollPrinterStatus(id, ip, (equipment as any).snmpCommunity || 'public');
        } else {
          liveStatus = await checkDeviceConnectivity(id, ip, connType, (equipment as any).snmpCommunity || 'public');
        }
        setCachedStatus(id, liveStatus);
        result.live = {
          reachable: liveStatus.reachable,
          state: liveStatus.state,
          stateMessage: liveStatus.stateMessage,
          systemName: liveStatus.systemName,
          systemDescription: liveStatus.systemDescription,
          lastPolled: liveStatus.lastPolled,
          supplies: liveStatus.supplies,
          alerts: liveStatus.alerts,
          errorMessage: liveStatus.errorMessage,
        };
      } catch (err: any) {
        result.live = { reachable: false, state: 'offline', errorMessage: err.message };
      }
    })());
  }
```

(This probe stays unchanged — it already handles both SNMP and non-SNMP. No action needed.)

- [ ] **Step 2: Probe 2 (deep SNMP) — already gated by `connType === 'SNMP'`, no change needed**

Verify line 436 reads `if (ip && connType === 'SNMP')` — this is correct.

- [ ] **Step 3: Gate Probe 5 (HP EWS/LEDM) to only run for SNMP or HTTP-connected printers**

Replace the condition on line 538 from:
```typescript
  if (ip) {
```
To:
```typescript
  // Probe 5: HP EWS / LEDM — only for printers (SNMP/HTTP), not SMB file shares or cutters
  if (ip && connType !== 'SMB') {
```

- [ ] **Step 4: Gate Probe 4 (port scan) to skip for SMB devices — use cached ports instead**

Port scans take 2-3 seconds. For SMB devices we already know the relevant ports. Replace the port scan probe (lines 483-535) to cache results for 24 hours:

Add a port scan cache at the top of the file (near line 22):
```typescript
const portScanCache = new TtlCache<Record<string, boolean>>(86_400_000); // 24h TTL
```

Then wrap the port scan probe:
```typescript
  // Probe 4: Port scan + NetBIOS (all devices with IP)
  if (ip) {
    probes.push((async () => {
      try {
        // Use 24h cached port scan if available
        const cachedPorts = portScanCache.get(ip);
        if (cachedPorts) {
          result.ports = cachedPorts;
          return;
        }

        const net = await import('net');
        const tcpCheck = (port: number, timeout = 2000): Promise<boolean> =>
          new Promise((resolve) => {
            const s = new net.Socket();
            s.setTimeout(timeout);
            s.on('connect', () => { s.destroy(); resolve(true); });
            s.on('timeout', () => { s.destroy(); resolve(false); });
            s.on('error', () => { s.destroy(); resolve(false); });
            s.connect(port, ip);
          });

        const portDefs = [
          { key: 'http',  port: 80 },
          { key: 'https', port: 443 },
          { key: 'smb',   port: 445 },
          { key: 'rdp',   port: 3389 },
          { key: 'vnc',   port: 5900 },
          { key: 'ssh',   port: 22 },
          { key: 'ipp',   port: 631 },
          { key: 'winrm', port: 5985 },
          { key: 'snmp',  port: 161 },
          { key: 'rpc',   port: 135 },
        ];

        const checks = await Promise.allSettled(
          portDefs.map(({ port }) => tcpCheck(port))
        );

        result.ports = {};
        portDefs.forEach(({ key }, i) => {
          result.ports[key] = (checks[i] as any).value ?? false;
        });

        // Cache port scan for 24h
        portScanCache.set(ip, result.ports);

        // NetBIOS hostname lookup if SMB port is open
        if (result.ports.smb || connType === 'SMB') {
          try {
            const { exec } = await import('child_process');
            const { promisify } = await import('util');
            const execAsync = promisify(exec);
            const { stdout } = await execAsync(`nbtstat -A ${ip}`, { timeout: 5000 });
            const match = stdout.match(/^\s+(\S+)\s+<00>\s+UNIQUE/m);
            if (match) {
              result.smb = { hostname: match[1].trim() };
            }
          } catch {}
        }
      } catch {}
    })());
  }
```

- [ ] **Step 5: Verify with curl that Zund live-detail returns fast**

```bash
# Time the request — should be <2s now vs 24s before
time curl -s http://localhost:8001/api/v1/equipment/06d7336a-74e0-4ed0-bc25-e674428f0e2a/live-detail \
  -H "Authorization: Bearer <token>" | head -c 200
```

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/routes/equipment.ts
git commit -m "perf: skip SNMP/EWS probes for SMB equipment, cache port scans 24h"
```

---

### Task 3: Use Stale-While-Revalidate for Live-Detail Cache

Currently `liveDetailCache` has a 30s TTL and returns nothing on cache miss (forcing a full re-probe). Switch to stale-while-revalidate: return stale data instantly, refresh in background.

**Files:**
- Modify: `packages/server/src/routes/equipment.ts:376-635`

- [ ] **Step 1: Increase liveDetailCache TTL and use `getOrFetchStale`**

Replace the liveDetailCache initialization (line 22):
```typescript
const liveDetailCache = new TtlCache<any>(60_000); // 60s TTL (stale data served while refreshing)
```

- [ ] **Step 2: Wrap the entire live-detail handler body as the fetch function for `getOrFetchStale`**

Replace the handler to use stale-while-revalidate. The key change: instead of checking cache manually and building the result inline, wrap the probe logic into a function and use `getOrFetchStale`:

```typescript
router.get('/:id/live-detail', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const data = await liveDetailCache.getOrFetchStale(id, async () => {
    const equipment = await prisma.equipment.findUnique({
      where: { id },
    });

    if (!equipment) {
      throw NotFoundError('Equipment not found');
    }

    const result: any = {
      equipmentId: id,
      name: equipment.name,
      connectionType: (equipment as any).connectionType || null,
      ipAddress: equipment.ipAddress || null,
    };

    const connType = ((equipment as any).connectionType || '').toUpperCase();
    const ip = equipment.ipAddress;

    // ── Run all independent network probes in parallel ──
    const probes: Promise<void>[] = [];

    // ... (all existing probe code from Task 2, unchanged) ...

    await Promise.allSettled(probes);

    // ... (all existing post-processing code, unchanged) ...

    return result;
  });

  res.json({ success: true, data });
});
```

This means:
- **First visit ever**: Blocks while probes run (unavoidable), but deduplicates concurrent requests
- **Within 60s**: Returns cached data instantly
- **After 60s**: Returns stale data instantly, triggers background refresh
- **Concurrent requests**: Only one probe runs, all callers get the same result

- [ ] **Step 3: Remove the old manual cache check and set**

The old `liveDetailCache.get(id)` check at lines 381-384 and `liveDetailCache.set(id, result)` at line 632 are now handled by `getOrFetchStale`. Remove them.

- [ ] **Step 4: Test that second request is instant**

```bash
# First request (may take a few seconds)
time curl -s http://localhost:8001/api/v1/equipment/<id>/live-detail -H "Authorization: Bearer <token>" > /dev/null

# Second request immediately — should be <100ms
time curl -s http://localhost:8001/api/v1/equipment/<id>/live-detail -H "Authorization: Bearer <token>" > /dev/null
```

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/routes/equipment.ts
git commit -m "perf: use stale-while-revalidate for equipment live-detail cache"
```

---

### Task 4: Increase Deep SNMP Cache TTL to 24 Hours for Printers

For printers that DO use SNMP (HP, VUTEk), the deep SNMP data (page counts, trays, firmware) rarely changes. Cache it for 24 hours instead of 30 seconds.

**Files:**
- Modify: `packages/server/src/routes/equipment.ts` (near line 22)

- [ ] **Step 1: Add a dedicated deep SNMP cache with 24h TTL**

Add near the other cache declarations:
```typescript
const deepSnmpCache = new TtlCache<any>(86_400_000); // 24h TTL for deep SNMP data
```

- [ ] **Step 2: Use the cache in Probe 2**

Replace the deep SNMP probe (lines 436-448):
```typescript
  // Probe 2: Deep SNMP data (page count, media trays, uptime, cover status)
  if (ip && connType === 'SNMP') {
    probes.push((async () => {
      try {
        result.deep = await deepSnmpCache.getOrFetchStale(ip, async () => {
          return await Promise.race([
            deepPollPrinterStatus(ip, (equipment as any).snmpCommunity || 'public'),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Deep SNMP poll timed out after 30s')), 30000)),
          ]);
        });
      } catch (err: any) {
        result.deep = { error: err.message };
      }
    })());
  }
```

This means: deep SNMP data is fetched once, cached for 24 hours. If stale, returns stale instantly and refreshes in background. The 30s race timeout still applies to the actual SNMP walk.

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/routes/equipment.ts
git commit -m "perf: cache deep SNMP data for 24h with stale-while-revalidate"
```

---

## Expected Performance After All Tasks

| Scenario | Before | After |
|----------|--------|-------|
| Zund detail page (cold) | 5-8s | 2-3s (no SNMP/EWS probes) |
| Zund detail page (warm) | <100ms | <100ms (stale-while-revalidate) |
| Zund detail page (stale) | 5-8s (re-probes) | <100ms (returns stale, refreshes background) |
| SNMP printer detail (cold) | 24s | 24s (first time unavoidable) |
| SNMP printer detail (warm) | <100ms | <100ms |
| SNMP printer detail (stale, deep) | 24s | <100ms (24h deep cache + stale-while-revalidate) |
| SNMP printer detail (stale, basic) | 24s | <100ms (stale-while-revalidate on outer cache) |
