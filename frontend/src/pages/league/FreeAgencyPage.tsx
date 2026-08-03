import { useState, useMemo, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import PageTransition from '../../components/layout/PageTransition'
import GlassCard from '../../components/common/GlassCard'
import SearchInput from '../../components/common/SearchInput'
import { useLeague } from '../../hooks/useLeague'
import { computeCapSheet } from '../../utils/cba-engine'
import type { Player, Position } from '../../types'

type PositionFilter = Position | 'ALL'
const POSITION_FILTERS: PositionFilter[] = ['ALL', 'PG', 'SG', 'SF', 'PF', 'C']

interface FARow {
  id: string
  name: string
  firstName: string
  lastName: string
  position: Position
  age: number
  overall: number
  ppg: number
  rpg: number
  apg: number
  priorSalary: number
}

function latestStats(player: Player) {
  const stats = player.careerStats
  if (!stats || stats.length === 0) return { ppg: 0, rpg: 0, apg: 0 }
  const last = stats[stats.length - 1]
  return { ppg: last.ppg, rpg: last.rpg, apg: last.apg }
}

function formatSalary(salary: number): string {
  if (salary >= 1_000_000) return `$${(salary / 1_000_000).toFixed(1)}M`
  if (salary >= 1_000) return `$${(salary / 1_000).toFixed(0)}K`
  return `$${salary}`
}

function ovrColor(ovr: number): string {
  if (ovr >= 85) return 'text-[oklch(64.6%_0.222_41.116)] font-semibold'
  if (ovr >= 75) return 'text-green-400'
  return 'text-gray-300'
}

function estimateAskingSalary(player: FARow): number {
  const base = player.priorSalary > 0 ? player.priorSalary : 2_000_000
  if (player.overall >= 85) return Math.max(base * 1.1, 30_000_000)
  if (player.overall >= 78) return Math.max(base * 1.05, 15_000_000)
  if (player.overall >= 72) return Math.max(base * 0.95, 5_000_000)
  if (player.overall >= 65) return Math.max(base * 0.8, 2_000_000)
  return Math.max(1_119_000, base * 0.6)
}

type SortKey = 'lastName' | 'age' | 'overall' | 'ppg' | 'rpg' | 'apg' | 'priorSalary'

function SigningPanel({
  player,
  capSpace,
  onSign,
  onCancel,
  signing,
}: {
  player: FARow
  capSpace: number
  onSign: (salary: number, years: number) => void
  onCancel: () => void
  signing: boolean
}) {
  const estimated = estimateAskingSalary(player)
  const minSalary = 1_119_000
  const maxSalary = Math.min(50_000_000, Math.max(capSpace, minSalary))
  const [salary, setSalary] = useState(Math.min(estimated, maxSalary))
  const [years, setYears] = useState(player.age >= 32 ? 1 : 3)

  const salaryStepDown = () => setSalary(prev => Math.max(minSalary, prev - 1_000_000))
  const salaryStepUp = () => setSalary(prev => Math.min(maxSalary, prev + 1_000_000))

  return (
    <div className="bg-white/[0.03] border border-[oklch(64.6%_0.222_41.116)]/20 rounded-xl p-4 mt-2 animate-in slide-in-from-top-2">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-white">
          Contract Offer for {player.name}
        </h4>
        <span className="text-xs text-gray-500">
          Asking: ~{formatSalary(estimated)}/yr
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-gray-500 mb-1 block">
            Annual Salary
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={salaryStepDown}
              className="w-8 h-8 rounded-lg bg-white/[0.06] text-gray-400 hover:text-white hover:bg-white/[0.1] transition-colors text-lg font-mono"
            >
              −
            </button>
            <span className="text-white font-semibold text-sm flex-1 text-center">
              {formatSalary(salary)}
            </span>
            <button
              onClick={salaryStepUp}
              className="w-8 h-8 rounded-lg bg-white/[0.06] text-gray-400 hover:text-white hover:bg-white/[0.1] transition-colors text-lg font-mono"
            >
              +
            </button>
          </div>
          <input
            type="range"
            min={minSalary}
            max={maxSalary}
            step={500_000}
            value={salary}
            onChange={(e) => setSalary(Number(e.target.value))}
            className="w-full mt-2 accent-[oklch(64.6%_0.222_41.116)]"
          />
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-wider text-gray-500 mb-1 block">
            Years
          </label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(y => (
              <button
                key={y}
                onClick={() => setYears(y)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  years === y
                    ? 'bg-[oklch(64.6%_0.222_41.116)]/15 text-[oklch(64.6%_0.222_41.116)] border border-[oklch(64.6%_0.222_41.116)]/30'
                    : 'bg-white/[0.04] text-gray-500 border border-white/[0.06] hover:text-white'
                }`}
              >
                {y}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-600 mt-2">
            Total: {formatSalary(salary * years)}
          </p>
        </div>
      </div>

      {salary > capSpace && (
        <p className="text-xs text-red-400 mb-3">
          Salary exceeds available cap space ({formatSalary(capSpace)})
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-lg text-xs font-medium text-gray-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => onSign(salary, years)}
          disabled={signing || salary > capSpace}
          className="px-5 py-2 rounded-lg text-xs font-semibold bg-[oklch(64.6%_0.222_41.116)] text-white hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {signing ? 'Signing...' : 'Sign Player'}
        </button>
      </div>
    </div>
  )
}

export default function FreeAgencyPage() {
  const { id: leagueId } = useParams()
  const navigate = useNavigate()
  const { players, teams, state, loading, signFreeAgent, advanceToNextSeason } = useLeague()
  const [search, setSearch] = useState('')
  const [posFilter, setPosFilter] = useState<PositionFilter>('ALL')
  const [signingPlayerId, setSigningPlayerId] = useState<string | null>(null)
  const [signing, setSigning] = useState(false)
  const [lastSigned, setLastSigned] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('overall')
  const [sortAsc, setSortAsc] = useState(false)

  const userTeam = useMemo(() =>
    teams.find(t => t.id === state?.userTeamId),
  [teams, state?.userTeamId])

  const userTeamPlayers = useMemo(() =>
    players.filter(p => p.teamId === state?.userTeamId),
  [players, state?.userTeamId])

  const capSheet = useMemo(() =>
    computeCapSheet(userTeamPlayers),
  [userTeamPlayers])

  const freeAgents: FARow[] = useMemo(() =>
    players
      .filter(p => p.status.isFreeAgent || !p.teamId)
      .map(p => {
        const { ppg, rpg, apg } = latestStats(p)
        return {
          id: p.id,
          name: `${p.bio.firstName} ${p.bio.lastName}`,
          firstName: p.bio.firstName,
          lastName: p.bio.lastName,
          position: p.bio.position,
          age: p.bio.age,
          overall: p.ratings.overall,
          ppg, rpg, apg,
          priorSalary: p.contract?.annualSalary ?? 0,
        }
      }),
  [players])

  const filtered = useMemo(() => {
    const list = freeAgents.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase())
      const matchesPos = posFilter === 'ALL' || p.position === posFilter
      return matchesSearch && matchesPos
    })
    list.sort((a, b) => {
      const aVal = a[sortKey]
      const bVal = b[sortKey]
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return sortAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
    })
    return list
  }, [freeAgents, search, posFilter, sortKey, sortAsc])

  const handleSort = useCallback((key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(prev => !prev)
    } else {
      setSortKey(key)
      setSortAsc(false)
    }
  }, [sortKey])

  const handleSign = useCallback(async (playerId: string, salary: number, years: number) => {
    if (!state?.userTeamId) return
    setSigning(true)
    const success = await signFreeAgent(playerId, state.userTeamId, salary, years)
    setSigning(false)
    if (success) {
      setSigningPlayerId(null)
      setLastSigned(playerId)
      setTimeout(() => setLastSigned(null), 3000)
    }
  }, [signFreeAgent, state?.userTeamId])

  const handleAdvanceSeason = useCallback(async () => {
    const success = await advanceToNextSeason()
    if (success) {
      navigate(`/league/${leagueId}`)
    }
  }, [advanceToNextSeason, navigate, leagueId])

  if (loading || !state) {
    return (
      <PageTransition>
        <div className="text-gray-400 text-center py-20">Loading free agency...</div>
      </PageTransition>
    )
  }

  const isFreeAgencyPhase = state.currentPhase === 'free_agency'
  const isRegularSeason = state.currentPhase === 'regular_season' || state.currentPhase === 'preseason'
  const rosterCount = userTeam?.roster.length ?? 0

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return ''
    return sortAsc ? ' ↑' : ' ↓'
  }

  const sortableHeader = (key: SortKey, label: string, align: 'left' | 'center' | 'right' = 'center') => (
    <th
      key={key}
      onClick={() => handleSort(key)}
      className={`px-3 py-2.5 text-[10px] uppercase tracking-wider font-medium cursor-pointer hover:text-white transition-colors ${
        sortKey === key ? 'text-[oklch(64.6%_0.222_41.116)]' : 'text-gray-600'
      } text-${align}`}
    >
      {label}{sortIndicator(key)}
    </th>
  )

  return (
    <PageTransition>
      <div>
        <h1 className="font-display text-4xl tracking-wide text-white mb-1">Free Agency</h1>
        <p className="text-gray-500 text-sm mb-6">
          {freeAgents.length > 0
            ? `${freeAgents.length} available free agents`
            : 'No free agents available'}
        </p>

        {isRegularSeason && freeAgents.length === 0 ? (
          <GlassCard className="p-12">
            <div className="text-center">
              <h2 className="text-xl font-display tracking-wide text-white mb-3">Free Agency Opens in the Offseason</h2>
              <p className="text-gray-500 text-sm max-w-md mx-auto">
                Free agency will open after the season ends. Continue simulating through the regular season and playoffs to reach the offseason.
              </p>
            </div>
          </GlassCard>
        ) : (
          <>
            {/* Cap Space Summary */}
            {isFreeAgencyPhase && userTeam && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <GlassCard className="p-4">
                  <p className="text-[10px] uppercase tracking-wider text-gray-600 mb-1">Cap Space</p>
                  <p className="text-lg font-semibold text-green-400">{formatSalary(capSheet.capSpace)}</p>
                </GlassCard>
                <GlassCard className="p-4">
                  <p className="text-[10px] uppercase tracking-wider text-gray-600 mb-1">Payroll</p>
                  <p className="text-lg font-semibold text-white">{formatSalary(capSheet.totalPayroll)}</p>
                  <p className="text-[10px] text-gray-600">Cap: {formatSalary(capSheet.salaryCap)}</p>
                </GlassCard>
                <GlassCard className="p-4">
                  <p className="text-[10px] uppercase tracking-wider text-gray-600 mb-1">MLE Available</p>
                  <p className="text-lg font-semibold text-white">
                    {capSheet.midLevelException > 0 ? formatSalary(capSheet.midLevelException) : formatSalary(capSheet.taxpayerMLE)}
                  </p>
                  <p className="text-[10px] text-gray-600">
                    {capSheet.midLevelException > 0 ? 'Full MLE' : 'Taxpayer MLE'}
                  </p>
                </GlassCard>
                <GlassCard className="p-4">
                  <p className="text-[10px] uppercase tracking-wider text-gray-600 mb-1">Roster</p>
                  <p className={`text-lg font-semibold ${rosterCount >= 15 ? 'text-red-400' : 'text-white'}`}>
                    {rosterCount}/15
                  </p>
                </GlassCard>
              </div>
            )}

            {/* Advance Season Button */}
            {isFreeAgencyPhase && (
              <GlassCard className="p-4 mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-white">Ready to Continue?</h2>
                    <p className="text-gray-500 text-xs">
                      Sign free agents to fill your roster, then advance to the next season.
                    </p>
                  </div>
                  <button
                    onClick={handleAdvanceSeason}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-[oklch(64.6%_0.222_41.116)] text-white hover:brightness-110 transition-all"
                  >
                    Advance to Next Season
                  </button>
                </div>
              </GlassCard>
            )}

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-5">
              <SearchInput
                placeholder="Search free agents..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="sm:max-w-sm"
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

            {/* Free Agents Table */}
            <GlassCard className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      {sortableHeader('lastName', 'Player', 'left')}
                      <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider font-medium text-gray-600 text-center">Pos</th>
                      {sortableHeader('age', 'Age')}
                      {sortableHeader('overall', 'OVR')}
                      {sortableHeader('ppg', 'PPG')}
                      {sortableHeader('rpg', 'RPG')}
                      {sortableHeader('apg', 'APG')}
                      {sortableHeader('priorSalary', 'Prior Salary', 'right')}
                      {isFreeAgencyPhase && (
                        <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider font-medium text-gray-600 text-center w-24" />
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={isFreeAgencyPhase ? 9 : 8} className="text-center py-12 text-gray-500 text-sm">
                          No free agents match your filters
                        </td>
                      </tr>
                    ) : (
                      filtered.map(player => (
                        <tr key={player.id} className="group">
                          <td colSpan={isFreeAgencyPhase ? 9 : 8} className="p-0">
                            <div
                              className={`border-b border-white/[0.04] transition-colors ${
                                lastSigned === player.id ? 'bg-green-500/10' : 'hover:bg-white/[0.02]'
                              }`}
                            >
                              <div className="flex items-center">
                                <div className="flex-1 px-3 py-3 min-w-0">
                                  <Link
                                    to={`/league/${leagueId}/players/${player.id}`}
                                    className="text-white text-sm font-medium hover:text-[oklch(64.6%_0.222_41.116)] transition-colors"
                                  >
                                    {player.name}
                                  </Link>
                                </div>
                                <div className="w-12 text-center text-sm text-gray-400">{player.position}</div>
                                <div className="w-12 text-center text-sm text-gray-400">{player.age}</div>
                                <div className={`w-12 text-center text-sm ${ovrColor(player.overall)}`}>{player.overall}</div>
                                <div className="w-14 text-center text-sm text-gray-400">{player.ppg.toFixed(1)}</div>
                                <div className="w-14 text-center text-sm text-gray-400">{player.rpg.toFixed(1)}</div>
                                <div className="w-14 text-center text-sm text-gray-400">{player.apg.toFixed(1)}</div>
                                <div className="w-24 text-right text-sm text-gray-400 pr-3">{formatSalary(player.priorSalary)}</div>
                                {isFreeAgencyPhase && (
                                  <div className="w-24 text-center pr-3">
                                    {lastSigned === player.id ? (
                                      <span className="text-xs font-medium text-green-400">Signed!</span>
                                    ) : (
                                      <button
                                        onClick={() => setSigningPlayerId(
                                          signingPlayerId === player.id ? null : player.id
                                        )}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                          signingPlayerId === player.id
                                            ? 'bg-white/[0.1] text-white'
                                            : 'bg-[oklch(64.6%_0.222_41.116)]/10 text-[oklch(64.6%_0.222_41.116)] hover:bg-[oklch(64.6%_0.222_41.116)]/20'
                                        }`}
                                      >
                                        {signingPlayerId === player.id ? 'Close' : 'Sign'}
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>

                              {signingPlayerId === player.id && (
                                <div className="px-3 pb-3">
                                  <SigningPanel
                                    player={player}
                                    capSpace={capSheet.capSpace}
                                    onSign={(salary, years) => handleSign(player.id, salary, years)}
                                    onCancel={() => setSigningPlayerId(null)}
                                    signing={signing}
                                  />
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          </>
        )}
      </div>
    </PageTransition>
  )
}
