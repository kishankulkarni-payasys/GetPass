import { readStoredLanguage } from '../../i18n/languageStorage'
import { translations } from '../../i18n/translations'

const CLOSE_KEY = 'close'

const STYLES = {
  success: 'border-green-500 text-green-800 bg-green-50',
  error: 'border-red-500 text-red-800 bg-red-50',
  info: 'border-gp-info text-gp-info-ink bg-gp-info-wash',
}

export default function Toast({ type = 'success', children, onClose }) {
  // ToastProvider sits above LanguageProvider in App.jsx, so the language
  // context is not reachable here; read the stored language the same way the
  // session-expired toast in AuthContext does.
  const closeLabel = translations[readStoredLanguage()][CLOSE_KEY]
  return (
    <div className={`flex items-start justify-between gap-3 rounded-lg border-l-4 p-4 shadow-md ${STYLES[type]}`}>
      <p className="text-sm font-medium">{children}</p>
      <button
        type="button"
        onClick={onClose}
        aria-label={closeLabel}
        className="text-lg leading-none text-slate-400 hover:text-slate-600"
      >
        <span aria-hidden="true">&times;</span>
      </button>
    </div>
  )
}
