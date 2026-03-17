/**
 * Probe VUTEk SSH access — try common credentials and explore filesystem
 */
// @ts-ignore -- install @types/ssh2 for proper typings
import { Client } from 'ssh2';

const HOST = '192.168.254.60';
const PORT = 22;

const CREDS = [
  { username: 'root', password: 'vutek' },
  { username: 'root', password: 'efi' },
  { username: 'root', password: 'EFI' },
  { username: 'root', password: 'root' },
  { username: 'root', password: 'admin' },
  { username: 'root', password: 'password' },
  { username: 'vutek', password: 'vutek' },
  { username: 'vutek', password: 'efi' },
  { username: 'efi', password: 'efi' },
  { username: 'efi', password: 'vutek' },
  { username: 'operator', password: 'operator' },
  { username: 'service', password: 'service' },
  { username: 'service', password: 'vutek' },
  { username: 'admin', password: 'admin' },
  { username: 'user', password: 'user' },
  { username: 'root', password: '' },
  { username: '', password: '' },
  { username: 'root', password: 'VUTEk' },
  { username: 'root', password: 'EFI2014' },
  { username: 'root', password: 'gs3250' },
  { username: 'root', password: 'GS3250' },
  { username: 'inkjet', password: 'inkjet' },
  { username: 'root', password: 'inkjet' },
  { username: 'ubuntu', password: 'ubuntu' },
];

function tryLogin(username: string, password: string): Promise<Client | null> {
  return new Promise((resolve) => {
    const conn = new Client();
    const timer = setTimeout(() => {
      conn.destroy();
      resolve(null);
    }, 5000);

    conn.on('ready', () => {
      clearTimeout(timer);
      resolve(conn);
    });
    conn.on('error', () => {
      clearTimeout(timer);
      resolve(null);
    });

    conn.connect({
      host: HOST,
      port: PORT,
      username,
      password,
      readyTimeout: 5000,
      algorithms: {
        kex: ['diffie-hellman-group-exchange-sha256', 'diffie-hellman-group-exchange-sha1', 'diffie-hellman-group14-sha1', 'diffie-hellman-group1-sha1'],
        serverHostKey: ['ssh-rsa', 'ssh-dss', 'ecdsa-sha2-nistp256'],
        cipher: ['aes128-ctr', 'aes192-ctr', 'aes256-ctr', 'aes128-cbc', 'aes192-cbc', 'aes256-cbc', '3des-cbc'],
        hmac: ['hmac-sha2-256', 'hmac-sha1', 'hmac-md5'],
      },
    });
  });
}

function execCmd(conn: Client, cmd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err: Error | undefined, stream: any) => {
      if (err) { reject(err); return; }
      let out = '';
      let errOut = '';
      stream.on('data', (data: Buffer) => { out += data.toString(); });
      stream.stderr.on('data', (data: Buffer) => { errOut += data.toString(); });
      stream.on('close', () => {
        resolve(out || errOut || '(no output)');
      });
    });
  });
}

async function main() {
  console.log(`\n=== VUTEk SSH Probe — ${HOST}:${PORT} ===\n`);

  // Try each credential
  for (const { username, password } of CREDS) {
    const display = password ? `${username}:${password}` : `${username}:(empty)`;
    process.stdout.write(`  Trying ${display.padEnd(30)}`);
    const conn = await tryLogin(username, password);
    if (conn) {
      console.log('✅ SUCCESS!');
      console.log(`\n=== CONNECTED as ${username} ===\n`);

      // Run discovery commands
      const commands = [
        'whoami',
        'uname -a',
        'hostname',
        'cat /etc/issue',
        'cat /etc/os-release 2>/dev/null || cat /etc/lsb-release 2>/dev/null',
        'df -h',
        'ls -la /',
        'ls -la /home/',
        'ls -la /opt/ 2>/dev/null',
        'ls -la /usr/local/ 2>/dev/null',
        'find / -maxdepth 3 -name "*ink*" -o -name "*status*" -o -name "*level*" 2>/dev/null | head -50',
        'find / -maxdepth 3 -name "*.xml" -o -name "*.json" 2>/dev/null | head -50',
        'find / -maxdepth 2 -name "*vutek*" -o -name "*efi*" -o -name "*printer*" 2>/dev/null | head -50',
        'ps aux | head -40',
        'netstat -tlnp 2>/dev/null || ss -tlnp 2>/dev/null',
      ];

      for (const cmd of commands) {
        console.log(`\n--- ${cmd} ---`);
        try {
          const result = await execCmd(conn, cmd);
          console.log(result.trim());
        } catch (e: any) {
          console.log(`ERROR: ${e.message}`);
        }
      }

      conn.end();
      return;
    } else {
      console.log('❌');
    }
  }

  console.log('\n❌ No credentials worked. You may need to check the VUTEk service documentation or ask EFI support for the SSH credentials.');
}

main().catch(console.error);
