# GatePass — App-wide Language Selection (English / Hindi / Marathi)

Date: 2026-10-27
Status: Ready to build
Builds on: `2026-08-20-security-guard-i18n-and-weighbridge-access-design.md` (guard-only toggle)

## Requirement

Every user, in every role, can use the whole app in English, Hindi or Marathi.
That includes the login page before anyone signs in. Today only the security
guard's entry screens are translated.

User story: As any GatePass user (guard, weighbridge operator or admin), I want
to pick English, हिंदी or मराठी once and see every screen in that language, so
that staff who read Hindi or Marathi more easily can work without mistakes.

## Current behaviour (verified in code)

| Area | Today |
|---|---|
| `Frontend/src/context/LanguageContext.jsx` | Stores choice in `localStorage` key `getpass:language` (`en`/`hi`/`mr`, default `en`). `effectiveLanguage` is forced to `en` unless `user.role === 'security_guard'`. `t(key)` falls back to English, then to the key. No placeholder support. Does not set `<html lang>`. `localStorage` calls are not wrapped in try/catch. |
| `Frontend/src/context/AuthContext.jsx` | `sessionExpiredMessage(role)` repeats the guard-only rule and the storage key. |
| `Frontend/src/i18n/translations.js` | One file, 74 keys per language, covering New Entry, Entry Log, Account and bottom bar only. |
| `Frontend/src/components/LanguageSwitcher.jsx` | Buttons English / हिंदी / मराठी with `lang` and `aria-pressed`. Shown in the `EntriesPage` heading for guards only, and on `AccountPage` for guards only. |
| `Frontend/src/pages/LoginPage.jsx` | All English. No switcher. Shows backend `detail` raw ("Invalid username or password"). Welcome toast is English. |
| `Frontend/src/pages/UsersPage.jsx` | All English: headings, form, role options, badges, buttons, table headers, toasts, empty and loading text, aria-labels. |
| `Frontend/src/components/WeighbridgeTab.jsx`, `WeighbridgeDetail.jsx`, `PhotoCapture.jsx`, `QrScanner.jsx` | All English. |
| `Sidebar.jsx`, `AppHeader.jsx`, `MobileTopBar.jsx`, `ProtectedRoute.jsx`, `ui/ListState.jsx`, `ui/Toast.jsx` | English nav labels, page names, role names (`role.replaceAll('_',' ')`), "Operations active", "Loading...", "GatePass home", "Main navigation", "Close" (Toast has no aria-label at all). |
| `navigation/navItems.js` | "Weighbridge" / "Users" tabs use fixed English `label`; `shortLabel` ("Weighing") is English-only and the comment forbids it on translated tabs. |
| Dates | `utils/formatDate.js` hard-codes `en-IN`. `EntryTable.jsx` (desktop) and `WeighbridgeTab.jsx` (desktop) use `toLocaleString()` with the browser locale. |
| Backend errors | FastAPI returns English `detail` strings (about 16 fixed messages in `Backend/app/auth.py`, `routers/auth.py`, `routers/entries.py`, `routers/users.py`, `routers/uploads.py`) plus 422 validation text that `api/client.js` flattens to `field: message`. Screens show `detail` as is. |
| Fonts | `:root` font stack is `Inter, "Segoe UI", Arial, sans-serif` — no Devanagari font named. Login `h1` has `line-height: 1.07`; kickers use uppercase English strings in JSX and letter-spacing. |
| `Frontend/index.html` | `<html lang="en">`, never updated. |

Note: `index.css` and `navItems.js` have uncommitted changes (the 430px short
tab label breakpoint). Build on top of them; do not revert them.

## Decisions

1. **All roles, all screens.** Remove the `security_guard` rule from
   `LanguageContext` and `AuthContext`. The chosen language applies to
   everyone, including the login page and the session-expired toast.
2. **Per-device, frontend only.** Keep the existing `localStorage` key
   `getpass:language`. No backend or database change.
   Why: the login page must show the language before we know who the user
   is, gate devices are usually used by one shift crew, and switching is one
   tap. A per-user preference would need a new column and API for little gain.
   It can be added later on top of this without rework.
3. **Language stays after sign-out.** The login page shows the last language
   used on that device.
4. **Default is English** when nothing is stored, the stored value is not
   `en`/`hi`/`mr`, or `localStorage` is unavailable (private mode / blocked).
   Every read and write is wrapped in try/catch; a failed write still changes
   the language for the current session.
5. **One storage helper.** Move the key, default and read/write into one
   module (`i18n/languageStorage.js`) used by both `LanguageContext` and
   `AuthContext`, so the rule cannot drift again.
6. **Digits stay Western (0-9) in every language.** Vehicle numbers, weights,
   quantities, phone numbers and dates use 0-9 so they match number plates,
   challans and the weighbridge display. (Watch out: `mr-IN` formats with
   Devanagari digits by default; force `numberingSystem: 'latn'`.)
7. **Backend errors are translated on the frontend by a lookup.** A new
   helper maps each known English `detail` string to a translation key.
   Unknown text (mainly 422 validation messages) is shown unchanged in
   English, because hiding it would lose the reason for the failure. When
   there is no `detail` at all, the screen's own translated fallback is
   used, as today. No backend change.
8. **Translations are written by the team** in plain, everyday words
   (as in the existing hi/mr keys), keeping common English loan words
   people use on site (QR, PO, kg, ton, login). Before release, a Hindi and
   a Marathi reader should skim each screen once.

## Business rules

1. The switcher always shows three options with their own-script labels:
   `English`, `हिंदी`, `मराठी` (never translated, each with its own `lang`).
2. Picking a language changes every visible string immediately, without a
   reload and without losing form input, filters, the open weighbridge sheet
   or the camera/scanner state.
3. Translated: every label, heading, button, placeholder, tab, badge, table
   header, toast, empty/loading/error state, dialog text, role name, nav item,
   `aria-label`, `alt` text and screen-reader-only text.
4. **Not translated:**
   - User-entered and stored data: names, usernames, vehicle numbers, driver
     names, phone numbers, project/subproject names, supplier, material
     description, unit text typed by the guard, purpose, document numbers.
   - Weight unit codes `kg` / `ton` (option values and display).
   - The brand name "GatePass" and the browser tab title.
   - Unknown backend error text (rule 7 above).
   - Browser-owned UI: native `required` bubbles, the native date picker, the
     camera permission prompt, and the `html5-qrcode` library's own buttons
     ("Request Camera Permissions", "Scan an Image File").
5. Role names are translated wherever shown (sidebar, header, Account page,
   Users page select and cards). The stored role value never changes.
6. Dates and times follow the language: `en` → `en-IN`, `hi` → `hi-IN`,
   `mr` → `mr-IN`, always with Western digits. All date display goes through
   `utils/formatDate.js`; no raw `toLocaleString()` remains.
7. `<html lang>` always equals the current language (`en`, `hi`, `mr`),
   including on the login page, so screen readers and the browser pick the
   right voice, hyphenation and font.
8. Text with variables uses placeholders, never string joining, because word
   order differs: `t('toastWelcome', { name })`, `t('filtersCount', { count })`,
   `t('stepOf', { step, total })`, `t('roleFor', { username })`.

## Where the switcher appears

| Place | Desktop (lg, 992px and up) | Mobile (below lg) |
|---|---|---|
| Login page | Compact switcher in the login header, right side (replaces or sits beside "SECURE ACCESS PORTAL"). | Same spot, compact; the "SECURE ACCESS PORTAL" label may hide below 576px so the switcher fits at 320px. |
| Signed-in screens | Compact switcher in `AppHeader`, right side, before the user block. Shown on every page for every role. | Not in the top bar (no room). Full-width switcher on the Account tab, for **every** role (remove the guard-only condition). |
| Entries page heading | **Remove** the guard-only switcher (the header now has it). | n/a |

The Account page is reachable on mobile from the bottom tab bar and the
avatar in `MobileTopBar`, so every mobile user can reach it in one tap.

## Devanagari typography

- Font stack under `:lang(hi), :lang(mr)`: `Inter, "Noto Sans Devanagari",
  "Nirmala UI", "Mangal", sans-serif`. Use system fonts only (Android ships
  Noto Sans Devanagari, Windows ships Nirmala UI); no web-font download, so
  sites with weak signal are not slowed down.
- Line-height under `:lang(hi), :lang(mr)`: at least 1.5 for body text and
  form controls, at least 1.3 for headings (including the login `h1`, which is
  1.07 today), so matras (ि ी ु ू े ै) are not clipped.
- `letter-spacing: normal` and no `text-transform` on Devanagari text: extra
  spacing breaks conjuncts. Uppercase kickers written in capitals in JSX
  ("GATE OPERATIONS", "WELCOME BACK", "ADMINISTRATION", "NEW VEHICLE PASS",
  "WORKSPACE", "ACCOUNT") become normal-case keys; CSS uppercases them for
  English only.
- 320px: no horizontal scroll, no clipped text, and buttons may wrap to two
  lines but keep the 44px tap target. Bottom tab labels: translated short
  labels for Weighbridge (and any tab that does not fit) via a new
  `shortLabelKey`, replacing the English-only `shortLabel`.

## Edge cases

- **No session yet (login page):** `t()` works without a user; language comes
  from storage only.
- **Shared device:** a guard leaves Marathi on; an admin signing in next sees
  Marathi and can switch in one tap. Accepted by decision 2.
- **Sign-out:** `useSignOut` reads the toast text before logout; this still
  works and now shows in the chosen language. Update the comment there that
  says English is the fallback after sign-out.
- **Session expiry:** toast in the stored language for every role.
- **Several 401s at once:** still one toast (unchanged).
- **Language switched while a toast is visible:** that toast stays in the old
  language; new toasts use the new one. Accepted.
- **Language switched with an error on screen:** the Entry Log error already
  re-translates its fallback at render time (`useEntries`); apply the same
  pattern on the Users page (store the raw `detail` or null, translate the
  fallback at render).
- **Two browser tabs:** listen for the `storage` event so the other tab
  follows the change. Cheap and avoids mixed languages.
- **Missing key in hi/mr:** falls back to English, never shows the raw key.
  A check (script or test) fails the build/test run when the three
  dictionaries do not have the same keys.
- **Role changed by an admin while the user is signed in:** labels re-render
  in the current language; no extra work.
- **Unknown backend `detail` or 422 list:** shown in English (decision 7).
- **Delete confirm:** "Confirm delete" text and its 4-second reset behave the
  same in all languages.
- **Weighbridge deep link `?entry=<id>`:** unaffected by language.
- **Long Marathi strings** in buttons, badges, table headers and the segmented
  Pending / All control: must wrap or fit at 320px and in the desktop table.

## Backend error lookup

New helper (frontend) that takes the axios error, `t` and a fallback key:
`detail` matches a known string → translated key; `detail` is other text →
shown as is; no `detail` → `t(fallbackKey)`. Known strings today:

| Backend `detail` | Source |
|---|---|
| Invalid username or password | `routers/auth.py` |
| Not authenticated / Invalid or expired session | `auth.py` |
| Admin access required | `auth.py` |
| Weighbridge operators cannot register or close out entries | `auth.py` |
| Security guards cannot record weights or upload weighbridge photos | `auth.py` |
| Entry not found / Entry already marked as exited | `routers/entries.py` |
| Photo not found | `routers/uploads.py` |
| At least one active admin is required | `routers/users.py` |
| Username already exists / User not found | `routers/users.py` |
| You cannot deactivate your own account / You cannot change your own role / You cannot delete your own account | `routers/users.py` |
| This user has weighbridge records and cannot be deleted. Deactivate the account instead. | `routers/users.py` |

Risk: if a backend message is reworded, the lookup misses and English shows
(safe failure). Note this in the helper's comment so backend changes update it.

## Strings to translate (by file)

Approximate counts of new keys per language.

| File | What | ~Keys |
|---|---|---|
| `pages/LoginPage.jsx` | Header label, kicker, h1 (two lines), intro, two feature lines, eyebrow, card title, card copy, Username/Password labels and placeholders, "Signing in..." / "Sign in securely", secure note, footer, "GatePass sign in" aria, welcome toast `{name}`, "Login failed" | 20 |
| `components/AppHeader.jsx` | Section/page names (Operations / Vehicle entries, Administration / User management, Profile / Account), "Operations active", role name | 8 |
| `components/Sidebar.jsx` | "WORKSPACE", "Vehicle entries", "User management", "GatePass home", "Main navigation" (use existing `navMain`), role name | 5 |
| `components/MobileTopBar.jsx` | "GatePass home" aria | 0 (shared) |
| `navigation/navItems.js` | Weighbridge and Users tab labels, short labels as keys, shared role-label helper | 4 |
| `pages/AccountPage.jsx` | "ACCOUNT" kicker, role names for all three roles | 3 |
| `pages/EntriesPage.jsx` | "GATE OPERATIONS", page description, "Entry sections" aria, "Filters (n)" placeholder | 3 |
| `components/EntryForm.jsx` | "NEW VEHICLE PASS", "Step n of 2" aria | 2 |
| `components/EntryTable.jsx` | Desktop dates via formatter (no new text) | 0 |
| `components/ProtectedRoute.jsx` | "Loading..." (existing `loading`) | 0 |
| `components/ui/ListState.jsx` | Default empty / clear filters / retry / loading via `t` | 1 |
| `components/ui/Toast.jsx` | Close button aria-label | 1 |
| `pages/UsersPage.jsx` | Kicker, title, description, Add user / Hide form, create card title and copy, 4 placeholders and aria-labels, 3 role options, Saving... / Create User, You, Active / Inactive, Activate / Deactivate, Delete / Confirm delete, Account role, 5 table headers, "Role for {username}", 5 success toasts, 4 failure fallbacks, empty and loading text | 40 |
| `components/WeighbridgeTab.jsx` | Pending badge, Pending / All entries filter and its aria, card caption and 3 detail labels, View details / Record weight / Open, 6 table headers, title and description, 2 empty messages, loading text | 22 |
| `components/WeighbridgeDetail.jsx` | Eyebrow, Close aria, Record vehicle weight, Gross weight, Enter weight, Unit, Saving... / Save weight, Vehicle photos and copy, Upload files, Capture photo, Loading camera..., photo alt, no-photos text, 6 toasts (validation, recorded, failed, uploaded, upload failed, upload busy) | 22 |
| `components/PhotoCapture.jsx` | Capture Photo, Cancel, Capture | 3 |
| `components/QrScanner.jsx` | Default title, Cancel | 2 |
| Backend error lookup | Messages in the table above | 15 |

Total is roughly 150 new keys per language on top of the existing 74.

## File split

Two phases so the two developers never edit the same file. Phase 2 starts
only after phase 1 is merged into the working tree.

**Phase 1 — senior frontend developer (foundation and shell)**

- `src/i18n/languageStorage.js` (new): key, default, safe read/write.
- `src/i18n/translations.js`: becomes a small file that merges per-area
  string modules: `src/i18n/strings/common.js`, `shell.js`, `login.js`,
  `entries.js` (move the existing 74 keys here), `users.js`, `weighbridge.js`.
  Create `users.js` and `weighbridge.js` empty (`en`/`hi`/`mr` objects).
- `src/i18n/apiErrors.js` (new): backend error lookup helper and its keys
  (keys live in `common.js`).
- Key-parity check for the three languages.
- `src/context/LanguageContext.jsx`: remove role rule, placeholders in `t`,
  set `<html lang>`, `storage` event, expose `locale` for dates.
- `src/context/AuthContext.jsx`: session-expired toast uses the shared storage
  helper for all roles.
- `src/utils/formatDate.js`: locale per language, Western digits, plus a
  full date-time formatter for desktop tables.
- `src/components/LanguageSwitcher.jsx`: compact and full variants used in
  three places.
- `src/components/AppHeader.jsx`, `Sidebar.jsx`, `MobileTopBar.jsx`,
  `BottomTabBar.jsx`, `src/navigation/navItems.js` (tab keys,
  `shortLabelKey`, role-label helper).
- `src/pages/LoginPage.jsx`, `src/pages/AccountPage.jsx`,
  `src/pages/EntriesPage.jsx`, `src/hooks/useSignOut.js` (comment only).
- `src/index.css` (Devanagari fonts, line-height, letter-spacing, kickers,
  login header switcher, 320px fixes) and `Frontend/index.html` if needed.
- Owns string modules: `common.js`, `shell.js`, `login.js`.

**Phase 2 — junior frontend developer (screens, following the pattern)**

- `src/pages/UsersPage.jsx` (+ `UsersPage.css` if Devanagari text needs room)
  and string module `src/i18n/strings/users.js`.
- `src/components/WeighbridgeTab.jsx`, `WeighbridgeDetail.jsx`,
  `PhotoCapture.jsx`, `QrScanner.jsx` (+ `WeighbridgeTab.css` if needed) and
  string module `src/i18n/strings/weighbridge.js`.
- `src/components/EntryForm.jsx`, `EntryTable.jsx` (formatter for desktop
  dates) and string module `src/i18n/strings/entries.js` (new keys only).
- `src/components/ProtectedRoute.jsx`, `src/components/ui/ListState.jsx`,
  `src/components/ui/Toast.jsx`.

Backend: none. SQL / data: none.

## Acceptance criteria

- AC1. Given a fresh browser (no stored language), when the login page opens,
  then it is in English, `<html lang="en">`, and the switcher shows English
  selected.
- AC2. Given the login page, when the user picks मराठी, then every visible
  login text, placeholder and the footer is Marathi, `<html lang="mr">`, and
  `localStorage['getpass:language']` is `mr`.
- AC3. Given Marathi is chosen and the password is wrong, when the user signs
  in, then the error toast is the Marathi text for "Invalid username or
  password".
- AC4. Given Hindi is chosen, when an admin signs in, then the welcome toast,
  sidebar, header, Users page, Entries page and Weighbridge screen are all in
  Hindi (repeat for weighbridge operator and security guard on the screens
  their role can open).
- AC5. Given a signed-in user of any role on desktop, then the switcher is in
  the top header on every page, and the Entries heading no longer has its own
  switcher.
- AC6. Given a signed-in user of any role on mobile, when they open the Account
  tab, then the full-width switcher is shown.
- AC7. Given a half-filled New Entry form (or Users create form, or weight
  typed in the weighbridge sheet), when the language changes, then all typed
  values stay and the text around them changes.
- AC8. Given Marathi, then vehicle numbers, names, project names, material
  text, `kg`/`ton` and usernames show exactly as entered, and all numbers and
  dates use 0-9 digits.
- AC9. Given Hindi, then dates on cards and desktop tables show Hindi month
  names in the same format on both, and no screen uses the browser's own
  locale.
- AC10. Given Marathi, when a backend error with a known message occurs (for
  example deleting a user with weighbridge records, or marking an exited
  entry), then the toast is in Marathi; when the message is unknown (a 422
  validation message), then the English text is shown.
- AC11. Given Hindi and a user who signs out, then the sign-out toast and the
  login page are in Hindi.
- AC12. Given Marathi and an expired session on any role, when a request
  returns 401, then exactly one Marathi "session expired" toast appears.
- AC13. Given `localStorage['getpass:language']` is set to `fr` or garbage,
  when the app loads, then it shows English without errors.
- AC14. Given storage is blocked (private mode), when the user switches
  language, then the app changes language for that session without errors.
- AC15. Given Hindi or Marathi at 320px width, then no screen (login, New
  Entry, Entry Log, Weighbridge list and sheet, Users, Account) has
  horizontal scroll, clipped matras or cut-off button/tab labels, and tap
  targets stay at least 44px.
- AC16. Given Hindi or Marathi, then Devanagari text renders in a Devanagari
  font (not boxes) on Android Chrome and Windows Chrome/Edge.
- AC17. Given a screen reader and Marathi, then aria-labels (main navigation,
  entry sections, step indicator, close buttons, role select, weighbridge
  filter, photo alt) are in Marathi.
- AC18. Given two tabs open, when the language changes in one, then the other
  follows without reload.
- AC19. The key-parity check passes: `en`, `hi` and `mr` have identical keys,
  and no screen shows a raw key name.
- AC20. A text search of `src/pages` and `src/components` finds no hard-coded
  user-facing English text left in JSX, except brand, units and the items
  listed as not translated.
- AC21. The Vite build compiles without errors or new warnings.

## Open questions

None blocking. Decisions taken (each can be revisited later):

- Per-device language, not per-user — no backend change; per-user can be
  added later with a `preferred_language` column.
- Western digits in all languages — matches plates and weighbridge displays.
- Unknown backend errors stay English — keeps the failure reason visible.
- System Devanagari fonts, no web font — faster on weak site networks.

## Out of scope

- Translating backend messages on the server or adding error codes to the API.
- Per-user language saved on the server.
- Translating user-entered data or the `html5-qrcode` library's own UI.
- Languages other than English, Hindi and Marathi; right-to-left support.
