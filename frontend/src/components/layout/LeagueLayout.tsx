import { Outlet } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import LeagueNavbar from './LeagueNavbar'
import { LeagueProvider } from '../../hooks/useLeague'

export default function LeagueLayout() {
  return (
    <LeagueProvider>
      <div className="min-h-dvh bg-slate-950 text-slate-200 font-body">
        <LeagueNavbar />
        <main className="max-w-7xl mx-auto px-4 py-8 pt-24">
          <AnimatePresence mode="wait">
            <Outlet />
          </AnimatePresence>
        </main>
      </div>
    </LeagueProvider>
  )
}
