import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { buildBreadcrumbTrail, crumbLabel } from '../navigation/breadcrumbs'
import { useAuth } from './AuthContext'
import { useLanguage } from './LanguageContext'

// Split in two so pages that only publish a label do not re-render when it changes.
const BreadcrumbDetailContext = createContext(null)
const BreadcrumbPublishContext = createContext(null)

export function BreadcrumbProvider({ children }) {
  const [detail, setDetail] = useState(null)

  return (
    <BreadcrumbPublishContext.Provider value={setDetail}>
      <BreadcrumbDetailContext.Provider value={detail}>{children}</BreadcrumbDetailContext.Provider>
    </BreadcrumbPublishContext.Provider>
  )
}

// The page that owns a pass publishes its display label (the vehicle number)
// for the pass crumb. It is cleared on unmount, and the trail only uses it
// while `passId` matches the pass in the URL.
export function useBreadcrumbDetail(passId, label) {
  const setDetail = useContext(BreadcrumbPublishContext)

  useEffect(() => {
    if (!setDetail || !label) return undefined
    const published = { passId: String(passId), label: String(label) }
    setDetail(published)
    return () => setDetail((current) => (current === published ? null : current))
  }, [setDetail, passId, label])
}

// Trail for the current URL with translated labels: [{ id, label, to, isHome, isDetail }].
// Empty when signed out, so the Login page shows no breadcrumb.
export function useBreadcrumbTrail() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const { pathname, search } = useLocation()
  const detail = useContext(BreadcrumbDetailContext)
  const role = user?.role

  return useMemo(() => {
    if (!role) return []
    return buildBreadcrumbTrail(role, pathname, search).map((crumb) => ({
      id: crumb.id,
      label: crumbLabel(crumb, t, detail),
      to: crumb.to,
      isHome: Boolean(crumb.isHome),
      isDetail: Boolean(crumb.isDetail),
    }))
  }, [role, pathname, search, t, detail])
}
