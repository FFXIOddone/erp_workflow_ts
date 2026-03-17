/**
 * SNMP Deep Discovery Script
 * Walks the full printer MIB on each SNMP device to discover ALL available data points.
 */
const snmp = require('net-snmp');

const PRINTERS = [
  { name: 'HP Latex 570 JetDirect', ip: '192.168.254.40', community: 'public' },
  { name: 'HP Latex 800W', ip: '192.168.254.42', community: 'public' },
];

// All standard printer MIB branches worth exploring
const MIB_BRANCHES = {
  // System MIB (1.3.6.1.2.1.1)
  'system': '1.3.6.1.2.1.1',
  // Interfaces MIB
  'interfaces': '1.3.6.1.2.1.2',
  // Host Resources (hrDevice, hrPrinter, hrStorage, hrProcessor)
  'hrDevice': '1.3.6.1.2.1.25.3',
  'hrStorage': '1.3.6.1.2.1.25.2',
  'hrProcessor': '1.3.6.1.2.1.25.3.3',
  // Printer MIB (RFC 3805) - THE GOLDMINE
  'prtGeneral': '1.3.6.1.2.1.43.5',        // General printer config
  'prtCover': '1.3.6.1.2.1.43.6',          // Cover status
  'prtLocalization': '1.3.6.1.2.1.43.7',   // Localization
  'prtInput': '1.3.6.1.2.1.43.8',          // Input trays/media
  'prtOutput': '1.3.6.1.2.1.43.9',         // Output bins
  'prtMarker': '1.3.6.1.2.1.43.10',        // Print heads / marker units
  'prtMarkerSupplies': '1.3.6.1.2.1.43.11',// Ink/toner supplies
  'prtMarkerColorant': '1.3.6.1.2.1.43.12',// Color definitions
  'prtMediaPath': '1.3.6.1.2.1.43.13',     // Media path
  'prtChannel': '1.3.6.1.2.1.43.14',       // Print channels
  'prtInterpreter': '1.3.6.1.2.1.43.15',   // Language interpreters (PCL, PS, etc)
  'prtConsoleDisplay': '1.3.6.1.2.1.43.16',// Console/LCD display
  'prtConsoleLight': '1.3.6.1.2.1.43.17',  // Console lights/LEDs
  'prtAlert': '1.3.6.1.2.1.43.18',         // Alert table
  // Finishing MIB (RFC 3806)
  'finDevice': '1.3.6.1.2.1.43.30',        // Finishing devices
  // Job Monitoring MIB (RFC 2707)
  'jmGeneral': '1.3.6.1.4.1.2699.1.1.1',   // Job monitoring general
  'jmJobID': '1.3.6.1.4.1.2699.1.1.2',     // Job ID table
  'jmJob': '1.3.6.1.4.1.2699.1.1.3',       // Job table
  'jmAttribute': '1.3.6.1.4.1.2699.1.1.4', // Job attribute table
  // HP Private MIB
  'hpPrivate': '1.3.6.1.4.1.11.2.3.9',     // HP-specific extensions
};

function walkBranch(ip, community, oid, timeout = 8000) {
  return new Promise((resolve) => {
    const session = snmp.createSession(ip, community, {
      timeout,
      retries: 1,
      version: snmp.Version2c,
    });
    const results = [];
    session.subtree(
      oid,
      50,
      (varbinds) => {
        for (const vb of varbinds) {
          if (!snmp.isVarbindError(vb)) {
            let val;
            if (Buffer.isBuffer(vb.value)) {
              val = vb.value.toString('utf8').replace(/\0/g, '').trim();
              if (!val || /[\x00-\x1f]/.test(val)) val = '0x' + vb.value.toString('hex');
            } else {
              val = vb.value;
            }
            results.push({ oid: vb.oid, type: vb.type, value: val });
          }
        }
      },
      (error) => {
        session.close();
        resolve(results);
      }
    );
  });
}

(async () => {
  for (const printer of PRINTERS) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`PRINTER: ${printer.name} (${printer.ip})`);
    console.log('='.repeat(80));

    let totalOids = 0;
    for (const [name, oid] of Object.entries(MIB_BRANCHES)) {
      const results = await walkBranch(printer.ip, printer.community, oid);
      if (results.length > 0) {
        console.log(`\n--- ${name} (${oid}) : ${results.length} OIDs ---`);
        for (const r of results) {
          console.log(`  ${r.oid} = ${JSON.stringify(r.value).substring(0, 120)}`);
          totalOids++;
        }
      }
    }
    console.log(`\nTOTAL OIDs discovered: ${totalOids}`);
  }
})();
