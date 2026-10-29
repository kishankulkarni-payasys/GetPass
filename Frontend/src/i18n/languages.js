// The languages the app can show. `label` is always in the language's own
// script and is never translated, so a reader can find their language even
// when the screen is in one they cannot read.
export const LANGUAGES = [
  { code: 'en', label: 'English', locale: 'en-IN' },
  { code: 'hi', label: 'हिंदी', locale: 'hi-IN' },
  { code: 'mr', label: 'मराठी', locale: 'mr-IN' },
]

export const DEFAULT_LANGUAGE = 'en'

export function isSupportedLanguage(code) {
  return LANGUAGES.some((language) => language.code === code)
}

export function normalizeLanguage(code) {
  return isSupportedLanguage(code) ? code : DEFAULT_LANGUAGE
}

export function localeFor(code) {
  return LANGUAGES.find((language) => language.code === code)?.locale ?? LANGUAGES[0].locale
}
