/**
 * VUTEk Ink Data — Phase 6
 * Query specific ink-related MySQL tables to find usable ink level/usage data
 */
import { Client } from 'ssh2';

const HOST = '192.168.254.60';
const USERNAME = 'vutek01';
const PASSWORD = 'vutek01';
const REMOTE_OUTPUT = '/tmp/ink-probe6-output.txt';

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

  console.log('Connected. Querying ink tables...\n');

  const remoteScript = `
#!/bin/bash
exec > ${REMOTE_OUTPUT} 2>&1

echo "========== DESCRIBE InkBagHistory =========="
mysql -u vutek01 -pvutek01 controldb -e "DESCRIBE InkBagHistory;" 2>/dev/null

echo ""
echo "========== InkBagHistory RECENT =========="
mysql -u vutek01 -pvutek01 controldb -e "SELECT * FROM InkBagHistory ORDER BY id DESC LIMIT 30;" 2>/dev/null

echo ""
echo "========== DESCRIBE EnabledColors =========="
mysql -u vutek01 -pvutek01 controldb -e "DESCRIBE EnabledColors;" 2>/dev/null

echo ""
echo "========== EnabledColors DATA =========="
mysql -u vutek01 -pvutek01 controldb -e "SELECT * FROM EnabledColors;" 2>/dev/null

echo ""
echo "========== DESCRIBE CouplerWeights =========="
mysql -u vutek01 -pvutek01 controldb -e "DESCRIBE CouplerWeights;" 2>/dev/null

echo ""
echo "========== CouplerWeights DATA =========="
mysql -u vutek01 -pvutek01 controldb -e "SELECT * FROM CouplerWeights;" 2>/dev/null

echo ""
echo "========== DESCRIBE Counters =========="
mysql -u vutek01 -pvutek01 controldb -e "DESCRIBE Counters;" 2>/dev/null

echo ""
echo "========== Counters DATA =========="
mysql -u vutek01 -pvutek01 controldb -e "SELECT * FROM Counters;" 2>/dev/null

echo ""
echo "========== DESCRIBE StatusData =========="
mysql -u vutek01 -pvutek01 controldb -e "DESCRIBE StatusData;" 2>/dev/null

echo ""
echo "========== StatusData RECENT (last 20) =========="
mysql -u vutek01 -pvutek01 controldb -e "SELECT * FROM StatusData ORDER BY id DESC LIMIT 20;" 2>/dev/null

echo ""
echo "========== StatusData INK-RELATED =========="
mysql -u vutek01 -pvutek01 controldb -e "SELECT * FROM StatusData WHERE Name LIKE '%ink%' OR Name LIKE '%level%' OR Name LIKE '%supply%' OR Name LIKE '%rfid%' OR Name LIKE '%volume%' OR Name LIKE '%remain%' LIMIT 30;" 2>/dev/null

echo ""
echo "========== DESCRIBE Status =========="
mysql -u vutek01 -pvutek01 controldb -e "DESCRIBE Status;" 2>/dev/null

echo ""
echo "========== Status RECENT =========="
mysql -u vutek01 -pvutek01 controldb -e "SELECT * FROM Status ORDER BY id DESC LIMIT 10;" 2>/dev/null

echo ""  
echo "========== DESCRIBE Dataline =========="
mysql -u vutek01 -pvutek01 printdb -e "DESCRIBE Dataline;" 2>/dev/null

echo ""
echo "========== Dataline DATA =========="
mysql -u vutek01 -pvutek01 printdb -e "SELECT * FROM Dataline;" 2>/dev/null

echo ""
echo "========== DESCRIBE InkUsageHistory =========="
mysql -u vutek01 -pvutek01 printdb -e "DESCRIBE InkUsageHistory;" 2>/dev/null

echo ""
echo "========== InkUsageHistory RECENT =========="
mysql -u vutek01 -pvutek01 printdb -e "SELECT * FROM InkUsageHistory ORDER BY ID DESC LIMIT 10;" 2>/dev/null

echo ""
echo "========== DESCRIBE CompletePrints =========="
mysql -u vutek01 -pvutek01 printdb -e "DESCRIBE CompletePrints;" 2>/dev/null

echo ""
echo "========== CompletePrints RECENT =========="
mysql -u vutek01 -pvutek01 printdb -e "SELECT uid, Name, PrintStart, PrintFinish, SqFeet, SqFeetHour, PercentComplete, PrintResult, ColorMode, CostInk FROM CompletePrints ORDER BY uid DESC LIMIT 10;" 2>/dev/null

echo ""
echo "========== DESCRIBE InkPumpHistory =========="
mysql -u vutek01 -pvutek01 controldb -e "DESCRIBE InkPumpHistory;" 2>/dev/null

echo ""
echo "========== DESCRIBE StatusMessages =========="
mysql -u vutek01 -pvutek01 controldb -e "DESCRIBE StatusMessages;" 2>/dev/null

echo ""
echo "========== StatusMessages INK-RELATED =========="
mysql -u vutek01 -pvutek01 controldb -e "SELECT * FROM StatusMessages WHERE Message LIKE '%ink%' OR Message LIKE '%level%' OR Message LIKE '%supply%' OR Message LIKE '%rfid%' OR Message LIKE '%volume%';" 2>/dev/null

echo ""
echo "========== JDFDB TABLES =========="
mysql -u vutek01 -pvutek01 jdfdb -e "SHOW TABLES;" 2>/dev/null

echo ""
echo "========== JDFDB TABLE ROW COUNTS =========="
for t in $(mysql -u vutek01 -pvutek01 jdfdb -N -e "SHOW TABLES;" 2>/dev/null); do
  cnt=$(mysql -u vutek01 -pvutek01 jdfdb -N -e "SELECT COUNT(*) FROM \\\`\$t\\\`;" 2>/dev/null)
  echo "  \$t: \$cnt rows"
done

echo ""
echo "========== TOTAL INK USAGE PER COLOR (SUM) =========="
mysql -u vutek01 -pvutek01 printdb -e "SELECT 
  SUM(Cyan) as TotalCyan, 
  SUM(Magenta) as TotalMagenta, 
  SUM(Yellow) as TotalYellow, 
  SUM(Black) as TotalBlack, 
  SUM(White) as TotalWhite, 
  SUM(LightCyan) as TotalLightCyan, 
  SUM(LightMagenta) as TotalLightMagenta, 
  COUNT(*) as TotalJobs
FROM InkUsageHistory;" 2>/dev/null

echo ""
echo "========== TODAY'S INK USAGE =========="
mysql -u vutek01 -pvutek01 printdb -e "SELECT 
  cp.Name, cp.PrintStart, cp.PrintFinish, cp.SqFeet,
  iu.Cyan, iu.Magenta, iu.Yellow, iu.Black, iu.White
FROM CompletePrints cp 
JOIN InkUsageHistory iu ON cp.uid = iu.ID 
WHERE DATE(cp.PrintFinish) = CURDATE()
ORDER BY cp.uid DESC LIMIT 10;" 2>/dev/null

echo ""
echo "========== END PHASE 6 =========="
`;

  await execCmd(conn, `cat > /tmp/ink-probe6.sh << 'ENDSCRIPT'\n${remoteScript}\nENDSCRIPT\nchmod +x /tmp/ink-probe6.sh`);
  await execCmd(conn, 'bash /tmp/ink-probe6.sh', 120000);
  
  const output = await execCmd(conn, `cat ${REMOTE_OUTPUT}`, 30000);
  console.log(output);

  await execCmd(conn, `rm -f /tmp/ink-probe6.sh ${REMOTE_OUTPUT}`);
  conn.end();
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
