import { useLanguage } from '../context/LanguageContext'
import Button from './ui/Button'

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिंदी' },
  { code: 'mr', label: 'मराठी' },
]

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage()

  return (
    <div className="flex gap-2">
      {LANGUAGES.map((lang) => (
        <Button
          key={lang.code}
          type="button"
          variant={language === lang.code ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setLanguage(lang.code)}
        >
          {lang.label}
        </Button>
      ))}
    </div>
  )
}
