# GetPass — Development Status

_Last updated: 24 Nov 2026_

GetPass is a gate pass / weighbridge / quality / stores management system with three codebases sharing one backend contract:

| Part | Stack | Folder |
|---|---|---|
| Backend | FastAPI (Python) | `Backend/` |
| Web app | React + Vite | `Frontend/` |
| Mobile app | React Native CLI (not Expo) | `GetPassMobile/` |

---

## Backend (`Backend/`)

FastAPI app (`app/main.py`) with routers per domain:

- `routers/auth.py` — login, role-based access
- `routers/gate_in.py`, `routers/entries.py` — gate in/out, entry log
- `routers/weighments.py` + `weighing.py` — gross/tare weight capture
- `routers/quality.py`, `routers/quality_integration.py` — quality results
- `routers/grn.py` + `grn_posting.py`, `grn_views.py`, `goods_receipts.py` — stores/GRN
- `routers/dashboard.py` + `dashboard_summary.py` — dashboard numbers
- `routers/users.py` — user management
- `routers/uploads.py` + `photo_storage.py` — photo capture/storage
- `pass_creation.py`, `pass_queries.py`, `pass_states.py`, `pass_views.py` — gate pass lifecycle
- `audit.py`, `site_settings.py`, `integration_events.py` — audit log, site config, integration hooks
- `integrations/` — OCR, PO lookup, weighbridge indicator, mock data for external systems

Role model (security_guard, weighbridge_operator, quality, stores, admin/superadmin, etc.) is enforced here and mirrored into both frontends rather than re-invented per client.

## Web app (`Frontend/`)

React + Vite SPA. `src/pages` for screens, `src/components/ui` for a shared design system (Input/Select/PageHeading/banners), `src/i18n/strings` for Hindi/Marathi translations, `src/offline` for offline/queue handling, `src/context` and `src/hooks` for state and data access, `src/navigation` for routing.

Recent web-side work: Weighbridge tab (pending/all queue, camera capture, weight/photo API), guard language toggle (Hindi/Marathi) and guard role restrictions (blocked from weight/photo endpoints, Weighbridge tab hidden for security_guard), UI consistency pass (shared banner/PageHeading components, disabled input states, aria-busy on login).

## Mobile app (`GetPassMobile/`)

React Native CLI project talking to the same FastAPI backend via Bearer-token auth (not a separate API).

**Screens built** (`src/screens/`):
- `LoginScreen` — auth
- `DashboardScreen` — role-aware home / summary
- `gate/EntryListScreen`, `gate/EntryDetailScreen`, `gate/NewEntryScreen` — gate in/out, entry log
- `weighbridge/WeighbridgeScreen`, `weighbridge/WeighCaptureScreen` — weighbridge queue + capture
- `quality/QualityQueueScreen`, `quality/QualityResultScreen` — quality queue + result capture
- `stores/GrnListScreen`, `stores/GrnDetailScreen` — stores/GRN + entry log
- `UsersScreen`, `AccountScreen`, `SettingsScreen` (API host config), `MoreScreen`

**Supporting layers:**
- `api/` — one file per domain (auth, entries, grn, quality, weighments, dashboard, users), mirroring the backend routers
- `auth/AuthContext.tsx`, `auth/tokenStorage.ts` — Keychain-backed token storage/migration
- `navigation/RootNavigator.tsx`, `navigation/TabNavigator.tsx`, `navigation/roleActions.ts` — role-to-action mapping copied from the backend's own role tuples
- `components/BrandHeader.tsx`, `components/icons/TabBarIcon.tsx`, `components/ui.tsx` — shared header, tab icons (react-native-svg + Material Symbols paths), base UI kit
- `utils/formatPlate.ts`, `utils/apiError.ts` — plate formatting, API error normalization
- App icon regenerated for all Android mipmap densities and iOS AppIcon sizes

## Run the Android app on Windows

These steps use the connected Android phone and USB port forwarding. Keep the backend on port `8000` and Metro on port `8082`.

### Prerequisites

- Install Android Studio with the Android SDK and Platform Tools, and install JDK 17.
- Install Node.js `22.11` or newer (the mobile package's minimum).
- For first-time backend setup, install Python, SQL Server, and the ODBC Driver 17 for SQL Server.
- On a physical phone, enable **Developer options** and **USB debugging**, connect by USB, unlock the phone, and accept the USB debugging prompt.

### 1. Configure and start the backend

Open PowerShell in `Backend/`. On first setup, create the Python environment, install dependencies, and create `.env`:

```powershell
Set-Location 'C:\Users\Kishan Kulkarni\Desktop\GetPass\Backend'
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
notepad .env
```

In `.env`, set a random `SECRET_KEY` (at least 32 characters). Generate one with:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Also configure `DB_SERVER` / `DB_NAME` for your SQL Server. If the database has no users yet, set a private `DEFAULT_ADMIN_PASSWORD` (at least 8 characters; do not use the old placeholder). Do not commit `.env`.
Ensure the SQL Server instance is running and the database exists; the backend creates tables but does not create the database itself.

For later runs, just activate the existing environment. Start the server in this PowerShell window:

```powershell
Set-Location 'C:\Users\Kishan Kulkarni\Desktop\GetPass\Backend'
.\.venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

If PowerShell blocks the activation script, run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` in that window, then activate the environment again.

Leave this window open. Check the API from another PowerShell window:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/health
```

It should return `status : ok`.

### 2. Connect the phone and forward the ports

In a second PowerShell window:

```powershell
adb devices -l
adb reverse tcp:8082 tcp:8082
adb reverse tcp:8000 tcp:8000
adb reverse --list
```

The device status should be `device`, not `unauthorized`. The reverse list should include `8082` and `8000`. If the phone asks to authorize this computer, accept the prompt and run the commands again.

### 3. Start Metro

In a third PowerShell window:

```powershell
Set-Location 'C:\Users\Kishan Kulkarni\Desktop\GetPass\GetPassMobile'
npm ci
npm start -- --port 8082
```

Run `npm ci` on first setup (or after dependencies change). Leave Metro running. If Metro is already running on port `8082`, reuse it instead of starting another copy.

### 4. Build, install, and open the app

In a fourth PowerShell window:

```powershell
Set-Location 'C:\Users\Kishan Kulkarni\Desktop\GetPass\GetPassMobile'
npm run android -- --no-packager --port 8082
```

This builds the Android app, installs it on the connected device, and opens it. The `--no-packager` option uses the Metro server from Step 3 and avoids the prompt to choose a different port.

To confirm the app is open:

```powershell
adb shell dumpsys activity activities | Select-String 'ResumedActivity'
```

The result should contain `com.getpassmobile/.MainActivity`. Saved JavaScript changes refresh through Metro; use the Android Dev Menu's **Reload** option to reload manually.

### Emulator or Wi-Fi-only phone

- **Android emulator:** start an emulator in Android Studio. USB `adb reverse` commands are not needed; the Android API host is derived from the Metro URL, with `10.0.2.2` used for the emulator.
- **Phone over Wi-Fi:** keep the backend bound to `0.0.0.0`, connect the phone and computer to the same network, and set the mobile app's **More → Settings → API server address** to `http://<computer-LAN-IP>:8000`. Find the computer address with `ipconfig` and allow the backend/Metro through Windows Firewall if prompted.
- If you choose a Metro port other than `8082`, use that same port for `npm start`, `adb reverse`, and `npm run android`.

### Build a debug APK without launching the app

```powershell
Set-Location 'C:\Users\Kishan Kulkarni\Desktop\GetPass\GetPassMobile'
.\android\gradlew.bat assembleDebug
```

The APK is written to `android\app\build\outputs\apk\debug\app-debug.apk`. Install and open it with:

```powershell
adb install -r .\android\app\build\outputs\apk\debug\app-debug.apk
adb shell am start -n com.getpassmobile/.MainActivity
```

To stop development servers, press **Ctrl+C** in the backend and Metro windows.

**Known gaps / open items:**
- Mobile's Weighbridge screen is a simpler placeholder vs. the web Weighbridge tab — no Supplier field, no On-site/All-entries tabs, and no pagination/load-more yet. Flagged for Shikamaru to spec if parity with web is wanted (not a bug fix, a feature gap).
- No dark mode on the web app yet (tracked as a feature request, not a defect).
- Live device/emulator QA (Coco/Sakura) still catching up to the pace of new screens shipped.

---

## Recent commit history (most recent first)

```
cd83e7c feat: Enhance Entry and Quality screens with gate-out functionality and improved UI
01247f4 feat: add BrandHeader and TabBarIcon components; implement formatPlate utility function
3593ac9 Add new app icons for various resolutions
347c32f feat: Implement bottom tab navigation and refactor screens
8c30586 feat: enhance navigation and add SettingsScreen for API configuration
13956f0 feat: add QualityResultScreen for capturing quality results
fa824aa feat: implement authentication flow with login, logout, and role-based access control
bbea092 feat: add API host configuration and AsyncStorage integration
914fdf9 feat: initialize GetPassMobile project with package.json and TypeScript configuration
```

Earlier web-app history includes: Hindi/Marathi i18n for Entry Log and New Entry, guard language switcher, guard role restrictions on weight/photo endpoints, Weighbridge tab + camera capture + weight/photo APIs, breadcrumb navigation.

Working tree is currently clean; branch `master` is up to date with `origin/master`.
