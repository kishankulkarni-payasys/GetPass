# Breadcrumbs navigation: design spec

Date: 2026-10-30
Status: ready to build (frontend only, no backend or data change)

## 1. Requirement

Show a breadcrumb trail on every signed-in page, so users always see where
they are (for example *Home > Entry Log > MH12AB1234 > Return out-pass*) and
can jump back to a parent page in one click, without links to pages their
role cannot open.

## 2. User stories

- As a **security guard**, I want to see that I am on a pass's details, below
  the Entry Log, and go back to the Log in one tap, so I don't hunt in the menu.
- As a **store incharge** in the GRN editor, I want the trail to show the GRN
  list and the vehicle I am working on, so I can return to the list quickly.
- As **any role** on a return out-pass, I want a link back to the pass it
  belongs to, so I can check the pass without using browser Back.
- As a **phone user**, I want a simple back arrow on detail pages that does not
  clash with the bottom tab bar, so the screen stays uncluttered.
- As a **Hindi or Marathi user**, I want the trail in my language, so I can
  read it like the rest of the app.
- As a **screen-reader user**, I want the trail announced as a breadcrumb
  navigation with the current page marked, so I know my position.

## 3. Current behaviour

- Router: `BrowserRouter` + `<Routes>` in `Frontend/src/App.jsx` (not a data
  router, so `useMatches()` / route `handle` are **not** available).
- Routes and role access live in `Frontend/src/navigation/navItems.js`
  (`ROUTES`, `SECTION_ROLES`, `canOpenSection`, `defaultRouteForRole`,
  `tabsForRole`, `findActiveTab`, `pageTitleKeys`).
- `/entries/:section` is one route for Gate-in (`new`), Entry Log (`log`),
  Gate-out, Weighbridge, Quality and GRN (`EntriesPage.jsx`). Top-level pages:
  `/dashboard`, `/passes/:id`, `/passes/:id/return-pass`, `/users`, `/account`.
- Sub-views held in the query string: Weighbridge `?entry=<id>` opens a modal
  sheet (`WeighbridgeDetail`, `role="dialog"`); GRN `?pass=<id>` replaces the
  list with the GRN editor (`GrnEditor`). Gate-out and Quality sheets are
  local state with no URL.
- Desktop header (`AppHeader.jsx`, 992px and up) already shows static text
  "*group* / *page*" (`app-header-context`) from `pageTitleKeys`. Nothing in
  it is a link.
- Mobile (below 992px): `MobileTopBar.jsx` shows the brand mark (link to
  `/entries`), the page title (h1) and an account avatar; `BottomTabBar.jsx`
  is the main navigation; `PageHeading` is hidden on phones.
- Unknown paths (`*`) and unknown or forbidden sections redirect to the role's
  home; there is no 404 page.
- Passes have no "pass number". Users recognise a pass by its **vehicle
  number** (`pass.vehicle_number`, max 20 chars). The return out-pass has
  `grn.return_pass_number`.
- i18n: string modules in `Frontend/src/i18n/strings/*.js` (en/hi/mr), checked
  by `npm run check:i18n` (runs before build). Shell texts live in `shell.js`.
- Print: `@media print` in `index.css` hides `.app-header`, `.mobile-top-bar`
  and anything with `.no-print`.

## 4. Business rules

1. **Shape of the trail**: `Home > Section > Detail > Sub-page`. The sidebar
   group ("Gate operations", "Overview", "Administration") is **not** a crumb,
   because it is not a page. The page kicker in `PageHeading` keeps showing it.
2. **Home crumb**: label "Home" with a house icon, links to
   `defaultRouteForRole(role)`. When the trail's section crumb *is* the role's
   home (a guard on Gate-in, an admin on Dashboard, a store incharge on GRN or
   in the GRN editor), the Home crumb is left out, so two crumbs never point
   at the same page and "Home" never points at the page you are on.
3. **Hierarchy, not history**: the trail is built from the URL, never from
   where the user came from. Pass detail always sits under **Entry Log**,
   whether it was opened from the Log, Dashboard, GRN editor, Gate-in success
   or OCR review. (Entry Log and pass detail are open to every role, so this
   parent is always valid.)
4. **Links**: every ancestor crumb is a link; the last crumb is plain text
   with `aria-current="page"`. The current page is never a link.
5. **Role rule**: a crumb is a link only if `canOpenSection(role, section)` is
   true for its target. If not, it is shown as plain text (no link). Today no
   trail hits this case, but the builder must check it so future routes stay safe.
6. **Dynamic labels**: on pass detail, return out-pass and GRN editor the pass
   crumb shows the vehicle number once the pass is loaded. While loading, or
   if loading fails (404, network), it shows the generic label ("Pass details",
   or "GRN" editor title) — never a blank crumb, never a spinner, never the raw id.
   A label from a previous pass must never show on another pass.
7. **Modal sheets are not crumbs**: Weighbridge `?entry=`, Gate-out exit and
   cancel sheets, Quality result form. They are dialogs over the list with
   their own Close; the trail stays on the section. The **GRN editor** is a
   crumb, because it replaces the page content.
8. **Desktop (992px and up)**: the full trail replaces the static
   "group / page" text in `AppHeader`.
9. **Mobile (below 992px)**: no full trail. On detail-level pages only (pass
   detail, return out-pass, GRN editor), the brand mark in `MobileTopBar` is
   replaced by a back-arrow link to the **parent crumb** (accessible name
   "Back to <parent>"). The top-bar title stays as today. Section pages keep
   the brand mark; the bottom tab bar already covers them.
10. **Entry Log filters survive**: going back to Entry Log through a crumb
    keeps the filters (they live in `EntryLogFiltersContext`, which wraps all
    routes). No change needed, but it must be tested.
11. **Not printed**: the trail and back arrow never appear on the printed
    return out-pass.
12. **Signed-out**: no breadcrumb on the Login page.
13. **Translations**: all crumb labels and aria texts come from `t()`. User
    data (vehicle numbers) and the brand are not translated.

## 5. Route to crumb table

`H` = Home crumb (left out when the section crumb is the role's home, rule 2).
Labels are translation keys unless marked *data*.

| Route | Trail (last = current, plain text) | Mobile back arrow to |
|---|---|---|
| `/login` | none | none |
| `/entries` | redirects to role home; no own trail | none |
| `/entries/new` | H > `tabGateIn` | none (brand mark) |
| `/entries/log` | H > `tabLog` | none |
| `/entries/gate-out` (+ exit/cancel sheet) | H > `tabGateOut` | none |
| `/entries/weighbridge` and `?entry=<id>` | H > `tabWeighbridge` | none |
| `/entries/quality` (+ result form) | H > `tabQuality` | none |
| `/entries/grn` | H > `tabGrn` | none |
| `/entries/grn?pass=<id>` | H > `tabGrn` (link `/entries/grn`) > *vehicle number* (fallback `grnEditorTitle`) | `/entries/grn` "Back to GRN" |
| `/dashboard` | H > `tabDashboard` | none |
| `/passes/:id` | H > `tabLog` (link `/entries/log`) > *vehicle number* (fallback `navPassDetail`) | `/entries/log` "Back to Entry Log" |
| `/passes/:id/return-pass` | H > `tabLog` (link) > *vehicle number* (link `/passes/:id`, fallback `navPassDetail`) > `navReturnPass` | `/passes/:id` "Back to <vehicle number or Pass details>" |
| `/users` | H > `tabUsers` | none |
| `/account` | H > `navAccount` | none |
| unknown `/entries/x`, forbidden section, `*` | redirect to role home, which shows its own trail | none |

Examples:
- Guard on `/passes/42/return-pass`: **Home > Entry Log > MH12AB1234 > Return out-pass**.
- Admin on `/dashboard` (admin home): **Dashboard** (single crumb).
- Store incharge on `/entries/grn?pass=42`: **GRN > MH12AB1234** (GRN is this
  role's home, so no Home crumb; GRN is a link because it is an ancestor).
- Admin on `/entries/grn?pass=42`: **Home > GRN > MH12AB1234**.

## 6. Edge cases

- **Pass not found / no access** (`/passes/99999`, `/passes/abc`): trail is
  H > Entry Log > "Pass details"; page shows its existing error banner.
- **Loading**: generic label first, swaps to the vehicle number with no layout
  jump bigger than the text change; no flicker back to generic on `reload()`
  after an action (reload keeps the old pass).
- **Navigating pass A to pass B** (e.g. Back then open another pass): crumb
  must show B's label or the generic label, never A's (rule 6).
- **Return out-pass without a return pass** (`returnPassNone`): trail still
  shows; vehicle number comes from the pass detail it loads.
- **Long labels**: each crumb truncates with an ellipsis at about 16rem
  (`max-width` + `text-overflow: ellipsis`), full text in `title`. The current
  crumb gets the most room; middle crumbs shrink first. Hindi/Marathi labels
  are longer; check at 992px width.
- **Role change while signed in** (admin edits a user's role): routes already
  redirect; the trail is rebuilt from the new role on the next render.
- **Unknown role**: home falls back to Entry Log (`defaultRouteForRole`), so
  the Home crumb links there.
- **Offline**: trail is client-side only; works offline. A pass still in the
  offline gate-in queue has no detail page; nothing to do.
- **Keyboard typing on mobile**: the bottom bar hides while typing; the top-bar
  back arrow stays and is unaffected.
- **Language switch** on a detail page: labels re-translate at once; vehicle
  number unchanged.
- **Print** of return out-pass: no trail, no back arrow.

## 7. Implementation shape

The router is `BrowserRouter`, so route `handle` / `useMatches()` cannot be
used. Use a **central, pure trail builder** next to the existing route config,
plus one small context for the dynamic label.

1. `buildBreadcrumbTrail(role, pathname, search)` (pure, no React) returns
   `[{ id, labelKey | dynamicKind, fallbackKey, to | null }]`. It reuses
   `findActiveTab`, `tabsForRole`, `canOpenSection`, `defaultRouteForRole`,
   `passDetailPath`. Applies rules 2, 4, 5 and the table above.
   `parentCrumb(trail)` returns the crumb before the last one (or null) for the
   mobile back arrow; it is non-null only for detail-level routes.
2. `BreadcrumbProvider` + `useBreadcrumbDetail(passId, label)`: the page that
   owns the data publishes `{ passId, label }`; it clears on unmount. The
   component uses the label only when `passId` matches the id in the current
   URL (`:id` or `?pass=`), which satisfies rule 6.
3. `<Breadcrumbs />`: renders
   `<nav aria-label={t('breadcrumbNav')}><ol>…</ol></nav>`; links with
   `<Link>`; separators are `aria-hidden="true"` chevrons drawn in CSS or an
   inline SVG; last item `aria-current="page"`; home item has the house icon
   (`aria-hidden`) plus visible text. Class `no-print`.
4. Mount: inside `AppHeader` in place of the `app-header-context` block
   (desktop). In `MobileTopBar`, when `parentCrumb` is non-null, render a back
   link (chevron icon, `aria-label={t('breadcrumbBackTo', { page })}`, 44x44px
   target) in the brand-mark slot.
5. `pageTitleKeys` stays (MobileTopBar title uses it). Once AppHeader no longer
   needs the group key, leave the function as it is; no other screen breaks.

### New translation keys (`Frontend/src/i18n/strings/shell.js`, all three languages)

| Key | en | hi | mr |
|---|---|---|---|
| `breadcrumbNav` | Breadcrumb | पेज का रास्ता | पृष्ठाचा मार्ग |
| `breadcrumbHome` | Home | होम | मुख्यपृष्ठ |
| `breadcrumbBackTo` | Back to {page} | {page} पर वापस जाएँ | {page} वर परत जा |

Reuse existing keys for everything else: `tabGateIn`, `tabLog`, `tabGateOut`,
`tabWeighbridge`, `tabQuality`, `tabGrn`, `tabDashboard`, `tabUsers`,
`navAccount`, `navPassDetail`, `navReturnPass`, `grnEditorTitle`. Use the
full `labelKey` of tabs, never the `shortLabelKey`.

### File plan

New files:
- `Frontend/src/navigation/breadcrumbs.js` — `buildBreadcrumbTrail`, `parentCrumb`.
- `Frontend/src/context/BreadcrumbContext.jsx` — provider and `useBreadcrumbDetail`.
- `Frontend/src/components/Breadcrumbs.jsx` — the desktop trail.
- `Frontend/src/components/Breadcrumbs.css` — trail, truncation and mobile
  back-arrow styles (own file so `index.css`, which is being edited for the
  Gate-in camera work, is not touched).

Edited files:
- `Frontend/src/App.jsx` — wrap the layout in `BreadcrumbProvider`.
- `Frontend/src/components/AppHeader.jsx` — replace the static context block with `<Breadcrumbs />`.
- `Frontend/src/components/MobileTopBar.jsx` — back arrow on detail-level pages.
- `Frontend/src/components/NavIcon.jsx` — add `home` and `back` (chevron) paths.
- `Frontend/src/pages/PassDetailPage.jsx` — publish `pass.vehicle_number`.
- `Frontend/src/pages/ReturnPassPage.jsx` — publish `detail.vehicle_number`.
- `Frontend/src/components/GrnEditor.jsx` — publish `pass.vehicle_number`.
- `Frontend/src/i18n/strings/shell.js` — three new keys in en, hi, mr.

Do **not** touch: `GateInCaptureTiles.jsx`, `TakePhotoButton.jsx`,
`CameraCaptureDialog.jsx`, `useCameraStream.js`, `useObjectUrl.js`,
`captureVideoFrame.js`, `ui/Button.jsx`, `i18n/strings/gateIn.js`, `index.css`
(all in progress for the Gate-in camera fix). If an existing `index.css` rule
for `.app-header-eyebrow` / `.app-header-divider` / `.app-header-page` becomes
unused, leave it for a later clean-up rather than editing `index.css` now.

Build check: `npm run build` in `Frontend/` (runs `check:i18n` first).

## 8. Acceptance criteria

- AC1. Given a security guard on `/entries/new` (desktop), then the header
  shows a single crumb "Gate-in" with `aria-current="page"` and no Home crumb.
- AC2. Given a security guard on `/entries/log` (desktop), then the trail is
  "Home > Entry Log"; "Home" links to `/entries/new`; "Entry Log" is plain text.
- AC3. Given any role opens a pass from the Log, Dashboard, GRN editor or
  Gate-in success link, then the trail is "Home > Entry Log > <vehicle number>"
  in every case (hierarchy, not history).
- AC4. Given pass detail is loading, then the last crumb reads "Pass details";
  when loaded it reads the vehicle number.
- AC5. Given `/passes/999999` (not found) or `/passes/abc`, then the trail is
  "Home > Entry Log > Pass details" and the page error banner shows; no crash,
  no blank crumb.
- AC6. Given pass A was opened, then the user opens pass B, then at no time
  does B's trail show A's vehicle number.
- AC7. Given `/passes/:id/return-pass`, then the trail is
  "Home > Entry Log > <vehicle number> > Return out-pass", and the vehicle-number
  crumb links to `/passes/:id`.
- AC8. Given a store incharge on `/entries/grn?pass=<id>`, then the trail is
  "GRN > <vehicle number>" with "GRN" linking to `/entries/grn`; clicking it
  shows the GRN list. For an admin on the same URL the trail is
  "Home > GRN > <vehicle number>".
- AC9. Given an admin on `/entries/weighbridge?entry=<id>` with the sheet open,
  then the trail is "Home > Weighbridge" (no extra crumb for the sheet).
- AC10. Given each of the six roles, on every page they can open, then no
  crumb links to a section that role cannot open (`canOpenSection` false).
- AC11. Given admin on `/dashboard` and on `/users`, then the trails are
  "Dashboard" and "Home > Users"; for `/account`, "Home > Account".
- AC12. Given the Entry Log with a vehicle filter set, when the user opens a
  pass and clicks the "Entry Log" crumb, then the Log shows with the same filter.
- AC13. Given the language is Hindi or Marathi, then every crumb label, the nav
  `aria-label` and the mobile back-arrow name are in that language; vehicle
  numbers are unchanged; switching language updates the trail without reload.
- AC14. Given a screen reader, then the trail is a `nav` landmark named
  "Breadcrumb" (translated), items are in an ordered list, separators are not
  read, and the last item is announced as the current page.
- AC15. Given keyboard only, then Tab reaches each linked crumb in order with a
  visible focus ring, and Enter follows the link; the current crumb is not focusable.
- AC16. Given a label longer than the crumb width (Hindi/Marathi at 992px),
  then it ends in an ellipsis, the full text shows on hover (`title`), and the
  header does not wrap to two lines or overlap the account area.
- AC17. Given a phone width (360px) on a section page (Log, Gate-in, GRN list,
  Dashboard), then no breadcrumb and no back arrow show; the brand mark shows
  as today; the bottom tab bar is unchanged.
- AC18. Given a phone on pass detail, return out-pass or GRN editor, then the
  top bar shows a back arrow (at least 44x44px) instead of the brand mark,
  linking to the parent from the table, with the accessible name
  "Back to <parent>"; the title stays as today.
- AC19. Given the return out-pass is printed, then no trail or back arrow
  appears on paper.
- AC20. Given the Login page or a signed-out user, then no breadcrumb renders.
- AC21. Given an unknown path (`/foo`, `/entries/xyz`) or a forbidden section,
  then the user lands on the role home and sees that page's trail; no error.
- AC22. Given `npm run build` in `Frontend/`, then the i18n check and build
  pass, and the Gate-in camera files listed in section 7 are unchanged by this work.

## 9. Test split (two testers, no overlap)

Tester A: trail content and rules
- AC1, AC2, AC3, AC4, AC5, AC6, AC7, AC8, AC9, AC10, AC11, AC12, AC21
- Walk all six roles through every page they can open (use the table in section 5).

Tester B: presentation, language, accessibility, mobile, print, build
- AC13, AC14, AC15, AC16, AC17, AC18, AC19, AC20, AC22
- Widths: 360px, 430px, 991px, 992px, 1280px. Languages: en, hi, mr.

## 10. Open questions

None. All design decisions are made above (group not a crumb; hierarchy not
history; vehicle number as the pass label; modal sheets not crumbs; mobile
back arrow on detail pages only).

## 11. Out of scope

- A real 404 page (unknown paths keep redirecting to the role home).
- Changing the in-page back buttons in the GRN editor and return out-pass.
- Turning modal sheets (Weighbridge, Gate-out, Quality) into routes.
- Moving to a data router (`createBrowserRouter`).
- Backend or database changes.
