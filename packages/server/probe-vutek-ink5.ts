/**
 * VUTEk Ink Data Query — Phase 5
 * Targeted queries for MySQL ink data, RFID scripts, Fleet Agent SQLite
 * Writes all output to a file on the VuTek then reads it back to avoid truncation
 */
import { Client } from 'ssh2';

const HOST = '192.168.254.60';
const USERNAME = 'vutek01';
const PASSWORD = 'vutek01';
const REMOTE_OUTPUT = '/tmp/ink-probe-output.txt';

function execCmd(conn: Client, cmd: string, timeoutMs = 30000): Promise<string> {
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
  const conn = new Client();
  await new Promise<void>((resolve, reject) => {
    conn.on('ready', () => resolve());
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

  console.log('Connected. Running queries and writing to remote file...\n');

  // Build a script that runs everything and writes to a file
  const remoteScript = `
#!/bin/bash
exec > ${REMOTE_OUTPUT} 2>&1

echo "========== DATABASES =========="
mysql -u vutek01 -pvutek01 -e "SHOW DATABASES;" 2>/dev/null

echo ""
echo "========== CONTROLDB TABLES =========="
mysql -u vutek01 -pvutek01 controldb -e "SHOW TABLES;" 2>/dev/null

echo ""
echo "========== PRINTDB TABLES =========="
mysql -u vutek01 -pvutek01 printdb -e "SHOW TABLES;" 2>/dev/null

echo ""
echo "========== INK-RELATED TABLES =========="
mysql -u vutek01 -pvutek01 controldb -e "SHOW TABLES;" 2>/dev/null | grep -iE "ink|rfid|supply|level|color|consumable|material|tank|cartridge|fluid|counter|meter|usage|status|purge|print"

echo ""
echo "========== DESCRIBE InkVelocityVoltageOffsets =========="
mysql -u vutek01 -pvutek01 controldb -e "DESCRIBE InkVelocityVoltageOffsets;" 2>/dev/null

echo ""
echo "========== InkVelocityVoltageOffsets DATA =========="
mysql -u vutek01 -pvutek01 controldb -e "SELECT * FROM InkVelocityVoltageOffsets LIMIT 20;" 2>/dev/null

echo ""
echo "========== ALL CONTROLDB TABLES WITH ROW COUNTS =========="
for t in $(mysql -u vutek01 -pvutek01 controldb -N -e "SHOW TABLES;" 2>/dev/null); do
  cnt=$(mysql -u vutek01 -pvutek01 controldb -N -e "SELECT COUNT(*) FROM \\\`\$t\\\`;" 2>/dev/null)
  echo "  \$t: \$cnt rows"
done

echo ""
echo "========== ALL PRINTDB TABLES WITH ROW COUNTS =========="
for t in $(mysql -u vutek01 -pvutek01 printdb -N -e "SHOW TABLES;" 2>/dev/null); do
  cnt=$(mysql -u vutek01 -pvutek01 printdb -N -e "SELECT COUNT(*) FROM \\\`\$t\\\`;" 2>/dev/null)
  echo "  \$t: \$cnt rows"
done

echo ""
echo "========== SEARCH FOR INK/LEVEL COLUMNS IN ALL CONTROLDB TABLES =========="
for t in $(mysql -u vutek01 -pvutek01 controldb -N -e "SHOW TABLES;" 2>/dev/null); do
  cols=$(mysql -u vutek01 -pvutek01 controldb -N -e "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='controldb' AND TABLE_NAME='\$t' AND (COLUMN_NAME LIKE '%ink%' OR COLUMN_NAME LIKE '%level%' OR COLUMN_NAME LIKE '%volume%' OR COLUMN_NAME LIKE '%rfid%' OR COLUMN_NAME LIKE '%supply%' OR COLUMN_NAME LIKE '%color%' OR COLUMN_NAME LIKE '%remain%' OR COLUMN_NAME LIKE '%quantity%');" 2>/dev/null)
  if [ -n "\$cols" ]; then
    echo "  TABLE: \$t -> \$cols"
  fi
done

echo ""
echo "========== SEARCH FOR INK/LEVEL COLUMNS IN ALL PRINTDB TABLES =========="
for t in $(mysql -u vutek01 -pvutek01 printdb -N -e "SHOW TABLES;" 2>/dev/null); do
  cols=$(mysql -u vutek01 -pvutek01 printdb -N -e "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='printdb' AND TABLE_NAME='\$t' AND (COLUMN_NAME LIKE '%ink%' OR COLUMN_NAME LIKE '%level%' OR COLUMN_NAME LIKE '%volume%' OR COLUMN_NAME LIKE '%rfid%' OR COLUMN_NAME LIKE '%supply%' OR COLUMN_NAME LIKE '%color%' OR COLUMN_NAME LIKE '%remain%' OR COLUMN_NAME LIKE '%quantity%');" 2>/dev/null)
  if [ -n "\$cols" ]; then
    echo "  TABLE: \$t -> \$cols"
  fi
done

echo ""
echo "========== RFIDSCAN.PY =========="
cat /usr/vutek/bin/python/RFIDScan.py 2>/dev/null || echo "(not found)"

echo ""
echo "========== RFID_IDL.PY (first 80 lines) =========="
head -80 /usr/vutek/bin/python/RFID_idl.py 2>/dev/null || echo "(not found)"

echo ""
echo "========== FLEET AGENT SQLITE TABLES =========="
sudo sqlite3 /usr/share/fleetagent/fleetagent.db ".tables" 2>/dev/null || echo "(sqlite3 not available)"

echo ""
echo "========== FLEET AGENT SQLITE SCHEMA =========="
sudo sqlite3 /usr/share/fleetagent/fleetagent.db ".schema" 2>/dev/null | head -100

echo ""
echo "========== FLEET AGENT SQLITE DATA DUMP =========="
for tbl in $(sudo sqlite3 /usr/share/fleetagent/fleetagent.db ".tables" 2>/dev/null); do
  echo "--- TABLE: \$tbl ---"
  sudo sqlite3 -header -column /usr/share/fleetagent/fleetagent.db "SELECT * FROM \$tbl LIMIT 10;" 2>/dev/null
  echo ""
done

echo ""
echo "========== INKPATHGRAPH XML =========="
cat /usr/vutek/etc/ServiceList/RangeleyInkPathGraphs.xml 2>/dev/null | head -80

echo ""
echo "========== RFID LOG ENTRIES WITH DATA =========="
grep -i "rfid" /var/log/vutekd.log 2>/dev/null | grep -v "No Tag" | tail -40

echo ""
echo "========== INK LEVEL/VOLUME LOG ENTRIES =========="
grep -iE "ink.*(level|volume|remain|percent|quantity|usage)" /var/log/vutekd.log 2>/dev/null | tail -20

echo ""
echo "========== CORBA NAMESERVER - INK OBJECTS =========="
ls -la /var/vutek/omninames-* 2>/dev/null

echo ""
echo "========== VUTEK BIN SCRIPTS =========="
ls /usr/vutek/bin/ 2>/dev/null | grep -iE "ink|rfid|level|monitor|status"

echo ""
echo "========== VUTEK ETC CONFIG FILES =========="
ls /usr/vutek/etc/ 2>/dev/null

echo ""
echo "========== END OF PROBE =========="
`;

  // Write script to remote, execute it, then read output
  await execCmd(conn, `cat > /tmp/ink-probe.sh << 'ENDSCRIPT'\n${remoteScript}\nENDSCRIPT\nchmod +x /tmp/ink-probe.sh`);
  
  console.log('Executing remote script...');
  await execCmd(conn, 'bash /tmp/ink-probe.sh', 60000);
  
  console.log('Reading results...\n');
  const output = await execCmd(conn, `cat ${REMOTE_OUTPUT}`, 30000);
  
  // Print sections one at a time for readability
  const sections = output.split(/={10,}/);
  for (const section of sections) {
    const trimmed = section.trim();
    if (trimmed) {
      console.log('==========');
      console.log(trimmed);
      console.log('');
    }
  }

  // Cleanup
  await execCmd(conn, `rm -f /tmp/ink-probe.sh ${REMOTE_OUTPUT}`);
  
  conn.end();
  console.log('\n=== Phase 5 Complete ===');
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
