import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import PageTransition from '../components/layout/PageTransition'
import { listLeagues, deleteLeague } from '../db'
import { importLeague } from '../utils/save-io'
import type { LeagueMeta } from '../types'

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
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center">
        <h1 className="font-display text-7xl md:text-9xl tracking-wide text-white mb-4">
          BBAL<span className="text-accent">SIM</span>
        </h1>
        <p className="text-gray-400 text-lg max-w-md mb-10">
          NBA General Manager Simulator
        </p>

        <div className="w-full max-w-lg space-y-4">
          <Link
            to="/league/new"
            className="block w-full px-8 py-4 rounded-xl bg-accent text-white font-semibold text-center hover:brightness-110 transition-all"
          >
            New League
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
            className="block w-full px-8 py-4 rounded-xl bg-white/[0.06] border border-white/[0.10] text-gray-300 font-semibold text-center hover:bg-white/[0.10] transition-all disabled:opacity-50"
          >
            {importing ? 'Importing...' : 'Import Save'}
          </button>

          <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-6">
            <h2 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-4">Saved Leagues</h2>
            {loading ? (
              <p className="text-gray-600 text-sm">Loading...</p>
            ) : leagues.length === 0 ? (
              <p className="text-gray-600 text-sm">No saved leagues yet</p>
            ) : (
              <div className="space-y-2">
                {leagues.map(league => (
                  <div key={league.id} className="flex items-center justify-between bg-white/[0.03] rounded-lg px-4 py-3 group">
                    <button
                      onClick={() => navigate(`/league/${league.id}`)}
                      className="flex-1 text-left"
                    >
                      <div className="text-sm font-medium text-white">{league.name}</div>
                      <div className="text-xs text-gray-600">{league.userTeamName} — Season {league.currentSeason}</div>
                    </button>
                    <button
                      onClick={() => handleDelete(league.id, league.name)}
                      className="text-gray-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 ml-3 text-xs"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  )
}
