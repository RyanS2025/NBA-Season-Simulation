import { useState, useEffect, useCallback, useMemo } from 'react'
import PageTransition from '../../components/layout/PageTransition'
import GlassCard from '../../components/common/GlassCard'
import { useLeague } from '../../hooks/useLeague'
import type { Game, PlayerGameStats } from '../../types'

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

function teamShort(teamId: string, teams: { id: string; info: { city: string; name: string } }[]): string {
  const t = teams.find(x => x.id === teamId)
  return t ? t.info.name : teamId
}

function pct(made: number, att: number): string {
  if (att === 0) return '.000'
  return (made / att).toFixed(3).replace(/^0/, '')
}

function BoxScoreTable({
  teamId,
  stats,
  playerNames,
  teams,
}: {
  teamId: string
  stats: PlayerGameStats[]
  playerNames: Map<string, string>
  teams: { id: string; info: { city: string; name: string } }[]
}) {
  const sorted = [...stats].sort((a, b) => b.minutes - a.minutes)

  return (
    <div>
      <h4 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-2">
        {teamDisplay(teamId, teams)}
      </h4>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/[0.08]">
              <th className="text-left py-2 pr-3 text-gray-500 font-medium sticky left-0 bg-inherit">Player</th>
              <th className="text-center px-1.5 py-2 text-gray-500 font-medium">MIN</th>
              <th className="text-center px-1.5 py-2 text-gray-500 font-medium">PTS</th>
              <th className="text-center px-1.5 py-2 text-gray-500 font-medium">FG</th>
              <th className="text-center px-1.5 py-2 text-gray-500 font-medium">3PT</th>
              <th className="text-center px-1.5 py-2 text-gray-500 font-medium">FT</th>
              <th className="text-center px-1.5 py-2 text-gray-500 font-medium">REB</th>
              <th className="text-center px-1.5 py-2 text-gray-500 font-medium">AST</th>
              <th className="text-center px-1.5 py-2 text-gray-500 font-medium">STL</th>
              <th className="text-center px-1.5 py-2 text-gray-500 font-medium">BLK</th>
              <th className="text-center px-1.5 py-2 text-gray-500 font-medium">TO</th>
              <th className="text-center px-1.5 py-2 text-gray-500 font-medium">+/-</th>
            </tr>
          </thead>
          <tbody>
            {sorted.filter(s => s.minutes > 0).map(s => (
              <tr key={s.playerId} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                <td className="py-1.5 pr-3 text-white font-medium whitespace-nowrap sticky left-0 bg-inherit">
                  {playerNames.get(s.playerId) ?? s.playerId}
                </td>
                <td className="text-center px-1.5 py-1.5 text-gray-400">{Math.round(s.minutes)}</td>
                <td className="text-center px-1.5 py-1.5 text-white font-semibold">{s.points}</td>
                <td className="text-center px-1.5 py-1.5 text-gray-300">
                  {s.fieldGoalsMade}-{s.fieldGoalsAttempted}
                </td>
                <td className="text-center px-1.5 py-1.5 text-gray-300">
                  {s.threePointersMade}-{s.threePointersAttempted}
                </td>
                <td className="text-center px-1.5 py-1.5 text-gray-300">
                  {s.freeThrowsMade}-{s.freeThrowsAttempted}
                </td>
                <td className="text-center px-1.5 py-1.5 text-gray-300">{s.totalRebounds}</td>
                <td className="text-center px-1.5 py-1.5 text-gray-300">{s.assists}</td>
                <td className="text-center px-1.5 py-1.5 text-gray-300">{s.steals}</td>
                <td className="text-center px-1.5 py-1.5 text-gray-300">{s.blocks}</td>
                <td className="text-center px-1.5 py-1.5 text-gray-300">{s.turnovers}</td>
                <td className={`text-center px-1.5 py-1.5 font-medium ${
                  s.plusMinus > 0 ? 'text-green-400' : s.plusMinus < 0 ? 'text-red-400' : 'text-gray-500'
                }`}>
                  {s.plusMinus > 0 ? '+' : ''}{s.plusMinus}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-white/[0.08]">
              <td className="py-1.5 pr-3 text-gray-500 font-medium sticky left-0 bg-inherit">Totals</td>
              <td className="text-center px-1.5 py-1.5 text-gray-500">240</td>
              <td className="text-center px-1.5 py-1.5 text-white font-semibold">
                {sorted.reduce((s, p) => s + p.points, 0)}
              </td>
              <td className="text-center px-1.5 py-1.5 text-gray-400">
                {pct(
                  sorted.reduce((s, p) => s + p.fieldGoalsMade, 0),
                  sorted.reduce((s, p) => s + p.fieldGoalsAttempted, 0),
                )}
              </td>
              <td className="text-center px-1.5 py-1.5 text-gray-400">
                {pct(
                  sorted.reduce((s, p) => s + p.threePointersMade, 0),
                  sorted.reduce((s, p) => s + p.threePointersAttempted, 0),
                )}
              </td>
              <td className="text-center px-1.5 py-1.5 text-gray-400">
                {pct(
                  sorted.reduce((s, p) => s + p.freeThrowsMade, 0),
                  sorted.reduce((s, p) => s + p.freeThrowsAttempted, 0),
                )}
              </td>
              <td className="text-center px-1.5 py-1.5 text-gray-400">
                {sorted.reduce((s, p) => s + p.totalRebounds, 0)}
              </td>
              <td className="text-center px-1.5 py-1.5 text-gray-400">
                {sorted.reduce((s, p) => s + p.assists, 0)}
              </td>
              <td className="text-center px-1.5 py-1.5 text-gray-400">
                {sorted.reduce((s, p) => s + p.steals, 0)}
              </td>
              <td className="text-center px-1.5 py-1.5 text-gray-400">
                {sorted.reduce((s, p) => s + p.blocks, 0)}
              </td>
              <td className="text-center px-1.5 py-1.5 text-gray-400">
                {sorted.reduce((s, p) => s + p.turnovers, 0)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

export default function ScoresPage() {
  const { db, state, teams, players, loading } = useLeague()
  const [viewDate, setViewDate] = useState('')
  const [dateGames, setDateGames] = useState<Game[]>([])
  const [expandedGameId, setExpandedGameId] = useState<string | null>(null)

  const playerNames = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of players) {
      map.set(p.id, `${p.bio.firstName.charAt(0)}. ${p.bio.lastName}`)
    }
    return map
  }, [players])

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

  useEffect(() => {
    setExpandedGameId(null)
  }, [viewDate])

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
          <div className="space-y-4">
            {completedGames.map(g => {
              const r = g.result!
              const isUserGame = g.homeTeamId === userTeamId || g.awayTeamId === userTeamId
              const homeWon = r.winningTeamId === g.homeTeamId
              const awayWon = r.winningTeamId === g.awayTeamId
              const isExpanded = expandedGameId === g.id

              return (
                <div key={g.id}>
                  <button
                    onClick={() => setExpandedGameId(isExpanded ? null : g.id)}
                    className="w-full text-left"
                  >
                    <GlassCard variant={isUserGame ? 'medium' : 'subtle'}>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className={`text-sm font-mono w-8 ${g.awayTeamId === userTeamId ? 'text-accent' : 'text-gray-400'}`}>
                              {g.awayTeamId}
                            </span>
                            <span className={awayWon ? 'text-white font-medium' : 'text-gray-400'}>
                              {teamShort(g.awayTeamId, teams)}
                            </span>
                          </div>
                          <span className={`text-lg font-display tracking-wider ${awayWon ? 'text-white' : 'text-gray-500'}`}>
                            {r.awayScore}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className={`text-sm font-mono w-8 ${g.homeTeamId === userTeamId ? 'text-accent' : 'text-gray-400'}`}>
                              {g.homeTeamId}
                            </span>
                            <span className={homeWon ? 'text-white font-medium' : 'text-gray-400'}>
                              {teamShort(g.homeTeamId, teams)}
                            </span>
                          </div>
                          <span className={`text-lg font-display tracking-wider ${homeWon ? 'text-white' : 'text-gray-500'}`}>
                            {r.homeScore}
                          </span>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] uppercase tracking-[2px] text-gray-600">
                              Final{r.overtime > 0 ? ` (${r.overtime}OT)` : ''}
                            </span>
                            <span className="text-[10px] text-gray-600">
                              {r.quarterScores.away.join(' | ')} — {r.quarterScores.home.join(' | ')}
                            </span>
                          </div>
                          <span className={`text-[10px] uppercase tracking-[1px] transition-colors ${
                            isExpanded ? 'text-accent' : 'text-gray-600'
                          }`}>
                            {isExpanded ? 'Hide' : 'Box Score'}
                          </span>
                        </div>
                      </div>
                    </GlassCard>
                  </button>

                  {isExpanded && r.awayBoxScore && r.homeBoxScore && (
                    <div className="mt-2 bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 md:p-6 space-y-6">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                        {[
                          { label: 'Fast Break Pts', away: r.awayBoxScore.teamStats.fastBreakPoints, home: r.homeBoxScore.teamStats.fastBreakPoints },
                          { label: 'Pts in Paint', away: r.awayBoxScore.teamStats.pointsInPaint, home: r.homeBoxScore.teamStats.pointsInPaint },
                          { label: '2nd Chance Pts', away: r.awayBoxScore.teamStats.secondChancePoints, home: r.homeBoxScore.teamStats.secondChancePoints },
                          { label: 'Bench Pts', away: r.awayBoxScore.teamStats.benchPoints, home: r.homeBoxScore.teamStats.benchPoints },
                        ].map(stat => (
                          <div key={stat.label} className="bg-white/[0.03] rounded-lg p-3">
                            <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-2">{stat.label}</div>
                            <div className="flex justify-center gap-4 text-sm">
                              <span className={stat.away > stat.home ? 'text-white font-semibold' : 'text-gray-500'}>{stat.away}</span>
                              <span className="text-gray-600">-</span>
                              <span className={stat.home > stat.away ? 'text-white font-semibold' : 'text-gray-500'}>{stat.home}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <BoxScoreTable
                        teamId={g.awayTeamId}
                        stats={r.awayBoxScore.playerStats}
                        playerNames={playerNames}
                        teams={teams}
                      />
                      <BoxScoreTable
                        teamId={g.homeTeamId}
                        stats={r.homeBoxScore.playerStats}
                        playerNames={playerNames}
                        teams={teams}
                      />
                    </div>
                  )}
                </div>
              )
            })}

            {upcomingGames.map(g => {
              const isUserGame = g.homeTeamId === userTeamId || g.awayTeamId === userTeamId
              return (
                <GlassCard key={g.id} variant="subtle">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`text-sm font-mono w-8 ${isUserGame && g.awayTeamId === userTeamId ? 'text-accent' : 'text-gray-400'}`}>
                          {g.awayTeamId}
                        </span>
                        <span className={isUserGame && g.awayTeamId === userTeamId ? 'text-accent' : 'text-gray-400'}>
                          {teamShort(g.awayTeamId, teams)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`text-sm font-mono w-8 ${isUserGame && g.homeTeamId === userTeamId ? 'text-accent' : 'text-gray-400'}`}>
                          {g.homeTeamId}
                        </span>
                        <span className={isUserGame && g.homeTeamId === userTeamId ? 'text-accent' : 'text-white'}>
                          {teamShort(g.homeTeamId, teams)}
                        </span>
                      </div>
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
