import { useLanguage } from '../context/LanguageContext'
import { formatWeight } from './WeighIndicator'

function kgText(value) {
  return value === null || value === undefined ? null : `${formatWeight(value)} kg`
}

// Loaded (gross), empty (tare) and net material weight of one pass, from the list or detail API.
// `layout="inline"` is a compact stack for table cells and cards; the default is a 3-column grid.
export default function PassWeights({ pass, layout = 'grid' }) {
  const { t } = useLanguage()
  const items = [
    { key: 'gross', label: t('weighLoadedGross'), value: kgText(pass.current_gross_kg) },
    { key: 'tare', label: t('weighEmptyTare'), value: kgText(pass.current_tare_kg) },
    { key: 'net', label: t('weighNetMaterial'), value: kgText(pass.net_kg) },
  ]

  if (layout === 'inline') {
    return (
      <span className="flex flex-col gap-0.5 text-xs">
        {items.map(({ key, label, value }) => (
          <span key={key} className={key === 'net' ? 'font-semibold text-slate-900' : 'text-slate-600'}>
            {label}: <span className={`gp-mono ${value ? '' : 'text-gp-warn-ink'}`}>{value ?? t('weighPending')}</span>
          </span>
        ))}
      </span>
    )
  }

  return (
    <dl className="grid grid-cols-3 gap-2">
      {items.map(({ key, label, value }) => (
        <div key={key} className={`min-w-0 rounded-lg border border-gp-line p-2 ${key === 'net' ? 'bg-gp-surface-2' : ''}`}>
          <dt className="text-xs font-medium text-slate-600">{label}</dt>
          <dd className={`gp-mono mb-0 text-sm ${key === 'net' ? 'font-bold text-slate-900' : 'text-slate-900'} ${value ? '' : 'text-gp-warn-ink'}`}>
            {value ?? t('weighPending')}
          </dd>
        </div>
      ))}
    </dl>
  )
}
