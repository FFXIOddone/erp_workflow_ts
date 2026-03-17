# ERP Workflow - TypeScript Edition

A full-stack ERP workflow application for Wilde Signs sign shop, built with modern TypeScript technologies.

## Tech Stack

- **Backend:** Node.js, Express.js, TypeScript, Prisma ORM, PostgreSQL
- **Frontend:** React 18, TypeScript, Vite, TailwindCSS, Tanstack Query, Zustand
- **Desktop:** Electron wrapper for web app
- **Real-time:** WebSocket for live updates
- **Auth:** JWT tokens, bcrypt password hashing

## Features

- ✅ Work orders with line items, status transitions, audit log
- ✅ Station routing (Vinyl, Digital, Screen Print, Wide Format)
- ✅ User accounts with role-based permissions
- ✅ Time tracking per station
- ✅ Inventory and item master management
- ✅ Order templates for quick creation
- ✅ Reprint request handling
- ✅ Kanban board view with drag-and-drop
- ✅ Real-time updates via WebSocket
- ✅ Multi-user support on local network

## Project Structure

```
erp_workflow_ts/
├── packages/
│   ├── shared/      # Shared types, schemas, constants
│   ├── server/      # Express API server with Prisma
│   ├── web/         # React web application
│   └── desktop/     # Electron desktop wrapper
├── docker-compose.yml  # PostgreSQL database
├── pnpm-workspace.yaml
└── package.json
```

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 8+
- Docker (for PostgreSQL)

### Setup

1. **Clone and install dependencies:**
   ```bash
   pnpm install
   ```

2. **Copy environment file:**
   ```bash
   cp .env.example .env
   ```

3. **Start PostgreSQL database:**
   ```bash
   docker-compose up -d postgres
   ```

4. **Push database schema:**
   ```bash
   pnpm db:push
   ```

5. **Seed initial data:**
   ```bash
   pnpm db:seed
   ```

6. **Start development servers:**
   ```bash
   pnpm dev
   ```

7. **Open in browser:**
   - Web App: http://localhost:5173
   - API: http://localhost:8001
   - pgAdmin (optional): http://localhost:5050

### Default Login

- **Username:** admin
- **Password:** admin123

## Development Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all services in development mode |
| `pnpm dev:server` | Start API server only |
| `pnpm dev:web` | Start web app only |
| `pnpm dev:desktop` | Start Electron app |
| `pnpm build` | Build all packages |
| `pnpm test` | Run tests |
| `pnpm lint` | Lint all packages |
| `pnpm db:push` | Push Prisma schema to database |
| `pnpm db:migrate` | Create and run migrations |
| `pnpm db:studio` | Open Prisma Studio GUI |
| `pnpm db:seed` | Seed initial data |

## API Endpoints

### Authentication
- `POST /api/v1/auth/login` - Login
- `GET /api/v1/auth/me` - Get current user
- `POST /api/v1/auth/refresh` - Refresh token

### Work Orders
- `GET /api/v1/orders` - List orders
- `GET /api/v1/orders/:id` - Get order details
- `POST /api/v1/orders` - Create order
- `PATCH /api/v1/orders/:id` - Update order
- `DELETE /api/v1/orders/:id` - Delete order
- `POST /api/v1/orders/:id/routing` - Set routing
- `POST /api/v1/orders/:id/stations/:station/complete` - Complete station
- `POST /api/v1/orders/:id/time` - Log time
- `POST /api/v1/orders/:id/reprints` - Create reprint request

### Users
- `GET /api/v1/users` - List users
- `POST /api/v1/users` - Create user
- `PATCH /api/v1/users/:id` - Update user
- `POST /api/v1/users/:id/password` - Change password

### Items & Inventory
- `GET /api/v1/items` - List item masters
- `POST /api/v1/items` - Create item
- `GET /api/v1/inventory` - List inventory
- `POST /api/v1/inventory` - Add inventory item

### Templates
- `GET /api/v1/templates` - List templates
- `POST /api/v1/templates` - Create template
- `POST /api/v1/templates/:id/create-order` - Create order from template

## WebSocket Events

The server broadcasts real-time events:
- `ORDER_CREATED` - New order created
- `ORDER_UPDATED` - Order modified
- `ORDER_DELETED` - Order deleted
- `STATION_UPDATED` - Station status changed

## Desktop App

Build the desktop application:

```bash
cd packages/desktop
pnpm package
```

The installer will be created in `packages/desktop/out/`.

## Network Access

To allow access from other devices on your local network:

1. Update `.env`:
   ```
   SERVER_HOST=0.0.0.0
   VITE_API_URL=http://YOUR_IP:8001
   VITE_WS_URL=ws://YOUR_IP:8001
   ```

2. Restart the development servers

3. Access from other devices at `http://YOUR_IP:5173`

## License

Private - Wilde Signs
