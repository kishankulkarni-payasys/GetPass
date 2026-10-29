import { useState } from 'react'
import { useLanguage } from '../context/LanguageContext'
import { useEntryGroups } from '../hooks/useEntries'
import { formatDwell } from '../utils/dwell'
import { formatCardDateTime } from '../utils/formatDate'
import { PASS_STATES, PASS_TYPES } from '../utils/passStates'
import { normalizePlate } from '../utils/plate'
import { CancelSheet, ExitSheet } from './GateOutSheets'
import Button from './ui/Button'
import Input from './ui/Input'
import ListState from './ui/ListState'
import PlateChip from './ui/PlateChip'
import RecordCard, { RecordCardList } from './ui/RecordCard'
import StatePill from './ui/StatePill'

// Rule T7 / T8: inward passes leave only after GRN approval, general passes
// straight from gate-in. Inward passes still at the gate (no gross weight)
// cannot leave but may be cancelled (T9), so they are listed apart.
const GROUP_FILTERS = {
  inwardReady: { pass_type: PASS_TYPES.inward, state: PASS_STATES.grnApproved },
  generalOnSite: { pass_type: PASS_TYPES.general, state: PASS_STATES.gateIn },
  inwardAtGate: { pass_type: PASS_TYPES.inward, state: PASS_STATES.gateIn },
}

const SHEET_EXIT = 'exit'
const SHEET_CANCEL = 'cancel'

function byEntryTimeOldestFirst(a, b) {
  return new Date(a.entry_time) - new Date(b.entry_time)
}

function matchesPlate(pass, query) {
  return !query || normalizePlate(pass.vehicle_number).includes(query)
}

function GateOutCard({ pass, canLetOut, onOpen }) {
  const { t, locale } = useLanguage()
  const isInward = pass.pass_type === PASS_TYPES.inward
  const canCancel = pass.pass_state === PASS_STATES.gateIn
  return (
    <RecordCard
      caption={t(isInward ? 'passTypeInward' : 'passTypeGeneral')}
      title={<PlateChip number={pass.vehicle_number} size="sm" />}
      subtitle={pass.supplier_transporter_name}
      badge={<StatePill state={pass.pass_state} passType={pass.pass_type} erpStatus={pass.erp_status} />}
      details={[
        { label: t('gateOutLabelPo'), value: <span className="gp-mono">{pass.po_number}</span>, hidden: !isInward },
        { label: t('gateOutLabelChallan'), value: <span className="gp-mono">{pass.challan_number}</span>, hidden: !isInward },
        { label: t('gateOutLabelDriver'), value: pass.driver_name },
        { label: t('gateOutLabelEntry'), value: formatCardDateTime(pass.entry_time, locale) },
        { label: t('gateOutLabelDwell'), value: <span className="gp-mono">{formatDwell(pass.dwell_minutes)}</span> },
      ]}
      actions={
        <>
          {canCancel && (
            <Button variant="secondary" onClick={() => onOpen(pass, SHEET_CANCEL)} aria-label={t('gateOutCancelPassFor', { vehicle: pass.vehicle_number })}>
              {t('gateOutCancelPass')}
            </Button>
          )}
          {canLetOut && (
            <Button onClick={() => onOpen(pass, SHEET_EXIT)} aria-label={t('gateOutLetOutFor', { vehicle: pass.vehicle_number })}>
              {t('gateOutLetOut')}
            </Button>
          )}
        </>
      }
    />
  )
}

function GateOutGroup({ titleId, title, hint, passes, canLetOut, refreshing, onOpen }) {
  return (
    <section aria-labelledby={titleId} className="mb-6">
      <h2 id={titleId} className="mb-1 text-base font-bold text-slate-900">{title}</h2>
      {hint && <p className="mb-3 text-sm text-slate-600">{hint}</p>}
      <RecordCardList refreshing={refreshing} className="md:grid-cols-2 xl:grid-cols-3">
        {passes.map((pass) => <GateOutCard key={pass.id} pass={pass} canLetOut={canLetOut} onOpen={onOpen} />)}
      </RecordCardList>
    </section>
  )
}

function PlateSearch({ value, onChange }) {
  const { t } = useLanguage()
  return (
    <label htmlFor="gate-out-search" className="mb-4 flex max-w-md flex-col gap-1 text-xs font-medium text-slate-600">
      {t('gateOutSearchLabel')}
      <Input
        id="gate-out-search"
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('gateOutSearchPlaceholder')}
        autoComplete="off"
        className="w-full"
      />
    </label>
  )
}

// Gate-out section (/entries/gate-out). EntriesPage already renders the page
// heading, so this renders only the section content.
export default function GateOutTab() {
  const { t } = useLanguage()
  const { groups, loading, error, refresh } = useEntryGroups(GROUP_FILTERS, 'gateOutErrorLoad')
  const [search, setSearch] = useState('')
  const [sheet, setSheet] = useState(null)
  const query = normalizePlate(search)

  const ready = [...(groups.inwardReady ?? []), ...(groups.generalOnSite ?? [])]
    .filter((pass) => matchesPlate(pass, query))
    .sort(byEntryTimeOldestFirst)
  const atGate = (groups.inwardAtGate ?? []).filter((pass) => matchesPlate(pass, query)).sort(byEntryTimeOldestFirst)

  const openSheet = (pass, kind) => setSheet({ pass, kind })
  const closeSheet = () => setSheet(null)
  const finishSheet = () => {
    setSheet(null)
    refresh()
  }

  return (
    <div className="gate-out-page">
      <PlateSearch value={search} onChange={setSearch} />
      <ListState
        loading={loading}
        error={error}
        isEmpty={ready.length === 0 && atGate.length === 0}
        onRetry={refresh}
        emptyMessage={t(query ? 'gateOutEmptySearch' : 'gateOutEmptyReady')}
        loadingLabel={t('gateOutLoading')}
      >
        <GateOutGroup
          titleId="gate-out-ready"
          title={t('gateOutReadyTitle')}
          hint={ready.length > 0 ? t('gateOutReadyHint') : t(query ? 'gateOutEmptySearch' : 'gateOutEmptyReady')}
          passes={ready}
          canLetOut
          refreshing={loading}
          onOpen={openSheet}
        />
        {atGate.length > 0 && (
          <GateOutGroup
            titleId="gate-out-at-gate"
            title={t('gateOutAtGateTitle')}
            hint={t('gateOutAtGateHint')}
            passes={atGate}
            canLetOut={false}
            refreshing={loading}
            onOpen={openSheet}
          />
        )}
      </ListState>

      {sheet?.kind === SHEET_EXIT && <ExitSheet key={sheet.pass.id} pass={sheet.pass} onClose={closeSheet} onDone={finishSheet} />}
      {sheet?.kind === SHEET_CANCEL && <CancelSheet key={sheet.pass.id} pass={sheet.pass} onClose={closeSheet} onDone={finishSheet} />}
    </div>
  )
}
