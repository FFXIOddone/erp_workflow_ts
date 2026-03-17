/**
 * VUTEk Ink Level Probe
 * SSH into the VUTEk printer (192.168.254.60) as vutek01 and search for
 * ink-level data files, SNMP configs, or any status reporting mechanism.
 */
import { Client } from 'ssh2';

const HOST = '192.168.254.60';
const PORT = 22;
const USERNAME = 'vutek01';
const PASSWORD = 'vutek01';

function execCmd(conn: Client, cmd: string, timeoutMs = 10000): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve('(timeout)'), timeoutMs);
    conn.exec(cmd, (err: Error | undefined, stream: any) => {
      if (err) { clearTimeout(timer); reject(err); return; }
      let out = '';
      let errOut = '';
      stream.on('data', (data: Buffer) => { out += data.toString(); });
      stream.stderr.on('data', (data: Buffer) => { errOut += data.toString(); });
      stream.on('close', () => {
        clearTimeout(timer);
        resolve(out || errOut || '(no output)');
      });
    });
  });
}

async function main() {
  console.log(`\n=== VUTEk Ink Level Probe — ${HOST} as ${USERNAME} ===\n`);

  const conn = new Client();

  await new Promise<void>((resolve, reject) => {
    conn.on('ready', () => {
      console.log('✅ SSH Connected!\n');
      resolve();
    });
    conn.on('error', (err: Error) => {
      console.error('❌ SSH Connection failed:', err.message);
      reject(err);
    });

    conn.connect({
      host: HOST,
      port: PORT,
      username: USERNAME,
      password: PASSWORD,
      readyTimeout: 10000,
      algorithms: {
        kex: [
          'diffie-hellman-group-exchange-sha256',
          'diffie-hellman-group-exchange-sha1',
          'diffie-hellman-group14-sha256',
          'diffie-hellman-group14-sha1',
          'diffie-hellman-group1-sha1',
          'ecdh-sha2-nistp256',
          'ecdh-sha2-nistp384',
          'ecdh-sha2-nistp521',
        ],
        serverHostKey: ['ssh-rsa', 'ssh-dss', 'ecdsa-sha2-nistp256', 'ssh-ed25519'],
        cipher: [
          'aes128-ctr', 'aes192-ctr', 'aes256-ctr',
          'aes128-cbc', 'aes192-cbc', 'aes256-cbc',
          'aes128-gcm', 'aes128-gcm@openssh.com', 'aes256-gcm', 'aes256-gcm@openssh.com',
          '3des-cbc',
        ],
        hmac: ['hmac-sha2-256', 'hmac-sha2-512', 'hmac-sha1', 'hmac-md5'],
      },
    });
  });

  // Phase 1: System identification
  console.log('=== PHASE 1: System Info ===\n');
  const sysCommands = [
    'whoami',
    'hostname',
    'uname -a',
    'cat /etc/os-release 2>/dev/null || cat /etc/lsb-release 2>/dev/null || cat /etc/issue',
    'ip addr show 2>/dev/null || ifconfig 2>/dev/null',
  ];

  for (const cmd of sysCommands) {
    console.log(`--- ${cmd} ---`);
    const result = await execCmd(conn, cmd);
    console.log(result.trim());
    console.log();
  }

  // Phase 2: Look for EFI/VUTEk software and ink data
  console.log('\n=== PHASE 2: EFI/VUTEk Software & Ink Files ===\n');
  const inkCommands = [
    // Find EFI / VUTEk directories
    'find / -maxdepth 3 -type d \\( -iname "*efi*" -o -iname "*vutek*" -o -iname "*fiery*" \\) 2>/dev/null | head -30',
    // Find ink-related files
    'find / -maxdepth 4 \\( -iname "*ink*" -o -iname "*supply*" -o -iname "*level*" -o -iname "*consumable*" \\) 2>/dev/null | head -30',
    // Find status files
    'find / -maxdepth 4 \\( -iname "*status*" -o -iname "*state*" -o -iname "*monitor*" \\) -not -path "*/proc/*" -not -path "*/sys/*" 2>/dev/null | head -30',
    // Look for XML/JSON data files that might have ink info
    'find / -maxdepth 4 \\( -name "*.xml" -o -name "*.json" -o -name "*.cfg" -o -name "*.conf" \\) -not -path "*/proc/*" -not -path "*/sys/*" 2>/dev/null | head -50',
    // Check common EFI install locations
    'ls -la /opt/ 2>/dev/null',
    'ls -la /usr/local/ 2>/dev/null',
    'ls -la /home/ 2>/dev/null',
    'ls -la /home/vutek01/ 2>/dev/null',
    // Check for SNMP
    'which snmpd 2>/dev/null ; which snmpget 2>/dev/null ; dpkg -l | grep snmp 2>/dev/null ; rpm -qa | grep snmp 2>/dev/null',
    // Check running processes for ink/status services
    'ps aux | grep -iE "ink|status|monitor|efi|vutek|fiery|snmp" | grep -v grep',
    // Check open ports/listening services
    'netstat -tlnp 2>/dev/null || ss -tlnp 2>/dev/null',
    // Check for any web services / APIs
    'curl -s http://localhost 2>/dev/null | head -20 ; curl -s http://localhost:8080 2>/dev/null | head -20 ; curl -s http://localhost:8443 2>/dev/null | head -20',
  ];

  for (const cmd of inkCommands) {
    console.log(`--- ${cmd} ---`);
    try {
      const result = await execCmd(conn, cmd, 15000);
      console.log(result.trim() || '(empty)');
    } catch (e: any) {
      console.log(`ERROR: ${e.message}`);
    }
    console.log();
  }

  // Phase 3: Check for log files with ink references
  console.log('\n=== PHASE 3: Log Files with Ink References ===\n');
  const logCommands = [
    'find /var/log -name "*.log" 2>/dev/null | head -20',
    'grep -ril "ink" /var/log/ 2>/dev/null | head -10',
    'grep -ril "ink" /opt/ 2>/dev/null | head -10',
    'grep -ril "ink" /home/ 2>/dev/null | head -10',
    // Check dmesg for printer USB/device info
    'dmesg | grep -i "printer\\|usb\\|ink" 2>/dev/null | tail -20',
  ];

  for (const cmd of logCommands) {
    console.log(`--- ${cmd} ---`);
    try {
      const result = await execCmd(conn, cmd, 15000);
      console.log(result.trim() || '(empty)');
    } catch (e: any) {
      console.log(`ERROR: ${e.message}`);
    }
    console.log();
  }

  // Phase 4: Try to find the printer control software
  console.log('\n=== PHASE 4: Installed Software & Services ===\n');
  const swCommands = [
    'dpkg -l 2>/dev/null | grep -iE "efi|vutek|print|ink|snmp" | head -20',
    'rpm -qa 2>/dev/null | grep -iE "efi|vutek|print|ink|snmp" | head -20',
    'systemctl list-units --type=service 2>/dev/null | grep -iE "efi|vutek|print|ink|snmp|monitor" | head -20',
    'ls /etc/init.d/ 2>/dev/null | grep -iE "efi|vutek|print|ink|snmp"',
    // Check crontabs for data export scripts
    'crontab -l 2>/dev/null ; cat /etc/crontab 2>/dev/null | grep -v "^#"',
    // Check if there's a local database
    'find / -maxdepth 4 \\( -name "*.db" -o -name "*.sqlite" -o -name "*.db3" \\) -not -path "*/proc/*" -not -path "*/sys/*" 2>/dev/null | head -10',
    // Check for Python/Java apps that might expose APIs
    'find / -maxdepth 4 \\( -name "*.py" -o -name "*.jar" -o -name "*.war" \\) -not -path "*/proc/*" -not -path "*/sys/*" 2>/dev/null | head -20',
    // Look for any REST/API endpoints
    'find / -maxdepth 4 -name "*.properties" -o -name "*.yaml" -o -name "*.yml" 2>/dev/null | grep -v proc | grep -v sys | head -20',
  ];

  for (const cmd of swCommands) {
    console.log(`--- ${cmd} ---`);
    try {
      const result = await execCmd(conn, cmd, 15000);
      console.log(result.trim() || '(empty)');
    } catch (e: any) {
      console.log(`ERROR: ${e.message}`);
    }
    console.log();
  }

  // Phase 5: Check if we can read /proc or /sys for printer hardware status
  console.log('\n=== PHASE 5: Hardware/Device Status ===\n');
  const hwCommands = [
    'lsusb 2>/dev/null',
    'lspci 2>/dev/null | grep -i "print\\|serial\\|usb"',
    'ls /dev/usb* /dev/lp* /dev/ttyUSB* /dev/ttyACM* 2>/dev/null',
    // Can we sudo?
    'sudo -l 2>/dev/null | head -10',
    // Check disk space (ink data might be in a specific partition)
    'df -h',
    'mount | grep -v tmpfs',
  ];

  for (const cmd of hwCommands) {
    console.log(`--- ${cmd} ---`);
    try {
      const result = await execCmd(conn, cmd, 10000);
      console.log(result.trim() || '(empty)');
    } catch (e: any) {
      console.log(`ERROR: ${e.message}`);
    }
    console.log();
  }

  conn.end();
  console.log('\n=== Probe Complete ===');
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
