import { useEffect, useState } from 'react'

// Below lg the on-screen keyboard would cover the bottom tab bar and the
// form's submit buttons, so the bar hides while a typing field has focus.
const MOBILE_LAYOUT_QUERY = '(max-width: 991.98px)'
const CONTENT_SELECTOR = '.app-content'
const TYPING_FIELD_SELECTOR = [
  'textarea',
  'select',
  'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="file"]):not([type="range"]):not([type="color"])',
].join(',')
// The keyboard animates in after focus; scrolling before it settles centres
// the field in the old (taller) viewport.
const KEYBOARD_SETTLE_DELAY_MS = 300

function isTypingField(element) {
  return element instanceof Element && element.matches(TYPING_FIELD_SELECTOR) && Boolean(element.closest(CONTENT_SELECTOR))
}

function isMobileLayout() {
  return window.matchMedia(MOBILE_LAYOUT_QUERY).matches
}

// `resetKey` (e.g. the current path): a focused field that unmounts with its
// page does not reliably fire focusout, so a new page always starts un-hidden.
export function useFormFieldFocus(resetKey) {
  const [isTyping, setIsTyping] = useState(false)

  useEffect(() => {
    setIsTyping(isTypingField(document.activeElement) && isMobileLayout())
  }, [resetKey])

  useEffect(() => {
    let scrollTimer = null

    const handleFocusIn = ({ target }) => {
      if (!isTypingField(target) || !isMobileLayout()) return
      setIsTyping(true)
      clearTimeout(scrollTimer)
      scrollTimer = setTimeout(() => target.scrollIntoView({ block: 'center', behavior: 'smooth' }), KEYBOARD_SETTLE_DELAY_MS)
    }

    // Moving straight to the next field must not flash the bar back in.
    const handleFocusOut = ({ relatedTarget }) => {
      if (!isTypingField(relatedTarget)) setIsTyping(false)
    }

    document.addEventListener('focusin', handleFocusIn)
    document.addEventListener('focusout', handleFocusOut)
    return () => {
      clearTimeout(scrollTimer)
      document.removeEventListener('focusin', handleFocusIn)
      document.removeEventListener('focusout', handleFocusOut)
    }
  }, [])

  return isTyping
}
