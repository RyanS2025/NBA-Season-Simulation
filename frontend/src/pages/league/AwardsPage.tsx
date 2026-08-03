import { useState, useMemo, useRef, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import PageTransition from '../../components/layout/PageTransition'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import GlassCard from '../../components/common/GlassCard'
import { useLeague } from '../../hooks/useLeague'
import { generateReporters } from '../../utils/awards/reporter-generator'
import { updateNarratives } from '../../utils/awards/narrative-engine'
import { computeAllAwards, scoreMVPCandidate, scoreDPOYCandidate, scoreROYCandidate, scoreSixthManCandidate, scoreMIPCandidate, scoreClutchPOYCandidate } from '../../utils/awards/awards-engine'
import type { Player, Team } from '../../types'
import type { AwardType, AwardResult, Reporter, AwardBallot, SeasonAwards } from '../../types'
import type { AwardRecord, RetiredPlayer } from '../../db/league-db'

type AwardsTab = 'ceremony' | 'races' | 'reporters' | 'archive'

const OFFSEASON_PHASES = new Set(['playoffs', 'champion', 'draft', 'draft_lottery', 'free_agency', 'coaching_carousel', 'offseason'])

function pName(p: Player): string {
  return `${p.bio.firstName} ${p.bio.lastName}`
}

function teamName(t: Team): string {
  return `${t.info.city} ${t.info.name}`
}

function seasonStats(p: Player, season: number | undefined) {
  if (season == null) return null
  return p.careerStats?.find(s => s.season === String(season)) ?? null
}

const AWARD_LABELS: Record<string, string> = {
  mvp: 'Most Valuable Player',
  dpoy: 'Defensive Player of the Year',
  roy: 'Rookie of the Year',
  sixth_man: 'Sixth Man of the Year',
  mip: 'Most Improved Player',
  clutch_poy: 'Clutch Player of the Year',
  coty: 'Coach of the Year',
  eoty: 'Executive of the Year',
}

const CEREMONY_ORDER = ['roy', 'sixth_man', 'mip', 'clutch_poy', 'coty', 'eoty', 'dpoy', 'mvp']

const RACE_AWARDS: AwardType[] = ['mvp', 'dpoy', 'roy', 'sixth_man', 'mip', 'clutch_poy']

type ScorerFn = (p: Player, t: Team, season: string) => number
const SCORER_MAP: Record<string, ScorerFn> = {
  mvp: scoreMVPCandidate,
  dpoy: scoreDPOYCandidate,
  roy: scoreROYCandidate,
  sixth_man: scoreSixthManCandidate,
  mip: scoreMIPCandidate,
  clutch_poy: scoreClutchPOYCandidate,
}

function Headshot({ player, size = 72 }: { player: Player | null; size?: number }) {
  const [failed, setFailed] = useState(false)
  const initials = player ? `${player.bio.firstName[0] ?? ''}${player.bio.lastName[0] ?? ''}` : '—'

  if (!player || !player.headshotUrl || failed) {
    return (
      <div
        className="rounded-full bg-gradient-to-br from-white/[0.1] to-white/[0.02] border border-white/[0.1] flex items-center justify-center font-display text-white/70"
        style={{ width: size, height: size, fontSize: size * 0.32 }}
      >
        {initials}
      </div>
    )
  }
  return (
    <img
      src={player.headshotUrl}
      alt={pName(player)}
      onError={() => setFailed(true)}
      className="rounded-full object-cover border border-white/[0.1] bg-white/[0.04]"
      style={{ width: size, height: size }}
    />
  )
}

export default function AwardsPage() {
  const { id: leagueId } = useParams()
  const { db, players, teams, state, loading } = useLeague()

  const seasonOver = !!state && OFFSEASON_PHASES.has(state.currentPhase)

  const [activeTab, setActiveTab] = useState<AwardsTab | null>(null)
  const [expandedAward, setExpandedAward] = useState<string | null>(null)
  const [ballotFilter, setBallotFilter] = useState<string>('all')
  const [showBallots, setShowBallots] = useState(false)
  const carouselRef = useRef<HTMLDivElement>(null)

  const tab: AwardsTab = activeTab ?? (seasonOver ? 'ceremony' : 'races')

  const playerMap = useMemo(() => new Map(players.map(p => [p.id, p])), [players])
  const teamMap = useMemo(() => new Map(teams.map(t => [t.id, t])), [teams])

  const [archives, setArchives] = useState<AwardRecord[]>([])
  const [archiveYear, setArchiveYear] = useState<number | null>(null)
  const [retiredNames, setRetiredNames] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    if (!db) return
    let cancelled = false
    Promise.all([db.awards.toArray(), db.retiredPlayers.toArray()]).then(([recs, retired]: [AwardRecord[], RetiredPlayer[]]) => {
      if (cancelled) return
      const sorted = recs.sort((a, b) => b.seasonYear - a.seasonYear)
      setArchives(sorted)
      if (sorted.length > 0) setArchiveYear(y => y ?? sorted[0].seasonYear)
      setRetiredNames(new Map(retired.map(r => [r.playerId, r.playerName])))
    })
    return () => { cancelled = true }
  }, [db, state?.currentSeason])

  const reporters = useMemo(() => {
    if (!leagueId || !state || teams.length === 0) return []
    return generateReporters(leagueId, state.currentSeason, teams)
  }, [leagueId, state, teams])

  const narratives = useMemo(() => {
    if (players.length === 0 || teams.length === 0) return []
    const totalGames = teams[0] ? teams[0].seasonRecord.wins + teams[0].seasonRecord.losses : 0
    const week = Math.floor(totalGames / 3.5)
    return updateNarratives(players, teams, [], week, state?.currentSeason ?? 2027)
  }, [players, teams, state])

  const results = useMemo(() => {
    if (players.length === 0 || reporters.length === 0 || !state) return null
    return computeAllAwards(players, teams, reporters, narratives, state?.currentSeason ?? 0)
  }, [players, teams, reporters, narratives, state])

  const raceData = useMemo(() => {
    const data: Record<string, Array<{ player: Player; team: Team; score: number; statLine: string }>> = {}
    for (const awardType of RACE_AWARDS) {
      const scorer = SCORER_MAP[awardType]
      if (!scorer) continue
      const candidates: Array<{ player: Player; team: Team; score: number; statLine: string }> = []
      for (const p of players) {
        const team = teamMap.get(p.teamId)
        if (!team) continue
        const score = scorer(p, team, String(state?.currentSeason ?? ''))
        if (score <= 0) continue
        const s = seasonStats(p, state?.currentSeason)
        let statLine = ''
        if (s) {
          if (awardType === 'dpoy') statLine = `${s.bpg.toFixed(1)} BPG / ${s.spg.toFixed(1)} SPG`
          else statLine = `${s.ppg.toFixed(1)} PPG / ${s.rpg.toFixed(1)} RPG / ${s.apg.toFixed(1)} APG`
        }
        candidates.push({ player: p, team, score, statLine })
      }
      candidates.sort((a, b) => b.score - a.score)
      data[awardType] = candidates.slice(0, 10)
    }
    return data
  }, [players, teamMap, state])

  if (loading || !state) {
    return (
      <PageTransition>
        <LoadingSpinner message="Loading awards..." />
      </PageTransition>
    )
  }

  const tabs: { id: AwardsTab; label: string }[] = seasonOver
    ? [
        { id: 'ceremony', label: 'Awards Ceremony' },
        { id: 'races', label: 'Final Standings' },
        { id: 'archive', label: 'Archive' },
        { id: 'reporters', label: 'Reporters' },
      ]
    : [
        { id: 'races', label: 'Award Races' },
        { id: 'archive', label: 'Archive' },
        { id: 'reporters', label: 'Reporters' },
      ]

  function winnerDisplay(awardType: string, result: AwardResult): {
    player: Player | null
    title: string
    subtitle: string
    statLine: string
  } {
    const isTeamAward = awardType === 'coty' || awardType === 'eoty'
    if (isTeamAward) {
      const team = teamMap.get(result.winnerId)
      const staffName = awardType === 'coty'
        ? team?.staff?.headCoach?.name
        : team?.staff?.generalManager?.name
      return {
        player: null,
        title: staffName ?? (team ? teamName(team) : 'Unknown'),
        subtitle: team ? teamName(team) : '',
        statLine: team ? `${team.seasonRecord.wins}-${team.seasonRecord.losses} record` : '',
      }
    }
    const player = playerMap.get(result.winnerId) ?? null
    const team = player ? teamMap.get(player.teamId) : undefined
    const s = player ? seasonStats(player, state?.currentSeason) : null
    const statLine = s
      ? awardType === 'dpoy'
        ? `${s.bpg.toFixed(1)} BPG · ${s.spg.toFixed(1)} SPG · ${s.rpg.toFixed(1)} RPG`
        : `${s.ppg.toFixed(1)} PPG · ${s.rpg.toFixed(1)} RPG · ${s.apg.toFixed(1)} APG`
      : ''
    return {
      player,
      title: player ? pName(player) : 'Unknown',
      subtitle: team ? teamName(team) : '',
      statLine,
    }
  }

  function scrollCarousel(dir: -1 | 1) {
    carouselRef.current?.scrollBy({ left: dir * 300, behavior: 'smooth' })
  }

  function CeremonyCard({ awardType, result }: { awardType: string; result: AwardResult }) {
    const info = winnerDisplay(awardType, result)
    const firstPlace = result.firstPlaceVotes[result.winnerId] ?? 0
    const isExpanded = expandedAward === awardType
    const isMvp = awardType === 'mvp'

    return (
      <button
        onClick={() => { setExpandedAward(isExpanded ? null : awardType); setShowBallots(false); setBallotFilter('all') }}
        className={`snap-start shrink-0 w-[260px] text-left rounded-2xl border p-5 transition-all duration-200 ${
          isExpanded
            ? 'border-accent/50 bg-accent/[0.08] shadow-[0_0_30px_rgba(255,100,30,0.15)]'
            : isMvp
              ? 'border-yellow-500/25 bg-gradient-to-b from-yellow-500/[0.06] to-transparent hover:border-yellow-500/40'
              : 'border-white/[0.08] bg-white/[0.03] hover:border-white/[0.16] hover:bg-white/[0.05]'
        }`}
      >
        <div className={`text-[9px] uppercase tracking-[2px] mb-4 ${isMvp ? 'text-yellow-400' : 'text-accent'}`}>
          {AWARD_LABELS[awardType]}
        </div>
        <div className="flex flex-col items-center text-center">
          <Headshot player={info.player} size={84} />
          <div className="mt-3 text-lg font-display text-white leading-tight">{info.title}</div>
          <div className="text-xs text-gray-500 mt-0.5">{info.subtitle}</div>
          {info.statLine && (
            <div className="text-[11px] text-gray-400 mt-2 font-medium">{info.statLine}</div>
          )}
          <div className="flex items-center gap-2 mt-3">
            {result.wasUnanimous ? (
              <span className="px-2 py-0.5 rounded text-[9px] uppercase tracking-wider bg-yellow-500/15 text-yellow-400 border border-yellow-500/30">
                Unanimous
              </span>
            ) : (
              <span className="text-[10px] text-gray-500">{firstPlace}/{reporters.length} first-place votes</span>
            )}
          </div>
          <div className={`mt-3 text-[10px] uppercase tracking-wider ${isExpanded ? 'text-accent' : 'text-gray-600'}`}>
            {isExpanded ? 'Showing votes ▾' : 'Click for voting ▸'}
          </div>
        </div>
      </button>
    )
  }

  function VotingTable({ awardType, result }: { awardType: string; result: AwardResult }) {
    const sorted = Object.entries(result.voteTotals).sort((a, b) => b[1] - a[1])
    const maxPoints = sorted[0]?.[1] ?? 1
    const isTeamAward = awardType === 'coty' || awardType === 'eoty'

    const filteredBallots = result.ballots.filter(b => {
      if (ballotFilter === 'all') return true
      if (ballotFilter === 'homer') return b.picks.some(p => p.isHomerPick)
      return b.reporterType === ballotFilter
    })

    return (
      <GlassCard className="p-6 mt-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="font-display text-xl text-white">
            {AWARD_LABELS[awardType]} <span className="text-gray-600 text-sm ml-1">Media Voting</span>
          </h3>
          <div className="text-xs text-gray-500">
            {reporters.length} voters · 10-7-5-3-1 point ballots · won by {result.marginOfVictory} pts
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.08] text-[10px] uppercase tracking-[1.5px] text-gray-600">
                <th className="text-left py-2 pr-3 font-medium w-8">#</th>
                <th className="text-left py-2 pr-3 font-medium">{isTeamAward ? 'Winner' : 'Player'}</th>
                <th className="text-left py-2 pr-3 font-medium hidden md:table-cell">Team</th>
                <th className="text-center py-2 px-3 font-medium">1st</th>
                <th className="text-center py-2 px-3 font-medium">Points</th>
                <th className="text-left py-2 pl-3 font-medium w-[30%]">Share</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(([id, points], i) => {
                const p = playerMap.get(id)
                const t = p ? teamMap.get(p.teamId) : teamMap.get(id)
                const isWinner = id === result.winnerId
                let name: string
                if (isTeamAward) {
                  const team = teamMap.get(id)
                  name = (awardType === 'coty' ? team?.staff?.headCoach?.name : team?.staff?.generalManager?.name)
                    ?? (team ? teamName(team) : id)
                } else {
                  name = p ? pName(p) : id
                }
                return (
                  <tr key={id} className={`border-b border-white/[0.04] ${isWinner ? 'bg-accent/[0.06]' : ''}`}>
                    <td className={`py-2.5 pr-3 text-xs ${isWinner ? 'text-accent font-semibold' : 'text-gray-600'}`}>{i + 1}</td>
                    <td className={`py-2.5 pr-3 ${isWinner ? 'text-white font-medium' : 'text-gray-300'}`}>
                      <span className="flex items-center gap-2">
                        {!isTeamAward && <Headshot player={p ?? null} size={26} />}
                        {name}
                        {isWinner && <span className="text-[9px] uppercase tracking-wider text-accent">Winner</span>}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-gray-500 hidden md:table-cell">{t ? teamName(t) : ''}</td>
                    <td className="py-2.5 px-3 text-center text-gray-400">{result.firstPlaceVotes[id] ?? 0}</td>
                    <td className={`py-2.5 px-3 text-center font-medium ${isWinner ? 'text-white' : 'text-gray-400'}`}>{points}</td>
                    <td className="py-2.5 pl-3">
                      <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${isWinner ? 'bg-accent' : 'bg-gray-600'}`}
                          style={{ width: `${(points / maxPoints) * 100}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {result.controversialVotes.length > 0 && (
          <div className="mt-4 p-3 rounded-lg bg-amber-500/[0.05] border border-amber-500/15">
            <div className="text-[10px] uppercase tracking-[2px] text-amber-400 mb-2">Controversial Votes</div>
            <div className="space-y-1">
              {result.controversialVotes.slice(0, 6).map((cv, i) => (
                <div key={i} className="text-xs text-gray-400">
                  <span className="text-amber-300">{cv.reporterName}</span> ({cv.outlet}) — {cv.reason}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4">
          <button
            onClick={() => setShowBallots(!showBallots)}
            className="text-xs text-gray-500 hover:text-white transition-colors"
          >
            {showBallots ? '▾ Hide individual ballots' : `▸ Show all ${result.ballots.length} individual ballots`}
          </button>

          {showBallots && (
            <div className="mt-3">
              <div className="flex gap-1 flex-wrap mb-3">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'homer', label: 'Homer Picks' },
                  { id: 'beat_writer', label: 'Beat Writers' },
                  { id: 'national_writer', label: 'National' },
                  { id: 'analytics_writer', label: 'Analytics' },
                  { id: 'tv_analyst', label: 'TV' },
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setBallotFilter(f.id)}
                    className={`px-2.5 py-1 rounded text-[10px] font-medium transition-colors ${
                      ballotFilter === f.id ? 'text-white bg-white/[0.08]' : 'text-gray-600 hover:text-gray-400'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {filteredBallots.slice(0, 30).map(ballot => (
                  <BallotCard key={ballot.reporterId} ballot={ballot} />
                ))}
              </div>
              {filteredBallots.length > 30 && (
                <p className="text-gray-600 text-xs text-center mt-3">Showing 30 of {filteredBallots.length} ballots</p>
              )}
            </div>
          )}
        </div>
      </GlassCard>
    )
  }

  function RaceCard({ awardType }: { awardType: string }) {
    const candidates = raceData[awardType] ?? []
    const result = results?.[awardType]

    return (
      <GlassCard className="p-5">
        <h3 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-4">
          {AWARD_LABELS[awardType] ?? awardType}
        </h3>
        <div className="space-y-1.5">
          {candidates.length === 0 ? (
            <p className="text-gray-600 text-sm italic">No candidates yet — sim more games</p>
          ) : (
            candidates.map((c, i) => {
              const isWinner = result?.winnerId === c.player.id
              const votePoints = result?.voteTotals[c.player.id] ?? 0
              const firstPlace = result?.firstPlaceVotes[c.player.id] ?? 0
              const isUserTeam = c.player.teamId === state?.userTeamId
              return (
                <div
                  key={c.player.id}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    isWinner ? 'bg-accent/[0.08] border border-accent/20' :
                    isUserTeam ? 'bg-white/[0.03]' : 'hover:bg-white/[0.02]'
                  }`}
                >
                  <span className={`text-xs w-5 text-center font-medium ${isWinner ? 'text-accent' : 'text-gray-600'}`}>
                    {i + 1}
                  </span>
                  <Headshot player={c.player} size={28} />
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm font-medium ${
                      isWinner ? 'text-white' : isUserTeam ? 'text-accent' : 'text-gray-200'
                    }`}>
                      {pName(c.player)}
                    </span>
                    <span className="text-gray-500 text-xs ml-2">{teamName(c.team)}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-gray-400 text-xs hidden sm:block">{c.statLine}</span>
                    {result && votePoints > 0 && (
                      <span className="text-[10px] text-gray-500">
                        {votePoints} pts{firstPlace > 0 ? ` (${firstPlace} 1st)` : ''}
                      </span>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </GlassCard>
    )
  }

  function BallotCard({ ballot }: { ballot: AwardBallot }) {
    const isBeatWriter = ballot.reporterType === 'beat_writer'
    const beatTeam = ballot.beatTeamId ? teamMap.get(ballot.beatTeamId) : null

    return (
      <GlassCard className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-sm text-white font-medium">{ballot.reporterName}</span>
            <span className="text-xs text-gray-500 ml-2">{ballot.reporterOutlet}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider border ${
              isBeatWriter
                ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                : ballot.reporterType === 'analytics_writer'
                ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                : ballot.reporterType === 'tv_analyst'
                ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                : 'bg-gray-500/15 text-gray-400 border-gray-500/30'
            }`}>
              {ballot.reporterType.replace('_', ' ')}
            </span>
            {beatTeam && (
              <span className="text-[10px] text-gray-600">{teamName(beatTeam)} beat</span>
            )}
          </div>
        </div>
        <div className="space-y-1">
          {ballot.picks.map(pick => {
            const p = playerMap.get(pick.candidateId)
            const t = p ? teamMap.get(p.teamId) : teamMap.get(pick.candidateId)
            return (
              <div
                key={pick.candidateId}
                className={`flex items-center justify-between px-2 py-1.5 rounded text-xs ${
                  pick.isHomerPick ? 'bg-amber-500/[0.08] border border-amber-500/15' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-4 text-center font-medium ${pick.rank === 1 ? 'text-accent' : 'text-gray-600'}`}>
                    {pick.rank}
                  </span>
                  <span className={pick.rank === 1 ? 'text-white' : 'text-gray-300'}>
                    {p ? pName(p) : t ? teamName(t) : pick.candidateId}
                  </span>
                  {pick.isHomerPick && (
                    <span className="text-[9px] text-amber-400">HOMER</span>
                  )}
                </div>
                <span className="text-gray-500">{pick.points} pts</span>
              </div>
            )
          })}
        </div>
      </GlassCard>
    )
  }

  function ReporterCard({ reporter }: { reporter: Reporter }) {
    const beatTeam = reporter.beatTeamId ? teamMap.get(reporter.beatTeamId) : null
    const p = reporter.personality

    const traits = [
      { label: 'Stats Focus', value: p.statsFocus },
      { label: 'Efficiency', value: p.efficiencyFocus },
      { label: 'Narrative', value: p.narrativeWeight },
      { label: 'Team Success', value: p.teamSuccessWeight },
    ]

    if (reporter.type === 'beat_writer') {
      traits.push({ label: 'Homer Bias', value: p.teamBias })
    }

    return (
      <GlassCard className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-sm text-white font-medium">
              {reporter.firstName} {reporter.lastName}
            </span>
            <span className="text-xs text-gray-500 ml-2">{reporter.outlet}</span>
          </div>
          <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider border ${
            reporter.type === 'beat_writer'
              ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
              : reporter.type === 'analytics_writer'
              ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
              : reporter.type === 'tv_analyst'
              ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
              : 'bg-gray-500/15 text-gray-400 border-gray-500/30'
          }`}>
            {reporter.type.replace('_', ' ')}
          </span>
        </div>

        {beatTeam && (
          <div className="text-[10px] text-amber-400/70 mb-2">Covers {teamName(beatTeam)}</div>
        )}

        <div className="text-[10px] text-gray-600 mb-2">{reporter.yearsExperience} years experience</div>

        <div className="space-y-1.5">
          {traits.map(trait => (
            <div key={trait.label} className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500 w-20 shrink-0">{trait.label}</span>
              <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${trait.label === 'Homer Bias' ? 'bg-amber-500' : 'bg-accent'}`}
                  style={{ width: `${trait.value * 100}%` }}
                />
              </div>
              <span className="text-[10px] text-gray-600 w-6 text-right">
                {(trait.value * 100).toFixed(0)}
              </span>
            </div>
          ))}
        </div>
      </GlassCard>
    )
  }


  function ArchiveSlate({ awards, year }: { awards: SeasonAwards; year: number }) {
    const resolve = (id: string | null | undefined): string => {
      if (!id) return '—'
      const p = playerMap.get(id)
      if (p) return pName(p)
      return retiredNames.get(id) ?? 'Unknown'
    }
    const resolveTeam = (id: string): string => {
      const t = teamMap.get(id)
      return t ? teamName(t) : '—'
    }

    const winners: [string, string][] = [
      ['Most Valuable Player', resolve(awards.mvp)],
      ['Defensive Player of the Year', resolve(awards.dpoy)],
      ['Rookie of the Year', resolve(awards.roty)],
      ['Sixth Man of the Year', resolve(awards.sixthMan)],
      ['Most Improved Player', resolve(awards.mip)],
      ['Clutch Player of the Year', resolve(awards.clutchPoy)],
      ['Finals MVP', resolve(awards.finalsMvp)],
      ['All-Star MVP', resolve(awards.allStarMvp)],
      ['Coach of the Year', resolveTeam(awards.coty)],
      ['Executive of the Year', resolveTeam(awards.eoty)],
    ]

    const teamLists: [string, string[]][] = [
      ['All-NBA First Team', awards.allNBA.first],
      ['All-NBA Second Team', awards.allNBA.second],
      ['All-NBA Third Team', awards.allNBA.third],
      ['All-Defensive First Team', awards.allDefensive.first],
      ['All-Defensive Second Team', awards.allDefensive.second],
      ['All-Rookie First Team', awards.allRookie.first],
      ['All-Rookie Second Team', awards.allRookie.second],
    ]

    return (
      <div>
        <h3 className="font-display text-xl text-white mb-4">{year} Award Winners</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
          {winners.map(([label, name]) => (
            <GlassCard key={label} className="p-4">
              <div className="text-[9px] uppercase tracking-[2px] text-gray-600 mb-1">{label}</div>
              <div className={name === '—' ? 'text-gray-600' : 'text-white font-medium'}>{name}</div>
            </GlassCard>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {teamLists.filter(([, ids]) => ids.length > 0).map(([label, ids]) => (
            <GlassCard key={label} className="p-4">
              <div className="text-[9px] uppercase tracking-[2px] text-accent mb-2">{label}</div>
              <div className="space-y-1">
                {ids.map(id => (
                  <div key={id} className="text-sm text-gray-300">{resolve(id)}</div>
                ))}
              </div>
            </GlassCard>
          ))}
        </div>
      </div>
    )
  }

  const ceremonyAwards = results
    ? CEREMONY_ORDER.filter(k => results[k]).map(k => [k, results[k]] as const)
    : []

  return (
    <PageTransition>
      <div>
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h1 className="font-display text-4xl tracking-wide text-white">Awards</h1>
          <div className="flex gap-1 flex-wrap">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
                  tab === t.id
                    ? 'text-accent bg-accent/10'
                    : 'text-gray-500 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {tab === 'ceremony' && results && (
          <div>
            <div className="mb-6">
              <div className="text-[9px] uppercase tracking-[2px] text-accent mb-1">Season {state.currentSeason}</div>
              <h2 className="font-display text-2xl tracking-wide text-white">Awards Ceremony</h2>
              <p className="text-gray-500 text-sm mt-1">The media has voted. Click any award to see the full ballot breakdown.</p>
            </div>

            <div className="relative">
              <button
                onClick={() => scrollCarousel(-1)}
                aria-label="Scroll awards left"
                className="absolute -left-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full backdrop-blur-md bg-slate-950/80 border border-white/[0.1] text-gray-300 hover:text-white hover:border-white/[0.25] transition-colors flex items-center justify-center"
              >
                ‹
              </button>
              <div
                ref={carouselRef}
                className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-3 px-1 scroll-smooth [scrollbar-width:thin]"
              >
                {ceremonyAwards.map(([key, result]) => (
                  <CeremonyCard key={key} awardType={key} result={result} />
                ))}
              </div>
              <button
                onClick={() => scrollCarousel(1)}
                aria-label="Scroll awards right"
                className="absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full backdrop-blur-md bg-slate-950/80 border border-white/[0.1] text-gray-300 hover:text-white hover:border-white/[0.25] transition-colors flex items-center justify-center"
              >
                ›
              </button>
            </div>

            {expandedAward && results[expandedAward] && (
              <VotingTable awardType={expandedAward} result={results[expandedAward]} />
            )}
          </div>
        )}

        {tab === 'races' && (
          <div>
            {seasonOver && (
              <p className="text-gray-500 text-sm mb-4">Final regular season standings for each award race.</p>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {RACE_AWARDS.map(a => (
                <RaceCard key={a} awardType={a} />
              ))}
            </div>
          </div>
        )}

        {tab === 'archive' && (
          <div>
            {archives.length === 0 ? (
              <GlassCard className="p-8 text-center">
                <p className="text-gray-500 text-sm">No completed seasons yet — award history is recorded when each season ends.</p>
              </GlassCard>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-6 flex-wrap">
                  <span className="text-[10px] uppercase tracking-[2px] text-gray-600">Season</span>
                  {archives.map(a => (
                    <button
                      key={a.seasonYear}
                      onClick={() => setArchiveYear(a.seasonYear)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        archiveYear === a.seasonYear ? 'text-accent bg-accent/10' : 'text-gray-500 hover:text-white hover:bg-white/[0.04]'
                      }`}
                    >
                      {a.seasonYear}
                    </button>
                  ))}
                </div>
                {(() => {
                  const rec = archives.find(a => a.seasonYear === archiveYear)
                  if (!rec) return null
                  return <ArchiveSlate awards={rec.awards} year={rec.seasonYear} />
                })()}
              </>
            )}
          </div>
        )}

        {tab === 'reporters' && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {reporters.map(r => (
              <ReporterCard key={r.id} reporter={r} />
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  )
}
