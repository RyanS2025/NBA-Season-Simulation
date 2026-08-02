import { useParams, Link } from 'react-router-dom'
import PageTransition from '../../components/layout/PageTransition'
import DataTable from '../../components/common/DataTable'
import GlassCard from '../../components/common/GlassCard'
import ProgressBar from '../../components/common/ProgressBar'
import { useLeague } from '../../hooks/useLeague'
import type { Player } from '../../types'

const SALARY_CAP = 141_000_000
const LUXURY_TAX = 171_000_000
const FIRST_APRON = 178_000_000
const MLE = 13_200_000
const BAE = 4_700_000
const TAXPAYER_MLE = 7_500_000

function formatSalary(salary: number): string {
  if (salary >= 1_000_000) return `$${(salary / 1_000_000).toFixed(1)}M`
  if (salary >= 1_000) return `$${(salary / 1_000).toFixed(0)}K`
  return `$${salary}`
}

function latestStats(player: Player) {
  const stats = player.careerStats
  if (!stats || stats.length === 0) return { ppg: 0, rpg: 0, apg: 0 }
  const last = stats[stats.length - 1]
  return { ppg: last.ppg, rpg: last.rpg, apg: last.apg }
}

interface RosterRow {
  id: string
  name: string
  position: string
  age: number
  overall: number
  ppg: number
  rpg: number
  apg: number
  salary: number
  contractYears: number
}

function playerToRow(p: Player): RosterRow {
  const { ppg, rpg, apg } = latestStats(p)
  return {
    id: p.id,
    name: `${p.bio.firstName} ${p.bio.lastName}`,
    position: p.bio.position,
    age: p.bio.age,
    overall: p.ratings.overall,
    ppg, rpg, apg,
    salary: p.contract?.annualSalary ?? 0,
    contractYears: p.contract?.yearsRemaining ?? 0,
  }
}

export default function MyTeamPage() {
  const { id: leagueId } = useParams()
  const { teams, players, state, loading } = useLeague()

  if (loading || !state) {
    return (
      <PageTransition>
        <div className="text-gray-400 text-center py-20">Loading team...</div>
      </PageTransition>
    )
  }

  const userTeam = teams.find(t => t.id === state.userTeamId)
  const teamPlayers = players
    .filter(p => p.teamId === state.userTeamId)
    .sort((a, b) => b.ratings.overall - a.ratings.overall)

  const roster = teamPlayers.map(playerToRow)

  const totalPayroll = roster.reduce((sum, p) => sum + p.salary, 0)
  const capSpace = Math.max(0, SALARY_CAP - totalPayroll)
  const isOverCap = totalPayroll > SALARY_CAP
  const isInTax = totalPayroll > LUXURY_TAX

  const r = userTeam?.seasonRecord
  const wins = r?.wins ?? 0
  const losses = r?.losses ?? 0

  const confTeams = teams
    .filter(t => t.info.conference === userTeam?.info.conference)
    .sort((a, b) => b.seasonRecord.wins - a.seasonRecord.wins)
  const confSeed = confTeams.findIndex(t => t.id === state.userTeamId) + 1

  const rosterColumns: {
    key: string
    label: string
    sortable?: boolean
    align?: 'left' | 'center' | 'right'
    render?: (row: RosterRow) => React.ReactNode
  }[] = [
    {
      key: 'name',
      label: 'Player',
      sortable: true,
      render: (row) => (
        <Link
          to={`/league/${leagueId}/players/${row.id}`}
          className="text-white font-medium hover:text-[oklch(64.6%_0.222_41.116)] transition-colors"
        >
          {row.name}
        </Link>
      ),
    },
    { key: 'position', label: 'Pos', align: 'center' },
    { key: 'age', label: 'Age', sortable: true, align: 'center' },
    {
      key: 'overall',
      label: 'OVR',
      sortable: true,
      align: 'center',
      render: (row) => (
        <span className={row.overall >= 90 ? 'text-[oklch(64.6%_0.222_41.116)] font-semibold' : row.overall >= 80 ? 'text-green-400' : 'text-gray-300'}>
          {row.overall}
        </span>
      ),
    },
    { key: 'ppg', label: 'PPG', sortable: true, align: 'center' },
    { key: 'rpg', label: 'RPG', sortable: true, align: 'center' },
    { key: 'apg', label: 'APG', sortable: true, align: 'center' },
    {
      key: 'salary',
      label: 'Salary',
      sortable: true,
      align: 'right',
      render: (row) => <span className="text-gray-300">{formatSalary(row.salary)}</span>,
    },
    {
      key: 'contractYears',
      label: 'Yrs',
      align: 'center',
      render: (row) => <span className={row.contractYears <= 1 ? 'text-yellow-500' : 'text-gray-400'}>{row.contractYears}</span>,
    },
  ]

  return (
    <PageTransition>
      <div>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-6 gap-4">
          <div>
            <h1 className="font-display text-4xl tracking-wide text-white">
              {userTeam ? `${userTeam.info.city} ` : ''}
              <span className="text-[oklch(64.6%_0.222_41.116)]">{userTeam?.info.name}</span>
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              {userTeam?.info.conference} Conference — {userTeam?.info.division} Division
            </p>
          </div>
          <div className="flex gap-6">
            <div className="text-center">
              <div className="text-2xl font-semibold text-white">{wins} — {losses}</div>
              <div className="text-[10px] uppercase tracking-[2px] text-gray-600">Record</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-semibold text-[oklch(64.6%_0.222_41.116)]">
                {confSeed > 0 ? `${confSeed}${ordSuffix(confSeed)}` : '—'}
              </div>
              <div className="text-[10px] uppercase tracking-[2px] text-gray-600">
                {userTeam?.info.conference?.slice(0, 4)} Seed
              </div>
            </div>
          </div>
        </div>

        <h2 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">Roster ({roster.length} players)</h2>
        <DataTable
          columns={rosterColumns}
          data={roster}
          keyExtractor={(row) => row.id}
          className="mb-8"
        />

        <h2 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">Cap Sheet</h2>
        <GlassCard className="p-6 mb-8">
          <div className="space-y-5">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">Total Payroll</span>
                <span className="text-white font-medium">{formatSalary(totalPayroll)}</span>
              </div>
              <div className="relative">
                <ProgressBar
                  value={totalPayroll}
                  max={FIRST_APRON}
                  color={isInTax ? '#ef4444' : isOverCap ? '#f59e0b' : 'oklch(64.6% 0.222 41.116)'}
                  height="h-3"
                />
                <div
                  className="absolute top-0 h-3 w-px bg-white/60"
                  style={{ left: `${(SALARY_CAP / FIRST_APRON) * 100}%` }}
                  title="Salary Cap"
                />
                <div
                  className="absolute top-0 h-3 w-px bg-red-400/60"
                  style={{ left: `${(LUXURY_TAX / FIRST_APRON) * 100}%` }}
                  title="Luxury Tax"
                />
              </div>
              <div className="flex justify-between text-[10px] uppercase tracking-[2px] text-gray-600 mt-2">
                <span>Cap: {formatSalary(SALARY_CAP)}</span>
                <span className="text-red-400/70">Tax: {formatSalary(LUXURY_TAX)}</span>
                <span>Apron: {formatSalary(FIRST_APRON)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white/[0.03] rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-1">Cap Space</div>
                <div className={`text-lg font-semibold ${capSpace > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {capSpace > 0 ? formatSalary(capSpace) : `-${formatSalary(totalPayroll - SALARY_CAP)}`}
                </div>
              </div>
              <div className="bg-white/[0.03] rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-1">Tax Status</div>
                <div className={`text-lg font-semibold ${isInTax ? 'text-red-400' : 'text-green-400'}`}>
                  {isInTax ? 'In Tax' : 'Below Tax'}
                </div>
              </div>
              <div className="bg-white/[0.03] rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-1">Roster Spots</div>
                <div className="text-lg font-semibold text-white">{roster.length}/15</div>
              </div>
              <div className="bg-white/[0.03] rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-1">Avg Age</div>
                <div className="text-lg font-semibold text-white">
                  {roster.length > 0 ? (roster.reduce((s, p) => s + p.age, 0) / roster.length).toFixed(1) : '—'}
                </div>
              </div>
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-2">Available Exceptions</div>
              <div className="space-y-2">
                {[
                  { name: 'Mid-Level Exception (MLE)', amount: MLE, available: !isInTax },
                  { name: 'Taxpayer MLE', amount: TAXPAYER_MLE, available: isInTax },
                  { name: 'Bi-Annual Exception (BAE)', amount: BAE, available: !isInTax },
                ].map(exc => (
                  <div key={exc.name} className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${exc.available ? 'bg-white/[0.02]' : 'bg-white/[0.01] opacity-40'}`}>
                    <span className="text-gray-300">{exc.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">{formatSalary(exc.amount)}</span>
                      <span className={`text-[10px] uppercase tracking-wider ${exc.available ? 'text-green-400' : 'text-gray-600'}`}>
                        {exc.available ? 'Available' : 'Unavailable'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </GlassCard>

        <h2 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">Depth Chart</h2>
        <GlassCard className="p-6">
          <div className="space-y-4">
            {(['PG', 'SG', 'SF', 'PF', 'C'] as const).map(pos => {
              const posPlayers = teamPlayers
                .filter(p => p.bio.position === pos || p.bio.secondaryPosition === pos)
                .sort((a, b) => b.ratings.overall - a.ratings.overall)
                .slice(0, 3)

              return (
                <div key={pos} className="flex items-start gap-4">
                  <div className="w-10 text-center pt-2">
                    <span className="text-[10px] uppercase tracking-[2px] text-gray-600 font-medium">{pos}</span>
                  </div>
                  <div className="flex-1 flex gap-2 flex-wrap">
                    {posPlayers.map((p, i) => (
                      <Link
                        key={p.id}
                        to={`/league/${leagueId}/players/${p.id}`}
                        className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                          i === 0
                            ? 'bg-[oklch(64.6%_0.222_41.116)]/10 border border-[oklch(64.6%_0.222_41.116)]/30 text-white hover:bg-[oklch(64.6%_0.222_41.116)]/20'
                            : 'bg-white/[0.03] border border-white/[0.06] text-gray-300 hover:bg-white/[0.06]'
                        }`}
                      >
                        <span className="font-medium">{p.bio.firstName.charAt(0)}. {p.bio.lastName}</span>
                        <span className={`ml-2 text-xs ${p.ratings.overall >= 85 ? 'text-[oklch(64.6%_0.222_41.116)]' : 'text-gray-500'}`}>
                          {p.ratings.overall}
                        </span>
                      </Link>
                    ))}
                    {posPlayers.length === 0 && (
                      <span className="text-gray-600 text-sm italic py-2">No players</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </GlassCard>
      </div>
    </PageTransition>
  )
}

function ordSuffix(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return 'th'
  switch (n % 10) {
    case 1: return 'st'
    case 2: return 'nd'
    case 3: return 'rd'
    default: return 'th'
  }
}
