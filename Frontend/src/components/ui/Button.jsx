import { forwardRef } from 'react'

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

// forwardRef so dialogs can move focus to a specific action button.
const Button = forwardRef(function Button({ variant = 'primary', size = 'md', type = 'button', className = '', ...props }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      className={`gp-btn ${VARIANTS[variant] ?? VARIANTS.primary} ${SIZES[size] ?? SIZES.md} ${className}`}
      {...props}
    />
  )
})

export default Button
