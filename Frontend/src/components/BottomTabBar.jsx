import { useCallback, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { useFormFieldFocus } from '../hooks/useFormFieldFocus'
import { bottomTabsForRole, findActiveTab, tabLabel, tabShortLabel } from '../navigation/navItems'
import MoreSheet from './MoreSheet'
import NavIcon from './NavIcon'

const MORE_SHEET_ID = 'bottom-tab-more-sheet'

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

function BottomTab({ tab, isActive, isTyping, t }) {
  const fullLabel = tabLabel(tab, t)
  // Re-tapping the current tab is the usual "back to top" gesture in mobile apps.
  const handleClick = () => {
    if (isActive) window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <NavLink
      to={tab.to}
      onClick={handleClick}
      className={`bottom-tab ${isActive ? 'bottom-tab-active' : ''}`}
      tabIndex={isTyping ? -1 : undefined}
      aria-label={tab.shortLabelKey ? fullLabel : undefined}
      title={fullLabel}
    >
      <NavIcon name={tab.icon} className="bottom-tab-icon" />
      <TabLabel tab={tab} t={t} />
    </NavLink>
  )
}

function MoreTab({ isActive, isOpen, isTyping, onOpen, t }) {
  return (
    <button
      type="button"
      className={`bottom-tab bottom-tab-more ${isActive ? 'bottom-tab-active' : ''}`}
      onClick={onOpen}
      tabIndex={isTyping ? -1 : undefined}
      aria-haspopup="dialog"
      aria-expanded={isOpen}
      aria-controls={isOpen ? MORE_SHEET_ID : undefined}
    >
      <NavIcon name="more" className="bottom-tab-icon" />
      <span className="bottom-tab-label">{t('tabMore')}</span>
    </button>
  )
}

// Mobile-only (below lg) app navigation. Rendered after the main content so
// keyboard users reach it once they have gone through the page. Roles with
// more than five sections get four tabs plus "More" (a sheet with the rest).
export default function BottomTabBar() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const { pathname } = useLocation()
  const isTyping = useFormFieldFocus(pathname)
  const [moreOpen, setMoreOpen] = useState(false)
  // Stable so the sheet's focus effect runs once per opening.
  const closeMore = useCallback(() => setMoreOpen(false), [])

  if (!user) return null

  const { visible, overflow } = bottomTabsForRole(user.role)
  const activeTab = findActiveTab([...visible, ...overflow], pathname)
  const isOverflowActive = overflow.some((tab) => tab.id === activeTab?.id)

  return (
    <>
      <nav
        className={`bottom-tab-bar ${isTyping ? 'bottom-tab-bar-hidden' : ''}`}
        aria-label={t('navMain')}
        aria-hidden={isTyping || undefined}
      >
        {visible.map((tab) => (
          <BottomTab key={tab.id} tab={tab} isActive={tab.id === activeTab?.id} isTyping={isTyping} t={t} />
        ))}
        {overflow.length > 0 && (
          <MoreTab isActive={isOverflowActive} isOpen={moreOpen} isTyping={isTyping} onOpen={() => setMoreOpen(true)} t={t} />
        )}
      </nav>
      {moreOpen && (
        <MoreSheet id={MORE_SHEET_ID} tabs={overflow} activeTabId={activeTab?.id} onClose={closeMore} />
      )}
    </>
  )
}
