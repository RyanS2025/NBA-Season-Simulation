import { Outlet } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import Navbar from './Navbar'

export default function SiteLayout() {
  return (
    <div className="min-h-dvh bg-slate-950 text-slate-200 font-body">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-8 pt-24">
        <AnimatePresence mode="wait">
          <Outlet />
        </AnimatePresence>
      </main>
    </div>
  )
}
