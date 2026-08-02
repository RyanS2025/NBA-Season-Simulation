import { useState, useMemo, useCallback } from 'react'
import PageTransition from '../../components/layout/PageTransition'
import GlassCard from '../../components/common/GlassCard'
import Button from '../../components/common/Button'
import { useLeague } from '../../hooks/useLeague'
import { runAllStarWeekend } from '../../utils/allstar-engine'
import type { AllStarRecord } from '../../db/league-db'
import type { Player, Position } from '../../types'

const POSITIONS: Position[] = ['PG', 'SG', 'SF', 'PF', 'C']

function PlayerName({ player }: { player: Player | undefined }) {
  if (!player) return <span className="text-gray-600">Unknown</span>
  return (
    <span className="text-white text-sm">
      {player.bio.firstName} {player.bio.lastName}
      <span className="text-gray-500 ml-1 text-xs">{player.bio.position}</span>
    </span>
  )
}

function RosterList({
  title,
  starters,
  reserves,
  playerMap,
}: {
  title: string
  starters: string[]
  reserves: string[]
  playerMap: Map<string, Player>
}) {
  return (
    <GlassCard className="p-5">
      <h3 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">{title}</h3>
      <div className="mb-4">
        <div className="text-[10px] uppercase tracking-[1px] text-gray-600 mb-2">Starters</div>
        <div className="space-y-1.5">
          {starters.map(id => (
            <div key={id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03]">
              <div className="w-1.5 h-1.5 rounded-full bg-[oklch(64.6%_0.222_41.116)]" />
              <PlayerName player={playerMap.get(id)} />
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-[1px] text-gray-600 mb-2">Reserves</div>
        <div className="space-y-1.5">
          {reserves.map(id => (
            <div key={id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/[0.02]">
              <PlayerName player={playerMap.get(id)} />
            </div>
          ))}
        </div>
      </div>
    </GlassCard>
  )
}

function VotingPanel({
  title,
  candidates,
  votes,
  onToggle,
}: {
  title: string
  candidates: Player[]
  votes: Map<Position, string>
  onToggle: (player: Player) => void
}) {
  const selectedIds = new Set(votes.values())

  return (
    <GlassCard className="p-5">
      <h3 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">{title}</h3>
      <div className="flex gap-2 mb-4">
        {POSITIONS.map(pos => (
          <span
            key={pos}
            className={`text-[10px] font-mono px-2 py-0.5 rounded ${
              votes.has(pos)
                ? 'bg-[oklch(64.6%_0.222_41.116/0.2)] text-[oklch(64.6%_0.222_41.116)]'
                : 'bg-white/[0.06] text-gray-500'
            }`}
          >
            {pos}
          </span>
        ))}
      </div>
      <div className="space-y-1">
        {candidates.map(p => {
          const isSelected = selectedIds.has(p.id)
          const positionFilled = votes.has(p.bio.position) && !isSelected

          return (
            <button
              key={p.id}
              onClick={() => onToggle(p)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all duration-150 ${
                isSelected
                  ? 'bg-[oklch(64.6%_0.222_41.116/0.12)] border border-[oklch(64.6%_0.222_41.116/0.35)]'
                  : positionFilled
                    ? 'bg-white/[0.02] border border-transparent opacity-40'
                    : 'bg-white/[0.03] hover:bg-white/[0.06] border border-transparent'
              }`}
            >
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0 ${
                isSelected
                  ? 'bg-[oklch(64.6%_0.222_41.116/0.25)] text-[oklch(64.6%_0.222_41.116)]'
                  : positionFilled
                    ? 'bg-white/[0.04] text-gray-600'
                    : 'bg-white/[0.06] text-gray-400'
              }`}>
                {p.bio.position}
              </span>
              <span className={isSelected ? 'text-white text-sm font-medium' : 'text-gray-300 text-sm'}>
                {p.bio.firstName} {p.bio.lastName}
              </span>
              {isSelected && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[oklch(64.6%_0.222_41.116)]" />
              )}
            </button>
          )
        })}
      </div>
      <div className="mt-3 text-[10px] text-gray-600">
        {votes.size}/5 positions filled
      </div>
    </GlassCard>
  )
}

export default function AllStarPage() {
  const { state, teams, players, db } = useLeague()
  const [record, setRecord] = useState<AllStarRecord | null>(null)
  const [phase, setPhase] = useState<'voting' | 'locked' | 'simulated'>('voting')
  const [eastVotes, setEastVotes] = useState<Map<Position, string>>(new Map())
  const [westVotes, setWestVotes] = useState<Map<Position, string>>(new Map())

  const playerMap = useMemo(
    () => new Map(players.map(p => [p.id, p])),
    [players],
  )

  const eligiblePlayers = useMemo(() => {
    const teamConf = new Map(teams.map(t => [t.id, t.info.conference]))

    const score = (p: Player) => {
      if (!p.careerStats || p.careerStats.length === 0) return 0
      const s = p.careerStats[p.careerStats.length - 1]
      if (!s || s.gp < 5) return 0
      return s.ppg + s.rpg * 0.8 + s.apg * 1.2
    }

    const east = players
      .filter(p => teamConf.get(p.teamId) === 'Eastern')
      .sort((a, b) => score(b) - score(a))
      .slice(0, 15)

    const west = players
      .filter(p => teamConf.get(p.teamId) === 'Western')
      .sort((a, b) => score(b) - score(a))
      .slice(0, 15)

    return { east, west }
  }, [players, teams])

  const toggleVote = useCallback((conference: 'east' | 'west', player: Player) => {
    const setter = conference === 'east' ? setEastVotes : setWestVotes

    setter(prev => {
      const next = new Map(prev)
      if (prev.get(player.bio.position) === player.id) {
        next.delete(player.bio.position)
      } else {
        next.set(player.bio.position, player.id)
      }
      return next
    })
  }, [])

  const handleLockVotes = useCallback(() => {
    setPhase('locked')
  }, [])

  const handleSimulate = useCallback(async () => {
    if (!state || !db) return

    const eastStarters = POSITIONS.map(pos => eastVotes.get(pos)!)
    const westStarters = POSITIONS.map(pos => westVotes.get(pos)!)

    const result = runAllStarWeekend(
      players,
      teams,
      state.currentSeason,
      { east: eastStarters, west: westStarters },
    )
    await db.allStarHistory.put(result)
    setRecord(result)
    setPhase('simulated')
  }, [state, teams, players, db, eastVotes, westVotes])

  if (!state) {
    return (
      <PageTransition>
        <div className="text-gray-400 text-center py-20">Loading...</div>
      </PageTransition>
    )
  }

  if (phase === 'voting') {
    const allVotesIn = eastVotes.size === 5 && westVotes.size === 5

    return (
      <PageTransition>
        <div>
          <h1 className="font-display text-4xl tracking-wide text-white mb-2">All-Star Weekend</h1>
          <p className="text-gray-400 text-sm mb-6">
            Vote for 5 starters per conference — one at each position.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <VotingPanel
              title="Eastern Conference"
              candidates={eligiblePlayers.east}
              votes={eastVotes}
              onToggle={(p) => toggleVote('east', p)}
            />
            <VotingPanel
              title="Western Conference"
              candidates={eligiblePlayers.west}
              votes={westVotes}
              onToggle={(p) => toggleVote('west', p)}
            />
          </div>
          <div className="flex justify-center">
            <Button
              variant="primary"
              size="md"
              disabled={!allVotesIn}
              onClick={handleLockVotes}
            >
              Lock Votes
            </Button>
          </div>
        </div>
      </PageTransition>
    )
  }

  if (phase === 'locked') {
    return (
      <PageTransition>
        <div>
          <h1 className="font-display text-4xl tracking-wide text-white mb-6">All-Star Weekend</h1>
          <GlassCard className="p-8 text-center">
            <p className="text-gray-400 mb-2">
              Season {state.currentSeason} All-Star starters are locked in.
            </p>
            <p className="text-gray-500 text-sm mb-6">
              Reserves will be selected by coaches based on season performance.
            </p>
            <Button variant="primary" size="md" onClick={handleSimulate}>
              Simulate All-Star Weekend
            </Button>
          </GlassCard>
        </div>
      </PageTransition>
    )
  }

  if (!record) return null

  const getName = (id: string | undefined) => {
    if (!id) return 'N/A'
    const p = playerMap.get(id)
    return p ? `${p.bio.firstName} ${p.bio.lastName}` : 'Unknown'
  }

  return (
    <PageTransition>
      <div>
        <h1 className="font-display text-4xl tracking-wide text-white mb-6">All-Star Weekend</h1>

        {record.gameScore && (
          <GlassCard className="p-8 mb-8">
            <div className="text-center">
              <h2 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-4">All-Star Game</h2>
              <div className="flex items-center justify-center gap-8">
                <div className="text-center">
                  <div className="text-[10px] uppercase tracking-[1px] text-gray-600 mb-1">East</div>
                  <div className={`text-5xl font-semibold ${
                    record.gameScore.eastScore > record.gameScore.westScore
                      ? 'text-[oklch(64.6%_0.222_41.116)]'
                      : 'text-white'
                  }`}>
                    {record.gameScore.eastScore}
                  </div>
                </div>
                <span className="text-gray-600 text-xl">-</span>
                <div className="text-center">
                  <div className="text-[10px] uppercase tracking-[1px] text-gray-600 mb-1">West</div>
                  <div className={`text-5xl font-semibold ${
                    record.gameScore.westScore > record.gameScore.eastScore
                      ? 'text-[oklch(64.6%_0.222_41.116)]'
                      : 'text-white'
                  }`}>
                    {record.gameScore.westScore}
                  </div>
                </div>
              </div>
              {record.gameScore.mvpId && (
                <div className="mt-4 text-sm text-gray-400">
                  All-Star Game MVP: <span className="text-[oklch(64.6%_0.222_41.116)] font-medium">{getName(record.gameScore.mvpId)}</span>
                </div>
              )}
            </div>
          </GlassCard>
        )}

        <h2 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">Contest Winners</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <GlassCard className="p-5 text-center">
            <div className="text-[10px] uppercase tracking-[1px] text-gray-600 mb-2">3-Point Contest</div>
            <div className="text-[oklch(64.6%_0.222_41.116)] font-medium">{getName(record.contestWinners.threePoint)}</div>
          </GlassCard>
          <GlassCard className="p-5 text-center">
            <div className="text-[10px] uppercase tracking-[1px] text-gray-600 mb-2">Slam Dunk Contest</div>
            <div className="text-[oklch(64.6%_0.222_41.116)] font-medium">{getName(record.contestWinners.dunk)}</div>
          </GlassCard>
          <GlassCard className="p-5 text-center">
            <div className="text-[10px] uppercase tracking-[1px] text-gray-600 mb-2">Skills Challenge</div>
            <div className="text-[oklch(64.6%_0.222_41.116)] font-medium">{getName(record.contestWinners.skills)}</div>
          </GlassCard>
        </div>

        <h2 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">All-Star Rosters</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <RosterList
            title="Eastern Conference"
            starters={record.starters.east}
            reserves={record.reserves.east}
            playerMap={playerMap}
          />
          <RosterList
            title="Western Conference"
            starters={record.starters.west}
            reserves={record.reserves.west}
            playerMap={playerMap}
          />
        </div>
      </div>
    </PageTransition>
  )
}
