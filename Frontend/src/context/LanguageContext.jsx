import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { LANGUAGE_STORAGE_KEY, readStoredLanguage, writeStoredLanguage } from '../i18n/languageStorage'
import { DEFAULT_LANGUAGE, isSupportedLanguage, localeFor, normalizeLanguage } from '../i18n/languages'
import { translations } from '../i18n/translations'

const LanguageContext = createContext(null)
const PLACEHOLDER_PATTERN = /\{(\w+)\}/g

// Variables go in as placeholders ("Welcome back, {name}") instead of string
// joining, because word order differs between languages. An unknown
// placeholder is left as written so the gap is visible, not silently blank.
function fillPlaceholders(text, values) {
  if (!values) return text
  return text.replace(PLACEHOLDER_PATTERN, (match, name) => (name in values ? String(values[name]) : match))
}

// Falls back to English, then to the key itself, so a missing translation
// never breaks a screen (the key-parity check stops that reaching a build).
function lookUp(language, key) {
  return translations[language]?.[key] ?? translations[DEFAULT_LANGUAGE][key] ?? key
}

// Keeps a second browser tab on the same device in the same language.
function useLanguageFromOtherTabs(setLanguageState) {
  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key === LANGUAGE_STORAGE_KEY) setLanguageState(normalizeLanguage(event.newValue))
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [setLanguageState])
}

// Every role and the login page use the same per-device language.
export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(readStoredLanguage)

  useLanguageFromOtherTabs(setLanguageState)

  // Screen readers, hyphenation, the Devanagari font rules in index.css and
  // the English-only uppercase kickers all key off <html lang>. Layout effect so
  // the first paint already uses the right font rules.
  useLayoutEffect(() => {
    document.documentElement.lang = language
  }, [language])

  const setLanguage = useCallback((code) => {
    if (!isSupportedLanguage(code)) return
    // If storage is blocked the choice still applies for this session.
    writeStoredLanguage(code)
    setLanguageState(code)
  }, [])

  const t = useCallback((key, values) => fillPlaceholders(lookUp(language, key), values), [language])

  const value = useMemo(
    () => ({ language, locale: localeFor(language), setLanguage, t }),
    [language, setLanguage, t],
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  return useContext(LanguageContext)
}
