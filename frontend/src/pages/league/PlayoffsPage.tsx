import { useState, useMemo, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import PageTransition from '../../components/layout/PageTransition'
import GlassCard from '../../components/common/GlassCard'
import Button from '../../components/common/Button'
import { useLeague } from '../../hooks/useLeague'
import {
  seedTeamsByConference,
  generateFirstRound,
  isRegularSeasonComplete,
} from '../../utils/playoff-engine'
import type { Team } from '../../types'

interface BracketSeed {
  teamId: string
  seed: number
  wins: number
  losses: number
}

function TeamSeedRow({
  seed,
  team,
  isUserTeam,
  highlight,
}: {
  seed: BracketSeed
  team: Team | undefined
  isUserTeam: boolean
  highlight: boolean
}) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-2.5 rounded-lg ${
        highlight
          ? 'bg-[oklch(64.6%_0.222_41.116)]/8 border border-[oklch(64.6%_0.222_41.116)]/20'
          : isUserTeam
            ? 'bg-accent/5'
            : 'hover:bg-white/[0.02]'
      }`}
    >
      <span className="text-gray-500 text-xs font-medium w-5 text-center">{seed.seed}</span>
      <span className={`text-sm font-medium flex-1 ${isUserTeam ? 'text-[oklch(64.6%_0.222_41.116)]' : 'text-white'}`}>
        {team ? `${team.info.city} ${team.info.name}` : seed.teamId}
      </span>
      <span className="text-gray-400 text-xs">{seed.wins}-{seed.losses}</span>
    </div>
  )
}

function MatchupCard({
  higher,
  lower,
  teams,
  userTeamId,
  round,
}: {
  higher: BracketSeed
  lower: BracketSeed
  teams: Team[]
  userTeamId: string
  round: number
}) {
  const hiTeam = teams.find(t => t.id === higher.teamId)
  const loTeam = teams.find(t => t.id === lower.teamId)
  const hasUserTeam = higher.teamId === userTeamId || lower.teamId === userTeamId

  return (
    <GlassCard className={`p-3 ${hasUserTeam ? 'ring-1 ring-[oklch(64.6%_0.222_41.116)]/20' : ''}`}>
      <div className="text-[9px] uppercase tracking-[2px] text-gray-600 mb-2">
        Round {round}
      </div>
      <div className="space-y-1">
        <TeamSeedRow
          seed={higher}
          team={hiTeam}
          isUserTeam={higher.teamId === userTeamId}
          highlight={false}
        />
        <div className="text-center text-[9px] uppercase tracking-[2px] text-gray-700 py-0.5">vs</div>
        <TeamSeedRow
          seed={lower}
          team={loTeam}
          isUserTeam={lower.teamId === userTeamId}
          highlight={false}
        />
      </div>
    </GlassCard>
  )
}

export default function PlayoffsPage() {
  const { id: leagueId } = useParams()
  const { teams, state, loading, db } = useLeague()

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

  if (loading || !state) {
    return (
      <PageTransition>
        <div className="text-gray-400 text-center py-20">Loading playoffs...</div>
      </PageTransition>
    )
  }

  const isPlayoffs = state.currentPhase === 'playoffs' || state.currentPhase === 'champion'
  const gamesPlayed = teams.length > 0
    ? Math.round(teams.reduce((s, t) => s + t.seasonRecord.wins + t.seasonRecord.losses, 0) / teams.length)
    : 0

  const eastMatchups = [
    [0, 7], [3, 4], [2, 5], [1, 6],
  ]
  const westMatchups = [
    [0, 7], [3, 4], [2, 5], [1, 6],
  ]

  return (
    <PageTransition>
      <div>
        <h1 className="font-display text-4xl tracking-wide text-white mb-2">Playoffs</h1>
        <p className="text-gray-500 text-sm mb-6">
          {isPlayoffs
            ? 'Playoff bracket — best-of-7 series'
            : seasonComplete
              ? 'Regular season complete — playoff seeding finalized'
              : `Regular season in progress — ${gamesPlayed} games played per team`}
        </p>

        {!seasonComplete && !isPlayoffs && (
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Eastern Conference */}
          <div>
            <h2 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">
              Eastern Conference
            </h2>

            <GlassCard className="p-5 mb-4">
              <h3 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">Seeding</h3>
              <div className="space-y-1">
                {eastSeeds.map((seed, i) => {
                  const team = teams.find(t => t.id === seed.teamId)
                  return (
                    <TeamSeedRow
                      key={seed.teamId}
                      seed={seed}
                      team={team}
                      isUserTeam={seed.teamId === state.userTeamId}
                      highlight={i < 6}
                    />
                  )
                })}
              </div>
              {eastSeeds.length < 8 && (
                <p className="text-gray-600 text-xs mt-3 italic">
                  Seeding updates as games are played
                </p>
              )}
            </GlassCard>

            <h3 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">
              First Round Matchups
            </h3>
            <div className="space-y-3">
              {eastMatchups.map(([hiIdx, loIdx]) => {
                const hi = eastSeeds[hiIdx]
                const lo = eastSeeds[loIdx]
                if (!hi || !lo) return null
                return (
                  <MatchupCard
                    key={`${hi.teamId}-${lo.teamId}`}
                    higher={hi}
                    lower={lo}
                    teams={teams}
                    userTeamId={state.userTeamId}
                    round={1}
                  />
                )
              })}
            </div>
          </div>

          {/* Western Conference */}
          <div>
            <h2 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">
              Western Conference
            </h2>

            <GlassCard className="p-5 mb-4">
              <h3 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">Seeding</h3>
              <div className="space-y-1">
                {westSeeds.map((seed, i) => {
                  const team = teams.find(t => t.id === seed.teamId)
                  return (
                    <TeamSeedRow
                      key={seed.teamId}
                      seed={seed}
                      team={team}
                      isUserTeam={seed.teamId === state.userTeamId}
                      highlight={i < 6}
                    />
                  )
                })}
              </div>
            </GlassCard>

            <h3 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">
              First Round Matchups
            </h3>
            <div className="space-y-3">
              {westMatchups.map(([hiIdx, loIdx]) => {
                const hi = westSeeds[hiIdx]
                const lo = westSeeds[loIdx]
                if (!hi || !lo) return null
                return (
                  <MatchupCard
                    key={`${hi.teamId}-${lo.teamId}`}
                    higher={hi}
                    lower={lo}
                    teams={teams}
                    userTeamId={state.userTeamId}
                    round={1}
                  />
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  )
}
