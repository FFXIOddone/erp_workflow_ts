process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const https = require('https');

function fetch(path) {
  return new Promise((resolve, reject) => {
    https.get({ hostname: '192.168.254.42', port: 443, path, timeout: 10000, rejectUnauthorized: false }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch { resolve(body.substring(0,500)); }
      });
    }).on('error', reject);
  });
}

(async () => {
  try {
    const id = await fetch('/LFPWebServices/PI/Identification.json');
    console.log('=== IDENTITY ===');
    const ident = id?.Identification;
    console.log('Product:', ident?.ProductName);
    console.log('Model:', ident?.ProductNumber);
    console.log('Serial:', ident?.SerialNumber);
    console.log('Firmware:', ident?.FirmwareVersion);

    const status = await fetch('/LFPWebServices/PI/DeviceStatus.json');
    console.log('\n=== STATUS ===');
    const ds = status?.DeviceStatus;
    console.log('State:', ds?.DeviceState);
    console.log('Reason:', ds?.DeviceStateReason);

    const ink = await fetch('/LFPWebServices/PI/InkSystem.json');
    console.log('\n=== INK LEVELS ===');
    const cartridges = ink?.InkSystem?.InkCartridges?.InkCartridge || [];
    for (const c of (Array.isArray(cartridges) ? cartridges : [cartridges])) {
      console.log('  ' + (c?.Color || '?') + ': ' + (c?.PercentRemaining || '?') + '%  SN:' + (c?.SerialNumber || '-') + '  Exp:' + (c?.ExpirationDate || '-'));
    }

    const ph = await fetch('/LFPWebServices/PI/PrintheadsStatus.json');
    console.log('\n=== PRINTHEADS ===');
    const heads = ph?.PrintheadsStatus?.Printheads?.Printhead || [];
    for (const h of (Array.isArray(heads) ? heads : [heads])) {
      console.log('  Slot ' + (h?.Position || '?') + ': ' + (h?.Status || '?') + ' | Colors: ' + (h?.Color || '-') + ' | Warranty: ' + (h?.WarrantyStatus || '-'));
    }

    const maint = await fetch('/LFPWebServices/PI/PrinterMaintenance.json');
    console.log('\n=== MAINTENANCE ===');
    console.log(JSON.stringify(maint, null, 2).substring(0, 1200));

    const media = await fetch('/LFPWebServices/PI/MediaSystem.json?units=imperial');
    console.log('\n=== MEDIA ===');
    console.log(JSON.stringify(media, null, 2).substring(0, 800));

    const alerts = await fetch('/LFPWebServices/PI/Alerts.json/ActiveAlerts');
    console.log('\n=== ACTIVE ALERTS ===');
    console.log(JSON.stringify(alerts, null, 2).substring(0, 600));

    // Also discover the job queue UUID
    const disc = await fetch('/LFPWebServices/PI/Discovery.json');
    const queues = disc?.Discovery?.LFP?.JobQueues?.JobQueue;
    if (queues) {
      const qList = Array.isArray(queues) ? queues : [queues];
      for (const q of qList) {
        console.log('\n=== JOB QUEUE: ' + q.UUID + ' ===');
        try {
          const jobs = await fetch('/LFPWebServices/PI/JQ/JobQueue/' + q.UUID + '/jobs/all');
          const jl = jobs?.JobList?.Job || [];
          const jobArr = Array.isArray(jl) ? jl : [jl];
          console.log('Total jobs:', jobArr.length);
          for (const j of jobArr.slice(0, 5)) {
            console.log('  ' + (j?.Name || '?') + ' | Status: ' + (j?.Status || '?') + ' | Created: ' + (j?.CreationDateTime || '-'));
          }
        } catch (e) { console.log('Queue error:', e.message); }
      }
    }
  } catch (e) {
    console.error('Fatal error:', e.message);
  }
})();
