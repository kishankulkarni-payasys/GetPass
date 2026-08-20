import { createContext, useContext, useEffect, useState } from 'react'
import { translations } from '../i18n/translations'
import { useAuth } from './AuthContext'

const LanguageContext = createContext(null)
const STORAGE_KEY = 'getpass:language'
const DEFAULT_LANGUAGE = 'en'

function readStoredLanguage() {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored && translations[stored] ? stored : DEFAULT_LANGUAGE
}

export function LanguageProvider({ children }) {
  const { user } = useAuth()
  const [language, setLanguageState] = useState(readStoredLanguage)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, language)
  }, [language])

  const setLanguage = (lang) => {
    if (translations[lang]) setLanguageState(lang)
  }

  // Only security_guard's UI actually renders in another language - everyone
  // else always sees English, even if a guard set hi/mr earlier on this same
  // shared browser.
  const effectiveLanguage = user?.role === 'security_guard' ? language : DEFAULT_LANGUAGE

  const t = (key) => translations[effectiveLanguage]?.[key] ?? translations[DEFAULT_LANGUAGE][key] ?? key

  return (
    <LanguageContext.Provider value={{ language: effectiveLanguage, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
