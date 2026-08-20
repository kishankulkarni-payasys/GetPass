# GatePass — Security Guard Language Toggle & Weighbridge Access Restriction

## Purpose

Two changes to the `security_guard` role's experience on the Entries page,
bundled together because both touch `Frontend/src/pages/EntriesPage.jsx` and
both scope specifically to `security_guard`:

1. Give `security_guard` (only) a Hindi / Marathi language toggle for the
   New Entry form and Entry Log table — today every string in the app is
   hardcoded English, with no i18n of any kind anywhere in the codebase.
2. Remove `security_guard`'s access to the Weighbridge tab and its backend
   endpoints — today any authenticated user (including `security_guard`)
   can see the tab and call the weigh/photo APIs, which was never
   intentional; only `admin` and `weighbridge_operator` should retain it.

These are independent concerns and can be implemented/reviewed as two
separate units of work, but share one spec since they're a single small
pass over the same role and the same page.

## Part 1 — Hindi / Marathi language toggle

### Scope

Applies only when `user.role === 'security_guard'`. Covers:
- `Frontend/src/components/EntryForm.jsx` — the New Entry form (all
  placeholders, step headings, buttons, static toast messages)
- `Frontend/src/components/EntryTable.jsx` — the Entry Log table (column
  headers, status badges, "Mark Exit" button, static toast messages)
- `Frontend/src/pages/EntriesPage.jsx` — the page heading and the "New
  Entry" / "Entry Log" tab labels (the "Weighbridge" tab is out of scope
  here, and is separately removed from `security_guard` entirely in Part 2)

Not covered: `LoginPage`, `Sidebar`, `UsersPage`, `WeighbridgeTab` /
`WeighbridgeDetail`, and any backend-supplied error text (e.g.
`err.response?.data?.detail`) — those remain English. Native browser
`required`-field validation bubbles also remain in the browser's own
language; replacing native validation isn't warranted for this scope.

### Architecture

No new dependency — a small hand-rolled context, following the same
pattern as the existing `AuthContext` / `ToastContext`.

- **`Frontend/src/i18n/translations.js`** (new) — a plain object:
  ```js
  export const translations = {
    en: { pageTitle: 'Vehicle Entry Log', tabNew: 'New Entry', ... },
    hi: { pageTitle: '...', tabNew: '...', ... },
    mr: { pageTitle: '...', tabNew: '...', ... },
  }
  ```
  Keys cover every string enumerated below.

- **`Frontend/src/context/LanguageContext.jsx`** (new) — `LanguageProvider`
  + `useLanguage()` hook. Holds `language` state (`'en' | 'hi' | 'mr'`,
  default `'en'`), initialized from and persisted to `localStorage` under
  key `getpass:language`. Exposes:
  - `language` — current value
  - `setLanguage(lang)` — updates state + `localStorage`
  - `t(key)` — returns `translations[language][key]`, falling back to
    `translations.en[key]`, falling back to `key` itself if neither exists

- **`Frontend/src/components/LanguageSwitcher.jsx`** (new) — a 3-way
  button group rendered as: `English` / `हिंदी` / `मराठी`. Calls
  `setLanguage` on click; highlights the active language. Each language's
  own name is shown in its own script (not translated).

### Wiring

- `Frontend/src/App.jsx` — wrap the existing provider tree with
  `<LanguageProvider>` (alongside `ToastProvider` / `AuthProvider`). Global
  provider, but only consumed where noted above.
- `Frontend/src/pages/EntriesPage.jsx` — render `<LanguageSwitcher />` next
  to the tab bar, gated on `user?.role === 'security_guard'`. Page heading
  and the "New Entry"/"Entry Log" tab labels switch to `t('pageTitle')` /
  `t('tabNew')` / `t('tabLog')`.
- `EntryForm.jsx` / `EntryTable.jsx` — call `const { t } = useLanguage()`;
  replace every hardcoded string (placeholders, step titles, button labels,
  static `showToast(...)` messages, table headers, status badge text) with
  `t('key')`.

### Translation keys

| Key | English |
|---|---|
| pageTitle | Vehicle Entry Log |
| tabNew | New Entry |
| tabLog | Entry Log |
| step1Title | Step 1 of 2: Document Details |
| step2Title | Step 2 of 2: Vehicle & Material Details |
| scanDocument | Scan Document |
| scanVehicle | Scan Vehicle |
| loadingScanner | Loading scanner... |
| scanDocumentQr | Scan Document QR Code |
| scanVehicleQr | Scan Vehicle QR Code |
| placeholderRefDoc | Challan/Invoice/PO Number |
| placeholderSupplier | Supplier/Transporter |
| placeholderProject | Project Name |
| placeholderSubproject | Subproject Name |
| next | Next |
| placeholderVehicleNumber | Vehicle Number |
| placeholderDriverName | Driver Name |
| placeholderDriverPhone | Driver Phone |
| placeholderMaterialDescription | Material Description |
| placeholderQuantity | Quantity |
| placeholderUnit | Unit (kg/ton/units) |
| placeholderPurpose | Purpose |
| back | Back |
| saving | Saving... |
| registerEntry | Register Entry |
| toastInvalidDocQr | Scanned code is not a valid document QR |
| toastScannedFilled | Scanned data filled into the form |
| toastEntryRegistered | Vehicle entry registered |
| toastEntryFailed | Failed to save entry |
| colVehicle / colProject / colDriver / colMaterial / colEntry / colStatus / colAction | Vehicle / Project / Driver / Material / Entry / Status / Action |
| loadingEntries | Loading entries... |
| noEntries | No entries yet. |
| statusExited | Exited |
| statusOnSite | On Site |
| markExit | Mark Exit |
| toastMarkedExit | Vehicle marked as exited |
| toastMarkExitFailed | Failed to mark exit |

Hindi and Marathi values are written directly during implementation (not
listed exhaustively here to avoid transcription drift between the spec and
the code — the English column above is the authoritative key list).

### Data flow

`LanguageProvider` reads `localStorage` once on mount, keeps it in React
state, writes back on every `setLanguage` call. Purely client-side, no
backend involvement. Per-browser, not per-account — a guard logging in on a
different device sees English again until they switch there too.

## Part 2 — Remove Weighbridge access for security_guard

### Current behavior (bug)

`Frontend/src/pages/EntriesPage.jsx`:
```js
const canWriteEntries = user?.role !== 'weighbridge_operator'
const tabs = canWriteEntries ? ALL_TABS : ALL_TABS.filter((tab) => tab.key !== 'new')
```
Since `security_guard` has `canWriteEntries === true`, it currently gets
all three tabs including "Weighbridge". Backend-side, `PATCH
/api/entries/{id}/weight` and `POST /api/entries/{id}/photos`
(`Backend/app/routers/entries.py`) only depend on `get_current_user` — any
authenticated user, including `security_guard`, can call them today.

### Backend change

`Backend/app/auth.py` — add, alongside `require_entry_write`:
```python
def require_weighbridge_write(user: User = Depends(get_current_user)) -> User:
    if user.role == "security_guard":
        raise HTTPException(status_code=403, detail="Security guards cannot record weights or upload weighbridge photos")
    return user
```

`Backend/app/routers/entries.py` — add
`dependencies=[Depends(require_weighbridge_write)]` to:
- `PATCH /{entry_id}/weight` (`record_weight`)
- `POST /{entry_id}/photos` (`upload_photos`)

`admin` and `weighbridge_operator` are unaffected; `security_guard` gets a
`403` with a clear `detail` message.

### Frontend change

`Frontend/src/pages/EntriesPage.jsx` — replace the tab filter with:
```js
const canWriteEntries = user?.role !== 'weighbridge_operator'
const canAccessWeighbridge = user?.role !== 'security_guard'
const tabs = ALL_TABS.filter((tab) =>
  tab.key === 'new' ? canWriteEntries :
  tab.key === 'weighbridge' ? canAccessWeighbridge :
  true
)
```

Resulting tab visibility:

| Role | New Entry | Entry Log | Weighbridge |
|---|---|---|---|
| admin | yes | yes | yes |
| security_guard | yes | yes | **no (was yes)** |
| weighbridge_operator | no | yes | yes |

The default `activeTab` (`canWriteEntries ? 'new' : 'log'`) is unaffected —
`security_guard` still lands on "New Entry" by default.

### Error handling

Same conventions as the rest of the app: FastAPI raises `403` with a
`detail` string; the frontend's existing toast pattern
(`err.response?.data?.detail`) surfaces it if a stale tab/direct API call
ever reaches that state (shouldn't happen through normal UI navigation
since the tab is hidden).

## Testing / verification

No automated test suite exists in this project (frontend or backend);
consistent with prior specs, verification is manual:

- Log in as `security_guard`: confirm the language switcher appears next
  to the tabs; confirm only "New Entry" and "Entry Log" tabs are visible
  (no "Weighbridge"); switch to Hindi and Marathi and confirm all in-scope
  text (form, table, toasts) updates correctly; reload the page and
  confirm the language choice persists.
- Log in as `admin`: confirm no language switcher appears, all three tabs
  are visible, and everything stays in English regardless of what a guard
  set on the same browser.
- Log in as `weighbridge_operator`: confirm "Entry Log" and "Weighbridge"
  tabs are visible (unchanged from today), no language switcher.
- Attempt `PATCH /api/entries/{id}/weight` and `POST
  /api/entries/{id}/photos` as `security_guard` directly (e.g. via
  `/docs`): confirm `403`. Confirm `admin` and `weighbridge_operator`
  still succeed.

## Out of scope (for this pass)

- Translating any page/component outside the New Entry form + Entry Log
  table (Login, Sidebar, Users, Weighbridge tab itself)
- Translating backend-supplied error/validation text
- Per-account (vs. per-browser) language persistence
- react-i18next or any other i18n library — deliberately a lightweight
  hand-rolled context, matching this project's preference for minimal
  dependencies
- Any change to `admin`'s or `weighbridge_operator`'s existing tab access
