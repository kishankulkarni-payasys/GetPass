import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { getPassDetail, getPassGrn } from '../api/gateOut'
import { gateOutKeys } from '../api/queryKeys'
import PageHeading from '../components/PageHeading'
import Button from '../components/ui/Button'
import ListState from '../components/ui/ListState'
import PlateChip from '../components/ui/PlateChip'
import { useBreadcrumbDetail } from '../context/BreadcrumbContext'
import { useLanguage } from '../context/LanguageContext'
import { apiErrorDetail, translateApiDetail } from '../i18n/apiErrors'
import { passDetailPath } from '../navigation/navItems'
import { formatFullDateTime } from '../utils/formatDate'
import './ReturnPassPage.css'

const SKELETON_COUNT = 1

async function loadReturnPass(entryId) {
  const detail = await getPassDetail(entryId)
  const grn = detail.grn?.return_pass_number ? await getPassGrn(entryId) : null
  const lines = (grn?.lines ?? []).filter((line) => Number(line.rejected_qty) > 0)
  return { detail, lines }
}

// Pass header + GRN lines. Only lines with a rejected quantity go on the
// out-pass. The query key carries the id, so React Query never shows one
// pass's sheet under another pass's URL.
function useReturnPass(entryId) {
  const query = useQuery({
    queryKey: gateOutKeys.returnPass(entryId),
    queryFn: () => loadReturnPass(entryId),
  })

  return {
    loading: query.isLoading,
    errorDetail: query.isError ? apiErrorDetail(query.error) : undefined,
    detail: query.data?.detail ?? null,
    lines: query.data?.lines ?? [],
    reload: query.refetch,
  }
}

function Fact({ label, children, mono = false }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className={mono ? 'gp-mono' : ''}>{children || '-'}</dd>
    </div>
  )
}

function RejectedLines({ lines }) {
  const { t } = useLanguage()
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr>
            <th scope="col">{t('returnPassColLine')}</th>
            <th scope="col">{t('returnPassColMaterial')}</th>
            <th scope="col" className="text-end">{t('returnPassColQty')}</th>
            <th scope="col">{t('returnPassColUom')}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id}>
              <td className="gp-mono">{line.line_no}</td>
              <td>{line.material}</td>
              <td className="gp-mono text-end font-bold">{line.rejected_qty}</td>
              <td>{line.uom}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ReturnPassSheet({ detail, lines }) {
  const { t, locale } = useLanguage()
  const { grn } = detail
  return (
    <article className="return-pass-sheet" aria-labelledby="return-pass-title">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-semibold text-slate-600" lang="en">GatePass</p>
          <h2 id="return-pass-title" className="mb-0 text-xl font-bold">{t('returnPassTitle')}</h2>
        </div>
        <PlateChip number={detail.vehicle_number} size="lg" />
      </header>
      <dl className="return-pass-facts">
        <Fact label={t('returnPassNumber')} mono>{grn.return_pass_number}</Fact>
        <Fact label={t('returnPassDate')}>{formatFullDateTime(grn.approved_at, locale)}</Fact>
        <Fact label={t('returnPassGrnNo')} mono>{grn.erp_grn_number}</Fact>
        <Fact label={t('returnPassSupplier')}>{detail.supplier_transporter_name}</Fact>
        <Fact label={t('returnPassPo')} mono>{detail.po_number}</Fact>
        <Fact label={t('returnPassChallan')} mono>{detail.challan_number}</Fact>
        <Fact label={t('returnPassVehicle')} mono>{detail.vehicle_number}</Fact>
        <Fact label={t('returnPassDriver')}>{detail.driver_name}</Fact>
      </dl>
      <h3 className="mb-2 text-base font-bold">{t('returnPassLinesTitle')}</h3>
      <RejectedLines lines={lines} />
      <div className="return-pass-signatures">
        {['returnPassSignSecurity', 'returnPassSignStores', 'returnPassSignDriver'].map((key) => (
          <div key={key} className="return-pass-signature">
            <strong className="block">{t(key)}</strong>
            <span className="text-xs text-slate-600">{t('returnPassSignNote')}</span>
          </div>
        ))}
      </div>
    </article>
  )
}

function ReturnPassActions({ entryId, canPrint }) {
  const { t } = useLanguage()
  return (
    <div className="no-print flex flex-wrap gap-2">
      <Link to={passDetailPath(entryId)} className="gp-btn gp-btn-secondary gp-btn-md">{t('returnPassBackToPass')}</Link>
      {canPrint && <Button onClick={() => window.print()}>{t('returnPassPrint')}</Button>}
    </div>
  )
}

// Printable reject-return out-pass (/passes/:id/return-pass). The app shell
// is hidden by the print styles in index.css; on-screen-only controls carry `no-print`.
export default function ReturnPassPage() {
  const { t } = useLanguage()
  const { id } = useParams()
  const { loading, errorDetail, detail, lines, reload } = useReturnPass(id)
  // The loaded pass's own id, so the crumb can never pair this URL with another pass.
  useBreadcrumbDetail(detail?.id, detail?.vehicle_number)
  const hasReturnPass = Boolean(detail?.grn?.return_pass_number)
  const error = errorDetail !== undefined ? translateApiDetail(errorDetail, t, 'returnPassErrorLoad') : null

  return (
    <div className="page-screen page-return-pass">
      <PageHeading kicker={t('navGroupOperations')} title={t('navReturnPass')} description={t('returnPassDescription')} />
      {/* Outside PageHeading on purpose: the heading is hidden on phones. */}
      <div className="mb-4">
        <ReturnPassActions entryId={id} canPrint={hasReturnPass} />
      </div>
      <ListState
        loading={loading}
        error={error}
        isEmpty={!hasReturnPass}
        onRetry={reload}
        emptyMessage={t('returnPassNone')}
        loadingLabel={t('returnPassLoading')}
        skeletonCount={SKELETON_COUNT}
      >
        {hasReturnPass && <ReturnPassSheet detail={detail} lines={lines} />}
      </ListState>
    </div>
  )
}
