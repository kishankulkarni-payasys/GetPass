import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { getDashboardSummary } from '../api/dashboard'
import { dashboardKeys } from '../api/queryKeys'
import PageHeading from '../components/PageHeading'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import ListState from '../components/ui/ListState'
import Pagination from '../components/ui/Pagination'
import { usePagination } from '../hooks/usePagination'
import PlateChip from '../components/ui/PlateChip'
import RecordCard, { RecordCardList } from '../components/ui/RecordCard'
import StatePill from '../components/ui/StatePill'
import { useLanguage } from '../context/LanguageContext'
import { apiErrorDetail, translateApiDetail } from '../i18n/apiErrors'
import { passDetailPath } from '../navigation/navItems'
import { formatDwell } from '../utils/dwell'
import { PASS_STATES } from '../utils/passStates'
import './DashboardPage.css'

const POLL_INTERVAL_MS = 30000
const LOADING_SKELETON_COUNT = 2
const QTY_SOURCE_CHALLAN = 'challan'
const TIME_ONLY = { hour: 'numeric', minute: '2-digit', hour12: true }

// The date input works in the browser's local calendar day ("YYYY-MM-DD").
function localToday() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function formatClock(date, locale) {
  // Latin digits in every language, as in utils/formatDate.js.
  return date.toLocaleTimeString(`${locale}-u-nu-latn`, TIME_ONLY).toLowerCase()
}

// Polls every 30 s while the tab is visible and reloads at once when it
// becomes visible again. Keyed by day, so switching the date shows that
// day's loading/empty state instead of the previous day's board.
function useDashboardSummary(day) {
  const [updatedAt, setUpdatedAt] = useState(null)
  const query = useQuery({
    queryKey: dashboardKeys.summary(day),
    queryFn: () => getDashboardSummary(day),
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  })

  useEffect(() => {
    if (query.dataUpdatedAt) setUpdatedAt(new Date(query.dataUpdatedAt))
  }, [query.dataUpdatedAt])

  // undefined = no error; null = failed without a server message.
  const errorDetail = query.isError ? apiErrorDetail(query.error) : undefined
  return {
    summary: query.data ?? null,
    loading: query.isFetching,
    hasError: query.isError,
    errorDetail,
    updatedAt,
    refresh: query.refetch,
  }
}

function KpiTile({ value, label, note, alert = false }) {
  return (
    <div className={`dashboard-kpi ${alert ? 'dashboard-kpi-alert' : ''}`}>
      <div className="dashboard-kpi-value">{value}</div>
      <div className="dashboard-kpi-label">{label}</div>
      {note && <div className="dashboard-kpi-note">{note}</div>}
    </div>
  )
}

function KpiTiles({ kpis }) {
  const { t } = useLanguage()
  const qualityAlert = kpis.quality_over_sla > 0
  const hasAvgDwell = kpis.avg_dwell_minutes !== null && kpis.avg_dwell_minutes !== undefined
  return (
    <section className="dashboard-kpis" aria-label={t('dashboardKpisAria')}>
      <KpiTile value={kpis.on_site_now} label={t('dashboardKpiOnSite')} note={t('dashboardKpiVehicles', { count: kpis.vehicles_today })} />
      <KpiTile
        value={kpis.awaiting_quality}
        label={t('dashboardKpiAwaitingQuality')}
        note={qualityAlert ? t('dashboardKpiOverSla', { count: kpis.quality_over_sla }) : null}
        alert={qualityAlert}
      />
      <KpiTile value={kpis.grn_pending_post} label={t('dashboardKpiGrnPendingPost')} />
      <KpiTile
        value={formatDwell(kpis.avg_dwell_minutes)}
        label={t('dashboardKpiAvgDwell')}
        note={hasAvgDwell ? null : t('dashboardKpiAvgDwellNone')}
      />
    </section>
  )
}

// Awaiting quality longer than the quality limit: the row turns red (AC38).
function isQualityAlert(row, qualitySlaMinutes) {
  return row.pass_state === PASS_STATES.qualityPending && (row.minutes_in_state ?? 0) > qualitySlaMinutes
}

function DwellValue({ row }) {
  const { t } = useLanguage()
  return (
    <span className={`gp-mono ${row.over_sla ? 'dashboard-dwell-over' : ''}`}>
      {formatDwell(row.dwell_minutes)}
      {row.over_sla && <span className="visually-hidden"> ({t('dashboardOverSla')})</span>}
    </span>
  )
}

function qtySourceText(row, t) {
  return row.qty_source === QTY_SOURCE_CHALLAN ? t('dashboardQtySourceChallan') : '—'
}

function BoardRowPill({ row }) {
  return <StatePill state={row.pass_state} passType={row.pass_type} erpStatus={row.erp_status} />
}

function BoardTable({ rows, qualitySlaMinutes }) {
  const { t } = useLanguage()
  const navigate = useNavigate()
  return (
    <Card className="dashboard-board entry-desktop-table overflow-x-auto p-0">
      <table className="min-w-full text-sm">
        <thead>
          <tr>
            <th scope="col">{t('dashboardColVehicle')}</th>
            <th scope="col">{t('dashboardColSupplier')}</th>
            <th scope="col">{t('dashboardColState')}</th>
            <th scope="col" className="text-end">{t('dashboardColDwell')}</th>
            <th scope="col">{t('dashboardColQtySource')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            // The plate link is the keyboard target; the whole row is a larger mouse target.
            <tr key={row.id} className={isQualityAlert(row, qualitySlaMinutes) ? 'dashboard-row-alert' : ''} onClick={() => navigate(passDetailPath(row.id))}>
              <td>
                <Link to={passDetailPath(row.id)} aria-label={t('logOpenPassFor', { vehicle: row.vehicle_number })} onClick={(e) => e.stopPropagation()}>
                  <PlateChip number={row.vehicle_number} size="sm" />
                </Link>
              </td>
              <td className="text-slate-600"><span className="dashboard-supplier" title={row.supplier || ''}>{row.supplier || '-'}</span></td>
              <td><BoardRowPill row={row} /></td>
              <td className="text-end"><DwellValue row={row} /></td>
              <td className="gp-mono text-xs text-slate-600">{qtySourceText(row, t)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

function BoardCards({ rows, qualitySlaMinutes }) {
  const { t } = useLanguage()
  return (
    <RecordCardList className="entry-cards">
      {rows.map((row) => (
        <RecordCard
          key={row.id}
          title={<PlateChip number={row.vehicle_number} size="sm" />}
          subtitle={row.supplier}
          badge={<BoardRowPill row={row} />}
          className={isQualityAlert(row, qualitySlaMinutes) ? 'dashboard-card-alert' : ''}
          details={[
            { label: t('dashboardColDwell'), value: <DwellValue row={row} /> },
            { label: t('dashboardColQtySource'), value: qtySourceText(row, t) },
          ]}
          actions={
            <Link to={passDetailPath(row.id)} className="gp-btn gp-btn-secondary gp-btn-sm" aria-label={t('logOpenPassFor', { vehicle: row.vehicle_number })}>
              {t('logOpenPass')}
            </Link>
          }
        />
      ))}
    </RecordCardList>
  )
}

function DashboardToolbar({ day, onDayChange, onRefresh, loading, updatedAt }) {
  const { t, locale } = useLanguage()
  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <label htmlFor="dashboard-day" className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        {t('dashboardDayLabel')}
        <Input id="dashboard-day" type="date" value={day} max={localToday()} onChange={(e) => onDayChange(e.target.value || localToday())} />
      </label>
      <Button variant="secondary" onClick={onRefresh} disabled={loading} aria-busy={loading}>
        {loading ? t('refreshing') : t('refresh')}
      </Button>
      <p className="mb-0 text-xs text-slate-600" aria-live="polite">
        {updatedAt && t('dashboardUpdatedAt', { time: formatClock(updatedAt, locale) })}
        <span className="block">{t('dashboardAutoRefresh')}</span>
      </p>
    </div>
  )
}

function DashboardBoard({ summary }) {
  const { t } = useLanguage()
  const { board, quality_sla_minutes: qualitySla, dwell_sla_minutes: dwellSla } = summary
  const pagination = usePagination(board)
  return (
    <section aria-labelledby="dashboard-board-title">
      <h2 id="dashboard-board-title" className="mb-1 text-base font-bold text-slate-900">{t('dashboardBoardTitle')}</h2>
      <p className="mb-3 text-sm text-slate-600">{t('dashboardBoardHint', { minutes: dwellSla })}</p>
      <ListState isEmpty={board.length === 0} emptyMessage={t('dashboardEmpty')}>
        <BoardCards rows={pagination.pageItems} qualitySlaMinutes={qualitySla} />
        <BoardTable rows={pagination.pageItems} qualitySlaMinutes={qualitySla} />
        <Pagination pagination={pagination} />
      </ListState>
    </section>
  )
}

// Control tower (/dashboard): KPI tiles and the live vehicle board.
export default function DashboardPage() {
  const { t } = useLanguage()
  const [day, setDay] = useState(localToday)
  const { summary, loading, hasError, errorDetail, updatedAt, refresh } = useDashboardSummary(day)
  const errorText = hasError ? translateApiDetail(errorDetail, t, 'dashboardErrorLoad') : null

  return (
    <div className="page-screen page-dashboard">
      <PageHeading kicker={t('navGroupOverview')} title={t('tabDashboard')} description={t('sectionDashboardDescription')} />
      <DashboardToolbar day={day} onDayChange={setDay} onRefresh={refresh} loading={loading} updatedAt={updatedAt} />
      {summary && hasError && (
        <p role="alert" className="gp-banner gp-banner-crit mb-4">
          {t('dashboardRefreshFailed')}
        </p>
      )}
      <ListState
        loading={loading}
        error={summary ? null : errorText}
        isEmpty={!summary}
        onRetry={refresh}
        loadingLabel={t('dashboardLoading')}
        skeletonCount={LOADING_SKELETON_COUNT}
      >
        {summary && (
          <div>
            <KpiTiles kpis={summary.kpis} />
            <DashboardBoard summary={summary} />
          </div>
        )}
      </ListState>
    </div>
  )
}
