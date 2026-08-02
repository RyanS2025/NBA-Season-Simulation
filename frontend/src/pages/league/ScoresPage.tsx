import { useState, useEffect, useCallback } from 'react'
import PageTransition from '../../components/layout/PageTransition'
import GlassCard from '../../components/common/GlassCard'
import { useLeague } from '../../hooks/useLeague'
import type { Game } from '../../types'

function addDays(date: string, days: number): string {
  const d = new Date(date + 'T12:00:00')
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatDisplayDate(date: string): string {
  const d = new Date(date + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function teamDisplay(teamId: string, teams: { id: string; info: { city: string; name: string } }[]): string {
  const t = teams.find(x => x.id === teamId)
  return t ? `${t.info.city} ${t.info.name}` : teamId
}

export default function ScoresPage() {
  const { db, state, teams, loading } = useLeague()
  const [viewDate, setViewDate] = useState('')
  const [dateGames, setDateGames] = useState<Game[]>([])

  useEffect(() => {
    if (state) {
      setViewDate(addDays(state.currentDate, -1))
    }
  }, [state])

  const loadGames = useCallback(async () => {
    if (!db || !viewDate) return
    const games = await db.games.where('date').equals(viewDate).toArray()
    setDateGames(games)
  }, [db, viewDate])

  useEffect(() => {
    loadGames()
  }, [loadGames])

  if (loading || !state) {
    return (
      <PageTransition>
        <div className="text-gray-400 text-center py-20">Loading scores...</div>
      </PageTransition>
    )
  }

  const userTeamId = state.userTeamId
  const completedGames = dateGames.filter(g => g.result)
  const upcomingGames = dateGames.filter(g => !g.result)

  return (
    <PageTransition>
      <div>
        <h1 className="font-display text-4xl tracking-wide text-white mb-6">Scores</h1>

        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => setViewDate(addDays(viewDate, -1))}
            className="text-gray-400 hover:text-white transition-colors text-lg px-2"
          >
            &lt;
          </button>
          <h2 className="font-display text-xl tracking-wide text-white">
            {formatDisplayDate(viewDate)}
          </h2>
          <button
            onClick={() => setViewDate(addDays(viewDate, 1))}
            className="text-gray-400 hover:text-white transition-colors text-lg px-2"
          >
            &gt;
          </button>
        </div>

        {dateGames.length === 0 ? (
          <GlassCard>
            <p className="text-gray-500 text-sm text-center py-8">No games on this date</p>
          </GlassCard>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {completedGames.map(g => {
              const r = g.result!
              const isUserGame = g.homeTeamId === userTeamId || g.awayTeamId === userTeamId
              const homeWon = r.winningTeamId === g.homeTeamId
              const awayWon = r.winningTeamId === g.awayTeamId

              return (
                <GlassCard key={g.id} variant={isUserGame ? 'medium' : 'subtle'}>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-mono ${g.awayTeamId === userTeamId ? 'text-accent' : 'text-gray-400'}`}>
                          {g.awayTeamId}
                        </span>
                        <span className={awayWon ? 'text-white font-medium' : 'text-gray-400'}>
                          {teamDisplay(g.awayTeamId, teams)}
                        </span>
                      </div>
                      <span className={`text-lg font-display tracking-wider ${awayWon ? 'text-white' : 'text-gray-500'}`}>
                        {r.awayScore}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-mono ${g.homeTeamId === userTeamId ? 'text-accent' : 'text-gray-400'}`}>
                          {g.homeTeamId}
                        </span>
                        <span className={homeWon ? 'text-white font-medium' : 'text-gray-400'}>
                          {teamDisplay(g.homeTeamId, teams)}
                        </span>
                      </div>
                      <span className={`text-lg font-display tracking-wider ${homeWon ? 'text-white' : 'text-gray-500'}`}>
                        {r.homeScore}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                      <span className="text-[10px] uppercase tracking-[2px] text-gray-600">
                        Final{r.overtime > 0 ? ` (${r.overtime}OT)` : ''}
                      </span>
                      <span className="text-[10px] text-gray-600">
                        {r.quarterScores.away.join(' | ')} — {r.quarterScores.home.join(' | ')}
                      </span>
                    </div>
                  </div>
                </GlassCard>
              )
            })}

            {upcomingGames.map(g => {
              const isUserGame = g.homeTeamId === userTeamId || g.awayTeamId === userTeamId
              return (
                <GlassCard key={g.id} variant="subtle">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className={isUserGame && g.awayTeamId === userTeamId ? 'text-accent' : 'text-gray-400'}>
                        {teamDisplay(g.awayTeamId, teams)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={isUserGame && g.homeTeamId === userTeamId ? 'text-accent' : 'text-white'}>
                        {teamDisplay(g.homeTeamId, teams)}
                      </span>
                    </div>
                    <div className="text-[10px] uppercase tracking-[2px] text-gray-600 pt-2 border-t border-white/[0.06]">
                      Scheduled
                    </div>
                  </div>
                </GlassCard>
              )
            })}
          </div>
        )}
      </div>
    </PageTransition>
  )
}
