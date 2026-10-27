import { useLanguage } from '../context/LanguageContext'
import Button from './ui/Button'

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिंदी' },
  { code: 'mr', label: 'मराठी' },
]

// `fullWidth` is the touch-sized version used on the mobile Account page;
// the compact default stays in the desktop Entries heading.
export default function LanguageSwitcher({ fullWidth = false }) {
  const { language, setLanguage, t } = useLanguage()

  return (
    <div className={fullWidth ? 'language-switcher-full' : 'flex gap-2'} role="group" aria-label={t('labelLanguage')}>
      {LANGUAGES.map((lang) => (
        <Button
          key={lang.code}
          type="button"
          lang={lang.code}
          variant={language === lang.code ? 'primary' : 'secondary'}
          size={fullWidth ? 'md' : 'sm'}
          aria-pressed={language === lang.code}
          onClick={() => setLanguage(lang.code)}
        >
          {lang.label}
        </Button>
      ))}
    </div>
  )
}
