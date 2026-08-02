import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import BackgroundMusic from '../common/BackgroundMusic'

const NAV_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
]

export default function Navbar() {
  const { pathname } = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-4xl w-[calc(100%-2rem)]">
      <div className="flex items-center justify-between px-8 h-14 rounded-full backdrop-blur-md bg-slate-950/30 border border-white/[0.06]">
        <Link to="/" className="font-display text-xl tracking-wide text-white">
          BBAL<span className="text-accent">SIM</span>
        </Link>

        <div className="hidden md:flex items-center gap-6">
          {NAV_LINKS.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={`text-sm font-medium transition-colors ${
                pathname === to
                  ? 'text-accent'
                  : 'text-gray-500 hover:text-white'
              }`}
            >
              {label}
            </Link>
          ))}
          <BackgroundMusic />
        </div>

        <div className="md:hidden flex items-center gap-3">
          <BackgroundMusic />
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="text-gray-400 hover:text-white"
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
      </div>

      {mobileOpen && (
        <div className="md:hidden mt-2 p-4 rounded-2xl backdrop-blur-md bg-slate-950/60 border border-white/[0.06]">
          {NAV_LINKS.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setMobileOpen(false)}
              className={`block py-2 text-sm font-medium transition-colors ${
                pathname === to ? 'text-accent' : 'text-gray-500 hover:text-white'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  )
}
