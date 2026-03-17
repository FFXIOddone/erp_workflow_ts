# QuickBooks Data Agent (qb-agent)

Portable tool that exports QuickBooks data and sends it to the Wilde Signs ERP.

## What It Does

1. Connects to QuickBooks Desktop via local ODBC on the machine it runs on
2. Exports invoices, sales orders, and estimates (with line items)
3. Saves a local JSON backup on the USB drive
4. Sends the data to the ERP server's cache import endpoint

## Requirements

- **Windows** with PowerShell (built-in on Windows 7+)
- **QuickBooks Desktop** running on the same machine
- **QB SQL Anywhere** ODBC driver installed (comes with QB Desktop)
- Network access to the ERP server

## Setup

1. Copy this entire `qb-agent` folder to a USB drive
2. Edit `config.json`:
   - Set `erpServerUrl` to the ERP server address (e.g., `http://192.168.254.100:8001`)
   - Set `apiToken` to a valid JWT token from the ERP
3. Plug the USB into the QuickBooks machine
4. Double-click `qb-dump.bat`

## Getting an API Token

1. Open the ERP web app in a browser (usually `http://192.168.254.100:5173`)
2. Log in as an admin user
3. Open browser DevTools (F12) → Application tab → Local Storage
4. Copy the `token` value
5. Paste it into `config.json` as the `apiToken`

## Config Options

| Field | Default | Description |
|-------|---------|-------------|
| `erpServerUrl` | `http://192.168.254.100:8001` | ERP server URL with port |
| `apiToken` | (required) | JWT authentication token |
| `qbDriver` | `QB SQL Anywhere` | ODBC driver name |
| `daysBack` | `365` | How many days of history to export |
| `types` | `["invoice","salesOrder","estimate"]` | Document types to export |
| `batchSize` | `50` | Orders per HTTP request |
| `odbcTimeout` | `30` | ODBC query timeout in seconds |

## Output

- Saves a timestamped JSON backup: `qb-dump-2026-03-16_143022.json`
- Sends data in batches to `POST /api/v1/quickbooks/cache/import`

## Troubleshooting

**"Cannot connect to QuickBooks ODBC"**
- Make sure QuickBooks Desktop is open and running
- Check that the ODBC driver is installed (Control Panel → ODBC Data Sources)

**"apiToken is not set"**
- You need a JWT token from the ERP. See "Getting an API Token" above.

**"Connection refused" / timeout**
- Check that the ERP server is running at the URL in config.json
- Check network connectivity between this machine and the ERP server
