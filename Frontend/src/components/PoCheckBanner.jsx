import { useState } from 'react'
import { searchPoBySupplier } from '../api/gateIn'
import { useLanguage } from '../context/LanguageContext'
import { PO_CHECK } from '../hooks/useGateInChecks'
import Button from './ui/Button'
import Input from './ui/Input'

const MIN_SUPPLIER_SEARCH_LENGTH = 3

const BANNER_TONES = {
  [PO_CHECK.matched]: { className: 'gp-banner-good', messageKey: 'gateInPoMatched' },
  [PO_CHECK.notFound]: { className: 'gp-banner-crit', messageKey: 'gateInPoNotFound' },
  [PO_CHECK.notChecked]: { className: 'gp-banner-neutral', messageKey: 'gateInPoNotChecked' },
  [PO_CHECK.checking]: { className: 'gp-banner-neutral', messageKey: 'gateInPoChecking' },
}

function SupplierSearchResults({ results, onPick }) {
  const { t } = useLanguage()
  if (results.length === 0) return <p className="mt-2 mb-0 text-sm">{t('gateInPoSearchEmpty')}</p>
  return (
    <ul className="po-search-results">
      {results.map((hit) => (
        <li key={hit.po_number}>
          <button type="button" className="po-search-hit" onClick={() => onPick(hit)}>
            <span className="gp-mono font-bold">{hit.po_number}</span>
            <span>{hit.supplier_name}</span>
            <span className="text-xs">{t('gateInPoOpenLines', { count: hit.open_lines })}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

// Fallback when the PO is not found: find the PO by supplier name (AC6).
function SupplierSearch({ onPick }) {
  const { t } = useLanguage()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [searching, setSearching] = useState(false)
  const canSearch = query.trim().length >= MIN_SUPPLIER_SEARCH_LENGTH && !searching

  const handleSearch = async () => {
    setSearching(true)
    try {
      setResults(await searchPoBySupplier(query.trim()))
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="mt-3">
      <label className="gate-field-label" htmlFor="po-supplier-search">{t('gateInSearchBySupplier')}</label>
      <div className="flex gap-2">
        <Input
          id="po-supplier-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && canSearch) {
              event.preventDefault()
              handleSearch()
            }
          }}
          placeholder={t('gateInSupplierSearchPlaceholder')}
          className="min-w-0 flex-1"
        />
        <Button variant="secondary" onClick={handleSearch} disabled={!canSearch} aria-busy={searching}>
          {searching ? t('gateInSearching') : t('gateInSearch')}
        </Button>
      </div>
      {results && <SupplierSearchResults results={results} onPick={onPick} />}
    </div>
  )
}

// PO cross-check result. Warns, never blocks (B3).
export default function PoCheckBanner({ check, onPickPo }) {
  const { t } = useLanguage()
  const [searchOpen, setSearchOpen] = useState(false)
  const tone = BANNER_TONES[check.status]
  if (!tone) return null

  const handlePick = (hit) => {
    setSearchOpen(false)
    onPickPo(hit)
  }

  return (
    <div className={`gp-banner ${tone.className}`} role="status">
      <p className="m-0">
        {t(tone.messageKey)}
        {check.status === PO_CHECK.matched && check.po?.supplier_name && <> · <strong>{check.po.supplier_name}</strong></>}
      </p>
      {check.status === PO_CHECK.notFound && !searchOpen && (
        <Button variant="secondary" size="sm" className="mt-2" onClick={() => setSearchOpen(true)}>
          {t('gateInSearchBySupplier')}
        </Button>
      )}
      {check.status === PO_CHECK.notFound && searchOpen && <SupplierSearch onPick={handlePick} />}
    </div>
  )
}
