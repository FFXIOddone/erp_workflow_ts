<#
.SYNOPSIS
    QuickBooks Data Agent for Wilde Signs ERP
    
.DESCRIPTION
    Connects to QuickBooks Desktop via local ODBC, dumps invoices,
    sales orders, and estimates with their line items, then sends the
    data to the ERP server's cache import endpoint.
    
    Designed to run from a USB drive on the QuickBooks machine.
    No installation required — PowerShell is built into Windows.

.NOTES
    Edit config.json to set the ERP server URL and API token.
#>

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# ─── Load Config ─────────────────────────────────────────────

$configPath = Join-Path $scriptDir "config.json"
if (-not (Test-Path $configPath)) {
    Write-Host "ERROR: config.json not found at $configPath" -ForegroundColor Red
    Write-Host "Create config.json with erpServerUrl and apiToken." -ForegroundColor Yellow
    exit 1
}

$config = Get-Content $configPath -Raw | ConvertFrom-Json

if (-not $config.erpServerUrl) {
    Write-Host "ERROR: erpServerUrl is not set in config.json" -ForegroundColor Red
    exit 1
}
if (-not $config.apiToken) {
    Write-Host "ERROR: apiToken is not set in config.json" -ForegroundColor Red
    Write-Host "Get a JWT token from the ERP: log in, open browser DevTools > Application > Local Storage" -ForegroundColor Yellow
    exit 1
}

$erpUrl      = $config.erpServerUrl.TrimEnd("/")
$token       = $config.apiToken
$driver      = if ($config.qbDriver) { $config.qbDriver } else { "QB SQL Anywhere" }
$daysBack    = if ($config.daysBack) { [int]$config.daysBack } else { 365 }
$types       = if ($config.types) { $config.types } else { @("invoice", "salesOrder", "estimate") }
$batchSize   = if ($config.batchSize) { [int]$config.batchSize } else { 50 }
$timeout     = if ($config.odbcTimeout) { [int]$config.odbcTimeout } else { 30 }

$dateFrom = (Get-Date).AddDays(-$daysBack).ToString("yyyy-MM-dd")

Write-Host ""
Write-Host "Configuration:" -ForegroundColor Cyan
Write-Host "  ERP Server:  $erpUrl"
Write-Host "  ODBC Driver: $driver"
Write-Host "  Date Range:  $dateFrom to today"
Write-Host "  Types:       $($types -join ', ')"
Write-Host ""

# ─── Find QB ODBC Connection ────────────────────────────────

function Find-QBConnection {
    Write-Host "Searching for QuickBooks ODBC connection..." -ForegroundColor Cyan
    
    # Strategy 1: Try .ND files in ProgramData (most reliable for local QB)
    $ndPaths = @(
        "$env:ProgramData\Intuit\QuickBooks\qbglobaldb.nd",
        "$env:ALLUSERSPROFILE\Intuit\QuickBooks\qbglobaldb.nd"
    )
    
    # Also check for company-specific .nd files
    $qbDataDir = "$env:ProgramData\Intuit\QuickBooks"
    if (Test-Path $qbDataDir) {
        $ndFiles = Get-ChildItem -Path $qbDataDir -Filter "*.nd" -ErrorAction SilentlyContinue
        foreach ($f in $ndFiles) {
            $ndPaths += $f.FullName
        }
    }
    
    foreach ($ndFile in $ndPaths) {
        if (Test-Path $ndFile) {
            Write-Host "  Found ND file: $ndFile" -ForegroundColor Green
            $content = Get-Content $ndFile -Raw
            
            # Parse engine name and port from ND file
            $engineName = $null
            $port = $null
            $dbGuid = $null
            
            foreach ($line in ($content -split "`n")) {
                $line = $line.Trim()
                if ($line -match "^ServerName=(.+)$") { $engineName = $Matches[1].Trim() }
                if ($line -match "^ServerPort=(.+)$") { $port = $Matches[1].Trim() }
                if ($line -match "^DatabaseName=(.+)$") { $dbGuid = $Matches[1].Trim() }
            }
            
            if ($engineName) {
                $commLinks = "TCPIP{HOST=127.0.0.1"
                if ($port) { $commLinks += ":$port" }
                $commLinks += "}"
                
                $connStr = "Driver={$driver};ServerName=$engineName;CommLinks=$commLinks;Integrated=NO;Compress=NO;AutoStop=NO"
                if ($dbGuid) { $connStr += ";DatabaseName=$dbGuid" }
                
                Write-Host "  Connection: $connStr" -ForegroundColor DarkGray
                return $connStr
            }
        }
    }
    
    # Strategy 2: Try DSN-based connection
    Write-Host "  No ND files found, trying DSN..." -ForegroundColor Yellow
    $dsnNames = @("QuickBooks Data", "QB", "QuickBooks Data 64-bit")
    foreach ($dsn in $dsnNames) {
        $connStr = "DSN=$dsn"
        return $connStr
    }
    
    return $null
}

# ─── ODBC Query Helper ──────────────────────────────────────

function Invoke-QBQuery {
    param(
        [System.Data.Odbc.OdbcConnection]$Connection,
        [string]$SQL
    )
    
    $cmd = New-Object System.Data.Odbc.OdbcCommand($SQL, $Connection)
    $cmd.CommandTimeout = $timeout
    $adapter = New-Object System.Data.Odbc.OdbcDataAdapter($cmd)
    $table = New-Object System.Data.DataTable
    [void]$adapter.Fill($table)
    $cmd.Dispose()
    return $table
}

# ─── Connect ─────────────────────────────────────────────────

$connStr = Find-QBConnection
if (-not $connStr) {
    Write-Host "ERROR: Could not find QuickBooks ODBC connection." -ForegroundColor Red
    Write-Host "Make sure QuickBooks is running on this machine." -ForegroundColor Yellow
    exit 1
}

Write-Host "Connecting to QuickBooks..." -ForegroundColor Cyan
$conn = New-Object System.Data.Odbc.OdbcConnection($connStr)
try {
    $conn.Open()
    Write-Host "  Connected!" -ForegroundColor Green
    
    # Verify with a quick query
    $verify = Invoke-QBQuery -Connection $conn -SQL "SELECT TOP 1 ListID FROM Customer"
    Write-Host "  Verified: QB database is accessible ($($verify.Rows.Count) test row)" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Failed to connect to QuickBooks ODBC." -ForegroundColor Red
    Write-Host "  $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "  1. Is QuickBooks Desktop running on this machine?"
    Write-Host "  2. Is the '$driver' ODBC driver installed?"
    Write-Host "  3. Try running this as Administrator."
    exit 1
}

# ─── Dump Data ───────────────────────────────────────────────

$allOrders = @()
$totalLineItems = 0

function Get-LineItems {
    param(
        [System.Data.Odbc.OdbcConnection]$Connection,
        [string]$TableName, # InvoiceLine, SalesOrderLine, EstimateLine
        [string]$FKColumn,  # InvoiceTxnID, SalesOrderTxnID, EstimateTxnID
        [string]$TxnID
    )
    
    $safeTxnId = $TxnID.Replace("'", "''")
    $sql = "SELECT TxnLineID, ItemRefListID, ItemRefFullName, Description, Quantity, UnitOfMeasure, Rate, Amount FROM $TableName WHERE $FKColumn = '$safeTxnId' ORDER BY TxnLineID"
    
    $items = @()
    try {
        $rows = Invoke-QBQuery -Connection $Connection -SQL $sql
        $lineNum = 1
        foreach ($row in $rows.Rows) {
            $items += @{
                lineNumber  = $lineNum
                itemName    = if ($row["ItemRefFullName"] -and $row["ItemRefFullName"] -ne [DBNull]::Value) { [string]$row["ItemRefFullName"] } else { $null }
                description = if ($row["Description"] -and $row["Description"] -ne [DBNull]::Value) { [string]$row["Description"] } else { $null }
                quantity    = if ($row["Quantity"] -and $row["Quantity"] -ne [DBNull]::Value) { [double]$row["Quantity"] } else { $null }
                rate        = if ($row["Rate"] -and $row["Rate"] -ne [DBNull]::Value) { [double]$row["Rate"] } else { $null }
                amount      = if ($row["Amount"] -and $row["Amount"] -ne [DBNull]::Value) { [double]$row["Amount"] } else { 0.0 }
                unit        = if ($row["UnitOfMeasure"] -and $row["UnitOfMeasure"] -ne [DBNull]::Value) { [string]$row["UnitOfMeasure"] } else { $null }
            }
            $lineNum++
        }
    } catch {
        Write-Host "    Warning: Could not get line items for $TxnID`: $($_.Exception.Message)" -ForegroundColor Yellow
    }
    return ,$items
}

# --- Invoices ---
if ($types -contains "invoice") {
    Write-Host ""
    Write-Host "Fetching invoices..." -ForegroundColor Cyan
    $sql = "SELECT TxnID, RefNumber, CustomerRefFullName, TxnDate, TotalAmount, PONumber, Memo FROM Invoice WHERE TxnDate >= {d '$dateFrom'} ORDER BY TxnDate DESC"
    
    try {
        $invoices = Invoke-QBQuery -Connection $conn -SQL $sql
        Write-Host "  Found $($invoices.Rows.Count) invoices" -ForegroundColor Green
        
        $i = 0
        foreach ($row in $invoices.Rows) {
            $i++
            $txnId = [string]$row["TxnID"]
            $refNum = if ($row["RefNumber"] -ne [DBNull]::Value) { [string]$row["RefNumber"] } else { "" }
            
            if (-not $refNum) { continue }
            
            Write-Host "  [$i/$($invoices.Rows.Count)] Invoice $refNum" -ForegroundColor DarkGray -NoNewline
            
            $lineItems = Get-LineItems -Connection $conn -TableName "InvoiceLine" -FKColumn "InvoiceTxnID" -TxnID $txnId
            $totalLineItems += $lineItems.Count
            Write-Host " ($($lineItems.Count) items)" -ForegroundColor DarkGray
            
            $allOrders += @{
                refNumber    = $refNum
                txnId        = $txnId
                type         = "invoice"
                customerName = if ($row["CustomerRefFullName"] -ne [DBNull]::Value) { [string]$row["CustomerRefFullName"] } else { "" }
                totalAmount  = if ($row["TotalAmount"] -ne [DBNull]::Value) { [double]$row["TotalAmount"] } else { 0.0 }
                poNumber     = if ($row["PONumber"] -ne [DBNull]::Value) { [string]$row["PONumber"] } else { $null }
                txnDate      = if ($row["TxnDate"] -ne [DBNull]::Value) { ([datetime]$row["TxnDate"]).ToString("yyyy-MM-ddTHH:mm:ss.fffZ") } else { $null }
                memo         = if ($row["Memo"] -ne [DBNull]::Value) { [string]$row["Memo"] } else { $null }
                lineItems    = $lineItems
            }
        }
    } catch {
        Write-Host "  ERROR fetching invoices: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# --- Sales Orders ---
if ($types -contains "salesOrder") {
    Write-Host ""
    Write-Host "Fetching sales orders..." -ForegroundColor Cyan
    $sql = "SELECT TxnID, RefNumber, CustomerRefFullName, TxnDate, TotalAmount, PONumber, Memo FROM SalesOrder WHERE TxnDate >= {d '$dateFrom'} ORDER BY TxnDate DESC"
    
    try {
        $salesOrders = Invoke-QBQuery -Connection $conn -SQL $sql
        Write-Host "  Found $($salesOrders.Rows.Count) sales orders" -ForegroundColor Green
        
        $i = 0
        foreach ($row in $salesOrders.Rows) {
            $i++
            $txnId = [string]$row["TxnID"]
            $refNum = if ($row["RefNumber"] -ne [DBNull]::Value) { [string]$row["RefNumber"] } else { "" }
            
            if (-not $refNum) { continue }
            
            Write-Host "  [$i/$($salesOrders.Rows.Count)] SO $refNum" -ForegroundColor DarkGray -NoNewline
            
            $lineItems = Get-LineItems -Connection $conn -TableName "SalesOrderLine" -FKColumn "SalesOrderTxnID" -TxnID $txnId
            $totalLineItems += $lineItems.Count
            Write-Host " ($($lineItems.Count) items)" -ForegroundColor DarkGray
            
            $allOrders += @{
                refNumber    = $refNum
                txnId        = $txnId
                type         = "salesOrder"
                customerName = if ($row["CustomerRefFullName"] -ne [DBNull]::Value) { [string]$row["CustomerRefFullName"] } else { "" }
                totalAmount  = if ($row["TotalAmount"] -ne [DBNull]::Value) { [double]$row["TotalAmount"] } else { 0.0 }
                poNumber     = if ($row["PONumber"] -ne [DBNull]::Value) { [string]$row["PONumber"] } else { $null }
                txnDate      = if ($row["TxnDate"] -ne [DBNull]::Value) { ([datetime]$row["TxnDate"]).ToString("yyyy-MM-ddTHH:mm:ss.fffZ") } else { $null }
                memo         = if ($row["Memo"] -ne [DBNull]::Value) { [string]$row["Memo"] } else { $null }
                lineItems    = $lineItems
            }
        }
    } catch {
        Write-Host "  ERROR fetching sales orders: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# --- Estimates ---
if ($types -contains "estimate") {
    Write-Host ""
    Write-Host "Fetching estimates..." -ForegroundColor Cyan
    $sql = "SELECT TxnID, RefNumber, CustomerRefFullName, TxnDate, TotalAmount, PONumber, Memo FROM Estimate WHERE TxnDate >= {d '$dateFrom'} ORDER BY TxnDate DESC"
    
    try {
        $estimates = Invoke-QBQuery -Connection $conn -SQL $sql
        Write-Host "  Found $($estimates.Rows.Count) estimates" -ForegroundColor Green
        
        $i = 0
        foreach ($row in $estimates.Rows) {
            $i++
            $txnId = [string]$row["TxnID"]
            $refNum = if ($row["RefNumber"] -ne [DBNull]::Value) { [string]$row["RefNumber"] } else { "" }
            
            if (-not $refNum) { continue }
            
            Write-Host "  [$i/$($estimates.Rows.Count)] Estimate $refNum" -ForegroundColor DarkGray -NoNewline
            
            $lineItems = Get-LineItems -Connection $conn -TableName "EstimateLine" -FKColumn "EstimateTxnID" -TxnID $txnId
            $totalLineItems += $lineItems.Count
            Write-Host " ($($lineItems.Count) items)" -ForegroundColor DarkGray
            
            $allOrders += @{
                refNumber    = $refNum
                txnId        = $txnId
                type         = "estimate"
                customerName = if ($row["CustomerRefFullName"] -ne [DBNull]::Value) { [string]$row["CustomerRefFullName"] } else { "" }
                totalAmount  = if ($row["TotalAmount"] -ne [DBNull]::Value) { [double]$row["TotalAmount"] } else { 0.0 }
                poNumber     = if ($row["PONumber"] -ne [DBNull]::Value) { [string]$row["PONumber"] } else { $null }
                txnDate      = if ($row["TxnDate"] -ne [DBNull]::Value) { ([datetime]$row["TxnDate"]).ToString("yyyy-MM-ddTHH:mm:ss.fffZ") } else { $null }
                memo         = if ($row["Memo"] -ne [DBNull]::Value) { [string]$row["Memo"] } else { $null }
                lineItems    = $lineItems
            }
        }
    } catch {
        Write-Host "  ERROR fetching estimates: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# ─── Close ODBC ──────────────────────────────────────────────

$conn.Close()
$conn.Dispose()
Write-Host ""
Write-Host "QuickBooks connection closed." -ForegroundColor Cyan

# ─── Summary ─────────────────────────────────────────────────

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Export Summary" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Total orders:     $($allOrders.Count)"
Write-Host "  Total line items: $totalLineItems"

$invoiceCount = ($allOrders | Where-Object { $_.type -eq "invoice" }).Count
$soCount      = ($allOrders | Where-Object { $_.type -eq "salesOrder" }).Count
$estCount     = ($allOrders | Where-Object { $_.type -eq "estimate" }).Count
Write-Host "  Invoices:         $invoiceCount"
Write-Host "  Sales Orders:     $soCount"
Write-Host "  Estimates:        $estCount"
Write-Host ""

if ($allOrders.Count -eq 0) {
    Write-Host "No orders found. Nothing to send." -ForegroundColor Yellow
    exit 0
}

# ─── Save Local Backup ───────────────────────────────────────

$timestamp = (Get-Date).ToString("yyyy-MM-dd_HHmmss")
$backupFile = Join-Path $scriptDir "qb-dump-$timestamp.json"

$payload = @{
    source      = "agent"
    agentVersion = "1.0.0"
    exportedAt  = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    orders      = $allOrders
}

$json = $payload | ConvertTo-Json -Depth 10 -Compress
[System.IO.File]::WriteAllText($backupFile, $json, [System.Text.Encoding]::UTF8)
Write-Host "Local backup saved: $backupFile" -ForegroundColor Green

# ─── Send to ERP Server ─────────────────────────────────────

$importUrl = "$erpUrl/api/v1/quickbooks/cache/import"
Write-Host ""
Write-Host "Sending data to ERP server..." -ForegroundColor Cyan
Write-Host "  URL: $importUrl" -ForegroundColor DarkGray

# Send in batches to avoid oversized payloads
$totalBatches = [math]::Ceiling($allOrders.Count / $batchSize)
$batchNum = 0
$totalUpserted = 0
$totalErrors = @()

for ($offset = 0; $offset -lt $allOrders.Count; $offset += $batchSize) {
    $batchNum++
    $batch = $allOrders[$offset..([math]::Min($offset + $batchSize - 1, $allOrders.Count - 1))]
    
    Write-Host "  Batch $batchNum/$totalBatches ($($batch.Count) orders)..." -ForegroundColor DarkGray -NoNewline
    
    $batchPayload = @{
        source       = "agent"
        agentVersion = "1.0.0"
        exportedAt   = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        orders       = $batch
    }
    
    $batchJson = $batchPayload | ConvertTo-Json -Depth 10 -Compress
    
    try {
        $response = Invoke-RestMethod -Uri $importUrl -Method POST -Body $batchJson -ContentType "application/json; charset=utf-8" -Headers @{ "Authorization" = "Bearer $token" } -TimeoutSec 120
        
        if ($response.success) {
            $totalUpserted += $response.data.ordersUpserted
            Write-Host " OK ($($response.data.ordersUpserted) upserted, $($response.data.duration))" -ForegroundColor Green
            if ($response.data.errors -and $response.data.errors.Count -gt 0) {
                $totalErrors += $response.data.errors
                foreach ($err in $response.data.errors) {
                    Write-Host "    Warning: $err" -ForegroundColor Yellow
                }
            }
        } else {
            Write-Host " FAILED" -ForegroundColor Red
            Write-Host "    $($response | ConvertTo-Json -Compress)" -ForegroundColor Red
        }
    } catch {
        Write-Host " ERROR" -ForegroundColor Red
        Write-Host "    $($_.Exception.Message)" -ForegroundColor Red
        
        if ($_.Exception.Response) {
            try {
                $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                $body = $reader.ReadToEnd()
                Write-Host "    Response: $body" -ForegroundColor Red
            } catch {}
        }
    }
}

# ─── Final Report ────────────────────────────────────────────

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Import Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Orders sent:      $($allOrders.Count)"
Write-Host "  Orders upserted:  $totalUpserted"
if ($totalErrors.Count -gt 0) {
    Write-Host "  Errors:           $($totalErrors.Count)" -ForegroundColor Yellow
}
Write-Host ""
Write-Host "The ERP can now look up QB line items from the cache" -ForegroundColor Cyan
Write-Host "even when QuickBooks is not connected." -ForegroundColor Cyan
Write-Host ""
