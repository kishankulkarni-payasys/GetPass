import { Link } from 'react-router-dom'
import { useBreadcrumbTrail } from '../context/BreadcrumbContext'
import { useLanguage } from '../context/LanguageContext'
import NavIcon from './NavIcon'
import './Breadcrumbs.css'

function CrumbContent({ crumb }) {
  return (
    <>
      {crumb.isHome && <NavIcon name="home" className="breadcrumbs-home-icon" />}
      <span className="breadcrumbs-label">{crumb.label}</span>
    </>
  )
}

// Ancestors are links; the current page (last crumb) and any crumb the role
// may not open are plain text. `title` carries the full text behind the ellipsis.
function BreadcrumbItem({ crumb, isCurrent }) {
  const className = `breadcrumbs-crumb${isCurrent ? ' breadcrumbs-crumb-current' : ''}`
  return (
    <li className={`breadcrumbs-item${isCurrent ? ' breadcrumbs-item-current' : ''}`}>
      {crumb.to && !isCurrent ? (
        <Link className={`${className} breadcrumbs-link`} to={crumb.to} title={crumb.label}>
          <CrumbContent crumb={crumb} />
        </Link>
      ) : (
        <span className={className} title={crumb.label} aria-current={isCurrent ? 'page' : undefined}>
          <CrumbContent crumb={crumb} />
        </span>
      )}
    </li>
  )
}

// Desktop trail in the app header (hidden with the header below lg and in print).
export default function Breadcrumbs() {
  const { t } = useLanguage()
  const trail = useBreadcrumbTrail()

  if (trail.length === 0) return null

  const lastIndex = trail.length - 1
  return (
    <nav className="breadcrumbs no-print" aria-label={t('breadcrumbNav')}>
      <ol className="breadcrumbs-list">
        {trail.map((crumb, index) => (
          <BreadcrumbItem key={crumb.id} crumb={crumb} isCurrent={index === lastIndex} />
        ))}
      </ol>
    </nav>
  )
}
