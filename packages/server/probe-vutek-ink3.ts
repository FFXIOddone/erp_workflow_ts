/**
 * VUTEk MySQL & Ink Data Probe — Phase 3
 * Directly query MySQL databases and explore /vutek for ink level data
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
  console.log(`\n=== VUTEk MySQL & Ink Probe — Phase 3 ===\n`);

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

  const commands: [string, string][] = [
    // MySQL database exploration
    ['MySQL: Show databases', `mysql -u root -e "SHOW DATABASES;" 2>&1`],
    ['MySQL: controldb tables', `mysql -u root controldb -e "SHOW TABLES;" 2>&1`],
    ['MySQL: printdb tables', `mysql -u root printdb -e "SHOW TABLES;" 2>&1`],
    
    // Search for ink-related tables in all databases
    ['MySQL: Find ink tables in controldb',
      `mysql -u root controldb -e "SHOW TABLES;" 2>&1 | grep -iE "ink|supply|level|color|consumable|material|tank|cartridge|fluid"`],
    ['MySQL: Find ink tables in printdb',
      `mysql -u root printdb -e "SHOW TABLES;" 2>&1 | grep -iE "ink|supply|level|color|consumable|material|tank|cartridge|fluid|status|counter|meter|usage"`],
    
    // Check InkVelocityVoltageOffsets backup SQL
    ['Ink backup SQL', `cat /home/vutek01/Backups/InkVelocityVoltageOffsets.sql 2>&1 | head -50`],
    
    // Try to describe ink-related tables (search all tables)
    ['MySQL: All controldb table names', `mysql -u root controldb -e "SHOW TABLES;" 2>&1`],
    
    // Explore /vutek structure
    ['VuTek data dir', `ls -la /vutek/ 2>&1`],
    ['VuTek bin dir', `ls -la /usr/vutek/bin/ 2>&1`],
    ['VuTek etc dir', `ls -la /usr/vutek/etc/ 2>&1`],
    ['VuTek config files', `find /usr/vutek/etc -type f 2>&1 | head -40`],
    
    // Check for VuServer status API/interface locally
    ['Check port 8013', `curl -s -m 3 http://localhost:8013/ 2>&1 | head -30`],
    ['Check port 8013 status', `curl -s -m 3 http://localhost:8013/status 2>&1 | head -30`],
    
    // Look for ink data in VUTEk app files
    ['VuTek RFID/ink files', `find /usr/vutek -maxdepth 3 \\( -iname "*rfid*" -o -iname "*ink*" -o -iname "*tank*" -o -iname "*supply*" -o -iname "*cartridge*" -o -iname "*fluid*" \\) 2>&1 | head -20`],

    // Check EFI Fleet Agent data  
    ['Fleet agent files', `ls -la /usr/local/bin/fleetagent/ 2>&1`],
    ['Fleet agent data', `ls -la /usr/share/fleetagent/ 2>&1`],
    ['Fleet agent DB', `file /usr/share/fleetagent/fleetagent.db 2>&1`],
    ['Fleet agent cron', `cat /etc/cron.d/efifleetmonitor 2>&1`],
    
    // Look at the Rangeley XML config
    ['Rangeley XML', `cat /usr/vutek/etc/ServiceList/Rangeley.xml 2>&1 | head -80`],
    
    // Check the RangeleyImageProcessor XML
    ['RangeleyImageProcessor XML', `cat /usr/vutek/etc/ServiceList/RangeleyImageProcessor.xml 2>&1 | head -80`],
    
    // CORBA naming service - list objects
    ['OmniNames', `ls -la /tmp/omni-* 2>/dev/null ; cat /var/log/omniorb4-nameserver.log 2>&1 | tail -30`],
    
    // Look for the RFID manager (saw it in logs)
    ['RFID files', `find /usr/vutek -name "*RFID*" -o -name "*rfid*" 2>&1 | head -20`],
    
    // Read recent vutekd log lines that might contain ink info
    ['VuTekD log - ink/rfid', `grep -i "rfid\\|ink\\|tank\\|supply\\|level\\|cartridge\\|fluid" /var/log/vutekd.log 2>&1 | tail -40`],
    
    // Check if vutek01 can access MySQL without password via sudo
    ['MySQL via sudo', `sudo mysql -e "SHOW DATABASES;" 2>&1`],
  ];

  for (const [label, cmd] of commands) {
    console.log(`\n=== ${label} ===`);
    console.log(`> ${cmd.substring(0, 120)}`);
    const result = await execCmd(conn, cmd);
    console.log(result.trim());
  }

  conn.end();
  console.log('\n\n=== Phase 3 Complete ===');
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
