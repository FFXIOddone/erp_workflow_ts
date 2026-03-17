import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();
const equipment = await p.equipment.findMany({
  select: { id: true, name: true, type: true, ipAddress: true, connectionType: true },
  orderBy: { name: 'asc' },
});
await p.$disconnect();

const API = 'http://127.0.0.1:8001/api/v1';

// Login first
const loginRes = await fetch(`${API}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'admin123' }),
});
const { data: { token } } = await loginRes.json() as any;
const headers = { Authorization: `Bearer ${token}` };

console.log(`\n${'='.repeat(90)}`);
console.log(`  EQUIPMENT CONNECTIVITY SCAN — ${new Date().toLocaleString()}`);
console.log(`  Scanning ${equipment.length} devices across 10 ports each...`);
console.log(`${'='.repeat(90)}\n`);

const PORT_LABELS: Record<string, string> = {
  http: 'HTTP (:80)',
  https: 'HTTPS (:443)',
  smb: 'SMB/CIFS (:445)',
  rdp: 'RDP (:3389)',
  vnc: 'VNC (:5900)',
  ssh: 'SSH (:22)',
  ipp: 'IPP/CUPS (:631)',
  winrm: 'WinRM (:5985)',
  snmp: 'SNMP (:161)',
  rpc: 'RPC (:135)',
};

const ACTION_MAP: Record<string, string> = {
  http: '🌐 Open Web UI',
  https: '🔒 Open Secure Web',
  smb: '📂 Browse File Shares',
  rdp: '▶ Remote Desktop',
  vnc: '▶ Remote Display',
  winrm: '⚙ View Win Services',
  rpc: '⚙ View Services',
  ssh: '(info only)',
  ipp: '(info only)',
  snmp: '(info only)',
};

interface ScanResult {
  name: string;
  ip: string;
  connType: string;
  online: boolean;
  hostname?: string;
  ports: Record<string, boolean>;
  openCount: number;
  actions: string[];
}

const results: ScanResult[] = [];

for (const eq of equipment) {
  process.stdout.write(`  Scanning ${eq.name.padEnd(25)} (${eq.ipAddress})...`);
  
  try {
    const res = await fetch(`${API}/equipment/${eq.id}/live-detail`, { headers });
    const json = await res.json() as any;
    const data = json.data || json;
    
    const ports = data.ports || {};
    const openPorts = Object.entries(ports).filter(([, open]) => open).map(([k]) => k);
    const hostname = data.smb?.hostname || data.live?.systemName;
    const online = data.live?.reachable ?? false;
    
    const actions = openPorts
      .filter(k => ACTION_MAP[k] && !ACTION_MAP[k].startsWith('('))
      .map(k => `${ACTION_MAP[k]} via ${PORT_LABELS[k]}`);

    results.push({
      name: eq.name!,
      ip: eq.ipAddress!,
      connType: eq.connectionType || 'PING',
      online,
      hostname,
      ports,
      openCount: openPorts.length,
      actions,
    });

    const status = online ? '✅ ONLINE' : '❌ OFFLINE';
    console.log(` ${status}  (${openPorts.length}/10 ports open)`);
  } catch (err: any) {
    console.log(` ⚠ ERROR: ${err.message}`);
    results.push({
      name: eq.name!,
      ip: eq.ipAddress!,
      connType: eq.connectionType || 'PING',
      online: false,
      ports: {},
      openCount: 0,
      actions: [],
    });
  }
}

// ---- Summary Table ----
console.log(`\n${'='.repeat(90)}`);
console.log('  PORT SCAN RESULTS');
console.log(`${'='.repeat(90)}`);

const portKeys = ['http', 'https', 'smb', 'rdp', 'vnc', 'ssh', 'ipp', 'winrm', 'snmp', 'rpc'];

// Header
console.log(`\n  ${'Equipment'.padEnd(26)} ${'IP'.padEnd(17)} ${portKeys.map(k => k.toUpperCase().padEnd(6)).join('')} Open`);
console.log(`  ${'─'.repeat(26)} ${'─'.repeat(17)} ${portKeys.map(() => '─'.repeat(6)).join('')} ${'─'.repeat(4)}`);

for (const r of results) {
  const portStr = portKeys.map(k => {
    if (r.ports[k]) return ' ✅   ';
    if (!r.online) return ' ⬛   ';
    return ' ·    ';
  }).join('');
  const onlineIcon = r.online ? '🟢' : '🔴';
  console.log(`  ${onlineIcon} ${r.name.padEnd(24)} ${r.ip.padEnd(17)} ${portStr} ${String(r.openCount).padStart(2)}/10`);
}

// ---- Available Actions per Device ----
console.log(`\n${'='.repeat(90)}`);
console.log('  AVAILABLE ACTIONS PER DEVICE');
console.log(`${'='.repeat(90)}\n`);

for (const r of results) {
  const hostStr = r.hostname ? ` (${r.hostname})` : '';
  console.log(`  ${r.online ? '🟢' : '🔴'} ${r.name}  —  ${r.ip}${hostStr}  [${r.connType}]`);
  if (r.actions.length > 0) {
    for (const a of r.actions) {
      console.log(`      ${a}`);
    }
  } else if (r.online) {
    console.log(`      (no actionable services detected)`);
  } else {
    console.log(`      (device offline — no connections available)`);
  }
  console.log('');
}

// ---- Totals ----
const onlineCount = results.filter(r => r.online).length;
const totalOpen = results.reduce((s, r) => s + r.openCount, 0);
const totalActions = results.reduce((s, r) => s + r.actions.length, 0);

console.log(`${'─'.repeat(90)}`);
console.log(`  SUMMARY: ${onlineCount}/${results.length} devices online, ${totalOpen} open ports total, ${totalActions} available actions`);
console.log(`${'─'.repeat(90)}\n`);
