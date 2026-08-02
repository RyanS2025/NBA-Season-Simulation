import { useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import PageTransition from '../../components/layout/PageTransition'
import GlassCard from '../../components/common/GlassCard'
import { useLeague } from '../../hooks/useLeague'
import { generateReporters } from '../../utils/awards/reporter-generator'
import { updateNarratives } from '../../utils/awards/narrative-engine'
import { computeAllAwards, scoreMVPCandidate, scoreDPOYCandidate, scoreROYCandidate, scoreSixthManCandidate, scoreMIPCandidate, scoreClutchPOYCandidate } from '../../utils/awards/awards-engine'
import type { Player, Team } from '../../types'
import type { AwardType, AwardResult, Reporter, AwardBallot } from '../../types'

type AwardsTab = 'races' | 'results' | 'ballots' | 'reporters'

const ACCENT = 'oklch(64.6% 0.222 41.116)'

function pName(p: Player): string {
  return `${p.bio.firstName} ${p.bio.lastName}`
}

function teamName(t: Team): string {
  return `${t.info.city} ${t.info.name}`
}

function latestStats(p: Player) {
  return p.careerStats[p.careerStats.length - 1] ?? null
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

const RACE_AWARDS: AwardType[] = ['mvp', 'dpoy', 'roy', 'sixth_man', 'mip', 'clutch_poy']

type ScorerFn = (p: Player, t: Team) => number
const SCORER_MAP: Record<string, ScorerFn> = {
  mvp: scoreMVPCandidate,
  dpoy: scoreDPOYCandidate,
  roy: scoreROYCandidate,
  sixth_man: scoreSixthManCandidate,
  mip: scoreMIPCandidate,
  clutch_poy: scoreClutchPOYCandidate,
}

export default function AwardsPage() {
  const { id: leagueId } = useParams()
  const { players, teams, state, loading } = useLeague()
  const [activeTab, setActiveTab] = useState<AwardsTab>('races')
  const [selectedAward, setSelectedAward] = useState<string>('mvp')
  const [ballotFilter, setBallotFilter] = useState<string>('all')

  const playerMap = useMemo(() => new Map(players.map(p => [p.id, p])), [players])
  const teamMap = useMemo(() => new Map(teams.map(t => [t.id, t])), [teams])

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
    if (players.length === 0 || reporters.length === 0) return null
    return computeAllAwards(players, teams, reporters, narratives)
  }, [players, teams, reporters, narratives])

  const raceData = useMemo(() => {
    const data: Record<string, Array<{ player: Player; team: Team; score: number; statLine: string }>> = {}
    for (const awardType of RACE_AWARDS) {
      const scorer = SCORER_MAP[awardType]
      if (!scorer) continue
      const candidates: Array<{ player: Player; team: Team; score: number; statLine: string }> = []
      for (const p of players) {
        const team = teamMap.get(p.teamId)
        if (!team) continue
        const score = scorer(p, team)
        if (score <= 0) continue
        const s = latestStats(p)
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
  }, [players, teamMap])

  if (loading || !state) {
    return (
      <PageTransition>
        <div className="text-gray-400 text-center py-20">Loading awards...</div>
      </PageTransition>
    )
  }

  const tabs: { id: AwardsTab; label: string }[] = [
    { id: 'races', label: 'Award Races' },
    { id: 'results', label: 'Results' },
    { id: 'ballots', label: 'Ballots' },
    { id: 'reporters', label: 'Reporters' },
  ]

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
              const isUserTeam = c.player.teamId === state.userTeamId
              return (
                <div
                  key={c.player.id}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    isWinner ? `bg-[${ACCENT}]/8 border border-[${ACCENT}]/20` :
                    isUserTeam ? 'bg-white/[0.03]' : 'hover:bg-white/[0.02]'
                  }`}
                >
                  <span className={`text-xs w-5 text-center font-medium ${
                    isWinner ? `text-[${ACCENT}]` : 'text-gray-600'
                  }`}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm font-medium ${
                      isWinner ? 'text-white' : isUserTeam ? `text-[${ACCENT}]` : 'text-gray-200'
                    }`}>
                      {pName(c.player)}
                    </span>
                    <span className="text-gray-500 text-xs ml-2">
                      {teamName(c.team)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-gray-400 text-xs">{c.statLine}</span>
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

  function ResultCard({ awardType, result }: { awardType: string; result: AwardResult }) {
    const winner = playerMap.get(result.winnerId) ?? (awardType === 'coty' || awardType === 'eoty' ? null : null)
    const winnerTeam = winner ? teamMap.get(winner.teamId) : teamMap.get(result.winnerId)

    const sortedVotes = Object.entries(result.voteTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)

    const maxPoints = result.maxPossiblePoints

    return (
      <GlassCard className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[10px] uppercase tracking-[2px] text-gray-600">
            {AWARD_LABELS[awardType] ?? awardType}
          </h3>
          {result.wasUnanimous && (
            <span className="px-2 py-0.5 rounded text-[9px] uppercase tracking-wider bg-yellow-500/15 text-yellow-400 border border-yellow-500/30">
              Unanimous
            </span>
          )}
        </div>

        <div className="mb-4">
          <div className="text-lg font-display text-white">
            {winner ? pName(winner) : winnerTeam ? teamName(winnerTeam) : result.winnerId}
          </div>
          {winnerTeam && winner && (
            <div className="text-xs text-gray-500">
              {teamName(winnerTeam)} — {latestStats(winner)?.ppg.toFixed(1) ?? '—'} PPG
            </div>
          )}
          <div className="text-xs text-gray-600 mt-1">
            Won by {result.marginOfVictory} points • {result.firstPlaceVotes[result.winnerId] ?? 0}/{reporters.length} first-place votes
          </div>
          {result.controversialVotes.length > 0 && (
            <div className="text-[10px] text-amber-400 mt-1">
              {result.controversialVotes.length} controversial vote{result.controversialVotes.length > 1 ? 's' : ''}
            </div>
          )}
        </div>

        <div className="space-y-2">
          {sortedVotes.map(([id, points]) => {
            const p = playerMap.get(id)
            const t = p ? teamMap.get(p.teamId) : teamMap.get(id)
            const pct = maxPoints > 0 ? (points / maxPoints) * 100 : 0
            return (
              <div key={id}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className={`${id === result.winnerId ? 'text-white font-medium' : 'text-gray-400'}`}>
                    {p ? pName(p) : t ? teamName(t) : id}
                  </span>
                  <span className="text-gray-500">
                    {points} pts ({result.firstPlaceVotes[id] ?? 0} 1st)
                  </span>
                </div>
                <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${id === result.winnerId ? `bg-[${ACCENT}]` : 'bg-gray-600'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
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
                  pick.isHomerPick ? 'bg-amber-500/8 border border-amber-500/15' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-4 text-center font-medium ${
                    pick.rank === 1 ? `text-[${ACCENT}]` : 'text-gray-600'
                  }`}>
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
          <div className="text-[10px] text-amber-400/70 mb-2">
            Covers {teamName(beatTeam)}
          </div>
        )}

        <div className="text-[10px] text-gray-600 mb-2">{reporter.yearsExperience} years experience</div>

        <div className="space-y-1.5">
          {traits.map(trait => (
            <div key={trait.label} className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500 w-20 shrink-0">{trait.label}</span>
              <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    trait.label === 'Homer Bias' ? 'bg-amber-500' : `bg-[${ACCENT}]`
                  }`}
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

  const selectedResult = results?.[selectedAward]
  const filteredBallots = selectedResult?.ballots.filter(b => {
    if (ballotFilter === 'all') return true
    if (ballotFilter === 'homer') return b.picks.some(p => p.isHomerPick)
    return b.reporterType === ballotFilter
  }) ?? []

  return (
    <PageTransition>
      <div>
        <h1 className="font-display text-4xl tracking-wide text-white mb-6">Awards</h1>

        <div className="flex gap-1 mb-6 flex-wrap">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? `text-[${ACCENT}] bg-[${ACCENT}]/10`
                  : 'text-gray-500 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'races' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {RACE_AWARDS.map(a => (
              <RaceCard key={a} awardType={a} />
            ))}
          </div>
        )}

        {activeTab === 'results' && results && (
          <div className="space-y-6">
            {results.mvp?.controversialVotes.length > 0 && (
              <GlassCard className="p-5 border-amber-500/20">
                <h3 className="text-[10px] uppercase tracking-[2px] text-amber-400 mb-3">
                  Controversial Votes
                </h3>
                <div className="space-y-2">
                  {Object.values(results).flatMap(r => r.controversialVotes).slice(0, 10).map((cv, i) => (
                    <div key={i} className="flex items-center justify-between text-xs px-2 py-1.5 rounded bg-amber-500/5">
                      <span className="text-amber-300">{cv.reporterName}</span>
                      <span className="text-gray-400">{cv.reason}</span>
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {Object.entries(results).map(([key, result]) => (
                <ResultCard key={key} awardType={key} result={result} />
              ))}
            </div>
          </div>
        )}

        {activeTab === 'ballots' && results && (
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <div className="flex gap-1">
                {Object.keys(AWARD_LABELS).filter(k => results[k]).map(key => (
                  <button
                    key={key}
                    onClick={() => setSelectedAward(key)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-wider font-medium transition-colors ${
                      selectedAward === key
                        ? `text-[${ACCENT}] bg-[${ACCENT}]/10`
                        : 'text-gray-500 hover:text-white hover:bg-white/[0.04]'
                    }`}
                  >
                    {key === 'mvp' ? 'MVP' : key === 'dpoy' ? 'DPOY' : key === 'roy' ? 'ROY' :
                     key === 'sixth_man' ? '6MOY' : key === 'mip' ? 'MIP' :
                     key === 'clutch_poy' ? 'CPOY' : key === 'coty' ? 'COTY' : 'EOTY'}
                  </button>
                ))}
              </div>
              <div className="flex gap-1 border-l border-white/[0.08] pl-2">
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
                    className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                      ballotFilter === f.id
                        ? 'text-white bg-white/[0.08]'
                        : 'text-gray-600 hover:text-gray-400'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-xs text-gray-500 mb-2">
              Showing {filteredBallots.length} of {selectedResult?.ballots.length ?? 0} ballots for {AWARD_LABELS[selectedAward] ?? selectedAward}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredBallots.slice(0, 30).map(ballot => (
                <BallotCard key={ballot.reporterId} ballot={ballot} />
              ))}
            </div>

            {filteredBallots.length > 30 && (
              <p className="text-gray-600 text-xs text-center">
                Showing 30 of {filteredBallots.length} ballots
              </p>
            )}
          </div>
        )}

        {activeTab === 'reporters' && (
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
