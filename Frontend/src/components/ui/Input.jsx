export default function Input({ className = '', ...props }) {
  return (
    <input
      className={`rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-gp-accent focus:outline-none focus:ring-3 focus:ring-gp-accent/30 ${className}`}
      {...props}
    />
  )
}
