import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'

const LEAGUE_LINKS = [
  { path: '', label: 'Dashboard' },
  { path: 'team', label: 'My Team' },
  { path: 'standings', label: 'Standings' },
  { path: 'schedule', label: 'Schedule' },
  { path: 'players', label: 'Players' },
  { path: 'trades', label: 'Trades' },
  { path: 'draft', label: 'Draft' },
  { path: 'free-agency', label: 'Free Agency' },
  { path: 'awards', label: 'Awards' },
  { path: 'settings', label: 'Settings' },
]

export default function LeagueNavbar() {
  const { id } = useParams()
  const { pathname } = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const base = `/league/${id}`

  const isActive = (path: string) => {
    const full = path ? `${base}/${path}` : base
    return pathname === full || (path && pathname.startsWith(`${base}/${path}`))
  }

  return (
    <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-6xl">
      <div className="flex items-center justify-between px-6 h-14 rounded-full backdrop-blur-md bg-slate-950/30 border border-white/[0.06]">
        <Link to="/" className="font-display text-lg tracking-wide text-white shrink-0">
          BBAL<span className="text-accent">SIM</span>
        </Link>

        <div className="hidden lg:flex items-center gap-1 mx-4 overflow-x-auto">
          {LEAGUE_LINKS.map(({ path, label }) => (
            <Link
              key={path}
              to={path ? `${base}/${path}` : base}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                isActive(path)
                  ? 'text-accent bg-accent/10'
                  : 'text-gray-500 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        <Link
          to="/"
          className="hidden lg:block text-xs text-gray-600 hover:text-gray-400 transition-colors shrink-0"
        >
          Exit League
        </Link>

        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="lg:hidden text-gray-400 hover:text-white"
          aria-label="Toggle menu"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {mobileOpen ? (
              <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
            ) : (
              <><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></>
            )}
          </svg>
        </button>
      </div>

      {mobileOpen && (
        <div className="lg:hidden mt-2 p-4 rounded-2xl backdrop-blur-md bg-slate-950/60 border border-white/[0.06]">
          {LEAGUE_LINKS.map(({ path, label }) => (
            <Link
              key={path}
              to={path ? `${base}/${path}` : base}
              onClick={() => setMobileOpen(false)}
              className={`block py-2 text-sm font-medium transition-colors ${
                isActive(path) ? 'text-accent' : 'text-gray-500 hover:text-white'
              }`}
            >
              {label}
            </Link>
          ))}
          <div className="border-t border-white/[0.06] mt-2 pt-2">
            <Link to="/" onClick={() => setMobileOpen(false)} className="block py-2 text-sm text-gray-600 hover:text-gray-400">
              Exit League
            </Link>
          </div>
        </div>
      )}
    </nav>
  )
}
