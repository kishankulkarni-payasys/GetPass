# GatePass Vehicle Entry — Basic Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a working basic setup for GatePass — a FastAPI backend backed by local SQL Server, and a Vite/React/Tailwind frontend — that can register a vehicle material entry and mark its exit.

**Architecture:** Two independent apps in the existing `Backend/` and `Frontend/` folders. FastAPI (port 8000) talks to a local SQL Server instance via SQLAlchemy + pyodbc using Windows Authentication. The Vite dev server (port 5173) proxies `/api/*` to the backend, so frontend code only ever calls relative `/api/...` paths.

**Tech Stack:** Python 3 + FastAPI + SQLAlchemy + pyodbc (backend); Node/npm + Vite + React 18 + Tailwind CSS v4 + axios (frontend); Microsoft SQL Server via SSMS (database).

## Global Constraints

- No authentication/login in this pass — core vehicle-entry API only (per spec).
- SQL Server auth is Windows Authentication (`Trusted_Connection=yes`) — no username/password is ever stored in code or `.env`.
- No Alembic migrations — tables are created via `Base.metadata.create_all()` against a database that already exists in SSMS.
- No automated test suite in this pass — verification is manual (FastAPI `/docs`, curl, and running the frontend against the backend), per the spec's explicit scope decision.
- Frontend is plain JavaScript (not TypeScript), styled with Tailwind CSS v4, and must be fully responsive (mobile through desktop).
- No frontend router — a single screen (form + table) for this basic setup.
- Frontend code only calls relative `/api/...` paths; the Vite dev server proxies these to `http://localhost:8000`. No CORS middleware is added.

---

### Task 1: Backend Project Scaffolding

**Files:**
- Create: `Backend/requirements.txt`
- Create: `Backend/.env.example`
- Create: `Backend/.gitignore`
- Create: `Backend/app/__init__.py`
- Create: `Backend/app/routers/__init__.py`

**Interfaces:**
- Produces: a Python virtual environment at `Backend/venv` with `fastapi`, `uvicorn`, `sqlalchemy`, `pyodbc`, `python-dotenv`, `pydantic` installed, and the `app`/`app/routers` package skeleton that later tasks add modules into.

- [ ] **Step 1: Create `Backend/requirements.txt`**

```
fastapi>=0.115
uvicorn[standard]>=0.32
sqlalchemy>=2.0
pyodbc>=5.1
python-dotenv>=1.0
```

- [ ] **Step 2: Create `Backend/.env.example`**

```
DB_SERVER=localhost
DB_NAME=GatePassDB
DB_DRIVER=ODBC Driver 17 for SQL Server
```

- [ ] **Step 3: Create `Backend/.gitignore`**

```
__pycache__/
*.pyc
.env
venv/
.venv/
```

- [ ] **Step 4: Create empty package files**

Create `Backend/app/__init__.py` (empty file) and `Backend/app/routers/__init__.py` (empty file).

- [ ] **Step 5: Create the virtual environment and install dependencies**

Run (from `Backend/`):
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -c "import fastapi, uvicorn, sqlalchemy, pyodbc, dotenv; print('backend deps ok')"
```
Expected output: `backend deps ok`

- [ ] **Step 6: Commit**

```bash
git add Backend/requirements.txt Backend/.env.example Backend/.gitignore Backend/app/__init__.py Backend/app/routers/__init__.py
git commit -m "chore(backend): scaffold FastAPI project structure and dependencies"
```

---

### Task 2: Database Connection Module

**Files:**
- Create: `Backend/app/database.py`

**Interfaces:**
- Consumes: env vars `DB_SERVER`, `DB_NAME`, `DB_DRIVER` (from `.env`, matching `Backend/.env.example` defaults from Task 1).
- Produces: `engine` (SQLAlchemy `Engine`), `SessionLocal` (`sessionmaker`), `Base` (`declarative_base()`), `get_db()` (FastAPI dependency generator) — consumed by `app/models.py` (Task 3, uses `Base`) and `app/routers/entries.py` (Task 4, uses `get_db`).

**Prerequisite (one-time, on your machine):** in SSMS, create an empty database named `GatePassDB` (right-click **Databases** → **New Database** → name it `GatePassDB`). Confirm "ODBC Driver 17 for SQL Server" (or 18) is installed — if you have a different version, update `DB_DRIVER` in `.env` after Step 1 below to match.

- [ ] **Step 1: Create `Backend/.env` from the example**

```powershell
Copy-Item .env.example .env
```

- [ ] **Step 2: Create `Backend/app/database.py`**

```python
import os
import urllib.parse

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()

DB_SERVER = os.getenv("DB_SERVER", "localhost")
DB_NAME = os.getenv("DB_NAME", "GatePassDB")
DB_DRIVER = os.getenv("DB_DRIVER", "ODBC Driver 17 for SQL Server")

_odbc_params = urllib.parse.quote_plus(
    f"DRIVER={{{DB_DRIVER}}};"
    f"SERVER={DB_SERVER};"
    f"DATABASE={DB_NAME};"
    "Trusted_Connection=yes;"
)

DATABASE_URL = f"mssql+pyodbc:///?odbc_connect={_odbc_params}"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

- [ ] **Step 3: Verify the connection**

Run (from `Backend/`, venv activated):
```powershell
python -c "from app.database import engine; conn = engine.connect(); print('Connected OK'); conn.close()"
```
Expected output: `Connected OK`

If this fails with a driver-name error, open ODBC Data Sources (64-bit) on your machine, note the exact installed SQL Server driver name, and update `DB_DRIVER` in `Backend/.env` to match, then re-run.

- [ ] **Step 4: Commit**

```bash
git add Backend/app/database.py
git commit -m "feat(backend): add SQL Server database connection module"
```

Note: `Backend/.env` is gitignored (Task 1) and intentionally not committed.

---

### Task 3: Data Model + Schemas

**Files:**
- Create: `Backend/app/models.py`
- Create: `Backend/app/schemas.py`

**Interfaces:**
- Consumes: `Base` from `app/database.py` (Task 2).
- Produces: `VehicleEntry` ORM class (table `vehicle_entries`); `VehicleEntryCreate`, `VehicleEntryOut` Pydantic schemas — consumed by `app/routers/entries.py` (Task 4).

- [ ] **Step 1: Create `Backend/app/models.py`**

```python
from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, Numeric, String
from sqlalchemy.sql import func

from app.database import Base


class VehicleEntry(Base):
    __tablename__ = "vehicle_entries"

    id = Column(Integer, primary_key=True, index=True)
    vehicle_number = Column(String(20), nullable=False, index=True)
    driver_name = Column(String(100), nullable=False)
    driver_phone = Column(String(20), nullable=True)
    material_description = Column(String(200), nullable=True)
    material_quantity = Column(Numeric(10, 2), nullable=True)
    material_unit = Column(String(20), nullable=True)
    purpose = Column(String(50), nullable=True)
    reference_doc_number = Column(String(50), nullable=True)
    supplier_transporter_name = Column(String(100), nullable=True)
    entry_time = Column(DateTime, nullable=False, default=datetime.utcnow)
    exit_time = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
```

- [ ] **Step 2: Create `Backend/app/schemas.py`**

```python
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class VehicleEntryCreate(BaseModel):
    vehicle_number: str
    driver_name: str
    driver_phone: Optional[str] = None
    material_description: Optional[str] = None
    material_quantity: Optional[float] = None
    material_unit: Optional[str] = None
    purpose: Optional[str] = None
    reference_doc_number: Optional[str] = None
    supplier_transporter_name: Optional[str] = None


class VehicleEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    vehicle_number: str
    driver_name: str
    driver_phone: Optional[str] = None
    material_description: Optional[str] = None
    material_quantity: Optional[float] = None
    material_unit: Optional[str] = None
    purpose: Optional[str] = None
    reference_doc_number: Optional[str] = None
    supplier_transporter_name: Optional[str] = None
    entry_time: datetime
    exit_time: Optional[datetime] = None
    created_at: datetime
```

- [ ] **Step 3: Verify imports**

Run (from `Backend/`, venv activated):
```powershell
python -c "from app.models import VehicleEntry; from app.schemas import VehicleEntryCreate, VehicleEntryOut; print('models ok')"
```
Expected output: `models ok`

- [ ] **Step 4: Commit**

```bash
git add Backend/app/models.py Backend/app/schemas.py
git commit -m "feat(backend): add VehicleEntry model and Pydantic schemas"
```

---

### Task 4: CRUD API + App Wiring

**Files:**
- Create: `Backend/app/routers/entries.py`
- Create: `Backend/app/main.py`

**Interfaces:**
- Consumes: `get_db` (Task 2), `VehicleEntry` (Task 3), `VehicleEntryCreate`/`VehicleEntryOut` (Task 3).
- Produces: a running FastAPI app exposing `POST /api/entries`, `GET /api/entries`, `GET /api/entries/{id}`, `PATCH /api/entries/{id}/exit`, and `GET /api/health`.

- [ ] **Step 1: Create `Backend/app/routers/entries.py`**

```python
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import VehicleEntry
from app.schemas import VehicleEntryCreate, VehicleEntryOut

router = APIRouter(prefix="/api/entries", tags=["entries"])


@router.post("", response_model=VehicleEntryOut, status_code=201)
def create_entry(entry: VehicleEntryCreate, db: Session = Depends(get_db)):
    db_entry = VehicleEntry(**entry.model_dump())
    db.add(db_entry)
    db.commit()
    db.refresh(db_entry)
    return db_entry


@router.get("", response_model=List[VehicleEntryOut])
def list_entries(
    vehicle_number: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    db: Session = Depends(get_db),
):
    query = db.query(VehicleEntry)
    if vehicle_number:
        query = query.filter(VehicleEntry.vehicle_number.ilike(f"%{vehicle_number}%"))
    if date_from:
        query = query.filter(VehicleEntry.entry_time >= date_from)
    if date_to:
        query = query.filter(VehicleEntry.entry_time <= date_to)
    return query.order_by(VehicleEntry.entry_time.desc()).all()


@router.get("/{entry_id}", response_model=VehicleEntryOut)
def get_entry(entry_id: int, db: Session = Depends(get_db)):
    entry = db.get(VehicleEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    return entry


@router.patch("/{entry_id}/exit", response_model=VehicleEntryOut)
def mark_exit(entry_id: int, db: Session = Depends(get_db)):
    entry = db.get(VehicleEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    if entry.exit_time is not None:
        raise HTTPException(status_code=400, detail="Entry already marked as exited")
    entry.exit_time = datetime.utcnow()
    db.commit()
    db.refresh(entry)
    return entry
```

- [ ] **Step 2: Create `Backend/app/main.py`**

```python
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.database import Base, engine
from app.routers import entries

app = FastAPI(title="GatePass API")

Base.metadata.create_all(bind=engine)

app.include_router(entries.router)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.get("/api/health")
def health_check():
    return {"status": "ok"}
```

- [ ] **Step 3: Start the server**

Run (from `Backend/`, venv activated), in the background:
```powershell
uvicorn app.main:app --reload --port 8000
```
Expected output includes: `Application startup complete.`

- [ ] **Step 4: Verify the endpoints**

In a separate terminal, run:
```bash
curl -s http://localhost:8000/api/health
```
Expected output: `{"status":"ok"}`

```bash
curl -s -X POST http://localhost:8000/api/entries \
  -H "Content-Type: application/json" \
  -d '{"vehicle_number":"MH12AB1234","driver_name":"Ravi Kumar","material_description":"Steel rods","material_quantity":500,"material_unit":"kg"}'
```
Expected output: a JSON object with `"id":1`, `"vehicle_number":"MH12AB1234"`, a populated `"entry_time"`, and `"exit_time":null`.

```bash
curl -s http://localhost:8000/api/entries
```
Expected output: a JSON array containing the entry created above.

```bash
curl -s -X PATCH http://localhost:8000/api/entries/1/exit
```
Expected output: the same entry with `"exit_time"` now populated.

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/docs
```
Expected output: `200`

Stop the server (Ctrl+C) once verified.

- [ ] **Step 5: Commit**

```bash
git add Backend/app/routers/entries.py Backend/app/main.py
git commit -m "feat(backend): add vehicle entry CRUD API and FastAPI app wiring"
```

---

### Task 5: Frontend Scaffolding (Vite + React + Tailwind v4)

**Files:**
- Create: `Frontend/package.json`
- Create: `Frontend/vite.config.js`
- Create: `Frontend/index.html`
- Create: `Frontend/.gitignore`
- Create: `Frontend/src/main.jsx`
- Create: `Frontend/src/index.css`
- Create: `Frontend/src/App.jsx`

**Interfaces:**
- Produces: a buildable Vite + React app with Tailwind CSS v4 enabled and a dev proxy (`/api` → `http://localhost:8000`). `App.jsx` is a placeholder here, replaced in Task 9.

- [ ] **Step 1: Create `Frontend/package.json`**

```json
{
  "name": "gatepass-frontend",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "axios": "^1.7.7"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.2",
    "@tailwindcss/vite": "^4.0.0",
    "tailwindcss": "^4.0.0",
    "vite": "^5.4.10"
  }
}
```

- [ ] **Step 2: Create `Frontend/vite.config.js`**

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
```

- [ ] **Step 3: Create `Frontend/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>GatePass</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Create `Frontend/.gitignore`**

```
node_modules/
dist/
```

- [ ] **Step 5: Create `Frontend/src/main.jsx`**

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 6: Create `Frontend/src/index.css`**

```css
@import "tailwindcss";
```

- [ ] **Step 7: Create placeholder `Frontend/src/App.jsx`**

```jsx
function App() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-gray-900">GatePass</h1>
    </div>
  )
}

export default App
```

- [ ] **Step 8: Install dependencies and verify the build**

Run (from `Frontend/`):
```powershell
npm install
npm run build
```
Expected output ends with something like `✓ built in ...` and a `dist/` folder is created, with no errors.

- [ ] **Step 9: Commit**

```bash
git add Frontend/package.json Frontend/vite.config.js Frontend/index.html Frontend/.gitignore Frontend/src/main.jsx Frontend/src/index.css Frontend/src/App.jsx
git commit -m "chore(frontend): scaffold Vite + React + Tailwind v4 project"
```

Note: `Frontend/package-lock.json` will also be created by `npm install` — include it in this commit too (`git add Frontend/package-lock.json`) so installs are reproducible.

---

### Task 6: API Client + `useEntries` Hook

**Files:**
- Create: `Frontend/src/api/client.js`
- Create: `Frontend/src/api/entries.js`
- Create: `Frontend/src/hooks/useEntries.js`

**Interfaces:**
- Consumes: `axios` (installed in Task 5), relative `/api` base path (proxied per Task 5's `vite.config.js`).
- Produces: `getEntries(filters)`, `createEntry(entry)`, `exitEntry(id)` functions; `useEntries(filters)` hook returning `{ entries, loading, error, addEntry, markExit, refresh }` — consumed by `App.jsx` (Task 9).

- [ ] **Step 1: Create `Frontend/src/api/client.js`**

```js
import axios from 'axios'

const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

export default apiClient
```

- [ ] **Step 2: Create `Frontend/src/api/entries.js`**

```js
import apiClient from './client'

export async function getEntries(filters = {}) {
  const response = await apiClient.get('/entries', { params: filters })
  return response.data
}

export async function createEntry(entry) {
  const response = await apiClient.post('/entries', entry)
  return response.data
}

export async function exitEntry(id) {
  const response = await apiClient.patch(`/entries/${id}/exit`)
  return response.data
}
```

- [ ] **Step 3: Create `Frontend/src/hooks/useEntries.js`**

```js
import { useCallback, useEffect, useState } from 'react'
import { getEntries, createEntry, exitEntry } from '../api/entries'

export function useEntries(filters = {}) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getEntries(filters)
      setEntries(data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load entries')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters)])

  useEffect(() => {
    refresh()
  }, [refresh])

  const addEntry = async (entry) => {
    const created = await createEntry(entry)
    setEntries((prev) => [created, ...prev])
    return created
  }

  const markExit = async (id) => {
    const updated = await exitEntry(id)
    setEntries((prev) => prev.map((e) => (e.id === id ? updated : e)))
    return updated
  }

  return { entries, loading, error, addEntry, markExit, refresh }
}
```

- [ ] **Step 4: Verify the build still passes**

Run (from `Frontend/`):
```powershell
npm run build
```
Expected output ends with `✓ built in ...`, no errors.

- [ ] **Step 5: Commit**

```bash
git add Frontend/src/api/client.js Frontend/src/api/entries.js Frontend/src/hooks/useEntries.js
git commit -m "feat(frontend): add API client and useEntries data hook"
```

---

### Task 7: EntryForm Component

**Files:**
- Create: `Frontend/src/components/EntryForm.jsx`

**Interfaces:**
- Consumes: `onSubmit` prop (an `async function(payload)`, e.g. `addEntry` from `useEntries`, Task 6).
- Produces: `<EntryForm onSubmit={fn} />` — consumed by `App.jsx` (Task 9).

- [ ] **Step 1: Create `Frontend/src/components/EntryForm.jsx`**

```jsx
import { useState } from 'react'

const initialState = {
  vehicle_number: '',
  driver_name: '',
  driver_phone: '',
  material_description: '',
  material_quantity: '',
  material_unit: '',
  purpose: '',
  reference_doc_number: '',
  supplier_transporter_name: '',
}

export default function EntryForm({ onSubmit }) {
  const [form, setForm] = useState(initialState)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState(null)

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setFormError(null)
    try {
      const payload = {
        ...form,
        material_quantity: form.material_quantity ? Number(form.material_quantity) : null,
      }
      await onSubmit(payload)
      setForm(initialState)
    } catch (err) {
      setFormError(err.response?.data?.detail || 'Failed to save entry')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid grid-cols-1 gap-4 rounded-lg border border-gray-200 p-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      <input name="vehicle_number" value={form.vehicle_number} onChange={handleChange} placeholder="Vehicle Number" required className="rounded border border-gray-300 px-3 py-2" />
      <input name="driver_name" value={form.driver_name} onChange={handleChange} placeholder="Driver Name" required className="rounded border border-gray-300 px-3 py-2" />
      <input name="driver_phone" value={form.driver_phone} onChange={handleChange} placeholder="Driver Phone" className="rounded border border-gray-300 px-3 py-2" />
      <input name="material_description" value={form.material_description} onChange={handleChange} placeholder="Material Description" className="rounded border border-gray-300 px-3 py-2" />
      <input name="material_quantity" type="number" value={form.material_quantity} onChange={handleChange} placeholder="Quantity" className="rounded border border-gray-300 px-3 py-2" />
      <input name="material_unit" value={form.material_unit} onChange={handleChange} placeholder="Unit (kg/ton/units)" className="rounded border border-gray-300 px-3 py-2" />
      <input name="purpose" value={form.purpose} onChange={handleChange} placeholder="Purpose" className="rounded border border-gray-300 px-3 py-2" />
      <input name="reference_doc_number" value={form.reference_doc_number} onChange={handleChange} placeholder="Challan/Invoice/PO Number" className="rounded border border-gray-300 px-3 py-2" />
      <input name="supplier_transporter_name" value={form.supplier_transporter_name} onChange={handleChange} placeholder="Supplier/Transporter" className="rounded border border-gray-300 px-3 py-2" />
      {formError && <p className="col-span-full text-sm text-red-600">{formError}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="col-span-full rounded bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-50 sm:col-span-1"
      >
        {submitting ? 'Saving...' : 'Register Entry'}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Verify the build still passes**

Run (from `Frontend/`):
```powershell
npm run build
```
Expected output ends with `✓ built in ...`, no errors.

- [ ] **Step 3: Commit**

```bash
git add Frontend/src/components/EntryForm.jsx
git commit -m "feat(frontend): add EntryForm component"
```

---

### Task 8: EntryTable Component

**Files:**
- Create: `Frontend/src/components/EntryTable.jsx`

**Interfaces:**
- Consumes: props `{ entries, loading, error, onMarkExit }` (`entries`/`loading`/`error` from `useEntries`, Task 6; `onMarkExit` e.g. `markExit` from `useEntries`).
- Produces: `<EntryTable entries={...} loading={...} error={...} onMarkExit={fn} />` — consumed by `App.jsx` (Task 9).

- [ ] **Step 1: Create `Frontend/src/components/EntryTable.jsx`**

```jsx
export default function EntryTable({ entries, loading, error, onMarkExit }) {
  if (loading) return <p className="text-gray-500">Loading entries...</p>
  if (error) return <p className="text-red-600">{error}</p>
  if (entries.length === 0) return <p className="text-gray-500">No entries yet.</p>

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Vehicle</th>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Driver</th>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Material</th>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Entry</th>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Exit</th>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td className="px-3 py-2">{entry.vehicle_number}</td>
              <td className="px-3 py-2">{entry.driver_name}</td>
              <td className="px-3 py-2">
                {entry.material_description} {entry.material_quantity ? `(${entry.material_quantity} ${entry.material_unit || ''})` : ''}
              </td>
              <td className="px-3 py-2">{new Date(entry.entry_time).toLocaleString()}</td>
              <td className="px-3 py-2">{entry.exit_time ? new Date(entry.exit_time).toLocaleString() : '-'}</td>
              <td className="px-3 py-2">
                {!entry.exit_time && (
                  <button
                    onClick={() => onMarkExit(entry.id)}
                    className="rounded bg-amber-500 px-2 py-1 text-xs font-medium text-white"
                  >
                    Mark Exit
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Verify the build still passes**

Run (from `Frontend/`):
```powershell
npm run build
```
Expected output ends with `✓ built in ...`, no errors.

- [ ] **Step 3: Commit**

```bash
git add Frontend/src/components/EntryTable.jsx
git commit -m "feat(frontend): add EntryTable component"
```

---

### Task 9: App Composition + End-to-End Verification

**Files:**
- Modify: `Frontend/src/App.jsx` (replacing the Task 5 placeholder)

**Interfaces:**
- Consumes: `useEntries` (Task 6), `EntryForm` (Task 7), `EntryTable` (Task 8).
- Produces: the complete single-screen GatePass UI.

- [ ] **Step 1: Replace `Frontend/src/App.jsx`**

```jsx
import EntryForm from './components/EntryForm'
import EntryTable from './components/EntryTable'
import { useEntries } from './hooks/useEntries'

function App() {
  const { entries, loading, error, addEntry, markExit } = useEntries()

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">GatePass — Vehicle Entry Log</h1>
      <div className="mb-8">
        <EntryForm onSubmit={addEntry} />
      </div>
      <EntryTable entries={entries} loading={loading} error={error} onMarkExit={markExit} />
    </div>
  )
}

export default App
```

- [ ] **Step 2: Verify the build passes**

Run (from `Frontend/`):
```powershell
npm run build
```
Expected output ends with `✓ built in ...`, no errors.

- [ ] **Step 3: Automated smoke check of both servers running together**

Start the backend (from `Backend/`, venv activated), in the background:
```powershell
uvicorn app.main:app --reload --port 8000
```

Start the frontend (from `Frontend/`), in the background:
```powershell
npm run dev
```

Then verify the frontend serves and the proxy reaches the backend:
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173
```
Expected output: `200`

```bash
curl -s http://localhost:5173/api/health
```
Expected output: `{"status":"ok"}` (proves the Vite proxy is correctly forwarding `/api` to FastAPI).

- [ ] **Step 4: Manual browser verification (for you to do — not automatable)**

With both servers still running, open `http://localhost:5173` in a browser and:
1. Fill in the form (vehicle number + driver name required) and click "Register Entry" — confirm the new row appears at the top of the table below.
2. Click "Mark Exit" on that row — confirm the "Exit" column populates with a timestamp and the button disappears.
3. Resize the browser to a narrow (mobile) width — confirm the form fields stack into a single column and the table remains usable via horizontal scroll.

Stop both servers (Ctrl+C in each) once verified.

- [ ] **Step 5: Commit**

```bash
git add Frontend/src/App.jsx
git commit -m "feat(frontend): compose EntryForm and EntryTable into the main app screen"
```
