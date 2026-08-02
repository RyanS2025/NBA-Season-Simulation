import { useState, useMemo, useCallback } from 'react'
import PageTransition from '../../components/layout/PageTransition'
import GlassCard from '../../components/common/GlassCard'
import Button from '../../components/common/Button'
import { useLeague } from '../../hooks/useLeague'
import { runAllStarWeekend } from '../../utils/allstar-engine'
import type { AllStarRecord } from '../../db/league-db'
import type { Player } from '../../types'

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

export default function AllStarPage() {
  const { state, teams, players, db } = useLeague()
  const [record, setRecord] = useState<AllStarRecord | null>(null)
  const [simulated, setSimulated] = useState(false)

  const playerMap = useMemo(
    () => new Map(players.map(p => [p.id, p])),
    [players],
  )

  const handleSimulate = useCallback(async () => {
    if (!state || !db) return
    const result = runAllStarWeekend(players, teams, state.currentSeason)
    await db.allStarHistory.put(result)
    setRecord(result)
    setSimulated(true)
  }, [state, teams, players, db])

  if (!state) {
    return (
      <PageTransition>
        <div className="text-gray-400 text-center py-20">Loading...</div>
      </PageTransition>
    )
  }

  if (!simulated && !record) {
    return (
      <PageTransition>
        <div>
          <h1 className="font-display text-4xl tracking-wide text-white mb-6">All-Star Weekend</h1>
          <GlassCard className="p-8 text-center">
            <p className="text-gray-400 mb-6">
              Season {state.currentSeason} All-Star Weekend is ready to begin.
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

        {/* Game Score */}
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

        {/* Contest Winners */}
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

        {/* Rosters */}
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
