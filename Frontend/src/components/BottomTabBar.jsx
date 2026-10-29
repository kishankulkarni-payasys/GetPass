import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { useFormFieldFocus } from '../hooks/useFormFieldFocus'
import { findActiveTab, tabLabel, tabShortLabel, tabsForRole } from '../navigation/navItems'
import NavIcon from './NavIcon'

// CSS shows only one of the two spans. When the short one is visible the link's
// aria-label keeps the full label as the accessible name.
function TabLabel({ tab, t }) {
  const shortLabel = tabShortLabel(tab, t)
  if (!shortLabel) return <span className="bottom-tab-label">{tabLabel(tab, t)}</span>

  return (
    <>
      <span className="bottom-tab-label bottom-tab-label-full-has-short">{tabLabel(tab, t)}</span>
      <span className="bottom-tab-label bottom-tab-label-short">{shortLabel}</span>
    </>
  )
}

// Mobile-only (below lg) app navigation. Rendered after the main content so
// keyboard users reach it once they have gone through the page.
export default function BottomTabBar() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const { pathname } = useLocation()
  const isTyping = useFormFieldFocus(pathname)

  if (!user) return null

  const tabs = tabsForRole(user.role)
  const activeTab = findActiveTab(tabs, pathname)

  const handleTabClick = (tab) => {
    // Re-tapping the current tab is the usual "back to top" gesture in mobile apps.
    if (tab.id === activeTab?.id) window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <nav
      className={`bottom-tab-bar ${isTyping ? 'bottom-tab-bar-hidden' : ''}`}
      aria-label={t('navMain')}
      aria-hidden={isTyping || undefined}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab?.id
        const fullLabel = tabLabel(tab, t)
        return (
          <NavLink
            key={tab.id}
            to={tab.to}
            onClick={() => handleTabClick(tab)}
            className={`bottom-tab ${isActive ? 'bottom-tab-active' : ''}`}
            tabIndex={isTyping ? -1 : undefined}
            aria-label={tab.shortLabelKey ? fullLabel : undefined}
            title={fullLabel}
          >
            <NavIcon name={tab.icon} className="bottom-tab-icon" />
            <TabLabel tab={tab} t={t} />
          </NavLink>
        )
      })}
    </nav>
  )
}
