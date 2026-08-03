import { Link, useLocation, useParams } from 'react-router-dom'

interface NavItem {
  path: string
  label: string
  icon: string
}

interface NavGroup {
  label: string | null
  items: NavItem[]
}

// Simple inline SVG path data keyed by icon name
const ICONS: Record<string, string> = {
  dashboard: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
  roster: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
  coaching: 'M9 11.75c-.69 0-1.25.56-1.25 1.25s.56 1.25 1.25 1.25 1.25-.56 1.25-1.25-.56-1.25-1.25-1.25zm6 0c-.69 0-1.25.56-1.25 1.25s.56 1.25 1.25 1.25 1.25-.56 1.25-1.25-.56-1.25-1.25-1.25zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8 0-.29.02-.58.05-.86 2.36-1.05 4.23-2.98 5.21-5.37C11.07 8.33 14.05 10 17.42 10c.78 0 1.53-.09 2.25-.26.21.71.33 1.47.33 2.26 0 4.41-3.59 8-8 8z',
  staff: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
  standings: 'M7.5 21H2V9h5.5v12zm7.25-18h-5.5v18h5.5V3zM22 11h-5.5v10H22V11z',
  schedule: 'M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z',
  scores: 'M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9h-4v4h-2v-4H9V9h4V5h2v4h4v2z',
  players: 'M12 5.9c1.16 0 2.1.94 2.1 2.1s-.94 2.1-2.1 2.1S9.9 9.16 9.9 8s.94-2.1 2.1-2.1m0 9c2.97 0 6.1 1.46 6.1 2.1v1.1H5.9V17c0-.64 3.13-2.1 6.1-2.1M12 4C9.79 4 8 5.79 8 8s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 9c-2.67 0-8 1.34-8 4v3h16v-3c0-2.66-5.33-4-8-4z',
  trades: 'M6.99 11L3 15l3.99 4v-3H14v-2H6.99v-3zM21 9l-3.99-4v3H10v2h7.01v3L21 9z',
  freeagency: 'M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
  awards: 'M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z',
  allstar: 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z',
  playoffs: 'M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4-6.2-4.6-6.2 4.6 2.4-7.4L2 9.4h7.6z',
  draft: 'M12 3L1 9l11 6 9-4.91V17h2V9M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z',
  transactions: 'M4 10h3v7H4zM10.5 10h3v7h-3zM2 19h20v3H2zM17 10h3v7h-3zM12 1L2 6v2h20V6z',
  history: 'M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z',
  settings: 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z',
  exit: 'M10.09 15.59L11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59zM19 3H5c-1.11 0-2 .9-2 2v4h2V5h14v14H5v-4H3v4c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z',
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [{ path: '', label: 'Dashboard', icon: 'dashboard' }],
  },
  {
    label: 'Team',
    items: [
      { path: 'team', label: 'Roster', icon: 'roster' },
      { path: 'coaching', label: 'Coaching', icon: 'coaching' },
      { path: 'staff', label: 'Staff', icon: 'staff' },
    ],
  },
  {
    label: 'League',
    items: [
      { path: 'standings', label: 'Standings', icon: 'standings' },
      { path: 'schedule', label: 'Schedule', icon: 'schedule' },
      { path: 'scores', label: 'Scores', icon: 'scores' },
      { path: 'players', label: 'Players', icon: 'players' },
      { path: 'transactions', label: 'Transactions', icon: 'transactions' },
    ],
  },
  {
    label: 'Moves',
    items: [
      { path: 'trades', label: 'Trade Block', icon: 'trades' },
      { path: 'free-agency', label: 'Free Agency', icon: 'freeagency' },
    ],
  },
  {
    label: 'Season',
    items: [
      { path: 'awards', label: 'Awards', icon: 'awards' },
      { path: 'all-star', label: 'All-Star', icon: 'allstar' },
      { path: 'playoffs', label: 'Playoffs', icon: 'playoffs' },
      { path: 'draft', label: 'Draft', icon: 'draft' },
      { path: 'history', label: 'History', icon: 'history' },
    ],
  },
]

function Icon({ name, className = '' }: { name: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" className={`shrink-0 ${className}`}>
      <path d={ICONS[name] ?? ''} />
    </svg>
  )
}

export default function LeagueSidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  const { id } = useParams()
  const { pathname } = useLocation()
  const base = `/league/${id}`

  const isActive = (path: string) => {
    const full = path ? `${base}/${path}` : base
    return path === '' ? pathname === base : pathname.startsWith(full)
  }

  const nav = (
    <nav className="flex flex-col h-full">
      <Link to="/" className="flex items-center gap-2.5 px-5 h-16 border-b border-white/[0.06] shrink-0">
        <span className="w-8 h-8 rounded-md btn-hud flex items-center justify-center text-base">🏀</span>
        <span className="font-display text-xl tracking-wider text-white leading-none pt-0.5">
          BBAL <span className="text-gradient">SIM</span>
        </span>
      </Link>

      <div className="flex-1 overflow-y-auto py-3 [scrollbar-width:thin]">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi} className="mb-1.5">
            {group.label && (
              <div className="px-5 pt-3 pb-1.5 text-[9px] uppercase tracking-[2.5px] text-slate-600 font-semibold">
                {group.label}
              </div>
            )}
            {group.items.map(item => {
              const active = isActive(item.path)
              return (
                <Link
                  key={item.path}
                  to={item.path ? `${base}/${item.path}` : base}
                  onClick={onClose}
                  className={`relative flex items-center gap-3 px-5 py-2.5 text-[13px] font-medium transition-colors ${
                    active
                      ? 'text-white bg-gradient-to-r from-orange-500/15 to-transparent'
                      : 'text-slate-400 hover:text-white hover:bg-white/[0.03]'
                  }`}
                >
                  {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-gradient-to-b from-orange-400 to-orange-600 shadow-[0_0_8px_rgba(249,115,22,0.6)]" />}
                  <Icon name={item.icon} className={active ? 'text-orange-400' : 'text-slate-500'} />
                  {item.label}
                </Link>
              )
            })}
          </div>
        ))}
      </div>

      <div className="border-t border-white/[0.06] py-3 shrink-0">
        <Link
          to={`${base}/settings`}
          onClick={onClose}
          className={`flex items-center gap-3 px-5 py-2.5 text-[13px] font-medium transition-colors ${
            isActive('settings') ? 'text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Icon name="settings" className={isActive('settings') ? 'text-orange-400' : 'text-slate-500'} />
          Settings
        </Link>
        <Link
          to="/"
          className="flex items-center gap-3 px-5 py-2.5 text-[13px] font-medium text-slate-500 hover:text-slate-300 transition-colors"
        >
          <Icon name="exit" className="text-slate-600" />
          Exit League
        </Link>
      </div>
    </nav>
  )

  return (
    <>
      {/* Desktop rail */}
      <aside className="hidden lg:block fixed left-0 top-0 bottom-0 w-52 z-40 bg-gradient-to-b from-[#0d1526] to-[#080d18] border-r border-white/[0.07]">
        {nav}
      </aside>

      {/* Mobile off-canvas */}
      {mobileOpen && (
        <>
          <div className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <aside className="lg:hidden fixed left-0 top-0 bottom-0 w-64 z-50 bg-[#0b1220] border-r border-white/[0.08] shadow-2xl">
            {nav}
          </aside>
        </>
      )}
    </>
  )
}
