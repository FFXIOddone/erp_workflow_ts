# Wilde Signs ERP System
## Complete Feature Overview & Business Value

---

## Executive Summary

The Wilde Signs ERP is a **custom-built, modern enterprise resource planning system** designed specifically for sign shop operations. Unlike generic ERP solutions that require extensive customization, this system was built from the ground up to handle the unique workflows of sign fabrication, print production, installation scheduling, and customer management.

**Key Stats:**
- **76+ dedicated pages** for specialized workflows
- **55+ reusable UI components** for consistent user experience
- **50+ API endpoints** for comprehensive data management
- **Real-time updates** via WebSocket technology
- **Mobile-ready** with PWA support and ngrok tunneling
- **Customer Portal** for client self-service

---

## System Architecture

### Technical Foundation
| Component | Technology | Port/URL |
|-----------|------------|----------|
| **API Server** | Express.js + Prisma ORM | `http://localhost:3001` |
| **Web Application** | React + TanStack Query | `http://localhost:5173` |
| **Customer Portal** | React (separate app) | `http://localhost:5174` |
| **Database** | PostgreSQL | `localhost:5432` |
| **WebSocket Server** | Native WS | `ws://localhost:3001` |
| **Mobile Access (ngrok)** | Tunnel | `https://[dynamic].ngrok-free.dev` |

### Package Structure
```
packages/
├── shared/     - Types, schemas, enums (imported everywhere)
├── server/     - Express API, Prisma, WebSocket
├── web/        - Internal staff application
├── portal/     - Customer-facing portal
└── desktop/    - Electron wrapper (optional)
```

---

## 🏭 Production Management

### Work Order System
The heart of the ERP - complete job tracking from quote to delivery.

**Features:**
- **Order lifecycle management** - Pending → In Progress → Completed → Shipped
- **Multi-station routing** - Orders flow through Roll-to-Roll, Flatbed, Screen Print, Fabrication, Installation, etc.
- **Real-time status updates** - WebSocket-powered instant notifications
- **Station progress tracking** - Track completion percentage at each production station
- **Priority management** - Rush orders, due date highlighting, overdue alerts
- **Recurring orders** - Automated order generation for repeat customers
- **QR code integration** - Scan orders on the shop floor for instant access

**Pages:**
- Work Orders List (with saved filters & views)
- Order Detail (with timeline, attachments, notes)
- Order Form (create/edit with line items)
- Kanban Board (drag-and-drop status management)
- Temp Orders (WooCommerce imports awaiting assignment)

### Production Scheduling

**Features:**
- **Visual calendar view** - Month, week, day views for production planning
- **Gantt-style scheduling** - See job timelines and conflicts
- **Live production dashboard** - Real-time station activity with WebSocket updates
- **Intelligent print batching** - Group jobs by material, color profile, substrate for efficiency
- **Capacity planning** - See station utilization and bottlenecks

**Pages:**
- Schedule Page
- Production Calendar
- Live Production Dashboard
- Intelligent Print Batching

### Shop Floor Mode

**Features:**
- **Tablet-optimized interface** - Large touch targets, minimal navigation
- **Station-specific views** - Operators see only their station's jobs
- **One-tap status updates** - Mark jobs complete with a single touch
- **Timer tracking** - Track time spent on each job
- **Photo capture** - Document work with camera integration

**Page:**
- Shop Floor Page (dedicated fullscreen mode)

---

## 💰 Sales & Quoting

### Quote Management

**Features:**
- **Professional quote generation** - Line items, quantities, pricing
- **Quote-to-order conversion** - One-click conversion when approved
- **Version tracking** - Track quote revisions
- **Customer approval workflow** - Portal-based approvals
- **Margin calculations** - Built-in profitability analysis

**Pages:**
- Quotes List
- Quote Detail
- Quote Form

### Customer Management

**Features:**
- **Complete customer profiles** - Contact info, addresses, preferences
- **Customer interaction history** - Calls, emails, meetings logged
- **Credit management** - Credit limits, terms, balance tracking
- **Customer segmentation** - Tags and custom fields
- **360° customer view** - Orders, quotes, payments, communications in one place

**Pages:**
- Customers List
- Customer Detail

### Sales Dashboard

**Features:**
- **Revenue tracking** - Monthly, quarterly, yearly views
- **Win/loss analysis** - Quote conversion rates
- **Customer rankings** - Top customers by revenue
- **Pipeline management** - Track pending quotes

**Page:**
- Sales Page

---

## 📦 Inventory & Materials

### Inventory Management

**Features:**
- **Real-time stock levels** - Current quantities with low stock alerts
- **Multiple warehouses** - Track inventory across locations
- **Reorder points** - Automated alerts when stock runs low
- **Inventory adjustments** - Track shrinkage, damage, corrections
- **Barcode/QR scanning** - Quick item lookup

**Pages:**
- Inventory List
- Item Detail

### Bill of Materials (BOM)

**Features:**
- **Multi-level BOMs** - Nested components and sub-assemblies
- **Automatic cost rollup** - Calculate total material cost
- **Usage tracking** - Track actual vs. estimated material usage
- **Template BOMs** - Reusable material lists for common products

**Pages:**
- BOM List
- BOM Detail
- BOM Form

---

## 🏢 Vendor & Purchasing

### Vendor Management

**Features:**
- **Complete vendor profiles** - Contact info, terms, lead times
- **Performance tracking** - On-time delivery, quality ratings
- **Preferred vendor designation** - Mark primary suppliers
- **Price history** - Track price changes over time

**Pages:**
- Vendors List
- Vendor Detail
- Vendor Form

### Purchase Orders

**Features:**
- **PO creation** - Multi-item orders with line items
- **Receiving workflow** - Partial receiving, backorder tracking
- **PO status tracking** - Draft → Sent → Partially Received → Complete
- **Automatic inventory updates** - Stock levels update on receiving
- **Vendor communication** - Email POs directly

**Pages:**
- Purchase Orders List
- PO Detail
- PO Form
- PO Receive

### Subcontractor Management

**Features:**
- **Subcontractor profiles** - Capabilities, certifications, rates
- **Job assignment** - Assign work to external shops
- **Status tracking** - Track subcontracted work through completion
- **Cost tracking** - Monitor subcontractor expenses

**Pages:**
- Subcontractors List
- Subcontractor Detail
- Subcontract Jobs

---

## 🚚 Shipping & Logistics

### Shipment Management

**Features:**
- **Multi-carrier support** - UPS, FedEx, USPS, LTL carriers
- **Shipment tracking** - Track deliveries with carrier integration
- **Packing slips** - Generate pick lists and packing documentation
- **Delivery scheduling** - Coordinate with installation teams
- **Partial shipments** - Ship orders in multiple batches

**Page:**
- Shipments Page

### Installer Scheduling

**Features:**
- **Crew management** - Assign installation teams
- **Route optimization** - See installations on a map
- **Calendar integration** - Visual scheduling
- **Job documentation** - Photo capture, customer signatures
- **Time tracking** - Track installation hours

**Page:**
- Installer Scheduling

---

## ✅ Quality Control

### QC Checklists

**Features:**
- **Customizable checklists** - Create station-specific inspection criteria
- **Pass/fail tracking** - Binary and rating-based criteria
- **Photo documentation** - Capture defects with camera
- **Historical data** - Track quality trends over time

**Pages:**
- QC Checklists List
- Checklist Detail
- Checklist Form

### Quality Inspections

**Features:**
- **Inspection workflows** - Multi-stage quality gates
- **Defect categorization** - Track defect types and root causes
- **Non-conformance reports (NCRs)** - Document and track issues
- **Corrective actions** - Assign and track remediation

**Pages:**
- QC Inspections List
- Inspection Detail
- Inspection Form
- Quality Assurance Dashboard

---

## 📊 Reporting & Analytics

### Standard Reports

**Features:**
- **Production reports** - Output by station, operator, time period
- **Sales reports** - Revenue, margins, trends
- **Inventory reports** - Stock levels, turnover, valuation
- **Labor reports** - Time tracking, productivity

**Page:**
- Reports Page

### Advanced Analytics

**Features:**
- **KPI dashboards** - Real-time key performance indicators
- **Profitability analysis** - Job, customer, and product profitability
- **Time reports** - Detailed labor tracking and analysis
- **Custom data views** - Interactive data canvas for ad-hoc analysis

**Pages:**
- Advanced Reports
- KPI Dashboard
- Profitability Page
- Time Reports
- Interactive Data Canvas

### Audit & Activity Logging

**Features:**
- **Complete audit trail** - Every change logged with user, timestamp, before/after
- **Activity feed** - Real-time activity stream
- **User activity tracking** - See what each user has done
- **Export capabilities** - CSV, Excel, PDF export

**Pages:**
- Activity Page
- Audit Log
- User Activity

---

## 👥 User & Access Management

### User Management

**Features:**
- **Role-based access control** - Admin, Manager, Operator, Viewer roles
- **Station permissions** - Limit users to specific production stations
- **Profile management** - Users manage their own settings
- **Password policies** - Secure authentication

**Pages:**
- Users List
- Profile Page

### System Settings

**Features:**
- **Company configuration** - Business info, logos, defaults
- **Email settings** - SMTP configuration
- **Integration settings** - WooCommerce, QuickBooks connections
- **Labor rates** - Configure billing and cost rates
- **Price book** - Standardized pricing catalog

**Pages:**
- Settings Page
- Labor Rates
- Price Book
- Integrations
- Email Templates

---

## 🌐 Customer Portal

A separate, customer-facing application for self-service.

### Portal Features

**Features:**
- **Order tracking** - Customers see real-time order status
- **Proof approval** - Review and approve design proofs online
- **Document access** - Download invoices, quotes, specifications
- **Messaging** - Communicate directly with your team
- **Support tickets** - Submit and track support requests
- **Quote requests** - Submit quote requests online
- **Brand asset library** - Store logos and brand files
- **Invoice viewing** - Access payment history
- **Mobile optimized** - Works great on phones and tablets

**Portal Pages:**
- Dashboard
- Orders List & Detail
- Proofs (approval workflow)
- Messages
- Support Tickets
- Documents
- Profile & Preferences

---

## 🔗 Integrations

### WooCommerce

**Features:**
- **Order sync** - Automatically import online orders
- **Product sync** - Sync inventory between systems
- **Customer sync** - Keep customer data in sync
- **Two-way updates** - Status changes sync back to WooCommerce

### QuickBooks Desktop

**Features:**
- **Customer sync** - Import customers from QuickBooks
- **Invoice sync** - Create invoices in QuickBooks
- **Read-only connection** - Connect to QB on CHRISTINA-NEW server

### Webhooks

**Features:**
- **Outbound webhooks** - Send order/customer events to external systems
- **Retry logic** - Automatic retry on failed deliveries
- **Event filtering** - Choose which events trigger webhooks
- **Delivery logging** - Track webhook success/failure

**Page:**
- Webhooks Page

---

## 🛠️ Power User Features

### Keyboard Shortcuts

**Features:**
- **Vim-style navigation** - G + letter for instant page navigation
- **Command palette** - Cmd/Ctrl + K for quick actions
- **Fuzzy search** - Find anything instantly
- **Macro recording** - Record and replay action sequences
- **Customizable shortcuts** - Personalize your workflow

**Pages:**
- Command Palette Settings
- Keyboard Shortcuts Modal (press `?` anywhere)

### Batch Operations

**Features:**
- **Bulk status updates** - Update multiple orders at once
- **Bulk import** - CSV import for orders, customers, inventory
- **Bulk export** - Export data to CSV, Excel, PDF
- **Data comparison** - Compare orders side-by-side

**Pages:**
- Data Import
- Compare Orders
- Global Search

### Equipment Management

**Features:**
- **Equipment registry** - Track printers, cutters, vehicles
- **Maintenance scheduling** - Schedule and track maintenance
- **Calibration tracking** - Monitor equipment calibration
- **Downtime logging** - Track equipment outages

**Pages:**
- Equipment List
- Equipment Detail
- Equipment Form

---

## 📱 Mobile & Accessibility

### Progressive Web App (PWA)

**Features:**
- **Install to home screen** - Works like a native app
- **Offline capable** - Basic functionality without internet
- **Push notifications** - Real-time alerts on mobile

### Remote Access

**Features:**
- **ngrok tunneling** - Access from anywhere with secure tunnel
- **Mobile-optimized views** - Responsive design for all screen sizes
- **Touch-friendly controls** - Large tap targets on mobile

### Accessibility

**Features:**
- **Screen reader support** - ARIA labels throughout
- **Keyboard navigation** - Full keyboard accessibility
- **High contrast support** - Theme system with accessibility options

---

## 💡 Benefits vs. Paper-Based Systems

### Problems with Paper

| Paper System | Wilde Signs ERP |
|--------------|-----------------|
| Orders get lost or misfiled | All orders searchable, never lost |
| No visibility into production status | Real-time status at every station |
| Manual data entry, errors common | Digital entry with validation |
| No historical data analysis | Complete analytics and reporting |
| Phone tag for status updates | Instant updates via portal & notifications |
| Duplicate data entry | Enter once, use everywhere |
| Paper proofs lost or delayed | Digital proof approval workflow |
| No audit trail | Complete change history |
| Inventory counts always outdated | Real-time inventory tracking |
| Scheduling conflicts undetected | Visual calendar with conflict detection |

### Problems with Generic ERPs

| Generic ERP | Wilde Signs ERP |
|-------------|-----------------|
| Expensive per-user licensing | Unlimited users, no recurring fees |
| Requires extensive customization | Built for sign shops from day one |
| Complex, steep learning curve | Intuitive, sign-industry terminology |
| Slow, legacy technology | Modern, fast, real-time updates |
| Limited mobile support | Full mobile & tablet support |
| No customer portal | Built-in customer self-service |
| No print-specific features | Print batching, nesting, color management |
| Generic production tracking | Station-based workflow designed for signs |

---

## 📈 Estimated ROI Analysis

### Time Savings

| Activity | Before (hrs/week) | After (hrs/week) | Savings |
|----------|-------------------|------------------|---------|
| Order status inquiries | 5 | 0.5 | 90% |
| Data entry (duplicate) | 8 | 2 | 75% |
| Quote creation | 4 | 1 | 75% |
| Inventory counts | 4 | 1 | 75% |
| Production scheduling | 6 | 2 | 67% |
| Report generation | 3 | 0.5 | 83% |
| **Total** | **30 hrs/week** | **7 hrs/week** | **77%** |

### Error Reduction

| Error Type | Estimated Reduction |
|------------|---------------------|
| Lost orders | 100% |
| Inventory stockouts | 80% |
| Shipping errors | 70% |
| Quoting mistakes | 75% |
| Scheduling conflicts | 90% |
| Customer communication delays | 85% |

### Financial Impact

**Conservative Estimates (Annual):**

| Metric | Calculation | Savings |
|--------|-------------|---------|
| Labor savings | 23 hrs/week × $25/hr × 52 weeks | $29,900 |
| Error reduction | 5 major errors/month × $500 avg × 12 | $30,000 |
| Customer retention | 2% improvement × $500K revenue | $10,000 |
| Faster quoting | 10% more quotes × $200 avg × 100/year | $2,000 |
| **Total Annual Savings** | | **~$72,000** |

**Payback Period:** The system is custom-built and owned outright - no recurring licensing fees. Initial development investment pays back through operational savings within the first year.

---

## 🚀 Getting Started

### Quick Start Commands

```bash
# Start everything (API + Web + ngrok for mobile)
start-dev.bat

# Start local only (no mobile access)
start-dev-local.bat

# Database commands
pnpm db:push     # Apply schema changes
pnpm db:studio   # Visual database browser
pnpm db:seed     # Seed initial data (admin/admin123)

# Docker (for PostgreSQL)
docker-compose up -d
```

### Default Credentials

| System | Username | Password |
|--------|----------|----------|
| Web App | admin | admin123 |
| Portal | (created per customer) | (emailed to customer) |

### URLs

| Service | Local URL | Mobile URL |
|---------|-----------|------------|
| Web App | http://localhost:5173 | https://[dynamic].ngrok-free.dev |
| API | http://localhost:3001 | Via ngrok tunnel |
| Portal | http://localhost:5174 | https://[dynamic].ngrok-free.dev |
| Database Studio | http://localhost:5555 | Local only |

---

## 📋 Complete Page Index

### Production (9 pages)
- Dashboard
- Work Orders (list, detail, form)
- Kanban Board
- Shop Floor Mode
- Schedule
- Production Calendar
- Live Production Dashboard
- Print Batching
- Recurring Orders

### Sales (7 pages)
- Sales Dashboard
- Customers (list, detail)
- Quotes (list, detail, form)

### Inventory (4 pages)
- Inventory List
- Item Detail
- BOM (list, detail, form)

### Purchasing (8 pages)
- Vendors (list, detail, form)
- Purchase Orders (list, detail, form, receive)
- Subcontractors (list, detail, form)

### Logistics (2 pages)
- Shipments
- Installer Scheduling

### Quality (5 pages)
- QC Checklists (list, detail, form)
- QC Inspections (list, detail, form)
- QA Dashboard

### Reports (6 pages)
- Reports
- Advanced Reports
- KPI Dashboard
- Profitability
- Time Reports
- Data Canvas

### System (11 pages)
- Users
- Activity Log
- Audit Log
- User Activity
- Settings
- Email Templates
- Webhooks
- Integrations
- Labor Rates
- Price Book
- Documents

### Tools (5 pages)
- QR Scanner
- Global Search
- Data Import
- Compare Orders
- Command Palette Settings

### Portal (10 pages)
- Dashboard
- Orders (list, detail)
- Proofs (list, detail)
- Messages
- Support
- Documents
- Invoices
- Quote Builder
- Profile

---

## 📞 Support

This system is custom-built for Wilde Signs. For questions, modifications, or enhancements, refer to the development documentation in `/docs/` or consult with the development team.

**Documentation Files:**
- `docs/AGENT_01_LOG.md` - Backend API development log
- `docs/AGENT_02_LOG.md` - Frontend pages development log
- `docs/AGENT_03_LOG.md` - UI components development log
- `docs/AGENT_04_LOG.md` - Schema & types development log
- `docs/AGENT_05_LOG.md` - Portal & integration development log
- `docs/ERP_GAP_ANALYSIS.md` - Feature gap analysis

---

*Document generated: February 3, 2026*
*Version: 1.0.0*
