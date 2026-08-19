# GatePass — Weighbridge Workflow Design

## Purpose

Today a `VehicleEntry` only tracks gate-in/gate-out (`entry_time` /
`exit_time`) plus the details captured by whoever registers the entry
(`admin` or `security_guard`). This spec adds a **weighbridge step**: the
same vehicle's weight gets recorded against its existing entry, photos can be
attached to that entry, and a new `weighbridge_operator` role is introduced
for staff who only need to do gate/weighing work (not user management).

This is additive to the existing entry lifecycle, not a new resource —
weight and photos live on/under the existing `VehicleEntry`, keyed by the
same `id`.

## Data model

### `VehicleEntry` (extend, in `Backend/app/models.py`)

New nullable columns:

| Field | Type | Notes |
|---|---|---|
| gross_weight | Numeric(10,2), nullable | the recorded weight |
| weight_unit | string(20), nullable, default `"kg"` | e.g. "kg", "ton" |
| weighed_at | datetime, nullable | set server-side when weight is recorded |
| weighed_by_id | int, FK → `users.id`, nullable | who recorded it |

Weight can be **re-recorded** — saving again overwrites `gross_weight` /
`weighed_at` / `weighed_by_id`. No "already weighed" lock (unlike
`exit_time`), so an operator can correct a mistake without needing admin
intervention. Single-value weighing only (gross weight) — no gross/tare/net
two-stage weighing in this pass.

### `VehicleEntryPhoto` (new table)

| Field | Type | Notes |
|---|---|---|
| id | int, PK | auto-increment |
| entry_id | int, FK → `vehicle_entries.id` | required |
| file_path | string | relative path under the uploads root |
| uploaded_by_id | int, FK → `users.id` | required |
| uploaded_at | datetime | server-side default now |

One entry → many photos. No delete endpoint in this pass (see Out of scope).

### Roles (`Role` literal in `Backend/app/schemas.py`)

Add `"weighbridge_operator"` alongside `"admin"` / `"security_guard"`.
Permission-wise it is equivalent to `security_guard` (can register entries,
mark exit, record weight, attach photos) — it exists so weighbridge staff
get an identity/audit trail (`weighed_by_id`) distinct from gate security,
not because the backend enforces different capabilities. The
`/api/entries/*` routes keep their current single dependency
(`get_current_user` — any authenticated, active user), matching how they
already work today; no route gains role-specific restrictions.

### Migration

The app creates tables via `Base.metadata.create_all()` on startup
(`Backend/app/main.py`), against a real SQL Server database
(`mssql+pyodbc`). `create_all()` only creates **missing tables** — it will
create the new `vehicle_entry_photos` table automatically, but it will
**not** add the four new columns to the already-existing `vehicle_entries`
table. A one-off script, `Backend/scripts/migrate_weighbridge.py`, runs the
needed `ALTER TABLE vehicle_entries ADD ...` statements, each guarded by an
`INFORMATION_SCHEMA.COLUMNS` existence check so the script is idempotent and
safe to re-run. It is run manually once (`python -m
Backend.scripts.migrate_weighbridge`), not on every app startup.

## Backend API (`Backend/app/routers/entries.py`)

- `PATCH /api/entries/{id}/weight`
  - Body: `{ gross_weight: float, weight_unit?: str }`
  - Sets `gross_weight`, `weight_unit` (default `"kg"` if omitted),
    `weighed_at = now()`, `weighed_by_id = current_user.id`
  - `404` if the entry doesn't exist
- `POST /api/entries/{id}/photos`
  - Multipart form upload, one or more files under field name `files`
  - Each file validated: content-type must be `image/jpeg`, `image/png`, or
    `image/webp`; size capped at 10MB — reject with `422` otherwise
  - Saved to disk under `Backend/uploads/entries/{id}/` using a
    server-generated UUID filename (the client-supplied filename is never
    used to build a path, avoiding path traversal); one `VehicleEntryPhoto`
    row created per saved file
  - Returns the created photo records
  - `404` if the entry doesn't exist
- `GET /api/entries` — gains an optional `weighed: Optional[bool]` query
  param: `true` filters to `gross_weight IS NOT NULL`, `false` filters to
  `gross_weight IS NULL` (the "pending" queue), omitted = no filter
- `VehicleEntryOut` gains `gross_weight`, `weight_unit`, `weighed_at`,
  `weighed_by_id`, and `photos: List[PhotoOut]` (`PhotoOut` = `id`,
  `file_path` — exposed as a URL, `uploaded_at`) — so a single
  `GET /api/entries` call carries everything the Weighbridge tab needs, no
  extra per-entry fetch.
- Uploaded files served back via FastAPI `StaticFiles` mounted at
  `/uploads` → `Backend/uploads/`, registered in `main.py`.

### Error handling

Same conventions as the existing entries router: Pydantic gives `422` for
malformed bodies, `404` for a missing entry ID, and the app's global
exception handler converts unexpected errors to a clean `500`. File
validation failures (bad mime type, oversized file) return `422` with a
clear `detail` message before anything touches disk.

## Frontend (`Frontend/`)

### New role option

`weighbridge_operator` added to the role `<Select>` in
`Frontend/src/pages/UsersPage.jsx` (labelled "Weighbridge Operator"), same
pattern as the existing `security_guard` / `admin` options.

### Weighbridge tab

A third tab, "Weighbridge", added next to "New Entry" / "Entry Log" in
`Frontend/src/pages/EntriesPage.jsx`. Open to any authenticated user (tabs
today aren't role-gated, and all three roles are meant to reach this).

- A `Pending` / `All` filter toggle, defaulting to **Pending**
  (`weighed=false`) — the actionable queue for an operator. `All` drops the
  filter and shows every entry with either a weight badge or "Pending".
- Table columns: Vehicle, Driver, Material, Entry time, Weight (value +
  unit, or a "Pending" badge), an "Open" action.
- Clicking "Open" expands a detail panel for that entry:
  - Weight input (number) + unit select (`kg`/`ton`) + Save button →
    `PATCH /api/entries/{id}/weight`
  - Photo section with two capture paths, both available (per your
    request): an **Upload File** button (`<input type="file" multiple
    accept="image/*">`) and a **Capture Photo** button that opens a live
    camera view
  - A thumbnail grid of the entry's existing photos (from the embedded
    `photos` array), read-only in this pass

### Live camera capture (`Frontend/src/components/PhotoCapture.jsx`, new)

Lazy-loaded like `QrScanner.jsx`. Opens the device camera via
`getUserMedia`, shows a live preview with a "Capture" button; on capture,
draws the current video frame to an off-screen `<canvas>`, exports it as a
JPEG blob, and hands that blob back to the caller (which uploads it through
the same `POST /api/entries/{id}/photos` path as a manually-picked file —
one upload code path regardless of capture method).

### API layer (`Frontend/src/api/entries.js`, extended)

- `recordWeight(id, { gross_weight, weight_unit })` → `PATCH
  /entries/{id}/weight`
- `uploadPhotos(id, files)` → `POST /entries/{id}/photos` as
  `multipart/form-data`
- `getEntries` gains a `weighed` filter passthrough (already generic via the
  `filters` param)

### Error handling

Same toast-based pattern already used across the app (`useToast` +
`err.response?.data?.detail`) for weight save and photo upload failures.

## Testing / verification

- Backend: exercised manually via FastAPI's `/docs` page — record weight on
  an entry, upload photos (valid and invalid mime/size), confirm the
  pending filter excludes/includes correctly.
- Frontend: manual run against the dev backend — Weighbridge tab queue,
  weight save, both photo capture paths, thumbnail display.
- No automated test suite added, consistent with the rest of the project.

## Out of scope (for this pass)

- Deleting or replacing an individual uploaded photo
- Two-stage (gross + tare → net) weighing
- Role-specific restrictions on the weight/photo endpoints (currently any
  authenticated user can use them, same as the rest of `/api/entries`)
- Alembic or other formal migration tooling — the one-off idempotent script
  is a deliberate stopgap, matching how this project has deferred
  migrations so far
