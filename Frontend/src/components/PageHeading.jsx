// Page title block used by every signed-in page. Hidden below lg, where the
// mobile top bar shows the title instead. `actions` sit on the right.
export default function PageHeading({ kicker, title, description, actions }) {
  return (
    <div className="page-heading mb-5">
      <div>
        {kicker && <p className="page-kicker">{kicker}</p>}
        <h1 className="mb-1 text-2xl font-bold text-slate-900">{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {actions && <div className="page-heading-actions">{actions}</div>}
    </div>
  )
}
