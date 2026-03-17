import React from 'react';
import {
  Network,
  Server,
  MonitorSmartphone,
  HardDrive,
  Globe,
  Lock,
  Printer,
  Terminal,
  Shield,
  Cpu,
} from 'lucide-react';

// ---- Port definitions with metadata ----
const PORT_DEFS = [
  { key: 'http',  port: 80,   label: 'HTTP',     desc: 'Web Interface',    icon: Globe,            group: 'web',    action: 'http' as const },
  { key: 'https', port: 443,  label: 'HTTPS',    desc: 'Secure Web',       icon: Lock,             group: 'web',    action: 'https' as const },
  { key: 'smb',   port: 445,  label: 'SMB/CIFS', desc: 'File Shares',      icon: HardDrive,        group: 'remote', action: 'file-shares' as const },
  { key: 'rdp',   port: 3389, label: 'RDP',      desc: 'Remote Desktop',   icon: MonitorSmartphone, group: 'remote', action: 'rdp' as const },
  { key: 'vnc',   port: 5900, label: 'VNC',      desc: 'Remote Display',   icon: MonitorSmartphone, group: 'remote', action: 'vnc' as const },
  { key: 'ssh',   port: 22,   label: 'SSH',      desc: 'Secure Shell',     icon: Terminal,         group: 'system', action: null },
  { key: 'ipp',   port: 631,  label: 'IPP/CUPS', desc: 'Print Service',    icon: Printer,          group: 'web',    action: 'ipp' as const },
  { key: 'winrm', port: 5985, label: 'WinRM',    desc: 'Win Services',     icon: Cpu,              group: 'remote', action: 'services' as const },
  { key: 'snmp',  port: 161,  label: 'SNMP',     desc: 'Monitoring',       icon: Shield,           group: 'system', action: null },
  { key: 'rpc',   port: 135,  label: 'RPC',      desc: 'Win Services',     icon: Server,           group: 'system', action: 'services' as const },
] as const;

type PortAction = 'http' | 'https' | 'ipp' | 'file-shares' | 'rdp' | 'vnc' | 'services' | null;

interface ConnectivityCardProps {
  ports: Record<string, boolean>;
  ipAddress: string;
  hostname?: string;
  equipmentName: string;
  isOnline: boolean;
  connectionType: string;
  onLaunchConnection: (type: 'rdp' | 'vnc', targetIp?: string) => void;
  onOpenFileShares: (ip?: string, name?: string) => void;
  onOpenWinServices: (ip?: string, name?: string) => void;
  onOpenIppPrint?: (ip?: string, name?: string) => void;
}

export function ConnectivityCard({
  ports,
  ipAddress,
  hostname,
  equipmentName,
  isOnline,
  connectionType,
  onLaunchConnection,
  onOpenFileShares,
  onOpenWinServices,
  onOpenIppPrint,
}: ConnectivityCardProps) {
  // Count open ports
  const openPorts = PORT_DEFS.filter(p => ports[p.key]);

  // Only keep groups that have at least one open port
  const remoteOpen = PORT_DEFS.filter(p => p.group === 'remote' && ports[p.key]);
  const webOpen = PORT_DEFS.filter(p => p.group === 'web' && ports[p.key]);
  const systemOpen = PORT_DEFS.filter(p => p.group === 'system' && ports[p.key]);

  function handleAction(action: PortAction) {
    if (!action) return;
    switch (action) {
      case 'rdp':
        onLaunchConnection('rdp', ipAddress);
        break;
      case 'vnc':
        onLaunchConnection('vnc', ipAddress);
        break;
      case 'file-shares':
        onOpenFileShares(ipAddress, equipmentName);
        break;
      case 'services':
        onOpenWinServices(ipAddress, equipmentName);
        break;
      case 'http':
        window.open(`http://${ipAddress}`, '_blank');
        break;
      case 'https':
        window.open(`https://${ipAddress}`, '_blank');
        break;
      case 'ipp':
        if (onOpenIppPrint) {
          onOpenIppPrint(ipAddress, equipmentName);
        } else {
          window.open(`http://${ipAddress}:631`, '_blank');
        }
        break;
    }
  }

  function getActionLabel(action: PortAction): string {
    switch (action) {
      case 'rdp': return '▶ Connect';
      case 'vnc': return '▶ Connect';
      case 'file-shares': return '📂 Browse';
      case 'services': return '⚙ View';
      case 'http': return '🌐 Open';
      case 'https': return '🔒 Open';
      case 'ipp': return '🖨 Print';
      default: return '';
    }
  }

  function renderPortBadge(def: typeof PORT_DEFS[number]) {
    const isClickable = def.action !== null;
    const Icon = def.icon;

    return (
      <button
        key={def.key}
        onClick={() => isClickable && handleAction(def.action)}
        disabled={!isClickable}
        className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all ${
          isClickable
            ? 'border-green-200 bg-green-50 hover:bg-green-100 hover:border-green-300 hover:shadow-md cursor-pointer'
            : 'border-green-200 bg-green-50'
        }`}
      >
        <Icon className="h-5 w-5 text-green-600" />
        <span className="text-sm font-bold text-green-700">
          {def.label}
        </span>
        <span className="text-xs text-gray-400">:{def.port}</span>
        {isClickable && (
          <span className="text-xs text-green-600 font-medium">
            {getActionLabel(def.action)}
          </span>
        )}
      </button>
    );
  }

  // Are there ANY open ports in a group?
  const hasRemote = remoteOpen.length > 0;
  const hasWeb = webOpen.length > 0;
  const hasSystem = systemOpen.length > 0;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Network className="h-5 w-5 text-gray-400" />
          System Connectivity
        </h2>
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
          isOnline ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {isOnline ? 'ONLINE' : 'OFFLINE'}
        </span>
      </div>
      <p className="text-xs text-gray-400 mb-4">
        {ipAddress}{hostname ? ` (${hostname})` : ''} · {connectionType} · {openPorts.length}/{PORT_DEFS.length} ports open
      </p>

      {/* NetBIOS hostname callout */}
      {hostname && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <span className="text-blue-600 text-sm font-medium">NetBIOS Name: </span>
          <span className="font-mono font-bold text-blue-900 text-lg">{hostname}</span>
        </div>
      )}

      <div className="space-y-5">
        {/* Remote Access Group — only if open ports */}
        {hasRemote && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <MonitorSmartphone className="h-4 w-4 text-purple-500" />
            Remote Access & File Shares
            <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
              {remoteOpen.length} available
            </span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {remoteOpen.map(renderPortBadge)}
          </div>
        </div>
        )}

        {/* Web Interfaces Group — only if open ports */}
        {hasWeb && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Globe className="h-4 w-4 text-blue-500" />
            Web Interfaces
            <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
              {webOpen.length} available
            </span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {webOpen.map(renderPortBadge)}
          </div>
        </div>
        )}

        {/* System Services Group — only if open ports */}
        {hasSystem && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Server className="h-4 w-4 text-gray-500" />
            System Services
            <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
              {systemOpen.length} available
            </span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {systemOpen.map(renderPortBadge)}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
