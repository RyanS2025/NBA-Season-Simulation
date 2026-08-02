import { useState, useMemo } from 'react'
import PageTransition from '../../components/layout/PageTransition'
import GlassCard from '../../components/common/GlassCard'
import Button from '../../components/common/Button'
import { useLeague } from '../../hooks/useLeague'
import {
  seedTeamsByConference,
  isRegularSeasonComplete,
} from '../../utils/playoff-engine'
import type { PlayoffSeries } from '../../utils/playoff-engine'
import type { SeriesResult, SeriesGameResult } from '../../utils/playoff-sim'
import type { Team } from '../../types'

const ROUND_LABELS: Record<number, string> = {
  1: 'First Round',
  2: 'Conference Semis',
  3: 'Conference Finals',
  4: 'NBA Finals',
}

function teamName(teams: Team[], id: string): string {
  const t = teams.find(t => t.id === id)
  return t ? `${t.info.city} ${t.info.name}` : 'TBD'
}

function shortName(teams: Team[], id: string): string {
  const t = teams.find(t => t.id === id)
  return t ? t.info.name : 'TBD'
}

function SeriesCard({
  series,
  seriesResult,
  teams,
  userTeamId,
  expanded,
  onToggle,
}: {
  series: PlayoffSeries
  seriesResult: SeriesResult | undefined
  teams: Team[]
  userTeamId: string
  expanded: boolean
  onToggle: () => void
}) {
  const hasUserTeam =
    series.higherSeed.teamId === userTeamId || series.lowerSeed.teamId === userTeamId

  const hiName = shortName(teams, series.higherSeed.teamId)
  const loName = shortName(teams, series.lowerSeed.teamId)
  const hiWins = seriesResult?.higherSeedWins ?? series.higherSeedWins
  const loWins = seriesResult?.lowerSeedWins ?? series.lowerSeedWins
  const isComplete = !!seriesResult?.winnerId

  const hiIsWinner = seriesResult?.winnerId === series.higherSeed.teamId
  const loIsWinner = seriesResult?.winnerId === series.lowerSeed.teamId

  return (
    <GlassCard
      className={`p-3 cursor-pointer transition-all ${
        hasUserTeam ? 'ring-1 ring-[oklch(64.6%_0.222_41.116)]/20' : ''
      }`}
    >
      <div onClick={onToggle}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-gray-600 text-[9px] uppercase tracking-[2px]">
              ({series.higherSeed.seed}) vs ({series.lowerSeed.seed})
            </span>
          </div>
          {isComplete && (
            <span className="text-[9px] uppercase tracking-[2px] text-green-500">Final</span>
          )}
        </div>

        <div className="space-y-1.5">
          <div className={`flex items-center justify-between px-3 py-1.5 rounded ${
            hiIsWinner ? 'bg-green-500/10' : ''
          }`}>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-[10px] w-4">{series.higherSeed.seed}</span>
              <span className={`text-sm ${
                series.higherSeed.teamId === userTeamId
                  ? 'text-[oklch(64.6%_0.222_41.116)] font-medium'
                  : hiIsWinner ? 'text-white font-medium' : 'text-gray-300'
              }`}>
                {hiName}
              </span>
            </div>
            <span className={`text-sm font-mono ${hiIsWinner ? 'text-white font-bold' : 'text-gray-400'}`}>
              {hiWins}
            </span>
          </div>

          <div className={`flex items-center justify-between px-3 py-1.5 rounded ${
            loIsWinner ? 'bg-green-500/10' : ''
          }`}>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-[10px] w-4">{series.lowerSeed.seed}</span>
              <span className={`text-sm ${
                series.lowerSeed.teamId === userTeamId
                  ? 'text-[oklch(64.6%_0.222_41.116)] font-medium'
                  : loIsWinner ? 'text-white font-medium' : 'text-gray-300'
              }`}>
                {loName}
              </span>
            </div>
            <span className={`text-sm font-mono ${loIsWinner ? 'text-white font-bold' : 'text-gray-400'}`}>
              {loWins}
            </span>
          </div>
        </div>

        {seriesResult && (
          <div className="text-[9px] text-gray-600 mt-2 text-center">
            {expanded ? 'Click to collapse' : 'Click for game scores'}
          </div>
        )}
      </div>

      {expanded && seriesResult && (
        <div className="mt-3 pt-3 border-t border-white/5 space-y-1">
          {seriesResult.gameResults.map((gr) => (
            <GameScoreRow
              key={gr.gameNumber}
              gr={gr}
              teams={teams}
              higherSeedId={series.higherSeed.teamId}
            />
          ))}
        </div>
      )}
    </GlassCard>
  )
}

function GameScoreRow({
  gr,
  teams,
  higherSeedId,
}: {
  gr: SeriesGameResult
  teams: Team[]
  higherSeedId: string
}) {
  const homeWon = gr.result.homeScore > gr.result.awayScore
  const homeName = shortName(teams, gr.homeTeamId)
  const awayName = shortName(teams, gr.awayTeamId)
  const homeIsHigher = gr.homeTeamId === higherSeedId

  return (
    <div className="flex items-center justify-between text-xs px-2 py-1.5 rounded hover:bg-white/[0.02]">
      <span className="text-gray-600 w-8">G{gr.gameNumber}</span>
      <div className="flex-1 flex items-center gap-1">
        <span className={`${!homeIsHigher && homeWon ? 'text-white font-medium' : homeIsHigher && homeWon ? 'text-white font-medium' : 'text-gray-500'}`}>
          {awayName}
        </span>
        <span className="text-gray-600 mx-1">@</span>
        <span className={`${homeWon ? 'text-white font-medium' : 'text-gray-500'}`}>
          {homeName}
        </span>
      </div>
      <div className="font-mono text-right">
        <span className={!homeWon ? 'text-white' : 'text-gray-500'}>{gr.result.awayScore}</span>
        <span className="text-gray-700 mx-1">-</span>
        <span className={homeWon ? 'text-white' : 'text-gray-500'}>{gr.result.homeScore}</span>
        {gr.result.overtime > 0 && (
          <span className="text-gray-600 text-[9px] ml-1">
            {gr.result.overtime > 1 ? `${gr.result.overtime}OT` : 'OT'}
          </span>
        )}
      </div>
    </div>
  )
}

function ChampionBanner({
  teams,
  championId,
  finalsLoserId,
  players,
  mvpId,
}: {
  teams: Team[]
  championId: string
  finalsLoserId: string
  players: { id: string; bio: { firstName: string; lastName: string } }[]
  mvpId: string | null
}) {
  const champName = teamName(teams, championId)
  const runnerUp = teamName(teams, finalsLoserId)
  const mvp = mvpId ? players.find(p => p.id === mvpId) : null

  return (
    <GlassCard className="p-8 mb-8 text-center bg-gradient-to-b from-[oklch(64.6%_0.222_41.116)]/5 to-transparent border border-[oklch(64.6%_0.222_41.116)]/10">
      <div className="text-[10px] uppercase tracking-[3px] text-[oklch(64.6%_0.222_41.116)] mb-3">
        Champion
      </div>
      <h2 className="text-3xl font-display tracking-wide text-white mb-2">
        {champName}
      </h2>
      <p className="text-gray-500 text-sm mb-4">
        defeated {runnerUp}
      </p>
      {mvp && (
        <div className="inline-block px-4 py-2 rounded-lg bg-white/[0.03]">
          <span className="text-[9px] uppercase tracking-[2px] text-gray-600">Playoff MVP</span>
          <div className="text-sm text-[oklch(64.6%_0.222_41.116)] font-medium mt-0.5">
            {mvp.bio.firstName} {mvp.bio.lastName}
          </div>
        </div>
      )}
    </GlassCard>
  )
}

export default function PlayoffsPage() {
  const { teams, state, players, loading, simming, simProgress, playoffResults, simPlayoffs, startDraft } = useLeague()
  const [expandedSeries, setExpandedSeries] = useState<Set<string>>(new Set())

  const eastSeeds = useMemo(
    () => seedTeamsByConference(teams, 'Eastern'),
    [teams],
  )

  const westSeeds = useMemo(
    () => seedTeamsByConference(teams, 'Western'),
    [teams],
  )

  const seasonComplete = useMemo(
    () => isRegularSeasonComplete(teams, state?.settings?.gamesPerSeason ?? 82),
    [teams, state],
  )

  const seriesMap = useMemo(() => {
    if (!playoffResults) return new Map<string, SeriesResult>()
    return new Map(playoffResults.seriesResults.map(sr => [sr.seriesId, sr]))
  }, [playoffResults])

  const seriesByRound = useMemo(() => {
    if (!playoffResults) return new Map<number, PlayoffSeries[]>()
    const map = new Map<number, PlayoffSeries[]>()
    for (const s of playoffResults.bracket.series) {
      const arr = map.get(s.round) ?? []
      arr.push(s)
      map.set(s.round, arr)
    }
    return map
  }, [playoffResults])

  if (loading || !state) {
    return (
      <PageTransition>
        <div className="text-gray-400 text-center py-20">Loading playoffs...</div>
      </PageTransition>
    )
  }

  const isPlayoffs = state.currentPhase === 'playoffs'
  const hasResults = !!playoffResults

  const gamesPlayed = teams.length > 0
    ? Math.round(teams.reduce((s, t) => s + t.seasonRecord.wins + t.seasonRecord.losses, 0) / teams.length)
    : 0

  const toggleSeries = (seriesId: string) => {
    setExpandedSeries(prev => {
      const next = new Set(prev)
      if (next.has(seriesId)) next.delete(seriesId)
      else next.add(seriesId)
      return next
    })
  }

  return (
    <PageTransition>
      <div>
        <div className="flex items-center justify-between mb-2">
          <h1 className="font-display text-4xl tracking-wide text-white">Playoffs</h1>
          {isPlayoffs && !hasResults && (
            <Button
              onClick={simPlayoffs}
              disabled={simming}
            >
              {simming ? simProgress ?? 'Simulating...' : 'Simulate Playoffs'}
            </Button>
          )}
          {hasResults && isPlayoffs && (
            <Button onClick={startDraft}>
              Proceed to Draft
            </Button>
          )}
        </div>
        <p className="text-gray-500 text-sm mb-6">
          {hasResults
            ? 'Playoff bracket complete'
            : isPlayoffs
              ? 'Ready to simulate — best-of-7 series'
              : seasonComplete
                ? 'Regular season complete — playoff seeding finalized'
                : `Regular season in progress — ${gamesPlayed} games played per team`}
        </p>

        {/* Champion Banner */}
        {hasResults && playoffResults.championId && (
          <ChampionBanner
            teams={teams}
            championId={playoffResults.championId}
            finalsLoserId={playoffResults.finalsLoserId}
            players={players}
            mvpId={playoffResults.playoffMvpId}
          />
        )}

        {/* Season In Progress */}
        {!seasonComplete && !isPlayoffs && !hasResults && (
          <GlassCard className="p-8 mb-8">
            <div className="text-center">
              <h2 className="text-xl font-display tracking-wide text-white mb-3">
                Season In Progress
              </h2>
              <p className="text-gray-500 text-sm max-w-md mx-auto mb-4">
                The playoff bracket will be set once the regular season is complete. Continue simulating
                games from the Schedule page.
              </p>
              <div className="flex justify-center gap-8">
                <div className="text-center">
                  <div className="text-3xl font-semibold text-[oklch(64.6%_0.222_41.116)]">
                    {gamesPlayed}
                  </div>
                  <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mt-1">
                    Avg GP
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-semibold text-white">
                    {state.settings?.gamesPerSeason ?? 82}
                  </div>
                  <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mt-1">
                    Total Games
                  </div>
                </div>
              </div>
            </div>
          </GlassCard>
        )}

        {/* Bracket Results */}
        {hasResults && (
          <div className="space-y-8">
            {[1, 2, 3, 4].map(round => {
              const roundSeries = seriesByRound.get(round as 1 | 2 | 3 | 4) ?? []
              if (roundSeries.length === 0) return null

              const eastSeries = roundSeries.filter(s => s.conference === 'Eastern')
              const westSeries = roundSeries.filter(s => s.conference === 'Western')
              const finalsSeries = roundSeries.filter(s => s.conference === 'Finals')

              return (
                <div key={round}>
                  <h2 className="text-[10px] uppercase tracking-[3px] text-gray-600 mb-4">
                    {ROUND_LABELS[round]}
                  </h2>

                  {round < 4 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div>
                        <h3 className="text-[9px] uppercase tracking-[2px] text-gray-700 mb-2">Eastern</h3>
                        <div className="space-y-3">
                          {eastSeries.map(s => (
                            <SeriesCard
                              key={s.id}
                              series={s}
                              seriesResult={seriesMap.get(s.id)}
                              teams={teams}
                              userTeamId={state.userTeamId}
                              expanded={expandedSeries.has(s.id)}
                              onToggle={() => toggleSeries(s.id)}
                            />
                          ))}
                        </div>
                      </div>
                      <div>
                        <h3 className="text-[9px] uppercase tracking-[2px] text-gray-700 mb-2">Western</h3>
                        <div className="space-y-3">
                          {westSeries.map(s => (
                            <SeriesCard
                              key={s.id}
                              series={s}
                              seriesResult={seriesMap.get(s.id)}
                              teams={teams}
                              userTeamId={state.userTeamId}
                              expanded={expandedSeries.has(s.id)}
                              onToggle={() => toggleSeries(s.id)}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="max-w-lg mx-auto">
                      {finalsSeries.map(s => (
                        <SeriesCard
                          key={s.id}
                          series={s}
                          seriesResult={seriesMap.get(s.id)}
                          teams={teams}
                          userTeamId={state.userTeamId}
                          expanded={expandedSeries.has(s.id)}
                          onToggle={() => toggleSeries(s.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Pre-results seeding display */}
        {!hasResults && (seasonComplete || isPlayoffs) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <h2 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">
                Eastern Conference
              </h2>
              <GlassCard className="p-5">
                <h3 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">Seeding</h3>
                <div className="space-y-1">
                  {eastSeeds.map((seed, i) => {
                    const team = teams.find(t => t.id === seed.teamId)
                    return (
                      <div
                        key={seed.teamId}
                        className={`flex items-center gap-3 px-4 py-2.5 rounded-lg ${
                          seed.teamId === state.userTeamId
                            ? 'bg-accent/5'
                            : i < 8
                              ? 'bg-[oklch(64.6%_0.222_41.116)]/5'
                              : 'hover:bg-white/[0.02]'
                        }`}
                      >
                        <span className="text-gray-500 text-xs font-medium w-5 text-center">{seed.seed}</span>
                        <span className={`text-sm font-medium flex-1 ${
                          seed.teamId === state.userTeamId ? 'text-[oklch(64.6%_0.222_41.116)]' : 'text-white'
                        }`}>
                          {team ? `${team.info.city} ${team.info.name}` : seed.teamId}
                        </span>
                        <span className="text-gray-400 text-xs">{seed.wins}-{seed.losses}</span>
                      </div>
                    )
                  })}
                </div>
              </GlassCard>

              <h3 className="text-[10px] uppercase tracking-[2px] text-gray-600 mt-4 mb-3">
                First Round Matchups
              </h3>
              <div className="space-y-2">
                {[[0, 7], [3, 4], [2, 5], [1, 6]].map(([hiIdx, loIdx]) => {
                  const hi = eastSeeds[hiIdx]
                  const lo = eastSeeds[loIdx]
                  if (!hi || !lo) return null
                  return (
                    <GlassCard key={`${hi.teamId}-${lo.teamId}`} className="p-3">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 text-[10px] w-4">{hi.seed}</span>
                          <span className={hi.teamId === state.userTeamId ? 'text-[oklch(64.6%_0.222_41.116)]' : 'text-white'}>
                            {shortName(teams, hi.teamId)}
                          </span>
                        </div>
                        <span className="text-gray-600 text-[9px]">vs</span>
                        <div className="flex items-center gap-2">
                          <span className={lo.teamId === state.userTeamId ? 'text-[oklch(64.6%_0.222_41.116)]' : 'text-white'}>
                            {shortName(teams, lo.teamId)}
                          </span>
                          <span className="text-gray-500 text-[10px] w-4">{lo.seed}</span>
                        </div>
                      </div>
                    </GlassCard>
                  )
                })}
              </div>
            </div>

            <div>
              <h2 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">
                Western Conference
              </h2>
              <GlassCard className="p-5">
                <h3 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">Seeding</h3>
                <div className="space-y-1">
                  {westSeeds.map((seed, i) => {
                    const team = teams.find(t => t.id === seed.teamId)
                    return (
                      <div
                        key={seed.teamId}
                        className={`flex items-center gap-3 px-4 py-2.5 rounded-lg ${
                          seed.teamId === state.userTeamId
                            ? 'bg-accent/5'
                            : i < 8
                              ? 'bg-[oklch(64.6%_0.222_41.116)]/5'
                              : 'hover:bg-white/[0.02]'
                        }`}
                      >
                        <span className="text-gray-500 text-xs font-medium w-5 text-center">{seed.seed}</span>
                        <span className={`text-sm font-medium flex-1 ${
                          seed.teamId === state.userTeamId ? 'text-[oklch(64.6%_0.222_41.116)]' : 'text-white'
                        }`}>
                          {team ? `${team.info.city} ${team.info.name}` : seed.teamId}
                        </span>
                        <span className="text-gray-400 text-xs">{seed.wins}-{seed.losses}</span>
                      </div>
                    )
                  })}
                </div>
              </GlassCard>

              <h3 className="text-[10px] uppercase tracking-[2px] text-gray-600 mt-4 mb-3">
                First Round Matchups
              </h3>
              <div className="space-y-2">
                {[[0, 7], [3, 4], [2, 5], [1, 6]].map(([hiIdx, loIdx]) => {
                  const hi = westSeeds[hiIdx]
                  const lo = westSeeds[loIdx]
                  if (!hi || !lo) return null
                  return (
                    <GlassCard key={`${hi.teamId}-${lo.teamId}`} className="p-3">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 text-[10px] w-4">{hi.seed}</span>
                          <span className={hi.teamId === state.userTeamId ? 'text-[oklch(64.6%_0.222_41.116)]' : 'text-white'}>
                            {shortName(teams, hi.teamId)}
                          </span>
                        </div>
                        <span className="text-gray-600 text-[9px]">vs</span>
                        <div className="flex items-center gap-2">
                          <span className={lo.teamId === state.userTeamId ? 'text-[oklch(64.6%_0.222_41.116)]' : 'text-white'}>
                            {shortName(teams, lo.teamId)}
                          </span>
                          <span className="text-gray-500 text-[10px] w-4">{lo.seed}</span>
                        </div>
                      </div>
                    </GlassCard>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  )
}
