# GatePass — Vehicle Material Entry: Basic Setup Design

## Purpose

GatePass is a vehicle gate entry system for a facility (factory/warehouse-style
use case): security/admin staff register a vehicle carrying material as it
enters, record details about the material and driver, and mark the vehicle's
exit time when it leaves. This spec covers the **basic setup**: project
scaffolding plus a minimal working create/list/exit flow — not a full
workflow system (no approvals, no auth, no notifications).

## Architecture

Two independent apps, matching the existing `Backend/` and `Frontend/`
folders — no shared runtime, no monorepo tooling.

- **Backend**: FastAPI, runs at `http://localhost:8000` in dev.
- **Frontend**: Vite + React, runs at `http://localhost:5173` in dev.
- **Dev networking**: the Vite dev server proxies `/api/*` to the FastAPI
  backend. Frontend code only ever calls relative `/api/...` paths, so no
  CORS configuration is needed in dev, and the same path scheme maps cleanly
  onto a reverse proxy if this is ever deployed behind one.

## Backend (`Backend/`, Python + FastAPI)

```
Backend/
  app/
    main.py            # FastAPI app, router includes, startup table creation
    database.py        # SQLAlchemy engine/session (mssql+pyodbc, Windows Auth)
    models.py           # VehicleEntry ORM model
    schemas.py           # Pydantic schemas (Create / Out)
    routers/
      entries.py         # CRUD endpoints for vehicle entries
  requirements.txt
  .env.example          # DB_SERVER, DB_NAME, DB_DRIVER (no secrets)
  .gitignore
```

### Data model — `VehicleEntry`

| Field | Type | Notes |
|---|---|---|
| id | int, PK | auto-increment |
| vehicle_number | string | required |
| driver_name | string | required |
| driver_phone | string | optional |
| material_description | string | e.g. "Steel rods" |
| material_quantity | numeric | e.g. 500 |
| material_unit | string | e.g. "kg", "ton", "units" |
| purpose | string | e.g. Delivery / Pickup / Maintenance |
| reference_doc_number | string | challan / invoice / PO number |
| supplier_transporter_name | string | |
| entry_time | datetime | set server-side on creation |
| exit_time | datetime, nullable | set when vehicle exits |
| created_at | datetime | set server-side on creation |

### API endpoints

- `POST /api/entries` — register a new vehicle entry (`entry_time` set to now server-side)
- `GET /api/entries?vehicle_number=&date_from=&date_to=` — list/filter entries
- `GET /api/entries/{id}` — fetch a single entry
- `PATCH /api/entries/{id}/exit` — stamp `exit_time` = now (vehicle leaving)

No delete/full-update endpoints in this basic setup (YAGNI) — add later if a
real need shows up.

### Database connection

- SQLAlchemy with the `mssql+pyodbc` dialect, targeting a local SQL Server
  instance managed via SSMS.
- **Windows Authentication** (`Trusted_Connection=yes`) — no username/password
  stored anywhere; the connection string is built from `DB_SERVER`, `DB_NAME`,
  and `DB_DRIVER` (ODBC Driver 17/18 for SQL Server) read from `.env`.
- The target database itself is assumed to already exist (created by hand in
  SSMS); the app creates its own tables on startup via
  `Base.metadata.create_all()`. No Alembic migrations for this basic setup —
  revisit if/when the schema needs to evolve after data exists.

### Error handling

- Pydantic validation gives automatic `422` responses for malformed input.
- `404` for an entry ID that doesn't exist.
- A global exception handler converts unexpected DB/connection errors into a
  clean `500` JSON response instead of leaking a stack trace.

## Frontend (`Frontend/`, Vite + React + Tailwind CSS, JavaScript)

```
Frontend/
  src/
    api/
      client.js          # axios instance, baseURL '/api'
      entries.js          # getEntries / createEntry / exitEntry calls
    hooks/
      useEntries.js        # useState/useEffect hook wrapping the API calls
    components/
      EntryForm.jsx         # register a new vehicle entry
      EntryTable.jsx         # list + filter entries, "Mark Exit" action
    App.jsx
    main.jsx
    index.css              # Tailwind directives
  vite.config.js            # dev proxy: /api -> http://localhost:8000
  tailwind.config.js
  postcss.config.js
```

Single responsive screen: `EntryForm` at the top to register a vehicle,
`EntryTable` below listing and filtering entries (by vehicle number / date)
with a "Mark Exit" action per row. Fully responsive via Tailwind — stacks
vertically on small screens, wider layout on desktop. No router in this
basic setup (one screen, YAGNI) — add `react-router` later if more pages are
needed.

### Error handling

The `useEntries` hook tracks `loading`/`error` state. The form surfaces
validation errors returned by the API inline; the table shows an error
banner if a fetch fails.

## Testing / verification (basic setup scope)

- Backend verified manually via FastAPI's auto-generated `/docs` page
  (create, list, and mark-exit an entry).
- Frontend verified manually by running the dev server against the running
  backend and exercising the form + table.
- No automated test suite in this pass — flagged as a natural future
  addition, not built now.

## Out of scope (for this basic setup)

- Authentication / user roles (security guard vs admin)
- Approval workflows
- QR code / printed pass generation
- Notifications (SMS/email)
- Automated tests
- Database migrations (Alembic)
