# Port Assignments

All services in this monorepo use unique ports to avoid conflicts.

## Port Map

| Port  | Service                 | Type             | Package                     |
|-------|-------------------------|------------------|-----------------------------|
| 5432  | PostgreSQL              | Database         | docker-compose.yml          |
| 5050  | pgAdmin                 | DB Admin UI      | docker-compose.yml          |
| 8001  | ERP API Server          | Express/Node     | packages/server             |
| 5173  | ERP Web Frontend        | React/Vite       | packages/web                |
| 5174  | Customer Portal         | React/Vite       | packages/portal             |
| 5180  | Station: Printing       | Tauri/Vite       | packages/station-printing   |
| 5181  | Station: Production     | Tauri/Vite       | packages/station-production |
| 5182  | Station: Shipping       | Tauri/Vite       | packages/station-shipping   |
| 5183  | Station: Design         | Tauri/Vite       | packages/station-design     |
| 5184  | Order Entry             | Tauri/Vite       | packages/order-entry        |
| 5185  | Slip-Sort Frontend      | Svelte/Vite      | packages/slip-sort/frontend |
| 5186  | Shop Floor              | React/Tauri/Vite | packages/shop-floor         |
| 8000  | Slip-Sort Backend       | FastAPI/Uvicorn  | packages/slip-sort/backend  |
| 1420  | Tauri Default Dev       | (CORS only)      | —                           |

## Rules

- **Every service gets a unique port.** No sharing.
- Station apps use `strictPort: true` — they fail fast if port is taken.
- The ERP API CORS allowlist (in `packages/server/src/lib/env-validation.ts`) must include all frontend ports.
- When adding a new service, pick the next available port from the appropriate range and update this doc.

## Port Ranges

- **5173–5189**: Frontend dev servers (Vite)
- **8000–8009**: Backend API servers
- **5432**: PostgreSQL (standard)
- **5050**: pgAdmin
