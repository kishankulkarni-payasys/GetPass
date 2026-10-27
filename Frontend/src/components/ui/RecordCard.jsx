// Shared mobile card for every record list (Entry Log, Weighbridge, Users).
// The card itself is not clickable on purpose: only its buttons are, so a
// thumb scrolling the list never triggers an action by accident.

const EMPTY_VALUE = '-'

function isEmptyValue(value) {
  return value === null || value === undefined || value === ''
}

function RecordCardDetails({ details }) {
  const visibleDetails = details.filter((detail) => !detail.hidden)
  if (visibleDetails.length === 0) return null

  return (
    <dl className="record-card-details">
      {visibleDetails.map(({ label, value, secondary, key }) => (
        <div className="record-card-detail" key={key ?? label}>
          <dt>{label}</dt>
          <dd>
            {isEmptyValue(value) ? EMPTY_VALUE : value}
            {!isEmptyValue(secondary) && <span className="record-card-secondary">{secondary}</span>}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export default function RecordCard({
  caption,
  title,
  subtitle,
  leading,
  badge,
  details = [],
  actions,
  children,
  className = '',
  as: Element = 'article',
  ...rest
}) {
  return (
    <Element className={`record-card ${className}`} {...rest}>
      <div className="record-card-header">
        {leading && <div className="record-card-leading">{leading}</div>}
        <div className="record-card-heading">
          {caption && <span className="record-card-caption">{caption}</span>}
          <h3 className="record-card-title">{title}</h3>
          {subtitle && <span className="record-card-subtitle">{subtitle}</span>}
        </div>
        {badge && <div className="record-card-badge">{badge}</div>}
      </div>
      <RecordCardDetails details={details} />
      {children && <div className="record-card-body">{children}</div>}
      {actions && <div className="record-card-actions">{actions}</div>}
    </Element>
  )
}

// Wraps a list of RecordCards with the shared spacing and the "refreshing"
// dim state (cards stay on screen while a reload runs).
export function RecordCardList({ refreshing = false, className = '', children, ...rest }) {
  return (
    <div
      className={`record-card-list ${refreshing ? 'record-card-list-refreshing' : ''} ${className}`}
      aria-busy={refreshing || undefined}
      {...rest}
    >
      {children}
    </div>
  )
}
