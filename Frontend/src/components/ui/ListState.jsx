// One place for the loading / empty / error states of every record list, so
// the Entry Log, Weighbridge and Users screens behave the same way.
// Labels default to the shared translated words; screens pass their own
// strings when they need something more specific.
import { useLanguage } from '../../context/LanguageContext'

const DEFAULT_SKELETON_COUNT = 3

function ListSkeleton({ count, loadingLabel }) {
  return (
    <div className="list-state-skeletons" role="status" aria-busy="true">
      <span className="visually-hidden">{loadingLabel}</span>
      {Array.from({ length: count }, (_, index) => (
        <div className="record-card record-card-skeleton" key={index} aria-hidden="true">
          <div className="record-card-skeleton-row">
            <span className="skeleton-block skeleton-title" />
            <span className="skeleton-block skeleton-badge" />
          </div>
          <span className="skeleton-block skeleton-line" />
          <span className="skeleton-block skeleton-line skeleton-line-short" />
          <span className="skeleton-block skeleton-line" />
        </div>
      ))}
    </div>
  )
}

function ListEmpty({ message, hasFilters, onClearFilters, clearFiltersLabel, icon }) {
  return (
    <div className="list-state list-state-empty">
      <span className="list-state-icon" aria-hidden="true">
        {icon ?? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 7.5 6.5 4h11L20 7.5M4 7.5V19a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V7.5M4 7.5h16M9.5 12h5" />
          </svg>
        )}
      </span>
      <p className="list-state-message">{message}</p>
      {hasFilters && onClearFilters && (
        <button type="button" className="list-state-button list-state-button-secondary" onClick={onClearFilters}>
          {clearFiltersLabel}
        </button>
      )}
    </div>
  )
}

function ListError({ message, onRetry, retryLabel }) {
  return (
    <div className="list-state list-state-error">
      <span className="list-state-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 8v5m0 3h.01M10.3 3.9 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        </svg>
      </span>
      <p className="list-state-message" role="alert">{message}</p>
      {onRetry && (
        <button type="button" className="list-state-button" onClick={onRetry}>
          {retryLabel}
        </button>
      )}
    </div>
  )
}

export default function ListState({
  loading = false,
  error = null,
  isEmpty = false,
  onRetry,
  emptyMessage,
  emptyIcon,
  hasFilters = false,
  onClearFilters,
  clearFiltersLabel,
  retryLabel,
  loadingLabel,
  skeletonCount = DEFAULT_SKELETON_COUNT,
  children,
}) {
  const { t } = useLanguage()
  // An error replaces the list: stale cards next to an error would suggest they are current.
  if (error) return <ListError message={error} onRetry={onRetry} retryLabel={retryLabel ?? t('retry')} />
  if (isEmpty && loading) return <ListSkeleton count={skeletonCount} loadingLabel={loadingLabel ?? t('loading')} />
  if (isEmpty) {
    return (
      <ListEmpty
        message={emptyMessage ?? t('listEmptyDefault')}
        icon={emptyIcon}
        hasFilters={hasFilters}
        onClearFilters={onClearFilters}
        clearFiltersLabel={clearFiltersLabel ?? t('clearFilters')}
      />
    )
  }
  return children
}
