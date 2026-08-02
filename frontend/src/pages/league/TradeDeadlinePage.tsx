import { useState, useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import PageTransition from '../../components/layout/PageTransition'
import GlassCard from '../../components/common/GlassCard'
import Button from '../../components/common/Button'
import { useLeague } from '../../hooks/useLeague'
import { simulateTradeDeadlineDay, type DeadlineHourBlock } from '../../utils/cpu-trade-ai'

export default function TradeDeadlinePage() {
  const { id: leagueId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { state, teams, players, db } = useLeague()
  const [hourBlocks, setHourBlocks] = useState<DeadlineHourBlock[] | null>(null)
  const [running, setRunning] = useState(false)
  const [revealedIndex, setRevealedIndex] = useState(0)

  const teamMap = useMemo(
    () => new Map(teams.map(t => [t.id, `${t.info.city} ${t.info.name}`])),
    [teams],
  )

  const handleSimulate = useCallback(async () => {
    if (!state || !db) return
    setRunning(true)

    const result = simulateTradeDeadlineDay(
      teams,
      players,
      [],
      state.currentSeason,
      state.currentDate,
      state.userTeamId,
    )

    setHourBlocks(result)
    setRevealedIndex(0)
    setRunning(false)
  }, [state, teams, players, db])

  const totalTrades = hourBlocks?.reduce((sum, b) => sum + b.trades.length, 0) ?? 0

  if (!state) {
    return (
      <PageTransition>
        <div className="text-gray-400 text-center py-20">Loading...</div>
      </PageTransition>
    )
  }

  if (!hourBlocks) {
    return (
      <PageTransition>
        <div>
          <h1 className="font-display text-4xl tracking-wide text-white mb-2">Trade Deadline Day</h1>
          <p className="text-gray-500 text-sm mb-8">Season {state.currentSeason} &mdash; The trade deadline is here. CPU teams are making their final moves.</p>
          <GlassCard className="p-8 text-center">
            <p className="text-gray-400 mb-6">
              Simulate the full trade deadline day. Trades will escalate in urgency as the clock ticks down.
            </p>
            <Button variant="primary" size="md" onClick={handleSimulate} disabled={running}>
              {running ? 'Simulating...' : 'Start Trade Deadline'}
            </Button>
          </GlassCard>
        </div>
      </PageTransition>
    )
  }

  const visibleBlocks = hourBlocks.slice(0, revealedIndex + 1)
  const hasMore = revealedIndex < hourBlocks.length - 1

  return (
    <PageTransition>
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-4xl tracking-wide text-white">Trade Deadline Day</h1>
            <p className="text-gray-500 text-sm mt-1">{totalTrades} trade{totalTrades !== 1 ? 's' : ''} completed</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => navigate(`/league/${leagueId}/transactions`)}>
            View All Transactions
          </Button>
        </div>

        {hourBlocks.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <p className="text-gray-500">A quiet deadline day — no trades were made.</p>
          </GlassCard>
        ) : (
          <div className="space-y-6">
            {visibleBlocks.map((block, bi) => (
              <div key={block.hour}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="text-[10px] uppercase tracking-[2px] text-gray-600">
                    {block.hour > 12 ? block.hour - 12 : block.hour}:00 {block.hour >= 12 ? 'PM' : 'AM'}
                  </div>
                  <div className="text-xs text-[oklch(64.6%_0.222_41.116)] font-medium">{block.label}</div>
                  <div className="flex-1 h-px bg-white/[0.06]" />
                </div>

                <div className="space-y-2">
                  {block.trades.map((trade, ti) => (
                    <GlassCard
                      key={`${bi}-${ti}`}
                      className={`p-4 border-l-2 ${
                        trade.isBreaking
                          ? 'border-l-[oklch(64.6%_0.222_41.116)]'
                          : 'border-l-white/[0.10]'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {trade.isBreaking && (
                          <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[oklch(64.6%_0.222_41.116)]/15 text-[oklch(64.6%_0.222_41.116)]">
                            Breaking
                          </span>
                        )}
                        <div className="flex-1">
                          <div className="text-sm text-white font-medium">{trade.headline}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            {teamMap.get(trade.proposal.team1Id) ?? 'Unknown'} ↔ {teamMap.get(trade.proposal.team2Id) ?? 'Unknown'}
                          </div>
                        </div>
                      </div>
                    </GlassCard>
                  ))}
                </div>
              </div>
            ))}

            {hasMore && (
              <div className="text-center">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setRevealedIndex(i => i + 1)}
                >
                  Next Hour →
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </PageTransition>
  )
}
