# Equipment Integration Connections

## Summary

| Equipment | IP Address | Status | Connection Type | Auth Required |
|-----------|------------|--------|-----------------|---------------|
| Thrive Flatbed | 192.168.254.53 | ✅ Working | SMB Shares | No |
| Thrive RIP2 | 192.168.254.77 | ✅ Working | SMB Shares | No |
| Fiery (VUTEk) | 192.168.254.57 | ✅ Working | SMB Shares | **admin / (blank)** |
| Zund 1 | 192.168.254.38 | ✅ Working | Via Thrive | No |
| Zund 2 | 192.168.254.28 | ✅ Working | Via Thrive + SMB | User / Wilde1234 |
| FedEx PC | 192.168.254.131 | ✅ Working | SMB Users Share | Shipping1 / Wilde1234 |

---

## Thrive RIP (Onyx)

### Connection Details
- **Thrive Flatbed (WILDE-FLATBEDPC)**: `192.168.254.53`
- **Thrive RIP2 (WS-RIP2)**: `192.168.254.77`
- **Ports**: 80, 443, 8000 (HTTP), 445 (SMB)

### How It Works
Thrive uses MongoDB internally but does NOT expose it externally. Data is accessed via network shares:

| Share | Purpose |
|-------|---------|
| `Thrive22Input_XXXX` | Print queue input hotfolder |
| `Thrive22Cutter_XXXX` | Cut files sent to Zund |
| `Thrive22Data` | Configuration/status data |
| `Thrive22COMMON` | Shared resources |

### Data Location
- **Print Queue**: `\\WS-RIP2\Thrive22Input_xxx\HP Scitex FB700\Info\QueueXML.Info`
- **Cut Files**: `\\WS-RIP2\Thrive22Cutter_xxx\Zund Cut Center\*.xml_tmp`

### Integration Status ✅
- `packages/server/src/services/thrive.ts` - Parses queue files
- `packages/server/src/routes/equipment.ts` - API endpoints
- Work order linking via file path parsing
- Customer name extraction from paths

### Action Items
- [ ] None - fully integrated

---

## Zund Cutters

### Connection Details
- **Zund 1**: `192.168.254.38` - Primary cutter
- **Zund 2**: `192.168.254.28` - Secondary cutter (has `Statistics` share)
- **Ports**: 445 (SMB only)

### How It Works
Zund cutters receive cut files from Thrive via the `Thrive22Cutter_xxx\Zund Cut Center` folder. The Zund machines don't expose APIs - they're controlled by Thrive.

### Data Location
- Cut files are XML format with `<cut-list>` containing:
  - Job name, GUID
  - Dimensions (width, height in mm)
  - Media type, device info

### Integration Status ✅
- Cut jobs are parsed via Thrive integration
- `thriveService.parseCutFile()` handles Zund XML format

### Action Items
- [x] Access Statistics share with credentials (User / Wilde1234) ✅
- [ ] Create Zund service to query production times
- [ ] Correlate cut times with Thrive job queue for WO linking

### Statistics Database (SQLite)
- **Location**: `\\WILDESIGNS-2NDZ\Statistics\Statistic.db3`
- **Credentials**: `User` / `Wilde1234`
- **Size**: ~10MB

**Tables**:
| Table | Records | Description |
|-------|---------|-------------|
| ProductionTimeJob | 22,415 | Cut jobs with start/end times, copies, material |
| ProductionTimes | 101,413 | Detailed per-tool time breakdowns |
| KnifeBitUsage | 113 | Knife/bit wear tracking |

**Note**: Job names in Zund are descriptive (e.g., "MARCH_26-BEER_WOBBLERS-PRINT_CUT.zcc"), not WO#-based. Link to work orders via Thrive queue file paths.

---

## VUTEk / Fiery

### Connection Details
- **Fiery IP**: `192.168.254.57`
- **Ports**: 445 (SMB only)
- **Credentials**: `admin` / (blank password) ✅

### How It Works
The VUTEk printer is controlled by Fiery DFE (Digital Front End). Fiery exports job data to a network share.

### Data Location
- **Share**: `\\192.168.254.57\EFI Export Folder` ✅ ACCESSIBLE
- **Files**:
  - `*.rtl` - Raster print files (large, 100MB+)
  - `*.gif` - Preview thumbnails
  - `*.jdf` - JDF job metadata (XML with dimensions, media, colorants)
  - `*.zcc` - Zund cut contour files

### JDF File Contains
```xml
<Component Dimensions="56984 16838 0" />  <!-- Job size in points -->
<Media Brand="Appleton" MediaType="Paper" Dimension="612 792" />
<ColorantOrder>Cyan, Magenta, Yellow, Black, WHITE_INK</ColorantOrder>
<EFI:VutekProp Media="60 inch Web" Resolution="" PrintMode="" />
```

### Integration Status ✅ Ready

### Action Items
- [ ] Create Fiery service to parse JDF files
- [ ] Link VUTEk jobs to work orders
- [ ] Track production metrics (job size, media usage)

---

## FedEx PC (WS-FEDEX1)

### Connection Details
- **Hostname**: `WS-FEDEX1`
- **IP**: `192.168.254.131`
- **Ports**: 445 (SMB open)
- **Credentials**: `Shipping1` / `Wilde1234` ✅

### How It Works
FedEx Ship Manager stores shipment data locally. We access via the `Users` share.

### Data Location
- **Share**: `\\192.168.254.131\Users` (requires auth)
- **Backup/OneDrive**: `Shipping1\OneDrive - Wilde Signs\Desktop\fedex2\`
  - `Recipient\` - 139 XML files with customer addresses
  - `Reports\` - Export files with shipment history
  - `Sender\` - Sender profile info
  - `000171752_270013422\` - FedEx account/meter info

### Shipment Report Format
Text file exports contain:
```
TRACKING #       ACT WG Service Type                         C NET     LNET
576368625735     3.25   FedEx Ground Service                 11.50     22.36
   Kwik-Fill M0118           SHERYL PARK               2718 State Rte 3     FULTON NY 13069
```

### Integration Status ✅ Accessible

### To Get Live Data
The OneDrive folder `fedex2` contains a backup from October 2022. For **current shipments**:

1. **Configure FedEx Ship Manager to Export Reports**
   - Open FedEx Ship Manager on WS-FEDEX1
   - Go to Reports → Shipment Detail Report
   - Set up automatic export to:
     `C:\Users\Shipping1\OneDrive - Wilde Signs\Desktop\FedExExports\`
   - This will sync via OneDrive

2. **Or Create a Direct Share**
   - On WS-FEDEX1, right-click `C:\FedExExports` → Properties → Sharing
   - Share name: `FedExExports`
   - Grant read access to network

3. **Alternative: FedEx API (Recommended)**
   - Sign up at https://developer.fedex.com
   - Use Track/Ship APIs for real-time data
   - No PC access needed

### Action Items
- [x] Connect to FedEx PC ✅
- [x] Found shipment data format ✅
- [ ] Set up automatic report export on FedEx PC
- [ ] Create FedEx service to parse exported reports

---

## Quick Reference - What You Need

### Already Working
- ✅ Thrive/Onyx print queue monitoring
- ✅ Zund cut job tracking (via Thrive)
- ✅ Work order linking from file paths
- ✅ Customer name extraction
- ✅ Fiery/VUTEk JDF access (admin/blank password)
- ✅ Zund 2 Statistics SQLite (User/Wilde1234)
- ✅ FedEx PC access (Shipping1/Wilde1234)

### Needs Setup
| System | What to Do |
|--------|------------|
| FedEx PC | Configure Ship Manager to export reports to OneDrive folder |

### Needs API Credentials (Optional)
| Service | Where to Get | Keys Needed |
|---------|--------------|-------------|
| FedEx API | developer.fedex.com | Client ID, Client Secret, Account Number |

---

## Integration Priority

1. **FedEx** (High) - Shipping is customer-visible
   - Option A: Set up file share export (quick)
   - Option B: FedEx API integration (better long-term)

2. **Fiery/VUTEk** (Medium) - Completes production visibility
   - Need admin credentials

3. **Zund Statistics** (Low) - Nice-to-have metrics
   - Check what data is in Statistics share

---

## Next Steps

Once you have credentials:

### For FedEx (file-based):
```bash
# Test share access
net use Z: \\WS-FEDEX1\FedExExports /user:DOMAIN\username password
dir Z:\
```

### For Fiery:
```bash
# Test share access
net use F: \\192.168.254.57\EFI Export Folder /user:admin password
dir F:\
```

Then I can create the integration services to:
- Watch for new shipment exports
- Parse Fiery job data
- Link to work orders in ERP
