# Security Guard Language Toggle & Weighbridge Access Restriction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `security_guard` a Hindi/Marathi language toggle for the New Entry form and Entry Log table, and close an access gap that today lets `security_guard` reach the Weighbridge tab and its weight/photo APIs.

**Architecture:** A small hand-rolled `LanguageContext` (no new dependency) holds the active language and a `t(key)` lookup into a plain `translations.js` object, following the same `createContext`/`useContext` pattern as the existing `AuthContext`/`ToastContext`. It's mounted inside `AuthProvider` so it can read `user.role` and force English for anyone who isn't `security_guard`, even if a different language is stored from a prior session on a shared browser. Separately, the Weighbridge tab's visibility (frontend) and its two write endpoints (backend) both gain a `security_guard` exclusion, mirroring the existing `weighbridge_operator` exclusion pattern (`canWriteEntries` / `require_entry_write`).

**Tech Stack:** FastAPI + SQLAlchemy + Pydantic on the backend; Vite + React 18 + Tailwind CSS v4 (plain JavaScript, no TypeScript) on the frontend.

## Global Constraints

- This project has **no automated test suite**, backend or frontend, by deliberate choice (see the spec's "Out of scope"). Every task below is verified manually — backend via FastAPI's `/docs` Swagger UI, frontend via `npm run build` plus a manual browser walkthrough — matching how prior GatePass features were verified. Do not add pytest/vitest/jest as part of this plan.
- Translation scope is exactly: `EntryForm.jsx`, `EntryTable.jsx`, and the page heading + "New Entry"/"Entry Log" tab labels in `EntriesPage.jsx`. The "Weighbridge" tab label and every other page (Login, Sidebar, Users) stay hardcoded English. Backend-supplied error text (`err.response?.data?.detail`) is never translated.
- The language switcher only renders when `user?.role === 'security_guard'`. Critically, the **effective translation output** must also collapse to English for every other role — not just the switcher's visibility — so an admin logging in on a device where a guard previously chose Hindi/Marathi still sees English. `LanguageProvider` must therefore be mounted inside `AuthProvider` (so it can read `user.role`) and compute an `effectiveLanguage` that ignores the stored preference unless the current user is `security_guard`.
- Language choice persists via `localStorage` (key `getpass:language`), per-browser, not per-account. No backend changes for this part.
- `security_guard` losing Weighbridge access must land as **both** a UI change (hide the tab) **and** a backend change (403 the two endpoints) — hiding the tab alone leaves `PATCH /api/entries/{id}/weight` and `POST /api/entries/{id}/photos` reachable directly (e.g. via `/docs`, curl, or devtools) since today they only require `get_current_user` with no role check.
- `admin` and `weighbridge_operator` are unaffected by every change in this plan — their tab visibility, API access, and language (always English, no switcher) stay exactly as they are today.

---

### Task 1: Backend — block `security_guard` from weight/photo endpoints

**Files:**
- Modify: `Backend/app/auth.py`
- Modify: `Backend/app/routers/entries.py`

**Interfaces:**
- Consumes: `get_current_user`, `User` model (existing, unchanged).
- Produces: `require_weighbridge_write(user: User = Depends(get_current_user)) -> User` in `app/auth.py`, raising `403` for `role == "security_guard"`. Applied as a route dependency to `record_weight` and `upload_photos` in `app/routers/entries.py`. Nothing later in this plan consumes this function directly — it's a terminal backend change, verified in this task.

- [ ] **Step 1: Add `require_weighbridge_write` to `Backend/app/auth.py`**

In `Backend/app/auth.py`, find:
```python
def require_entry_write(user: User = Depends(get_current_user)) -> User:
    if user.role == "weighbridge_operator":
        raise HTTPException(status_code=403, detail="Weighbridge operators cannot register or close out entries")
    return user
```
Add immediately after it:
```python


def require_weighbridge_write(user: User = Depends(get_current_user)) -> User:
    if user.role == "security_guard":
        raise HTTPException(status_code=403, detail="Security guards cannot record weights or upload weighbridge photos")
    return user
```

- [ ] **Step 2: Verify it imports cleanly**

Run (from `Backend\`, venv activated):
```powershell
python -c "from app.auth import require_weighbridge_write; print(require_weighbridge_write.__name__)"
```
Expected output: `require_weighbridge_write`

- [ ] **Step 3: Apply the dependency to the weight and photo routes in `Backend/app/routers/entries.py`**

Find:
```python
from app.auth import get_current_user, require_entry_write
```
Replace with:
```python
from app.auth import get_current_user, require_entry_write, require_weighbridge_write
```

Find:
```python
@router.patch("/{entry_id}/weight", response_model=VehicleEntryOut)
def record_weight(
    entry_id: int,
    payload: WeightUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
```
Replace with:
```python
@router.patch("/{entry_id}/weight", response_model=VehicleEntryOut, dependencies=[Depends(require_weighbridge_write)])
def record_weight(
    entry_id: int,
    payload: WeightUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
```

Find:
```python
@router.post("/{entry_id}/photos", response_model=List[PhotoOut], status_code=201)
async def upload_photos(
    entry_id: int,
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
```
Replace with:
```python
@router.post("/{entry_id}/photos", response_model=List[PhotoOut], status_code=201, dependencies=[Depends(require_weighbridge_write)])
async def upload_photos(
    entry_id: int,
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
```

- [ ] **Step 4: Start the server and verify via the Swagger UI**

Run (from `Backend\`, venv activated), in the background:
```powershell
uvicorn app.main:app --reload --port 8001
```

Open `http://localhost:8001/docs`:
1. Expand `POST /api/auth/login`, "Try it out", log in with an existing `security_guard` account, Execute. Expected: `200`. The session cookie is now set for this browser tab.
2. Expand `GET /api/entries`, Try it out, Execute (no filters). Expected: `200` with a list; note the `id` of any entry — call it `<id>`.
3. Expand `PATCH /api/entries/{entry_id}/weight`, Try it out, `entry_id = <id>`, body `{"gross_weight": 1000, "weight_unit": "kg"}`, Execute. Expected: `403` with `detail: "Security guards cannot record weights or upload weighbridge photos"`.
4. Expand `POST /api/entries/{entry_id}/photos`, Try it out, `entry_id = <id>`, pick any small file, Execute. Expected: `403` with the same `detail` message.
5. Log in again via `POST /api/auth/login` with an existing `admin` account (this overwrites the session cookie). Repeat step 3. Expected: `200`, weight recorded.
6. Log in again with an existing `weighbridge_operator` account. Repeat step 4. Expected: `201`, photo uploaded.

Stop the server (Ctrl+C) once verified.

- [ ] **Step 5: Commit**

```bash
git add Backend/app/auth.py Backend/app/routers/entries.py
git commit -m "feat(backend): block security_guard from weight and photo endpoints"
```

---

### Task 2: Frontend — hide the Weighbridge tab from `security_guard`

**Files:**
- Modify: `Frontend/src/pages/EntriesPage.jsx`

**Interfaces:**
- Consumes: `useAuth` (existing, `Frontend/src/context/AuthContext.jsx`).
- Produces: `security_guard` no longer sees or can activate the "Weighbridge" tab. Task 3 modifies this same file again on top of this change (adding the language switcher and translated tab labels), so this task's diff must land first.

- [ ] **Step 1: Replace `Frontend/src/pages/EntriesPage.jsx`**

```jsx
import { useState } from 'react'
import EntryForm from '../components/EntryForm'
import EntryTable from '../components/EntryTable'
import WeighbridgeTab from '../components/WeighbridgeTab'
import { useAuth } from '../context/AuthContext'
import { useEntries } from '../hooks/useEntries'

const ALL_TABS = [
  { key: 'new', label: 'New Entry' },
  { key: 'log', label: 'Entry Log' },
  { key: 'weighbridge', label: 'Weighbridge' },
]

export default function EntriesPage() {
  const { user } = useAuth()
  const canWriteEntries = user?.role !== 'weighbridge_operator'
  const canAccessWeighbridge = user?.role !== 'security_guard'
  const tabs = ALL_TABS.filter((tab) =>
    tab.key === 'new' ? canWriteEntries : tab.key === 'weighbridge' ? canAccessWeighbridge : true
  )

  const { entries, loading, error, addEntry, markExit } = useEntries()
  const [activeTab, setActiveTab] = useState(canWriteEntries ? 'new' : 'log')

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Vehicle Entry Log</h1>

      <div className="mb-6 flex gap-2 border-b border-slate-200">
        {tabs.map((tab) => (
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

      {activeTab === 'new' && canWriteEntries && <EntryForm onSubmit={addEntry} />}
      {activeTab === 'log' && (
        <EntryTable
          entries={entries}
          loading={loading}
          error={error}
          onMarkExit={markExit}
          canMarkExit={canWriteEntries}
        />
      )}
      {activeTab === 'weighbridge' && canAccessWeighbridge && <WeighbridgeTab />}
    </div>
  )
}
```

- [ ] **Step 2: Verify the build passes**

Run (from `Frontend\`):
```powershell
npm run build
```
Expected: build completes with no errors.

- [ ] **Step 3: Manual browser verification (for you to do — not automatable)**

With the backend (Task 1) and frontend dev server (`npm run dev`) both running:
1. Log in as `security_guard`. Confirm only "New Entry" and "Entry Log" tabs are visible — no "Weighbridge" tab.
2. Log in as `admin`. Confirm all three tabs are visible.
3. Log in as `weighbridge_operator`. Confirm "Entry Log" and "Weighbridge" are visible, "New Entry" is not (unchanged from before this task).

- [ ] **Step 4: Commit**

```bash
git add Frontend/src/pages/EntriesPage.jsx
git commit -m "fix(frontend): hide Weighbridge tab from security_guard"
```

---

### Task 3: Language foundation — context, translations, switcher, wired into the Entries page

**Files:**
- Create: `Frontend/src/i18n/translations.js`
- Create: `Frontend/src/context/LanguageContext.jsx`
- Create: `Frontend/src/components/LanguageSwitcher.jsx`
- Modify: `Frontend/src/App.jsx`
- Modify: `Frontend/src/pages/EntriesPage.jsx`

**Interfaces:**
- Consumes: `useAuth` (existing) inside `LanguageContext.jsx`.
- Produces: `translations` object (`Frontend/src/i18n/translations.js`, keyed `en`/`hi`/`mr`); `LanguageProvider` + `useLanguage()` returning `{ language, setLanguage, t }` (`Frontend/src/context/LanguageContext.jsx`); `<LanguageSwitcher />` component. Consumed by Task 4 (`EntryForm.jsx`) and Task 5 (`EntryTable.jsx`), both of which call `useLanguage()` for `t`.

- [ ] **Step 1: Create `Frontend/src/i18n/translations.js`**

```js
export const translations = {
  en: {
    pageTitle: 'Vehicle Entry Log',
    tabNew: 'New Entry',
    tabLog: 'Entry Log',
    step1Title: 'Step 1 of 2: Document Details',
    step2Title: 'Step 2 of 2: Vehicle & Material Details',
    scanDocument: 'Scan Document',
    scanVehicle: 'Scan Vehicle',
    loadingScanner: 'Loading scanner...',
    scanDocumentQr: 'Scan Document QR Code',
    scanVehicleQr: 'Scan Vehicle QR Code',
    placeholderRefDoc: 'Challan/Invoice/PO Number',
    placeholderSupplier: 'Supplier/Transporter',
    placeholderProject: 'Project Name',
    placeholderSubproject: 'Subproject Name',
    next: 'Next',
    placeholderVehicleNumber: 'Vehicle Number',
    placeholderDriverName: 'Driver Name',
    placeholderDriverPhone: 'Driver Phone',
    placeholderMaterialDescription: 'Material Description',
    placeholderQuantity: 'Quantity',
    placeholderUnit: 'Unit (kg/ton/units)',
    placeholderPurpose: 'Purpose',
    back: 'Back',
    saving: 'Saving...',
    registerEntry: 'Register Entry',
    toastInvalidDocQr: 'Scanned code is not a valid document QR',
    toastScannedFilled: 'Scanned data filled into the form',
    toastEntryRegistered: 'Vehicle entry registered',
    toastEntryFailed: 'Failed to save entry',
    colVehicle: 'Vehicle',
    colProject: 'Project',
    colDriver: 'Driver',
    colMaterial: 'Material',
    colEntry: 'Entry',
    colStatus: 'Status',
    colAction: 'Action',
    loadingEntries: 'Loading entries...',
    noEntries: 'No entries yet.',
    statusExited: 'Exited',
    statusOnSite: 'On Site',
    markExit: 'Mark Exit',
    toastMarkedExit: 'Vehicle marked as exited',
    toastMarkExitFailed: 'Failed to mark exit',
  },
  hi: {
    pageTitle: 'वाहन प्रवेश लॉग',
    tabNew: 'नई एंट्री',
    tabLog: 'एंट्री लॉग',
    step1Title: 'चरण 1 / 2: दस्तावेज़ विवरण',
    step2Title: 'चरण 2 / 2: वाहन और सामग्री विवरण',
    scanDocument: 'दस्तावेज़ स्कैन करें',
    scanVehicle: 'वाहन स्कैन करें',
    loadingScanner: 'स्कैनर लोड हो रहा है...',
    scanDocumentQr: 'दस्तावेज़ QR कोड स्कैन करें',
    scanVehicleQr: 'वाहन QR कोड स्कैन करें',
    placeholderRefDoc: 'चालान/इनवॉइस/PO नंबर',
    placeholderSupplier: 'आपूर्तिकर्ता/ट्रांसपोर्टर',
    placeholderProject: 'प्रोजेक्ट का नाम',
    placeholderSubproject: 'सब-प्रोजेक्ट का नाम',
    next: 'आगे',
    placeholderVehicleNumber: 'वाहन नंबर',
    placeholderDriverName: 'चालक का नाम',
    placeholderDriverPhone: 'चालक का फोन नंबर',
    placeholderMaterialDescription: 'सामग्री विवरण',
    placeholderQuantity: 'मात्रा',
    placeholderUnit: 'इकाई (kg/ton/units)',
    placeholderPurpose: 'उद्देश्य',
    back: 'पीछे',
    saving: 'सहेजा जा रहा है...',
    registerEntry: 'एंट्री दर्ज करें',
    toastInvalidDocQr: 'स्कैन किया गया कोड मान्य दस्तावेज़ QR नहीं है',
    toastScannedFilled: 'स्कैन किया गया डेटा फॉर्म में भर दिया गया',
    toastEntryRegistered: 'वाहन एंट्री दर्ज की गई',
    toastEntryFailed: 'एंट्री सहेजने में विफल',
    colVehicle: 'वाहन',
    colProject: 'प्रोजेक्ट',
    colDriver: 'चालक',
    colMaterial: 'सामग्री',
    colEntry: 'प्रवेश',
    colStatus: 'स्थिति',
    colAction: 'कार्रवाई',
    loadingEntries: 'एंट्रियां लोड हो रही हैं...',
    noEntries: 'अभी तक कोई एंट्री नहीं है।',
    statusExited: 'बाहर',
    statusOnSite: 'साइट पर',
    markExit: 'निकास दर्ज करें',
    toastMarkedExit: 'वाहन को बाहर के रूप में चिह्नित किया गया',
    toastMarkExitFailed: 'निकास दर्ज करने में विफल',
  },
  mr: {
    pageTitle: 'वाहन प्रवेश नोंद',
    tabNew: 'नवीन नोंद',
    tabLog: 'नोंद यादी',
    step1Title: 'पायरी 1 / 2: कागदपत्र तपशील',
    step2Title: 'पायरी 2 / 2: वाहन आणि मालाचा तपशील',
    scanDocument: 'कागदपत्र स्कॅन करा',
    scanVehicle: 'वाहन स्कॅन करा',
    loadingScanner: 'स्कॅनर लोड होत आहे...',
    scanDocumentQr: 'कागदपत्र QR कोड स्कॅन करा',
    scanVehicleQr: 'वाहन QR कोड स्कॅन करा',
    placeholderRefDoc: 'चलन/इनव्हॉइस/PO क्रमांक',
    placeholderSupplier: 'पुरवठादार/वाहतूकदार',
    placeholderProject: 'प्रकल्पाचे नाव',
    placeholderSubproject: 'उप-प्रकल्पाचे नाव',
    next: 'पुढे',
    placeholderVehicleNumber: 'वाहन क्रमांक',
    placeholderDriverName: 'चालकाचे नाव',
    placeholderDriverPhone: 'चालकाचा फोन नंबर',
    placeholderMaterialDescription: 'मालाचे वर्णन',
    placeholderQuantity: 'प्रमाण',
    placeholderUnit: 'एकक (kg/ton/units)',
    placeholderPurpose: 'उद्देश',
    back: 'मागे',
    saving: 'जतन होत आहे...',
    registerEntry: 'नोंद नोंदवा',
    toastInvalidDocQr: 'स्कॅन केलेला कोड वैध कागदपत्र QR नाही',
    toastScannedFilled: 'स्कॅन केलेला डेटा फॉर्ममध्ये भरला गेला',
    toastEntryRegistered: 'वाहन नोंद नोंदवली गेली',
    toastEntryFailed: 'नोंद जतन करण्यात अयशस्वी',
    colVehicle: 'वाहन',
    colProject: 'प्रकल्प',
    colDriver: 'चालक',
    colMaterial: 'माल',
    colEntry: 'प्रवेश',
    colStatus: 'स्थिती',
    colAction: 'कृती',
    loadingEntries: 'नोंदी लोड होत आहेत...',
    noEntries: 'अद्याप कोणतीही नोंद नाही.',
    statusExited: 'बाहेर गेले',
    statusOnSite: 'जागेवर',
    markExit: 'बाहेर पडल्याची नोंद करा',
    toastMarkedExit: 'वाहन बाहेर गेल्याची नोंद झाली',
    toastMarkExitFailed: 'बाहेर पडल्याची नोंद करण्यात अयशस्वी',
  },
}
```

- [ ] **Step 2: Create `Frontend/src/context/LanguageContext.jsx`**

```jsx
import { createContext, useContext, useEffect, useState } from 'react'
import { translations } from '../i18n/translations'
import { useAuth } from './AuthContext'

const LanguageContext = createContext(null)
const STORAGE_KEY = 'getpass:language'
const DEFAULT_LANGUAGE = 'en'

function readStoredLanguage() {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored && translations[stored] ? stored : DEFAULT_LANGUAGE
}

export function LanguageProvider({ children }) {
  const { user } = useAuth()
  const [language, setLanguageState] = useState(readStoredLanguage)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, language)
  }, [language])

  const setLanguage = (lang) => {
    if (translations[lang]) setLanguageState(lang)
  }

  // Only security_guard's UI actually renders in another language - everyone
  // else always sees English, even if a guard set hi/mr earlier on this same
  // shared browser.
  const effectiveLanguage = user?.role === 'security_guard' ? language : DEFAULT_LANGUAGE

  const t = (key) => translations[effectiveLanguage]?.[key] ?? translations[DEFAULT_LANGUAGE][key] ?? key

  return (
    <LanguageContext.Provider value={{ language: effectiveLanguage, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
```

- [ ] **Step 3: Create `Frontend/src/components/LanguageSwitcher.jsx`**

```jsx
import { useLanguage } from '../context/LanguageContext'
import Button from './ui/Button'

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिंदी' },
  { code: 'mr', label: 'मराठी' },
]

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage()

  return (
    <div className="flex gap-2">
      {LANGUAGES.map((lang) => (
        <Button
          key={lang.code}
          type="button"
          variant={language === lang.code ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setLanguage(lang.code)}
        >
          {lang.label}
        </Button>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Wire `LanguageProvider` into `Frontend/src/App.jsx`**

It must be mounted **inside** `AuthProvider` (it calls `useAuth()`). Replace `Frontend/src/App.jsx` with:

```jsx
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { LanguageProvider } from './context/LanguageContext'
import { ToastProvider } from './context/ToastContext'
import Sidebar from './components/Sidebar'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import EntriesPage from './pages/EntriesPage'
import UsersPage from './pages/UsersPage'

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <LanguageProvider>
            <div className="min-h-screen bg-slate-50 lg:flex">
              <Sidebar />
              <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-5xl">
                  <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route
                      path="/entries"
                      element={
                        <ProtectedRoute>
                          <EntriesPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/users"
                      element={
                        <ProtectedRoute adminOnly>
                          <UsersPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route path="*" element={<Navigate to="/entries" replace />} />
                  </Routes>
                </div>
              </main>
            </div>
          </LanguageProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}

export default App
```

- [ ] **Step 5: Wire the switcher and translated chrome into `Frontend/src/pages/EntriesPage.jsx`**

Replace `Frontend/src/pages/EntriesPage.jsx` (this builds on Task 2's version) with:

```jsx
import { useState } from 'react'
import EntryForm from '../components/EntryForm'
import EntryTable from '../components/EntryTable'
import LanguageSwitcher from '../components/LanguageSwitcher'
import WeighbridgeTab from '../components/WeighbridgeTab'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { useEntries } from '../hooks/useEntries'

export default function EntriesPage() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const canWriteEntries = user?.role !== 'weighbridge_operator'
  const canAccessWeighbridge = user?.role !== 'security_guard'
  const allTabs = [
    { key: 'new', label: t('tabNew') },
    { key: 'log', label: t('tabLog') },
    { key: 'weighbridge', label: 'Weighbridge' },
  ]
  const tabs = allTabs.filter((tab) =>
    tab.key === 'new' ? canWriteEntries : tab.key === 'weighbridge' ? canAccessWeighbridge : true
  )

  const { entries, loading, error, addEntry, markExit } = useEntries()
  const [activeTab, setActiveTab] = useState(canWriteEntries ? 'new' : 'log')

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{t('pageTitle')}</h1>
        {user?.role === 'security_guard' && <LanguageSwitcher />}
      </div>

      <div className="mb-6 flex gap-2 border-b border-slate-200">
        {tabs.map((tab) => (
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

      {activeTab === 'new' && canWriteEntries && <EntryForm onSubmit={addEntry} />}
      {activeTab === 'log' && (
        <EntryTable
          entries={entries}
          loading={loading}
          error={error}
          onMarkExit={markExit}
          canMarkExit={canWriteEntries}
        />
      )}
      {activeTab === 'weighbridge' && canAccessWeighbridge && <WeighbridgeTab />}
    </div>
  )
}
```

- [ ] **Step 6: Verify the build passes**

Run (from `Frontend\`):
```powershell
npm run build
```
Expected: build completes with no errors.

- [ ] **Step 7: Manual browser verification (for you to do — not automatable)**

With the backend (Task 1) and frontend dev server both running:
1. Log in as `security_guard`. Confirm a 3-button switcher ("English" / "हिंदी" / "मराठी") appears next to the page heading, with "English" highlighted (blue) by default.
2. Click "हिंदी". Confirm the page heading and the "New Entry"/"Entry Log" tab labels immediately switch to Hindi, and "हिंदी" is now highlighted.
3. Click "मराठी". Confirm they switch to Marathi.
4. Reload the page (F5). Confirm it's still in Marathi (persisted via `localStorage`).
5. Log out and log in as `admin`. Confirm no switcher appears, and the page heading/tab labels are in English — **even though `localStorage` still holds `'mr'` from step 3 on this same browser**.
6. Log in as `weighbridge_operator`. Confirm no switcher appears and everything is in English.

- [ ] **Step 8: Commit**

```bash
git add Frontend/src/i18n/translations.js Frontend/src/context/LanguageContext.jsx Frontend/src/components/LanguageSwitcher.jsx Frontend/src/App.jsx Frontend/src/pages/EntriesPage.jsx
git commit -m "feat(frontend): add Hindi/Marathi language switcher for security_guard"
```

---

### Task 4: Translate the New Entry form (`EntryForm.jsx`)

**Files:**
- Modify: `Frontend/src/components/EntryForm.jsx`

**Interfaces:**
- Consumes: `useLanguage` (Task 3) for `t`.
- Produces: every placeholder, step heading, button label, and static toast message in the New Entry form now renders via `t('key')`.

- [ ] **Step 1: Replace `Frontend/src/components/EntryForm.jsx`**

```jsx
import { lazy, Suspense, useState } from 'react'
import { useLanguage } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import Button from './ui/Button'
import Card from './ui/Card'
import Input from './ui/Input'

const QrScanner = lazy(() => import('./QrScanner'))

const initialState = {
  vehicle_number: '',
  project_name: '',
  subproject_name: '',
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
  const { t } = useLanguage()
  const { showToast } = useToast()
  const [form, setForm] = useState(initialState)
  const [submitting, setSubmitting] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [step, setStep] = useState(1)

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleDocScan = (decodedText) => {
    let scanned
    try {
      scanned = JSON.parse(decodedText)
    } catch {
      setScanning(false)
      showToast(t('toastInvalidDocQr'), 'error')
      return
    }

    setForm((prev) => ({
      ...prev,
      reference_doc_number: scanned.reference_doc_number ?? prev.reference_doc_number,
      supplier_transporter_name: scanned.supplier_transporter_name ?? prev.supplier_transporter_name,
      project_name: scanned.project_name ?? prev.project_name,
      subproject_name: scanned.subproject_name ?? prev.subproject_name,
    }))
    setScanning(false)
    showToast(t('toastScannedFilled'), 'success')
  }

  const handleVehicleScan = (decodedText) => {
    let scanned
    try {
      scanned = JSON.parse(decodedText)
    } catch {
      scanned = { vehicle_number: decodedText }
    }

    setForm((prev) => ({
      ...prev,
      vehicle_number: scanned.vehicle_number ?? prev.vehicle_number,
      driver_name: scanned.driver_name ?? prev.driver_name,
      driver_phone: scanned.driver_phone ?? prev.driver_phone,
    }))
    setScanning(false)
    showToast(t('toastScannedFilled'), 'success')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const payload = {
        ...form,
        material_quantity: form.material_quantity ? Number(form.material_quantity) : null,
      }
      await onSubmit(payload)
      setForm(initialState)
      setStep(1)
      showToast(t('toastEntryRegistered'), 'success')
    } catch (err) {
      showToast(err.response?.data?.detail || t('toastEntryFailed'), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          {step === 1 ? t('step1Title') : t('step2Title')}
        </h2>
        {!scanning && (
          <Button type="button" variant="secondary" size="sm" onClick={() => setScanning(true)}>
            {step === 1 ? t('scanDocument') : t('scanVehicle')}
          </Button>
        )}
      </div>

      {scanning && (
        <div className="mb-4">
          <Suspense fallback={<p className="text-sm text-slate-500">{t('loadingScanner')}</p>}>
            <QrScanner
              title={step === 1 ? t('scanDocumentQr') : t('scanVehicleQr')}
              onScan={step === 1 ? handleDocScan : handleVehicleScan}
              onClose={() => setScanning(false)}
            />
          </Suspense>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {step === 1 ? (
          <>
            <Input name="reference_doc_number" value={form.reference_doc_number} onChange={handleChange} placeholder={t('placeholderRefDoc')} />
            <Input name="supplier_transporter_name" value={form.supplier_transporter_name} onChange={handleChange} placeholder={t('placeholderSupplier')} />
            <Input name="project_name" value={form.project_name} onChange={handleChange} placeholder={t('placeholderProject')} />
            <Input name="subproject_name" value={form.subproject_name} onChange={handleChange} placeholder={t('placeholderSubproject')} />
            <Button type="button" onClick={() => setStep(2)} className="col-span-full sm:col-span-1">
              {t('next')}
            </Button>
          </>
        ) : (
          <>
            <Input name="vehicle_number" value={form.vehicle_number} onChange={handleChange} placeholder={t('placeholderVehicleNumber')} required />
            <Input name="driver_name" value={form.driver_name} onChange={handleChange} placeholder={t('placeholderDriverName')} required />
            <Input name="driver_phone" value={form.driver_phone} onChange={handleChange} placeholder={t('placeholderDriverPhone')} />
            <Input name="material_description" value={form.material_description} onChange={handleChange} placeholder={t('placeholderMaterialDescription')} />
            <Input name="material_quantity" type="number" value={form.material_quantity} onChange={handleChange} placeholder={t('placeholderQuantity')} />
            <Input name="material_unit" value={form.material_unit} onChange={handleChange} placeholder={t('placeholderUnit')} />
            <Input name="purpose" value={form.purpose} onChange={handleChange} placeholder={t('placeholderPurpose')} />
            <div className="col-span-full flex gap-3">
              <Button type="button" variant="secondary" onClick={() => setStep(1)}>
                {t('back')}
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? t('saving') : t('registerEntry')}
              </Button>
            </div>
          </>
        )}
      </form>
    </Card>
  )
}
```

- [ ] **Step 2: Verify the build passes**

Run (from `Frontend\`):
```powershell
npm run build
```
Expected: build completes with no errors.

- [ ] **Step 3: Manual browser verification (for you to do — not automatable)**

Log in as `security_guard`, switch to हिंदी:
1. Confirm the step heading reads "चरण 1 / 2: दस्तावेज़ विवरण" and all four step-1 placeholders are in Hindi.
2. Click "आगे" (Next). Confirm the step-2 heading and all placeholders are in Hindi, and the buttons read "पीछे" / "एंट्री दर्ज करें".
3. Fill in the required fields and submit. Confirm the success toast reads "वाहन एंट्री दर्ज की गई".
4. Click "दस्तावेज़ स्कैन करें" (Scan Document) and scan an invalid/non-JSON QR code (or cancel and re-trigger with a bad code if you have one). Confirm the error toast reads "स्कैन किया गया कोड मान्य दस्तावेज़ QR नहीं है".
5. Switch to मराठी and repeat a quick spot-check of steps 1-2 to confirm Marathi strings render correctly.

- [ ] **Step 4: Commit**

```bash
git add Frontend/src/components/EntryForm.jsx
git commit -m "feat(frontend): translate New Entry form to Hindi/Marathi"
```

---

### Task 5: Translate the Entry Log table (`EntryTable.jsx`)

**Files:**
- Modify: `Frontend/src/components/EntryTable.jsx`

**Interfaces:**
- Consumes: `useLanguage` (Task 3) for `t`.
- Produces: every column header, status badge, button label, loading/empty state, and static toast message in the Entry Log table now renders via `t('key')`. This is the last translated surface in this plan.

- [ ] **Step 1: Replace `Frontend/src/components/EntryTable.jsx`**

```jsx
import { useLanguage } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import Badge from './ui/Badge'
import Button from './ui/Button'
import Card from './ui/Card'

export default function EntryTable({ entries, loading, error, onMarkExit, canMarkExit = true }) {
  const { t } = useLanguage()
  const { showToast } = useToast()

  const handleMarkExit = async (id) => {
    try {
      await onMarkExit(id)
      showToast(t('toastMarkedExit'), 'success')
    } catch (err) {
      showToast(err.response?.data?.detail || t('toastMarkExitFailed'), 'error')
    }
  }

  if (loading) return <p className="text-slate-500">{t('loadingEntries')}</p>
  if (error) return <p className="text-red-600">{error}</p>
  if (entries.length === 0) return <p className="text-slate-500">{t('noEntries')}</p>

  return (
    <Card className="overflow-x-auto p-0">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{t('colVehicle')}</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{t('colProject')}</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{t('colDriver')}</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{t('colMaterial')}</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{t('colEntry')}</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{t('colStatus')}</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{t('colAction')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {entries.map((entry) => (
            <tr key={entry.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-900">{entry.vehicle_number}</td>
              <td className="px-4 py-3 text-slate-600">
                {entry.project_name || '-'}
                {entry.subproject_name ? <span className="block text-xs text-slate-400">{entry.subproject_name}</span> : null}
              </td>
              <td className="px-4 py-3 text-slate-600">{entry.driver_name}</td>
              <td className="px-4 py-3 text-slate-600">
                {entry.material_description}
                {entry.material_quantity ? ` (${entry.material_quantity} ${entry.material_unit || ''})` : ''}
              </td>
              <td className="px-4 py-3 text-slate-500">{new Date(entry.entry_time).toLocaleString()}</td>
              <td className="px-4 py-3">
                {entry.exit_time ? (
                  <div className="flex flex-col gap-1">
                    <Badge tone="green">{t('statusExited')}</Badge>
                    <span className="text-xs text-slate-400">{new Date(entry.exit_time).toLocaleString()}</span>
                  </div>
                ) : (
                  <Badge tone="blue">{t('statusOnSite')}</Badge>
                )}
              </td>
              <td className="px-4 py-3">
                {!entry.exit_time && canMarkExit && (
                  <Button variant="warning" size="sm" onClick={() => handleMarkExit(entry.id)}>
                    {t('markExit')}
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}
```

- [ ] **Step 2: Verify the build passes**

Run (from `Frontend\`):
```powershell
npm run build
```
Expected: build completes with no errors.

- [ ] **Step 3: Manual browser verification (for you to do — not automatable)**

Log in as `security_guard`, go to "Entry Log":
1. In English, confirm the columns read Vehicle/Project/Driver/Material/Entry/Status/Action, and each row shows an "On Site" or "Exited" badge.
2. Switch to हिंदी. Confirm the column headers and status badges switch to Hindi (वाहन/प्रोजेक्ट/चालक/सामग्री/प्रवेश/स्थिति/कार्रवाई, साइट पर/बाहर).
3. Click "निकास दर्ज करें" (Mark Exit) on an on-site entry. Confirm the success toast reads "वाहन को बाहर के रूप में चिह्नित किया गया" and the badge switches to "बाहर".
4. Switch to मराठी and spot-check the same columns/badges/button render in Marathi.
5. Log in as `admin` and confirm the same table is entirely in English regardless of the guard's last-chosen language on this browser (re-confirms the `effectiveLanguage` gate from Task 3).

- [ ] **Step 4: Commit**

```bash
git add Frontend/src/components/EntryTable.jsx
git commit -m "feat(frontend): translate Entry Log table to Hindi/Marathi"
```
