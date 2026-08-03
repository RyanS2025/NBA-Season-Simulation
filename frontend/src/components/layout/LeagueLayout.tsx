import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import LeagueSidebar from './LeagueSidebar'
import LeagueTopBar from './LeagueTopBar'
import { LeagueProvider } from '../../hooks/useLeague'

export default function LeagueLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <LeagueProvider>
      <div className="min-h-dvh text-slate-200 font-body">
        <LeagueSidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
        <LeagueTopBar onMenuToggle={() => setMobileOpen(o => !o)} />
        <main className="lg:pl-52 pt-16">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
            <AnimatePresence mode="wait">
              <Outlet />
            </AnimatePresence>
          </div>
        </main>
      </div>
    </LeagueProvider>
  )
}
