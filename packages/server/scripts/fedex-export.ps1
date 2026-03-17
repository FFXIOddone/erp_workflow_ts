# FedEx Shipment Export Script - MAXIMUM DEBUG VERSION
# Runs on WS-FEDEX1 (192.168.254.131)
# Exports today's shipments to CSV for ERP import

$ErrorActionPreference = "Continue"  # Don't stop on errors, log everything

# Paths
$ExportPath = "C:\ProgramData\FedEx\FSM\DATABASE\exports"
$DateStr = Get-Date -Format "yyyy-MM-dd"
$TimeStr = Get-Date -Format "HHmm"

# Create exports folder if it doesn't exist
if (-not (Test-Path $ExportPath)) {
    New-Item -ItemType Directory -Path $ExportPath -Force | Out-Null
}

# Start logging EVERYTHING
$LogFile = "$ExportPath\export_log_$DateStr.txt"
Start-Transcript -Path $LogFile -Append -Force

Write-Host "=============================================================================="
Write-Host "                    FEDEX EXPORT - MAXIMUM DEBUG MODE                         "
Write-Host "=============================================================================="
Write-Host "Start Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host "Export Path: $ExportPath"
Write-Host "Log File: $LogFile"
Write-Host ""

# ============================================================================
# SYSTEM INFORMATION
# ============================================================================
Write-Host "=============================================================================="
Write-Host "SYSTEM INFORMATION"
Write-Host "=============================================================================="
Write-Host "Computer Name: $env:COMPUTERNAME"
Write-Host "User Name: $env:USERNAME"
Write-Host "User Domain: $env:USERDOMAIN"
Write-Host "OS Version: $([System.Environment]::OSVersion.VersionString)"
Write-Host "PowerShell Version: $($PSVersionTable.PSVersion)"
Write-Host "PowerShell Architecture: $([IntPtr]::Size * 8)-bit"
Write-Host "CLR Version: $($PSVersionTable.CLRVersion)"
Write-Host "Current Directory: $(Get-Location)"
Write-Host ""

# ============================================================================
# CHECK IF DATABASE FILE EXISTS
# ============================================================================
Write-Host "=============================================================================="
Write-Host "DATABASE FILE CHECK"
Write-Host "=============================================================================="
$DbFile = "C:\ProgramData\FedEx\FSM\DATABASE\shipnet.db"
$DbLogFile = "C:\ProgramData\FedEx\FSM\DATABASE\shipnet.log"

if (Test-Path $DbFile) {
    $dbInfo = Get-Item $DbFile
    Write-Host "Database File: $DbFile"
    Write-Host "  Size: $([math]::Round($dbInfo.Length / 1MB, 2)) MB"
    Write-Host "  Last Modified: $($dbInfo.LastWriteTime)"
    Write-Host "  Attributes: $($dbInfo.Attributes)"
    
    # Check if file is locked
    try {
        $stream = [System.IO.File]::Open($DbFile, 'Open', 'Read', 'None')
        $stream.Close()
        Write-Host "  Lock Status: NOT LOCKED (file can be opened exclusively)"
    } catch {
        Write-Host "  Lock Status: LOCKED - $($_.Exception.Message)"
    }
} else {
    Write-Host "ERROR: Database file NOT FOUND at $DbFile"
}

if (Test-Path $DbLogFile) {
    $logInfo = Get-Item $DbLogFile
    Write-Host "Log File: $DbLogFile"
    Write-Host "  Size: $([math]::Round($logInfo.Length / 1MB, 2)) MB"
    Write-Host "  Last Modified: $($logInfo.LastWriteTime)"
} else {
    Write-Host "Log File: NOT FOUND (this might be OK)"
}
Write-Host ""

# ============================================================================
# LIST ALL ODBC DRIVERS
# ============================================================================
Write-Host "=============================================================================="
Write-Host "ALL ODBC DRIVERS INSTALLED"
Write-Host "=============================================================================="
try {
    $allDrivers = Get-OdbcDriver
    Write-Host "Total drivers found: $($allDrivers.Count)"
    Write-Host ""
    foreach ($driver in $allDrivers) {
        Write-Host "  Driver: $($driver.Name)"
        Write-Host "    Platform: $($driver.Platform)"
        Write-Host "    Attribute: $($driver.Attribute | Out-String)"
        Write-Host ""
    }
} catch {
    Write-Host "ERROR listing ODBC drivers: $($_.Exception.Message)"
}

# ============================================================================
# CHECK FOR SQL ANYWHERE PROCESSES
# ============================================================================
Write-Host "=============================================================================="
Write-Host "SQL ANYWHERE / FEDEX PROCESSES RUNNING"
Write-Host "=============================================================================="
try {
    $saProcesses = Get-Process | Where-Object { 
        $_.Name -like "*sql*" -or 
        $_.Name -like "*dbeng*" -or 
        $_.Name -like "*dbsrv*" -or
        $_.Name -like "*fedex*" -or
        $_.Name -like "*cafe*" -or
        $_.Name -like "*fsm*" -or
        $_.Name -like "*shipmanager*"
    }
    if ($saProcesses) {
        foreach ($proc in $saProcesses) {
            Write-Host "  Process: $($proc.Name) (PID: $($proc.Id))"
            Write-Host "    Path: $($proc.Path)"
            Write-Host "    Memory: $([math]::Round($proc.WorkingSet64 / 1MB, 2)) MB"
            Write-Host ""
        }
    } else {
        Write-Host "  No SQL Anywhere or FedEx processes found running"
    }
} catch {
    Write-Host "ERROR checking processes: $($_.Exception.Message)"
}

# ============================================================================
# CHECK LISTENING PORTS
# ============================================================================
Write-Host "=============================================================================="
Write-Host "NETWORK PORTS (SQL Anywhere default: 2638)"
Write-Host "=============================================================================="
try {
    $ports = netstat -an | Select-String ":2638"
    if ($ports) {
        Write-Host "Port 2638 activity:"
        $ports | ForEach-Object { Write-Host "  $_" }
    } else {
        Write-Host "  Port 2638 not listening (database might be embedded, not server mode)"
    }
} catch {
    Write-Host "ERROR checking ports: $($_.Exception.Message)"
}
Write-Host ""

# ============================================================================
# CHECK WINDOWS SERVICES
# ============================================================================
Write-Host "=============================================================================="
Write-Host "RELATED WINDOWS SERVICES"
Write-Host "=============================================================================="
try {
    $services = Get-Service | Where-Object {
        $_.Name -like "*sql*" -or 
        $_.Name -like "*fedex*" -or 
        $_.Name -like "*fsm*" -or
        $_.DisplayName -like "*sql*" -or
        $_.DisplayName -like "*fedex*"
    }
    if ($services) {
        foreach ($svc in $services) {
            Write-Host "  Service: $($svc.Name)"
            Write-Host "    Display Name: $($svc.DisplayName)"
            Write-Host "    Status: $($svc.Status)"
            Write-Host "    Start Type: $($svc.StartType)"
            Write-Host ""
        }
    } else {
        Write-Host "  No SQL/FedEx related services found"
    }
} catch {
    Write-Host "ERROR checking services: $($_.Exception.Message)"
}

# ============================================================================
# CHECK EXISTING ODBC DSNs
# ============================================================================
Write-Host "=============================================================================="
Write-Host "EXISTING ODBC DATA SOURCE NAMES (DSNs)"
Write-Host "=============================================================================="
try {
    $dsns = Get-OdbcDsn
    if ($dsns) {
        foreach ($dsn in $dsns) {
            Write-Host "  DSN: $($dsn.Name)"
            Write-Host "    Driver: $($dsn.DriverName)"
            Write-Host "    Platform: $($dsn.Platform)"
            Write-Host "    Type: $($dsn.DsnType)"
            Write-Host ""
        }
    } else {
        Write-Host "  No ODBC DSNs configured"
    }
} catch {
    Write-Host "ERROR checking DSNs: $($_.Exception.Message)"
}

# ============================================================================
# TRY EVERY POSSIBLE CONNECTION STRING
# ============================================================================
Write-Host "=============================================================================="
Write-Host "ATTEMPTING DATABASE CONNECTIONS"
Write-Host "=============================================================================="

$ExportFile = "$ExportPath\shipments_$DateStr`_$TimeStr.csv"
$conn = $null
$connectedWith = $null

# All possible connection strings - TRY DSN FIRST since it's already configured!
$ConnectionStrings = @(
    @{Name="*** DSN shipnet (no creds) ***"; Conn="DSN=shipnet;"},
    @{Name="*** DSN shipnet + dba blank ***"; Conn="DSN=shipnet;UID=dba;PWD=;"},
    @{Name="*** DSN shipnet + dba/sql ***"; Conn="DSN=shipnet;UID=dba;PWD=sql;"},
    @{Name="*** DSN shipnet + cafe/cafe ***"; Conn="DSN=shipnet;UID=cafe;PWD=cafe;"},
    @{Name="*** DSN shipnet + shipnet/shipnet ***"; Conn="DSN=shipnet;UID=shipnet;PWD=shipnet;"},
    @{Name="Engine shipnet (blank pwd)"; Conn="Driver={Cafe SQL Anywhere 17};ENG=shipnet;UID=dba;PWD=;"},
    @{Name="Engine shipnet (no creds)"; Conn="Driver={Cafe SQL Anywhere 17};ENG=shipnet;"},
    @{Name="Engine FSM"; Conn="Driver={Cafe SQL Anywhere 17};ENG=FSM;UID=dba;PWD=;"},
    @{Name="Engine CAFE"; Conn="Driver={Cafe SQL Anywhere 17};ENG=CAFE;UID=dba;PWD=;"},
    @{Name="ServerName shipnet"; Conn="Driver={Cafe SQL Anywhere 17};ServerName=shipnet;UID=dba;PWD=;"},
    @{Name="File only (no creds)"; Conn="Driver={Cafe SQL Anywhere 17};DatabaseFile=C:\ProgramData\FedEx\FSM\DATABASE\shipnet.db;"},
    @{Name="File + DBA blank"; Conn="Driver={Cafe SQL Anywhere 17};DatabaseFile=C:\ProgramData\FedEx\FSM\DATABASE\shipnet.db;UID=DBA;PWD=;"},
    @{Name="File + dba blank"; Conn="Driver={Cafe SQL Anywhere 17};DatabaseFile=C:\ProgramData\FedEx\FSM\DATABASE\shipnet.db;UID=dba;PWD=;"},
    @{Name="File + AutoStart"; Conn="Driver={Cafe SQL Anywhere 17};DatabaseFile=C:\ProgramData\FedEx\FSM\DATABASE\shipnet.db;AutoStart=YES;"},
    @{Name="File + AutoStart + DBA"; Conn="Driver={Cafe SQL Anywhere 17};DatabaseFile=C:\ProgramData\FedEx\FSM\DATABASE\shipnet.db;AutoStart=YES;UID=dba;PWD=;"},
    @{Name="File + dba/sql"; Conn="Driver={Cafe SQL Anywhere 17};DatabaseFile=C:\ProgramData\FedEx\FSM\DATABASE\shipnet.db;UID=dba;PWD=sql;"},
    @{Name="File + fedex/fedex"; Conn="Driver={Cafe SQL Anywhere 17};DatabaseFile=C:\ProgramData\FedEx\FSM\DATABASE\shipnet.db;UID=fedex;PWD=fedex;"},
    @{Name="File + admin/admin"; Conn="Driver={Cafe SQL Anywhere 17};DatabaseFile=C:\ProgramData\FedEx\FSM\DATABASE\shipnet.db;UID=admin;PWD=admin;"},
    @{Name="SQL Anywhere 17 driver"; Conn="Driver={SQL Anywhere 17};DatabaseFile=C:\ProgramData\FedEx\FSM\DATABASE\shipnet.db;UID=dba;PWD=;"},
    @{Name="SQL Anywhere 17 + ENG"; Conn="Driver={SQL Anywhere 17};ENG=shipnet;UID=dba;PWD=;"},
    @{Name="Trusted connection"; Conn="Driver={Cafe SQL Anywhere 17};DatabaseFile=C:\ProgramData\FedEx\FSM\DATABASE\shipnet.db;Trusted_Connection=Yes;"},
    @{Name="Integrated Security"; Conn="Driver={Cafe SQL Anywhere 17};DatabaseFile=C:\ProgramData\FedEx\FSM\DATABASE\shipnet.db;Integrated Security=SSPI;"}
)

$attemptNum = 0
foreach ($cs in $ConnectionStrings) {
    $attemptNum++
    Write-Host ""
    Write-Host "--- Attempt $attemptNum of $($ConnectionStrings.Count): $($cs.Name) ---"
    Write-Host "Connection String: $($cs.Conn)"
    
    try {
        $testConn = New-Object System.Data.Odbc.OdbcConnection($cs.Conn)
        Write-Host "  Created connection object..."
        
        $testConn.Open()
        Write-Host "  *** SUCCESS! CONNECTED! ***"
        
        $conn = $testConn
        $connectedWith = $cs.Name
        break
        
    } catch {
        Write-Host "  FAILED: $($_.Exception.Message)"
        
        # Get more details from inner exception
        if ($_.Exception.InnerException) {
            Write-Host "  Inner Exception: $($_.Exception.InnerException.Message)"
        }
    }
}

Write-Host ""
Write-Host "=============================================================================="
Write-Host "CONNECTION RESULT"
Write-Host "=============================================================================="

if ($conn -and $conn.State -eq 'Open') {
    Write-Host "SUCCESS! Connected using: $connectedWith"
    Write-Host "Connection State: $($conn.State)"
    Write-Host "Server Version: $($conn.ServerVersion)"
    Write-Host "Database: $($conn.Database)"
    Write-Host ""
    
    # ============================================================================
    # DISCOVER DATABASE SCHEMA
    # ============================================================================
    Write-Host "=============================================================================="
    Write-Host "DATABASE SCHEMA DISCOVERY"
    Write-Host "=============================================================================="
    
    try {
        # List all tables
        Write-Host "Querying system tables..."
        $tablesQuery = "SELECT table_name, table_type FROM SYS.SYSTABLE ORDER BY table_name"
        $cmd = New-Object System.Data.Odbc.OdbcCommand($tablesQuery, $conn)
        $cmd.CommandTimeout = 30
        $reader = $cmd.ExecuteReader()
        
        $tables = @()
        while ($reader.Read()) {
            $tables += [PSCustomObject]@{
                Name = $reader[0]
                Type = $reader[1]
            }
        }
        $reader.Close()
        
        Write-Host "Found $($tables.Count) tables"
        Write-Host ""
        
        # Show shipment-related tables
        $shipTables = $tables | Where-Object { $_.Name -like "*ship*" -or $_.Name -like "*pkg*" -or $_.Name -like "*track*" -or $_.Name -like "*recipient*" }
        Write-Host "Shipment-related tables:"
        $shipTables | ForEach-Object { Write-Host "  - $($_.Name) ($($_.Type))" }
        Write-Host ""
        
        # Show ALL tables for reference
        Write-Host "ALL tables (for reference):"
        $tables | ForEach-Object { Write-Host "  - $($_.Name)" }
        Write-Host ""
        
    } catch {
        Write-Host "ERROR discovering schema: $($_.Exception.Message)"
    }
    
    # ============================================================================
    # TRY TO EXPORT DATA
    # ============================================================================
    Write-Host "=============================================================================="
    Write-Host "ATTEMPTING DATA EXPORT"
    Write-Host "=============================================================================="
    
    try {
        # Try common table name variations
        $tableNames = @("Shipment", "SHIPMENT", "shipment", "Package", "PACKAGE", "ShipHistory", "SHIPHISTORY")
        
        foreach ($tableName in $tableNames) {
            Write-Host "Trying table: $tableName"
            try {
                $testQuery = "SELECT TOP 1 * FROM $tableName"
                $cmd2 = New-Object System.Data.Odbc.OdbcCommand($testQuery, $conn)
                $cmd2.CommandTimeout = 30
                $adapter = New-Object System.Data.Odbc.OdbcDataAdapter($cmd2)
                $dataset = New-Object System.Data.DataSet
                $adapter.Fill($dataset) | Out-Null
                
                Write-Host "  Table $tableName EXISTS!"
                Write-Host "  Columns:"
                $dataset.Tables[0].Columns | ForEach-Object { 
                    Write-Host "    - $($_.ColumnName) ($($_.DataType.Name))" 
                }
                Write-Host ""
                
                # Export all records from this table
                Write-Host "  Exporting all records from $tableName..."
                $exportQuery = "SELECT * FROM $tableName"
                $cmd3 = New-Object System.Data.Odbc.OdbcCommand($exportQuery, $conn)
                $cmd3.CommandTimeout = 300
                $adapter2 = New-Object System.Data.Odbc.OdbcDataAdapter($cmd3)
                $dataset2 = New-Object System.Data.DataSet
                $adapter2.Fill($dataset2) | Out-Null
                
                $rowCount = $dataset2.Tables[0].Rows.Count
                Write-Host "  Found $rowCount records"
                
                if ($rowCount -gt 0) {
                    $dataset2.Tables[0] | Export-Csv -Path $ExportFile -NoTypeInformation -Encoding UTF8
                    Write-Host "  EXPORTED to: $ExportFile"
                    
                    $LatestFile = "$ExportPath\shipments_latest.csv"
                    Copy-Item $ExportFile $LatestFile -Force
                    Write-Host "  Updated: $LatestFile"
                    
                    # Show sample data
                    Write-Host ""
                    Write-Host "  Sample data (first 3 rows):"
                    $dataset2.Tables[0] | Select-Object -First 3 | Format-List | Out-String | Write-Host
                }
                
                break  # Success, stop trying other table names
                
            } catch {
                Write-Host "  Table $tableName not found or error: $($_.Exception.Message)"
            }
        }
        
    } catch {
        Write-Host "ERROR exporting data: $($_.Exception.Message)"
    }
    
    # Close connection
    $conn.Close()
    Write-Host ""
    Write-Host "Database connection closed."
    
} else {
    Write-Host "FAILED - Could not connect with any method"
    Write-Host ""
    Write-Host "POSSIBLE SOLUTIONS:"
    Write-Host "1. Make sure FedEx Ship Manager is CLOSED (it locks the database)"
    Write-Host "2. Or, if Ship Manager must stay open, we need to connect to its running engine"
    Write-Host "3. Check if there's a SQL Anywhere service that needs to be running"
    Write-Host "4. The database credentials might be different than standard defaults"
}

# ============================================================================
# CLEANUP
# ============================================================================
Write-Host ""
Write-Host "=============================================================================="
Write-Host "CLEANUP"
Write-Host "=============================================================================="
Write-Host "Cleaning up old export files (older than 30 days)..."
try {
    $oldFiles = Get-ChildItem $ExportPath -Filter "shipments_*.csv" -ErrorAction SilentlyContinue | 
        Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) }
    if ($oldFiles) {
        $oldFiles | ForEach-Object { 
            Write-Host "  Removing: $($_.Name)"
            Remove-Item $_.FullName -Force 
        }
    } else {
        Write-Host "  No old files to clean up"
    }
} catch {
    Write-Host "  Cleanup error: $($_.Exception.Message)"
}

Write-Host ""
Write-Host "=============================================================================="
Write-Host "EXPORT COMPLETE"
Write-Host "=============================================================================="
Write-Host "End Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host ""

# List all files in export directory
Write-Host "Files in export directory:"
Get-ChildItem $ExportPath | ForEach-Object {
    Write-Host "  $($_.Name) - $([math]::Round($_.Length / 1KB, 2)) KB - $($_.LastWriteTime)"
}

Stop-Transcript

# Keep window open if run interactively
Write-Host ""
Write-Host "Press any key to close..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
