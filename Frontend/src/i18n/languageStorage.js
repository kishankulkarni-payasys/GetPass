import { DEFAULT_LANGUAGE, normalizeLanguage } from './languages.js'

// Per-device choice, kept after sign-out so the login page opens in the
// language the last person on this device used. Shared by LanguageContext and
// AuthContext (which sits above LanguageProvider and cannot use the hook).
export const LANGUAGE_STORAGE_KEY = 'getpass:language'

// When localStorage is blocked (private mode, strict site settings) the choice
// still has to hold for this page session, including the session-expired
// toast that AuthContext reads from here.
let languageForThisSession = null

export function readStoredLanguage() {
  try {
    return normalizeLanguage(window.localStorage.getItem(LANGUAGE_STORAGE_KEY))
  } catch (storageBlockedError) {
    return languageForThisSession ?? DEFAULT_LANGUAGE
  }
}

// Returns false when the choice could not be saved; it still applies until
// the page is reloaded, it just will not be remembered.
export function writeStoredLanguage(code) {
  languageForThisSession = code
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, code)
    return true
  } catch (storageBlockedError) {
    return false
  }
}
