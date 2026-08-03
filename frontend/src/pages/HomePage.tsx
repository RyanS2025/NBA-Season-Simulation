import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import PageTransition from '../components/layout/PageTransition'
import { listLeagues, deleteLeague } from '../db'
import { importLeague } from '../utils/save-io'
import type { LeagueMeta } from '../types'

const FEATURES = [
  { icon: '🏆', title: 'Full Franchise Mode', desc: 'Multi-season dynasties with a draft, free agency, trades, and a self-sustaining 30-team league' },
  { icon: '📊', title: 'Skill-Based Simulation', desc: 'Games decided by real skillsets, coaching schemes, and matchups — not a single overall number' },
  { icon: '🔥', title: 'Living Locker Room', desc: 'Morale, hot streaks, trade demands, and holdouts — bench a star and pay the price' },
  { icon: '🏥', title: 'Injuries That Matter', desc: 'From day-to-day knocks to career-altering tears that follow a player forever' },
  { icon: '🗳️', title: '100-Voter Media', desc: 'Awards decided by a full press corps with beat-writer bias and controversial ballots' },
  { icon: '🏛️', title: 'League History', desc: 'Records book, retired legends, and a Hall of Fame that remembers every dynasty' },
]

export default function HomePage() {
  const navigate = useNavigate()
  const [leagues, setLeagues] = useState<LeagueMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadLeagues = async () => {
    const list = await listLeagues()
    setLeagues(list)
    setLoading(false)
  }

  useEffect(() => { loadLeagues() }, [])

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    await deleteLeague(id)
    await loadLeagues()
  }

  return (
    <PageTransition>
      <div className="flex flex-col items-center text-center pt-10 md:pt-16 pb-8">
        {/* Hero */}
        <div className="mb-3 text-[10px] uppercase tracking-[4px] text-slate-500">
          Front Office. Full Control.
        </div>
        <h1 className="font-display text-7xl md:text-9xl tracking-wide text-white mb-3 leading-none">
          BBAL<span className="text-gradient">SIM</span>
        </h1>
        <p className="text-slate-400 text-lg max-w-xl mb-2">
          A deep basketball GM simulator that runs entirely in your browser.
        </p>
        <p className="text-slate-600 text-sm max-w-xl mb-10">
          No accounts. No servers. Your leagues live on your device.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center gap-3 mb-14">
          <Link
            to="/league/new"
            className="btn-hud font-display tracking-widest text-lg px-10 py-3.5 rounded-lg"
          >
            START A NEW LEAGUE
          </Link>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              setImporting(true)
              try {
                const newId = await importLeague(file)
                navigate(`/league/${newId}`)
              } catch (err) {
                alert(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
              } finally {
                setImporting(false)
                if (fileInputRef.current) fileInputRef.current.value = ''
              }
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="px-8 py-3.5 rounded-lg bg-white/[0.05] border border-white/[0.12] text-slate-300 font-medium hover:bg-white/[0.09] hover:border-white/[0.2] transition-all disabled:opacity-50"
          >
            {importing ? 'Importing...' : 'Import a Save'}
          </button>
        </div>

        {/* Saved leagues */}
        {(loading || leagues.length > 0) && (
          <div className="w-full max-w-lg mb-16">
            <div className="panel-glow p-6 text-left">
              <h2 className="panel-title text-sm mb-4 text-gradient">Your Leagues</h2>
              {loading ? (
                <p className="text-slate-600 text-sm">Loading...</p>
              ) : (
                <div className="space-y-2">
                  {leagues.map(league => (
                    <div key={league.id} className="flex items-center justify-between bg-white/[0.03] hover:bg-white/[0.06] rounded-lg px-4 py-3 group transition-colors">
                      <button
                        onClick={() => navigate(`/league/${league.id}`)}
                        className="flex-1 text-left"
                      >
                        <div className="text-sm font-medium text-white">{league.name}</div>
                        <div className="text-xs text-slate-500">{league.userTeamName} — Season {league.currentSeason}</div>
                      </button>
                      <button
                        onClick={() => handleDelete(league.id, league.name)}
                        aria-label={`Delete ${league.name}`}
                        className="text-slate-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 ml-3 text-xs"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Feature grid */}
        <div className="w-full max-w-5xl">
          <div className="text-[10px] uppercase tracking-[3px] text-slate-600 mb-5">What's Inside</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-left">
            {FEATURES.map(f => (
              <div key={f.title} className="panel p-5 hover:border-orange-500/30 transition-colors">
                <div className="text-2xl mb-2">{f.icon}</div>
                <div className="font-display text-lg tracking-wide text-white mb-1">{f.title}</div>
                <div className="text-[13px] text-slate-500 leading-relaxed">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageTransition>
  )
}
