// Flat surface card: elevation comes from the border, not a drop shadow
// (see the design-system brief — cards rely on --gp-line, never box-shadow).
export default function Card({ className = '', children }) {
  return (
    <div className={`rounded-xl border border-gp-line bg-gp-surface p-6 ${className}`}>
      {children}
    </div>
  )
}
