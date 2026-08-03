import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'

interface NavLink {
  path: string
  label: string
}

interface NavGroup {
  label: string
  links: NavLink[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Team',
    links: [
      { path: 'team', label: 'My Team' },
      { path: 'coaching', label: 'Coaching' },
      { path: 'staff', label: 'Staff' },
    ],
  },
  {
    label: 'League',
    links: [
      { path: 'standings', label: 'Standings' },
      { path: 'schedule', label: 'Schedule' },
      { path: 'scores', label: 'Scores' },
      { path: 'players', label: 'Players' },
      { path: 'transactions', label: 'Transactions' },
    ],
  },
  {
    label: 'Moves',
    links: [
      { path: 'trades', label: 'Trades' },
      { path: 'free-agency', label: 'Free Agency' },
    ],
  },
  {
    label: 'Season',
    links: [
      { path: 'awards', label: 'Awards' },
      { path: 'all-star', label: 'All-Star' },
      { path: 'playoffs', label: 'Playoffs' },
      { path: 'draft', label: 'Draft' },
      { path: 'history', label: 'History' },
    ],
  },
]

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

export default function LeagueNavbar() {
  const { id } = useParams()
  const { pathname } = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const navRef = useRef<HTMLElement>(null)
  const base = `/league/${id}`

  const isActive = (path: string) => {
    const full = path ? `${base}/${path}` : base
    return pathname === full || (!!path && pathname.startsWith(`${base}/${path}`))
  }

  const groupActive = (group: NavGroup) => group.links.some(l => isActive(l.path))

  // Close dropdowns on outside click and on navigation
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenGroup(null)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  useEffect(() => {
    setOpenGroup(null)
    setMobileOpen(false)
  }, [pathname])

  return (
    <nav ref={navRef} className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-6xl">
      <div className="flex items-center justify-between px-6 h-14 rounded-full backdrop-blur-md bg-slate-950/40 border border-white/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
        <Link to="/" className="font-display text-lg tracking-wide text-white shrink-0">
          BBAL<span className="text-accent">SIM</span>
        </Link>

        <div className="hidden lg:flex items-center gap-1 mx-4">
          <Link
            to={base}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              pathname === base
                ? 'text-accent bg-accent/10'
                : 'text-gray-400 hover:text-white hover:bg-white/[0.05]'
            }`}
          >
            Dashboard
          </Link>

          {NAV_GROUPS.map(group => {
            const active = groupActive(group)
            const open = openGroup === group.label
            return (
              <div key={group.label} className="relative">
                <button
                  onClick={() => setOpenGroup(open ? null : group.label)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    active
                      ? 'text-accent bg-accent/10'
                      : open
                        ? 'text-white bg-white/[0.06]'
                        : 'text-gray-400 hover:text-white hover:bg-white/[0.05]'
                  }`}
                >
                  {group.label}
                  <Chevron open={open} />
                </button>

                {open && (
                  <div className="absolute top-full left-0 mt-2 min-w-[170px] rounded-xl backdrop-blur-xl bg-slate-950/90 border border-white/[0.08] shadow-[0_16px_48px_rgba(0,0,0,0.6)] p-1.5 animate-in fade-in duration-150">
                    {group.links.map(({ path, label }) => (
                      <Link
                        key={path}
                        to={`${base}/${path}`}
                        className={`block px-3.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                          isActive(path)
                            ? 'text-accent bg-accent/10'
                            : 'text-gray-400 hover:text-white hover:bg-white/[0.06]'
                        }`}
                      >
                        {label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="hidden lg:flex items-center gap-3 shrink-0">
          <Link
            to={`${base}/settings`}
            aria-label="League settings"
            className={`p-1.5 rounded-lg transition-colors ${
              isActive('settings') ? 'text-accent bg-accent/10' : 'text-gray-500 hover:text-white hover:bg-white/[0.05]'
            }`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </Link>
          <Link
            to="/"
            className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
          >
            Exit League
          </Link>
        </div>

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
        <div className="lg:hidden mt-2 p-4 rounded-2xl backdrop-blur-md bg-slate-950/80 border border-white/[0.06] max-h-[70vh] overflow-y-auto">
          <Link
            to={base}
            onClick={() => setMobileOpen(false)}
            className={`block py-2 text-sm font-medium transition-colors ${
              pathname === base ? 'text-accent' : 'text-gray-400 hover:text-white'
            }`}
          >
            Dashboard
          </Link>
          {NAV_GROUPS.map(group => (
            <div key={group.label} className="mt-3">
              <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-1">{group.label}</div>
              {group.links.map(({ path, label }) => (
                <Link
                  key={path}
                  to={`${base}/${path}`}
                  onClick={() => setMobileOpen(false)}
                  className={`block py-1.5 pl-2 text-sm font-medium transition-colors ${
                    isActive(path) ? 'text-accent' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>
          ))}
          <div className="border-t border-white/[0.06] mt-3 pt-2">
            <Link
              to={`${base}/settings`}
              onClick={() => setMobileOpen(false)}
              className={`block py-1.5 text-sm ${isActive('settings') ? 'text-accent' : 'text-gray-400 hover:text-white'}`}
            >
              Settings
            </Link>
            <Link to="/" onClick={() => setMobileOpen(false)} className="block py-1.5 text-sm text-gray-600 hover:text-gray-400">
              Exit League
            </Link>
          </div>
        </div>
      )}
    </nav>
  )
}
