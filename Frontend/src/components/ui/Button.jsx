// Styles live in index.css (.gp-btn-*) so the primary fill can use the
// AA-safe accent ink token instead of the bright accent.
const VARIANTS = {
  primary: 'gp-btn-primary',
  secondary: 'gp-btn-secondary',
  danger: 'gp-btn-danger',
  warning: 'gp-btn-warning',
  ghost: 'gp-btn-ghost',
}

const SIZES = {
  sm: 'gp-btn-sm',
  md: 'gp-btn-md',
  lg: 'gp-btn-lg',
}

export default function Button({ variant = 'primary', size = 'md', type = 'button', className = '', ...props }) {
  return (
    <button
      type={type}
      className={`gp-btn ${VARIANTS[variant] ?? VARIANTS.primary} ${SIZES[size] ?? SIZES.md} ${className}`}
      {...props}
    />
  )
}
