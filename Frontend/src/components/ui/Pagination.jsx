import { useRef } from 'react'
import { useLanguage } from '../../context/LanguageContext'
import { PAGE_SIZE_OPTIONS } from '../../hooks/usePagination'
import Select from './Select'

const GAP = 'gap'

// Page numbers to show: first, last, and a window around the current page, with gaps between.
function pageNumbers(page, pageCount) {
  const wanted = new Set([1, pageCount, page - 1, page, page + 1])
  const sorted = [...wanted].filter((n) => n >= 1 && n <= pageCount).sort((a, b) => a - b)
  const result = []
  sorted.forEach((n, index) => {
    if (index > 0 && n - sorted[index - 1] > 1) result.push(`${GAP}-${n}`)
    result.push(n)
  })
  return result
}

// Footer for a paged list: "Showing 1–10 of 45", page buttons and rows per page.
// Takes the object returned by usePagination. Hidden when everything fits on the smallest page size.
export default function Pagination({ pagination, label, className = '' }) {
  const { t } = useLanguage()
  const navRef = useRef(null)
  const { page, pageCount, pageSize, total, from, to, setPage, setPageSize } = pagination
  if (total <= PAGE_SIZE_OPTIONS[0]) return null

  // After a page change from the bottom of a long list, bring the top of the list back into view.
  const goTo = (target) => {
    setPage(target)
    const list = navRef.current?.parentElement
    if (list && list.getBoundingClientRect().top < 0) list.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }

  const buttonClass = 'gp-btn gp-btn-secondary gp-btn-sm min-w-9'
  const pageSizeSelect = (
    <label className="flex items-center gap-2 text-sm text-slate-600">
      {t('paginationRowsPerPage')}
      <Select size="sm" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
        {PAGE_SIZE_OPTIONS.map((size) => (
          <option key={size} value={size}>{size}</option>
        ))}
      </Select>
    </label>
  )
  return (
    <nav ref={navRef} aria-label={label ?? t('paginationLabel')} className={`mt-4 ${className}`}>
      {/* Phone: big Previous / Next thumb targets with "2 / 5" between them. */}
      <div className="flex flex-col gap-2 sm:hidden">
        <div className="flex items-center gap-2">
          <button type="button" className="gp-btn gp-btn-secondary gp-btn-md flex-1" onClick={() => goTo(page - 1)} disabled={page <= 1}>
            <span aria-hidden="true">‹</span> {t('paginationPrevious')}
          </button>
          <span className="gp-mono min-w-14 text-center text-sm font-semibold text-slate-900" aria-current="page">
            {page} / {pageCount}
          </span>
          <button type="button" className="gp-btn gp-btn-secondary gp-btn-md flex-1" onClick={() => goTo(page + 1)} disabled={page >= pageCount}>
            {t('paginationNext')} <span aria-hidden="true">›</span>
          </button>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="m-0 text-xs text-slate-600" aria-live="polite">{t('paginationShowing', { from, to, total })}</p>
          {pageSizeSelect}
        </div>
      </div>

      {/* Tablet and desktop: summary, numbered pages and rows per page on one line. */}
      <div className="hidden items-center justify-between gap-3 sm:flex">
        <p className="m-0 text-sm text-slate-600" aria-live="polite">{t('paginationShowing', { from, to, total })}</p>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={buttonClass} onClick={() => goTo(page - 1)} disabled={page <= 1}>
            <span aria-hidden="true">‹</span> {t('paginationPrevious')}
          </button>
          {pageNumbers(page, pageCount).map((n) =>
            typeof n === 'string' ? (
              <span key={n} className="px-1 text-slate-500" aria-hidden="true">…</span>
            ) : (
              <button
                key={n}
                type="button"
                className={`gp-btn gp-btn-sm min-w-9 ${n === page ? 'gp-btn-primary' : 'gp-btn-secondary'}`}
                onClick={() => goTo(n)}
                aria-current={n === page ? 'page' : undefined}
                aria-label={t('paginationPage', { page: n })}
              >
                {n}
              </button>
            ),
          )}
          <button type="button" className={buttonClass} onClick={() => goTo(page + 1)} disabled={page >= pageCount}>
            {t('paginationNext')} <span aria-hidden="true">›</span>
          </button>
          <span className="ms-1">{pageSizeSelect}</span>
        </div>
      </div>
    </nav>
  )
}
