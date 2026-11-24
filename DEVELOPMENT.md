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
