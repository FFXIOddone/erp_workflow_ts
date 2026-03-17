# Auto-Link Print Jobs via Recorded File Paths

**Date**: 2025-07-15  
**Goal**: Automatically link print instances (Thrive and Fiery) to work orders by recording the source file path when a job is loaded into the RIP, then extracting the WO number from that path.

## Problem

Currently, linking print jobs to orders relies on:
1. WO number appearing in the job name (unreliable — depends on operator naming)
2. Manual linking via the UI (slow, requires human intervention)
3. Cross-referencing normalized job names between Thrive ↔ Fiery (works but indirect)
4. Description-based fuzzy matching (new, but has false positive risk)

The most reliable data source is the **file path** on the network drive, which follows a consistent structure:

```
S:\CustomerName\WO#####_description\PRINT\filename.pdf
S:\Safari\CustomerName\WO#####_description\PRINT\filename.pdf
```

Both Thrive and Fiery know the source file path when a job is loaded. If we record this path, we can extract the WO number with near-100% accuracy.

## Architecture

### Data Flow

```
Network Drive (S:\) → Thrive RIP → QueueXML.Info → ERP polls → Extract WO from path
                    → Fiery XF  → JDF files      → ERP polls → Extract WO from Thrive lookup
```

### Phase 1: Record File Paths at Scan Time

#### Thrive (QueueXML.Info)
- **Current**: `thrive.ts` → `getAllThriveJobs()` reads QueueXML.Info XML files
- **Change**: The `<FileName>` element in QueueXML.Info already contains the full source path (e.g., `S:\CustomerName\WO64058_signs\PRINT\design.pdf`)
- **Action**: Parse the `<FileName>` field to extract the source path, store it as `sourceFilePath` on the job object
- **WO Extraction**: Use `parseThrivePath()` (already exists in `fiery.ts`) to extract WO# and customer name from the path

**Affected files:**
- [ ] `packages/server/src/services/thrive.ts` — Add `sourceFilePath` to `ThrivePrintJob` interface
- [ ] `packages/server/src/services/thrive.ts` — Extract `<FileName>` in `parseQueueXmlFile()` and populate `sourceFilePath`
- [ ] `packages/server/src/services/thrive.ts` — Use path parsing to set `workOrderNumber` from file path when direct WO match fails

#### Fiery (JDF + Thrive Cross-Reference)
- **Current**: `fiery.ts` → `getAllFieryJobs()` already does Thrive cross-referencing via `buildThriveJobLookup()`
- **Change**: Already implemented — `parseThrivePath()` extracts WO# from the Thrive source file path
- **Enhancement**: Record the resolved file path on FieryJob for audit/display purposes
- **Action**: Add `sourceFilePath` field to FieryJob and populate from Thrive match

**Affected files:**
- [ ] `packages/server/src/services/fiery.ts` — Add `sourceFilePath` to `FieryJob` interface (use `thriveFilePath` which already exists)
- [ ] Already functional via `buildThriveJobLookup()` → `parseThrivePath()`

### Phase 2: Enhanced WO Resolution in Polling

When the equipment endpoint polls for jobs matching an order, use the file path as a primary matching strategy:

```
1. Exact WO# match (from file path parsing) — HIGH confidence
2. WO# in job name — HIGH confidence  
3. Cross-reference Thrive ↔ Fiery — MEDIUM confidence
4. Description fuzzy match — LOW confidence
5. Manual link — USER override
```

**Affected files:**
- [ ] `packages/server/src/routes/equipment.ts` — In `/thrive/workorder/:orderNumber`, prefer file-path-based WO matching

### Phase 3: Persistent Link Records (Optional Future)

Instead of re-matching every poll, persist discovered links:

- [ ] Add `PrintJobLink` model to Prisma schema:
  ```prisma
  model PrintJobLink {
    id            String   @id @default(uuid())
    workOrderId   String
    jobSource     String   // 'THRIVE' | 'FIERY'
    jobIdentifier String   // Job GUID or Fiery Job ID
    sourceFilePath String?
    confidence    String   // 'HIGH' | 'MEDIUM' | 'LOW'
    matchMethod   String   // 'FILE_PATH' | 'JOB_NAME' | 'CROSS_REF' | 'DESCRIPTION' | 'MANUAL'
    createdAt     DateTime @default(now())
    
    workOrder     WorkOrder @relation(fields: [workOrderId], references: [id])
    @@unique([workOrderId, jobSource, jobIdentifier])
  }
  ```
- [ ] Auto-create link records when high-confidence matches are found
- [ ] Skip re-scanning for jobs that already have persistent links
- [ ] Show match confidence in the UI

## Implementation Order

1. **Thrive source file path extraction** — Modify `parseQueueXmlFile()` to read `<FileName>` and set `sourceFilePath`
2. **WO resolution from path** — Apply `parseThrivePath()` to Thrive jobs when WO# isn't in the job name
3. **Test with real data** — Verify that QueueXML.Info files contain the expected `<FileName>` format
4. **Fiery alignment** — Ensure FieryJob.thriveFilePath is surfaced in the UI
5. **(Future)** Persistent link records for performance optimization

## Verification

- [ ] Thrive print jobs show `sourceFilePath` in API response
- [ ] Jobs with file paths in `S:\Customer\WO#####\` format auto-resolve to the correct WO
- [ ] Fiery jobs cross-referenced via Thrive show the source file path
- [ ] PrinterInfoCard displays source match information
- [ ] False positive rate is lower than description-based matching

## Risks

- **QueueXML.Info format**: Need to verify the `<FileName>` element consistently contains the full UNC/drive path
- **Safari subfolder**: Some paths use `S:\Safari\CustomerName\WO...` — `parseThrivePath()` already handles this
- **Non-standard paths**: Some jobs may be loaded from non-standard locations (Desktop, Downloads) — these won't have WO info
- **Performance**: Thrive cross-reference scan is already done; file path parsing adds minimal overhead
