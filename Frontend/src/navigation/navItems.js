// Single source for which sections each role may open. Used by the routes,
// the desktop sidebar, the mobile bottom tab bar (and its "More" sheet) and
// the page headers.

export const ROLES = {
  admin: 'admin',
  securityGuard: 'security_guard',
  weighbridgeOperator: 'weighbridge_operator',
  storeIncharge: 'store_incharge',
  siteSupervisor: 'site_supervisor',
  qualityInspector: 'quality_inspector',
}

const ALL_ROLES = Object.values(ROLES)

// Sections shown inside EntriesPage (/entries/:section), so the page and its
// Entry Log filters stay mounted while the user switches between them.
export const ENTRY_SECTIONS = {
  new: 'new',
  log: 'log',
  gateOut: 'gate-out',
  weighbridge: 'weighbridge',
  quality: 'quality',
  grn: 'grn',
}

// Sections with their own top-level route.
export const PAGE_SECTIONS = {
  dashboard: 'dashboard',
  passDetail: 'pass-detail',
  returnPass: 'return-pass',
  users: 'users',
  account: 'account',
}

export const ROUTES = {
  login: '/login',
  entries: '/entries',
  newEntry: '/entries/new',
  entryLog: '/entries/log',
  gateOut: '/entries/gate-out',
  weighbridge: '/entries/weighbridge',
  quality: '/entries/quality',
  grn: '/entries/grn',
  dashboard: '/dashboard',
  passDetail: '/passes/:id',
  returnPass: '/passes/:id/return-pass',
  users: '/users',
  account: '/account',
}

export function passDetailPath(id) {
  return `/passes/${encodeURIComponent(id)}`
}

export function returnPassPath(id) {
  return `${passDetailPath(id)}/return-pass`
}

const SECTION_ROLES = {
  [ENTRY_SECTIONS.new]: [ROLES.admin, ROLES.securityGuard],
  [ENTRY_SECTIONS.log]: ALL_ROLES,
  [ENTRY_SECTIONS.gateOut]: [ROLES.admin, ROLES.securityGuard],
  [ENTRY_SECTIONS.weighbridge]: [ROLES.admin, ROLES.weighbridgeOperator],
  [ENTRY_SECTIONS.quality]: [ROLES.admin, ROLES.qualityInspector],
  [ENTRY_SECTIONS.grn]: [ROLES.admin, ROLES.storeIncharge],
  [PAGE_SECTIONS.dashboard]: [ROLES.admin, ROLES.storeIncharge, ROLES.siteSupervisor],
  [PAGE_SECTIONS.passDetail]: ALL_ROLES,
  [PAGE_SECTIONS.returnPass]: [ROLES.admin, ROLES.securityGuard, ROLES.storeIncharge],
  [PAGE_SECTIONS.users]: [ROLES.admin],
  [PAGE_SECTIONS.account]: ALL_ROLES,
}

// Sidebar groups, in display order.
export const NAV_GROUPS = {
  operations: 'operations',
  overview: 'overview',
  administration: 'administration',
}

const NAV_GROUP_LABEL_KEYS = {
  [NAV_GROUPS.operations]: 'navGroupOperations',
  [NAV_GROUPS.overview]: 'navGroupOverview',
  [NAV_GROUPS.administration]: 'navGroupAdministration',
}

// Order here is the left-to-right order of the bottom tab bar (and the
// sidebar order inside each group); it gives every role the tab order the
// spec lists (guard: Gate-in, Gate-out, Log, Account; store: GRN, Dashboard,
// Log, Account; ...).
// `labelKey` is the translation key of the tab name; `descriptionKey` the
// line under the page title. `shortLabelKey` (optional) replaces the name in
// the bottom bar below 430px, for names that do not fit there in every language.
const TAB_ITEMS = [
  { id: ENTRY_SECTIONS.new, to: ROUTES.newEntry, labelKey: 'tabGateIn', descriptionKey: 'sectionGateInDescription', icon: 'new', group: NAV_GROUPS.operations },
  { id: ENTRY_SECTIONS.gateOut, to: ROUTES.gateOut, labelKey: 'tabGateOut', descriptionKey: 'sectionGateOutDescription', icon: 'gateOut', group: NAV_GROUPS.operations },
  { id: ENTRY_SECTIONS.weighbridge, to: ROUTES.weighbridge, labelKey: 'tabWeighbridge', shortLabelKey: 'tabWeighbridgeShort', descriptionKey: 'sectionWeighbridgeDescription', icon: 'weighbridge', group: NAV_GROUPS.operations },
  { id: ENTRY_SECTIONS.quality, to: ROUTES.quality, labelKey: 'tabQuality', descriptionKey: 'sectionQualityDescription', icon: 'quality', group: NAV_GROUPS.operations },
  { id: ENTRY_SECTIONS.grn, to: ROUTES.grn, labelKey: 'tabGrn', shortLabelKey: 'tabGrnShort', descriptionKey: 'sectionGrnDescription', icon: 'grn', group: NAV_GROUPS.operations },
  { id: PAGE_SECTIONS.dashboard, to: ROUTES.dashboard, labelKey: 'tabDashboard', descriptionKey: 'sectionDashboardDescription', icon: 'dashboard', group: NAV_GROUPS.overview },
  { id: ENTRY_SECTIONS.log, to: ROUTES.entryLog, labelKey: 'tabLog', descriptionKey: 'sectionLogDescription', icon: 'log', group: NAV_GROUPS.operations },
  { id: PAGE_SECTIONS.users, to: ROUTES.users, labelKey: 'tabUsers', icon: 'users', group: NAV_GROUPS.administration },
  // Account sits in the sidebar footer on desktop, so it has no group.
  { id: PAGE_SECTIONS.account, to: ROUTES.account, labelKey: 'navAccount', icon: 'account' },
]

// The bottom bar fits five tabs at 320px. A role with more sections keeps
// four and puts the rest under "More", choosing the four in this order
// (only admin has more than five today).
export const MAX_BOTTOM_TABS = 5
const BOTTOM_BAR_PRIORITY = [
  PAGE_SECTIONS.dashboard,
  ENTRY_SECTIONS.new,
  ENTRY_SECTIONS.log,
  ENTRY_SECTIONS.grn,
  ENTRY_SECTIONS.gateOut,
  ENTRY_SECTIONS.weighbridge,
  ENTRY_SECTIONS.quality,
  PAGE_SECTIONS.users,
  PAGE_SECTIONS.account,
]

// Where each role lands after sign-in and on unknown paths.
const HOME_SECTION_BY_ROLE = {
  [ROLES.admin]: PAGE_SECTIONS.dashboard,
  [ROLES.securityGuard]: ENTRY_SECTIONS.new,
  [ROLES.weighbridgeOperator]: ENTRY_SECTIONS.weighbridge,
  [ROLES.qualityInspector]: ENTRY_SECTIONS.quality,
  [ROLES.storeIncharge]: ENTRY_SECTIONS.grn,
  [ROLES.siteSupervisor]: PAGE_SECTIONS.dashboard,
}

const ROLE_LABEL_KEYS = {
  [ROLES.admin]: 'roleAdmin',
  [ROLES.securityGuard]: 'roleSecurityGuard',
  [ROLES.weighbridgeOperator]: 'roleWeighbridgeOperator',
  [ROLES.storeIncharge]: 'roleStoreIncharge',
  [ROLES.siteSupervisor]: 'roleSiteSupervisor',
  [ROLES.qualityInspector]: 'roleQualityInspector',
}

export function canOpenSection(role, section) {
  return Boolean(SECTION_ROLES[section]?.includes(role))
}

export function isEntrySection(section) {
  return Object.values(ENTRY_SECTIONS).includes(section)
}

function tabById(id) {
  return TAB_ITEMS.find((tab) => tab.id === id)
}

// A role the frontend does not know (or a role without access to its home)
// falls back to the Log, which every role can open.
export function defaultRouteForRole(role) {
  const homeSection = HOME_SECTION_BY_ROLE[role]
  if (homeSection && canOpenSection(role, homeSection)) return tabById(homeSection).to
  return ROUTES.entryLog
}

export function tabsForRole(role) {
  return TAB_ITEMS.filter((tab) => canOpenSection(role, tab.id))
}

// { visible, overflow }: `overflow` is empty when every tab fits.
export function bottomTabsForRole(role) {
  const tabs = tabsForRole(role)
  if (tabs.length <= MAX_BOTTOM_TABS) return { visible: tabs, overflow: [] }

  const visibleCount = MAX_BOTTOM_TABS - 1
  const ranked = [...tabs].sort((a, b) => BOTTOM_BAR_PRIORITY.indexOf(a.id) - BOTTOM_BAR_PRIORITY.indexOf(b.id))
  return { visible: ranked.slice(0, visibleCount), overflow: ranked.slice(visibleCount) }
}

// [{ group, labelKey, tabs }] for the desktop sidebar; empty groups are left out.
export function sidebarGroupsForRole(role) {
  const tabs = tabsForRole(role)
  return Object.values(NAV_GROUPS)
    .map((group) => ({ group, labelKey: NAV_GROUP_LABEL_KEYS[group], tabs: tabs.filter((tab) => tab.group === group) }))
    .filter(({ tabs: groupTabs }) => groupTabs.length > 0)
}

export function tabLabel(tab, t) {
  return t(tab.labelKey)
}

export function tabShortLabel(tab, t) {
  return tab.shortLabelKey ? t(tab.shortLabelKey) : null
}

export function tabDescription(tab, t) {
  return tab.descriptionKey ? t(tab.descriptionKey) : null
}

export function navGroupLabelKey(group) {
  return NAV_GROUP_LABEL_KEYS[group]
}

// The stored role value never changes; only its display name is translated.
// A role the frontend does not know yet still shows readably.
export function roleLabel(role, t) {
  const key = ROLE_LABEL_KEYS[role]
  return key ? t(key) : String(role ?? '').replaceAll('_', ' ')
}

// Every role, in display order, for role pickers (Users page).
export const ROLE_OPTIONS = ALL_ROLES

// The tab whose route the current path starts with ("/users/x" keeps Users active).
export function findActiveTab(tabs, pathname) {
  return tabs.find((tab) => pathname === tab.to || pathname.startsWith(`${tab.to}/`))
}

const PASS_PATH_PREFIX = '/passes/'
const RETURN_PASS_SUFFIX = '/return-pass'

// Translation keys for the header breadcrumb / mobile title of the current
// path: { groupKey, titleKey }. Paths outside the menu (pass detail) are
// matched by shape; anything else falls back to the brand title (null keys).
export function pageTitleKeys(role, pathname) {
  const tab = findActiveTab(tabsForRole(role), pathname)
  if (tab) return { groupKey: tab.group ? NAV_GROUP_LABEL_KEYS[tab.group] : 'headerSectionProfile', titleKey: tab.labelKey }
  if (pathname.startsWith(PASS_PATH_PREFIX)) {
    const titleKey = pathname.endsWith(RETURN_PASS_SUFFIX) ? 'navReturnPass' : 'navPassDetail'
    return { groupKey: NAV_GROUP_LABEL_KEYS[NAV_GROUPS.operations], titleKey }
  }
  return { groupKey: null, titleKey: null }
}

export function initialsOf(fullName = '') {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}
