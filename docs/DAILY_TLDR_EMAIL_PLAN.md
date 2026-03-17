# Daily TL;DR Summary Email — Implementation Plan

## Overview

A single end-of-day email sent to managers/admins that summarizes the entire day's activity across the shop. The goal: one glance tells you how the day went — what shipped, what's printing, what consumables are running low, and a letter grade for overall performance.

---

## Email Sections

### 1. Orders Shipped Today
- Query `WorkOrder` where `status = SHIPPED` and last `StationProgress` for `SHIPPING_RECEIVING` has `completedAt` = today.
- Show: order number, customer name, description (truncated).
- Count badge: **"4 orders shipped"**.

### 2. Orders Currently in Printing
- Query `WorkOrder` where `status = IN_PROGRESS` and has a `StationProgress` for any printing station (`ROLL_TO_ROLL`, `FLATBED`, `SCREEN_PRINT`) with `status = IN_PROGRESS`.
- Show: order number, customer, which station, how long it's been there (time since `startedAt`).

### 3. Orders Currently in Production
- Same pattern but for `PRODUCTION` station.
- Show: order number, customer, station, time elapsed.

### 4. Win of the Day (Best KPI)
- Calculate a set of KPI values (see Grading section below), pick the highest-scoring one, and call it out.
- Example: *"Best KPI: On-time delivery rate — 100% (5/5 orders delivered on time)"*.

### 5. Struggle of the Day (Lowest KPI)
- Pick the lowest-scoring KPI and highlight it.
- Example: *"Needs attention: Average cycle time — 6.2 days (target: 4 days)"*.

### 6. Consumables Needing Reorder
- Reuse `evaluateRule()` logic from the Equipment Watch service — query all active consumable watch rules and show items that are currently triggering.
- Alternatively, run a standalone check: VUTEk ink ≤ 30%, HP ink ≤ 20%, HP maintenance ≤ 25%.
- Show: equipment name, component, current level, color-coded bar.

### 7. Daily Performance Grade
- Letter grade (A+ through F) with a percentage score.
- Formula detailed below.

---

## Grading Formula

The grade is a weighted composite of measurable KPIs. Each KPI produces a 0–100 score, then the weighted average maps to a letter.

### KPI Components

| KPI | Weight | How to Calculate | 100 Score | 0 Score |
|-----|--------|------------------|-----------|---------|
| **On-Time Delivery Rate** | 30% | Orders shipped today that had `dueDate ≥ today` ÷ total orders shipped today. If none shipped, use trailing 7-day average. | 100% on-time | 0% on-time |
| **Orders Completed** | 20% | Orders that moved to `COMPLETED` or `SHIPPED` today ÷ trailing 30-day daily average (`averageOrdersPerDay` from `generateProductionStats()`). Score = min(actual/average × 100, 100). | ≥ average | 0 orders |
| **Cycle Time** | 15% | Average days from `createdAt` to completion for orders completed today. Compare to 30-day trailing average. Score = max(0, 100 − (actual − target) × 20). Target = trailing avg. | ≤ trailing avg | 2× trailing avg |
| **Overdue Orders** | 15% | Count of orders past `dueDate` that are not completed/shipped/cancelled. Score = max(0, 100 − overdueCount × 10). | 0 overdue | 10+ overdue |
| **Station Throughput** | 10% | `StationProgress` completions today ÷ trailing 30-day daily average. Score = min(actual/average × 100, 100). | ≥ average | 0 completions |
| **Equipment Uptime** | 10% | Percentage of monitored equipment that is currently reachable (from `getAllCachedStatuses()`). | 100% online | 0% online |

### Grade Scale

| Score Range | Grade |
|-------------|-------|
| 97–100 | A+ |
| 93–96  | A  |
| 90–92  | A− |
| 87–89  | B+ |
| 83–86  | B  |
| 80–82  | B− |
| 77–79  | C+ |
| 73–76  | C  |
| 70–72  | C− |
| 67–69  | D+ |
| 63–66  | D  |
| 60–62  | D− |
| < 60   | F  |

### Edge Cases
- **No orders shipped today**: On-Time Delivery uses trailing 7-day window instead.
- **Zero trailing average**: If `averageOrdersPerDay` is 0, skip that KPI and redistribute weight.
- **Weekend/holiday**: Grade still calculates but weights shift — skip "Orders Completed" if nobody is clocked in.
- **First week of deployment**: Use absolute targets (e.g., 0 overdue = 100, cycle time < 5 days = 100) until 30-day trailing data is available.

---

## Technical Architecture

### New Files

| File | Purpose |
|------|---------|
| `packages/server/src/services/daily-summary.ts` | Core service: gather data, calculate KPIs, grade, build HTML |
| `packages/server/src/routes/daily-summary.ts` | API endpoints: preview, force-send, configure recipients |
| `packages/web/src/pages/DailySummarySettingsPage.tsx` | Settings UI: recipients, send time, toggle sections on/off |

### Database Additions

```prisma
model DailySummaryConfig {
  id              String   @id @default(uuid())
  isActive        Boolean  @default(true)
  sendTime        String   @default("17:30")  // After equipment watch (17:00)
  sendDays        Int[]    @default([1, 2, 3, 4, 5])
  recipients      String[] // Email addresses
  lastSentAt      DateTime?

  // Toggle individual sections
  includeShipped      Boolean @default(true)
  includePrinting     Boolean @default(true)
  includeProduction   Boolean @default(true)
  includeWinStruggle  Boolean @default(true)
  includeConsumables  Boolean @default(true)
  includeGrade        Boolean @default(true)

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model DailySummaryLog {
  id              String   @id @default(uuid())
  sentAt          DateTime @default(now())
  recipients      String[]
  grade           String   // "A-", "B+", etc.
  gradeScore      Float    // 0-100
  kpiSnapshot     Json     // Full KPI breakdown for historical tracking
  success         Boolean  @default(true)
  error           String?

  @@index([sentAt])
}
```

### Service: `daily-summary.ts`

```
┌─────────────────────────────────────────┐
│ calculateDailyKPIs()                     │
│  ├── getOnTimeDeliveryRate()             │  → reuse prisma queries like dashboard-stats
│  ├── getOrdersCompletedScore()           │  → reuse generateProductionStats()
│  ├── getCycleTimeScore()                 │  → reuse averageCompletionDays query  
│  ├── getOverdueScore()                   │  → reuse generateOrderStats().overdueCount
│  ├── getStationThroughputScore()         │  → count StationProgress completedAt = today
│  └── getEquipmentUptimeScore()           │  → getAllCachedStatuses().reachable count
├─────────────────────────────────────────┤
│ calculateGrade(kpis)                     │  → weighted average → letter grade
├─────────────────────────────────────────┤
│ gatherSectionData()                      │
│  ├── getShippedToday()                   │  → WorkOrder + StationProgress query
│  ├── getInPrinting()                     │  → StationProgress IN_PROGRESS at print stations
│  ├── getInProduction()                   │  → StationProgress IN_PROGRESS at PRODUCTION
│  ├── getConsumablesLow()                 │  → reuse evaluateRule() from equipment-watch
│  └── getWinAndStruggle(kpis)             │  → max/min KPI scores
├─────────────────────────────────────────┤
│ buildDailySummaryHtml(sections, grade)   │  → Responsive HTML email template
├─────────────────────────────────────────┤
│ processDailySummary()                    │  → Scheduler entry point (runs every 60s,
│                                          │     checks time/day, sends once per day)
└─────────────────────────────────────────┘
```

### Scheduler Registration

In `packages/server/src/index.ts`, add alongside the existing equipment watch scheduler:

```typescript
import { processDailySummary } from './services/daily-summary.js';

setInterval(async () => {
  try {
    await processDailySummary();
  } catch (error) {
    console.error('❌ Daily summary processor error:', error);
  }
}, 60_000);
console.log('📊 Daily TL;DR summary scheduler started (checking every 60s)');
```

### API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET /api/v1/daily-summary/config` | Get current config |
| `PUT /api/v1/daily-summary/config` | Update config (recipients, time, toggles) |
| `POST /api/v1/daily-summary/preview` | Generate and return the full HTML (no send) |
| `POST /api/v1/daily-summary/send` | Force send now |
| `GET /api/v1/daily-summary/history` | List recent DailySummaryLog entries |
| `GET /api/v1/daily-summary/grade/today` | Get today's grade calculation (JSON) |

---

## Email Template Design

```
┌──────────────────────────────────────────────────────┐
│  🏭  WILDE SIGNS — DAILY SUMMARY                     │
│  Thursday, Feb 13, 2026                               │
│                                                       │
│  ┌──────────────────────────────────────────────────┐ │
│  │  TODAY'S GRADE:  B+  (86%)                       │ │
│  │  ████████████████████░░░░                         │ │
│  └──────────────────────────────────────────────────┘ │
│                                                       │
│  ⭐ WIN OF THE DAY                                    │
│  On-time delivery: 100% (4/4 orders on time)          │
│                                                       │
│  ⚠️  NEEDS ATTENTION                                  │
│  Overdue orders: 3 orders past due date               │
│                                                       │
│  ───────────────────────────────────────────          │
│                                                       │
│  📦 ORDERS SHIPPED (4)                                │
│  ┌────────────────────────────────────────┐           │
│  │ WO-2024-0891  │ ABC Corp  │ Banner set │           │
│  │ WO-2024-0893  │ XYZ Inc   │ Vehicle... │           │
│  │ ...                                    │           │
│  └────────────────────────────────────────┘           │
│                                                       │
│  🖨️ IN PRINTING (2)                                   │
│  ┌────────────────────────────────────────┐           │
│  │ WO-2024-0901  │ Roll-to-Roll │ 3h 20m │           │
│  │ WO-2024-0904  │ Flatbed      │ 1h 05m │           │
│  └────────────────────────────────────────┘           │
│                                                       │
│  🔧 IN PRODUCTION (3)                                 │
│  ┌────────────────────────────────────────┐           │
│  │ WO-2024-0899  │ Production │ 5h 10m   │           │
│  │ ...                                    │           │
│  └────────────────────────────────────────┘           │
│                                                       │
│  🧴 CONSUMABLES LOW                                   │
│  ┌────────────────────────────────────────┐           │
│  │ VUTEk  │ Cyan Ink    │ ████░░░░ 22%   │           │
│  │ HP 365 │ Magenta     │ █████░░░ 18%   │           │
│  └────────────────────────────────────────┘           │
│                                                       │
│  ───────────────────────────────────────────          │
│                                                       │
│  📊 KPI BREAKDOWN                                     │
│  On-Time Delivery   ████████████████████ 100%  (30%) │
│  Orders Completed   ████████████████░░░░  82%  (20%) │
│  Cycle Time         ██████████████░░░░░░  72%  (15%) │
│  Overdue Orders     ████████████████████ 100%  (15%) │
│  Station Throughput ██████████████████░░  90%  (10%) │
│  Equipment Uptime   ████████████████████ 100%  (10%) │
│                                                       │
│  © 2026 Wilde Signs · Equipment Monitoring System     │
└──────────────────────────────────────────────────────┘
```

---

## Data Sources Summary

| Section | Primary Query | Existing Code to Reuse |
|---------|--------------|----------------------|
| Orders Shipped | `WorkOrder` + `StationProgress` where `SHIPPING_RECEIVING.completedAt` = today | `generateOrderStats()` in dashboard-stats.ts |
| In Printing | `StationProgress` where station ∈ printing methods, status = `IN_PROGRESS` | `generateProductionStats().stationWorkload` |
| In Production | `StationProgress` where station = `PRODUCTION`, status = `IN_PROGRESS` | Same as above |
| Win/Struggle | Max/min of calculated KPI scores | New calculation |
| Consumables | `evaluateRule()` or direct `getCachedVUTEkInkData()` + `getAllCachedStatuses()` | Equipment watch evaluators |
| Grade | Weighted KPI composite | New calculation, reuses dashboard-stats queries |

---

## Implementation Order

1. **Database**: Add `DailySummaryConfig` + `DailySummaryLog` models, run `prisma db push`.
2. **Service layer**: Build `daily-summary.ts` — KPI calculators, grade formula, HTML builder, scheduler.
3. **API routes**: CRUD config, preview, force-send, history.
4. **Scheduler**: Register in `index.ts` with 60s interval.
5. **Frontend**: Settings page with recipient list, send time, day toggles, section toggles, preview button, grade preview card.
6. **Navigation**: Add "Daily Summary" under Admin or Reports category in sidebar.

### Estimated Effort
- Backend service + grade formula: ~300 lines
- HTML email template: ~200 lines
- API routes: ~150 lines
- Frontend settings page: ~400 lines
- Total: ~1,050 lines across 4 files + schema additions

---

## Future Enhancements

- **Historical grade chart**: Plot daily grades over time on a dashboard widget.
- **Per-station breakdown**: Show cycle time and throughput per station, not just aggregate.
- **Comparison to previous day/week**: "↑ 12% more orders shipped vs. yesterday."
- **Slack/Teams integration**: Post the summary to a channel instead of/in addition to email.
- **Custom KPI weights**: Let the user adjust KPI weights from the settings page.
- **Weekend mode**: Different thresholds or skip entirely on non-work days.
- **Employee-specific summaries**: Each operator gets their own performance summary.
