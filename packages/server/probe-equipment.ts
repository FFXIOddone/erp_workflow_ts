/**
 * Deeper Equipment Probing Script
 * 
 * Run: cd packages/server && npx tsx probe-equipment.ts
 */

// Equipment IPs
const EQUIPMENT = {
  thrive: ['192.168.254.53', '192.168.254.77'],
  fiery: ['192.168.254.57'],
  zund: ['192.168.254.38', '192.168.254.28'],
};

/**
 * Probe HTTP endpoints in depth
 */
async function probeHttpDeep(host: string, port: number, name: string): Promise<void> {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`🔍 Deep probe: ${name} at ${host}:${port}`);
  console.log('═'.repeat(60));
  
  const endpoints = [
    '/',
    '/jobs',
    '/api',
    '/api/jobs',
    '/api/v1/jobs',
    '/api/v2/jobs',
    '/queue',
    '/queues',
    '/job',
    '/print',
    '/prints',
    '/orders',
    '/output',
    '/rip',
    '/thrive',
    '/onyx',
    '/system',
    '/info',
    '/version',
    '/health',
  ];
  
  for (const endpoint of endpoints) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`http://${host}:${port}${endpoint}`, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json, text/html, */*',
        },
      });
      clearTimeout(timeout);
      
      if (response.status === 200) {
        console.log(`\n✅ ${endpoint} → ${response.status}`);
        
        const contentType = response.headers.get('content-type') || '';
        console.log(`   Content-Type: ${contentType}`);
        
        const text = await response.text();
        
        // Log size
        console.log(`   Response size: ${text.length} bytes`);
        
        if (contentType.includes('json')) {
          try {
            const data = JSON.parse(text);
            console.log(`   JSON Structure:`);
            if (Array.isArray(data)) {
              console.log(`     - Array with ${data.length} items`);
              if (data.length > 0) {
                console.log(`     - First item keys: ${Object.keys(data[0]).join(', ')}`);
                console.log(`     - Sample item:`, JSON.stringify(data[0], null, 2).substring(0, 500));
              }
            } else if (typeof data === 'object') {
              console.log(`     - Object keys: ${Object.keys(data).join(', ')}`);
              console.log(`     - Data:`, JSON.stringify(data, null, 2).substring(0, 1000));
            }
          } catch (e) {
            console.log(`   Raw text (first 500 chars): ${text.substring(0, 500)}`);
          }
        } else if (contentType.includes('html')) {
          // Look for interesting info in HTML
          const title = text.match(/<title>(.*?)<\/title>/i);
          if (title) console.log(`   Page title: ${title[1]}`);
          
          // Look for links
          const links = text.match(/href="([^"]+)"/g);
          if (links && links.length > 0) {
            console.log(`   Links found: ${links.slice(0, 10).join(', ')}`);
          }
        } else {
          console.log(`   Raw text (first 300 chars): ${text.substring(0, 300)}`);
        }
      } else if (response.status !== 404) {
        console.log(`⚠️  ${endpoint} → ${response.status} ${response.statusText}`);
      }
    } catch (error: any) {
      if (error.name !== 'AbortError' && error.code !== 'UND_ERR_CONNECT_TIMEOUT') {
        // console.log(`❌ ${endpoint}: ${error.message}`);
      }
    }
  }
}

/**
 * Try extended port scan
 */
async function extendedPortScan(host: string, name: string): Promise<void> {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📡 Extended port scan: ${name} at ${host}`);
  console.log('═'.repeat(60));
  
  const net = await import('net');
  
  // More extensive port list
  const ports = [
    // MongoDB variations
    27017, 27018, 27019, 28017, 37017,
    // SQL Server
    1433, 1434,
    // MySQL
    3306, 3307,
    // PostgreSQL
    5432, 5433,
    // HTTP/HTTPS
    80, 443, 8080, 8000, 8443, 8888, 9000, 9001, 9090,
    // Print services
    631, 9100, 9101, 9102, 515,
    // Common app ports
    3000, 4000, 5000, 5001, 6000, 7000,
    // Fiery specific
    8021, 8081, 8181, 8281, 8681,
    // SMB/Windows file sharing
    445, 139,
    // RDP
    3389,
    // SSH
    22,
  ];
  
  const openPorts: number[] = [];
  
  for (const port of ports) {
    const isOpen = await new Promise<boolean>((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(1500);
      
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      
      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
      
      socket.on('error', () => {
        socket.destroy();
        resolve(false);
      });
      
      socket.connect(port, host);
    });
    
    if (isOpen) {
      openPorts.push(port);
      console.log(`  ✅ Port ${port} is OPEN`);
    }
  }
  
  console.log(`\nOpen ports: ${openPorts.join(', ') || 'none'}`);
  return;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('         Deep Equipment Probe');
  console.log('═══════════════════════════════════════════════════════════');
  
  // Probe Thrive HTTP endpoints deeply
  console.log('\n\n========== ONYX THRIVE ==========');
  for (const host of EQUIPMENT.thrive) {
    await probeHttpDeep(host, 80, 'Thrive');
    await probeHttpDeep(host, 8000, 'Thrive');
  }
  
  // Extended port scan on Fiery
  console.log('\n\n========== FIERY ==========');
  for (const host of EQUIPMENT.fiery) {
    await extendedPortScan(host, 'Fiery');
  }
  
  // Extended port scan on Zund
  console.log('\n\n========== ZUND ==========');
  for (const host of EQUIPMENT.zund) {
    await extendedPortScan(host, 'Zund');
  }
  
  console.log('\n\n✅ Deep probe complete!\n');
}

main().catch(console.error);
