<#
.SYNOPSIS
    Standardize the Wilde Signs network drive folder structure.

.DESCRIPTION
    This script reorganizes \\wildesigns-fs1\Company Files (mapped as S:\) to use
    a consistent, machine-friendly naming convention. It runs in DRY-RUN mode by
    default -- no changes are made until you pass -Execute.

    Run this OFF BUSINESS HOURS when no one has files open on the drive.

    Phases:
      1. Normalize customer folder names → UPPER CASE, clean special chars
      2. Move misplaced WO folders from root into correct customer folders
      3. Standardize WO folder names → WO#####_DESCRIPTION (underscore separator)
      4. Delete empty customer folders and "New folder" placeholders
      5. Generate review report for non-WO misc subfolders (no auto-delete)
      6. Generate review report for Safari/root duplicate customers
      7. Update ERP database networkDriveFolderPath for renamed customers

.PARAMETER Execute
    Actually perform the changes. Without this flag, everything is dry-run only.

.PARAMETER Phase
    Run only specific phase(s). Comma-separated: -Phase 1,2,3
    Default: all phases.

.PARAMETER LogDir
    Directory for log files. Default: script directory.

.PARAMETER SkipSafari
    Skip processing the Safari subfolder (Port City Signs brand).

.EXAMPLE
    # Preview all changes (dry run)
    .\standardize-network-drive.ps1

    # Execute only phase 1 (customer name normalization)
    .\standardize-network-drive.ps1 -Execute -Phase 1

    # Execute all phases
    .\standardize-network-drive.ps1 -Execute
#>

[CmdletBinding(SupportsShouldProcess)]
param(
    [switch]$Execute,
    [int[]]$Phase = @(1,2,3,4,5,6,7),
    [string]$LogDir = "",
    [switch]$SkipSafari
)

# ============================================================================
# CONFIGURATION
# ============================================================================

# Resolve LogDir - $PSScriptRoot doesn't work as param default
if (-not $LogDir) {
    $LogDir = $PSScriptRoot
}
if (-not $LogDir) {
    $LogDir = Split-Path -Parent $MyInvocation.MyCommand.Path
}
if (-not $LogDir) {
    $LogDir = (Get-Location).Path
}

$DriveRoot       = "S:\"
$SafariRoot      = "S:\Safari"
$Timestamp       = Get-Date -Format "yyyy-MM-dd_HHmmss"
$LogFile         = Join-Path $LogDir "drive-standardize-$Timestamp.log"
$ReviewFile      = Join-Path $LogDir "drive-review-$Timestamp.csv"
$DuplicateFile   = Join-Path $LogDir "drive-duplicates-$Timestamp.csv"
$RenameMapFile   = Join-Path $LogDir "drive-rename-map-$Timestamp.csv"
$ErrorLogFile    = Join-Path $LogDir "drive-errors-$Timestamp.log"
$DryRun          = -not $Execute

# Characters to strip from folder names (Windows-illegal + problematic)
$BadCharsPattern = '[<>:"/\\|?*]'

# WO folder patterns
$WoPatternAny    = '^(WO\d+)[_\s\-](.+)$'       # WO#####<sep>DESCRIPTION
$WoPatternBare   = '^(WO\d+)$'                    # WO##### with no description
$WoPatternRoot   = '^WO\d+'                        # Any WO-prefixed folder at root

# Folders that should never be touched
$ProtectedFolders = @('Safari', 'RECYCLE.BIN', 'System Volume Information', '$RECYCLE.BIN')

# Standard category subfolders (created by ERP for new WO folders)
$StandardCategories = @('Proofs', 'Artwork', 'Emails', 'Print Files', 'Photos', 'Documents', 'Other')

# ============================================================================
# LOGGING
# ============================================================================

$script:Stats = @{
    RenamesPlanned     = 0
    RenamesExecuted    = 0
    MovesPlanned       = 0
    MovesExecuted      = 0
    DeletesPlanned     = 0
    DeletesExecuted    = 0
    Errors             = 0
    ReviewItems        = 0
}

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $line = "[$Timestamp] [$Level] $Message"
    $line | Out-File -FilePath $LogFile -Append -Encoding UTF8
    switch ($Level) {
        "ERROR"   { Write-Host $Message -ForegroundColor Red }
        "WARN"    { Write-Host $Message -ForegroundColor Yellow }
        "SUCCESS" { Write-Host $Message -ForegroundColor Green }
        "DRY"     { Write-Host "[DRY RUN] $Message" -ForegroundColor Cyan }
        default   { Write-Host $Message }
    }
}

function Write-ErrorLog {
    param([string]$Message)
    $Message | Out-File -FilePath $ErrorLogFile -Append -Encoding UTF8
    $script:Stats.Errors++
}

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

function Normalize-CustomerName {
    <#
    .SYNOPSIS
        Normalize a customer folder name to standard format.
        Convention: UPPER CASE, trimmed, single spaces, no illegal chars.
    #>
    param([string]$Name)

    $normalized = $Name.Trim()

    # Remove characters illegal in Windows paths
    $normalized = $normalized -replace $BadCharsPattern, ''

    # Collapse multiple spaces
    $normalized = $normalized -replace '\s+', ' '

    # Trim trailing/leading dots and spaces (Windows doesn't allow trailing dots)
    $normalized = $normalized.Trim('. ')

    # UPPER CASE
    $normalized = $normalized.ToUpper()

    return $normalized
}

function Normalize-WoFolderName {
    <#
    .SYNOPSIS
        Normalize a WO folder name to: WO#####_DESCRIPTION (UPPER CASE)
        Handles: "WO12345 desc", "WO12345-desc", "WO12345_desc", "WO12345"
    #>
    param([string]$Name)

    # Match WO number + separator + description
    if ($Name -match $WoPatternAny) {
        $woNum = $Matches[1].ToUpper()
        $desc  = $Matches[2].Trim()
        $desc  = $desc -replace $BadCharsPattern, ''
        $desc  = $desc -replace '\s+', ' '
        $desc  = $desc.Trim('. ').ToUpper()

        if ($desc) {
            return "${woNum}_${desc}"
        } else {
            return $woNum
        }
    }

    # Match bare WO number
    if ($Name -match $WoPatternBare) {
        return $Matches[1].ToUpper()
    }

    # Shouldn't get here for WO folders, but return cleaned version
    return $Name.Trim().ToUpper()
}

function Safe-Rename {
    <#
    .SYNOPSIS
        Rename a folder, handling conflicts and logging.
    #>
    param(
        [string]$OldPath,
        [string]$NewPath,
        [string]$Description
    )

    if ($OldPath -ceq $NewPath) { return $true }

    $script:Stats.RenamesPlanned++

    if ($DryRun) {
        Write-Log "[RENAME] $Description" "DRY"
        Write-Log "    FROM: $OldPath" "DRY"
        Write-Log "    TO:   $NewPath" "DRY"
        # Record in rename map
        "$OldPath`t$NewPath`t$Description" | Out-File -FilePath $RenameMapFile -Append -Encoding UTF8
        return $true
    }

    try {
        # Check for conflicts
        if ((Test-Path -LiteralPath $NewPath) -and ($OldPath -cne $NewPath)) {
            # If target exists and isn't just a case change, we have a conflict
            $oldLeaf = Split-Path $OldPath -Leaf
            $newLeaf = Split-Path $NewPath -Leaf
            if ($oldLeaf.ToUpper() -cne $newLeaf.ToUpper()) {
                Write-Log "CONFLICT: Target already exists: $NewPath (trying to rename from $OldPath)" "ERROR"
                Write-ErrorLog "CONFLICT: $OldPath -> $NewPath (target exists)"
                return $false
            }
        }

        # For case-only renames on Windows, we need a two-step rename via temp name
        $oldLeaf = Split-Path $OldPath -Leaf
        $newLeaf = Split-Path $NewPath -Leaf
        if ($oldLeaf.ToUpper() -ceq $newLeaf.ToUpper() -and $oldLeaf -cne $newLeaf) {
            $tempPath = $OldPath + "_RENAME_TEMP_" + [guid]::NewGuid().ToString("N").Substring(0,8)
            Rename-Item -LiteralPath $OldPath -NewName (Split-Path $tempPath -Leaf) -Force -ErrorAction Stop
            Rename-Item -LiteralPath $tempPath -NewName $newLeaf -Force -ErrorAction Stop
        } else {
            Rename-Item -LiteralPath $OldPath -NewName $newLeaf -Force -ErrorAction Stop
        }

        $script:Stats.RenamesExecuted++
        Write-Log "[RENAMED] $Description" "SUCCESS"
        Write-Log "    FROM: $OldPath"
        Write-Log "    TO:   $NewPath"
        "$OldPath`t$NewPath`t$Description" | Out-File -FilePath $RenameMapFile -Append -Encoding UTF8
        return $true
    }
    catch {
        Write-Log "FAILED to rename: $OldPath -> $NewPath : $_" "ERROR"
        Write-ErrorLog "RENAME FAILED: $OldPath -> $NewPath : $_"
        return $false
    }
}

function Safe-Move {
    <#
    .SYNOPSIS
        Move a folder to a new parent directory, handling conflicts.
    #>
    param(
        [string]$SourcePath,
        [string]$DestParent,
        [string]$Description
    )

    $folderName = Split-Path $SourcePath -Leaf
    $destPath = Join-Path $DestParent $folderName

    $script:Stats.MovesPlanned++

    if ($DryRun) {
        Write-Log "[MOVE] $Description" "DRY"
        Write-Log "    FROM: $SourcePath" "DRY"
        Write-Log "    TO:   $destPath" "DRY"
        "$SourcePath`t$destPath`t$Description" | Out-File -FilePath $RenameMapFile -Append -Encoding UTF8
        return $true
    }

    try {
        if (Test-Path -LiteralPath $destPath) {
            Write-Log "CONFLICT: Move target already exists: $destPath" "ERROR"
            Write-ErrorLog "MOVE CONFLICT: $SourcePath -> $destPath (target exists)"
            return $false
        }

        # Ensure destination parent exists
        if (-not (Test-Path -LiteralPath $DestParent)) {
            New-Item -Path $DestParent -ItemType Directory -Force | Out-Null
        }

        Move-Item -LiteralPath $SourcePath -Destination $destPath -Force -ErrorAction Stop
        $script:Stats.MovesExecuted++
        Write-Log "[MOVED] $Description" "SUCCESS"
        "$SourcePath`t$destPath`t$Description" | Out-File -FilePath $RenameMapFile -Append -Encoding UTF8
        return $true
    }
    catch {
        Write-Log "FAILED to move: $SourcePath -> $destPath : $_" "ERROR"
        Write-ErrorLog "MOVE FAILED: $SourcePath -> $destPath : $_"
        return $false
    }
}

function Safe-Delete {
    <#
    .SYNOPSIS
        Delete an empty folder, with logging.
    #>
    param(
        [string]$Path,
        [string]$Description
    )

    $script:Stats.DeletesPlanned++

    if ($DryRun) {
        Write-Log "[DELETE] $Description" "DRY"
        Write-Log "    PATH: $Path" "DRY"
        return $true
    }

    try {
        # Double-check it's actually empty
        $contents = @(Get-ChildItem -LiteralPath $Path -Force -ErrorAction SilentlyContinue)
        if ($contents.Count -gt 0) {
            Write-Log "SKIP DELETE: Folder not empty ($($contents.Count) items): $Path" "WARN"
            return $false
        }

        Remove-Item -LiteralPath $Path -Force -ErrorAction Stop
        $script:Stats.DeletesExecuted++
        Write-Log "[DELETED] $Description" "SUCCESS"
        return $true
    }
    catch {
        Write-Log "FAILED to delete: $Path : $_" "ERROR"
        Write-ErrorLog "DELETE FAILED: $Path : $_"
        return $false
    }
}

function Add-ReviewItem {
    <#
    .SYNOPSIS
        Add an item to the review CSV for human decision.
    #>
    param(
        [string]$Category,    # e.g. "NON_WO_SUBFOLDER", "DUPLICATE_CUSTOMER"
        [string]$Path,
        [string]$Customer,
        [string]$Description,
        [string]$Recommendation  # e.g. "DELETE", "MOVE", "KEEP", "MERGE"
    )

    $script:Stats.ReviewItems++
    "$Category`t$Customer`t$Path`t$Description`t$Recommendation" | Out-File -FilePath $ReviewFile -Append -Encoding UTF8
}


# ============================================================================
# PHASE 1: Normalize customer folder names
# ============================================================================

function Invoke-Phase1 {
    Write-Log "========================================" 
    Write-Log "PHASE 1: Normalize customer folder names"
    Write-Log "========================================"
    Write-Log "Convention: UPPER CASE, trimmed, single spaces, no illegal chars"
    Write-Log ""

    $customerFolders = Get-ChildItem -Path $DriveRoot -Directory |
        Where-Object { $ProtectedFolders -notcontains $_.Name }

    $renameCount = 0
    $skipCount = 0

    foreach ($cf in $customerFolders) {
        $oldName = $cf.Name
        $newName = Normalize-CustomerName $oldName

        if ($oldName -ceq $newName) {
            $skipCount++
            continue
        }

        # Check if normalized name would collide with another folder
        $targetPath = Join-Path $DriveRoot $newName
        if ((Test-Path -LiteralPath $targetPath) -and ($oldName.ToUpper() -ne $newName.ToUpper())) {
            # True collision -- two different customer folders normalize to the same name
            Write-Log "COLLISION: '$oldName' -> '$newName' but '$newName' already exists!" "WARN"
            Add-ReviewItem "NAME_COLLISION" $cf.FullName $oldName "Normalizes to '$newName' which already exists" "MANUAL_MERGE"
            continue
        }

        Safe-Rename -OldPath $cf.FullName -NewPath $targetPath -Description "Customer: '$oldName' -> '$newName'"
        $renameCount++
    }

    Write-Log ""
    Write-Log "Phase 1 complete: $renameCount renames planned, $skipCount already correct"

    # Also do Safari if not skipped
    if (-not $SkipSafari -and (Test-Path -LiteralPath $SafariRoot)) {
        Write-Log ""
        Write-Log "Phase 1b: Normalizing Safari customer folders..."

        $safariCustomers = Get-ChildItem -Path $SafariRoot -Directory
        $safariRenames = 0

        foreach ($sc in $safariCustomers) {
            $oldName = $sc.Name
            $newName = Normalize-CustomerName $oldName

            if ($oldName -ceq $newName) { continue }

            $targetPath = Join-Path $SafariRoot $newName
            if ((Test-Path -LiteralPath $targetPath) -and ($oldName.ToUpper() -ne $newName.ToUpper())) {
                Write-Log "SAFARI COLLISION: '$oldName' -> '$newName' already exists!" "WARN"
                Add-ReviewItem "NAME_COLLISION" $sc.FullName "Safari\$oldName" "Normalizes to '$newName' which already exists" "MANUAL_MERGE"
                continue
            }

            Safe-Rename -OldPath $sc.FullName -NewPath $targetPath -Description "Safari Customer: '$oldName' -> '$newName'"
            $safariRenames++
        }

        Write-Log "Phase 1b complete: $safariRenames Safari renames planned"
    }
}


# ============================================================================
# PHASE 2: Move misplaced WO folders from root level
# ============================================================================

function Invoke-Phase2 {
    Write-Log ""
    Write-Log "============================================="
    Write-Log "PHASE 2: Move misplaced root-level WO folders"
    Write-Log "============================================="
    Write-Log ""

    $rootWoFolders = Get-ChildItem -Path $DriveRoot -Directory |
        Where-Object { $_.Name -match $WoPatternRoot }

    if ($rootWoFolders.Count -eq 0) {
        Write-Log "No misplaced WO folders found at root. Skipping."
        return
    }

    Write-Log "Found $($rootWoFolders.Count) WO folders at root level"

    foreach ($wo in $rootWoFolders) {
        $woName = $wo.Name

        # Try to extract customer name from the WO folder name
        # Common pattern: WO#####_PO######_CUSTOMER_NAME_DESCRIPTION
        # or: WO##### CUSTOMER_DESCRIPTION
        # These are ambiguous -- flag for review with best guess

        # Try to match against existing customer folders
        $bestMatch = $null
        $allCustomers = Get-ChildItem -Path $DriveRoot -Directory |
            Where-Object { $ProtectedFolders -notcontains $_.Name -and $_.Name -notmatch $WoPatternRoot }

        # Check if any customer name appears in the WO folder name
        foreach ($cust in $allCustomers) {
            $custName = $cust.Name.ToUpper()
            $woUpper = $woName.ToUpper()

            # Skip very short customer names to avoid false matches
            if ($custName.Length -lt 4) { continue }

            if ($woUpper -match [regex]::Escape($custName)) {
                $bestMatch = $cust
                break
            }
        }

        if ($bestMatch) {
            Write-Log "WO at root: '$woName' -> matches customer '$($bestMatch.Name)'"
            Safe-Move -SourcePath $wo.FullName -DestParent $bestMatch.FullName -Description "Root WO '$woName' -> customer '$($bestMatch.Name)'"
        } else {
            Write-Log "WO at root: '$woName' -- no customer match found" "WARN"
            Add-ReviewItem "MISPLACED_WO" $wo.FullName "UNKNOWN" "Root-level WO folder, no matching customer found: $woName" "MANUAL_MOVE"
        }
    }
}


# ============================================================================
# PHASE 3: Standardize WO folder names (separator + casing)
# ============================================================================

function Invoke-Phase3-ForCustomer {
    param(
        [string]$CustomerPath,
        [string]$CustomerName,
        [string]$Brand   # "Wilde" or "Safari"
    )

    # Get all items in this customer folder
    $subfolders = @(Get-ChildItem -LiteralPath $CustomerPath -Directory -ErrorAction SilentlyContinue)

    foreach ($sub in $subfolders) {
        $name = $sub.Name

        # Skip year folders -- recurse into them
        if ($name -match '^\d{4}$') {
            # Recurse into year folder to standardize WO folders inside
            Invoke-Phase3-ForCustomer -CustomerPath $sub.FullName -CustomerName $CustomerName -Brand $Brand
            continue
        }

        # Only process WO-prefixed folders
        if ($name -notmatch '^WO\d+') { continue }

        $newName = Normalize-WoFolderName $name

        if ($name -ceq $newName) { continue }

        $newPath = Join-Path (Split-Path $sub.FullName) $newName

        # Check for collision
        if ((Test-Path -LiteralPath $newPath) -and ($name.ToUpper() -ne $newName.ToUpper())) {
            Write-Log "WO COLLISION: '$name' -> '$newName' already exists in $CustomerName" "WARN"
            Add-ReviewItem "WO_COLLISION" $sub.FullName $CustomerName "WO rename collision: '$name' -> '$newName'" "MANUAL_MERGE"
            continue
        }

        Safe-Rename -OldPath $sub.FullName -NewPath $newPath -Description "$Brand WO in '$CustomerName': '$name' -> '$newName'"
    }
}

function Invoke-Phase3 {
    Write-Log ""
    Write-Log "============================================="
    Write-Log "PHASE 3: Standardize WO folder names"
    Write-Log "============================================="
    Write-Log "Convention: WO#####_DESCRIPTION (underscore, UPPER CASE)"
    Write-Log ""

    # Process root-level customers (Wilde Signs)
    $customers = Get-ChildItem -Path $DriveRoot -Directory |
        Where-Object { $ProtectedFolders -notcontains $_.Name -and $_.Name -notmatch $WoPatternRoot }

    $i = 0
    foreach ($cust in $customers) {
        $i++
        if ($i % 100 -eq 0) { Write-Log "  Progress: $i / $($customers.Count) customers..." }
        Invoke-Phase3-ForCustomer -CustomerPath $cust.FullName -CustomerName $cust.Name -Brand "Wilde"
    }
    Write-Log "Wilde Signs customers processed: $($customers.Count)"

    # Process Safari customers
    if (-not $SkipSafari -and (Test-Path -LiteralPath $SafariRoot)) {
        $safariCustomers = Get-ChildItem -Path $SafariRoot -Directory
        $j = 0
        foreach ($sc in $safariCustomers) {
            $j++
            if ($j % 100 -eq 0) { Write-Log "  Safari progress: $j / $($safariCustomers.Count)..." }
            Invoke-Phase3-ForCustomer -CustomerPath $sc.FullName -CustomerName "Safari\$($sc.Name)" -Brand "Safari"
        }
        Write-Log "Safari customers processed: $($safariCustomers.Count)"
    }
}


# ============================================================================
# PHASE 4: Clean empty folders and placeholders
# ============================================================================

function Invoke-Phase4 {
    Write-Log ""
    Write-Log "============================================="
    Write-Log "PHASE 4: Clean empty folders & placeholders"
    Write-Log "============================================="
    Write-Log ""

    # 4a: Delete completely empty customer folders
    $emptyCount = 0
    $customers = Get-ChildItem -Path $DriveRoot -Directory |
        Where-Object { $ProtectedFolders -notcontains $_.Name }

    foreach ($cust in $customers) {
        $contents = @(Get-ChildItem -LiteralPath $cust.FullName -Force -ErrorAction SilentlyContinue)
        if ($contents.Count -eq 0) {
            Safe-Delete -Path $cust.FullName -Description "Empty customer folder: '$($cust.Name)'"
            $emptyCount++
        }
    }
    Write-Log "Empty customer folders found: $emptyCount"

    # 4b: Delete "New folder" placeholders inside customer folders
    $newFolderCount = 0
    foreach ($cust in $customers) {
        $newFolders = @(Get-ChildItem -LiteralPath $cust.FullName -Directory -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -match '^New folder' })

        foreach ($nf in $newFolders) {
            $contents = @(Get-ChildItem -LiteralPath $nf.FullName -Force -ErrorAction SilentlyContinue)
            if ($contents.Count -eq 0) {
                Safe-Delete -Path $nf.FullName -Description "Empty 'New folder' in '$($cust.Name)'"
                $newFolderCount++
            } else {
                Write-Log "SKIP: 'New folder' in '$($cust.Name)' has $($contents.Count) items -- not empty" "WARN"
                Add-ReviewItem "NON_EMPTY_PLACEHOLDER" $nf.FullName $cust.Name "'New folder' contains $($contents.Count) items" "REVIEW_CONTENTS"
            }
        }
    }
    Write-Log "Empty 'New folder' placeholders found: $newFolderCount"

    # 4c: Same for Safari
    if (-not $SkipSafari -and (Test-Path -LiteralPath $SafariRoot)) {
        $safariCustomers = Get-ChildItem -Path $SafariRoot -Directory
        foreach ($sc in $safariCustomers) {
            $contents = @(Get-ChildItem -LiteralPath $sc.FullName -Force -ErrorAction SilentlyContinue)
            if ($contents.Count -eq 0) {
                Safe-Delete -Path $sc.FullName -Description "Empty Safari customer: '$($sc.Name)'"
            }
            # Also clean "New folder" inside Safari customers
            $newFolders = @(Get-ChildItem -LiteralPath $sc.FullName -Directory -ErrorAction SilentlyContinue |
                Where-Object { $_.Name -match '^New folder' })
            foreach ($nf in $newFolders) {
                $contents2 = @(Get-ChildItem -LiteralPath $nf.FullName -Force -ErrorAction SilentlyContinue)
                if ($contents2.Count -eq 0) {
                    Safe-Delete -Path $nf.FullName -Description "Empty 'New folder' in Safari '$($sc.Name)'"
                }
            }
        }
    }
}


# ============================================================================
# PHASE 5: Review report for non-WO misc subfolders
# ============================================================================

function Invoke-Phase5 {
    Write-Log ""
    Write-Log "============================================="
    Write-Log "PHASE 5: Catalog non-WO subfolders for review"
    Write-Log "============================================="
    Write-Log "These folders don't follow WO##### convention and need human decisions."
    Write-Log ""

    $customers = Get-ChildItem -Path $DriveRoot -Directory |
        Where-Object { $ProtectedFolders -notcontains $_.Name -and $_.Name -notmatch $WoPatternRoot }

    $totalMisc = 0

    foreach ($cust in $customers) {
        $subfolders = @(Get-ChildItem -LiteralPath $cust.FullName -Directory -ErrorAction SilentlyContinue)

        foreach ($sub in $subfolders) {
            $name = $sub.Name

            # Skip WO folders and year folders -- they're handled
            if ($name -match '^WO\d+' -or $name -match '^\d{4}$') { continue }

            $totalMisc++

            # Categorize for the review report
            $fileCount = @(Get-ChildItem -LiteralPath $sub.FullName -File -Recurse -ErrorAction SilentlyContinue).Count
            $subCount  = @(Get-ChildItem -LiteralPath $sub.FullName -Directory -ErrorAction SilentlyContinue).Count
            $sizeBytes = 0
            try {
                $sizeBytes = (Get-ChildItem -LiteralPath $sub.FullName -File -Recurse -ErrorAction SilentlyContinue |
                    Measure-Object -Property Length -Sum -ErrorAction SilentlyContinue).Sum
            } catch {}
            $sizeMB = [math]::Round($sizeBytes / 1MB, 1)

            # Auto-classify recommendation
            $recommendation = "REVIEW"
            if ($name -match '^ARTWORK PENDING|^ART PENDING') {
                $recommendation = if ($fileCount -eq 0) { "DELETE_EMPTY" } else { "KEEP_STAGING" }
            }
            elseif ($name -match '^PRINT$|^PRINT_CUT$|^CUT$') {
                $recommendation = "KEEP_PRODUCTION"
            }
            elseif ($name -match '^PROOF|^Proofs$') {
                $recommendation = "KEEP_PROOFS"
            }
            elseif ($name -match '^Templates?$|^Logos?$|^LOGO') {
                $recommendation = "KEEP_ASSETS"
            }
            elseif ($name -match '^New folder$') {
                $recommendation = if ($fileCount -eq 0) { "DELETE_EMPTY" } else { "REVIEW" }
            }
            elseif ($name -match 'DO NOT USE|BACKUP|TEST|old$') {
                $recommendation = "ARCHIVE_OR_DELETE"
            }
            elseif ($fileCount -eq 0 -and $subCount -eq 0) {
                $recommendation = "DELETE_EMPTY"
            }

            Add-ReviewItem "NON_WO_SUBFOLDER" $sub.FullName $cust.Name ("$name | ${fileCount} files | ${subCount} subdirs | $($sizeMB) MB | $recommendation") $recommendation
        }
    }

    # Also catalog Safari misc subfolders
    if (-not $SkipSafari -and (Test-Path -LiteralPath $SafariRoot)) {
        $safariCustomers = Get-ChildItem -Path $SafariRoot -Directory
        foreach ($sc in $safariCustomers) {
            $subfolders = @(Get-ChildItem -LiteralPath $sc.FullName -Directory -ErrorAction SilentlyContinue)
            foreach ($sub in $subfolders) {
                if ($sub.Name -match '^WO\d+' -or $sub.Name -match '^\d{4}$') { continue }

                $totalMisc++
                $fc = @(Get-ChildItem -LiteralPath $sub.FullName -File -Recurse -ErrorAction SilentlyContinue).Count

                $recommendation = "REVIEW"
                if ($fc -eq 0) { $recommendation = "DELETE_EMPTY" }

                Add-ReviewItem "NON_WO_SUBFOLDER" $sub.FullName "Safari\$($sc.Name)" "$($sub.Name) | ${fc} files" $recommendation
            }
        }
    }

    Write-Log "Non-WO subfolders cataloged: $totalMisc"
    Write-Log "Review file: $ReviewFile"
}


# ============================================================================
# PHASE 6: Identify Safari/Root duplicate customers
# ============================================================================

function Invoke-Phase6 {
    Write-Log ""
    Write-Log "============================================="
    Write-Log "PHASE 6: Identify Safari/Root duplicate customers"
    Write-Log "============================================="
    Write-Log ""

    if (-not (Test-Path -LiteralPath $SafariRoot)) {
        Write-Log "Safari folder not found. Skipping."
        return
    }

    $rootNames = @{}
    Get-ChildItem -Path $DriveRoot -Directory |
        Where-Object { $ProtectedFolders -notcontains $_.Name } |
        ForEach-Object { $rootNames[$_.Name.ToUpper().Trim()] = $_.FullName }

    $safariCustomers = Get-ChildItem -Path $SafariRoot -Directory
    $dupeCount = 0

    # Write header to duplicates file
    "Safari_Path`tRoot_Path`tSafari_WOs`tRoot_WOs`tSafari_Size_MB`tRoot_Size_MB`tRecommendation" |
        Out-File -FilePath $DuplicateFile -Encoding UTF8

    foreach ($sc in $safariCustomers) {
        $normalizedName = $sc.Name.ToUpper().Trim()

        if ($rootNames.ContainsKey($normalizedName)) {
            $dupeCount++

            $rootPath   = $rootNames[$normalizedName]
            $safariPath = $sc.FullName

            # Count WO folders in each
            $safariWOs = @(Get-ChildItem -LiteralPath $safariPath -Directory -ErrorAction SilentlyContinue |
                Where-Object { $_.Name -match '^WO\d+' }).Count
            $rootWOs = @(Get-ChildItem -LiteralPath $rootPath -Directory -ErrorAction SilentlyContinue |
                Where-Object { $_.Name -match '^WO\d+' }).Count

            # Approximate size
            $safariSize = 0
            $rootSize = 0
            try {
                $safariSize = [math]::Round(
                    (Get-ChildItem -LiteralPath $safariPath -File -Recurse -ErrorAction SilentlyContinue |
                        Measure-Object -Property Length -Sum -ErrorAction SilentlyContinue).Sum / 1MB, 1)
            } catch {}
            try {
                $rootSize = [math]::Round(
                    (Get-ChildItem -LiteralPath $rootPath -File -Recurse -ErrorAction SilentlyContinue |
                        Measure-Object -Property Length -Sum -ErrorAction SilentlyContinue).Sum / 1MB, 1)
            } catch {}

            # Recommendation: keep the one with more WOs, merge smaller into larger
            $recommendation = if ($rootWOs -ge $safariWOs) { "MERGE_SAFARI_INTO_ROOT" } else { "MERGE_ROOT_INTO_SAFARI" }
            if ($safariWOs -eq 0 -and $rootWOs -eq 0) { $recommendation = "BOTH_EMPTY_REVIEW" }

            "$safariPath`t$rootPath`t$safariWOs`t$rootWOs`t${safariSize}`t${rootSize}`t$recommendation" |
                Out-File -FilePath $DuplicateFile -Append -Encoding UTF8

            Write-Log ('DUPE: {0} - Safari: {1} WOs ({2} MB) | Root: {3} WOs ({4} MB) -> {5}' -f $normalizedName, $safariWOs, $safariSize, $rootWOs, $rootSize, $recommendation)
        }
    }

    Write-Log ""
    Write-Log "Duplicate customers found: $dupeCount"
    Write-Log "Duplicates report: $DuplicateFile"
}


# ============================================================================
# PHASE 7: Generate DB update script for ERP customer records
# ============================================================================

function Invoke-Phase7 {
    Write-Log ""
    Write-Log "============================================="
    Write-Log "PHASE 7: Generate ERP database update script"
    Write-Log "============================================="
    Write-Log ""

    $sqlFile = Join-Path $LogDir "drive-db-update-$Timestamp.sql"

    $r = @()
    $r += "-- Auto-generated: Update Customer.networkDriveFolderPath after drive standardization"
    $r += "-- Run this against the ERP database after the drive changes are applied."
    $r += "-- Generated: $Timestamp"
    $r += ""

    # Read the rename map to find customer folder renames
    if (Test-Path -LiteralPath $RenameMapFile) {
        $renames = Get-Content $RenameMapFile -Encoding UTF8
        foreach ($line in $renames) {
            $parts = $line -split "`t"
            if ($parts.Count -lt 3) { continue }

            $oldPath = $parts[0]
            $newPath = $parts[1]
            $desc    = $parts[2]

            # Only care about top-level customer folder renames
            $oldParent = Split-Path $oldPath
            if ($oldParent -ne $DriveRoot.TrimEnd('\')) { continue }

            $oldName = Split-Path $oldPath -Leaf
            $newName = Split-Path $newPath -Leaf

            # Generate SQL to update any customers whose name matches this old folder
            $escapedOld = $oldName -replace "'", "''"
            $escapedNew = $newName -replace "'", "''"

            $r += "-- Rename: $desc"
            $r += "UPDATE ""Customer"" SET ""networkDriveFolderPath"" = '$escapedNew'"
            $r += "  WHERE (""name"" ILIKE '$escapedOld' OR ""companyName"" ILIKE '$escapedOld')"
            $r += "  AND (""networkDriveFolderPath"" IS NULL OR ""networkDriveFolderPath"" = '' OR ""networkDriveFolderPath"" = '$escapedOld');"
            $r += ""
        }
    }

    $r += ""
    $r += "-- Bulk set networkDriveFolderPath for customers that don't have one yet"
    $r += "-- This uses UPPER(name) to match the new standardized folder names"
    $r += "UPDATE ""Customer"" SET ""networkDriveFolderPath"" = UPPER(""name"")"
    $r += "  WHERE ""networkDriveFolderPath"" IS NULL"
    $r += "  AND ""isActive"" = true;"

    $r | Out-File $sqlFile -Encoding UTF8
    Write-Log "SQL update script written to: $sqlFile"
}


# ============================================================================
# MAIN EXECUTION
# ============================================================================

Write-Host ""
Write-Host "================================================================" -ForegroundColor White
Write-Host "  NETWORK DRIVE STANDARDIZATION" -ForegroundColor White
Write-Host "  Target: $DriveRoot (\\wildesigns-fs1\Company Files)" -ForegroundColor White
if ($DryRun) {
    Write-Host "  MODE: DRY RUN (no changes will be made)" -ForegroundColor Cyan
} else {
    Write-Host "  MODE: *** LIVE EXECUTION ***" -ForegroundColor Red
}
Write-Host "  Phases: $($Phase -join ', ')" -ForegroundColor White
Write-Host "  Log: $LogFile" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor White
Write-Host ""

# Safety check
if (-not $DryRun) {
    Write-Host "WARNING: This will modify files on the network drive!" -ForegroundColor Red
    Write-Host "Make sure no one has files open and it's off business hours." -ForegroundColor Red
    $confirm = Read-Host "Type 'YES-EXECUTE' to proceed"
    if ($confirm -ne 'YES-EXECUTE') {
        Write-Host "Aborted." -ForegroundColor Yellow
        exit 1
    }
}

# Verify drive is accessible
if (-not (Test-Path -LiteralPath $DriveRoot)) {
    Write-Host "ERROR: Drive root not accessible: $DriveRoot" -ForegroundColor Red
    Write-Host "Make sure S: is mapped to \\wildesigns-fs1\Company Files" -ForegroundColor Red
    exit 1
}

# Initialize log files
"Operation`tSource`tDestination`tDescription" | Out-File -FilePath $RenameMapFile -Encoding UTF8
"Category`tCustomer`tPath`tDescription`tRecommendation" | Out-File -FilePath $ReviewFile -Encoding UTF8

$startTime = Get-Date
Write-Log "Started at $startTime"
Write-Log "Mode: $(if ($DryRun) { 'DRY RUN' } else { 'EXECUTE' })"
Write-Log ""

# Run requested phases
if ($Phase -contains 1) { Invoke-Phase1 }
if ($Phase -contains 2) { Invoke-Phase2 }
if ($Phase -contains 3) { Invoke-Phase3 }
if ($Phase -contains 4) { Invoke-Phase4 }
if ($Phase -contains 5) { Invoke-Phase5 }
if ($Phase -contains 6) { Invoke-Phase6 }
if ($Phase -contains 7) { Invoke-Phase7 }

# Summary
$endTime = Get-Date
$duration = $endTime - $startTime

Write-Host ""
Write-Host "================================================================" -ForegroundColor White
Write-Host "  SUMMARY" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor White
Write-Host "  Duration:          $([math]::Round($duration.TotalMinutes, 1)) minutes" -ForegroundColor White
Write-Host "  Renames planned:   $($script:Stats.RenamesPlanned)" -ForegroundColor $(if ($DryRun) { "Cyan" } else { "White" })
Write-Host "  Renames executed:  $($script:Stats.RenamesExecuted)" -ForegroundColor $(if ($script:Stats.RenamesExecuted -gt 0) { "Green" } else { "White" })
Write-Host "  Moves planned:     $($script:Stats.MovesPlanned)" -ForegroundColor $(if ($DryRun) { "Cyan" } else { "White" })
Write-Host "  Moves executed:    $($script:Stats.MovesExecuted)" -ForegroundColor $(if ($script:Stats.MovesExecuted -gt 0) { "Green" } else { "White" })
Write-Host "  Deletes planned:   $($script:Stats.DeletesPlanned)" -ForegroundColor $(if ($DryRun) { "Cyan" } else { "White" })
Write-Host "  Deletes executed:  $($script:Stats.DeletesExecuted)" -ForegroundColor $(if ($script:Stats.DeletesExecuted -gt 0) { "Green" } else { "White" })
Write-Host "  Errors:            $($script:Stats.Errors)" -ForegroundColor $(if ($script:Stats.Errors -gt 0) { "Red" } else { "White" })
Write-Host "  Items for review:  $($script:Stats.ReviewItems)" -ForegroundColor $(if ($script:Stats.ReviewItems -gt 0) { "Yellow" } else { "White" })
Write-Host ""
Write-Host "  Output files:" -ForegroundColor White
Write-Host "    Log:         $LogFile" -ForegroundColor Gray
Write-Host "    Rename map:  $RenameMapFile" -ForegroundColor Gray
Write-Host "    Review:      $ReviewFile" -ForegroundColor Gray
Write-Host "    Duplicates:  $DuplicateFile" -ForegroundColor Gray
if ($Phase -contains 7) {
    $sqlFile = Join-Path $LogDir "drive-db-update-$Timestamp.sql"
    Write-Host "    SQL:         $sqlFile" -ForegroundColor Gray
}
Write-Host "================================================================" -ForegroundColor White
Write-Host ""

if ($DryRun) {
    Write-Host "This was a DRY RUN. No changes were made." -ForegroundColor Cyan
    Write-Host "Review the output files, then run with -Execute to apply changes." -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  .\standardize-network-drive.ps1 -Execute" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To run a single phase:" -ForegroundColor Cyan
    Write-Host "  .\standardize-network-drive.ps1 -Execute -Phase 1" -ForegroundColor Yellow
    Write-Host ""
}

Write-Log "Completed at $endTime (Duration: $([math]::Round($duration.TotalMinutes, 1)) min)"
