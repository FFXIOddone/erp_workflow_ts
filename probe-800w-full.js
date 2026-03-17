process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const https = require('https');

function fetch(path) {
  return new Promise((resolve, reject) => {
    https.get({ hostname: '192.168.254.42', port: 443, path, timeout: 10000, rejectUnauthorized: false }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch { resolve(body); }
      });
    }).on('error', reject);
  });
}

(async () => {
  // Dump all the raw data from the major endpoints so we can see what fields exist
  const endpoints = [
    '/LFPWebServices/PI/Identification.json',
    '/LFPWebServices/PI/DeviceStatus.json',
    '/LFPWebServices/PI/InkSystem.json',
    '/LFPWebServices/PI/PrintheadsStatus.json',
    '/LFPWebServices/PI/Discovery.json',
    '/LFPWebServices/PI/Usage.json',
    '/LFPWebServices/PI/SubstratePresets.json',
    '/LFPWebServices/PI/CuringSystem.json',
    '/LFPWebServices/PI/PrintingSystem.json',
    '/LFPWebServices/PI/Counters.json',
    '/DevMgmt/ProductUsageDyn.json',
    '/DevMgmt/ProductUsageDyn.xml',
  ];

  for (const ep of endpoints) {
    console.log('\n========== ' + ep + ' ==========');
    try {
      const data = await fetch(ep);
      if (typeof data === 'string') {
        console.log(data.substring(0, 2000));
      } else {
        console.log(JSON.stringify(data, null, 2).substring(0, 3000));
      }
    } catch (e) {
      console.log('ERROR:', e.message);
    }
  }
})();
