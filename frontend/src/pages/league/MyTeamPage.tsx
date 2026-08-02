import { useParams } from 'react-router-dom'
import PageTransition from '../../components/layout/PageTransition'
import DataTable from '../../components/common/DataTable'
import GlassCard from '../../components/common/GlassCard'
import ProgressBar from '../../components/common/ProgressBar'

interface RosterPlayer {
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

interface DraftPick {
  year: number
  round: 1 | 2
  originalTeam: string
  via: string | null
}

const MOCK_ROSTER: RosterPlayer[] = [
  { id: 'p1', name: 'Marcus Cole', position: 'PG', age: 27, overall: 93, ppg: 28.4, rpg: 5.1, apg: 9.2, salary: 42500000, contractYears: 3 },
  { id: 'p2', name: 'DeAndre Washington', position: 'SG', age: 25, overall: 87, ppg: 22.1, rpg: 4.8, apg: 3.5, salary: 32000000, contractYears: 4 },
  { id: 'p3', name: 'Jaylen Foster', position: 'SF', age: 24, overall: 84, ppg: 18.7, rpg: 6.3, apg: 2.9, salary: 28000000, contractYears: 3 },
  { id: 'p4', name: 'Tobias Green', position: 'PF', age: 30, overall: 82, ppg: 16.5, rpg: 8.2, apg: 2.1, salary: 25000000, contractYears: 2 },
  { id: 'p5', name: 'Andre Drummond Jr.', position: 'C', age: 26, overall: 85, ppg: 14.2, rpg: 11.4, apg: 1.8, salary: 22000000, contractYears: 3 },
  { id: 'p21', name: 'Xavier Bell', position: 'SG', age: 28, overall: 78, ppg: 12.4, rpg: 3.2, apg: 2.8, salary: 14000000, contractYears: 2 },
  { id: 'p22', name: 'Jerome Watson', position: 'PF', age: 32, overall: 76, ppg: 9.8, rpg: 6.5, apg: 1.4, salary: 8000000, contractYears: 1 },
  { id: 'p23', name: 'Corey James', position: 'C', age: 23, overall: 73, ppg: 7.2, rpg: 5.8, apg: 0.9, salary: 4890000, contractYears: 3 },
  { id: 'p24', name: 'Miles Porter', position: 'PG', age: 30, overall: 75, ppg: 8.5, rpg: 2.1, apg: 5.4, salary: 6000000, contractYears: 1 },
  { id: 'p25', name: 'Travis Hart', position: 'SF', age: 22, overall: 71, ppg: 6.1, rpg: 3.4, apg: 1.2, salary: 3240000, contractYears: 2 },
  { id: 'p26', name: 'Ricky Owens', position: 'PG', age: 24, overall: 70, ppg: 5.3, rpg: 1.8, apg: 4.1, salary: 2100000, contractYears: 2 },
  { id: 'p27', name: 'Derek Lane', position: 'PF', age: 26, overall: 72, ppg: 6.8, rpg: 5.2, apg: 0.8, salary: 3800000, contractYears: 1 },
  { id: 'p28', name: 'Sam Adebayo', position: 'C', age: 21, overall: 68, ppg: 4.1, rpg: 4.6, apg: 0.5, salary: 1900000, contractYears: 3 },
]

const MOCK_PICKS: DraftPick[] = [
  { year: 2026, round: 1, originalTeam: 'PHI', via: null },
  { year: 2026, round: 2, originalTeam: 'PHI', via: null },
  { year: 2026, round: 2, originalTeam: 'ORL', via: 'ORL' },
  { year: 2027, round: 1, originalTeam: 'PHI', via: null },
  { year: 2027, round: 2, originalTeam: 'PHI', via: null },
  { year: 2028, round: 1, originalTeam: 'PHI', via: null },
  { year: 2028, round: 2, originalTeam: 'PHI', via: null },
]

const SALARY_CAP = 141_000_000
const LUXURY_TAX = 171_000_000
const FIRST_APRON = 178_000_000
const MLE = 13_200_000
const BAE = 4_700_000
const TAXPAYER_MLE = 7_500_000

function formatSalary(salary: number): string {
  return `$${(salary / 1_000_000).toFixed(1)}M`
}

export default function MyTeamPage() {
  const { id: _leagueId } = useParams()

  const totalPayroll = MOCK_ROSTER.reduce((sum, p) => sum + p.salary, 0)
  const capSpace = Math.max(0, SALARY_CAP - totalPayroll)
  const isOverCap = totalPayroll > SALARY_CAP
  const isInTax = totalPayroll > LUXURY_TAX

  const rosterColumns: {
    key: string
    label: string
    sortable?: boolean
    align?: 'left' | 'center' | 'right'
    render?: (row: RosterPlayer) => React.ReactNode
  }[] = [
    {
      key: 'name',
      label: 'Player',
      sortable: true,
      render: (row) => <span className="text-white font-medium">{row.name}</span>,
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
        {/* Team Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-6 gap-4">
          <div>
            <h1 className="font-display text-4xl tracking-wide text-white">
              Philadelphia <span className="text-[oklch(64.6%_0.222_41.116)]">Ironworks</span>
            </h1>
            <p className="text-gray-500 text-sm mt-1">Eastern Conference -- Atlantic Division</p>
          </div>
          <div className="flex gap-6">
            <div className="text-center">
              <div className="text-2xl font-semibold text-white">44 — 26</div>
              <div className="text-[10px] uppercase tracking-[2px] text-gray-600">Record</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-semibold text-[oklch(64.6%_0.222_41.116)]">4th</div>
              <div className="text-[10px] uppercase tracking-[2px] text-gray-600">East Seed</div>
            </div>
          </div>
        </div>

        {/* Roster */}
        <h2 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">Roster</h2>
        <DataTable
          columns={rosterColumns}
          data={MOCK_ROSTER}
          keyExtractor={(row) => row.id}
          className="mb-8"
        />

        {/* Cap Sheet */}
        <h2 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">Cap Sheet</h2>
        <GlassCard className="p-6 mb-8">
          <div className="space-y-5">
            {/* Payroll Bar */}
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
                {/* Cap line marker */}
                <div
                  className="absolute top-0 h-3 w-px bg-white/60"
                  style={{ left: `${(SALARY_CAP / FIRST_APRON) * 100}%` }}
                  title="Salary Cap"
                />
                {/* Tax line marker */}
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

            {/* Cap Info Grid */}
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
                <div className="text-lg font-semibold text-white">{MOCK_ROSTER.length}/15</div>
              </div>
              <div className="bg-white/[0.03] rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-1">Avg Age</div>
                <div className="text-lg font-semibold text-white">
                  {(MOCK_ROSTER.reduce((s, p) => s + p.age, 0) / MOCK_ROSTER.length).toFixed(1)}
                </div>
              </div>
            </div>

            {/* Exceptions */}
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

        {/* Draft Picks */}
        <h2 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">Draft Picks</h2>
        <GlassCard className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {MOCK_PICKS.map((pick, i) => (
              <div
                key={`${pick.year}-${pick.round}-${i}`}
                className="flex items-center justify-between px-4 py-3 rounded-lg bg-white/[0.02] border border-white/[0.04]"
              >
                <div>
                  <span className="text-white font-medium">{pick.year}</span>
                  <span className="text-gray-500 mx-2">--</span>
                  <span className="text-gray-300">Round {pick.round}</span>
                </div>
                <span className="text-[10px] uppercase tracking-wider text-gray-500">
                  {pick.via ? `via ${pick.via}` : 'Own'}
                </span>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </PageTransition>
  )
}
