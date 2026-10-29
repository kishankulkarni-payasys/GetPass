const SIZES = {
  md: 'px-3 py-2 text-sm',
  sm: 'px-2 py-1 text-xs',
}

export default function Select({ className = '', size = 'md', children, ...props }) {
  return (
    <select
      className={`rounded-lg border border-slate-300 text-slate-900 focus:border-gp-accent focus:outline-none focus:ring-3 focus:ring-gp-accent/30 ${SIZES[size]} ${className}`}
      {...props}
    >
      {children}
    </select>
  )
}
