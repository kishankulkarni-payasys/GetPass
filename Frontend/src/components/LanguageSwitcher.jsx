import { useLanguage } from '../context/LanguageContext'
import { LANGUAGES } from '../i18n/languages'
import Button from './ui/Button'

// Each option carries its own `lang` so it is read and rendered in its own
// script whatever the page language is.
function FullSwitcher({ language, setLanguage, groupLabel }) {
  return (
    <div className="language-switcher-full" role="group" aria-label={groupLabel}>
      {LANGUAGES.map(({ code, label }) => (
        <Button
          key={code}
          type="button"
          lang={code}
          variant={language === code ? 'primary' : 'secondary'}
          aria-pressed={language === code}
          onClick={() => setLanguage(code)}
        >
          {label}
        </Button>
      ))}
    </div>
  )
}

function CompactSwitcher({ language, setLanguage, groupLabel, onDark }) {
  return (
    <div
      className={`language-switcher-compact ${onDark ? 'language-switcher-compact-on-dark' : ''}`}
      role="group"
      aria-label={groupLabel}
    >
      {LANGUAGES.map(({ code, label }) => (
        <button
          key={code}
          type="button"
          lang={code}
          className="language-switcher-option"
          aria-pressed={language === code}
          onClick={() => setLanguage(code)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

// `full`: touch-sized, full-width buttons on the Account page.
// `compact`: segmented control for the desktop header and the login header;
// `onDark` switches it to the colours of the dark login screen.
export default function LanguageSwitcher({ variant = 'compact', onDark = false }) {
  const { language, setLanguage, t } = useLanguage()
  const props = { language, setLanguage, groupLabel: t('labelLanguage') }

  if (variant === 'full') return <FullSwitcher {...props} />
  return <CompactSwitcher {...props} onDark={onDark} />
}
