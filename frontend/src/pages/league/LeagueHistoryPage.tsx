import { useMemo, useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import PageTransition from '../../components/layout/PageTransition'
import GlassCard from '../../components/common/GlassCard'
import { useLeague } from '../../hooks/useLeague'
import type { Player } from '../../types'
import type { HallOfFameEntry, RetiredPlayer } from '../../db/league-db'

const PHASE_LABELS: Record<string, string> = {
  preseason: 'Preseason',
  regular_season: 'Regular Season',
  extension_deadline: 'Extension Deadline',
  trade_deadline: 'Trade Deadline',
  all_star_break: 'All-Star Break',
  regular_season_post_deadline: 'Regular Season',
  awards_voting: 'Awards Voting',
  playoffs: 'Playoffs',
  champion: 'Champion Crowned',
  draft_lottery: 'Draft Lottery',
  draft: 'Draft',
  free_agency: 'Free Agency',
  coaching_carousel: 'Coaching Carousel',
  offseason: 'Offseason',
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

interface PlayerStatRow {
  id: string
  name: string
  team: string
  value: number
}

function getLatestStats(player: Player) {
  if (!player.careerStats || player.careerStats.length === 0) return null
  return player.careerStats[player.careerStats.length - 1]
}

function buildLeaders(
  players: Player[],
  teamMap: Map<string, string>,
  stat: 'ppg' | 'rpg' | 'apg',
  count: number,
): PlayerStatRow[] {
  const rows: PlayerStatRow[] = []
  for (const p of players) {
    const s = getLatestStats(p)
    if (!s || s.gp === 0) continue
    rows.push({
      id: p.id,
      name: `${p.bio.firstName} ${p.bio.lastName}`,
      team: teamMap.get(p.teamId) ?? '',
      value: s[stat],
    })
  }
  rows.sort((a, b) => b.value - a.value)
  return rows.slice(0, count)
}

interface GameRecord {
  playerId: string
  playerName: string
  value: number
  date: string
  opponent: string
}

export default function LeagueHistoryPage() {
  const { id: leagueId } = useParams<{ id: string }>()
  const { db, state, teams, players, loading } = useLeague()
  const [hallOfFame, setHallOfFame] = useState<HallOfFameEntry[]>([])
  const [retirees, setRetirees] = useState<RetiredPlayer[]>([])
  const [gameRecords, setGameRecords] = useState<{ points: GameRecord[]; rebounds: GameRecord[]; assists: GameRecord[] } | null>(null)

  useEffect(() => {
    if (!db) return
    let cancelled = false
    Promise.all([db.hallOfFame.toArray(), db.retiredPlayers.toArray()]).then(([hof, ret]) => {
      if (cancelled) return
      setHallOfFame(hof.sort((a, b) => b.inductionYear - a.inductionYear))
      setRetirees(ret.sort((a, b) => b.retirementYear - a.retirementYear))
    })
    return () => { cancelled = true }
  }, [db, state?.currentSeason])

  // Scan every stored box score once for the all-time single-game records
  useEffect(() => {
    if (!db || players.length === 0) return
    let cancelled = false

    const nameById = new Map(players.map(p => [p.id, `${p.bio.firstName} ${p.bio.lastName}`]))
    const teamById = new Map(teams.map(t => [t.id, t.info.abbreviation]))

    db.retiredPlayers.toArray().then(async retired => {
      for (const r of retired) nameById.set(r.playerId, r.playerName)
      const all = await db.gameResults.toArray()
      if (cancelled) return

      const tops: Record<'points' | 'rebounds' | 'assists', GameRecord[]> = { points: [], rebounds: [], assists: [] }
      const consider = (list: GameRecord[], rec: GameRecord) => {
        list.push(rec)
        list.sort((a, b) => b.value - a.value)
        if (list.length > 5) list.pop()
      }

      for (const r of all) {
        for (const box of [r.result.homeBoxScore, r.result.awayBoxScore]) {
          const oppId = box.teamId === r.result.homeBoxScore.teamId
            ? r.result.awayBoxScore.teamId : r.result.homeBoxScore.teamId
          const opp = teamById.get(oppId) ?? '???'
          for (const ps of box.playerStats) {
            const playerName = nameById.get(ps.playerId)
            if (!playerName) continue
            if (ps.points >= (tops.points[4]?.value ?? 0)) {
              consider(tops.points, { playerId: ps.playerId, playerName, value: ps.points, date: r.date, opponent: opp })
            }
            if (ps.totalRebounds >= (tops.rebounds[4]?.value ?? 0)) {
              consider(tops.rebounds, { playerId: ps.playerId, playerName, value: ps.totalRebounds, date: r.date, opponent: opp })
            }
            if (ps.assists >= (tops.assists[4]?.value ?? 0)) {
              consider(tops.assists, { playerId: ps.playerId, playerName, value: ps.assists, date: r.date, opponent: opp })
            }
          }
        }
      }
      if (!cancelled) setGameRecords(tops)
    })
    return () => { cancelled = true }
  }, [db, players, teams, state?.currentSeason])

  const titleCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const s of state?.seasonHistory ?? []) {
      counts.set(s.championTeamId, (counts.get(s.championTeamId) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [state?.seasonHistory])

  const teamMap = useMemo(
    () => new Map(teams.map(t => [t.id, `${t.info.city} ${t.info.name}`])),
    [teams],
  )

  const allSorted = useMemo(
    () => [...teams].sort((a, b) => b.seasonRecord.wins - a.seasonRecord.wins),
    [teams],
  )

  const totalPlayers = players.filter(p => p.teamId !== '').length

  const topScorers = useMemo(() => buildLeaders(players, teamMap, 'ppg', 5), [players, teamMap])
  const topRebounders = useMemo(() => buildLeaders(players, teamMap, 'rpg', 5), [players, teamMap])
  const topAssisters = useMemo(() => buildLeaders(players, teamMap, 'apg', 5), [players, teamMap])

  const playerNameMap = useMemo(
    () => new Map(players.map(p => [p.id, `${p.bio.firstName} ${p.bio.lastName}`])),
    [players],
  )

  if (loading || !state) {
    return (
      <PageTransition>
        <div className="text-gray-400 text-center py-20">Loading history...</div>
      </PageTransition>
    )
  }

  const gamesPlayed = allSorted[0]
    ? allSorted[0].seasonRecord.wins + allSorted[0].seasonRecord.losses
    : 0

  const phaseLabel = PHASE_LABELS[state.currentPhase] ?? state.currentPhase

  const history = state.seasonHistory ?? []
  const completedSeasons = history.length

  return (
    <PageTransition>
      <div>
        <h1 className="font-display text-4xl tracking-wide text-white mb-6">League History</h1>

        {/* Current Season Overview */}
        <GlassCard className="p-8 mb-8">
          <div className="text-center">
            <h2 className="text-xl font-display tracking-wide text-white mb-2">
              Season {state.currentSeason}
            </h2>
            <p className="text-gray-400 text-sm mb-6">{phaseLabel} &mdash; {formatDate(state.currentDate)}</p>
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
                <div className="text-3xl font-semibold text-white">{completedSeasons}</div>
                <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mt-1">Completed Seasons</div>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Top Teams */}
        <h2 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">Current Season Snapshot</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
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
            <h3 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">League Records</h3>
            <div className="space-y-3">
              <div className="px-3 py-3 bg-white/[0.02] rounded-lg">
                <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-1">Top Scorer</div>
                {topScorers[0] ? (
                  <Link to={`/league/${leagueId}/players/${topScorers[0].id}`} className="text-sm text-[oklch(64.6%_0.222_41.116)] hover:brightness-125 transition-colors">
                    {topScorers[0].name} &mdash; {topScorers[0].value.toFixed(1)} PPG
                  </Link>
                ) : (
                  <div className="text-sm text-gray-500">No stats yet</div>
                )}
              </div>
              <div className="px-3 py-3 bg-white/[0.02] rounded-lg">
                <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-1">Top Rebounder</div>
                {topRebounders[0] ? (
                  <Link to={`/league/${leagueId}/players/${topRebounders[0].id}`} className="text-sm text-[oklch(64.6%_0.222_41.116)] hover:brightness-125 transition-colors">
                    {topRebounders[0].name} &mdash; {topRebounders[0].value.toFixed(1)} RPG
                  </Link>
                ) : (
                  <div className="text-sm text-gray-500">No stats yet</div>
                )}
              </div>
              <div className="px-3 py-3 bg-white/[0.02] rounded-lg">
                <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-1">Top Assist Leader</div>
                {topAssisters[0] ? (
                  <Link to={`/league/${leagueId}/players/${topAssisters[0].id}`} className="text-sm text-[oklch(64.6%_0.222_41.116)] hover:brightness-125 transition-colors">
                    {topAssisters[0].name} &mdash; {topAssisters[0].value.toFixed(1)} APG
                  </Link>
                ) : (
                  <div className="text-sm text-gray-500">No stats yet</div>
                )}
              </div>
              <div className="px-3 py-3 bg-white/[0.02] rounded-lg">
                <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-1">Total Players</div>
                <div className="text-sm text-white">{totalPlayers} across {teams.length} teams</div>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Season History */}
        <h2 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">Season History</h2>
        {history.length === 0 ? (
          <GlassCard className="p-6 mb-8">
            <p className="text-gray-500 text-sm text-center">
              No completed seasons yet &mdash; history will be recorded as seasons finish.
            </p>
          </GlassCard>
        ) : (
          <div className="space-y-3 mb-8">
            {[...history].reverse().map(s => (
              <GlassCard key={s.year} className="p-5">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-white">Season {s.year}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Champion: <span className="text-[oklch(64.6%_0.222_41.116)]">{teamMap.get(s.championTeamId) ?? 'Unknown'}</span>
                      {s.finalistTeamId && (
                        <> &bull; defeated {teamMap.get(s.finalistTeamId) ?? 'Unknown'}
                          {s.finalsResult && <span className="text-gray-400"> ({s.finalsResult})</span>}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-400">
                    <div>
                      <span className="text-gray-600">MVP</span>{' '}
                      <span className="text-white">{playerNameMap.get(s.mvpPlayerId) ?? 'Unknown'}</span>
                    </div>
                    {s.playoffMvpId && (
                      <div>
                        <span className="text-gray-600">Finals MVP</span>{' '}
                        <span className="text-[oklch(64.6%_0.222_41.116)]">{playerNameMap.get(s.playoffMvpId) ?? 'Unknown'}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-600">Scoring</span>{' '}
                      <span className="text-white">{playerNameMap.get(s.topScorerPlayerId) ?? 'Unknown'}</span>
                      <span className="text-gray-600 ml-1">{s.topScorerPPG.toFixed(1)}</span>
                    </div>
                    {s.rotyPlayerId && (
                      <div>
                        <span className="text-gray-600">ROTY</span>{' '}
                        <span className="text-white">{playerNameMap.get(s.rotyPlayerId) ?? 'Unknown'}</span>
                      </div>
                    )}
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        )}

        {/* All-Time Leaders (current season data) */}
        <h2 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">Statistical Leaders</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <LeaderCard title="Points Per Game" rows={topScorers} suffix="PPG" leagueId={leagueId} />
          <LeaderCard title="Rebounds Per Game" rows={topRebounders} suffix="RPG" leagueId={leagueId} />
          <LeaderCard title="Assists Per Game" rows={topAssisters} suffix="APG" leagueId={leagueId} />
        </div>

        {/* Records Book */}
        {gameRecords && (gameRecords.points.length > 0 || titleCounts.length > 0) && (
          <>
            <h2 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">Records Book</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
              {([
                ['Most Points, Game', gameRecords.points, 'PTS'],
                ['Most Rebounds, Game', gameRecords.rebounds, 'REB'],
                ['Most Assists, Game', gameRecords.assists, 'AST'],
              ] as const).map(([title, records, suffix]) => (
                <GlassCard key={title} className="p-5">
                  <h3 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">{title}</h3>
                  <div className="space-y-1.5">
                    {records.map((rec, i) => (
                      <div key={`${rec.playerId}-${rec.date}-${i}`} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 min-w-0">
                          <span className={`text-xs w-4 text-center ${i === 0 ? 'text-accent font-semibold' : 'text-gray-600'}`}>{i + 1}</span>
                          <span className={`truncate ${i === 0 ? 'text-white font-medium' : 'text-gray-300'}`}>{rec.playerName}</span>
                        </span>
                        <span className="shrink-0 flex items-baseline gap-1.5 ml-2">
                          <span className={i === 0 ? 'text-accent font-semibold' : 'text-gray-300'}>{rec.value}</span>
                          <span className="text-[9px] text-gray-600">{suffix} vs {rec.opponent}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </GlassCard>
              ))}
              <GlassCard className="p-5">
                <h3 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">Championships</h3>
                <div className="space-y-1.5">
                  {titleCounts.length === 0 ? (
                    <p className="text-gray-600 text-sm italic">No champions crowned yet</p>
                  ) : (
                    titleCounts.slice(0, 5).map(([teamId, count], i) => (
                      <div key={teamId} className="flex items-center justify-between text-sm">
                        <span className={`truncate ${i === 0 ? 'text-white font-medium' : 'text-gray-300'}`}>
                          {teamMap.get(teamId) ?? 'Unknown'}
                        </span>
                        <span className={`shrink-0 ml-2 ${i === 0 ? 'text-yellow-400 font-semibold' : 'text-gray-400'}`}>
                          {count} {count === 1 ? 'title' : 'titles'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </GlassCard>
            </div>
          </>
        )}

        {/* Hall of Fame */}
        {hallOfFame.length > 0 && (
          <>
            <h2 className="text-[10px] uppercase tracking-[2px] text-yellow-500 mb-3">Hall of Fame</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              {hallOfFame.map(entry => (
                <GlassCard key={entry.playerId} className="p-5 border-yellow-500/15 bg-gradient-to-br from-yellow-500/[0.04] to-transparent">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-display text-lg text-white">{entry.playerName}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        Class of {entry.inductionYear} &middot; {entry.careerStats.seasons} seasons
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-yellow-400">{entry.careerStats.ppg}</div>
                      <div className="text-[9px] uppercase tracking-[2px] text-gray-600">Career PPG</div>
                    </div>
                  </div>
                  <div className="flex gap-4 mt-3 text-xs text-gray-400">
                    <span>{entry.careerStats.points.toLocaleString()} PTS</span>
                    <span>{entry.careerStats.rebounds.toLocaleString()} REB</span>
                    <span>{entry.careerStats.assists.toLocaleString()} AST</span>
                  </div>
                  {entry.accolades.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {entry.accolades.slice(0, 8).map((a, i) => (
                        <span key={i} className="px-1.5 py-0.5 rounded text-[9px] bg-yellow-500/10 text-yellow-400/90 border border-yellow-500/20">
                          {a}
                        </span>
                      ))}
                      {entry.accolades.length > 8 && (
                        <span className="text-[9px] text-gray-600 self-center">+{entry.accolades.length - 8} more</span>
                      )}
                    </div>
                  )}
                </GlassCard>
              ))}
            </div>
          </>
        )}

        {/* Recent Retirements */}
        {retirees.length > 0 && (
          <>
            <h2 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">Recent Retirements</h2>
            <GlassCard className="p-5">
              <div className="space-y-1">
                {retirees.slice(0, 15).map(r => (
                  <div key={r.playerId} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                      <span className="text-white text-sm">{r.playerName}</span>
                      <span className="text-gray-600 text-xs">retired {r.retirementYear}</span>
                      {hallOfFame.some(h => h.playerId === r.playerId) && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider bg-yellow-500/15 text-yellow-400 border border-yellow-500/30">HOF</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">
                      {r.careerStats.seasons} seasons &middot; {r.careerStats.ppg} PPG &middot; {r.careerStats.points.toLocaleString()} PTS
                    </span>
                  </div>
                ))}
              </div>
            </GlassCard>
          </>
        )}
      </div>
    </PageTransition>
  )
}

function LeaderCard({
  title,
  rows,
  suffix,
  leagueId,
}: {
  title: string
  rows: PlayerStatRow[]
  suffix: string
  leagueId: string | undefined
}) {
  return (
    <GlassCard className="p-5">
      <h3 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-gray-500 text-sm">No stats yet</p>
      ) : (
        <div className="space-y-1">
          {rows.map((row, i) => (
            <div key={row.id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <span className={`w-5 text-center text-xs ${i === 0 ? 'text-[oklch(64.6%_0.222_41.116)] font-semibold' : 'text-gray-500'}`}>
                  {i + 1}
                </span>
                <div>
                  <Link
                    to={`/league/${leagueId}/players/${row.id}`}
                    className={`text-sm hover:text-[oklch(64.6%_0.222_41.116)] transition-colors ${i === 0 ? 'text-white font-medium' : 'text-gray-300'}`}
                  >
                    {row.name}
                  </Link>
                  <div className="text-[10px] text-gray-600">{row.team}</div>
                </div>
              </div>
              <span className={`text-xs ${i === 0 ? 'text-[oklch(64.6%_0.222_41.116)] font-semibold' : 'text-gray-400'}`}>
                {row.value.toFixed(1)} {suffix}
              </span>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  )
}
