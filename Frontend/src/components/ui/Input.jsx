// Generous padding (12-16px) and a visible border at rest, with a clear
// accent-coloured ring on focus (design-system brief).
export default function Input({ className = '', ...props }) {
  return (
    <input
      className={`rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-gp-accent focus:outline-none focus:ring-3 focus:ring-gp-accent/35 disabled:cursor-not-allowed disabled:bg-gp-surface-2 disabled:text-gp-muted disabled:opacity-70 ${className}`}
      {...props}
    />
  )
}
