import { Outlet, Link } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import Navbar from './Navbar'

export default function SiteLayout() {
  return (
    <div className="min-h-dvh text-slate-200 font-body flex flex-col">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-8 pt-24 w-full flex-1">
        <AnimatePresence mode="wait">
          <Outlet />
        </AnimatePresence>
      </main>
      <footer className="border-t border-white/[0.06] mt-8">
        <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-[11px] text-slate-600 text-center sm:text-left max-w-2xl leading-relaxed">
            BBAL Sim is a free, non-commercial fan project. Not affiliated with or endorsed
            by the NBA, NBPA, or any professional team. All in-game franchises are fictional.{' '}
            <Link to="/about" className="text-slate-500 hover:text-slate-300 underline">Full disclaimer</Link>
          </p>
          <p className="text-[11px] text-slate-600 whitespace-nowrap">
            © {new Date().getFullYear()}{' '}
            <a href="https://ryansinha.dev" target="_blank" rel="noopener noreferrer" className="hover:text-slate-400">
              Ryan Sinha
            </a>
          </p>
        </div>
      </footer>
    </div>
  )
}
