// Single source for which sections each role may open. Used by the routes,
// the desktop sidebar, the Entries top tabs and the mobile bottom tab bar.

export const ROLES = {
  admin: 'admin',
  securityGuard: 'security_guard',
  weighbridgeOperator: 'weighbridge_operator',
}

export const ENTRY_SECTIONS = {
  new: 'new',
  log: 'log',
  weighbridge: 'weighbridge',
}

export const ROUTES = {
  login: '/login',
  entries: '/entries',
  newEntry: '/entries/new',
  entryLog: '/entries/log',
  weighbridge: '/entries/weighbridge',
  users: '/users',
  account: '/account',
}

const SECTION_ROLES = {
  [ENTRY_SECTIONS.new]: [ROLES.admin, ROLES.securityGuard],
  [ENTRY_SECTIONS.log]: [ROLES.admin, ROLES.securityGuard, ROLES.weighbridgeOperator],
  [ENTRY_SECTIONS.weighbridge]: [ROLES.admin, ROLES.weighbridgeOperator],
}

// Order here is the left-to-right order of the bottom tab bar.
// `labelKey` is the translation key of the tab name.
// `shortLabelKey` (optional) replaces it in the bottom bar on screens narrower
// than 430px, for tabs whose name does not fit there in every language.
const TAB_ITEMS = [
  { id: 'new', to: ROUTES.newEntry, labelKey: 'tabNew', icon: 'new', roles: SECTION_ROLES.new },
  { id: 'log', to: ROUTES.entryLog, labelKey: 'tabLog', icon: 'log', roles: SECTION_ROLES.log },
  { id: 'weighbridge', to: ROUTES.weighbridge, labelKey: 'tabWeighbridge', shortLabelKey: 'tabWeighbridgeShort', icon: 'weighbridge', roles: SECTION_ROLES.weighbridge },
  { id: 'users', to: ROUTES.users, labelKey: 'tabUsers', icon: 'users', roles: [ROLES.admin] },
  { id: 'account', to: ROUTES.account, labelKey: 'navAccount', icon: 'account', roles: Object.values(ROLES) },
]

const ROLE_LABEL_KEYS = {
  [ROLES.admin]: 'roleAdmin',
  [ROLES.securityGuard]: 'roleSecurityGuard',
  [ROLES.weighbridgeOperator]: 'roleWeighbridgeOperator',
}

export function canOpenSection(role, section) {
  return Boolean(SECTION_ROLES[section]?.includes(role))
}

export function defaultRouteForRole(role) {
  return canOpenSection(role, ENTRY_SECTIONS.new) ? ROUTES.newEntry : ROUTES.entryLog
}

export function tabsForRole(role) {
  return TAB_ITEMS.filter((tab) => tab.roles.includes(role))
}

export function entrySectionTabsForRole(role) {
  return tabsForRole(role).filter((tab) => Object.values(ENTRY_SECTIONS).includes(tab.id))
}

export function tabLabel(tab, t) {
  return t(tab.labelKey)
}

export function tabShortLabel(tab, t) {
  return tab.shortLabelKey ? t(tab.shortLabelKey) : null
}

// The stored role value never changes; only its display name is translated.
// A role the frontend does not know yet still shows readably.
export function roleLabel(role, t) {
  const key = ROLE_LABEL_KEYS[role]
  return key ? t(key) : String(role ?? '').replaceAll('_', ' ')
}

// The tab whose route the current path starts with ("/users/x" keeps Users active).
export function findActiveTab(tabs, pathname) {
  return tabs.find((tab) => pathname === tab.to || pathname.startsWith(`${tab.to}/`))
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
