import { useLanguage } from '../../context/LanguageContext'

// Stand-in for a screen that is still being built, so its route already works.
export default function SectionPlaceholder({ title }) {
  const { t } = useLanguage()
  return (
    <section className="section-placeholder">
      <h2>{title}</h2>
      <p className="mb-0">{t('sectionComingSoon')}</p>
    </section>
  )
}
