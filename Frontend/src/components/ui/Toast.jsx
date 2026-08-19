const STYLES = {
  success: 'border-green-500 text-green-800 bg-green-50',
  error: 'border-red-500 text-red-800 bg-red-50',
}

export default function Toast({ type = 'success', children, onClose }) {
  return (
    <div className={`flex items-start justify-between gap-3 rounded-lg border-l-4 p-4 shadow-md ${STYLES[type]}`}>
      <p className="text-sm font-medium">{children}</p>
      <button onClick={onClose} className="text-lg leading-none text-slate-400 hover:text-slate-600">
        &times;
      </button>
    </div>
  )
}
