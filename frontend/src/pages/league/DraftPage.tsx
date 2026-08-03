import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import PageTransition from '../../components/layout/PageTransition'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import GlassCard from '../../components/common/GlassCard'
import { useLeague } from '../../hooks/useLeague'
import type { DraftState } from '../../hooks/useLeague'
import type { DraftProspect, DraftPick } from '../../utils/draft-engine'
import type { Position, Player } from '../../types'

type PositionFilter = Position | 'ALL'
const POSITION_FILTERS: PositionFilter[] = ['ALL', 'PG', 'SG', 'SF', 'PF', 'C']

function formatHeight(inches: number): string {
  return `${Math.floor(inches / 12)}'${inches % 12}"`
}

function ovrColor(ovr: number): string {
  if (ovr >= 85) return 'text-[oklch(64.6%_0.222_41.116)]'
  if (ovr >= 78) return 'text-green-400'
  if (ovr >= 70) return 'text-gray-300'
  return 'text-gray-500'
}

function ScoutingDots({ level }: { level: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3].map(l => (
        <div
          key={l}
          className={`w-2 h-2 rounded-full ${
            l <= level ? 'bg-[oklch(64.6%_0.222_41.116)]' : 'bg-white/[0.08]'
          }`}
        />
      ))}
    </div>
  )
}

function RatingBar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, ((value - 40) / 55) * 100))
  return (
    <div>
      <div className="flex justify-between mb-0.5">
        <span className="text-gray-500">{label}</span>
        <span className={ovrColor(value)}>{value}</span>
      </div>
      <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className="h-full rounded-full bg-[oklch(64.6%_0.222_41.116)]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function ProspectCard({
  prospect,
  rank,
  onDraft,
  isUserPick,
}: {
  prospect: DraftProspect
  rank: number
  onDraft?: () => void
  isUserPick?: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className={`border rounded-xl p-4 transition-all ${
        isUserPick
          ? 'border-[oklch(64.6%_0.222_41.116)]/30 bg-[oklch(64.6%_0.222_41.116)]/5'
          : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'
      }`}
    >
      <div className="flex items-center gap-4">
        <div className="text-2xl font-display text-gray-600 w-8 text-center">{rank}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white font-semibold">
              {prospect.firstName} {prospect.lastName}
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-white/[0.08] text-gray-400">
              {prospect.position}
            </span>
            {prospect.secondaryPosition && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-white/[0.04] text-gray-600">
                {prospect.secondaryPosition}
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {prospect.school} &middot; {prospect.country} &middot; {prospect.age} yrs
            {prospect.height > 0 && ` · ${formatHeight(prospect.height)}`}
            {prospect.weight > 0 && ` · ${prospect.weight} lbs`}
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm">
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-wider text-gray-600">Proj</div>
            <div className={`font-semibold ${ovrColor(prospect.projectedOverall)}`}>
              {prospect.projectedOverall}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-wider text-gray-600">Ceil</div>
            <div className={`font-semibold ${ovrColor(prospect.ceiling)}`}>
              {prospect.ceiling}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-wider text-gray-600">Floor</div>
            <div className="font-semibold text-gray-400">{prospect.floor}</div>
          </div>
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-wider text-gray-600">Scout</div>
            <ScoutingDots level={prospect.scoutingRevealed} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="px-2 py-1 text-xs text-gray-500 hover:text-white transition-colors"
          >
            {expanded ? 'Less' : 'More'}
          </button>
          {isUserPick && onDraft && (
            <button
              onClick={onDraft}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-[oklch(64.6%_0.222_41.116)] text-white hover:brightness-110 transition-all"
            >
              Draft
            </button>
          )}
        </div>
      </div>

      {expanded && prospect.scoutingRevealed >= 2 && (
        <div className="mt-3 pt-3 border-t border-white/[0.06]">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <RatingBar label="Finishing" value={prospect.ratings.finishing} />
            <RatingBar label="3PT" value={prospect.ratings.threePoint} />
            <RatingBar label="Ball Handle" value={prospect.ratings.ballHandling} />
            <RatingBar label="Passing" value={prospect.ratings.passingVision} />
            {prospect.scoutingRevealed >= 3 && (
              <>
                <RatingBar label="Per. Defense" value={prospect.ratings.perimeterDefense} />
                <RatingBar label="Int. Defense" value={prospect.ratings.interiorDefense} />
                <RatingBar label="Speed" value={prospect.ratings.speed} />
                <RatingBar label="Rebounding" value={prospect.ratings.rebounding} />
              </>
            )}
          </div>
          {prospect.storyline && (
            <p className="text-xs text-gray-500 italic mt-2">{prospect.storyline}</p>
          )}
        </div>
      )}
    </div>
  )
}

function DraftTradePanel({
  teams,
  players,
  userTeamId,
  pickNumber,
  onAccept,
  onCancel,
}: {
  teams: { id: string; info: { city: string; name: string } }[]
  players: Player[]
  userTeamId: string
  pickNumber: number
  onAccept: (partnerTeamId: string, inPlayerIds: string[]) => void
  onCancel: () => void
}) {
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null)

  const interestedTeams = useMemo(() => {
    return teams
      .filter(t => t.id !== userTeamId)
      .sort(() => Math.random() - 0.5)
      .slice(0, 6)
  }, [teams, userTeamId])

  const selectedPlayers = useMemo(() => {
    if (!selectedTeam) return []
    return players
      .filter(p => p.teamId === selectedTeam)
      .sort((a, b) => (b.ratings.overall ?? 0) - (a.ratings.overall ?? 0))
      .slice(0, 5)
  }, [selectedTeam, players])

  return (
    <GlassCard className="p-5 mb-4 border border-yellow-500/20">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-yellow-400" />
          Trade Pick #{pickNumber}
        </h3>
        <button onClick={onCancel} className="text-xs text-gray-500 hover:text-white transition-colors">
          Cancel
        </button>
      </div>

      {!selectedTeam ? (
        <div>
          <p className="text-xs text-gray-500 mb-3">Select a team to trade with:</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {interestedTeams.map(t => (
              <button
                key={t.id}
                onClick={() => setSelectedTeam(t.id)}
                className="px-3 py-2 rounded-lg text-xs text-left bg-white/[0.03] border border-white/[0.06] hover:border-[oklch(64.6%_0.222_41.116)]/30 hover:bg-white/[0.06] transition-all"
              >
                <div className="text-white font-medium">{t.info.city}</div>
                <div className="text-gray-500">{t.info.name}</div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <p className="text-xs text-gray-500 mb-3">
            {teams.find(t => t.id === selectedTeam)?.info.city} offers — select a player to receive for your pick:
          </p>
          <div className="space-y-1.5 mb-4">
            {selectedPlayers.map(p => (
              <button
                key={p.id}
                onClick={() => onAccept(selectedTeam, [p.id])}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:border-[oklch(64.6%_0.222_41.116)]/30 hover:bg-white/[0.06] transition-all text-left"
              >
                <div>
                  <div className="text-sm text-white">{p.bio.firstName} {p.bio.lastName}</div>
                  <div className="text-xs text-gray-500">{p.bio.position} &middot; OVR {p.ratings.overall}</div>
                </div>
                <span className="text-xs text-[oklch(64.6%_0.222_41.116)]">Accept</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => setSelectedTeam(null)}
            className="text-xs text-gray-500 hover:text-white transition-colors"
          >
            ← Back to teams
          </button>
        </div>
      )}
    </GlassCard>
  )
}

function LotteryResultsPanel({
  draftState,
  teams,
}: {
  draftState: DraftState
  teams: { id: string; info: { city: string; name: string } }[]
}) {
  const teamMap = useMemo(() => new Map(teams.map(t => [t.id, t])), [teams])

  return (
    <GlassCard className="p-5 mb-6">
      <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-yellow-400" />
        Draft Lottery Results
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
        {draftState.lotteryResults.map(lr => {
          const team = teamMap.get(lr.teamId)
          return (
            <div
              key={lr.teamId}
              className={`rounded-lg p-2 text-center ${
                lr.moved
                  ? 'bg-[oklch(64.6%_0.222_41.116)]/10 border border-[oklch(64.6%_0.222_41.116)]/20'
                  : 'bg-white/[0.03] border border-white/[0.06]'
              }`}
            >
              <div className="text-lg font-display text-white">#{lr.pickNumber}</div>
              <div className="text-xs text-gray-400 truncate">
                {team ? `${team.info.city}` : lr.teamId}
              </div>
              {lr.moved && (
                <div className="text-[10px] text-[oklch(64.6%_0.222_41.116)] mt-0.5">
                  from #{lr.originalSeed}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </GlassCard>
  )
}

function CompletedPickRow({
  pick,
  prospect,
  team,
  userTeamId,
}: {
  pick: DraftPick & { analysis?: string }
  prospect?: DraftProspect
  team?: { info: { city: string; name: string } }
  userTeamId: string
}) {
  const isUser = pick.teamId === userTeamId
  return (
    <div
      className={`flex items-center gap-3 py-2 px-3 rounded-lg ${
        isUser ? 'bg-[oklch(64.6%_0.222_41.116)]/5' : ''
      }`}
    >
      <div className="w-8 text-center font-display text-gray-500">
        {pick.pickNumber}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-white font-medium">{pick.prospectName}</span>
          {prospect && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-white/[0.08] text-gray-400">
              {prospect.position}
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500">
          {team ? `${team.info.city} ${team.info.name}` : pick.teamId}
          {prospect && ` · ${prospect.school}`}
        </div>
        {pick.analysis && (
          <div className="text-xs text-gray-500 italic mt-0.5">{pick.analysis}</div>
        )}
      </div>
      {prospect && (
        <div className={`text-sm font-semibold ${ovrColor(prospect.projectedOverall)}`}>
          {prospect.projectedOverall}
        </div>
      )}
    </div>
  )
}

export default function DraftPage() {
  const { id: leagueId } = useParams()
  const navigate = useNavigate()
  const {
    state,
    teams,
    players,
    loading,
    simming,
    draftState,
    startDraft,
    userDraftPick,
    advanceDraftPick,
    completeDraft,
    executeTrade,
  } = useLeague()

  const [search, setSearch] = useState('')
  const [posFilter, setPosFilter] = useState<PositionFilter>('ALL')
  const [autoAdvancing, setAutoAdvancing] = useState(false)
  const [showTradePanel, setShowTradePanel] = useState(false)
  const [tradeMessage, setTradeMessage] = useState<string | null>(null)
  const autoAdvanceRef = useRef(false)
  const picksEndRef = useRef<HTMLDivElement>(null)

  const allProspectsRef = useRef<Map<string, DraftProspect>>(new Map())
  useEffect(() => {
    if (draftState) {
      for (const p of draftState.prospects) {
        allProspectsRef.current.set(p.id, p)
      }
    }
  }, [draftState])

  const userTeamId = state?.userTeamId ?? ''
  const userTeam = teams.find(t => t.id === userTeamId)

  const isPreDraft = !draftState
  const isDraftActive = draftState?.isActive ?? false
  const isDraftComplete = draftState != null && !draftState.isActive && draftState.completedPicks.length > 0

  const currentPick = draftState && isDraftActive
    ? draftState.draftOrder[draftState.currentPickIndex]
    : null
  const isUserTurn = currentPick?.teamId === userTeamId
  const currentPickTeam = currentPick ? teams.find(t => t.id === currentPick.teamId) : null

  const filteredProspects = useMemo(() => {
    if (!draftState) return []
    return draftState.prospects.filter(p => {
      const matchesSearch = `${p.firstName} ${p.lastName}`.toLowerCase().includes(search.toLowerCase())
      const matchesPos = posFilter === 'ALL' || p.position === posFilter
      return matchesSearch && matchesPos
    }).sort((a, b) => b.projectedOverall - a.projectedOverall)
  }, [draftState, search, posFilter])

  const runAutoAdvance = useCallback(async () => {
    if (autoAdvanceRef.current) return
    autoAdvanceRef.current = true
    setAutoAdvancing(true)

    try {
      let keepGoing = true
      while (keepGoing) {
        await new Promise(r => setTimeout(r, 500))
        const result = await advanceDraftPick()
        if (!result) { keepGoing = false; break }
        if (result.isUserNext) { keepGoing = false }
      }
    } catch (e) {
      console.warn('Draft auto-pick failed:', e)
    } finally {
      autoAdvanceRef.current = false
      setAutoAdvancing(false)
    }
  }, [advanceDraftPick])

  useEffect(() => {
    if (picksEndRef.current && draftState && draftState.completedPicks.length > 0) {
      picksEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [draftState?.completedPicks.length])

  const handleUserPick = useCallback(async (prospectId: string) => {
    await userDraftPick(prospectId)
    setTimeout(() => runAutoAdvance(), 300)
  }, [userDraftPick, runAutoAdvance])

  const handleDraftTrade = useCallback(async (partnerTeamId: string, inPlayerIds: string[]) => {
    const userPlayerIds: string[] = []
    const result = await executeTrade(userPlayerIds, inPlayerIds, partnerTeamId)
    if (result.executed) {
      setShowTradePanel(false)
      setTradeMessage('Trade completed!')
      setTimeout(() => setTradeMessage(null), 3000)
    }
  }, [executeTrade])

  // Auto-start CPU picks after draft loads if user doesn't have pick #1
  useEffect(() => {
    if (draftState?.isActive && draftState.currentPickIndex === 0 && draftState.completedPicks.length === 0) {
      const firstPick = draftState.draftOrder[0]
      if (firstPick && firstPick.teamId !== userTeamId) {
        runAutoAdvance()
      }
    }
  }, [draftState?.isActive]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading || !state) {
    return (
      <PageTransition>
        <LoadingSpinner message="Loading draft center..." />
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <div>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-6 gap-4">
          <div>
            <h1 className="font-display text-4xl tracking-wide text-white">Draft Center</h1>
            <p className="text-gray-500 text-sm mt-1">
              {state.currentSeason} Draft
              {isDraftActive && currentPick && ` — Pick #${currentPick.pickNumber}`}
              {isDraftComplete && ' — Complete'}
            </p>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-1">Your Team</div>
            <div className="text-white text-sm font-medium">
              {userTeam ? `${userTeam.info.city} ${userTeam.info.name}` : userTeamId}
            </div>
          </div>
        </div>

        {/* Pre-draft: Start Draft button */}
        {isPreDraft && (
          <GlassCard className="p-5 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                  <h2 className="text-sm font-semibold text-white">Ready to Draft</h2>
                </div>
                <p className="text-gray-400 text-sm">
                  Start the draft to run the lottery and begin the pick-by-pick selection process.
                </p>
              </div>
              <button
                onClick={startDraft}
                disabled={simming}
                className="px-6 py-3 rounded-xl text-sm font-semibold bg-[oklch(64.6%_0.222_41.116)] text-white hover:brightness-110 transition-all disabled:opacity-50"
              >
                {simming ? 'Loading...' : 'Start Draft'}
              </button>
            </div>
          </GlassCard>
        )}

        {/* Lottery Results */}
        {draftState && draftState.lotteryResults.length > 0 && (
          <LotteryResultsPanel draftState={draftState} teams={teams} />
        )}

        {/* Active Draft: Split layout */}
        {isDraftActive && draftState && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Left: Pick history */}
            <div className="lg:col-span-2">
              <GlassCard className="p-4">
                <h3 className="text-sm font-semibold text-white mb-3">
                  Draft Board
                  <span className="text-gray-500 font-normal ml-2">
                    {draftState.completedPicks.length}/{draftState.draftOrder.length}
                  </span>
                </h3>

                {currentPick && (
                  <div className={`mb-3 p-3 rounded-lg border ${
                    isUserTurn
                      ? 'border-[oklch(64.6%_0.222_41.116)] bg-[oklch(64.6%_0.222_41.116)]/10'
                      : 'border-yellow-400/30 bg-yellow-400/5'
                  }`}>
                    <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">
                      On the Clock
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-display text-white">
                        #{currentPick.pickNumber}
                      </span>
                      <span className="text-sm text-gray-300">
                        {currentPickTeam
                          ? `${currentPickTeam.info.city} ${currentPickTeam.info.name}`
                          : currentPick.teamId}
                      </span>
                    </div>
                    {isUserTurn && (
                      <div className="flex items-center justify-between mt-1">
                        <div className="text-xs text-[oklch(64.6%_0.222_41.116)]">
                          Your pick — select a prospect from the board
                        </div>
                        <button
                          onClick={() => setShowTradePanel(true)}
                          className="px-3 py-1 rounded-lg text-xs font-medium bg-yellow-400/10 text-yellow-400 hover:bg-yellow-400/20 transition-colors"
                        >
                          Trade This Pick
                        </button>
                      </div>
                    )}
                    {!isUserTurn && autoAdvancing && (
                      <div className="text-xs text-yellow-400 mt-1">
                        Selecting...
                      </div>
                    )}
                    {!isUserTurn && !autoAdvancing && (
                      <button
                        onClick={runAutoAdvance}
                        className="mt-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.06] text-gray-300 hover:bg-white/[0.1] hover:text-white transition-colors"
                      >
                        Continue Draft
                      </button>
                    )}
                  </div>
                )}

                <div className="space-y-1 max-h-[600px] overflow-y-auto">
                  {draftState.completedPicks.map(pick => {
                    const prospect = allProspectsRef.current.get(pick.prospectId ?? '')
                    const team = teams.find(t => t.id === pick.teamId)
                    return (
                      <CompletedPickRow
                        key={pick.pickNumber}
                        pick={pick}
                        prospect={prospect}
                        team={team}
                        userTeamId={userTeamId}
                      />
                    )
                  })}
                  <div ref={picksEndRef} />
                </div>
              </GlassCard>
            </div>

            {/* Right: Prospect board */}
            <div className="lg:col-span-3">
              {tradeMessage && (
                <div className="mb-4 px-4 py-2.5 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm font-medium">
                  {tradeMessage}
                </div>
              )}

              {showTradePanel && isUserTurn && currentPick && (
                <DraftTradePanel
                  teams={teams}
                  players={players}
                  userTeamId={userTeamId}
                  pickNumber={currentPick.pickNumber}
                  onAccept={(partnerTeamId, inPlayerIds) => handleDraftTrade(partnerTeamId, inPlayerIds)}
                  onCancel={() => setShowTradePanel(false)}
                />
              )}
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <input
                  type="text"
                  placeholder="Search prospects..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[oklch(64.6%_0.222_41.116)]/50"
                />
                <div className="flex gap-1">
                  {POSITION_FILTERS.map(pos => (
                    <button
                      key={pos}
                      onClick={() => setPosFilter(pos)}
                      className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                        posFilter === pos
                          ? 'text-[oklch(64.6%_0.222_41.116)] bg-[oklch(64.6%_0.222_41.116)]/10'
                          : 'text-gray-500 hover:text-white hover:bg-white/[0.04]'
                      }`}
                    >
                      {pos}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                {filteredProspects.map((prospect, i) => (
                  <ProspectCard
                    key={prospect.id}
                    prospect={prospect}
                    rank={i + 1}
                    isUserPick={isUserTurn}
                    onDraft={isUserTurn ? () => handleUserPick(prospect.id) : undefined}
                  />
                ))}
                {filteredProspects.length === 0 && (
                  <div className="text-gray-500 text-sm text-center py-8">
                    No prospects match your filters
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Draft complete summary */}
        {isDraftComplete && draftState && (
          <>
            <GlassCard className="p-5 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-white mb-1">Draft Complete</h2>
                  <p className="text-gray-400 text-sm">
                    {draftState.completedPicks.length} players selected.
                    Advance to free agency to continue the offseason.
                  </p>
                </div>
                <button
                  onClick={async () => {
                    await completeDraft()
                    navigate(`/league/${leagueId}/free-agency`)
                  }}
                  className="px-6 py-3 rounded-xl text-sm font-semibold bg-[oklch(64.6%_0.222_41.116)] text-white hover:brightness-110 transition-all"
                >
                  Continue to Free Agency
                </button>
              </div>
            </GlassCard>

            <GlassCard className="p-4 mb-4">
              <h3 className="text-sm font-semibold text-white mb-3">Round 1</h3>
              <div className="space-y-1">
                {draftState.completedPicks
                  .filter(p => p.round === 1)
                  .map(pick => {
                    const prospect = allProspectsRef.current.get(pick.prospectId ?? '')
                    const team = teams.find(t => t.id === pick.teamId)
                    return (
                      <CompletedPickRow
                        key={pick.pickNumber}
                        pick={pick}
                        prospect={prospect}
                        team={team}
                        userTeamId={userTeamId}
                      />
                    )
                  })}
              </div>
            </GlassCard>

            <GlassCard className="p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Round 2</h3>
              <div className="space-y-1">
                {draftState.completedPicks
                  .filter(p => p.round === 2)
                  .map(pick => {
                    const prospect = allProspectsRef.current.get(pick.prospectId ?? '')
                    const team = teams.find(t => t.id === pick.teamId)
                    return (
                      <CompletedPickRow
                        key={pick.pickNumber}
                        pick={pick}
                        prospect={prospect}
                        team={team}
                        userTeamId={userTeamId}
                      />
                    )
                  })}
              </div>
            </GlassCard>
          </>
        )}
      </div>
    </PageTransition>
  )
}
