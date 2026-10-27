const VARIANTS = {
  primary: 'bg-cyan-700 hover:bg-cyan-800 text-white',
  danger: 'bg-red-600 hover:bg-red-700 text-white',
  warning: 'bg-amber-500 hover:bg-amber-600 text-white',
  secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-800',
  ghost: 'bg-slate-800 hover:bg-slate-700 text-white',
}

const SIZES = {
  md: 'px-4 py-2 text-sm',
  sm: 'px-2.5 py-1 text-xs',
}

export default function Button({ variant = 'primary', size = 'md', className = '', ...props }) {
  return (
    <button
      className={`rounded-lg font-semibold shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    />
  )
}
