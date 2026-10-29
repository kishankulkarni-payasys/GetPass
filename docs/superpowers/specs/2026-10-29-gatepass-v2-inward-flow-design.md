# GatePass — v2 Inward Material Flow (OCR gate-in → weigh → quality → GRN → gate-out)

> Status: spec, ready to build. Date: 2026-10-29.
> Source documents (written for a different codebase, used here as the business requirement only):
> `gatepass-v2-ocr-flow-requirements.md`, `gatepass-v2-handover.md`, `gatepass-overview.md`, `ui-mockups.html`.
> None of their code locations (`foundation/api`, `modules/gatepass`, Alembic, Read Adapter / Write Router,
> Action Ledger) exist in this repo. This spec maps each requirement onto this app.

## 1. Purpose

Today GatePass registers a vehicle, lets the weighbridge record one gross weight, and lets the gate mark
exit. Nothing tracks whether the material was checked, received into stores, or booked in the ERP.

This change gives every **inward material** vehicle one tracked journey:

```
gate-in (OCR or manual) → gross weight → on site / unloading → quality (HARD GATE)
  → GRN draft → GRN approved (ERP post, retried on failure) → [optional tare] → gate-out
```

Other vehicles (visitors, outward, service, all old rows) keep today's simple in → out behaviour.

Requirement in plain words: the guard captures plate, PO and challan (camera + OCR where available, typing
otherwise); the system checks the PO; the weighbridge records weights as an unchangeable history; the
material cannot be received into stores until quality has given a result; the store in-charge confirms
received / accepted / rejected quantities and approves; the GRN goes to the ERP (and is retried if the ERP
is down); rejected material leaves on a return out-pass; a supervisor sees every vehicle and what is stuck.

User stories
- As a **security guard**, I want the plate and documents read from photos, so that I type less and the pass has the right PO and challan.
- As a **weighbridge operator**, I want weights read from the indicator and kept as a history, so that a weight can never be silently overwritten.
- As a **quality inspector**, I want to record accepted / rejected quantity per challan line, so that stores cannot receive material I have not checked.
- As a **store in-charge**, I want a GRN pre-filled from the challan and quality result, so that I only correct what differs and then post to the ERP.
- As a **site supervisor**, I want a live board with ageing, so that I see which vehicle is stuck and where.

## 2. Current behaviour (verified in code and data, 2026-10-29)

| Area | Today | Where |
|---|---|---|
| Pass record | One `vehicle_entries` row per vehicle. One free-text `reference_doc_number` (PO / challan / invoice mixed), one material line (`material_description`, `material_quantity`, `material_unit`), `purpose`, supplier. | `Backend/app/models.py` `VehicleEntry` |
| Gate-in | New Entry form; two QR scans (document QR, vehicle QR) only pre-fill the form. No OCR. | `Frontend/src/components/EntryForm.jsx`, `QrScanner.jsx` |
| Weighing | `PATCH /api/entries/{id}/weight` overwrites `gross_weight` each save; no history, no tare, no source flag. | `Backend/app/routers/entries.py` `record_weight` |
| Photos | `vehicle_entry_photos`, no type. Only admin / weighbridge can upload (guard blocked by `require_weighbridge_write`). No delete endpoint. | `entries.py` `upload_photos`, `photo_storage.py` |
| Exit | `PATCH /api/entries/{id}/exit` any time, once. | `entries.py` `mark_exit` |
| Roles | `admin`, `security_guard`, `weighbridge_operator`. Guards are **deny-lists** (`require_entry_write` blocks weighbridge; `require_weighbridge_write` blocks guard) — any new role would silently pass both. | `Backend/app/auth.py` |
| Frontend access | `src/navigation/navItems.js` `SECTION_ROLES` is the single source; sections `new`, `log`, `weighbridge`, `users`, `account`. | |
| i18n | en / hi / mr string modules; `check:i18n` prebuild fails on missing keys or duplicates. | `src/i18n/*` |
| State, PO check, quality, GRN, ERP, audit, offline | None. | |
| Data | 5 entries (all exited, 4 weighed), 6 photos, users: 2 admin + 1 weighbridge operator. Migration risk is low. | read-only SELECT |
| Tests | None in the repo. | |

## 3. Gap table

| # | Topic | Today | v2 docs | What we build here |
|---|---|---|---|---|
| G1 | Gate-in trigger | Manual form + QR pre-fill | OCR: ANPR plate, PO doc, challan doc, with confidence | Gate-in screen with 3 captures (plate / PO / challan) → OCR adapter → review panel with confidence; manual typing always possible; QR pre-fill kept as a third input method |
| G2 | Documents | One mixed `reference_doc_number` | Separate PO no, supplier, challan no, challan lines | New columns `po_number`, `challan_number`; new table `pass_challan_lines` (1..n lines) |
| G3 | PO check | None | Cross-check PO with Farvision; warn, never block; supplier lookup fallback | PO-lookup adapter (none / mock / http); result stored on the pass; supplier search endpoint |
| G4 | Low confidence / override | n/a | Highlight below threshold; edits flagged `manual_override` | `OCR_CONFIDENCE_THRESHOLD`; per-field override list stored + audit row per changed field |
| G5 | Gross weight | Single overwritable value | Indicator read, stable only, raw frame immutable, manual flagged | New `pass_weighments` table, insert-only; indicator adapter; manual entry needs a reason |
| G6 | Tare / net | None | Optional, informational | Tare row in the same table; net shown when both exist; never blocks |
| G7 | Pass state | Derived from `exit_time` only | One state machine | `pass_state` column + server-side transition table (section 5) |
| G8 | Quality | None | Hard gate; result from Quality app event | Hard gate enforced server-side; service endpoint for an external Quality app **and** an in-app result screen for a new `quality_inspector` role (deliberate deviation, section 13) |
| G9 | GRN | None | Draft pre-filled from challan, freely editable, approve, approver ≠ weigher | `goods_receipts` + `goods_receipt_lines`; segregation-of-duty check |
| G10 | ERP post | None | Live Farvision write; retry queue; publish `GRNPosted` | GRN-writer adapter (mock default / http); `erp_status` + attempts + manual retry + retry script; outbox row `Gatepass.GRNPosted v1` |
| G11 | Reject return | None | Reject-return out-pass for rejected qty | Out-pass number generated at GRN approval when any rejected qty > 0; printable page; guard confirms at gate-out |
| G12 | Gate-out | Any time | After GRN (release) or reject-return | Inward passes: only from allowed states (section 5); other vehicles unchanged |
| G13 | Roles | 3 roles, deny-list guards | + store in-charge, site supervisor (quality inspector in Quality app) | Add `store_incharge`, `site_supervisor`, `quality_inspector`; replace deny-lists with allow-lists |
| G14 | Dashboard | None | KPIs + live vehicle board + dwell ageing | `/dashboard` page + `GET /api/dashboard/summary`, polled every 30 s |
| G15 | Audit | None | Every manual edit / override in Action Ledger | `pass_audit_log` insert-only table; timeline on the pass detail page |
| G16 | Offline | None | Gate-in capture queued offline, synced on reconnect | Browser queue (IndexedDB) for gate-in pass + its photos, idempotent via `client_ref` |
| G17 | Colours | Teal app palette | Mockup tokens + state pills | Mockup token set adopted app-wide (section 12) |

## 4. Two kinds of pass

`vehicle_entries.pass_type`:

| Value | Meaning | Flow |
|---|---|---|
| `inward` | Material against a PO. The v2 flow. | Full state machine (section 5) |
| `general` | Anything else: visitor, service, outward, returnable, and **every existing row**. | `GATE_IN` → `GATE_OUT` (or `CANCELLED`). Weighing optional and unchanged in meaning. |

The guard chooses the type at the top of the gate-in screen; default `inward`. The old `purpose` field stays for `general`.

## 5. State machine

Stored in `vehicle_entries.pass_state` (string). Every change goes through one server helper that checks the
table below, writes `pass_state_changed_at`, and adds an audit row. Any other transition returns
**409 "Action not allowed in the current pass state"**.

### 5.1 States

| State | Meaning | Pill tone | Pill text (en) |
|---|---|---|---|
| `GATE_IN` | Inward: at gate, awaiting gross weight. General: on site. | warn | Inward: "Weigh gross". General: "On site" |
| `ON_SITE` | Gross captured; vehicle unloading. | warn | "On site · unloading" |
| `QUALITY_PENDING` | Sent for inspection. **Hard gate.** | crit | "Awaiting quality" |
| `QUALITY_RESOLVED` | Result recorded, GRN not started. | good | "Quality done" (+ result pill) |
| `GRN_DRAFT` | GRN being prepared. | good | "GRN draft" |
| `GRN_APPROVED` | GRN approved in app. ERP status is tracked separately (5.3). | by ERP status | "GRN posted" (info) / "GRN pending post" (crit) / "Return only – no GRN" (warn) |
| `GATE_OUT` | Left the site. Terminal. | neutral | "Gate-out" |
| `CANCELLED` | Pass voided before weighing (wrong vehicle, turned back). Terminal. | neutral | "Cancelled" |

### 5.2 Transitions

| # | From → To | Trigger (endpoint) | Who | Guard conditions |
|---|---|---|---|---|
| T1 | (none) → `GATE_IN` | Create pass | security_guard, admin | Inward: vehicle no, PO no, challan no, ≥1 challan line required |
| T2 | `GATE_IN` → `ON_SITE` | Capture **gross** weighment | weighbridge_operator, admin | Inward only; indicator stable or manual with reason |
| T3 | `ON_SITE` → `QUALITY_PENDING` | "Unloaded — send for inspection" | store_incharge, admin | — (owner of this step was undefined in the docs; see R3) |
| T4 | `QUALITY_PENDING` → `QUALITY_RESOLVED` | Quality result (in-app or service endpoint) | quality_inspector, admin, Quality service | Result consistent with lines (rule B10) |
| T4b | `QUALITY_RESOLVED` → `QUALITY_RESOLVED` | Correct the quality result | quality_inspector, admin, Quality service | Only before a GRN draft exists; old result kept in audit |
| T5 | `QUALITY_RESOLVED` → `GRN_DRAFT` | "Start GRN" (creates the draft) | store_incharge, admin | **Hard gate**: a quality result must exist |
| T6 | `GRN_DRAFT` → `GRN_APPROVED` | Approve GRN | store_incharge, admin | Approver is not any user who captured a gross or tare weighment on this pass |
| T7 | `GRN_APPROVED` → `GATE_OUT` | Gate-out | security_guard, admin | If rejected qty > 0: guard ticks "rejected material is on this vehicle" |
| T8 | `GATE_IN` → `GATE_OUT` | Gate-out | security_guard, admin | **General passes only** |
| T9 | `GATE_IN` → `CANCELLED` | Cancel pass, reason required | security_guard, admin | No gross weighment yet (inward) / any time before exit (general) |

Not a state change (allowed while the pass is open, each writes audit):
- Re-capture gross (new row supersedes the old one; reason required) — while state is `ON_SITE`, `QUALITY_PENDING`, `QUALITY_RESOLVED` or `GRN_DRAFT`.
- Capture tare (optional) — inward from `ON_SITE` up to before `GATE_OUT`; general any time before exit.
- Upload extra photos.
- Edit GRN lines — only in `GRN_DRAFT`.
- Retry ERP post — only `GRN_APPROVED` with `erp_status` `pending` or `failed`, and still allowed after `GATE_OUT`.

Explicitly **not** allowed (each gives 409): gate-out of an inward pass before `GRN_APPROVED`; GRN start before
quality; sending to quality before gross; any change after `GATE_OUT` or `CANCELLED` except ERP retry and viewing.

### 5.3 ERP post status (separate from the vehicle state)

`goods_receipts.erp_status`: `not_required` (all accepted qty = 0) · `pending` (queued / in flight) · `posted` · `failed` (last attempt failed; retry allowed).
It is separate so a truck is not held at the gate because the ERP is down. The dashboard shows `pending` + `failed` as "GRN pending post" (crit) — this is the docs' `GRN_APPROVED-pending`.

### 5.4 Lifecycle check (every path ends somewhere)

- Happy path: T1 → T2 → T3 → T4 (approved) → T5 → T6 (posted) → [tare] → T7.
- Partial: same, GRN has accepted + rejected; return out-pass generated at T6; guard confirms at T7.
- Full reject: T4 (rejected) → T5 → T6 with all accepted 0 → `erp_status = not_required`, out-pass generated → T7.
- ERP down: T6 → `failed` → vehicle may still exit (T7) → retry later until `posted`.
- Wrong vehicle at gate: T1 → T9.
- Quality never comes: stays `QUALITY_PENDING`; red on dashboard after `QUALITY_SLA_MINUTES`; no GRN, no gate-out. An admin can record the result in-app (T4) when the external app is down.
- Reloading rejected material later / replacement supply: rejected material leaves on the **same** vehicle with the return out-pass. A replacement delivery is a **new** pass. Leaving rejected material on site for later pickup is out of scope.

## 6. Data model

All timestamps naive UTC as today. All new tables created by `Base.metadata.create_all`; new columns on existing tables via the migration script (6.4).

### 6.1 `vehicle_entries` — new columns (all nullable unless stated)

| Column | Type | Notes |
|---|---|---|
| pass_type | VARCHAR(10) NOT NULL DEFAULT 'general' | `inward` / `general` |
| pass_state | VARCHAR(20) NOT NULL DEFAULT 'GATE_IN' | section 5 |
| pass_state_changed_at | DATETIME | drives "time in state" ageing |
| client_ref | VARCHAR(36) | browser-generated UUID for offline idempotency; filtered UNIQUE index where not null |
| gate_in_method | VARCHAR(10) | `ocr` / `qr` / `manual` / `legacy` |
| created_by_id | INT FK users | who created the pass (missing today) |
| po_number | VARCHAR(50) | |
| challan_number | VARCHAR(50) | |
| po_lookup_status | VARCHAR(15) | `matched` / `not_found` / `not_checked` (adapter off or error) |
| po_lookup_snapshot | NVARCHAR(MAX) | JSON of PO header + open lines at gate-in (for GRN `po_qty`) |
| anpr_confidence | NUMERIC(5,2) | 0–100 |
| po_ocr_confidence | NUMERIC(5,2) | |
| challan_ocr_confidence | NUMERIC(5,2) | |
| manual_override | BIT NOT NULL DEFAULT 0 | true if the guard changed any OCR value or confirmed a low-confidence field |
| cancelled_reason | NVARCHAR(200) | |
| gross_weight, weight_unit, weighed_at, weighed_by_id | existing | **kept** as a copy of the current gross weighment so the existing Log / Weighbridge list keep working |

`reference_doc_number`, `material_*`, `purpose` stay for general passes and legacy rows. For inward passes the API fills `reference_doc_number` with the PO number and `material_description` with the first challan line so old list columns still read sensibly.

### 6.2 New tables

**pass_challan_lines** — id, entry_id FK, line_no INT, material NVARCHAR(200), quantity NUMERIC(12,3), uom VARCHAR(20), ocr_confidence NUMERIC(5,2) NULL. Unique (entry_id, line_no). Max 20 lines per pass.

**pass_weighments** (insert-only; no UPDATE / DELETE endpoint) — id, entry_id FK, kind VARCHAR(5) `gross`/`tare`, weight NUMERIC(10,2), unit VARCHAR(5) `kg`/`ton`, source VARCHAR(10) `indicator`/`manual`/`legacy`, indicator_frame_ref VARCHAR(100) NULL, raw_frame NVARCHAR(2000) NULL (indicator output as received), stable BIT NULL, manual_reason NVARCHAR(200) NULL, supersedes_id FK self NULL, captured_by_id FK users, captured_at. The current gross / tare = latest row of that kind.

**vehicle_entry_photos** — new columns: kind VARCHAR(15) NOT NULL DEFAULT 'vehicle' (`plate`, `po_doc`, `challan_doc`, `weigh_frame`, `vehicle`, `other`), weighment_id FK NULL.

**quality_results** — id, entry_id FK, result VARCHAR(10) `approved`/`rejected`/`partial`, source VARCHAR(10) `in_app`/`service`, inspected_by_name NVARCHAR(100), inspected_by_id FK users NULL (in-app), inspected_at, recorded_at, remarks NVARCHAR(500), is_current BIT. A correction (T4b) sets the old row `is_current = 0` and inserts a new one.

**quality_result_lines** — id, quality_result_id FK, challan_line_id FK, accepted_qty NUMERIC(12,3), rejected_qty NUMERIC(12,3), remarks NVARCHAR(200).

**goods_receipts** — id, entry_id FK UNIQUE (one GRN per pass), status VARCHAR(10) `draft`/`approved`, created_by_id, created_at, approved_by_id NULL, approved_at NULL, erp_status VARCHAR(15) NULL, erp_grn_number VARCHAR(50) NULL, erp_attempts INT DEFAULT 0, erp_last_error NVARCHAR(500) NULL, erp_last_attempt_at NULL, idempotency_key VARCHAR(64) UNIQUE, return_pass_number VARCHAR(20) NULL UNIQUE.

**goods_receipt_lines** — id, goods_receipt_id FK, challan_line_id FK, material, uom, po_qty NULL, challan_qty, received_qty, accepted_qty, rejected_qty (all NUMERIC(12,3)), qty_edited BIT, remarks NVARCHAR(200).

**pass_audit_log** (insert-only) — id, entry_id FK, action VARCHAR(40) (e.g. `pass_created`, `state_changed`, `ocr_field_overridden`, `weighment_captured`, `weighment_superseded`, `grn_line_edited`, `grn_approved`, `erp_post_attempt`, `quality_result_recorded`, `quality_result_corrected`, `photo_uploaded`), field VARCHAR(50) NULL, old_value NVARCHAR(500) NULL, new_value NVARCHAR(500) NULL, is_manual_override BIT, actor_user_id FK NULL, actor_service VARCHAR(30) NULL, created_at. Never store driver phone, tokens, secrets or image URLs in values.

**integration_events** (outbox) — id, event_name VARCHAR(60), version INT, entry_id FK, payload NVARCHAR(MAX), created_at, delivered_at NULL. Events written: `Gatepass.InspectionRequested v1` (T3), `Gatepass.GRNPosted v1` (ERP `posted`). Delivering the outbox to a bus is out of scope; the Quality app can also pull (8.6).

### 6.3 Numbers

Quantities NUMERIC(12,3) (bags, MT, m³ need decimals); weights stay NUMERIC(10,2) as today. All quantities ≥ 0.

### 6.4 Migration — `Backend/scripts/migrate_gatepass_v2.py`

Same pattern as `migrate_weighbridge.py`: idempotent, every statement guarded by an `INFORMATION_SCHEMA` / `sys.*` existence check, run once with `python -m scripts.migrate_gatepass_v2` from `Backend/` **before** starting the new API (new tables are made by `create_all` on start; run the script again after the first start only if it reports tables missing — it must tolerate both orders).

Steps:
1. Add the 6.1 columns to `vehicle_entries` and `kind` / `weighment_id` to `vehicle_entry_photos` (NOT NULL columns with DEFAULT so existing rows fill).
2. Filtered unique index on `client_ref`.
3. Backfill legacy rows: `pass_type='general'`, `gate_in_method='legacy'`, `pass_state = 'GATE_OUT'` if `exit_time` set else `'GATE_IN'`, `pass_state_changed_at = COALESCE(exit_time, entry_time)`.
4. For each row with `gross_weight` and no weighment row: insert one `pass_weighments` row (`kind='gross'`, `source='legacy'`, `captured_by_id = weighed_by_id`, `captured_at = weighed_at`). Skip if `weighed_by_id` is null (log a count).
5. Print counts per step; never print row data.

Legacy rows therefore display everywhere, keep their photos, and behave as general passes.

## 7. Roles and permissions

New roles in `schemas.Role` and `navItems.ROLES`: `store_incharge`, `site_supervisor`, `quality_inspector` (all fit `users.role` VARCHAR(20)).
**Backend guards become allow-lists**: `require_roles(...)` replaces `require_entry_write` / `require_weighbridge_write` (which would otherwise let every new role register entries and weigh).

| Action | admin | security_guard | weighbridge_operator | store_incharge | quality_inspector | site_supervisor |
|---|---|---|---|---|---|---|
| View passes, pass detail, log | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Gate-in (create pass, OCR, PO lookup) | ✓ | ✓ | | | | |
| Upload gate-in photos (plate / PO / challan / vehicle) | ✓ | ✓ | | | | |
| Cancel pass (T9) | ✓ | ✓ | | | | |
| Gross / tare weighment, weigh-frame photos | ✓ | | ✓ | | | |
| Send for inspection (T3) | ✓ | | | ✓ | | |
| Record / correct quality result | ✓ | | | | ✓ | |
| Start GRN, edit GRN lines, approve, retry ERP | ✓ | | | ✓ | | |
| Gate-out (T7 / T8), print return out-pass | ✓ | ✓ | | (print only) ✓ | | |
| Dashboard | ✓ | | | ✓ | | ✓ |
| Users | ✓ | | | | | |

Segregation of duty (B9) applies to admin too. Quality service endpoints use a shared secret, not a user role.

## 8. API

Errors use the existing style `{"detail": "<English sentence>"}`; every new `detail` string is listed in 8.8 so the frontend can translate it. 401 / 403 as today for auth / role. All bodies validated by Pydantic; strings trimmed and length-capped like `VehicleEntryCreate`.

### 8.1 Gate-in — `Backend/app/routers/gate_in.py` (prefix `/api/gate-in`)

| Method / path | Role | Request | Response | Errors |
|---|---|---|---|---|
| GET `/config` | gate-in roles | — | `{ocr_enabled, po_lookup_enabled, ocr_confidence_threshold, max_challan_lines}` | — |
| POST `/ocr` | gate-in roles | multipart `image` (jpeg/png/webp, ≤10 MB, same validation as photos) + `doc_type` = `plate`/`po`/`challan` | plate `{plate, confidence}`; po `{po_number, supplier_name, confidence, field_confidence:{...}}`; challan `{challan_number, lines:[{material, quantity, uom, confidence}], confidence}` | 422 bad image / doc_type; 503 "OCR service is not configured"; 502 "OCR service failed. Enter the details manually." |
| GET `/po/{po_number}` | gate-in roles | — | `{status: matched/not_found/not_checked, po: {po_number, supplier_name, lines:[{material, uom, open_qty}]}|null}` | 502 never; adapter errors return `not_checked` |
| GET `/po-search?supplier=` | gate-in roles | supplier ≥ 3 chars | `[{po_number, supplier_name, open_lines}]` (max 20) | 422 short query |

The OCR endpoint is stateless (does not store the image); the browser keeps the image and uploads it with `kind` after the pass exists, so the image used for OCR is the one stored.

### 8.2 Passes — `Backend/app/routers/entries.py` (prefix `/api/entries`, existing paths kept)

| Method / path | Role | Notes |
|---|---|---|
| POST `` | gate-in roles | Body extends `VehicleEntryCreate` with `pass_type`, `client_ref?`, `gate_in_method`, `po_number`, `challan_number`, `supplier_transporter_name`, `challan_lines[]`, `ocr: {anpr_confidence, po_confidence, challan_confidence, overridden_fields:[{field, ocr_value, final_value, confidence}]}`. Server re-runs PO lookup and stores status + snapshot (never trusts the client). Same `client_ref` again → **200 with the existing pass** (idempotent replay), not a duplicate. Inward missing PO / challan / lines → 422. |
| GET `` | all | Existing filters + `pass_type`, `state` (repeatable), `erp_status`. Response adds `pass_type`, `pass_state`, `display_state`, `po_number`, `challan_number`, `dwell_minutes`. |
| GET `/{id}` | all | Adds challan lines, weighments (all, newest first), current gross / tare / net_kg, quality result, GRN summary, audit timeline (latest 100), photos with `kind`. |
| PATCH `/{id}/exit` | gate-out roles | Body `{rejected_material_on_vehicle?: bool}`. Enforces T7 / T8. 409 if state not allowed; 422 "Confirm the rejected material is on the vehicle" when needed. |
| POST `/{id}/cancel` | gate-in roles | `{reason}` (5–200 chars). T9. |
| POST `/{id}/photos` | depends on `kind` | Form field `kind` (default `vehicle`). Gate-in kinds → gate-in roles; `weigh_frame` → weigh roles. 403 otherwise. |
| PATCH `/{id}/weight` | weigh roles | **Compatibility**: becomes "capture a manual gross weighment" (reason "Entered on legacy screen") and follows the 8.3 rules. Remove once the new weighbridge screen ships. |

### 8.3 Weighments — `Backend/app/routers/weighments.py`

| Method / path | Role | Request | Response / errors |
|---|---|---|---|
| GET `/api/weighbridge/reading` | weigh roles | — | `{available, weight_kg, stable, frame_ref, read_at}`; `available:false` when no indicator configured; 502 "Weighbridge indicator did not respond" |
| POST `/api/entries/{id}/weighments` | weigh roles | `{kind: gross/tare, source: indicator/manual, weight?, unit?, manual_reason?, supersede_reason?}` | 201 weighment. For `indicator` the **server** reads the indicator and stores what it read; 409 "Weighbridge reading is not stable" if not stable. `manual` needs weight 0.01–99,999,999.99 and reason (3–200 chars). Re-capturing a kind that already exists needs `supersede_reason`. Tare greater than gross → 422 "Tare weight cannot be more than gross weight". State rules per 5.2 (409). |

### 8.4 Quality — `Backend/app/routers/quality.py`

| Method / path | Role | Request / response | Errors |
|---|---|---|---|
| POST `/api/entries/{id}/send-to-quality` | store_incharge, admin | T3; writes outbox `Gatepass.InspectionRequested v1` | 409 state |
| GET `/api/quality/queue` | quality_inspector, admin | Passes in `QUALITY_PENDING` and `QUALITY_RESOLVED` (oldest first) with challan lines | — |
| PUT `/api/entries/{id}/quality-result` | quality_inspector, admin | `{lines:[{challan_line_id, accepted_qty, rejected_qty, remarks?}], remarks?}`; server derives `result` (B10); every challan line required once | 409 state / GRN already started; 422 missing or unknown line |

### 8.5 Quality service (external app) — `Backend/app/routers/quality_integration.py`

Auth: header `X-Service-Key` compared in constant time with env `QUALITY_INBOUND_SECRET`. Empty env → every call 503 "Quality integration is not configured". Wrong key → 401. Not under the user cookie.

| Method / path | Request / response |
|---|---|
| GET `/api/integrations/quality/pending` | Passes in `QUALITY_PENDING`: `{pass_id, po_no, supplier, vehicle_no, challan_no, lines:[{line_no, material, qty, uom}], sent_at}` |
| POST `/api/integrations/quality/inspection-result` | The docs' `Quality.InspectionApproved v1` payload as-is. `pass_id` = our entry id; lines matched by `line_no` if present, else by material name (case-insensitive, exact). `result` must agree with the lines (B10) else 422. Same payload replayed → 200 no-op. Pass in another state → 409. |

### 8.6 GRN — `Backend/app/routers/grn.py`

| Method / path | Role | Notes / errors |
|---|---|---|
| POST `/api/entries/{id}/grn` | store_incharge, admin | T5. Creates draft, lines pre-filled: `received_qty = challan_qty`, `accepted_qty` / `rejected_qty` from the current quality result, `po_qty` from the PO snapshot by material match (else null). 409 "Quality result is required before a GRN" (hard gate) or state. |
| GET `/api/grn?status=&erp_status=` | store_incharge, admin, site_supervisor | Store work list: `QUALITY_RESOLVED` (to start), drafts, approved with `erp_status` pending / failed. |
| GET `/api/entries/{id}/grn` | all | GRN with lines, flags (B7), weigh user names (for the SoD notice). |
| PATCH `/api/entries/{id}/grn/lines` | store_incharge, admin | `{lines:[{id, received_qty?, accepted_qty?, rejected_qty?, remarks?}]}`; only in `GRN_DRAFT`; each changed value → audit row + `qty_edited`. No cross-checks (B6). |
| POST `/api/entries/{id}/grn/approve` | store_incharge, admin | T6. 403 "The GRN approver must be different from the weighbridge operator" (B9). Generates return out-pass number if any rejected > 0. Calls the writer synchronously (timeout `GRN_WRITE_TIMEOUT_SECONDS`): success → `posted` + outbox `GRNPosted`; failure → `failed` with sanitized error; all accepted 0 → `not_required`, no call. Response 200 in all three cases (approval succeeded; ERP outcome in body). |
| POST `/api/entries/{id}/grn/retry-post` | store_incharge, admin | Only `erp_status` pending / failed. Uses the same `idempotency_key` so the ERP never gets a duplicate. |

`Backend/scripts/retry_grn_posts.py`: retries every `failed` / `pending` GRN whose last attempt is older than `GRN_RETRY_MIN_INTERVAL_MINUTES` (default 10), stops after `GRN_MAX_AUTO_ATTEMPTS` (default 10). Meant for Windows Task Scheduler; manual retry stays available beyond the cap.

### 8.7 Dashboard — `Backend/app/routers/dashboard.py`

GET `/api/dashboard/summary?day=YYYY-MM-DD` (default today in `SITE_TIMEZONE`) — admin, store_incharge, site_supervisor.

Response: `kpis {on_site_now, awaiting_quality, quality_over_sla, grn_pending_post, avg_dwell_minutes, vehicles_today}` and `board[] {id, vehicle_number, supplier, pass_type, display_state, tone, dwell_minutes, minutes_in_state, over_sla, qty_source}` (open passes of any day + passes closed on that day; open first, longest dwell first).

KPI definitions (fixes the mockup sample mismatch):
- on_site_now = passes not `GATE_OUT` / `CANCELLED` (any type, any day).
- awaiting_quality = `QUALITY_PENDING`; quality_over_sla = of those, `minutes_in_state > QUALITY_SLA_MINUTES` (default 60) → alert tile when > 0.
- grn_pending_post = GRNs with `erp_status` pending / failed (also counts vehicles already gone).
- avg_dwell = mean(exit − entry) of passes that exited on that day; "—" when none.
- over_sla on a row = dwell > `DWELL_SLA_MINUTES` (default 120).
- qty_source = `challan` for inward, `—` for general.

### 8.8 New backend `detail` strings (frontend must map all of them in `apiErrors.js`)

"Action not allowed in the current pass state" · "Quality result is required before a GRN" · "The GRN approver must be different from the weighbridge operator" · "Weighbridge reading is not stable" · "Weighbridge indicator did not respond" · "Tare weight cannot be more than gross weight" · "A reason is required" · "OCR service is not configured" · "OCR service failed. Enter the details manually." · "PO number, challan number and at least one challan line are required" · "Confirm the rejected material is on the vehicle" · "Every challan line needs a quality result" · "Quality result does not match the line quantities" · "GRN not found" · "ERP post is not pending" · "Your role cannot do this" (allow-list 403) · "Quality integration is not configured".

## 9. Adapters (external systems)

Package `Backend/app/integrations/`. Each adapter is a small interface with `none` / `mock` / `http` implementations chosen from env at startup. **No URL, key or tenant is ever written in code**; `http` without its URL / key fails at startup with a clear message. Requests use `httpx` (add to `requirements.txt`; not installed today). Adapter errors are logged by type and status only — never the image, document content, key or full URL query.

| Adapter / file | Interface | Env | Default | Mock behaviour |
|---|---|---|---|---|
| OCR `ocr.py` | `read_plate(image) → {plate, confidence}`; `read_document(image, doc_type) → {...}` | `OCR_PROVIDER` none/mock/http, `OCR_BASE_URL`, `OCR_API_KEY`, `OCR_TIMEOUT_SECONDS`=15, `OCR_CONFIDENCE_THRESHOLD`=85 | `none` (screen hides OCR buttons; manual entry) | Fixed sample values; challan number confidence 62 so the low-confidence highlight can be tested; plate 99 |
| PO lookup `po_lookup.py` | `get_po(po_number)`, `search_by_supplier(text)` | `PO_LOOKUP_PROVIDER` none/mock/http, `FARVISION_READ_URL`, `FARVISION_READ_KEY`, `ERP_TENANT_ID` | `none` → `not_checked` | Three fixture POs in `mock_data.py`; others → `not_found` |
| Weighbridge `weighbridge_indicator.py` | `read() → {weight_kg, stable, frame_ref, raw_frame}` | `WEIGHBRIDGE_PROVIDER` none/mock/http, `WEIGHBRIDGE_URL`, `WEIGHBRIDGE_KEY`, `WEIGHBRIDGE_TIMEOUT_SECONDS`=5 | `none` (manual entry only) | Random 8,000–45,000 kg, unstable on 1 read in 4 |
| GRN writer `grn_writer.py` | `post_grn(payload, idempotency_key) → {grn_number}` or raises | `GRN_WRITE_PROVIDER` mock/http, `FARVISION_WRITE_URL`, `FARVISION_WRITE_KEY`, `ERP_INSTANCE`=VJ, `ERP_TENANT_ID`=75, `GRN_WRITE_TIMEOUT_SECONDS`=20, `GRN_MOCK_FAIL`=false | `mock` | Returns `MOCK-GRN-<id>`; `GRN_MOCK_FAIL=true` makes every call fail (for testing retry) |
| Quality inbound | section 8.5 | `QUALITY_INBOUND_SECRET` | empty → disabled | — |
| Settings | — | `SITE_TIMEZONE`=Asia/Kolkata, `DWELL_SLA_MINUTES`=120, `QUALITY_SLA_MINUTES`=60 | | |

All of these go into `Backend/.env.example` with comments and empty secrets.

## 10. Business rules

- B1. Inward pass needs vehicle no, PO no, challan no and 1–20 challan lines (material, qty ≥ 0, uom). Driver name stays required (as today).
- B2. OCR only fills fields; the guard always confirms. A field whose confidence is below the threshold is highlighted and must be touched (confirm or edit) before "Confirm & create pass" is enabled. Any changed OCR value or confirmed low-confidence field sets `manual_override` and writes one audit row per field (old OCR value → final value).
- B3. PO lookup result `not_found` or `not_checked` shows a warning; it **never blocks** creation.
- B4. Challan qty ≠ PO open qty → informational flag only.
- B5. Weighments are never updated or deleted. A correction inserts a new row that supersedes the old, with a reason. Indicator weights are read by the server. Manual weights need a reason and are flagged.
- B6. GRN quantities are freely editable and never validated against PO, challan, quality or weight (only ≥ 0 and the numeric limit).
- B7. Informational flags shown on the GRN, never blocking: received ≠ challan; accepted + rejected ≠ received; received ≠ PO open qty; quality accepted ≠ GRN accepted.
- B8. Weight never drives quantity; tare is optional; net = gross − tare (both converted to kg) shown only when both exist.
- B9. GRN approver must not be any user who captured a gross or tare weighment on that pass (applies to admins too). If tare is captured **after** approval by the approver, that is allowed (approval already done).
- B10. Quality result is derived from the lines: all rejected 0 → `approved`; all accepted 0 → `rejected`; otherwise `partial`. The service endpoint's `result` must equal the derived one.
- B11. Hard gate: no GRN record can exist for a pass without a current quality result. Enforced in the API, not only the UI.
- B12. One GRN per pass; one PO and one challan per pass.
- B13. ERP failure never loses the GRN: status `failed`, error kept (no secrets), retry manual or scripted, same idempotency key.
- B14. Return out-pass number format `RRP-YYYY-NNNNN` (yearly sequence), created at approval when total rejected > 0; it lists rejected qty per line.
- B15. A second open pass for the same vehicle number is **not blocked** (trips can overlap in data entry); the gate-in screen warns "This vehicle already has an open pass" with a link to it.
- B16. Every state change and manual edit writes an audit row with the user and time.

## 11. Screens (Frontend)

Routes keep the `/entries/:section` pattern so the shell stays mounted. The frontend owner decides layout details; this lists what must exist.

| Route / section | Roles | Content |
|---|---|---|
| `/entries/new` **Gate-in** (replaces New Entry) | guard, admin | Type switch (Inward / Other vehicle). Inward: 3 capture tiles (plate, PO doc, challan doc) using camera or file; each sends to OCR when enabled; QR scan kept as an option. Review panel: vehicle no (plate chip), PO no, supplier, challan no, challan lines table (add / remove / edit), confidence badge per field (`conf hi`/`conf lo`), low-confidence rows highlighted warn-wash. PO check banner: matched (good), not found (crit, with "Search by supplier"), not checked (neutral). Open-pass warning (B15). Driver name / phone. Buttons: "Re-scan", "Confirm & create pass" (primary). Other vehicle: today's form fields. Offline: banner "Offline — passes will sync"; queued count; OCR buttons disabled. |
| `/entries/log` **Log** | all | As today plus state pill, PO / challan columns, filter by state; row opens pass detail. "Mark exit" button removed from here (moved to Gate-out). |
| `/entries/gate-out` **Gate-out** (new) | guard, admin | Cards of passes allowed to exit (inward `GRN_APPROVED`, general `GATE_IN`) + search by plate. Exit sheet shows plate, supplier, GRN status; if rejected qty > 0 shows the return out-pass lines and a required checkbox. "Cancel pass" action for `GATE_IN` passes with reason. |
| `/entries/weighbridge` **Weighbridge** | weighbridge, admin | List: inward `GATE_IN` (needs gross) first, then open passes without tare. Detail: dark live-indicator readout (mono 54px, "Stable" dot), "Capture gross" / "Capture tare" (enabled only when stable), manual entry toggle with reason, weighment history (newest first, superseded rows struck through, "RAW" / "MANUAL" chips), net (informational), weigh-frame photos. When indicator is not configured: manual entry only, with a neutral note. |
| `/entries/quality` **Quality** (new) | quality_inspector, admin | Queue of `QUALITY_PENDING` (oldest first, ageing in mono, red after SLA) and `QUALITY_RESOLVED` (editable until GRN starts). Form: per challan line accepted / rejected qty + remarks; derived result pill updates live; "Record result". |
| `/entries/grn` **Stores / GRN** (new) | store_incharge, admin | Three groups: "Unloaded? Send for inspection" (`ON_SITE`), "Ready for GRN" (`QUALITY_RESOLVED`), "Drafts", "Pending ERP post" (failed shows error + Retry). GRN editor: header facts (PO, challan, inspected by, gross weight, quality pill), lines table (material + uom, PO qty, challan qty, received input "← challan", accepted, rejected, flags), SoD notice naming the weigh operator(s) and the signed-in user, "Save draft", "Approve & post GRN" (disabled with explanation when the user is a weigher), ERP outcome banner (info posted / crit failed + Retry / warn not required). |
| `/dashboard` **Control tower** (new) | site_supervisor, store_incharge, admin | Day picker (default today), 4 KPI tiles (on site, awaiting quality – crit tile when > 0 over SLA, GRN pending post, avg dwell), board table (plate chip, supplier, state pill, dwell mono – red when over SLA, qty source). Rows open pass detail. Polls every 30 s; pauses when the tab is hidden. |
| `/passes/:id` **Pass detail** (new) | all | Header (plate chip, supplier, state pill), stepper of the journey (gate-in → weigh → quality → GRN → out, hard-gate step crit until resolved), documents (PO, challan, lines), photos by kind, weighments, quality result, GRN summary, audit timeline. The action buttons a role may take in this state (links to the right section). |
| `/passes/:id/return-pass` | guard, store_incharge, admin | Printable reject-return out-pass (plate, supplier, PO, challan, out-pass no, rejected lines, signature lines). Print CSS, A4 / A5. |
| `/users` | admin | Role select gains the 3 new roles. |

Default landing per role (`defaultRouteForRole`): guard → Gate-in; weighbridge → Weighbridge; quality → Quality; store → Stores/GRN; supervisor → Dashboard; admin → Dashboard.

Mobile (below 992 px, existing bottom tab bar):
- Bottom bar shows at most 5 tabs; extra sections go under a "More" tab (sheet listing the rest). Admin needs this (8 sections).
- Guard: Gate-in, Gate-out, Log, Account. Weighbridge: Weighbridge, Log, Account. Quality: Quality, Log, Account. Store: GRN, Dashboard, Log, Account. Supervisor: Dashboard, Log, Account.
- Gate-in on a phone: capture tiles stack 1 per row, camera opens with `capture="environment"`, review panel full width, sticky bottom action bar above the tab bar.
- GRN lines and the dashboard board become cards (existing `RecordCard` pattern), numbers stay right-aligned mono.
- Tap targets ≥ 44 px; KPI grid 2 × 2 under 560 px (as the mockup).

Offline (gate-in only): `Frontend/src/offline/gateInQueue.js` stores pending pass bodies + photo blobs in IndexedDB keyed by `client_ref`; sends on `online` event and on app start; after create, uploads each photo with its kind; on 4xx keeps the item and shows it as "Needs attention" with the error; on success removes it. Other screens show "You are offline" and disable actions.

## 12. Colour tokens (from `ui-mockups.html` `:root`, adopted app-wide)

Defined once in `Frontend/src/index.css` as `--gp-*` variables; existing `--app-*` variables re-pointed to them so current screens change colour without rewriting each component.

| Token | Value | Use |
|---|---|---|
| --gp-ground | #EEF1F4 | page background |
| --gp-surface / --gp-surface-2 | #FFFFFF / #F6F8FA | cards / table headers, inset areas |
| --gp-ink / --gp-ink-2 / --gp-muted | #131A22 / #44515F / #7A8694 | text; muted only for ≥ 14 px bold or large text (AA) |
| --gp-line / --gp-line-2 | #DCE2E8 / #E8ECF0 | borders / row dividers |
| --gp-accent / --gp-accent-ink / --gp-accent-wash | #E85D1F / #B8410E / #FCEEE6 | primary action, OCR, active nav; links and text on light use accent-ink |
| --gp-good / wash | #1E9E62 / #E4F4EC (pill text #157346) | complete / approved |
| --gp-warn / wash | #C9931F / #F7F0DC (pill text #8A6410) | in progress, low confidence |
| --gp-crit / wash | #D23B3B / #F8E6E6 (pill text #A52A2A) | hard gate, attention, over SLA, ERP failed |
| --gp-info / wash | #2C7BB6 / #E4EFF7 (pill text #1D5A86) | posted / info, OCR source pill |
| --gp-control / --gp-control-2 | #0E1620 / #1A2530 | sidebar, indicator readout, dashboard table header |
| --gp-plate-bg | #F4C21B (text #111, 1–2 px #111 border) | number-plate chip |
| --gp-font-mono | "Cascadia Mono","SF Mono",ui-monospace,"Roboto Mono",Consolas,monospace + `tabular-nums` | all weights, quantities, dwell, pass / PO / challan numbers, plate chip |
| --gp-radius / --gp-radius-lg | 10px / 16px | |
| focus ring | 3px #F3B48E | |

Contrast rule: white text on #E85D1F is about 3.5 : 1, below AA for normal text. Primary buttons must reach 4.5 : 1 (for example fill with `--gp-accent-ink` at rest and use `--gp-accent` for borders / icons, or dark ink text on accent). The frontend owner picks the treatment; the check is AC40.

State pill mapping is in 5.1. Quality result pill: approved good, partial warn, rejected crit. ERP: posted info, pending / failed crit, not required warn. Neutral pill (surface-2 + line border) for gate-out / cancelled / general "other vehicle".

## 13. Deliberate deviations from the v2 docs

| # | Docs say | We do | Why |
|---|---|---|---|
| D1 | Quality inspection UI is owned by the Quality app (out of scope) | In-app Quality screen for a new `quality_inspector` role **plus** the service endpoint | No Quality app exists for this site; without a screen the flow can never pass the hard gate |
| D2 | Live Farvision GRN write | Pluggable writer, mock by default | No URL / credentials / write recipe here; switch via env when available |
| D3 | `WEIGH_GROSS` and `WEIGH_TARE` are states | Weighments are records; gross capture moves `GATE_IN → ON_SITE`; tare is not a state | WEIGH_GROSS lasted zero time in the docs; tare is optional and must never block |
| D4 | `GRN_APPROVED-pending` is a state | Vehicle state `GRN_APPROVED` + separate `erp_status`; dashboard shows pending / failed as its own crit pill | The truck must not wait at the gate for the ERP; ERP retry can continue after gate-out |
| D5 | Read Adapter / Write Router / Action Ledger / event bus | Adapters in `app/integrations/`, `pass_audit_log`, `integration_events` outbox | Those platform pieces do not exist in this app |
| D6 | QR flow retired | QR scan kept as an optional pre-fill on Gate-in | Some suppliers already print QR codes; costs nothing |
| D7 | Only inward material | `general` pass type keeps the old flow | Visitors / outward vehicles still pass the same gate; legacy rows need a home |
| D8 | Tenant / org scoping | Single site; `ERP_INSTANCE`, `ERP_TENANT_ID` env settings | App is single-site |

## 14. Resolved inconsistencies in the source docs

1. **Hard gate "confirmed" (req §2, §7.4) vs "to confirm" (req §14, handover §12)** → treated as confirmed: hard gate enforced in the API (B11).
2. **Event `Quality.InspectionApproved` carries rejected results** → accepted as the wire name for compatibility; `result` field is authoritative and must match the lines (B10). Internally called "quality result".
3. **`GRN_APPROVED-pending`** → `erp_status` dimension (D4).
4. **No owner for `ON_SITE → QUALITY_PENDING`** → store in-charge (or admin) presses "Unloaded — send for inspection" (T3); stores receive the material, so they know when it is unloaded.
5. **Reloading rejected material undefined** → leaves on the same vehicle with the return out-pass; replacement = new pass (5.4).
6. **GRN draft "auto-created" vs `grn_create` RBAC** → created by the store in-charge with "Start GRN" (T5), pre-filled automatically.
7. **Overview AC "GRN draft auto-filled from PO; bulk net = received"** → superseded by v2: challan qty, weight never drives qty.
8. **Mockup data**: gate-in shows one challan line (OPC 320 bags) and "1 open line" but the GRN shows two lines (OPC + PPC 80); GRN header says "Quality: approved" while 3 bags are rejected (should be partial); 315 accepted + 3 rejected ≠ 320 received with no flag; dashboard says "3 on site" while 5 rows are not gated-out; KPI "1 GRN pending post" has no matching row; challan confidence shows "low" with no number. Treated as illustrative only; our KPI definitions (8.7), B7 flags and B10 fix each one.
9. **Mockup GRN columns "Accepted / Rejected" editable vs quality owning them** → pre-filled from quality, editable by stores (B6), difference flagged (B7).

## 15. Edge cases

- Inward pass with OCR off and PO lookup off → fully manual, PO status "not checked", still valid.
- OCR returns no lines for the challan → guard adds lines by hand; at least one required.
- OCR returns a plate with spaces / lowercase → normalised to uppercase without spaces for storage, shown with spaces in the chip.
- Two guards create the same offline pass twice → `client_ref` returns the first.
- Photos fail to upload after the pass is created → pass exists; queue retries the photos; detail shows "photo upload pending" until done.
- Gross re-captured after quality → allowed with reason; audit; does not change quantities.
- Tare > gross → 422. Units differ (ton / kg) → converted to kg for net.
- Weighbridge operator who is also made store in-charge later → B9 still checks the weighment rows by user id.
- Approver deactivated after approval → no effect. Users with any audit / weighment / GRN rows cannot be deleted (extend `users.py` check), only deactivated.
- Quality service sends result for a cancelled / exited pass → 409. Sends an unknown material → 422 listing nothing sensitive.
- ERP returns success but slowly (timeout) → recorded `failed`; retry uses the same idempotency key so the ERP does not double-book.
- Dashboard with zero passes → KPIs 0, avg dwell "—", empty-state text.
- Legacy row opened in pass detail → general pass, no stepper beyond in / out, weighment history shows the one `legacy` row.
- Role changed while signed in → next API call enforces the new role; frontend refreshes `/me` on 403.
- Long supplier / material names → wrap on cards, ellipsis + title in tables.
- Hindi / Marathi: state names, KPI labels, flags all translated; numbers and plate stay Latin digits.

## 16. Acceptance criteria

Gate-in
- AC1. Given OCR is `mock`, when the guard captures the plate, then the vehicle no field fills with the mock plate and shows its confidence.
- AC2. Given the challan OCR confidence is below the threshold, then the challan no row is highlighted and "Confirm & create pass" stays disabled until the guard confirms or edits it.
- AC3. Given the guard changes an OCR value, when the pass is created, then `manual_override` is true and one audit row exists per changed field with old and new value.
- AC4. Given `OCR_PROVIDER=none`, then capture tiles still store photos but no OCR call is made and all fields are typed by hand.
- AC5. Given a PO not in the mock fixtures, then a "PO not found" warning shows and the pass can still be created with `po_lookup_status=not_found`.
- AC6. Given the PO is not found, when the guard searches by supplier (≥ 3 chars), then matching fixture POs are listed and one can be picked.
- AC7. Given an inward pass without a challan line, when submitted, then 422 and no row is created.
- AC8. Given the browser is offline, when the guard creates a pass, then it is queued, a queued count shows, and after reconnect exactly one pass and all its photos (kinds plate / po_doc / challan_doc) exist.
- AC9. Given the same `client_ref` is posted twice, then the second call returns the first pass with 200.
- AC10. A security guard can upload `plate` / `po_doc` / `challan_doc` photos; a guard uploading `weigh_frame` gets 403.

Weighbridge
- AC11. Given the mock indicator is unstable, when "Capture gross" with source indicator is called, then 409 and no row is written.
- AC12. Given a stable reading, when gross is captured, then a weighment row with source `indicator`, frame ref and raw frame exists, `vehicle_entries.gross_weight` equals it, and the state is `ON_SITE`.
- AC13. Given manual entry without a reason, then 422; with a reason, the row is `manual` and the UI shows a MANUAL chip.
- AC14. Given gross exists, when gross is captured again with a reason, then both rows exist, the old one is marked superseded, and no row was updated or deleted.
- AC15. A pass can reach `GATE_OUT` with no tare; when tare is captured, net (kg) is shown and GRN quantities do not change.
- AC16. Tare greater than gross → 422.

Quality hard gate
- AC17. Given a pass in `ON_SITE`, when a store in-charge sends it for inspection, then state is `QUALITY_PENDING` and an outbox row `Gatepass.InspectionRequested` exists.
- AC18. Given `QUALITY_PENDING`, when anyone calls Start GRN, then 409 "Quality result is required before a GRN" and no GRN row exists.
- AC19. In-app: given lines with some rejected and some accepted, the recorded result is `partial`; all rejected 0 → `approved`; all accepted 0 → `rejected`.
- AC20. Service endpoint without / with a wrong `X-Service-Key` → 401; with `QUALITY_INBOUND_SECRET` empty → 503; with the right key and a consistent payload → 200 and state `QUALITY_RESOLVED`.
- AC21. Service payload with `result=approved` but a rejected qty > 0 → 422.
- AC22. Same service payload replayed → 200, no second result row.
- AC23. Quality result can be corrected in `QUALITY_RESOLVED`; after Start GRN a correction gives 409.

GRN and ERP
- AC24. Start GRN pre-fills received = challan qty and accepted / rejected from the quality result for every line.
- AC25. Store in-charge sets received to any value ≥ 0 (above PO, above challan, unrelated to weight) and it saves; flags show; nothing blocks.
- AC26. Each edited value writes an audit row and sets `qty_edited`.
- AC27. The user who captured gross (or tare) cannot approve: 403 with the SoD message, and the button is disabled with the reason; a different store in-charge can approve.
- AC28. With `GRN_WRITE_PROVIDER=mock`, approval sets `erp_status=posted`, stores `MOCK-GRN-<id>` and writes an outbox `Gatepass.GRNPosted v1` row.
- AC29. With `GRN_MOCK_FAIL=true`, approval returns 200, `erp_status=failed`, the error shows with Retry; after setting it false, Retry posts with the same idempotency key and status becomes `posted`.
- AC30. `retry_grn_posts.py` retries only failed / pending older than the interval and respects the attempt cap.
- AC31. GRN with all accepted 0 → `erp_status=not_required`, no writer call, return out-pass number generated.

Gate-out and return
- AC32. Inward pass in any state before `GRN_APPROVED` → gate-out 409; the pass does not appear in the Gate-out list.
- AC33. Inward pass with rejected qty > 0: gate-out without the checkbox → 422; with it → `GATE_OUT`, `exit_time` set.
- AC34. Return out-pass page prints plate, supplier, PO, challan, out-pass number and rejected lines on one A4 page.
- AC35. General pass: gate-out from `GATE_IN` works as before. Cancel with reason → `CANCELLED`; inward cancel after gross → 409.
- AC36. Gate-out is allowed while `erp_status` is failed; Retry still works after gate-out.

Roles, dashboard, legacy, UI
- AC37. Each row of the permission matrix (section 7) is enforced by the API (403) and the menu shows only allowed sections per role, on desktop and mobile.
- AC38. Dashboard KPIs match the definitions in 8.7 for a seeded set covering every state; a pass in `QUALITY_PENDING` longer than `QUALITY_SLA_MINUTES` turns the awaiting-quality tile and its row red.
- AC39. After running the migration twice, every existing entry shows in the Log as a general pass in its real state (exited → "Gate-out", not exited → "On site"), each weighed one has exactly one `legacy` weighment row, all existing photos still open, and the second run reports "already exists" for every step.
- AC40. Primary buttons, pills and muted text meet WCAG AA contrast (4.5 : 1 normal text); the plate chip and all numbers use the mono font.
- AC41. Every new screen works at 360 px width with no horizontal page scroll; admin's bottom bar shows ≤ 5 tabs with the rest under More.
- AC42. `npm run build` passes `check:i18n`; switching to हिन्दी / मराठी shows no English on the new screens except user data, units, plate / PO / challan numbers and "GatePass".
- AC43. No secret, key, full document URL or image content appears in API logs or audit rows.

## 17. Open questions (defaults are what we build; the product owner can overturn them later)

| # | Question | Default chosen | Why |
|---|---|---|---|
| Q1 | Who marks "unloaded — send for inspection"? | Store in-charge / admin | Stores receive the material |
| Q2 | May the vehicle leave before the ERP post succeeds? | Yes | ERP outages must not hold trucks; GRN is already approved in app |
| Q3 | Dwell SLA / quality SLA | 120 / 60 minutes (env) | Mockup flags 01:12 as over; site can tune |
| Q4 | Can admin approve a GRN? | Yes, but SoD still applies | Small sites have few users |
| Q5 | Block a second open pass for the same vehicle? | Warn only | Real trips overlap; blocking would stop the gate |
| Q6 | Where does the external Quality app get passes? | Pull `GET /api/integrations/quality/pending` (+ outbox row for a future bus) | No bus exists |
| Q7 | Keep the old free-text QR flow? | Yes, as optional pre-fill | No cost; suppliers may use it |
| Q8 | Retention of OCR / weigh images | Kept forever, no delete (as today) | Immutability requirement |

## 18. Out of scope

Multi-PO / multi-challan per pass; real Farvision / OCR / indicator / Quality integrations beyond the adapter seam (need URLs and credentials); delivering outbox events to a bus; boom-barrier control; rejected material held on site for later pickup; outward material gate passes; multi-site / tenant switching; editing a pass after gate-in other than the listed actions; push notifications; automated tests (no test framework in the repo; testers test manually and via API).

## 19. File split (no file has two owners)

Order: **Backend-1 foundation first** (models, schemas Role, auth allow-lists, pass state helper, audit helper, router stubs registered in `main.py`) — ½ day; then everything else runs in parallel. Frontend starts against the API shapes in section 8 (mock data until the API is up). **Frontend-senior registers new string modules and shared components first** (tokens, `StatePill`, `PlateChip`, nav, routes, empty string modules for the junior), then the junior starts.

### Backend developer 1 — core pass, gate-in, weighing, migration
- `Backend/app/models.py` (all tables in section 6, including the quality / GRN / outbox models Backend-2 uses)
- `Backend/app/schemas.py` (Role literal, pass / gate-in / challan / weighment / audit / photo-kind schemas)
- `Backend/app/auth.py` (`require_roles`, service-key dependency used by Backend-2)
- `Backend/app/pass_states.py` (new: states, transition table 5.2, `apply_transition`)
- `Backend/app/audit.py` (new: `record_audit`)
- `Backend/app/main.py` (include all new routers, including Backend-2's)
- `Backend/app/routers/entries.py`, `Backend/app/routers/gate_in.py` (new), `Backend/app/routers/weighments.py` (new), `Backend/app/routers/users.py` (delete check)
- `Backend/app/photo_storage.py` (kind support if needed)
- `Backend/app/integrations/__init__.py`, `ocr.py`, `po_lookup.py`, `weighbridge_indicator.py`, `mock_data.py` (new)
- `Backend/scripts/migrate_gatepass_v2.py` (new), `Backend/requirements.txt` (add `httpx`), `Backend/.env.example` (all env vars in section 9, including Backend-2's)

### Backend developer 2 — quality, GRN, ERP, dashboard, events
- `Backend/app/inward_schemas.py` (new: quality, GRN, dashboard, service payload schemas)
- `Backend/app/routers/quality.py`, `Backend/app/routers/quality_integration.py`, `Backend/app/routers/grn.py`, `Backend/app/routers/dashboard.py` (new)
- `Backend/app/integrations/grn_writer.py` (new), `Backend/app/integration_events.py` (new: outbox writer)
- `Backend/app/site_settings.py` (new: SLA, timezone, threshold env reading — Backend-1 imports the threshold from here)
- `Backend/scripts/retry_grn_posts.py` (new)
- Dependency: needs Backend-1's models, `pass_states.py`, `audit.py`, `auth.py` first; asks Backend-1 for any model change.

### Frontend senior — shell, design tokens, gate-in, weighbridge, GRN, pass detail
- `Frontend/src/index.css` (tokens 12, re-point `--app-*`, pill / plate / mono classes), `Frontend/src/components/ui/Badge.jsx`, `ui/Button.jsx`, `ui/StatePill.jsx` (new), `ui/PlateChip.jsx` (new)
- `Frontend/src/navigation/navItems.js`, `Frontend/src/App.jsx`, `Frontend/src/components/BottomTabBar.jsx` (More), `Sidebar.jsx`, `NavIcon.jsx`, `ProtectedRoute.jsx`, `Frontend/src/pages/EntriesPage.jsx`
- `Frontend/src/components/EntryForm.jsx` (becomes Gate-in), `GateInCaptureTiles.jsx`, `OcrReviewPanel.jsx`, `ChallanLinesEditor.jsx` (new), `QrScanner.jsx`, `PhotoCapture.jsx`
- `Frontend/src/offline/gateInQueue.js` (new)
- `Frontend/src/components/WeighbridgeTab.jsx`, `WeighbridgeDetail.jsx`, `WeighbridgeTab.css`
- `Frontend/src/pages/GrnPage.jsx`, `Frontend/src/components/GrnEditor.jsx` (new)
- `Frontend/src/pages/PassDetailPage.jsx`, `Frontend/src/components/PassTimeline.jsx` (new)
- `Frontend/src/api/entries.js`, `api/gateIn.js`, `api/weighments.js`, `api/grn.js` (new)
- i18n: `Frontend/src/i18n/translations.js` (registers all modules incl. the junior's), `strings/common.js` (state names, pill texts, new roles, error keys), `apiErrors.js` (all 8.8 strings), `strings/shell.js`, `strings/weighbridge.js`, `strings/gateIn.js`, `strings/grn.js`, `strings/passes.js` (new)

### Frontend junior — log, gate-out, quality, dashboard, return pass, users
- `Frontend/src/components/EntryTable.jsx` (state pill, PO / challan columns, row → detail, exit button removed), `Frontend/src/context/EntryLogFiltersContext.jsx` (state filter), `Frontend/src/hooks/useEntries.js`
- `Frontend/src/components/GateOutTab.jsx` (new)
- `Frontend/src/pages/QualityPage.jsx`, `Frontend/src/components/QualityResultForm.jsx` (new)
- `Frontend/src/pages/DashboardPage.jsx` (new)
- `Frontend/src/pages/ReturnPassPage.jsx` (new)
- `Frontend/src/pages/UsersPage.jsx` (new roles in the select)
- `Frontend/src/api/quality.js`, `api/dashboard.js` (new)
- i18n: `strings/entries.js`, `strings/users.js`, `strings/gateOut.js`, `strings/quality.js`, `strings/dashboard.js` (new; the senior registers them in `translations.js` first)
- Dependency: uses `StatePill`, `PlateChip`, tokens and routes from the senior; error keys from `common.js` / `apiErrors.js` (asks the senior to add any missing one).

## 20. Test checklist (two testers, no overlap)

**Tester A — gate-in, weighbridge, gate-out, roles, legacy, mobile**
AC1–AC16, AC32–AC37, AC39, AC41. Also: offline queue with photos and a 4xx item; open-pass warning; plate normalisation; weighbridge with `WEIGHBRIDGE_PROVIDER=none`; the old `PATCH /weight` compatibility path; user delete blocked for users with records; each role's landing page and menus on 360 px and desktop.

**Tester B — quality, GRN, ERP, dashboard, colours, i18n, security**
AC17–AC31, AC38, AC40, AC42, AC43. Also: service endpoint replay and mismatch cases; ERP failure → gate-out → retry; retry script cap; return out-pass print; dashboard polling pause and empty day; Hindi / Marathi on Quality, GRN and Dashboard; logs and audit rows checked for secrets and document URLs; contrast of primary buttons and pills.
