# GatePass — Weighbridge Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a vehicle's weight be recorded against its existing gate entry, let photos be attached to that entry, and introduce a `weighbridge_operator` role for the staff who do that work.

**Architecture:** Additive changes to the existing `VehicleEntry` resource — new nullable weight columns plus a new one-to-many `VehicleEntryPhoto` table, both surfaced through the existing `Backend/app/routers/entries.py` router. Frontend adds a third "Weighbridge" tab to the existing Entries page, reusing the same list/detail conventions as `EntryTable`/`EntryForm`.

**Tech Stack:** FastAPI + SQLAlchemy (`mssql+pyodbc`) + Pydantic on the backend; Vite + React 18 + Tailwind CSS v4 (plain JavaScript, no TypeScript) on the frontend.

## Global Constraints

- This project has **no automated test suite**, backend or frontend, by deliberate choice (see the spec's "Out of scope"). Every task below is verified manually — backend via FastAPI's `/docs` Swagger UI, frontend via `npm run build` plus a manual browser walkthrough — matching how the two prior GatePass features were verified. Do not add pytest/vitest/jest as part of this plan.
- `Base.metadata.create_all()` (in `Backend/app/main.py`) only creates **missing tables** — it never alters an existing table. The four new `vehicle_entries` columns MUST be added via the idempotent migration script in Task 2 before the app is restarted with the updated model, or every entries query will fail with "invalid column name".
- Uploaded photos are validated to `image/jpeg` / `image/png` / `image/webp`, capped at 10MB each, and saved under a server-generated UUID filename — never the client-supplied filename (path traversal safety).
- No delete/replace-photo endpoint and no gross/tare/net two-stage weighing in this pass — both are explicitly out of scope per the spec at `docs/superpowers/specs/2026-08-19-gatepass-weighbridge-workflow-design.md`.
- Weight can be re-recorded (no "already weighed" lock) — saving again simply overwrites the previous value, unlike the `exit_time` pattern.

---

### Task 1: Data model — weight fields on `VehicleEntry` + new `VehicleEntryPhoto` table

**Files:**
- Modify: `Backend/app/models.py`

**Interfaces:**
- Consumes: `Base` from `app/database.py` (unchanged).
- Produces: `VehicleEntry.gross_weight` (Numeric, nullable), `VehicleEntry.weight_unit` (String, nullable), `VehicleEntry.weighed_at` (DateTime, nullable), `VehicleEntry.weighed_by_id` (Integer FK → `users.id`, nullable), `VehicleEntry.photos` (relationship → list of `VehicleEntryPhoto`, ordered by `uploaded_at`). New model `VehicleEntryPhoto` with `id`, `entry_id` (FK → `vehicle_entries.id`), `file_path` (String), `uploaded_by_id` (FK → `users.id`), `uploaded_at` (DateTime, server default now). These are consumed by Task 3 (schemas), Task 4 (photo storage), and Task 5 (routes).

- [ ] **Step 1: Replace `Backend/app/models.py` with the extended models**

```python
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class VehicleEntry(Base):
    __tablename__ = "vehicle_entries"

    id = Column(Integer, primary_key=True, index=True)
    vehicle_number = Column(String(20), nullable=False, index=True)
    project_name = Column(String(100), nullable=True)
    subproject_name = Column(String(100), nullable=True)
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
    gross_weight = Column(Numeric(10, 2), nullable=True)
    weight_unit = Column(String(20), nullable=True, default="kg")
    weighed_at = Column(DateTime, nullable=True)
    weighed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    photos = relationship(
        "VehicleEntryPhoto",
        order_by="VehicleEntryPhoto.uploaded_at",
        cascade="all, delete-orphan",
    )


class VehicleEntryPhoto(Base):
    __tablename__ = "vehicle_entry_photos"

    id = Column(Integer, primary_key=True, index=True)
    entry_id = Column(Integer, ForeignKey("vehicle_entries.id"), nullable=False, index=True)
    file_path = Column(String(255), nullable=False)
    uploaded_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    uploaded_at = Column(DateTime, nullable=False, server_default=func.now())


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(60), nullable=False)
    full_name = Column(String(100), nullable=False)
    role = Column(String(20), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
```

- [ ] **Step 2: Verify the models import cleanly and carry the right columns**

Run (from `Backend\`, venv activated):
```powershell
python -c "from app.models import VehicleEntry, VehicleEntryPhoto; print(sorted(c.name for c in VehicleEntry.__table__.columns)); print(sorted(c.name for c in VehicleEntryPhoto.__table__.columns))"
```
Expected output:
```
['created_at', 'driver_name', 'driver_phone', 'entry_time', 'exit_time', 'gross_weight', 'id', 'material_description', 'material_quantity', 'material_unit', 'project_name', 'purpose', 'reference_doc_number', 'subproject_name', 'supplier_transporter_name', 'vehicle_number', 'weighed_at', 'weighed_by_id', 'weight_unit']
['entry_id', 'file_path', 'id', 'uploaded_at', 'uploaded_by_id']
```

Do **not** start/reload the FastAPI app yet — the real database doesn't have the new `vehicle_entries` columns until Task 2 runs, and any entries query against the updated model would fail with "invalid column name".

- [ ] **Step 3: Commit**

```bash
git add Backend/app/models.py
git commit -m "feat(backend): add weight fields and photo relationship to VehicleEntry"
```

---

### Task 2: Idempotent migration script for the new `vehicle_entries` columns

**Files:**
- Create: `Backend/scripts/__init__.py`
- Create: `Backend/scripts/migrate_weighbridge.py`

**Interfaces:**
- Consumes: `engine` from `app/database.py`.
- Produces: the physical `gross_weight`, `weight_unit`, `weighed_at`, `weighed_by_id` columns (plus an `FK_vehicle_entries_weighed_by_id` foreign key constraint) on the real `vehicle_entries` table — required before Task 5's endpoints can be exercised against the running database.

- [ ] **Step 1: Create `Backend/scripts/__init__.py`**

```python
```

(empty file — makes `scripts` an importable package for `python -m scripts.migrate_weighbridge`)

- [ ] **Step 2: Create `Backend/scripts/migrate_weighbridge.py`**

```python
"""One-off, idempotent migration: adds weighbridge columns to vehicle_entries.

Run once against the target database from the Backend/ directory:
    python -m scripts.migrate_weighbridge
Safe to re-run - every statement is guarded by an existence check.
"""
from sqlalchemy import text

from app.database import engine

COLUMNS_TO_ADD = [
    ("gross_weight", "NUMERIC(10,2) NULL"),
    ("weight_unit", "VARCHAR(20) NULL"),
    ("weighed_at", "DATETIME NULL"),
    ("weighed_by_id", "INT NULL"),
]

FK_NAME = "FK_vehicle_entries_weighed_by_id"


def _column_exists(conn, table, column):
    row = conn.execute(
        text(
            "SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS "
            "WHERE TABLE_NAME = :table AND COLUMN_NAME = :column"
        ),
        {"table": table, "column": column},
    ).first()
    return row is not None


def _fk_exists(conn, fk_name):
    row = conn.execute(
        text("SELECT 1 FROM sys.foreign_keys WHERE name = :name"),
        {"name": fk_name},
    ).first()
    return row is not None


def run():
    with engine.begin() as conn:
        for column_name, column_def in COLUMNS_TO_ADD:
            if _column_exists(conn, "vehicle_entries", column_name):
                print(f"Column {column_name} already exists, skipping.")
                continue
            conn.execute(text(f"ALTER TABLE vehicle_entries ADD {column_name} {column_def}"))
            print(f"Added column {column_name}.")

        if _fk_exists(conn, FK_NAME):
            print(f"Constraint {FK_NAME} already exists, skipping.")
        else:
            conn.execute(
                text(
                    f"ALTER TABLE vehicle_entries ADD CONSTRAINT {FK_NAME} "
                    "FOREIGN KEY (weighed_by_id) REFERENCES users(id)"
                )
            )
            print(f"Added constraint {FK_NAME}.")


if __name__ == "__main__":
    run()
```

- [ ] **Step 3: Run the migration and verify it's idempotent**

Run (from `Backend\`, venv activated):
```powershell
python -m scripts.migrate_weighbridge
```
Expected output:
```
Added column gross_weight.
Added column weight_unit.
Added column weighed_at.
Added column weighed_by_id.
Added constraint FK_vehicle_entries_weighed_by_id.
```

Run it again:
```powershell
python -m scripts.migrate_weighbridge
```
Expected output (everything already exists, nothing re-applied):
```
Column gross_weight already exists, skipping.
Column weight_unit already exists, skipping.
Column weighed_at already exists, skipping.
Column weighed_by_id already exists, skipping.
Constraint FK_vehicle_entries_weighed_by_id already exists, skipping.
```

- [ ] **Step 4: Commit**

```bash
git add Backend/scripts/__init__.py Backend/scripts/migrate_weighbridge.py
git commit -m "feat(backend): add idempotent migration for weighbridge columns"
```

---

### Task 3: Schemas — `weighbridge_operator` role, weight/photo Pydantic models

**Files:**
- Modify: `Backend/app/schemas.py`

**Interfaces:**
- Consumes: nothing new (pure Pydantic).
- Produces: `Role` literal now includes `"weighbridge_operator"`; `WeightUpdate` (`gross_weight: float`, `weight_unit: Optional[str]`); `PhotoOut` (`id`, `file_path`, `uploaded_at`); `VehicleEntryOut` gains `gross_weight`, `weight_unit`, `weighed_at`, `weighed_by_id`, `photos: List[PhotoOut]`. Consumed by Task 5 (routes), Task 6 (UsersPage role option).

- [ ] **Step 1: Replace `Backend/app/schemas.py` with the extended schemas**

```python
from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict


class VehicleEntryCreate(BaseModel):
    vehicle_number: str
    project_name: Optional[str] = None
    subproject_name: Optional[str] = None
    driver_name: str
    driver_phone: Optional[str] = None
    material_description: Optional[str] = None
    material_quantity: Optional[float] = None
    material_unit: Optional[str] = None
    purpose: Optional[str] = None
    reference_doc_number: Optional[str] = None
    supplier_transporter_name: Optional[str] = None


class PhotoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    file_path: str
    uploaded_at: datetime


class VehicleEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    vehicle_number: str
    project_name: Optional[str] = None
    subproject_name: Optional[str] = None
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
    gross_weight: Optional[float] = None
    weight_unit: Optional[str] = None
    weighed_at: Optional[datetime] = None
    weighed_by_id: Optional[int] = None
    photos: List[PhotoOut] = []
    created_at: datetime


class WeightUpdate(BaseModel):
    gross_weight: float
    weight_unit: Optional[str] = None


Role = Literal["admin", "security_guard", "weighbridge_operator"]


class LoginRequest(BaseModel):
    username: str
    password: str


class UserCreate(BaseModel):
    username: str
    password: str
    full_name: str
    role: Role


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[Role] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    full_name: str
    role: Role
    is_active: bool
    created_at: datetime
```

- [ ] **Step 2: Verify the schemas import cleanly**

Run (from `Backend\`, venv activated):
```powershell
python -c "from app.schemas import Role, WeightUpdate, PhotoOut, VehicleEntryOut; print(Role.__args__); print(sorted(VehicleEntryOut.model_fields.keys()))"
```
Expected output:
```
('admin', 'security_guard', 'weighbridge_operator')
['created_at', 'driver_name', 'driver_phone', 'entry_time', 'exit_time', 'gross_weight', 'id', 'material_description', 'material_quantity', 'material_unit', 'photos', 'project_name', 'purpose', 'reference_doc_number', 'subproject_name', 'supplier_transporter_name', 'vehicle_number', 'weight_unit', 'weighed_at', 'weighed_by_id']
```

- [ ] **Step 3: Commit**

```bash
git add Backend/app/schemas.py
git commit -m "feat(backend): add weighbridge_operator role and weight/photo schemas"
```

---

### Task 4: Photo storage helper

**Files:**
- Create: `Backend/app/photo_storage.py`

**Interfaces:**
- Consumes: `fastapi.UploadFile`.
- Produces: `save_entry_photo(entry_id: int, upload_file: UploadFile, contents: bytes) -> str` (returns a relative path like `entries/5/<uuid>.jpg`, raises `InvalidPhotoError` for a disallowed mime type or an over-size file), `InvalidPhotoError` exception class, `UPLOAD_ROOT` path constant. Consumed by Task 5 (routes).

- [ ] **Step 1: Create `Backend/app/photo_storage.py`**

```python
import uuid
from pathlib import Path

from fastapi import UploadFile

UPLOAD_ROOT = Path(__file__).resolve().parent.parent / "uploads" / "entries"
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024

EXTENSIONS = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


class InvalidPhotoError(ValueError):
    pass


def save_entry_photo(entry_id: int, upload_file: UploadFile, contents: bytes) -> str:
    if upload_file.content_type not in ALLOWED_CONTENT_TYPES:
        raise InvalidPhotoError(f"Unsupported file type: {upload_file.content_type}")
    if len(contents) > MAX_PHOTO_SIZE_BYTES:
        raise InvalidPhotoError("File exceeds the 10MB size limit")

    entry_dir = UPLOAD_ROOT / str(entry_id)
    entry_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{uuid.uuid4().hex}{EXTENSIONS[upload_file.content_type]}"
    file_path = entry_dir / filename
    file_path.write_bytes(contents)

    return f"entries/{entry_id}/{filename}"
```

- [ ] **Step 2: Verify it imports and rejects a bad content type**

Run (from `Backend\`, venv activated):
```powershell
python -c "from app.photo_storage import save_entry_photo, InvalidPhotoError; from fastapi import UploadFile; from starlette.datastructures import Headers; from io import BytesIO
f = UploadFile(filename='test.txt', file=BytesIO(b'hello'), headers=Headers({'content-type': 'text/plain'}))
try:
    save_entry_photo(1, f, b'hello')
    print('NO ERROR RAISED - BUG')
except InvalidPhotoError as e:
    print('OK:', e)"
```
Expected output: `OK: Unsupported file type: text/plain`

- [ ] **Step 3: Commit**

```bash
git add Backend/app/photo_storage.py
git commit -m "feat(backend): add validated photo storage helper"
```

---

### Task 5: Weight + photo endpoints, static file serving

**Files:**
- Modify: `Backend/app/routers/entries.py`
- Modify: `Backend/app/main.py`
- Modify: `Backend/.gitignore`

**Interfaces:**
- Consumes: `VehicleEntry`, `VehicleEntryPhoto`, `User` (Task 1); `WeightUpdate`, `PhotoOut`, `VehicleEntryOut` (Task 3); `save_entry_photo`, `InvalidPhotoError` (Task 4); `get_current_user` (existing, `app/auth.py`).
- Produces: `PATCH /api/entries/{id}/weight`, `POST /api/entries/{id}/photos`, `GET /api/entries?weighed=` filter, static files served at `/uploads/...`. Consumed by Task 7 (frontend API layer).

- [ ] **Step 1: Replace `Backend/app/routers/entries.py`**

```python
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import User, VehicleEntry, VehicleEntryPhoto
from app.photo_storage import InvalidPhotoError, save_entry_photo
from app.schemas import PhotoOut, VehicleEntryCreate, VehicleEntryOut, WeightUpdate

router = APIRouter(prefix="/api/entries", tags=["entries"], dependencies=[Depends(get_current_user)])


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
    weighed: Optional[bool] = None,
    db: Session = Depends(get_db),
):
    query = db.query(VehicleEntry)
    if vehicle_number:
        query = query.filter(VehicleEntry.vehicle_number.ilike(f"%{vehicle_number}%"))
    if date_from:
        query = query.filter(VehicleEntry.entry_time >= date_from)
    if date_to:
        query = query.filter(VehicleEntry.entry_time <= date_to)
    if weighed is True:
        query = query.filter(VehicleEntry.gross_weight.isnot(None))
    elif weighed is False:
        query = query.filter(VehicleEntry.gross_weight.is_(None))
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


@router.patch("/{entry_id}/weight", response_model=VehicleEntryOut)
def record_weight(
    entry_id: int,
    payload: WeightUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = db.get(VehicleEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    entry.gross_weight = payload.gross_weight
    entry.weight_unit = payload.weight_unit or "kg"
    entry.weighed_at = datetime.utcnow()
    entry.weighed_by_id = current_user.id
    db.commit()
    db.refresh(entry)
    return entry


@router.post("/{entry_id}/photos", response_model=List[PhotoOut], status_code=201)
async def upload_photos(
    entry_id: int,
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = db.get(VehicleEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    created_photos = []
    for upload_file in files:
        contents = await upload_file.read()
        try:
            file_path = save_entry_photo(entry_id, upload_file, contents)
        except InvalidPhotoError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
        photo = VehicleEntryPhoto(entry_id=entry_id, file_path=file_path, uploaded_by_id=current_user.id)
        db.add(photo)
        created_photos.append(photo)

    db.commit()
    for photo in created_photos:
        db.refresh(photo)
    return created_photos
```

- [ ] **Step 2: Replace `Backend/app/main.py`**

```python
import os

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.auth import hash_password
from app.database import Base, SessionLocal, engine
from app.models import User
from app.routers import auth, entries, users

app = FastAPI(title="GatePass API")

Base.metadata.create_all(bind=engine)

UPLOADS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")


def _bootstrap_admin():
    db = SessionLocal()
    try:
        if db.query(User).first() is None:
            admin_username = os.getenv("DEFAULT_ADMIN_USERNAME", "admin")
            admin_password = os.getenv("DEFAULT_ADMIN_PASSWORD", "ChangeMe123!")
            admin = User(
                username=admin_username,
                password_hash=hash_password(admin_password),
                full_name="Default Admin",
                role="admin",
                is_active=True,
            )
            db.add(admin)
            db.commit()
            print(f"Created default admin user '{admin_username}' - change this password immediately.")
    finally:
        db.close()


_bootstrap_admin()

app.include_router(auth.router)
app.include_router(entries.router)
app.include_router(users.router)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.get("/api/health")
def health_check():
    return {"status": "ok"}
```

- [ ] **Step 3: Add `uploads/` to `Backend/.gitignore`**

Replace `Backend/.gitignore` with:
```
__pycache__/
*.pyc
.env
venv/
.venv/
uploads/
```

- [ ] **Step 4: Start the server and verify the new endpoints via the Swagger UI**

Run (from `Backend\`, venv activated), in the background:
```powershell
uvicorn app.main:app --reload --port 8001
```
Expected startup log includes: `Application startup complete.` and no "invalid column name" errors when the first request comes in (confirms Task 2's migration was applied correctly).

Open `http://localhost:8001/docs` in a browser:
1. Expand `POST /api/auth/login`, click "Try it out", submit valid credentials for an existing user in this database, click Execute. Expected: `200` with that user's JSON. The session cookie is now set for this browser tab, so every subsequent "Try it out" call below is authenticated automatically.
2. Expand `POST /api/entries`, Try it out, submit a minimal body (e.g. `{"vehicle_number": "TEST-001", "driver_name": "Test Driver"}`), Execute. Expected: `201` with the created entry, `gross_weight: null`, `photos: []`. Note its `id` — call it `<id>` below.
3. Expand `GET /api/entries`, Try it out, set `weighed` to `false`, Execute. Expected: `200`, and the `<id>` entry from step 2 is in the list.
4. Set `weighed` to `true`, Execute. Expected: `200`, and the `<id>` entry is **not** in the list.
5. Expand `PATCH /api/entries/{entry_id}/weight`, Try it out, set `entry_id` to `<id>`, body `{"gross_weight": 12500, "weight_unit": "kg"}`, Execute. Expected: `200` with `gross_weight: 12500`, `weight_unit: "kg"`, `weighed_at` populated, `weighed_by_id` set to the logged-in user's id.
6. Repeat step 3 (`weighed=false`) — expect `<id>` is now **absent**. Repeat step 4 (`weighed=true`) — expect `<id>` is now **present**.
7. Expand `POST /api/entries/{entry_id}/photos`, Try it out, set `entry_id` to `<id>`, choose any small `.jpg` or `.png` file for `files`, Execute. Expected: `201` with a list containing one object whose `file_path` looks like `entries/<id>/<uuid>.jpg`.
8. Open `http://localhost:8001/uploads/<file_path from step 7>` directly in a browser tab (e.g. `http://localhost:8001/uploads/entries/7/ab12cd34.jpg`). Expected: the uploaded image renders.
9. Repeat step 7 with a `.txt` file instead. Expected: `422` with `detail` starting `"Unsupported file type:"`.

Stop the server (Ctrl+C) once verified.

- [ ] **Step 5: Commit**

```bash
git add Backend/app/routers/entries.py Backend/app/main.py Backend/.gitignore
git commit -m "feat(backend): add weight and photo endpoints, serve uploaded files"
```

---

### Task 6: `weighbridge_operator` role option in User Management

**Files:**
- Modify: `Frontend/src/pages/UsersPage.jsx`

**Interfaces:**
- Consumes: existing `createUser`/`updateUser` API calls (unchanged) — the backend already accepts this role value as of Task 3.
- Produces: an admin can create/edit a user with role `weighbridge_operator` through the UI.

- [ ] **Step 1: Add the option to the "Create User" form select**

In `Frontend/src/pages/UsersPage.jsx`, find:
```jsx
          <Select name="role" value={form.role} onChange={handleChange}>
            <option value="security_guard">Security Guard</option>
            <option value="admin">Admin</option>
          </Select>
```
Replace with:
```jsx
          <Select name="role" value={form.role} onChange={handleChange}>
            <option value="security_guard">Security Guard</option>
            <option value="weighbridge_operator">Weighbridge Operator</option>
            <option value="admin">Admin</option>
          </Select>
```

- [ ] **Step 2: Add the option to the per-row role select**

In the same file, find:
```jsx
                    <Select
                      size="sm"
                      value={u.role}
                      disabled={u.id === currentUser.id}
                      onChange={(e) => handleRoleChange(u, e.target.value)}
                    >
                      <option value="security_guard">Security Guard</option>
                      <option value="admin">Admin</option>
                    </Select>
```
Replace with:
```jsx
                    <Select
                      size="sm"
                      value={u.role}
                      disabled={u.id === currentUser.id}
                      onChange={(e) => handleRoleChange(u, e.target.value)}
                    >
                      <option value="security_guard">Security Guard</option>
                      <option value="weighbridge_operator">Weighbridge Operator</option>
                      <option value="admin">Admin</option>
                    </Select>
```

- [ ] **Step 3: Verify the build passes**

Run (from `Frontend\`):
```powershell
npm run build
```
Expected: build completes with no errors.

- [ ] **Step 4: Manual browser verification (for you to do — not automatable)**

With the backend running (Task 5's server) and the frontend dev server running (`npm run dev` from `Frontend\`):
1. Log in as an admin and go to Users.
2. Create a user with role "Weighbridge Operator" — confirm it appears in the table with that role selected.
3. On an existing row, change the role dropdown to "Weighbridge Operator" and confirm the update succeeds (toast "User role updated").

- [ ] **Step 5: Commit**

```bash
git add Frontend/src/pages/UsersPage.jsx
git commit -m "feat(frontend): add weighbridge_operator role option to User Management"
```

---

### Task 7: Frontend API layer for weight/photos + `/uploads` dev proxy

**Files:**
- Modify: `Frontend/src/api/entries.js`
- Modify: `Frontend/vite.config.js`

**Interfaces:**
- Consumes: `apiClient` (`Frontend/src/api/client.js`, unchanged); backend endpoints from Task 5.
- Produces: `recordWeight(id, {gross_weight, weight_unit}) -> Promise<entry>`, `uploadPhotos(id, files) -> Promise<photo[]>`. Consumed by Task 8.

- [ ] **Step 1: Replace `Frontend/src/api/entries.js`**

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

export async function recordWeight(id, payload) {
  const response = await apiClient.patch(`/entries/${id}/weight`, payload)
  return response.data
}

export async function uploadPhotos(id, files) {
  const formData = new FormData()
  files.forEach((file) => formData.append('files', file))
  // apiClient defaults Content-Type to application/json; clearing it here lets
  // the browser set multipart/form-data with the correct boundary itself.
  const response = await apiClient.post(`/entries/${id}/photos`, formData, {
    headers: { 'Content-Type': undefined },
  })
  return response.data
}
```

- [ ] **Step 2: Add an `/uploads` dev proxy in `Frontend/vite.config.js`**

Replace `Frontend/vite.config.js` with:
```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8001',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:8001',
        changeOrigin: true,
      },
    },
  },
})
```

- [ ] **Step 3: Verify the build passes and the proxy reaches the backend**

Run (from `Frontend\`):
```powershell
npm run build
```
Expected: build completes with no errors.

With the backend from Task 5 running on port 8001 and a photo already uploaded there (Task 5 Step 4.7), start the frontend:
```powershell
npm run dev
```
In a separate terminal, using the `file_path` from Task 5 Step 4.7:
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/uploads/entries/<id>/<filename>
```
Expected output: `200` (proves the Vite proxy forwards `/uploads` to FastAPI, not just `/api`).

- [ ] **Step 4: Commit**

```bash
git add Frontend/src/api/entries.js Frontend/vite.config.js
git commit -m "feat(frontend): add weight/photo API calls and /uploads dev proxy"
```

---

### Task 8: Camera capture + Weighbridge detail panel (weight form, photo upload/capture, thumbnails)

**Files:**
- Create: `Frontend/src/components/PhotoCapture.jsx`
- Create: `Frontend/src/components/WeighbridgeDetail.jsx`

**Interfaces:**
- Consumes: `recordWeight`, `uploadPhotos` (Task 7); `useToast` (existing); `Button`, `Card`, `Input`, `Select` (existing `ui/` components).
- Produces: `<PhotoCapture onCapture={(blob) => void} onClose={() => void} />`; `<WeighbridgeDetail entry={entryObject} onClose={() => void} />` (calls `onClose` after any successful weight save when the user closes the panel, so the caller can refresh its list). Consumed by Task 9.

- [ ] **Step 1: Create `Frontend/src/components/PhotoCapture.jsx`**

```jsx
import { useEffect, useRef } from 'react'
import Button from './ui/Button'

export default function PhotoCapture({ onCapture, onClose }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)

  useEffect(() => {
    let cancelled = false

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      })
      .catch(() => {
        onClose()
      })

    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((track) => track.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCapture = () => {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    canvas.toBlob((blob) => {
      if (blob) onCapture(blob)
    }, 'image/jpeg')
  }

  return (
    <div className="mb-4 rounded-lg border border-slate-200 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Capture Photo</h3>
        <button onClick={onClose} className="text-sm font-medium text-slate-500 hover:text-slate-700">
          Cancel
        </button>
      </div>
      <video ref={videoRef} autoPlay playsInline className="w-full rounded-lg bg-black" />
      <Button type="button" onClick={handleCapture} className="mt-3 w-full">
        Capture
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Create `Frontend/src/components/WeighbridgeDetail.jsx`**

```jsx
import { lazy, Suspense, useState } from 'react'
import { recordWeight, uploadPhotos } from '../api/entries'
import { useToast } from '../context/ToastContext'
import Button from './ui/Button'
import Card from './ui/Card'
import Input from './ui/Input'
import Select from './ui/Select'

const PhotoCapture = lazy(() => import('./PhotoCapture'))

export default function WeighbridgeDetail({ entry, onClose }) {
  const { showToast } = useToast()
  const [weight, setWeight] = useState(entry.gross_weight ?? '')
  const [unit, setUnit] = useState(entry.weight_unit || 'kg')
  const [photos, setPhotos] = useState(entry.photos || [])
  const [savingWeight, setSavingWeight] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [capturing, setCapturing] = useState(false)

  const handleSaveWeight = async (e) => {
    e.preventDefault()
    setSavingWeight(true)
    try {
      await recordWeight(entry.id, { gross_weight: Number(weight), weight_unit: unit })
      showToast('Weight recorded', 'success')
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to record weight', 'error')
    } finally {
      setSavingWeight(false)
    }
  }

  const handleUpload = async (fileList) => {
    const files = Array.from(fileList || [])
    if (files.length === 0) return
    setUploading(true)
    try {
      const created = await uploadPhotos(entry.id, files)
      setPhotos((prev) => [...prev, ...created])
      showToast('Photo uploaded', 'success')
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to upload photo', 'error')
    } finally {
      setUploading(false)
    }
  }

  const handleCaptured = async (blob) => {
    setCapturing(false)
    await handleUpload([new File([blob], 'capture.jpg', { type: 'image/jpeg' })])
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <Card className="w-full max-w-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">{entry.vehicle_number}</h2>
          <button onClick={onClose} className="text-sm font-medium text-slate-500 hover:text-slate-700">
            Close
          </button>
        </div>

        <form onSubmit={handleSaveWeight} className="mb-6 flex flex-wrap items-end gap-3">
          <Input
            type="number"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="Weight"
            required
          />
          <Select value={unit} onChange={(e) => setUnit(e.target.value)}>
            <option value="kg">kg</option>
            <option value="ton">ton</option>
          </Select>
          <Button type="submit" disabled={savingWeight}>
            {savingWeight ? 'Saving...' : 'Save Weight'}
          </Button>
        </form>

        <div className="mb-4 flex items-center gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Photos</h3>
          <label className="cursor-pointer text-sm font-medium text-blue-600 hover:text-blue-700">
            Upload File
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              disabled={uploading}
              onChange={(e) => handleUpload(e.target.files)}
            />
          </label>
          <Button type="button" variant="secondary" size="sm" onClick={() => setCapturing(true)}>
            Capture Photo
          </Button>
        </div>

        {capturing && (
          <Suspense fallback={<p className="text-sm text-slate-500">Loading camera...</p>}>
            <PhotoCapture onCapture={handleCaptured} onClose={() => setCapturing(false)} />
          </Suspense>
        )}

        <div className="flex flex-wrap gap-2">
          {photos.map((photo) => (
            <img
              key={photo.id}
              src={`/uploads/${photo.file_path}`}
              alt="Vehicle attachment"
              className="h-20 w-20 rounded-lg border border-slate-200 object-cover"
            />
          ))}
          {photos.length === 0 && <p className="text-sm text-slate-400">No photos yet.</p>}
        </div>
      </Card>
    </div>
  )
}
```

- [ ] **Step 3: Verify the build passes**

Run (from `Frontend\`):
```powershell
npm run build
```
Expected: build completes with no errors.

Note: these two components aren't reachable from the UI yet — full browser verification happens in Task 9 once `WeighbridgeDetail` is wired into a tab.

- [ ] **Step 4: Commit**

```bash
git add Frontend/src/components/PhotoCapture.jsx Frontend/src/components/WeighbridgeDetail.jsx
git commit -m "feat(frontend): add camera capture and weighbridge detail panel"
```

---

### Task 9: Weighbridge tab (pending/all queue) + Entries page wiring

**Files:**
- Create: `Frontend/src/components/WeighbridgeTab.jsx`
- Modify: `Frontend/src/pages/EntriesPage.jsx`

**Interfaces:**
- Consumes: `useEntries` (existing, `Frontend/src/hooks/useEntries.js`); `WeighbridgeDetail` (Task 8); `Badge`, `Button`, `Card` (existing `ui/` components).
- Produces: a third "Weighbridge" tab on the Entries page. This is the final integration task — full end-to-end manual verification happens here.

- [ ] **Step 1: Create `Frontend/src/components/WeighbridgeTab.jsx`**

```jsx
import { useState } from 'react'
import { useEntries } from '../hooks/useEntries'
import Badge from './ui/Badge'
import Button from './ui/Button'
import Card from './ui/Card'
import WeighbridgeDetail from './WeighbridgeDetail'

export default function WeighbridgeTab() {
  const [showAll, setShowAll] = useState(false)
  const { entries, loading, error, refresh } = useEntries(showAll ? {} : { weighed: false })
  const [selectedEntry, setSelectedEntry] = useState(null)

  const handleClose = async () => {
    setSelectedEntry(null)
    await refresh()
  }

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <Button variant={showAll ? 'secondary' : 'primary'} size="sm" onClick={() => setShowAll(false)}>
          Pending
        </Button>
        <Button variant={showAll ? 'primary' : 'secondary'} size="sm" onClick={() => setShowAll(true)}>
          All
        </Button>
      </div>

      {loading && <p className="text-slate-500">Loading entries...</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && !error && entries.length === 0 && <p className="text-slate-500">No entries to show.</p>}

      {!loading && !error && entries.length > 0 && (
        <Card className="overflow-x-auto p-0">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Vehicle</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Driver</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Material</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Entry</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Weight</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{entry.vehicle_number}</td>
                  <td className="px-4 py-3 text-slate-600">{entry.driver_name}</td>
                  <td className="px-4 py-3 text-slate-600">{entry.material_description || '-'}</td>
                  <td className="px-4 py-3 text-slate-500">{new Date(entry.entry_time).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    {entry.gross_weight ? (
                      <Badge tone="green">{entry.gross_weight} {entry.weight_unit}</Badge>
                    ) : (
                      <Badge tone="blue">Pending</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Button size="sm" onClick={() => setSelectedEntry(entry)}>
                      Open
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {selectedEntry && <WeighbridgeDetail entry={selectedEntry} onClose={handleClose} />}
    </div>
  )
}
```

- [ ] **Step 2: Wire the tab into `Frontend/src/pages/EntriesPage.jsx`**

Replace `Frontend/src/pages/EntriesPage.jsx` with:
```jsx
import { useState } from 'react'
import EntryForm from '../components/EntryForm'
import EntryTable from '../components/EntryTable'
import WeighbridgeTab from '../components/WeighbridgeTab'
import { useEntries } from '../hooks/useEntries'

const TABS = [
  { key: 'new', label: 'New Entry' },
  { key: 'log', label: 'Entry Log' },
  { key: 'weighbridge', label: 'Weighbridge' },
]

export default function EntriesPage() {
  const { entries, loading, error, addEntry, markExit } = useEntries()
  const [activeTab, setActiveTab] = useState('new')

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Vehicle Entry Log</h1>

      <div className="mb-6 flex gap-2 border-b border-slate-200">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'new' && <EntryForm onSubmit={addEntry} />}
      {activeTab === 'log' && <EntryTable entries={entries} loading={loading} error={error} onMarkExit={markExit} />}
      {activeTab === 'weighbridge' && <WeighbridgeTab />}
    </div>
  )
}
```

- [ ] **Step 3: Verify the build passes**

Run (from `Frontend\`):
```powershell
npm run build
```
Expected: build completes with no errors.

- [ ] **Step 4: Manual browser verification (for you to do — not automatable)**

With the backend (Task 5) and frontend dev server both running:
1. Log in and go to Entries → click the "Weighbridge" tab. Confirm it defaults to "Pending" and lists entries with no weight yet, each showing a blue "Pending" badge.
2. Click "Open" on one entry. Confirm the detail panel shows the vehicle number, a weight input, and a "Photos" section with "Upload File" and "Capture Photo" buttons.
3. Enter a weight, pick a unit, click "Save Weight". Confirm a success toast appears.
4. Click "Upload File", pick an image from disk. Confirm it appears as a new thumbnail and a success toast appears.
5. Click "Capture Photo" (requires a webcam). Confirm a live camera preview appears; click "Capture". Confirm the captured photo is uploaded and appears as a thumbnail. If no camera is available in the test environment, confirm instead that the panel gracefully closes the capture view rather than crashing (the `getUserMedia` rejection path in `PhotoCapture.jsx`).
6. Click "Close". Confirm the entry disappears from the "Pending" list (it now has a weight).
7. Click "All". Confirm the same entry now appears with a green weight badge, and its thumbnails/weight persist if you reopen it.
8. Resize the browser to a narrow width. Confirm the table remains usable via horizontal scroll and the detail panel stays readable.

- [ ] **Step 5: Commit**

```bash
git add Frontend/src/components/WeighbridgeTab.jsx Frontend/src/pages/EntriesPage.jsx
git commit -m "feat(frontend): add Weighbridge tab with pending/all queue"
```
