import { useLanguage } from '../../context/LanguageContext'
import { erpStatusDisplay, passStateDisplay, qualityResultDisplay } from '../../utils/passStates'
import Badge from './Badge'

// Pass state pill. Pass the pass's own fields:
//   <StatePill state={pass.pass_state} passType={pass.pass_type} erpStatus={pass.erp_status} />
// `erpStatus` only matters for GRN_APPROVED; `passType` only for GATE_IN.
export default function StatePill({ state, passType, erpStatus, className = '' }) {
  const { t } = useLanguage()
  const { tone, labelKey } = passStateDisplay(state, passType, erpStatus)
  return (
    <Badge tone={tone} dot className={className}>
      {t(labelKey)}
    </Badge>
  )
}

// Quality result of a pass: approved (good), partial (warn), rejected (crit).
export function QualityResultPill({ result, className = '' }) {
  const { t } = useLanguage()
  const { tone, labelKey } = qualityResultDisplay(result)
  return (
    <Badge tone={tone} className={className}>
      {t(labelKey)}
    </Badge>
  )
}

// ERP post status of a GRN: posted (info), pending / failed (crit), not required (warn).
export function ErpStatusPill({ status, className = '' }) {
  const { t } = useLanguage()
  const { tone, labelKey } = erpStatusDisplay(status)
  return (
    <Badge tone={tone} className={className}>
      {t(labelKey)}
    </Badge>
  )
}
