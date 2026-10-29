export default function Card({ className = '', children }) {
  return (
    <div className={`rounded-xl border border-gp-line bg-gp-surface p-6 shadow-sm ${className}`}>
      {children}
    </div>
  )
}
