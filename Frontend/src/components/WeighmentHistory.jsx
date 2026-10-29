import { useLanguage } from '../context/LanguageContext'
import { formatCardDateTime } from '../utils/formatDate'
import { WEIGHMENT_KINDS, WEIGHMENT_SOURCES } from '../utils/weighRules'
import Badge from './ui/Badge'
import { formatWeight } from './WeighIndicator'

const SOURCE_BADGES = {
  [WEIGHMENT_SOURCES.indicator]: { tone: 'info', labelKey: 'weighSourceRaw' },
  [WEIGHMENT_SOURCES.manual]: { tone: 'warn', labelKey: 'weighSourceManual' },
  [WEIGHMENT_SOURCES.legacy]: { tone: 'neutral', labelKey: 'weighSourceLegacy' },
}

const KIND_LABEL_KEYS = {
  [WEIGHMENT_KINDS.gross]: 'weighKindGross',
  [WEIGHMENT_KINDS.tare]: 'weighKindTare',
}

function WeighmentRow({ row }) {
  const { t, locale } = useLanguage()
  const source = SOURCE_BADGES[row.source] ?? SOURCE_BADGES[WEIGHMENT_SOURCES.legacy]
  return (
    <li className={`weigh-row ${row.is_superseded ? 'weigh-row-superseded' : ''}`}>
      <div className="weigh-row-main">
        <span className="weigh-row-kind">{t(KIND_LABEL_KEYS[row.kind] ?? 'weighKindGross')}</span>
        <span className="weigh-row-value gp-mono">
          {row.is_superseded && <span className="visually-hidden">{t('weighSuperseded')}: </span>}
          {formatWeight(row.weight)} {row.unit}
        </span>
        <Badge tone={source.tone}>{t(source.labelKey)}</Badge>
        {row.is_superseded && <Badge tone="neutral">{t('weighSuperseded')}</Badge>}
      </div>
      <div className="weigh-row-meta">
        <span>{formatCardDateTime(row.captured_at, locale)}</span>
        {row.indicator_frame_ref && <span className="gp-mono">{row.indicator_frame_ref}</span>}
        {row.manual_reason && <span>{t('weighReasonValue', { reason: row.manual_reason })}</span>}
      </div>
    </li>
  )
}

// Every weighment of the pass, newest first; superseded rows are struck through.
export default function WeighmentHistory({ weighments }) {
  const { t } = useLanguage()
  if (weighments.length === 0) return <p className="text-sm">{t('weighNoWeighments')}</p>
  return (
    <ol className="weigh-history">
      {weighments.map((row) => (
        <WeighmentRow key={row.id} row={row} />
      ))}
    </ol>
  )
}
