import { useEffect, useRef } from 'react'
import { useLanguage } from '../context/LanguageContext'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Tab and Shift+Tab wrap around inside the dialog.
function trapTabKey(event, container) {
  const focusable = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR))
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

// Locks the page scroll, closes on Escape, moves focus in on open and back
// to the opener on close (same behaviour as the weighbridge sheet).
function useModalBehaviour(dialogRef, closeButtonRef, onClose) {
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const opener = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
      }
      if (event.key === 'Tab' && dialogRef.current) trapTabKey(event, dialogRef.current)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus()
    }
  }, [dialogRef, closeButtonRef])
}

// Sheet for one pass action (gate-out, cancel, quality result). Full screen
// below sm so the bottom tab bar is covered; centred dialog from sm up.
// `footer` holds the action buttons and stays visible while the body scrolls.
export default function PassActionDialog({ id, eyebrow, title, onClose, footer, children }) {
  const { t } = useLanguage()
  const dialogRef = useRef(null)
  const closeButtonRef = useRef(null)
  useModalBehaviour(dialogRef, closeButtonRef, onClose)
  const titleId = `${id}-title`

  return (
    <>
      <div className="modal-backdrop show" />
      <div ref={dialogRef} className="modal d-block" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="modal-dialog modal-fullscreen-sm-down modal-dialog-centered modal-dialog-scrollable modal-lg">
          <div className="modal-content overflow-hidden border-0 shadow-lg sm:rounded-2xl">
            <div className="modal-header border-0 bg-gp-control px-4 py-3">
              <div className="min-w-0">
                {eyebrow && <p className="mb-1 text-xs font-semibold text-white/70">{eyebrow}</p>}
                <h2 id={titleId} className="modal-title text-lg font-bold text-white">{title}</h2>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                className="btn-close btn-close-white"
                onClick={onClose}
                aria-label={t('close')}
              />
            </div>
            <div className="modal-body p-3 sm:p-4">{children}</div>
            {footer && <div className="modal-footer flex-nowrap gap-2 border-gp-line p-3">{footer}</div>}
          </div>
        </div>
      </div>
    </>
  )
}
