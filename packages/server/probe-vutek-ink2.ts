/**
 * VUTEk Deep Probe — Phase 2
 * Explore MySQL databases, /vutek filesystem, and VuServer for ink data
 */
import { Client } from 'ssh2';

const HOST = '192.168.254.60';
const PORT = 22;
const USERNAME = 'vutek01';
const PASSWORD = 'vutek01';

function execCmd(conn: Client, cmd: string, timeoutMs = 15000): Promise<string> {
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
  console.log(`\n=== VUTEk Deep Probe Phase 2 — ${HOST} ===\n`);

  const conn = new Client();

  await new Promise<void>((resolve, reject) => {
    conn.on('ready', () => { console.log('✅ SSH Connected!\n'); resolve(); });
    conn.on('error', (err: Error) => { console.error('❌ Failed:', err.message); reject(err); });
    conn.connect({
      host: HOST, port: PORT, username: USERNAME, password: PASSWORD,
      readyTimeout: 10000,
      algorithms: {
        kex: ['diffie-hellman-group-exchange-sha256', 'diffie-hellman-group-exchange-sha1', 'diffie-hellman-group14-sha256', 'diffie-hellman-group14-sha1', 'diffie-hellman-group1-sha1', 'ecdh-sha2-nistp256', 'ecdh-sha2-nistp384', 'ecdh-sha2-nistp521'],
        serverHostKey: ['ssh-rsa', 'ssh-dss', 'ecdsa-sha2-nistp256', 'ssh-ed25519'],
        cipher: ['aes128-ctr', 'aes192-ctr', 'aes256-ctr', 'aes128-cbc', 'aes192-cbc', 'aes256-cbc', 'aes128-gcm', 'aes128-gcm@openssh.com', 'aes256-gcm', 'aes256-gcm@openssh.com', '3des-cbc'],
        hmac: ['hmac-sha2-256', 'hmac-sha2-512', 'hmac-sha1', 'hmac-md5'],
      },
    });
  });

  // ============ MySQL Exploration ============
  console.log('=== MYSQL DATABASES ===\n');
  
  const mysqlCmds = [
    // List databases
    `mysql -u root -e "SHOW DATABASES;" 2>/dev/null || mysql -u vutek01 -pvutek01 -e "SHOW DATABASES;" 2>/dev/null || mysql -u vutek -e "SHOW DATABASES;" 2>/dev/null`,
    // Show tables in controldb
    `mysql -u root controldb -e "SHOW TABLES;" 2>/dev/null || mysql -u vutek01 -pvutek01 controldb -e "SHOW TABLES;" 2>/dev/null`,
    // Show tables in printdb
    `mysql -u root printdb -e "SHOW TABLES;" 2>/dev/null || mysql -u vutek01 -pvutek01 printdb -e "SHOW TABLES;" 2>/dev/null`,
    // Look for ink-related tables
    `mysql -u root controldb -e "SHOW TABLES LIKE '%ink%';" 2>/dev/null ; mysql -u root controldb -e "SHOW TABLES LIKE '%supply%';" 2>/dev/null ; mysql -u root controldb -e "SHOW TABLES LIKE '%level%';" 2>/dev/null ; mysql -u root controldb -e "SHOW TABLES LIKE '%color%';" 2>/dev/null ; mysql -u root controldb -e "SHOW TABLES LIKE '%consumable%';" 2>/dev/null`,
    // Same for printdb
    `mysql -u root printdb -e "SHOW TABLES LIKE '%ink%';" 2>/dev/null ; mysql -u root printdb -e "SHOW TABLES LIKE '%supply%';" 2>/dev/null ; mysql -u root printdb -e "SHOW TABLES LIKE '%level%';" 2>/dev/null ; mysql -u root printdb -e "SHOW TABLES LIKE '%color%';" 2>/dev/null`,
  ];

  for (const cmd of mysqlCmds) {
    console.log(`--- ${cmd.substring(0, 80)}... ---`);
    try {
      const result = await execCmd(conn, cmd, 10000);
      console.log(result.trim());
    } catch (e: any) {
      console.log(`ERROR: ${e.message}`);
    }
    console.log();
  }

  // ============ /vutek Filesystem Exploration ============
  console.log('\n=== /vutek FILESYSTEM ===\n');
  
  const vutekFsCmds = [
    'ls -la /vutek/',
    'ls -la /vutek/Data/ 2>/dev/null | head -20',
    'ls -la /usr/vutek/',
    'ls -la /usr/vutek/bin/ 2>/dev/null | head -30',
    'ls -la /usr/vutek/etc/ 2>/dev/null | head -30',
    'ls -la /usr/vutek/etc/ServiceList/ 2>/dev/null',
    'ls -la /usr/vutek/jdf/ 2>/dev/null',
    'ls -la /usr/vutek/jdf/bin/ 2>/dev/null',
    // Look for config files with ink settings
    'find /usr/vutek -name "*.xml" -o -name "*.cfg" -o -name "*.conf" -o -name "*.properties" 2>/dev/null | head -30',
    // Check VuServer config
    'cat /usr/vutek/etc/ServiceList/Rangeley.xml 2>/dev/null | head -100',
    // Check the InkVelocityVoltageOffsets.sql backup
    'cat /home/vutek01/Backups/InkVelocityVoltageOffsets.sql 2>/dev/null | head -80',
    // Check EFI Fleet Agent for data
    'ls -la /usr/local/bin/fleetagent/ 2>/dev/null',
    'ls -la /usr/share/fleetagent/ 2>/dev/null',
    'cat /etc/cron.d/efifleetmonitor 2>/dev/null',
    // Check JDF server config
    'find /usr/vutek/jdf -name "*.xml" -o -name "*.cfg" -o -name "*.properties" 2>/dev/null | head -20',
  ];

  for (const cmd of vutekFsCmds) {
    console.log(`--- ${cmd} ---`);
    try {
      const result = await execCmd(conn, cmd, 10000);
      console.log(result.trim());
    } catch (e: any) {
      console.log(`ERROR: ${e.message}`);
    }
    console.log();
  }

  // ============ VuServer / CORBA Ports ============
  console.log('\n=== VUSERVER / CORBA Service Exploration ===\n');
  
  const vuServerCmds = [
    // Try VuServer HTTP interface on port 8013
    'curl -s http://localhost:8013/ 2>/dev/null | head -50',
    'curl -s http://localhost:8013/status 2>/dev/null | head -50',
    // Try JDF server
    'curl -s http://localhost:8013/jdf 2>/dev/null | head -50',
    // Try CORBA nameserver
    'curl -s http://localhost:2809/ 2>/dev/null | head -20',
    // Check omniorb config
    'cat /etc/omniORB4.cfg 2>/dev/null',
    // Check vutekd service
    'cat /etc/init.d/vutekd 2>/dev/null | head -40',
    // Check recent vutekd log
    'tail -100 /var/log/vutekd.log 2>/dev/null',
    // Check samba config for any data shares
    'cat /etc/samba/smb.conf 2>/dev/null',
  ];

  for (const cmd of vuServerCmds) {
    console.log(`--- ${cmd} ---`);
    try {
      const result = await execCmd(conn, cmd, 10000);
      console.log(result.trim());
    } catch (e: any) {
      console.log(`ERROR: ${e.message}`);
    }
    console.log();
  }

  conn.end();
  console.log('\n=== Phase 2 Probe Complete ===');
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
