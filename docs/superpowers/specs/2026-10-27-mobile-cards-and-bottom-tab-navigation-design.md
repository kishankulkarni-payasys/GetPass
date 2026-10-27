# GatePass — Mobile Cards & Bottom Tab Navigation

## Purpose

Make GatePass feel like a mobile app on phones and tablets:

1. Replace the hamburger + slide-out sidebar with a **bottom tab bar**
   below the `lg` breakpoint.
2. Make every list a **card list** on mobile with one shared card pattern
   (Entry Log, Weighbridge, Users).
3. Turn the Entries page tabs into **real routes**, so the phone back button
   and a page refresh keep the user on the same tab.

Desktop (`lg` and up) keeps today's sidebar, top tabs and tables. No backend
change.

**User story:** As a gate guard, weighbridge operator or admin on a phone, I
want to switch sections with one thumb tap at the bottom of the screen and
read each record as a card, so that I can work at the gate quickly without
opening menus or scrolling sideways through tables.

## Current state (what already exists)

- `Frontend/src/App.jsx` — routes `/login`, `/entries`, `/users` (admin
  only), `*` → `/entries`. Layout: `Sidebar` + `main` (`AppHeader` + content).
- `Frontend/src/components/Sidebar.jsx` — below 992px it renders a dark
  `app-mobile-bar` (brand + hamburger) and a slide-out `app-sidebar` with
  "Vehicle entries", "User management" (admin) and the user block + "Sign
  out". At `lg` it is a static sidebar. Labels are English only.
- `Frontend/src/components/AppHeader.jsx` — also renders below `lg`, so a
  phone shows **two** header bars today (mobile bar + app header).
- `Frontend/src/pages/EntriesPage.jsx` — tabs are local `useState`
  (`new` / `log` / `weighbridge`), filtered by role. Refresh or back always
  returns to the default tab. The language switcher (security_guard only)
  sits in the page heading. Entry Log filters (vehicle search, from/to date,
  Clear, Refresh) are always expanded.
- **Cards already exist below 992px** (`index.css` `@media (max-width:
  991.98px)`):
  - `EntryTable.jsx` — `.entry-mobile-card` (vehicle, status badge, project,
    driver, material, entry time, Mark Exit). **Gap:** the exit time is not
    shown on the mobile card (only in the desktop table).
  - `WeighbridgeTab.jsx` — Bootstrap `d-lg-none` cards (vehicle, weight
    badge / Pending, driver, material, entry, "Open weighbridge details").
    Uses a different (Bootstrap) look from the other two lists.
  - `UsersPage.jsx` — `.user-account-card` (initials, name, @username,
    Active/Inactive, role select, Activate/Deactivate, two-step Delete).
- `WeighbridgeDetail.jsx` — Bootstrap modal; below 576px it is a near
  full-height dialog with safe-area bottom padding.
- Toasts (`ToastContext.jsx`) are fixed top-right.
- `index.html` viewport meta has no `viewport-fit=cover`, so
  `env(safe-area-inset-bottom)` is always 0 on iPhone.
- Loading / empty / error states differ per list (plain text in Entry Log
  and Users, Bootstrap alerts in Weighbridge, no Retry anywhere).
- Note: `package.json` has React 18.3 and both Tailwind 4 and Bootstrap 5.3
  CSS loaded.

So this work is mostly **navigation + routing + making the three card lists
consistent**, not building cards from scratch.

## Decisions

### 1. Breakpoint

- **Mobile layout = viewport width below 992px** (below Tailwind / Bootstrap
  `lg`), the same breakpoint the card/table switch already uses.
- At 992px and up nothing changes visually: sidebar, `AppHeader`, top tabs,
  tables.
- Tablets in portrait (768–991px) get the mobile layout.

### 2. Routes

Tabs become real URLs. One `EntriesPage` element is used for all three entry
sections (route `/entries/:section`) so it stays mounted while switching
tabs and the Entry Log filters are not lost.

| Route | Content | Roles |
|---|---|---|
| `/entries/new` | New Entry form | admin, security_guard |
| `/entries/log` | Entry Log | all |
| `/entries/weighbridge` | Weighbridge list | admin, weighbridge_operator |
| `/users` | User Management | admin |
| `/account` | Account (profile, language, sign out) | all |

Rules:
1. `/entries` (and `*`) redirect to the role's **default tab**: admin and
   security_guard → `/entries/new`; weighbridge_operator → `/entries/log`.
2. A section the role may not use redirects (replace, not push) to the
   role's default tab: e.g. weighbridge_operator on `/entries/new` →
   `/entries/log`; security_guard on `/entries/weighbridge` → `/entries/new`.
   An unknown section (`/entries/foo`) does the same.
3. `/users` keeps its admin-only guard (non-admin → their default tab).
4. Login success and the brand link go to `/entries` (which then redirects).
5. Desktop top tabs use the same routes (they become links), so desktop
   refresh/back also keep the tab.
6. Entering `/entries/log` from another section calls `refresh()` (keeps
   today's "reopening the log shows new entries" behaviour).
7. `/account` also works on desktop (not linked there; harmless).

### 3. Mobile shell (below `lg`)

- **Hamburger and slide-out sidebar are removed on mobile.** The sidebar is
  not rendered below `lg`; the scrim and open/close state go away.
- **One top bar** (replaces both the dark mobile bar and `AppHeader` on
  mobile): brand mark on the left, current page title in the middle/left
  (`New Entry`, `Entry Log`, `Weighbridge`, `Users`, `Account`), user
  initials avatar on the right linking to `/account`. Sticky at the top,
  56px high, `env(safe-area-inset-top)` padding.
- The in-page heading block (kicker, `h1`, description) is hidden on mobile
  because the top bar shows the title. The in-page top tabs
  (`page-tabs`) are hidden on mobile because the bottom bar replaces them.
- **Bottom tab bar** — fixed to the bottom, full width, white background,
  top border + soft shadow, height **56px + `env(safe-area-inset-bottom)`**.
  `index.html` viewport meta gains `viewport-fit=cover`.
- **Content is never hidden behind the bar**: the content wrapper gets
  `padding-bottom: calc(56px + env(safe-area-inset-bottom) + 16px)` on
  mobile. The last card's buttons must be fully tappable above the bar.
- Toasts stay at the top on mobile, full width minus a 16px gutter (today's
  `max-w-sm w-full right-4` can overflow at 320px).
- Not rendered when there is no logged-in user (login page has no bar).

### 4. Tabs per role

Every role gets an **Account** tab, so no role ever has only two tabs.

| Role | Tabs (left → right) | Count |
|---|---|---|
| admin | New Entry · Entry Log · Weighbridge · Users · Account | 5 |
| security_guard | New Entry · Entry Log · Account | 3 |
| weighbridge_operator | Entry Log · Weighbridge · Account | 3 |

Tabs share the bar width equally (`flex: 1`), so 3 tabs are wide and 5 tabs
at 320px are still 64px each.

Icon + label (inline SVG, no new icon library; stroke icons in the same
style as the current sidebar icons):

| Tab | Icon | Label key / text |
|---|---|---|
| New Entry | plus inside a rounded square | `tabNew` |
| Entry Log | clipboard with lines | `tabLog` |
| Weighbridge | scale / weighing platform | "Weighbridge" (English; guards never see it) |
| Users | two people (reuse sidebar icon) | "Users" (English; admin only) |
| Account | person in a circle | `navAccount` |

- Labels are **always visible** (no icon-only tabs), 11–12px, one line,
  ellipsis if too long.
- **Active state:** icon and label in the brand teal, label semibold, plus a
  3px rounded indicator bar at the top edge of the active tab. Inactive:
  slate-500. Colour is not the only signal (indicator + weight).
- A tab is active when the current path starts with its route
  (`/users/...` keeps Users active).
- Tapping the already-active tab scrolls the content to the top.

### 5. Account page (`/account`, new)

- Card with initials avatar, full name, role (role label translated for
  security_guard).
- **Language** section — the existing `LanguageSwitcher`, shown only for
  security_guard (same rule as today). On mobile this is the only place the
  switcher appears; on desktop it stays in the Entries heading.
- **Sign out** button (full width, danger/secondary style, ≥44px). Same
  logout + toast behaviour as the sidebar today; toasts translated for
  security_guard.

### 6. Shared card pattern

One reusable card component (e.g. `components/ui/RecordCard.jsx`) plus one
list-state component (e.g. `components/ui/ListState.jsx`), both built first
and then used by all three lists. The old per-list card CSS
(`.entry-mobile-card`, Bootstrap `weighbridge-entry-card`,
`.user-account-card`) is replaced by it.

Card anatomy (top → bottom):
1. **Header row:** small uppercase caption (optional) + **primary title**
   (largest text, bold, wraps with `overflow-wrap: anywhere`, never
   truncated) on the left; **status badge** on the right (never wraps
   under the title, stays top-right).
2. **Details:** a two-column label/value list (`dl`), label muted, value
   normal; values wrap; empty values show `-`.
3. **Actions row (optional):** full-width buttons, min height 44px; two
   actions sit side by side 50/50 with an 8px gap.

Card: white, 1px border, 12–14px radius, 16px padding, 12px gap between
cards. Card itself is not clickable (only its buttons are) to avoid
accidental taps while scrolling.

List states (same for all three lists):
- **Loading (first load, no data yet):** 3 skeleton cards (grey blocks,
  `aria-busy="true"`, `role="status"` with a visually hidden "Loading…").
- **Refreshing with data on screen:** keep cards visible, dim them slightly
  (today's `entry-results-loading` behaviour).
- **Empty:** centred icon + one-line message (+ "Clear filters" button when
  filters are active).
- **Error:** message (`role="alert"`) + **Retry** button that calls the
  list's refresh.

Dates on cards use a short local format: `27 Oct, 10:42 am`; the year is
added only when it is not the current year.

### 7. Entry Log cards

| Part | Content |
|---|---|
| Title | Vehicle number |
| Badge | `On Site` (blue) or `Exited` (green) |
| Details | Driver · Project (subproject on a second muted line) · Material (+ qty unit) · Entry time · **Exit time** (only when exited; new on mobile) |
| Action | `Mark Exit` — full width, only when not exited **and** role can mark exit (admin, security_guard). While the request runs the button is disabled and reads `Marking exit...`. |

- weighbridge_operator sees the same cards with no action row.
- Order of entries unchanged (whatever the API returns).

**Filters on mobile:**
- The vehicle search box is always visible at the top (full width, `type=
  "search"`, 44px high).
- Next to it a **Filters** button opens a small panel with From / To dates
  and Clear filters. The button shows the active date-filter count, e.g.
  `Filters (2)`. The panel is open by default when a date filter is active.
- Refresh stays as an icon+label button on the same row as Filters.
- Filters survive switching tabs (page stays mounted) but reset on a full
  page reload (no change from today; not stored in the URL).

### 8. Weighbridge cards (English only)

| Part | Content |
|---|---|
| Top of list | Full-width segmented control `Pending` / `All entries` (44px) |
| Title | Vehicle number |
| Badge | `<gross_weight> <unit>` (green) or `Pending` (blue) |
| Details | Driver · Material · Entry time |
| Action | Full width: `Record weight` when pending, `View details` when weighed — both open the detail sheet |

### 9. WeighbridgeDetail on mobile

- Below `lg` it is a **full-screen sheet** (Bootstrap
  `modal-fullscreen-lg-down`), covering the bottom tab bar.
- Sticky header with vehicle number and a 44×44 Close button.
- Weight input + unit + Save stack full width; `inputmode="decimal"` on the
  weight field.
- **Phone back button closes the sheet** instead of leaving the
  Weighbridge tab: opening the sheet pushes `?entry=<id>` on
  `/entries/weighbridge`; back removes it. If the page is loaded with an
  `entry` id that is not in the loaded list, the parameter is dropped
  silently (no error).
- Closing still refreshes the list (today's behaviour).
- Body scroll is locked while the sheet is open.

### 10. Users cards (admin, English only)

| Part | Content |
|---|---|
| Header | Initials avatar · Full name (title) · `@username` muted · badge `Active` (green) / `Inactive` (slate) |
| Details | Labelled `Account role` select (full width, 44px) |
| Actions | `Deactivate`/`Activate` and `Delete` side by side |

- The logged-in admin's own card shows a `You` tag; its select and both
  buttons are disabled (same rule as today).
- Delete stays **two-step**: first tap → `Confirm delete` (4s timeout, then
  reverts); second tap deletes.
- On mobile the "Create a team account" form is **collapsed by default**
  behind an `Add user` button so the user list is visible; it expands
  inline, and collapses again after a successful create.

### 11. Keyboard open on a form

- On mobile, while a text, number, search or date input / textarea /
  select inside the content has focus, the bottom tab bar is hidden, so the
  on-screen keyboard and the form's submit buttons are not covered. It
  reappears on blur.
- The focused field is scrolled into view (`scrollIntoView({ block:
  "center" })`) on focus.

### 12. Translations

New keys in `Frontend/src/i18n/translations.js` (en / hi / mr). Existing keys
`tabNew`, `tabLog` are reused for the tab labels and top bar titles.

| Key | en | hi | mr |
|---|---|---|---|
| `navAccount` | Account | खाता | खाते |
| `navMain` (nav aria-label) | Main navigation | मुख्य नेविगेशन | मुख्य नेव्हिगेशन |
| `labelLanguage` | Language | भाषा | भाषा |
| `labelRole` | Role | भूमिका | भूमिका |
| `roleSecurityGuard` | Security Guard | सुरक्षा गार्ड | सुरक्षा रक्षक |
| `signOut` | Sign out | लॉग आउट | लॉग आउट |
| `toastLoggedOut` | Logged out successfully | सफलतापूर्वक लॉग आउट हो गए | यशस्वीरित्या लॉग आउट झाले |
| `toastLogoutFailed` | Logout failed | लॉग आउट नहीं हो सका | लॉग आउट अयशस्वी |
| `filters` | Filters | फ़िल्टर | फिल्टर |
| `retry` | Retry | फिर से कोशिश करें | पुन्हा प्रयत्न करा |
| `loading` | Loading... | लोड हो रहा है... | लोड होत आहे... |
| `colExit` | Exit | निकास | बाहेर |
| `markingExit` | Marking exit... | एग्ज़िट दर्ज हो रहा है... | बाहेर पडणे नोंदवत आहे... |

Weighbridge and Users strings stay English (those roles never switch
language), consistent with the 2026-08-20 i18n spec.

### 13. Accessibility

- Bottom bar is a `<nav aria-label={t('navMain')}>` of links (not
  `role="tablist"`, because these are page routes). The active link has
  `aria-current="page"` (NavLink provides it).
- Every tap target (tabs, card buttons, Close, filter buttons, segmented
  control) is **at least 44×44px**.
- The bar comes **after** the main content in DOM order; keyboard Tab
  reaches it after the content. Visible focus ring on every tab.
- Icons are `aria-hidden`; the visible label is the accessible name.
- Label and icon contrast ≥ 4.5:1 (active and inactive).
- The detail sheet keeps `role="dialog"`, `aria-modal`, focus moves into it
  on open and returns to the opening button on close; Escape closes it.

## Edge cases

- **Roles with few tabs:** handled by the Account tab (minimum 3).
- **Role changed by an admin while a user is signed in** (their next
  request reloads `user`): tabs re-filter; if they are on a section they
  can no longer use, the redirect rule in section 2 sends them.
- **Long vehicle numbers / names:** title wraps, never truncated; badge
  stays top-right; tab labels ellipsize on one line; hi/mr labels must fit
  at 320px with 3 tabs (they do: "नई एंट्री", "एंट्री लॉग", "खाता").
- **320px width:** no horizontal scroll anywhere; admin's 5 tabs fit.
- **Landscape phone (height < 500px):** bar stays, height reduced to 48px
  with icon and label side by side; content padding follows.
- **Resize / rotate across 992px:** layout switches cleanly; the current
  route stays; no open sidebar state left over.
- **QR scanner and camera** (New Entry, Weighbridge capture) still fit the
  screen above the bar; the bar is hidden behind the full-screen sheet.
- **Session expires on mobile:** user goes to `/login`, bar disappears.
- **Refresh on `/account` or any tab** keeps that page.
- **Network error on a list:** error state with Retry; previous cards are
  not shown with a stale error.

## Acceptance criteria

Mobile = 390×844 (iPhone 14) and 360×800 (Android) unless stated; desktop =
1280×800.

- **AC1.** Given any role on mobile, then there is no hamburger button and
  no slide-out sidebar, and exactly one top bar and one bottom tab bar are
  visible.
- **AC2.** Given admin on mobile, the bottom bar shows exactly New Entry,
  Entry Log, Weighbridge, Users, Account in that order.
- **AC3.** Given security_guard on mobile, the bar shows exactly New Entry,
  Entry Log, Account.
- **AC4.** Given weighbridge_operator on mobile, the bar shows exactly Entry
  Log, Weighbridge, Account.
- **AC5.** When a tab is tapped, the URL changes to that tab's route, the
  tab shows the active style, and only that tab has `aria-current="page"`.
- **AC6.** Given a user on `/entries/log`, when the page is reloaded, then
  Entry Log is still shown and active.
- **AC7.** Given a user who went New Entry → Entry Log → Weighbridge, when
  the phone/browser back button is pressed, then Entry Log is shown, and
  back again shows New Entry.
- **AC8.** Given weighbridge_operator, when they open `/entries/new`, they
  are redirected to `/entries/log`; given security_guard opening
  `/entries/weighbridge` or `/users`, they are redirected to
  `/entries/new`; `/entries` redirects to the role's default tab.
- **AC9.** Given an iPhone with a home indicator (or a simulated
  safe-area inset), the tab bar sits above the home indicator, and the last
  card's action button in a long list can be scrolled fully above the bar
  and tapped.
- **AC10.** Given Entry Log on mobile, each card shows vehicle number,
  status badge, driver, project (+subproject), material (+qty), entry time,
  and exit time when exited.
- **AC11.** Given security_guard or admin, a not-exited card shows Mark
  Exit; tapping it shows `Marking exit...` and disables the button until
  done, then the card shows `Exited` and the exit time. Given
  weighbridge_operator, no card shows Mark Exit.
- **AC12.** Given Entry Log on mobile, the vehicle search is visible; the
  date fields are behind Filters; setting both dates shows `Filters (2)`;
  Clear filters resets them; switching to another tab and back keeps the
  filters.
- **AC13.** Given Weighbridge on mobile, Pending/All is a full-width
  control; a pending card shows a `Pending` badge and `Record weight`; a
  weighed card shows the weight badge and `View details`.
- **AC14.** Given the Weighbridge detail is opened on mobile, it is
  full-screen and covers the tab bar; pressing the phone back button closes
  it and stays on `/entries/weighbridge`; the list refreshes.
- **AC15.** Given Users on mobile (admin), each card shows initials, full
  name, @username, Active/Inactive badge, role select, Activate/Deactivate
  and Delete; the admin's own card is marked `You` with all controls
  disabled; Delete needs two taps within 4 seconds, otherwise it reverts.
- **AC16.** Given Users on mobile, the create form is collapsed behind
  `Add user`; after a successful create it collapses and the new user
  appears in the list.
- **AC17.** Each list shows skeleton cards on first load, an empty message
  when there is no data (with Clear filters when filtered), and an error
  message with a working Retry button when the request fails.
- **AC18.** Given security_guard with Hindi (then Marathi) selected, the
  bottom bar labels, top bar title, Account page, Filters, Retry, Exit
  label and Marking exit text show in that language; no English keys or
  raw key names appear.
- **AC19.** Given security_guard on mobile, the language switcher is on the
  Account page and the choice persists after reload; admin and
  weighbridge_operator see no language switcher.
- **AC20.** Given the Account page, Sign out logs out, shows the toast and
  lands on `/login` with no tab bar.
- **AC21.** Given a text field on New Entry is focused on mobile, the tab
  bar is hidden and the Next / Register Entry buttons are reachable; on
  blur the bar returns.
- **AC22.** Every tab and card button measures at least 44×44px; Tab key
  moves through content then the bar with a visible focus ring.
- **AC23.** At 320px wide (all roles) and in landscape 844×390, there is no
  horizontal scrolling and no content hidden behind the bar.
- **AC24.** At 1280px (and at exactly 992px), the sidebar, top tabs and
  tables look and behave as before, with tabs now linked to the same
  routes; no bottom bar is shown.
- **AC25.** `npm run build` succeeds with no new warnings.

## Open questions (team decides; defaults below are what we build)

1. **Where do Logout / profile / language live?** — *Default: an Account
   tab for every role.* Keeps logout one tap away, gives guards a home for
   the language switcher, and guarantees at least 3 tabs per role.
2. **Should tabs be real routes?** — *Default: yes* (`/entries/:section`,
   `/users`, `/account`). Needed for back button and refresh, and it fixes
   the same problem on desktop.
3. **Confirm before Mark Exit on mobile?** — *Default: no confirm in this
   pass*; the card itself is not tappable and the button is clearly
   separated, which avoids most scroll taps. Revisit if guards report
   accidental exits (there is no "undo exit" today).
4. **Hide the bar while typing?** — *Default: yes*, focus-based (simple,
   testable, works on Android and iOS).
5. **Hindi / Marathi wording** — *Default: ship the table above*; a native
   speaker on site reviews the strings later, changes are text-only.
6. **Collapse the create-user form on mobile?** — *Default: yes*, admins
   mostly manage existing users.
7. **Back button closes the Weighbridge sheet?** — *Default: yes* (via
   `?entry=<id>`); it is what phone users expect.

## Work split (no two developers edit the same file)

**Phase 1 — senior frontend developer (shell + shared pattern + Entry Log).**
Deliver the shared card / list-state components first so the junior can start.

- `Frontend/index.html` — `viewport-fit=cover`.
- `Frontend/src/App.jsx` — new routes, redirects, layout wrapper.
- `Frontend/src/components/ProtectedRoute.jsx` — role/section redirect
  helper (or a new `navigation/navItems.js` with the role → tabs config
  used by both the sidebar and the bottom bar).
- `Frontend/src/components/BottomTabBar.jsx` (new), mobile top bar (new
  component, or inside `AppHeader.jsx`).
- `Frontend/src/components/Sidebar.jsx`, `Frontend/src/components/AppHeader.jsx`.
- `Frontend/src/pages/AccountPage.jsx` (new),
  `Frontend/src/components/LanguageSwitcher.jsx`.
- `Frontend/src/components/ui/RecordCard.jsx`,
  `Frontend/src/components/ui/ListState.jsx` (new; shared pattern).
- `Frontend/src/pages/EntriesPage.jsx` (route-driven tabs, mobile filters),
  `Frontend/src/components/EntryTable.jsx` (Entry Log cards).
- `Frontend/src/context/ToastContext.jsx` (mobile toast width).
- `Frontend/src/i18n/translations.js` (all new keys).
- `Frontend/src/index.css` (shell, bar, card pattern, Entry Log; the senior also
  removes the old `.user-account-*` card rules here once the junior has
  moved Users to the shared pattern).

**Phase 2 — junior frontend developer (follows the pattern).**
Starts once `RecordCard` / `ListState` props are agreed.

- `Frontend/src/components/WeighbridgeTab.jsx` +
  `Frontend/src/components/WeighbridgeTab.css` — cards, segmented control,
  list states, `?entry=` handling.
- `Frontend/src/components/WeighbridgeDetail.jsx` — full-screen sheet,
  sticky header, `inputmode`, focus return.
- `Frontend/src/pages/UsersPage.jsx` — cards, `You` tag, collapsible create
  form, list states. Users-page-only styles go in a new
  `Frontend/src/pages/UsersPage.css` (not `index.css`).

The junior needs no translation keys (Weighbridge and Users stay English).
Backend: none. SQL: none.

## Out of scope

- PWA / install to home screen, offline mode, push notifications.
- Pull-to-refresh, swipe between tabs, swipe actions on cards.
- Translating Login, Weighbridge or Users screens.
- Persisting Entry Log filters in the URL or across reloads.
- Any backend or database change.
- Redesign of the desktop layout.
