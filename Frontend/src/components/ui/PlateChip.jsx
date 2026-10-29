import { formatPlate } from '../../utils/plate'

const SIZES = {
  sm: 'gp-plate-sm',
  md: 'gp-plate-md',
  lg: 'gp-plate-lg',
}

const EMPTY_VALUE = '-'

// Yellow number-plate chip. `number` is the stored vehicle number; it is
// shown with spaces ("MH 12 AB 1234"). Plates are never translated.
export default function PlateChip({ number, size = 'md', className = '' }) {
  const plate = formatPlate(number)
  if (!plate) return <span className={`gp-plate-empty ${className}`}>{EMPTY_VALUE}</span>

  return (
    <span className={`gp-plate ${SIZES[size] ?? SIZES.md} ${className}`} lang="en" translate="no">
      {plate}
    </span>
  )
}
