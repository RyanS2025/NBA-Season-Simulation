import { useState, useEffect, useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import PageTransition from '../../components/layout/PageTransition'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import GlassCard from '../../components/common/GlassCard'
import Button from '../../components/common/Button'
import OffseasonHub from '../../components/league/OffseasonHub'
import NewsFeed from '../../components/league/NewsFeed'
import { useLeague } from '../../hooks/useLeague'
import type { Game, Team } from '../../types'

function teamName(teamId: string, teams: Team[]): string {
  const t = teams.find(x => x.id === teamId)
  return t ? `${t.info.city} ${t.info.name}` : teamId
}

function formatShortDate(date: string): string {
  const d = new Date(date + 'T12:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function LeagueDashboard() {
  const { id: leagueId } = useParams()
  const { db, state, teams, players, simming, simProgress, simDay, simWeek, simSeason, playoffResults, loading } = useLeague()
  const [recentGames, setRecentGames] = useState<Game[]>([])
  const [upcomingGames, setUpcomingGames] = useState<Game[]>([])

  const loadDashData = useCallback(async () => {
    if (!db || !state) return

    const allGames = await db.games.toArray()
    const userGames = allGames.filter(
      g => g.homeTeamId === state.userTeamId || g.awayTeamId === state.userTeamId
    )

    const played = userGames
      .filter(g => g.result && g.date < state.currentDate)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5)
    setRecentGames(played)

    const upcoming = userGames
      .filter(g => !g.result && g.date >= state.currentDate)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5)
    setUpcomingGames(upcoming)
  }, [db, state])

  useEffect(() => {
    loadDashData()
  }, [loadDashData])

  useEffect(() => {
    if (!simming) loadDashData()
  }, [simming, loadDashData])

  if (loading || !state) {
    return (
      <PageTransition>
        <LoadingSpinner message="Loading dashboard..." />
      </PageTransition>
    )
  }

  const userTeam = teams.find(t => t.id === state.userTeamId)
  const r = userTeam?.seasonRecord
  const wins = r?.wins ?? 0
  const losses = r?.losses ?? 0
  const gamesPlayed = wins + losses
  const winPct = gamesPlayed > 0 ? (wins / gamesPlayed).toFixed(3) : '.000'

  const confTeams = teams
    .filter(t => t.info.conference === userTeam?.info.conference)
    .sort((a, b) => b.seasonRecord.wins - a.seasonRecord.wins)
  const confSeed = confTeams.findIndex(t => t.id === state.userTeamId) + 1

  const allSorted = [...teams].sort((a, b) => b.seasonRecord.wins - a.seasonRecord.wins)
  const overallRank = allSorted.findIndex(t => t.id === state.userTeamId) + 1

  const topStandings = confTeams.slice(0, 8)

  return (
    <PageTransition>
      <div>
        <div className="mb-8">
          <h1 className="font-display text-4xl tracking-wide text-white mb-1">
            {userTeam ? `${userTeam.info.city} ${userTeam.info.name}` : 'My Team'}
          </h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="text-2xl font-semibold text-white">{wins}-{losses}</span>
            <span className="text-gray-500 text-sm">
              {confSeed > 0 ? `${confSeed}${ordSuffix(confSeed)} in ${userTeam?.info.conference} Conference` : ''}
            </span>
            <span className="text-gray-600 text-sm">&middot;</span>
            <span className="text-gray-500 text-sm">
              {state.currentDate} &middot; Game {gamesPlayed}
            </span>
          </div>
        </div>

        {playoffResults?.championId && (
          <GlassCard className="p-6 mb-6 bg-gradient-to-r from-[oklch(64.6%_0.222_41.116)]/5 to-transparent border border-[oklch(64.6%_0.222_41.116)]/10">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[9px] uppercase tracking-[2px] text-[oklch(64.6%_0.222_41.116)] mb-1">
                  {state.currentSeason} Champion
                </div>
                <div className="text-lg font-display text-white">
                  {teamName(playoffResults.championId, teams)}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  defeated {teamName(playoffResults.finalsLoserId, teams)}
                  {playoffResults.playoffMvpId && (
                    <> &middot; Finals MVP: <span className="text-[oklch(64.6%_0.222_41.116)]">
                      {(() => {
                        const p = players.find(x => x.id === playoffResults.playoffMvpId)
                        return p ? `${p.bio.firstName} ${p.bio.lastName}` : 'Unknown'
                      })()}
                    </span></>
                  )}
                </div>
              </div>
              <Link to={`/league/${leagueId}/playoffs`}>
                <Button variant="secondary" size="sm">View Bracket</Button>
              </Link>
            </div>
          </GlassCard>
        )}

        <OffseasonHub />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {(state.currentPhase === 'regular_season' || state.currentPhase === 'preseason') && (
          <div className="panel p-6">
            <h2 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">Sim Controls</h2>
            <div className="flex flex-wrap gap-3">
              <Button variant="primary" size="sm" onClick={simDay} disabled={simming}>
                {simming ? simProgress ?? 'Simming...' : 'Sim Day'}
              </Button>
              <Button variant="primary" size="sm" onClick={simWeek} disabled={simming}>
                Sim Week
              </Button>
              <Button variant="secondary" size="sm" onClick={simSeason} disabled={simming}>
                Sim Season
              </Button>
              <Link to={`/league/${leagueId}/schedule`}>
                <Button variant="secondary" size="sm">Full Schedule</Button>
              </Link>
            </div>
          </div>
          )}

          <div className="panel p-6">
            <h2 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">Season Record</h2>
            <p className="text-3xl font-semibold text-white">{wins}-{losses}</p>
            <p className="text-gray-500 text-sm mt-1">{winPct} WIN%</p>
          </div>

          <div className="panel p-6">
            <h2 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">League Rank</h2>
            <div className="flex items-baseline gap-4">
              <div>
                <p className="text-3xl font-semibold text-accent">#{confSeed || '—'}</p>
                <p className="text-gray-500 text-sm">{userTeam?.info.conference}</p>
              </div>
              <div className="border-l border-white/[0.08] pl-4">
                <p className="text-2xl font-semibold text-white">#{overallRank || '—'}</p>
                <p className="text-gray-500 text-sm">Overall</p>
              </div>
            </div>
          </div>

          <div className="panel p-6">
            <h2 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">Next Game</h2>
            {upcomingGames.length > 0 ? (() => {
              const next = upcomingGames[0]
              const isHome = next.homeTeamId === state.userTeamId
              const opp = isHome ? next.awayTeamId : next.homeTeamId
              return (
                <>
                  <p className="text-xl font-semibold text-white mb-1">
                    {isHome ? 'vs' : '@'} {teamName(opp, teams)}
                  </p>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-500 text-sm">{formatShortDate(next.date)}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-[1px] font-medium ${
                      isHome ? 'bg-accent/15 text-accent border border-accent/30' : 'bg-white/[0.06] text-gray-400 border border-white/[0.08]'
                    }`}>
                      {isHome ? 'Home' : 'Away'}
                    </span>
                  </div>
                </>
              )
            })() : (
              <p className="text-gray-500 text-sm">No upcoming games</p>
            )}
          </div>
        </div>

        <NewsFeed />

        {recentGames.length > 0 && (
          <div className="mb-8">
            <h2 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">Recent Results</h2>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {recentGames.map((game, idx) => {
                const res = game.result!
                const won = res.winningTeamId === state.userTeamId
                const isHome = game.homeTeamId === state.userTeamId
                const opp = isHome ? game.awayTeamId : game.homeTeamId
                const userScore = isHome ? res.homeScore : res.awayScore
                const oppScore = isHome ? res.awayScore : res.homeScore

                return (
                  <div
                    key={game.id}
                    className={`shrink-0 bg-white/[0.04] border rounded-xl p-4 ${
                      idx === 0 ? 'border-accent/30 w-44' : 'border-white/[0.08] w-36'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs font-bold ${won ? 'text-emerald-400' : 'text-red-400'}`}>
                        {won ? 'W' : 'L'}
                      </span>
                      {idx === 0 && (
                        <span className="text-[9px] uppercase tracking-[1px] text-gray-600">Latest</span>
                      )}
                    </div>
                    <p className={`font-semibold text-white ${idx === 0 ? 'text-lg' : 'text-base'}`}>
                      {userScore}-{oppScore}
                    </p>
                    <p className="text-gray-500 text-xs mt-1 truncate">{teamName(opp, teams)}</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div>
            <h2 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">Upcoming Schedule</h2>
            <div className="panel divide-y divide-white/[0.06]">
              {upcomingGames.length === 0 ? (
                <div className="px-5 py-4 text-gray-500 text-sm">No upcoming games</div>
              ) : (
                upcomingGames.map(game => {
                  const isHome = game.homeTeamId === state.userTeamId
                  const opp = isHome ? game.awayTeamId : game.homeTeamId
                  const oppTeam = teams.find(t => t.id === opp)
                  const oppRecord = oppTeam ? `${oppTeam.seasonRecord.wins}-${oppTeam.seasonRecord.losses}` : ''

                  return (
                    <div key={game.id} className="flex items-center justify-between px-5 py-3">
                      <div className="flex items-center gap-4">
                        <span className="text-gray-500 text-xs w-14">{formatShortDate(game.date)}</span>
                        <span className="text-white text-sm">{teamName(opp, teams)}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-gray-600 text-xs">{oppRecord}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-[1px] font-medium ${
                          isHome ? 'bg-accent/15 text-accent border border-accent/30' : 'bg-white/[0.06] text-gray-400 border border-white/[0.08]'
                        }`}>
                          {isHome ? 'Home' : 'Away'}
                        </span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          <div>
            <h2 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">
              {userTeam?.info.conference} Conference Standings
            </h2>
            <div className="panel divide-y divide-white/[0.06]">
              {topStandings.map((t, i) => {
                const isUser = t.id === state.userTeamId
                return (
                  <div key={t.id} className={`flex items-center justify-between px-5 py-2.5 ${isUser ? 'bg-accent/5' : ''}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-gray-500 w-5 text-center text-xs">{i + 1}</span>
                      <span className={isUser ? 'text-accent font-medium text-sm' : 'text-white text-sm'}>
                        {t.info.city} {t.info.name}
                      </span>
                    </div>
                    <span className="text-gray-400 text-xs">{t.seasonRecord.wins}-{t.seasonRecord.losses}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  )
}

function ordSuffix(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return 'th'
  switch (n % 10) {
    case 1: return 'st'
    case 2: return 'nd'
    case 3: return 'rd'
    default: return 'th'
  }
}
