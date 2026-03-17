# Packing Slip Manager v2.0

A modern, enterprise-grade web application for parsing, sorting, and managing packing slips with visual pattern building, tiered sorting, and multi-brand support.

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![Python](https://img.shields.io/badge/python-3.10+-green)
![License](https://img.shields.io/badge/license-MIT-blue)

## ✨ Features

### Core Functionality
- **Visual Pattern Builder** - Power Apps-like interface to highlight PDF regions and map them to data fields
- **Tiered Sorting** - Configure 4-tier sort hierarchy (Kit Type → Alcohol Type → Location → Store Code)
- **Blackout Rules** - Redact specific items from packing slips with conditional logic
- **Order History** - Database storage of all processed orders for troubleshooting
- **Multi-Brand Support** - Manage multiple brands with separate configurations

### ERP Features (v2.0)
- **Advanced Order Management** - Filtering, bulk actions, order comparison, print queue
- **Reporting Module** - Daily/weekly/monthly summaries, CSV/JSON export, custom reports
- **Batch Processing** - Queue visualization, progress tracking, retry logic
- **Configuration Management** - Import/export configs, versioning, templates, brand cloning
- **Integration Points** - Webhooks, API keys, file watchers for automation

### UI/UX
- **Modern Component Library** - Button, Card, Input, Modal, Table, Badge, Toggle components
- **Dark Mode Support** - System-aware theme with manual override
- **Toast Notifications** - Non-intrusive feedback for actions
- **Keyboard Shortcuts** - Power user navigation (Ctrl+D, Ctrl+P, Ctrl+H, Shift+?)
- **Skeleton Loading States** - Perceived performance improvements
- **Lucide Icons** - Professional SVG icon system

## 🚀 Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/packing-slip-manager.git
cd packing-slip-manager

# Create Python virtual environment
python -m venv .venv
.venv\Scripts\activate  # Windows
# source .venv/bin/activate  # Linux/Mac

# Install backend dependencies
cd backend
pip install -r requirements.txt

# Install frontend dependencies
cd ../frontend
npm install
```

### Development Mode

**Terminal 1 - Start Backend:**
```bash
cd backend
uvicorn main:app --reload --port 8000
```

**Terminal 2 - Start Frontend:**
```bash
cd frontend
npm run dev
```

Open http://localhost:5173 in your browser.

### Desktop App Mode

```bash
python run_app.py
```

Or use the startup scripts:
- **Windows:** `start_servers.bat` or `start_servers.ps1`
- **Stop:** `stop_servers.bat` or `stop_servers.ps1`

## 🐳 Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

The application will be available at:
- **Frontend:** http://localhost
- **Backend API:** http://localhost:8000

## 📁 Project Structure

```
packing_slip_manager/
├── backend/
│   ├── core/
│   │   ├── config.py          # Settings management
│   │   └── database.py        # Session dependency injection
│   ├── database/
│   │   └── models.py          # SQLAlchemy models
│   ├── routers/
│   │   ├── brands.py          # Brand management endpoints
│   │   ├── config.py          # Configuration endpoints
│   │   ├── health.py          # Health check endpoints
│   │   ├── orders.py          # Order management (Day 3)
│   │   ├── reports.py         # Reporting module (Day 3)
│   │   ├── batches.py         # Batch processing (Day 3)
│   │   ├── config_management.py  # Config import/export (Day 3)
│   │   └── integrations.py    # Webhooks, API keys (Day 3)
│   ├── services/
│   │   └── pdf_parser.py      # PDF parsing logic
│   ├── tests/
│   │   ├── conftest.py        # Test fixtures
│   │   ├── test_models.py     # Model tests
│   │   ├── test_pdf_parser.py # Parser tests
│   │   └── test_api_brands.py # API tests
│   ├── alembic/               # Database migrations
│   ├── main.py                # FastAPI application
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── lib/
│   │   │   ├── components/
│   │   │   │   ├── ui/        # Reusable UI components
│   │   │   │   ├── ConfirmDialog.svelte
│   │   │   │   ├── ErrorBoundary.svelte
│   │   │   │   ├── KeyboardShortcutsModal.svelte
│   │   │   │   ├── Skeleton.svelte
│   │   │   │   ├── ThemeToggle.svelte
│   │   │   │   ├── ToastProvider.svelte
│   │   │   │   ├── keyboard.js
│   │   │   │   ├── toast.js
│   │   │   │   └── validation.js
│   │   │   ├── Dashboard.svelte
│   │   │   ├── ProcessPDF.svelte
│   │   │   ├── SortConfig.svelte
│   │   │   ├── BlackoutConfig.svelte
│   │   │   ├── OrderHistory.svelte
│   │   │   ├── BrandManager.svelte
│   │   │   └── ...
│   │   ├── App.svelte
│   │   └── main.js
│   ├── e2e/                   # Playwright E2E tests
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
├── docker-compose.yml
├── Dockerfile.backend
├── Dockerfile.frontend
├── nginx.conf
└── README.md
```

## 🔌 API Endpoints

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/brands` | List all brands |
| POST | `/api/brands` | Create new brand |
| GET | `/api/sort-configs` | Get sort configurations |
| PUT | `/api/sort-configs/{id}` | Update sort config |
| GET | `/api/blackout-rules` | List blackout rules |
| POST | `/api/pdf/upload` | Upload PDF for processing |
| POST | `/api/pdf/process` | Process PDF with sorting |

### Order Management (v2.0)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/orders/advanced-search` | Advanced filtering |
| GET | `/api/orders/filter-options` | Get available filters |
| GET | `/api/orders/{id}/detail` | Order details with timeline |
| POST | `/api/orders/bulk-action` | Bulk delete/export/mark reviewed |
| POST | `/api/orders/compare` | Compare multiple orders |
| GET | `/api/orders/statistics` | Order statistics |

### Reporting (v2.0)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reports/summary/daily` | Daily summary report |
| GET | `/api/reports/summary/weekly` | Weekly summary report |
| GET | `/api/reports/summary/monthly` | Monthly summary report |
| GET | `/api/reports/export/csv` | Export orders to CSV |
| GET | `/api/reports/export/json` | Export orders to JSON |
| POST | `/api/reports/custom` | Generate custom report |

### Configuration Management (v2.0)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/config-management/export/{brand_id}` | Export brand config |
| POST | `/api/config-management/import` | Import configuration |
| POST | `/api/config-management/version/{brand_id}` | Create config version |
| GET | `/api/config-management/versions/{brand_id}` | List config versions |
| POST | `/api/config-management/versions/{brand_id}/restore/{version}` | Restore version |
| GET | `/api/config-management/templates` | List templates |
| POST | `/api/config-management/clone-brand` | Clone a brand |
| GET | `/api/config-management/backup` | Full system backup |

### Integrations (v2.0)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/integrations/webhooks` | List webhooks |
| POST | `/api/integrations/webhooks` | Create webhook |
| POST | `/api/integrations/webhooks/{id}/test` | Test webhook |
| GET | `/api/integrations/api-keys` | List API keys |
| POST | `/api/integrations/api-keys` | Create API key |
| GET | `/api/integrations/file-watchers` | List file watchers |
| POST | `/api/integrations/file-watchers` | Create file watcher |
| GET | `/api/integrations/status` | Integration status |

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+D` | Go to Dashboard |
| `Ctrl+P` | Go to Process PDF |
| `Ctrl+H` | Go to Order History |
| `Shift+?` | Show keyboard shortcuts |

## 🎨 Default Configuration (Kwik Fill)

The app comes pre-configured with defaults matching the original KFSORT1.0.py:

**Kit Markers Detected:**
- `*CANDY; COUNTER KIT*` → Counter Kit
- `*CANDY; SHIPPER KIT*` → Shipper Kit
- `*Shelf Wobbler Kit; Alcohol Version*` → Alcohol Wobbler
- `*Shelf Wobbler Kit; Non-Alcohol Version*` → Non-Alcohol Wobbler

**Default Sort Order:**
1. Kit Type: Counter + Shipper → Counter → Shipper → Neither
2. Alcohol Type: Alcohol → Non-Alcohol → Neither
3. Location: NY → PA → OH → Other
4. Store Code: Alphabetical

## 🧪 Testing

### Backend Tests
```bash
cd backend
pytest tests/ -v
```

### Frontend Tests
```bash
cd frontend
npm run test        # Unit tests
npm run test:e2e    # End-to-end tests
```

## 📦 Building for Production

### Build Frontend
```bash
cd frontend
npm run build
```

### Create Standalone Executable
```bash
pip install pyinstaller
pyinstaller --onefile --windowed run_app.py
```

## 🔧 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_PATH` | SQLite database path | `packing_slip_manager.db` |
| `DEV_MODE` | Enable development mode | `0` |
| `PORT` | Backend port | `8000` |

## 📝 Changelog

### v2.0.0 (Day 3 Complete)
- ✅ Order Management with advanced filtering and bulk actions
- ✅ Reporting module with CSV/JSON export
- ✅ Batch processing with queue management
- ✅ Configuration import/export and versioning
- ✅ Template library for sort rules
- ✅ Brand cloning functionality
- ✅ Webhook support for external systems
- ✅ API key management
- ✅ File watcher for auto-processing
- ✅ Docker containerization
- ✅ Full documentation update

### v1.5.0 (Day 2)
- ✅ Premium UI component library
- ✅ Dark mode support
- ✅ Toast notifications
- ✅ Lucide icon system
- ✅ Form validation
- ✅ Keyboard shortcuts
- ✅ Skeleton loading states

### v1.0.0 (Day 1)
- ✅ Backend router restructuring
- ✅ Database migrations with Alembic
- ✅ Test infrastructure setup
- ✅ Linting and code quality tools

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

Built with ❤️ using FastAPI, Svelte, and TailwindCSS
