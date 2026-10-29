import { Link, useParams } from 'react-router-dom'
import PageHeading from '../components/PageHeading'
import PassTimeline, { PassJourney } from '../components/PassTimeline'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import PlateChip from '../components/ui/PlateChip'
import StatePill, { ErpStatusPill, QualityResultPill } from '../components/ui/StatePill'
import { formatQty } from '../components/GrnLines'
import { formatWeight } from '../components/WeighIndicator'
import WeighmentHistory from '../components/WeighmentHistory'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { useGateInQueue } from '../hooks/useGateInQueue'
import { usePassDetail } from '../hooks/usePassDetail'
import { translateApiDetail } from '../i18n/apiErrors'
import { passActionsFor } from '../utils/passActions'
import { formatFullDateTime } from '../utils/formatDate'
import { isInward } from '../utils/passStates'

const PHOTO_KIND_KEYS = {
  plate: 'photoKindPlate',
  po_doc: 'photoKindPo',
  challan_doc: 'photoKindChallan',
  weigh_frame: 'photoKindWeighFrame',
  vehicle: 'photoKindVehicle',
  other: 'photoKindOther',
}

const PO_STATUS_TONES = { matched: 'good', not_found: 'crit', not_checked: 'neutral' }
const PO_STATUS_KEYS = { matched: 'passPoMatched', not_found: 'passPoNotFound', not_checked: 'passPoNotChecked' }

function Section({ id, title, children }) {
  return (
    <section className="pass-section" aria-labelledby={id}>
      <h2 id={id} className="pass-section-title">{title}</h2>
      {children}
    </section>
  )
}

function Facts({ items }) {
  return (
    <dl className="grn-facts">
      {items.filter(({ hidden }) => !hidden).map(({ key, label, value }) => (
        <div key={key} className="grn-fact">
          <dt>{label}</dt>
          <dd>{value === null || value === undefined || value === '' ? '—' : value}</dd>
        </div>
      ))}
    </dl>
  )
}

function DocumentsSection({ pass }) {
  const { t, locale } = useLanguage()
  const inward = isInward(pass)
  const mono = (value) => (value ? <span className="gp-mono">{value}</span> : null)
  return (
    <Section id="pass-documents" title={t('passDocuments')}>
      <Facts
        items={[
          { key: 'type', label: t('passType'), value: t(inward ? 'passTypeInward' : 'passTypeGeneral') },
          { key: 'po', label: t('fieldPoNumber'), value: mono(pass.po_number), hidden: !inward },
          { key: 'poStatus', label: t('passPoCheck'), value: pass.po_lookup_status && <Badge tone={PO_STATUS_TONES[pass.po_lookup_status]}>{t(PO_STATUS_KEYS[pass.po_lookup_status])}</Badge>, hidden: !inward },
          { key: 'challan', label: t('fieldChallanNumber'), value: mono(pass.challan_number), hidden: !inward },
          { key: 'reference', label: t('placeholderRefDoc'), value: mono(pass.reference_doc_number), hidden: inward },
          { key: 'driver', label: t('fieldDriverName'), value: pass.driver_name },
          { key: 'entry', label: t('colEntry'), value: formatFullDateTime(pass.entry_time, locale) },
          { key: 'exit', label: t('colExit'), value: formatFullDateTime(pass.exit_time, locale) },
          { key: 'override', label: t('passManualOverride'), value: pass.manual_override ? <Badge tone="warn">{t('passManualOverrideYes')}</Badge> : null, hidden: !inward },
        ]}
      />
      {inward && pass.challan_lines?.length > 0 && <ChallanLinesTable pass={pass} />}
    </Section>
  )
}

function ChallanLinesTable({ pass }) {
  const { t } = useLanguage()
  const qualityByLine = new Map((pass.quality?.lines ?? []).map((line) => [line.challan_line_id, line]))
  return (
    <div className="grn-table-wrap mt-3">
      <table className="grn-table">
        <thead>
          <tr>
            <th scope="col">{t('fieldMaterial')}</th>
            <th scope="col" className="num">{t('grnColChallanQty')}</th>
            <th scope="col" className="num">{t('grnColAccepted')}</th>
            <th scope="col" className="num">{t('grnColRejected')}</th>
          </tr>
        </thead>
        <tbody>
          {pass.challan_lines.map((line) => {
            const quality = qualityByLine.get(line.id)
            return (
              <tr key={line.id}>
                <td>{line.material} <span className="text-xs">({line.uom})</span></td>
                <td className="num gp-mono">{formatQty(line.quantity)}</td>
                <td className="num gp-mono">{formatQty(quality?.accepted_qty)}</td>
                <td className="num gp-mono">{formatQty(quality?.rejected_qty)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function WeighingSection({ pass }) {
  const { t } = useLanguage()
  const kg = (value) => (value === null || value === undefined ? null : <span className="gp-mono">{formatWeight(value)} kg</span>)
  return (
    <Section id="pass-weighing" title={t('passWeighing')}>
      <Facts
        items={[
          { key: 'gross', label: t('weighKindGross'), value: kg(pass.current_gross_kg) },
          { key: 'tare', label: t('weighKindTare'), value: kg(pass.current_tare_kg) },
          { key: 'net', label: t('weighNet'), value: kg(pass.net_kg) },
        ]}
      />
      <div className="mt-3"><WeighmentHistory weighments={pass.weighments ?? []} /></div>
    </Section>
  )
}

function QualityAndGrnSection({ pass }) {
  const { t, locale } = useLanguage()
  const { quality, grn } = pass
  return (
    <Section id="pass-quality-grn" title={t('passQualityGrn')}>
      <Facts
        items={[
          { key: 'quality', label: t('grnQuality'), value: quality ? <QualityResultPill result={quality.result} /> : t('passNotYet') },
          { key: 'inspector', label: t('grnInspectedBy'), value: quality?.inspected_by_name, hidden: !quality },
          { key: 'inspectedAt', label: t('passInspectedAt'), value: formatFullDateTime(quality?.inspected_at, locale), hidden: !quality },
          { key: 'grn', label: t('passGrnStatus'), value: grn ? t(grn.status === 'draft' ? 'stateGrnDraft' : 'stateGrnApproved') : t('passNotYet') },
          { key: 'erp', label: t('passErpStatus'), value: grn?.erp_status && <ErpStatusPill status={grn.erp_status} />, hidden: !grn?.erp_status },
          { key: 'erpNo', label: t('passErpGrnNumber'), value: grn?.erp_grn_number && <span className="gp-mono">{grn.erp_grn_number}</span>, hidden: !grn?.erp_grn_number },
          { key: 'return', label: t('grnReturnPass'), value: grn?.return_pass_number && <span className="gp-mono">{grn.return_pass_number}</span>, hidden: !grn?.return_pass_number },
          { key: 'rejected', label: t('passTotalRejected'), value: <span className="gp-mono">{formatQty(grn?.total_rejected_qty)}</span>, hidden: !grn },
        ]}
      />
    </Section>
  )
}

function PhotosSection({ pass, photosPending }) {
  const { t } = useLanguage()
  const photos = pass.photos ?? []
  return (
    <Section id="pass-photos" title={t('passPhotos')}>
      {photosPending && <div className="gp-banner gp-banner-info mb-3" role="status">{t('passPhotoUploadPending')}</div>}
      {photos.length === 0 ? (
        <p className="text-sm">{t('passNoPhotos')}</p>
      ) : (
        <ul className="pass-photos">
          {photos.map((photo) => {
            const kindLabel = t(PHOTO_KIND_KEYS[photo.kind] ?? 'photoKindOther')
            return (
              <li key={photo.id}>
                <a href={`/uploads/${photo.file_path}`} target="_blank" rel="noreferrer">
                  <img src={`/uploads/${photo.file_path}`} alt={kindLabel} className="pass-photo" loading="lazy" />
                </a>
                <span className="text-xs">{kindLabel}</span>
              </li>
            )
          })}
        </ul>
      )}
    </Section>
  )
}

function PassActions({ pass }) {
  const { t } = useLanguage()
  const { user } = useAuth()
  const actions = passActionsFor(pass, user.role)
  if (actions.length === 0) return null
  return (
    <div className="pass-actions">
      {actions.map(({ id, to, labelKey, primary }) => (
        <Link key={id} to={to} className={`gp-btn gp-btn-md ${primary ? 'gp-btn-primary' : 'gp-btn-secondary'}`}>
          {t(labelKey)}
        </Link>
      ))}
    </div>
  )
}

function PassHeader({ pass }) {
  return (
    <div className="pass-header">
      <PlateChip number={pass.vehicle_number} size="lg" />
      <StatePill state={pass.pass_state} passType={pass.pass_type} erpStatus={pass.grn?.erp_status} />
      {pass.supplier_transporter_name && <p className="pass-header-supplier">{pass.supplier_transporter_name}</p>}
    </div>
  )
}

function usePhotosPending(passId) {
  const { pending, needsAttention } = useGateInQueue()
  return [...pending, ...needsAttention].some((item) => String(item.pass_id) === String(passId) && item.photos.length > 0)
}

// Pass detail (/passes/:id): journey, documents, weighing, quality, GRN,
// photos by kind, audit timeline, and the next action this role can take.
export default function PassDetailPage() {
  const { t } = useLanguage()
  const { id } = useParams()
  const { pass, loading, failed, errorDetail, reload } = usePassDetail(id)
  const photosPending = usePhotosPending(id)

  const heading = <PageHeading kicker={t('navGroupOperations')} title={t('navPassDetail')} />
  if (!pass && loading) return <div className="page-screen">{heading}<p role="status">{t('loading')}</p></div>
  if (!pass) {
    return (
      <div className="page-screen">
        {heading}
        <div className="gp-banner gp-banner-crit" role="alert">
          {translateApiDetail(failed ? errorDetail : null, t, 'passLoadFailed')}{' '}
          <Button size="sm" variant="secondary" onClick={reload}>{t('retry')}</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="page-screen page-pass-detail">
      {heading}
      <PassHeader pass={pass} />
      <PassJourney pass={pass} />
      <PassActions pass={pass} />
      <div className="pass-grid">
        <DocumentsSection pass={pass} />
        <WeighingSection pass={pass} />
        {isInward(pass) && <QualityAndGrnSection pass={pass} />}
        <PhotosSection pass={pass} photosPending={photosPending} />
        <Section id="pass-audit" title={t('passAudit')}>
          <PassTimeline audit={pass.audit} />
        </Section>
      </div>
    </div>
  )
}
