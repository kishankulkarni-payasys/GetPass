import { useLanguage } from '../context/LanguageContext'
import { INDICATOR_STATUS } from '../hooks/useIndicatorReading'
import { translateApiDetail } from '../i18n/apiErrors'

const WEIGHT_FORMAT = { maximumFractionDigits: 2 }
// Indicator values are compared against the physical display: Latin digits always.
const NUMBER_LOCALE = 'en-IN'

export function formatWeight(value) {
  return Number(value).toLocaleString(NUMBER_LOCALE, WEIGHT_FORMAT)
}

function StabilityLabel({ stable }) {
  const { t } = useLanguage()
  return (
    <span className={`weigh-readout-stability ${stable ? 'weigh-readout-stable' : 'weigh-readout-unstable'}`}>
      <span className="weigh-readout-dot" aria-hidden="true" />
      {stable ? t('weighStable') : t('weighSettling')}
    </span>
  )
}

// Dark live readout of the weighbridge indicator (mono, large).
export default function WeighIndicator({ indicator }) {
  const { t } = useLanguage()
  const { status, reading, errorDetail } = indicator

  if (status === INDICATOR_STATUS.unavailable) {
    return <div className="gp-banner gp-banner-neutral" role="status">{t('weighIndicatorNotConfigured')}</div>
  }

  const showValue = reading && status !== INDICATOR_STATUS.loading
  return (
    <div className="weigh-readout" role="group" aria-label={t('weighLiveReading')}>
      <span className="weigh-readout-label">{t('weighLiveReading')}</span>
      {/* aria-live off: a value changing every 1.5 s would flood screen readers; the stability label is announced instead. */}
      <p className="weigh-readout-value gp-mono" aria-live="off">
        {showValue ? formatWeight(reading.weight_kg) : '—'}
        <span className="weigh-readout-unit">kg</span>
      </p>
      <div aria-live="polite">
        {status === INDICATOR_STATUS.failed && (
          <span className="weigh-readout-error">{translateApiDetail(errorDetail, t, 'weighIndicatorFailed')}</span>
        )}
        {status === INDICATOR_STATUS.live && <StabilityLabel stable={reading.stable} />}
        {status === INDICATOR_STATUS.loading && <span className="weigh-readout-error">{t('loading')}</span>}
      </div>
      {reading?.frame_ref && <span className="weigh-readout-frame gp-mono">{reading.frame_ref}</span>}
    </div>
  )
}
