// Status pill in the mockup style. Tones follow the colour coding:
// good = complete / approved, warn = in progress / low confidence,
// crit = hard gate / attention / failed, info = posted / informational,
// accent = OCR source / highlight, neutral = closed / other.
const TONES = {
  good: 'gp-pill-good',
  warn: 'gp-pill-warn',
  crit: 'gp-pill-crit',
  info: 'gp-pill-info',
  accent: 'gp-pill-accent',
  neutral: 'gp-pill-neutral',
}

// Names used before the palette change, kept so older screens keep working.
const LEGACY_TONES = { green: 'good', blue: 'info', slate: 'neutral' }

export function toneClass(tone) {
  return TONES[LEGACY_TONES[tone] ?? tone] ?? TONES.neutral
}

export default function Badge({ tone = 'neutral', dot = false, title, className = '', children }) {
  return (
    <span className={`gp-pill ${toneClass(tone)} ${className}`} title={title}>
      {dot && <span className="gp-pill-dot" aria-hidden="true" />}
      <span className="gp-pill-text">{children}</span>
    </span>
  )
}
