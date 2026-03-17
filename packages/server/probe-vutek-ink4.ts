/**
 * VUTEk MySQL Ink Database Query — Phase 4
 * Query the controldb MySQL database with vutek01 credentials
 * and explore RFID ink tag data
 */
import { Client } from 'ssh2';

const HOST = '192.168.254.60';
const USERNAME = 'vutek01';
const PASSWORD = 'vutek01';

function execCmd(conn: Client, cmd: string, timeoutMs = 20000): Promise<string> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve('(timeout)'), timeoutMs);
    conn.exec(cmd, (err: Error | undefined, stream: any) => {
      if (err) { clearTimeout(timer); resolve(`ERROR: ${err.message}`); return; }
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
  console.log(`\n=== VUTEk MySQL Ink Query — Phase 4 ===\n`);

  const conn = new Client();
  await new Promise<void>((resolve, reject) => {
    conn.on('ready', () => { console.log('✅ Connected\n'); resolve(); });
    conn.on('error', (err: Error) => reject(err));
    conn.connect({
      host: HOST, port: 22, username: USERNAME, password: PASSWORD,
      readyTimeout: 10000,
      algorithms: {
        kex: ['diffie-hellman-group-exchange-sha256', 'diffie-hellman-group-exchange-sha1', 'diffie-hellman-group14-sha1', 'diffie-hellman-group1-sha1'],
        serverHostKey: ['ssh-rsa', 'ssh-dss', 'ecdsa-sha2-nistp256'],
        cipher: ['aes128-ctr', 'aes192-ctr', 'aes256-ctr', 'aes128-cbc', '3des-cbc'],
        hmac: ['hmac-sha2-256', 'hmac-sha1', 'hmac-md5'],
      },
    });
  });

  const mysqlCmd = (query: string, db = 'controldb') =>
    `mysql -u vutek01 -pvutek01 ${db} -e "${query}" 2>&1`;

  const commands: [string, string][] = [
    // Database access
    ['Show databases', mysqlCmd('SHOW DATABASES;')],
    ['Tables in controldb', mysqlCmd('SHOW TABLES;')],
    ['Tables in printdb', mysqlCmd('SHOW TABLES;', 'printdb')],
    
    // Find ink/RFID related tables
    ['Ink tables in controldb', 
      `mysql -u vutek01 -pvutek01 controldb -e "SHOW TABLES;" 2>&1 | grep -iE "ink|rfid|supply|level|color|consumable|material|tank|cartridge|fluid|counter|meter|usage|status"`],
    
    // Describe ink-related tables
    ['Describe InkVelocityVoltageOffsets', mysqlCmd('DESCRIBE InkVelocityVoltageOffsets;')],
    
    // Look for all tables to find anything ink-related
    ['ALL controldb tables', mysqlCmd('SHOW TABLES;')],
    
    // Look at the RFID Python script
    ['RFIDScan.py', `cat /usr/vutek/bin/python/RFIDScan.py 2>&1`],
    ['RFID_idl.py', `cat /usr/vutek/bin/python/RFID_idl.py 2>&1 | head -100`],
    
    // Check the fleet agent SQLite DB
    ['Fleet agent SQLite tables', `sudo sqlite3 /usr/share/fleetagent/fleetagent.db ".tables" 2>&1`],
    ['Fleet agent ink data', `sudo sqlite3 /usr/share/fleetagent/fleetagent.db "SELECT * FROM sqlite_master WHERE type='table';" 2>&1`],
    
    // Check InkPathGraph XML files
    ['InkPathGraph Rangeley', `cat /usr/vutek/etc/ServiceList/RangeleyInkPathGraphs.xml 2>&1 | head -60`],
    
    // Search vutekd log for RFID data that has actual levels
    ['RFID level data in logs', `grep -i "rfid.*level\\|rfid.*volume\\|rfid.*remain\\|rfid.*quantity\\|rfid.*percent\\|ink.*level\\|ink.*volume\\|ink.*remain" /var/log/vutekd.log 2>&1 | tail -30`],
    
    // Look for RFID data more broadly
    ['RFID tag data patterns', `grep -i "RFID[0-9].*:" /var/log/vutekd.log 2>&1 | grep -v "No Tag\\|expired" | tail -30`],
    
    // Check the EFI fleet agent log for ink data
    ['Fleet agent log - ink', `sudo grep -i "ink\\|supply\\|level\\|rfid\\|consumable" /usr/share/fleetagent/fleetagent.log 2>&1 | tail -30`],
    
    // Check the Java GUI VuClient for status interface
    ['VuClient directory', `ls -la /usr/vutek/gui/ 2>&1`],
    
    // Port 8013 JDF - query ink status via JMF
    ['JMF Status Query', `curl -s -m 5 -X POST -H "Content-Type: application/vnd.cip4-jmf+xml" -d '<?xml version="1.0" encoding="UTF-8"?><JMF xmlns="http://www.CIP4.org/JDFSchema_1_1" SenderID="ERP" Version="1.4" TimeStamp="2026-02-13T12:00:00Z"><Query ID="Q1" Type="Status"><StatusQuParams DeviceDetails="Details"/></Query></JMF>' http://localhost:8013/ 2>&1`],
    
    // Query device details from JMF
    ['JMF KnownDevices', `curl -s -m 5 -X POST -H "Content-Type: application/vnd.cip4-jmf+xml" -d '<?xml version="1.0" encoding="UTF-8"?><JMF xmlns="http://www.CIP4.org/JDFSchema_1_1" SenderID="ERP" Version="1.4" TimeStamp="2026-02-13T12:00:00Z"><Query ID="Q2" Type="KnownDevices"><DeviceFilter DeviceDetails="Details"/></Query></JMF>' http://localhost:8013/ 2>&1`],
  ];

  for (const [label, cmd] of commands) {
    console.log(`\n=== ${label} ===`);
    console.log(`> ${cmd.substring(0, 120)}`);
    const result = await execCmd(conn, cmd, 15000);
    console.log(result.trim());
  }

  conn.end();
  console.log('\n\n=== Phase 4 Complete ===');
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
