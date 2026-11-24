// `md` gets the brief's generous 12-16px padding; `sm` stays a compact
// variant for dense contexts (inline table/filter selects).
const SIZES = {
  md: 'px-4 py-3 text-sm',
  sm: 'px-3 py-1.5 text-xs',
}

export default function Select({ className = '', size = 'md', children, ...props }) {
  return (
    <select
      className={`rounded-lg border border-slate-300 text-slate-900 focus:border-gp-accent focus:outline-none focus:ring-3 focus:ring-gp-accent/35 disabled:cursor-not-allowed disabled:bg-gp-surface-2 disabled:text-gp-muted disabled:opacity-70 ${SIZES[size]} ${className}`}
      {...props}
    >
      {children}
    </select>
  )
}
