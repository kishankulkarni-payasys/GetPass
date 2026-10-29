import { useEffect, useRef } from 'react'
import { NavLink } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import { tabLabel } from '../navigation/navItems'
import NavIcon from './NavIcon'

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled])'

// Keeps Tab / Shift+Tab inside the sheet while it is open (modal dialog).
function trapTabKey(event, container) {
  const focusable = [...container.querySelectorAll(FOCUSABLE_SELECTOR)]
  if (focusable.length === 0) return
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

// Focus moves into the sheet on open and back to the "More" tab on close.
function useDialogFocus(sheetRef, onClose) {
  useEffect(() => {
    const opener = document.activeElement
    sheetRef.current?.querySelector(FOCUSABLE_SELECTOR)?.focus()

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'Tab' && sheetRef.current) trapTabKey(event, sheetRef.current)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      opener?.focus?.()
    }
  }, [sheetRef, onClose])
}

// Bottom sheet listing the sections that do not fit in the bottom tab bar.
export default function MoreSheet({ id, tabs, activeTabId, onClose }) {
  const { t } = useLanguage()
  const sheetRef = useRef(null)
  useDialogFocus(sheetRef, onClose)
  const titleId = `${id}-title`

  return (
    <>
      <div className="more-sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <div id={id} ref={sheetRef} className="more-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="more-sheet-header">
          <h2 id={titleId} className="more-sheet-title">{t('moreSheetTitle')}</h2>
          <button type="button" className="more-sheet-close" onClick={onClose} aria-label={t('close')}>
            <span aria-hidden="true">&times;</span>
          </button>
        </div>
        <ul className="more-sheet-list">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId
            return (
              <li key={tab.id}>
                <NavLink
                  to={tab.to}
                  onClick={onClose}
                  className={`more-sheet-link ${isActive ? 'more-sheet-link-active' : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <NavIcon name={tab.icon} />
                  <span>{tabLabel(tab, t)}</span>
                </NavLink>
              </li>
            )
          })}
        </ul>
      </div>
    </>
  )
}
