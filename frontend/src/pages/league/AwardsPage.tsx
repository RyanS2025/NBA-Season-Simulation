import { useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import PageTransition from '../../components/layout/PageTransition'
import GlassCard from '../../components/common/GlassCard'
import { useLeague } from '../../hooks/useLeague'
import type { Player } from '../../types'

type AwardsTab = 'races' | 'allstar' | 'all-league'

function latestStats(player: Player) {
  const stats = player.careerStats
  if (!stats || stats.length === 0) return null
  return stats[stats.length - 1]
}

function playerName(p: Player): string {
  return `${p.bio.firstName} ${p.bio.lastName}`
}

interface RaceCandidate {
  player: Player
  teamName: string
  statLine: string
  score: number
}

export default function AwardsPage() {
  const { id: leagueId } = useParams()
  const { players, teams, state, loading } = useLeague()
  const [activeTab, setActiveTab] = useState<AwardsTab>('races')

  const teamMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const t of teams) map.set(t.id, `${t.info.city} ${t.info.name}`)
    return map
  }, [teams])

  const teamRecordMap = useMemo(() => {
    const map = new Map<string, { wins: number; losses: number }>()
    for (const t of teams) map.set(t.id, { wins: t.seasonRecord.wins, losses: t.seasonRecord.losses })
    return map
  }, [teams])

  const mvpRace: RaceCandidate[] = useMemo(() => {
    return players
      .map(p => {
        const s = latestStats(p)
        if (!s) return null
        const teamRec = teamRecordMap.get(p.teamId)
        const winPct = teamRec ? teamRec.wins / Math.max(1, teamRec.wins + teamRec.losses) : 0
        const score = s.ppg * 1.5 + s.rpg * 0.8 + s.apg * 1.2 + p.ratings.overall * 0.3 + winPct * 30
        return {
          player: p,
          teamName: teamMap.get(p.teamId) ?? p.teamId,
          statLine: `${s.ppg.toFixed(1)} PPG / ${s.rpg.toFixed(1)} RPG / ${s.apg.toFixed(1)} APG`,
          score,
        }
      })
      .filter(Boolean)
      .sort((a, b) => b!.score - a!.score)
      .slice(0, 10) as RaceCandidate[]
  }, [players, teamMap, teamRecordMap])

  const dpoyRace: RaceCandidate[] = useMemo(() => {
    return players
      .map(p => {
        const s = latestStats(p)
        if (!s) return null
        const defScore = p.ratings.perimeterDefense + p.ratings.interiorDefense + p.ratings.shotBlocking + p.ratings.stealing + p.ratings.defensiveIq
        const score = defScore + (s.bpg ?? 0) * 15 + (s.spg ?? 0) * 12
        return {
          player: p,
          teamName: teamMap.get(p.teamId) ?? p.teamId,
          statLine: `${(s.bpg ?? 0).toFixed(1)} BPG / ${(s.spg ?? 0).toFixed(1)} SPG`,
          score,
        }
      })
      .filter(Boolean)
      .sort((a, b) => b!.score - a!.score)
      .slice(0, 5) as RaceCandidate[]
  }, [players, teamMap])

  const royRace: RaceCandidate[] = useMemo(() => {
    return players
      .filter(p => p.status.isRookie || p.bio.yearsInLeague <= 1)
      .map(p => {
        const s = latestStats(p)
        if (!s) return null
        const score = s.ppg * 1.5 + s.rpg + s.apg * 1.2
        return {
          player: p,
          teamName: teamMap.get(p.teamId) ?? p.teamId,
          statLine: `${s.ppg.toFixed(1)} PPG / ${s.rpg.toFixed(1)} RPG / ${s.apg.toFixed(1)} APG`,
          score,
        }
      })
      .filter(Boolean)
      .sort((a, b) => b!.score - a!.score)
      .slice(0, 5) as RaceCandidate[]
  }, [players, teamMap])

  const scoringLeaders: RaceCandidate[] = useMemo(() => {
    return players
      .map(p => {
        const s = latestStats(p)
        if (!s) return null
        return {
          player: p,
          teamName: teamMap.get(p.teamId) ?? p.teamId,
          statLine: `${s.ppg.toFixed(1)} PPG on ${(s.fg_pct * 100).toFixed(1)}% FG`,
          score: s.ppg,
        }
      })
      .filter(Boolean)
      .sort((a, b) => b!.score - a!.score)
      .slice(0, 10) as RaceCandidate[]
  }, [players, teamMap])

  const allStarCandidates = useMemo(() => {
    const east = players
      .filter(p => {
        const team = teams.find(t => t.id === p.teamId)
        return team?.info.conference === 'Eastern'
      })
      .sort((a, b) => {
        const sa = latestStats(a), sb = latestStats(b)
        const scoreA = (sa?.ppg ?? 0) * 1.2 + a.ratings.overall * 0.5 + (a.character.fanFavorite ?? 50) * 0.1
        const scoreB = (sb?.ppg ?? 0) * 1.2 + b.ratings.overall * 0.5 + (b.character.fanFavorite ?? 50) * 0.1
        return scoreB - scoreA
      })
      .slice(0, 12)

    const west = players
      .filter(p => {
        const team = teams.find(t => t.id === p.teamId)
        return team?.info.conference === 'Western'
      })
      .sort((a, b) => {
        const sa = latestStats(a), sb = latestStats(b)
        const scoreA = (sa?.ppg ?? 0) * 1.2 + a.ratings.overall * 0.5 + (a.character.fanFavorite ?? 50) * 0.1
        const scoreB = (sb?.ppg ?? 0) * 1.2 + b.ratings.overall * 0.5 + (b.character.fanFavorite ?? 50) * 0.1
        return scoreB - scoreA
      })
      .slice(0, 12)

    return { east, west }
  }, [players, teams])

  if (loading || !state) {
    return (
      <PageTransition>
        <div className="text-gray-400 text-center py-20">Loading awards...</div>
      </PageTransition>
    )
  }

  const tabs: { id: AwardsTab; label: string }[] = [
    { id: 'races', label: 'Award Races' },
    { id: 'allstar', label: 'All-Star Voting' },
    { id: 'all-league', label: 'Stat Leaders' },
  ]

  function RaceCard({ title, candidates }: { title: string; candidates: RaceCandidate[] }) {
    return (
      <GlassCard className="p-5">
        <h3 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-4">{title}</h3>
        <div className="space-y-2">
          {candidates.length === 0 ? (
            <p className="text-gray-600 text-sm italic">No candidates yet — sim more games</p>
          ) : (
            candidates.map((c, i) => {
              const isUserTeam = c.player.teamId === state.userTeamId
              return (
                <div
                  key={c.player.id}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg ${
                    i === 0 ? 'bg-[oklch(64.6%_0.222_41.116)]/8 border border-[oklch(64.6%_0.222_41.116)]/20' :
                    isUserTeam ? 'bg-accent/5' : 'hover:bg-white/[0.02]'
                  }`}
                >
                  <span className={`text-xs w-5 text-center font-medium ${i === 0 ? 'text-[oklch(64.6%_0.222_41.116)]' : 'text-gray-600'}`}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/league/${leagueId}/players/${c.player.id}`}
                      className={`text-sm font-medium hover:text-[oklch(64.6%_0.222_41.116)] transition-colors ${
                        i === 0 ? 'text-white' : isUserTeam ? 'text-accent' : 'text-gray-200'
                      }`}
                    >
                      {playerName(c.player)}
                    </Link>
                    <span className="text-gray-500 text-xs ml-2">{c.teamName}</span>
                  </div>
                  <span className="text-gray-400 text-xs shrink-0">{c.statLine}</span>
                </div>
              )
            })
          )}
        </div>
      </GlassCard>
    )
  }

  function AllStarList({ title, conference, candidates }: { title: string; conference: string; candidates: Player[] }) {
    return (
      <GlassCard className="p-5">
        <h3 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-4">{title}</h3>
        <div className="space-y-1">
          {candidates.map((p, i) => {
            const s = latestStats(p)
            const isUserTeam = p.teamId === state.userTeamId
            return (
              <div key={p.id}>
                <div className={`flex items-center justify-between px-3 py-2 rounded-lg ${
                  isUserTeam ? 'bg-accent/5' : 'hover:bg-white/[0.02]'
                }`}>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-500 w-5 text-center text-xs">{i + 1}</span>
                    <Link
                      to={`/league/${leagueId}/players/${p.id}`}
                      className={`text-sm font-medium hover:text-[oklch(64.6%_0.222_41.116)] transition-colors ${
                        isUserTeam ? 'text-accent' : 'text-white'
                      }`}
                    >
                      {playerName(p)}
                    </Link>
                    <span className="text-gray-500 text-xs">{p.bio.position}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span>{s ? `${s.ppg.toFixed(1)}` : '—'} ppg</span>
                    <span className="text-gray-600">{p.ratings.overall} OVR</span>
                    {i < 5 && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider bg-[oklch(64.6%_0.222_41.116)]/15 text-[oklch(64.6%_0.222_41.116)] border border-[oklch(64.6%_0.222_41.116)]/30">
                        Starter
                      </span>
                    )}
                  </div>
                </div>
                {i === 4 && <div className="border-t border-dashed border-white/[0.08] my-2" />}
              </div>
            )
          })}
        </div>
      </GlassCard>
    )
  }

  return (
    <PageTransition>
      <div>
        <h1 className="font-display text-4xl tracking-wide text-white mb-6">Awards & All-Star</h1>

        <div className="flex gap-1 mb-6">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-[oklch(64.6%_0.222_41.116)] bg-[oklch(64.6%_0.222_41.116)]/10'
                  : 'text-gray-500 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'races' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RaceCard title="MVP Race" candidates={mvpRace} />
            <RaceCard title="Defensive Player of the Year" candidates={dpoyRace} />
            <RaceCard title="Rookie of the Year" candidates={royRace} />
          </div>
        )}

        {activeTab === 'allstar' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AllStarList title="Eastern Conference" conference="Eastern" candidates={allStarCandidates.east} />
            <AllStarList title="Western Conference" conference="Western" candidates={allStarCandidates.west} />
          </div>
        )}

        {activeTab === 'all-league' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RaceCard title="Scoring Leaders" candidates={scoringLeaders} />
          </div>
        )}
      </div>
    </PageTransition>
  )
}
