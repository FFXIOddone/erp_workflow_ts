/**
 * Equipment Discovery Script
 * 
 * Probes network machines to find:
 * - MongoDB instances (Onyx Thrive)
 * - Database connections (Fiery, Zund)
 * 
 * Run: cd packages/server && npx tsx discover-equipment.ts
 */

import { MongoClient } from 'mongodb';
import net from 'net';

// Equipment IPs
const EQUIPMENT = {
  thrive: ['192.168.254.53', '192.168.254.77'],
  fiery: ['192.168.254.57'],
  zund: ['192.168.254.38', '192.168.254.28'],
};

// Common ports to scan
const PORTS = {
  mongodb: [27017, 27018, 27019, 28017], // MongoDB default and common alternatives
  mssql: [1433, 1434],                    // SQL Server
  postgres: [5432],                       // PostgreSQL
  mysql: [3306],                          // MySQL
  http: [80, 8080, 8000, 443],           // REST APIs
  fiery: [631, 9100, 5000, 8888],        // Print/Fiery common ports
  sqlite: [], // SQLite is file-based, no port
};

/**
 * Check if a port is open on a host
 */
async function isPortOpen(host: string, port: number, timeout = 2000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeout);
    
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
}

/**
 * Scan common ports on a host
 */
async function scanPorts(host: string, name: string): Promise<number[]> {
  console.log(`\n🔍 Scanning ${name} (${host})...`);
  
  const allPorts = [
    ...PORTS.mongodb,
    ...PORTS.mssql,
    ...PORTS.postgres,
    ...PORTS.mysql,
    ...PORTS.http,
    ...PORTS.fiery,
  ];
  
  const openPorts: number[] = [];
  
  for (const port of allPorts) {
    const isOpen = await isPortOpen(host, port);
    if (isOpen) {
      openPorts.push(port);
      console.log(`  ✅ Port ${port} is OPEN`);
    }
  }
  
  if (openPorts.length === 0) {
    console.log(`  ❌ No common ports found open`);
  }
  
  return openPorts;
}

/**
 * Try to connect to MongoDB and list databases
 */
async function probeMongoDb(host: string, port: number): Promise<string[] | null> {
  const uri = `mongodb://${host}:${port}`;
  console.log(`\n🍃 Probing MongoDB at ${uri}...`);
  
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
  });
  
  try {
    await client.connect();
    const admin = client.db().admin();
    const result = await admin.listDatabases();
    const dbNames = result.databases.map((db: any) => db.name);
    console.log(`  ✅ Connected! Databases found: ${dbNames.join(', ')}`);
    
    // For each database, list collections
    for (const dbName of dbNames) {
      if (['admin', 'local', 'config'].includes(dbName)) continue;
      
      const db = client.db(dbName);
      const collections = await db.listCollections().toArray();
      console.log(`  📂 ${dbName}: ${collections.map(c => c.name).join(', ')}`);
      
      // Sample a few documents from promising collections
      for (const coll of collections) {
        if (coll.name.toLowerCase().includes('job') || 
            coll.name.toLowerCase().includes('print') ||
            coll.name.toLowerCase().includes('order')) {
          const sample = await db.collection(coll.name).findOne();
          if (sample) {
            console.log(`    📄 Sample from ${coll.name}:`, Object.keys(sample).slice(0, 10));
          }
        }
      }
    }
    
    await client.close();
    return dbNames;
  } catch (error: any) {
    console.log(`  ❌ MongoDB connection failed: ${error.message}`);
    await client.close().catch(() => {});
    return null;
  }
}

/**
 * Try HTTP endpoints (for REST APIs)
 */
async function probeHttp(host: string, port: number): Promise<void> {
  console.log(`\n🌐 Probing HTTP at ${host}:${port}...`);
  
  const endpoints = ['/', '/api', '/v1', '/status', '/jobs', '/api/v1/jobs'];
  
  for (const endpoint of endpoints) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      
      const response = await fetch(`http://${host}:${port}${endpoint}`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      
      console.log(`  📡 GET ${endpoint}: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('json')) {
          const data = await response.json();
          console.log(`    Response keys: ${Object.keys(data).slice(0, 5).join(', ')}`);
        }
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        // Only log if it's not a timeout
        // console.log(`  ❌ ${endpoint}: ${error.message}`);
      }
    }
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('         Equipment Discovery Script');
  console.log('═══════════════════════════════════════════════════════════');
  
  const results: Record<string, { host: string; openPorts: number[]; databases?: string[] }[]> = {
    thrive: [],
    fiery: [],
    zund: [],
  };
  
  // Scan Thrive machines (MongoDB expected)
  console.log('\n\n========== ONYX THRIVE (MongoDB) ==========');
  for (const host of EQUIPMENT.thrive) {
    const openPorts = await scanPorts(host, 'Thrive');
    const entry: any = { host, openPorts };
    
    // If MongoDB port is open, probe it
    for (const port of openPorts) {
      if (PORTS.mongodb.includes(port)) {
        const dbs = await probeMongoDb(host, port);
        if (dbs) {
          entry.databases = dbs;
          entry.mongoPort = port;
        }
      }
    }
    
    // Check HTTP ports
    for (const port of openPorts) {
      if (PORTS.http.includes(port)) {
        await probeHttp(host, port);
      }
    }
    
    results.thrive.push(entry);
  }
  
  // Scan Fiery machine
  console.log('\n\n========== FIERY ==========');
  for (const host of EQUIPMENT.fiery) {
    const openPorts = await scanPorts(host, 'Fiery');
    const entry: any = { host, openPorts };
    
    // Fiery often has REST API or web interface
    for (const port of openPorts) {
      if (PORTS.http.includes(port) || PORTS.fiery.includes(port)) {
        await probeHttp(host, port);
      }
    }
    
    results.fiery.push(entry);
  }
  
  // Scan Zund machines
  console.log('\n\n========== ZUND CUT CENTER ==========');
  for (const host of EQUIPMENT.zund) {
    const openPorts = await scanPorts(host, 'Zund');
    const entry: any = { host, openPorts };
    
    // Zund might use SQLite (file-based) or have a web interface
    for (const port of openPorts) {
      if (PORTS.http.includes(port)) {
        await probeHttp(host, port);
      }
      // Try MongoDB just in case
      if (PORTS.mongodb.includes(port)) {
        const dbs = await probeMongoDb(host, port);
        if (dbs) {
          entry.databases = dbs;
        }
      }
    }
    
    results.zund.push(entry);
  }
  
  // Summary
  console.log('\n\n═══════════════════════════════════════════════════════════');
  console.log('                      SUMMARY');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  console.log('THRIVE (MongoDB):');
  for (const r of results.thrive) {
    console.log(`  ${r.host}: ports ${r.openPorts.join(', ') || 'none'}`);
    if (r.databases) console.log(`    → Databases: ${r.databases.join(', ')}`);
  }
  
  console.log('\nFIERY:');
  for (const r of results.fiery) {
    console.log(`  ${r.host}: ports ${r.openPorts.join(', ') || 'none'}`);
  }
  
  console.log('\nZUND:');
  for (const r of results.zund) {
    console.log(`  ${r.host}: ports ${r.openPorts.join(', ') || 'none'}`);
  }
  
  console.log('\n✅ Discovery complete!\n');
}

main().catch(console.error);
