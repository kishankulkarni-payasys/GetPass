// Breadcrumb trail for the current URL. The trail follows the page hierarchy,
// never the browser history: a pass always sits under the Entry Log, wherever
// it was opened from. Pure functions (no React) so the rules stay testable.
import {
  ENTRY_SECTIONS,
  PAGE_SECTIONS,
  canOpenSection,
  defaultRouteForRole,
  findActiveTab,
  passDetailPath,
  tabsForRole,
} from './navItems'

// Crumbs whose label is user data (the vehicle number) published by the page.
export const DYNAMIC_CRUMB_KINDS = { pass: 'pass' }

const HOME_CRUMB_ID = 'home'
const PASS_CRUMB_ID = 'pass'
const RETURN_PASS_CRUMB_ID = 'return-pass'
const GRN_PASS_PARAM = 'pass'
const PASS_PATH_PATTERN = /^\/passes\/([^/]+)(\/return-pass)?\/?$/

// A malformed escape in a hand-typed URL must not break the header; the raw
// segment is still a usable id to compare against.
function decodePathSegment(segment) {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

function sectionCrumb(tab) {
  return { id: tab.id, labelKey: tab.labelKey, section: tab.id, target: tab.to }
}

function passCrumb(passId, fallbackKey, section) {
  return {
    id: PASS_CRUMB_ID,
    dynamicKind: DYNAMIC_CRUMB_KINDS.pass,
    passId,
    fallbackKey,
    section,
    target: passDetailPath(passId),
    isDetail: true,
  }
}

// /passes/:id and /passes/:id/return-pass, both under the Entry Log (open to
// every known role; a role without it gets no trail).
function passTrail(roleTabs, match) {
  const logTab = roleTabs.find((tab) => tab.id === ENTRY_SECTIONS.log)
  if (!logTab) return []
  const passId = decodePathSegment(match[1])
  const trail = [sectionCrumb(logTab), passCrumb(passId, 'navPassDetail', PAGE_SECTIONS.passDetail)]
  if (!match[2]) return trail
  const returnCrumb = { id: RETURN_PASS_CRUMB_ID, labelKey: 'navReturnPass', section: PAGE_SECTIONS.returnPass, isDetail: true }
  return [...trail, returnCrumb]
}

// Section pages from the menu; the GRN editor (?pass=<id>) adds the pass crumb.
function sectionTrail(roleTabs, pathname, search) {
  const tab = findActiveTab(roleTabs, pathname)
  if (!tab) return []
  const editorPassId = tab.id === ENTRY_SECTIONS.grn ? new URLSearchParams(search).get(GRN_PASS_PARAM) : null
  if (!editorPassId) return [sectionCrumb(tab)]
  return [sectionCrumb(tab), passCrumb(editorPassId, 'grnEditorTitle', ENTRY_SECTIONS.grn)]
}

// The Home crumb is left out when the section crumb already is the role's
// home, so two crumbs never point at the same page.
function withHomeCrumb(role, trail, roleTabs) {
  if (trail.length === 0) return trail
  const homeRoute = defaultRouteForRole(role)
  if (trail[0].target === homeRoute) return trail
  const homeTab = findActiveTab(roleTabs, homeRoute)
  const homeCrumb = { id: HOME_CRUMB_ID, labelKey: 'breadcrumbHome', section: homeTab?.id, target: homeRoute, isHome: true }
  return [homeCrumb, ...trail]
}

// Ancestors link only where the role may open the target; the last crumb
// (the current page) is never a link.
function withLinks(role, trail) {
  const lastIndex = trail.length - 1
  return trail.map(({ section, target, ...crumb }, index) => {
    const linkable = index < lastIndex && Boolean(target) && canOpenSection(role, section)
    return { ...crumb, to: linkable ? target : null }
  })
}

// [{ id, labelKey | dynamicKind, passId?, fallbackKey?, to | null, isHome?, isDetail? }]
export function buildBreadcrumbTrail(role, pathname, search = '') {
  const roleTabs = tabsForRole(role)
  const passMatch = PASS_PATH_PATTERN.exec(pathname)
  const trail = passMatch ? passTrail(roleTabs, passMatch) : sectionTrail(roleTabs, pathname, search)
  return withLinks(role, withHomeCrumb(role, trail, roleTabs))
}

// The crumb the mobile back arrow points to: only on detail-level pages, and
// only when that parent is a link the role may follow.
export function parentCrumb(trail) {
  const last = trail[trail.length - 1]
  if (!last?.isDetail) return null
  const parent = trail[trail.length - 2]
  return parent?.to ? parent : null
}

// Display text of one crumb. The published vehicle number is used only when
// its pass id matches the pass in the URL, so one pass never shows another's label.
export function crumbLabel(crumb, t, detail) {
  if (!crumb.dynamicKind) return t(crumb.labelKey)
  const matches = detail?.label && String(detail.passId) === String(crumb.passId)
  return matches ? detail.label : t(crumb.fallbackKey)
}
