import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { GRN_WORK_GROUPS, retryGrnPost, sendToQuality, startGrn } from '../api/grn'
import GrnEditor from '../components/GrnEditor'
import Button from '../components/ui/Button'
import ListState from '../components/ui/ListState'
import PlateChip from '../components/ui/PlateChip'
import StatePill from '../components/ui/StatePill'
import { useLanguage } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import { useStoreWorkList } from '../hooks/useStoreWork'
import { apiErrorMessage, translateApiDetail } from '../i18n/apiErrors'
import { formatDuration } from '../utils/duration'

// The open GRN lives in the URL (?pass=<id>) so the phone back button returns to the list.
const PASS_PARAM = 'pass'

const GROUPS = [
  { id: GRN_WORK_GROUPS.sendForInspection, titleKey: 'grnGroupSendForInspection', hintKey: 'grnGroupSendForInspectionHint' },
  { id: GRN_WORK_GROUPS.readyForGrn, titleKey: 'grnGroupReady', hintKey: 'grnGroupReadyHint' },
  { id: GRN_WORK_GROUPS.draft, titleKey: 'grnGroupDrafts', hintKey: 'grnGroupDraftsHint' },
  { id: GRN_WORK_GROUPS.pendingPost, titleKey: 'grnGroupPendingPost', hintKey: 'grnGroupPendingPostHint' },
]

function ItemAction({ item, busy, onAction }) {
  const { t } = useLanguage()
  const action = (type, labelKey, variant = 'primary') => (
    <Button size="sm" variant={variant} disabled={busy} onClick={() => onAction(type, item)}>
      {t(labelKey)}
    </Button>
  )
  if (item.group === GRN_WORK_GROUPS.sendForInspection) return action('sendToQuality', 'grnSendForInspection')
  if (item.group === GRN_WORK_GROUPS.readyForGrn) return action('start', 'grnStart')
  if (item.group === GRN_WORK_GROUPS.pendingPost) {
    return (
      <>
        {action('retry', 'grnRetryPost')}
        {action('open', 'grnOpen', 'secondary')}
      </>
    )
  }
  return action('open', 'grnOpen')
}

function WorkItem({ item, busy, onAction }) {
  const { t } = useLanguage()
  return (
    <li className="grn-work-item">
      <div className="grn-work-main">
        <PlateChip number={item.vehicle_number} size="md" />
        <StatePill state={item.pass_state} passType="inward" erpStatus={item.erp_status} />
        {item.minutes_in_state != null && (
          <span className="text-xs">{t('grnInStateFor')} <span className="gp-mono">{formatDuration(item.minutes_in_state)}</span></span>
        )}
      </div>
      <p className="grn-work-supplier" title={item.supplier ?? ''}>{item.supplier || '—'}</p>
      <p className="m-0 text-xs">
        {t('fieldPoNumber')} <span className="gp-mono">{item.po_number || '—'}</span> · {t('fieldChallanNumber')}{' '}
        <span className="gp-mono">{item.challan_number || '—'}</span>
      </p>
      {item.group === GRN_WORK_GROUPS.pendingPost && item.erp_last_error && (
        <p className="grn-work-error">{item.erp_last_error}</p>
      )}
      <div className="grn-work-actions">
        <ItemAction item={item} busy={busy} onAction={onAction} />
      </div>
    </li>
  )
}

function WorkGroup({ group, items, busyId, onAction }) {
  const { t } = useLanguage()
  const headingId = `grn-group-${group.id}`
  return (
    <section className="grn-group" aria-labelledby={headingId}>
      <h2 id={headingId} className="grn-group-title">
        {t(group.titleKey)} <span className="grn-group-count gp-mono">{items.length}</span>
      </h2>
      <p className="grn-group-hint">{t(group.hintKey)}</p>
      {items.length === 0 ? (
        <p className="grn-group-empty">{t('grnGroupEmpty')}</p>
      ) : (
        <ul className="grn-work-list">
          {items.map((item) => (
            <WorkItem key={item.entry_id} item={item} busy={busyId === item.entry_id} onAction={onAction} />
          ))}
        </ul>
      )}
    </section>
  )
}

const ACTION_CALLS = {
  sendToQuality: { call: sendToQuality, successKey: 'grnToastSentToQuality' },
  start: { call: startGrn, successKey: 'grnToastStarted', opensEditor: true },
  retry: { call: retryGrnPost, successKey: null },
}

function useWorkActions({ refresh, openPass }) {
  const { t } = useLanguage()
  const { showToast } = useToast()
  const [busyId, setBusyId] = useState(null)

  return {
    busyId,
    onAction: async (type, item) => {
      if (type === 'open') {
        openPass(item.entry_id)
        return
      }
      const { call, successKey, opensEditor } = ACTION_CALLS[type]
      setBusyId(item.entry_id)
      try {
        await call(item.entry_id)
        if (successKey) showToast(t(successKey), 'success')
        if (opensEditor) openPass(item.entry_id)
        else refresh()
      } catch (err) {
        if (!err.isSessionExpired) showToast(apiErrorMessage(err, t, 'grnToastFailed'), 'error')
        refresh()
      } finally {
        setBusyId(null)
      }
    },
  }
}

function WorkList({ onOpenPass }) {
  const { t } = useLanguage()
  const { items, loading, failed, errorDetail, refresh } = useStoreWorkList()
  const { busyId, onAction } = useWorkActions({ refresh, openPass: onOpenPass })
  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button variant="secondary" size="sm" onClick={refresh} disabled={loading} aria-busy={loading}>
          {loading ? t('refreshing') : t('refresh')}
        </Button>
      </div>
      <ListState
        loading={loading}
        error={failed ? translateApiDetail(errorDetail, t, 'grnLoadFailed') : null}
        isEmpty={items.length === 0}
        onRetry={refresh}
        emptyMessage={t('grnWorkEmpty')}
      >
        <div className="grn-groups">
          {GROUPS.map((group) => (
            <WorkGroup key={group.id} group={group} items={items.filter((item) => item.group === group.id)} busyId={busyId} onAction={onAction} />
          ))}
        </div>
      </ListState>
    </>
  )
}

// Stores / GRN section (/entries/grn). EntriesPage renders the page heading.
export default function GrnPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const passId = searchParams.get(PASS_PARAM)

  if (passId) return <GrnEditor key={passId} entryId={passId} onBack={() => setSearchParams({})} />
  return <WorkList onOpenPass={(id) => setSearchParams({ [PASS_PARAM]: String(id) })} />
}
