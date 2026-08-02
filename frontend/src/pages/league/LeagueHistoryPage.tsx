import PageTransition from '../../components/layout/PageTransition'
import GlassCard from '../../components/common/GlassCard'
import { useLeague } from '../../hooks/useLeague'

export default function LeagueHistoryPage() {
  const { state, teams, loading } = useLeague()

  if (loading || !state) {
    return (
      <PageTransition>
        <div className="text-gray-400 text-center py-20">Loading history...</div>
      </PageTransition>
    )
  }

  const allSorted = [...teams].sort((a, b) => b.seasonRecord.wins - a.seasonRecord.wins)
  const gamesPlayed = allSorted[0] ? allSorted[0].seasonRecord.wins + allSorted[0].seasonRecord.losses : 0

  return (
    <PageTransition>
      <div>
        <h1 className="font-display text-4xl tracking-wide text-white mb-6">League History</h1>

        <GlassCard className="p-8 mb-8">
          <div className="text-center">
            <h2 className="text-xl font-display tracking-wide text-white mb-3">Season 1 In Progress</h2>
            <p className="text-gray-500 text-sm max-w-md mx-auto mb-6">
              This is the inaugural season of the league. History will be recorded as the season progresses
              and future seasons are completed.
            </p>
            <div className="flex justify-center gap-8">
              <div className="text-center">
                <div className="text-3xl font-semibold text-[oklch(64.6%_0.222_41.116)]">{state.currentSeason}</div>
                <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mt-1">Season</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-semibold text-white">{gamesPlayed}</div>
                <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mt-1">Games Played</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-semibold text-white">0</div>
                <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mt-1">Champions</div>
              </div>
            </div>
          </div>
        </GlassCard>

        <h2 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">Current Season Snapshot</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <GlassCard className="p-5">
            <h3 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">Top Teams</h3>
            <div className="space-y-1">
              {allSorted.slice(0, 10).map((t, i) => (
                <div key={t.id} className={`flex items-center justify-between px-3 py-2 rounded-lg ${
                  t.id === state.userTeamId ? 'bg-accent/5' : 'hover:bg-white/[0.02]'
                }`}>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-500 w-5 text-center text-xs">{i + 1}</span>
                    <span className={t.id === state.userTeamId ? 'text-accent text-sm font-medium' : 'text-white text-sm'}>
                      {t.info.city} {t.info.name}
                    </span>
                  </div>
                  <span className="text-gray-400 text-xs">{t.seasonRecord.wins}-{t.seasonRecord.losses}</span>
                </div>
              ))}
            </div>
          </GlassCard>

          <GlassCard className="p-5">
            <h3 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">League Milestones</h3>
            <div className="space-y-3">
              <div className="px-3 py-3 bg-white/[0.02] rounded-lg">
                <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-1">First Game</div>
                <div className="text-sm text-white">October 22, {state.currentSeason}</div>
              </div>
              <div className="px-3 py-3 bg-white/[0.02] rounded-lg">
                <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-1">Current Date</div>
                <div className="text-sm text-white">{state.currentDate}</div>
              </div>
              <div className="px-3 py-3 bg-white/[0.02] rounded-lg">
                <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-1">Total Players</div>
                <div className="text-sm text-white">530 across 30 teams</div>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </PageTransition>
  )
}
