# Wilde Signs ERP - Native App Architecture

## Overview

Native Tauri-based desktop and mobile applications for shop floor operations. Designed for reliability, speed, and offline capability.

---

## Application Suite

### Desktop Apps (Tauri + React)

| App | Target Users | Key Features |
|-----|-------------|--------------|
| **Printing Station** | Flatbed & Roll-to-Roll operators | Hotfolder integration, RIP links, printer status, job queue |
| **Production Station** | Screen print & production floor | Station progress, time tracking, material usage |
| **Shipping Station** | Shipping & receiving | Package scanning, FedEx/UPS integration, receiving |
| **Design Station** | Designers | File management, proof generation, customer communication |
| **Order Entry** | Sales & admin | QuickBooks-style UI, quote creation, customer management |

### Mobile App (React Native / Capacitor)

| App | Target Users | Key Features |
|-----|-------------|--------------|
| **Installer** | Field installation crews | Offline job viewing, photo capture, time tracking, GPS |

---

## Technical Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SHOP FLOOR APPS                              │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐       │
│  │  Printing  │ │ Production │ │  Shipping  │ │   Design   │       │
│  │  Station   │ │  Station   │ │  Station   │ │  Station   │       │
│  └─────┬──────┘ └─────┬──────┘ └─────┬──────┘ └─────┬──────┘       │
│        │              │              │              │               │
│        └──────────────┴──────────────┴──────────────┘               │
│                              │                                       │
│                    ┌─────────┴─────────┐                            │
│                    │  TAURI CORE LIB   │                            │
│                    │  (Shared Rust)    │                            │
│                    │  • File ops       │                            │
│                    │  • Serial ports   │                            │
│                    │  • Equipment      │                            │
│                    │  • Offline sync   │                            │
│                    │  • Hotfolders     │                            │
│                    └─────────┬─────────┘                            │
│                              │                                       │
│            ┌─────────────────┼─────────────────┐                    │
│            │                 │                 │                    │
│   ┌────────┴────────┐ ┌──────┴──────┐ ┌───────┴───────┐            │
│   │ Order Entry     │ │ React UI    │ │ Local SQLite  │            │
│   │ (QB-style)      │ │ (shared)    │ │ Cache         │            │
│   └─────────────────┘ └─────────────┘ └───────────────┘            │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   │ REST + WebSocket
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         CENTRAL SERVER                               │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Express API (existing)                    │   │
│  │                    PostgreSQL Database                       │   │
│  │                    WebSocket (real-time)                     │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         MOBILE / FIELD                               │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                  INSTALLER APP (Capacitor)                   │   │
│  │  • Offline-first architecture                               │   │
│  │  • SQLite local storage (~50 jobs max)                      │   │
│  │  • Background sync when on WiFi                             │   │
│  │  • Photo compression before upload                          │   │
│  │  • Works on 5-year-old devices                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                  CUSTOMER PORTAL (Web PWA)                   │   │
│  │  • Proof approval                                           │   │
│  │  • Order status                                             │   │
│  │  • File upload                                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Installer App - Offline Calculation

### Storage Budget per Job

| Data Type | Size | Notes |
|-----------|------|-------|
| Job JSON | ~5 KB | Order details, customer, routing |
| Address/GPS | ~1 KB | Cached geocoding |
| Thumbnails | ~50 KB | 3-5 compressed thumbnails per job |
| Install docs | ~100 KB | Compressed PDFs if needed |
| **Total per job** | **~160 KB** | Conservative estimate |

### Device Storage Targets

| Device Age | Available Storage | Recommended Jobs | Total Size |
|------------|------------------|------------------|------------|
| 5 years old (budget) | 500 MB free | 50 jobs | ~8 MB |
| 3 years old | 1 GB free | 100 jobs | ~16 MB |
| Current | 2+ GB free | 200 jobs | ~32 MB |

### Sync Strategy

1. **Priority Sync**: Jobs scheduled for next 7 days synced first
2. **Background Sync**: When on WiFi, sync remaining assigned jobs
3. **Photo Queue**: Compress photos to 1080p, queue for upload when connected
4. **Conflict Resolution**: Last-write-wins for status, merge for notes/photos

---

## Desktop App Features by Station

### Printing Station
```
┌─────────────────────────────────────────────────────────────────┐
│ PRINTING STATION                                    [_][□][X]   │
├─────────────────────────────────────────────────────────────────┤
│ Print Queue                              Hotfolder Status       │
│ ┌─────────────────────────────────┐     ┌──────────────────┐   │
│ │ □ WO-12345 - Banner 4x8        │     │ Onyx: ✓ Ready    │   │
│ │   → Drag to RIP or click Send  │     │ Flexi: ✓ Ready   │   │
│ │ □ WO-12346 - Vehicle Wrap      │     │ VersaWorks: Busy │   │
│ │ □ WO-12347 - Window Graphics   │     └──────────────────┘   │
│ └─────────────────────────────────┘                             │
│                                                                  │
│ Printer Status                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ HP Latex 570  │ ████████░░ 80% │ Printing WO-12340         │ │
│ │ Roland 540    │ Idle           │ Ready                      │ │
│ │ Mimaki JV150  │ ██████████ 100%│ Complete - Remove media   │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Production Station
```
┌─────────────────────────────────────────────────────────────────┐
│ PRODUCTION STATION                                  [_][□][X]   │
├─────────────────────────────────────────────────────────────────┤
│ My Station: SCREEN_PRINT                    Logged in: Mike     │
│                                                                  │
│ Active Job                                   Queue (5 jobs)     │
│ ┌─────────────────────────────────┐         ┌───────────────┐  │
│ │ WO-12345                        │         │ WO-12346 (2h) │  │
│ │ Customer: ABC Corp              │         │ WO-12347 (1h) │  │
│ │ 500x Yard Signs                 │         │ WO-12348 (3h) │  │
│ │                                 │         │ WO-12349 (1h) │  │
│ │ ⏱ 01:45:20                     │         │ WO-12350 (4h) │  │
│ │                                 │         └───────────────┘  │
│ │ [Complete Station] [Issue/Hold]│                              │
│ └─────────────────────────────────┘                             │
│                                                                  │
│ Equipment: Zund G3 XL                                           │
│ Today: 145 cuts │ 12.5 hrs │ 2,340 sq ft                       │
└─────────────────────────────────────────────────────────────────┘
```

### Order Entry (QuickBooks Style)
```
┌─────────────────────────────────────────────────────────────────┐
│ File  Edit  Lists  Company  Customers  Vendors  Reports  Help   │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────┐                                                  │
│ │ Home        │  Customers                                       │
│ │ ─────────── │  ┌──────────────────────────────────────────┐   │
│ │ Customers   │  │ ☐ Create Invoice   ☐ Create Estimate     │   │
│ │ Orders      │  │ ☐ Receive Payment  ☐ Create Sales Order  │   │
│ │ Estimates   │  └──────────────────────────────────────────┘   │
│ │ Invoices    │                                                  │
│ │ ─────────── │  Work Orders                                    │
│ │ Reports     │  ┌──────────────────────────────────────────┐   │
│ │ Settings    │  │ ☐ New Work Order   ☐ Work Order List     │   │
│ └─────────────┘  │ ☐ Station Status   ☐ Production Schedule │   │
│                  └──────────────────────────────────────────┘   │
│                                                                  │
│  Recent Work Orders                                              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ WO-12345  │ ABC Corp      │ $1,234.00 │ IN_PROGRESS     │   │
│  │ WO-12344  │ XYZ Inc       │ $567.00   │ PENDING         │   │
│  │ WO-12343  │ 123 Signs     │ $890.00   │ COMPLETED       │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Package Structure

```
packages/
├── shared/                    # Existing - TypeScript types
├── server/                    # Existing - Express API
├── web/                       # Existing - React web app (keep for remote access)
├── portal/                    # Existing - Customer portal
│
├── tauri-core/               # NEW - Shared Rust library
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs
│       ├── file_ops.rs       # File system operations
│       ├── serial.rs         # Serial port for equipment
│       ├── hotfolder.rs      # Hotfolder management
│       ├── offline.rs        # SQLite sync/cache
│       └── equipment/
│           ├── mod.rs
│           ├── zund.rs
│           └── printer.rs
│
├── station-printing/         # Tauri app - Printing
│   ├── src-tauri/
│   ├── src/                  # React UI
│   └── package.json
│
├── station-production/       # Tauri app - Production
├── station-shipping/         # Tauri app - Shipping
├── station-design/           # Tauri app - Design
├── station-order-entry/      # Tauri app - Order Entry (QB-style)
│
├── ui-components/            # NEW - Shared React components
│   ├── src/
│   │   ├── qb-style/        # QuickBooks-style components
│   │   └── station/         # Common station components
│   └── package.json
│
└── mobile-installer/         # Capacitor/React Native
    ├── src/
    ├── android/
    ├── ios/
    └── package.json
```

---

## Development Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Set up Tauri monorepo structure
- [ ] Create tauri-core Rust library with basic file ops
- [ ] Create ui-components package with shared components
- [ ] Build first Tauri shell (Printing Station)

### Phase 2: Printing Station (Week 2-3)
- [ ] Hotfolder integration (Onyx, Flexi, Caldera)
- [ ] File browser with native drag & drop
- [ ] RIP integration (queue files)
- [ ] Printer status (if JDF/SNMP available)

### Phase 3: Production Station (Week 3-4)
- [ ] Station queue view
- [ ] Time tracking with local persistence
- [ ] Zund integration (file watcher)
- [ ] Material tracking

### Phase 4: Order Entry (Week 4-5)
- [ ] QuickBooks-style UI components
- [ ] Customer management
- [ ] Work order creation/editing
- [ ] Quote generation

### Phase 5: Other Stations (Week 5-6)
- [ ] Shipping Station (FedEx/UPS integration)
- [ ] Design Station (file management focus)

### Phase 6: Mobile Installer (Week 6-8)
- [ ] Capacitor setup
- [ ] Offline-first architecture
- [ ] Photo capture & compression
- [ ] Background sync
- [ ] Testing on older devices

---

## Build & Distribution

### Desktop Apps
- **Windows**: MSI installer via Tauri
- **macOS**: DMG installer via Tauri
- Auto-update via Tauri's built-in updater

### Mobile App
- **Android**: APK for sideloading + eventual Play Store
- **iOS**: TestFlight → App Store

---

## Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Desktop cold start | < 2 sec | Tauri is fast |
| Desktop memory | < 100 MB | Per station app |
| Mobile cold start | < 3 sec | On 5-year-old device |
| Mobile memory | < 50 MB | Critical for old devices |
| Offline sync | < 30 sec | For 50 jobs |
| Photo upload | Background | Queue when on WiFi |
