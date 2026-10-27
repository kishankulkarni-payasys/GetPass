// Stroke icons for navigation, drawn in the same style as the sidebar icons.
const ICON_PATHS = {
  new: 'M12 8.5v7m-3.5-3.5h7M6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5v-11A2.5 2.5 0 0 1 6.5 4Z',
  log: 'M9 4.5h6M9 4.5a1.5 1.5 0 0 0 0 3h6a1.5 1.5 0 0 0 0-3M9 4.5H7a2 2 0 0 0-2 2V19a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6.5a2 2 0 0 0-2-2h-2M8.5 12h7m-7 4h4.5',
  weighbridge: 'M12 4v3m-6.5 0h13M5.5 7 3 13a3 3 0 0 0 5 0L5.5 7Zm13 0L16 13a3 3 0 0 0 5 0l-2.5-6ZM12 7v12m-4 1h8',
  users: 'M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20m7-9a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm6-6a4 4 0 0 1 0 7.75M21 20v-1.5a4 4 0 0 0-3-3.87',
  account: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-9.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-5.6 6.9a6.5 6.5 0 0 1 11.2 0',
  entries: 'M3 7.5h18M6 4.5h12a2 2 0 0 1 2 2v13H4v-13a2 2 0 0 1 2-2Zm2 7h3m-3 4h8',
  signOut: 'M10 17l5-5-5-5m5 5H3m9-9h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6',
}

export default function NavIcon({ name, className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" focusable="false" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d={ICON_PATHS[name]} />
    </svg>
  )
}
