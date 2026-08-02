import { useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import PageTransition from '../../components/layout/PageTransition'
import GlassCard from '../../components/common/GlassCard'
import DataTable from '../../components/common/DataTable'
import Button from '../../components/common/Button'
import type { Position } from '../../types'

type FATab = 'available' | 'offers'
type WaveFilter = 'ALL' | 1 | 2 | 3 | 4
type PositionFilter = Position | 'ALL'
type FAStatus = 'Available' | 'Signed' | 'RFA'
type OfferStatus = 'Pending' | 'Accepted' | 'Declined'

interface FreeAgent {
  id: string
  name: string
  position: Position
  age: number
  overall: number
  ppg: number
  rpg: number
  apg: number
  priorSalary: number
  status: FAStatus
  wave: 1 | 2 | 3 | 4
  birdRights: boolean
  preferences: {
    money: number
    winning: number
    market: number
    role: number
  }
}

interface MyOffer {
  id: string
  playerId: string
  playerName: string
  overall: number
  years: number
  salary: number
  status: OfferStatus
}

const POSITION_FILTERS: PositionFilter[] = ['ALL', 'PG', 'SG', 'SF', 'PF', 'C']
const WAVE_FILTERS: { label: string; value: WaveFilter }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Wave 1 (Stars)', value: 1 },
  { label: 'Wave 2 (Starters)', value: 2 },
  { label: 'Wave 3 (Role Players)', value: 3 },
  { label: 'Wave 4 (Minimums)', value: 4 },
]

const SALARY_CAP = 141_000_000
const CURRENT_PAYROLL = 171_430_000

// --- Mock Data: ~25 Free Agents ---

const MOCK_FREE_AGENTS: FreeAgent[] = [
  // Wave 1 -- Stars
  { id: 'fa1', name: 'Damian Rhodes', position: 'PG', age: 29, overall: 92, ppg: 27.3, rpg: 4.2, apg: 9.8, priorSalary: 43500000, status: 'Available', wave: 1, birdRights: false, preferences: { money: 85, winning: 90, market: 60, role: 95 } },
  { id: 'fa2', name: 'Karl-Anthony Reed', position: 'C', age: 28, overall: 90, ppg: 22.8, rpg: 11.6, apg: 3.1, priorSalary: 38000000, status: 'Available', wave: 1, birdRights: true, preferences: { money: 90, winning: 70, market: 75, role: 80 } },
  { id: 'fa3', name: 'Jayson Williams', position: 'SF', age: 27, overall: 89, ppg: 24.1, rpg: 6.9, apg: 4.3, priorSalary: 36000000, status: 'Signed', wave: 1, birdRights: false, preferences: { money: 70, winning: 95, market: 50, role: 90 } },

  // Wave 2 -- Starters
  { id: 'fa4', name: 'Terrence Mann Jr.', position: 'SG', age: 26, overall: 83, ppg: 18.2, rpg: 4.5, apg: 3.8, priorSalary: 22000000, status: 'Available', wave: 2, birdRights: true, preferences: { money: 80, winning: 65, market: 70, role: 85 } },
  { id: 'fa5', name: 'Pascal Okafor', position: 'PF', age: 30, overall: 82, ppg: 16.7, rpg: 8.3, apg: 2.4, priorSalary: 24000000, status: 'Available', wave: 2, birdRights: false, preferences: { money: 75, winning: 80, market: 45, role: 70 } },
  { id: 'fa6', name: 'Jalen Suggs Jr.', position: 'PG', age: 25, overall: 81, ppg: 15.9, rpg: 3.1, apg: 7.2, priorSalary: 18000000, status: 'RFA', wave: 2, birdRights: true, preferences: { money: 60, winning: 85, market: 80, role: 90 } },
  { id: 'fa7', name: 'Marcus Smart II', position: 'SG', age: 28, overall: 80, ppg: 12.4, rpg: 3.8, apg: 5.1, priorSalary: 20000000, status: 'Available', wave: 2, birdRights: false, preferences: { money: 65, winning: 90, market: 40, role: 75 } },
  { id: 'fa8', name: 'Wendell Carter IV', position: 'C', age: 27, overall: 80, ppg: 13.8, rpg: 9.2, apg: 2.0, priorSalary: 19500000, status: 'Available', wave: 2, birdRights: true, preferences: { money: 85, winning: 55, market: 60, role: 65 } },

  // Wave 3 -- Role Players
  { id: 'fa9', name: 'Kentavious Pope', position: 'SG', age: 31, overall: 76, ppg: 10.2, rpg: 3.1, apg: 1.8, priorSalary: 12000000, status: 'Available', wave: 3, birdRights: false, preferences: { money: 70, winning: 85, market: 35, role: 50 } },
  { id: 'fa10', name: 'Larry Nance IV', position: 'PF', age: 29, overall: 75, ppg: 9.8, rpg: 7.1, apg: 2.3, priorSalary: 10500000, status: 'Available', wave: 3, birdRights: true, preferences: { money: 60, winning: 75, market: 30, role: 60 } },
  { id: 'fa11', name: 'Tyus Jones Jr.', position: 'PG', age: 30, overall: 74, ppg: 8.5, rpg: 2.4, apg: 6.1, priorSalary: 9000000, status: 'RFA', wave: 3, birdRights: false, preferences: { money: 55, winning: 70, market: 50, role: 80 } },
  { id: 'fa12', name: 'Bobby Portis III', position: 'C', age: 29, overall: 74, ppg: 11.3, rpg: 8.5, apg: 1.2, priorSalary: 11000000, status: 'Available', wave: 3, birdRights: false, preferences: { money: 80, winning: 50, market: 65, role: 55 } },
  { id: 'fa13', name: 'Dorian Finney Jr.', position: 'SF', age: 30, overall: 73, ppg: 7.9, rpg: 4.8, apg: 1.5, priorSalary: 8500000, status: 'Signed', wave: 3, birdRights: true, preferences: { money: 50, winning: 90, market: 25, role: 40 } },
  { id: 'fa14', name: 'Gary Trent IV', position: 'SG', age: 27, overall: 73, ppg: 12.1, rpg: 2.6, apg: 1.9, priorSalary: 9800000, status: 'Available', wave: 3, birdRights: false, preferences: { money: 75, winning: 60, market: 70, role: 65 } },
  { id: 'fa15', name: 'Jae Crowder Jr.', position: 'PF', age: 28, overall: 72, ppg: 8.4, rpg: 5.7, apg: 1.6, priorSalary: 7500000, status: 'Available', wave: 3, birdRights: false, preferences: { money: 55, winning: 80, market: 40, role: 50 } },
  { id: 'fa16', name: 'Ish Smith III', position: 'PG', age: 32, overall: 71, ppg: 6.8, rpg: 2.0, apg: 5.5, priorSalary: 6000000, status: 'Available', wave: 3, birdRights: true, preferences: { money: 40, winning: 90, market: 20, role: 35 } },

  // Wave 4 -- Minimums
  { id: 'fa17', name: 'Thanasis Giannis', position: 'SF', age: 33, overall: 68, ppg: 4.2, rpg: 3.1, apg: 0.8, priorSalary: 2900000, status: 'Available', wave: 4, birdRights: false, preferences: { money: 30, winning: 85, market: 15, role: 25 } },
  { id: 'fa18', name: 'Cody Martin Jr.', position: 'SG', age: 30, overall: 67, ppg: 5.1, rpg: 2.8, apg: 1.4, priorSalary: 3200000, status: 'Available', wave: 4, birdRights: false, preferences: { money: 40, winning: 70, market: 30, role: 35 } },
  { id: 'fa19', name: 'Robin Lopez III', position: 'C', age: 34, overall: 66, ppg: 4.8, rpg: 4.5, apg: 0.9, priorSalary: 2800000, status: 'Signed', wave: 4, birdRights: true, preferences: { money: 25, winning: 80, market: 10, role: 20 } },
  { id: 'fa20', name: 'Frank Mason IV', position: 'PG', age: 29, overall: 66, ppg: 5.5, rpg: 1.6, apg: 3.8, priorSalary: 2100000, status: 'Available', wave: 4, birdRights: false, preferences: { money: 50, winning: 60, market: 40, role: 55 } },
  { id: 'fa21', name: 'Dwight Powell Jr.', position: 'PF', age: 31, overall: 65, ppg: 5.9, rpg: 5.2, apg: 0.7, priorSalary: 3500000, status: 'Available', wave: 4, birdRights: false, preferences: { money: 35, winning: 75, market: 20, role: 30 } },
  { id: 'fa22', name: 'Tony Snell Jr.', position: 'SF', age: 30, overall: 64, ppg: 3.8, rpg: 1.9, apg: 0.6, priorSalary: 1900000, status: 'Available', wave: 4, birdRights: false, preferences: { money: 30, winning: 65, market: 15, role: 20 } },
  { id: 'fa23', name: 'Delon Wright Jr.', position: 'PG', age: 31, overall: 65, ppg: 4.9, rpg: 2.3, apg: 3.2, priorSalary: 2500000, status: 'RFA', wave: 4, birdRights: true, preferences: { money: 45, winning: 70, market: 25, role: 40 } },
  { id: 'fa24', name: 'Enes Freedom Jr.', position: 'C', age: 30, overall: 63, ppg: 6.2, rpg: 6.8, apg: 0.5, priorSalary: 2200000, status: 'Available', wave: 4, birdRights: false, preferences: { money: 55, winning: 50, market: 35, role: 45 } },
  { id: 'fa25', name: 'Garrison Mathews Jr.', position: 'SG', age: 28, overall: 64, ppg: 5.7, rpg: 1.8, apg: 0.9, priorSalary: 1800000, status: 'Available', wave: 4, birdRights: false, preferences: { money: 40, winning: 60, market: 30, role: 35 } },
]

const MOCK_OFFERS: MyOffer[] = [
  { id: 'o1', playerId: 'fa10', playerName: 'Larry Nance IV', overall: 75, years: 2, salary: 9000000, status: 'Pending' },
  { id: 'o2', playerId: 'fa9', playerName: 'Kentavious Pope', overall: 76, years: 1, salary: 5500000, status: 'Declined' },
  { id: 'o3', playerId: 'fa20', playerName: 'Frank Mason IV', overall: 66, years: 1, salary: 2100000, status: 'Accepted' },
]

function waveColor(wave: 1 | 2 | 3 | 4): string {
  if (wave === 1) return 'text-[oklch(64.6%_0.222_41.116)]'
  if (wave === 2) return 'text-green-400'
  if (wave === 3) return 'text-sky-400'
  return 'text-gray-400'
}

function waveBadge(wave: 1 | 2 | 3 | 4): string {
  if (wave === 1) return 'bg-[oklch(64.6%_0.222_41.116)]/15 text-[oklch(64.6%_0.222_41.116)] border-[oklch(64.6%_0.222_41.116)]/30'
  if (wave === 2) return 'bg-green-400/15 text-green-400 border-green-400/30'
  if (wave === 3) return 'bg-sky-400/15 text-sky-400 border-sky-400/30'
  return 'bg-gray-500/15 text-gray-500 border-gray-500/30'
}

function statusBadge(status: FAStatus): string {
  if (status === 'Available') return 'text-green-400'
  if (status === 'Signed') return 'text-gray-500'
  return 'text-yellow-500'
}

function offerStatusBadge(status: OfferStatus): string {
  if (status === 'Pending') return 'bg-yellow-500/15 text-yellow-500 border-yellow-500/30'
  if (status === 'Accepted') return 'bg-green-400/15 text-green-400 border-green-400/30'
  return 'bg-red-400/15 text-red-400 border-red-400/30'
}

function formatSalary(salary: number): string {
  return `$${(salary / 1_000_000).toFixed(1)}M`
}

export default function FreeAgencyPage() {
  const { id: leagueId } = useParams()
  const [activeTab, setActiveTab] = useState<FATab>('available')
  const [waveFilter, setWaveFilter] = useState<WaveFilter>('ALL')
  const [posFilter, setPosFilter] = useState<PositionFilter>('ALL')
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null)
  const [offerYears, setOfferYears] = useState<Record<string, number>>({})
  const [offerSalary, setOfferSalary] = useState<Record<string, string>>({})

  const capSpace = Math.max(0, SALARY_CAP - CURRENT_PAYROLL)

  const filtered = useMemo(() => {
    return MOCK_FREE_AGENTS.filter(p => {
      const matchesWave = waveFilter === 'ALL' || p.wave === waveFilter
      const matchesPos = posFilter === 'ALL' || p.position === posFilter
      return matchesWave && matchesPos
    })
  }, [waveFilter, posFilter])

  const columns: {
    key: string
    label: string
    sortable?: boolean
    align?: 'left' | 'center' | 'right'
    render?: (row: FreeAgent) => React.ReactNode
  }[] = [
    {
      key: 'name',
      label: 'Player',
      sortable: true,
      render: (row) => (
        <Link
          to={`/league/${leagueId}/players/${row.id}`}
          className={`font-medium ${waveColor(row.wave)} hover:text-[oklch(64.6%_0.222_41.116)] transition-colors`}
        >
          {row.name}
        </Link>
      ),
    },
    {
      key: 'position',
      label: 'Pos',
      align: 'center',
      render: (row) => <span className="text-gray-400">{row.position}</span>,
    },
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
      key: 'priorSalary',
      label: 'Prior Salary',
      sortable: true,
      align: 'right',
      render: (row) => <span className="text-gray-300">{formatSalary(row.priorSalary)}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      align: 'center',
      render: (row) => <span className={`text-xs font-medium ${statusBadge(row.status)}`}>{row.status}</span>,
    },
  ]

  const tabs: { id: FATab; label: string }[] = [
    { id: 'available', label: 'Available Players' },
    { id: 'offers', label: 'My Offers' },
  ]

  return (
    <PageTransition>
      <div>
        <h1 className="font-display text-4xl tracking-wide text-white mb-6">Free Agency</h1>

        {/* Tab Bar */}
        <div className="flex gap-1 mb-6 bg-white/[0.03] rounded-xl p-1 w-fit border border-white/[0.06]">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-[oklch(64.6%_0.222_41.116)]/15 text-[oklch(64.6%_0.222_41.116)]'
                  : 'text-gray-500 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* --- Tab 1: Available Players --- */}
        {activeTab === 'available' && (
          <div>
            {/* Wave + Position Filters */}
            <div className="flex flex-col gap-3 mb-5">
              <div className="flex gap-1 flex-wrap">
                {WAVE_FILTERS.map(w => (
                  <button
                    key={String(w.value)}
                    onClick={() => setWaveFilter(w.value)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      waveFilter === w.value
                        ? 'text-[oklch(64.6%_0.222_41.116)] bg-[oklch(64.6%_0.222_41.116)]/10'
                        : 'text-gray-500 hover:text-white hover:bg-white/[0.04]'
                    }`}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
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

            {/* Free Agent Table */}
            <DataTable
              columns={columns}
              data={filtered}
              keyExtractor={(row) => row.id}
              onRowClick={(row) => setExpandedPlayer(expandedPlayer === row.id ? null : row.id)}
              emptyMessage="No free agents match your filters"
            />

            {/* Expanded Player Detail */}
            {expandedPlayer && (() => {
              const player = MOCK_FREE_AGENTS.find(p => p.id === expandedPlayer)
              if (!player) return null
              const years = offerYears[player.id] ?? 1
              const salaryStr = offerSalary[player.id] ?? ''
              return (
                <GlassCard className="p-6 mt-4" variant="medium">
                  <div className="flex flex-col lg:flex-row gap-6">
                    {/* Left: Player Info + Preferences */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-4">
                        <Link
                          to={`/league/${leagueId}/players/${player.id}`}
                          className={`text-xl font-display tracking-wide ${waveColor(player.wave)} hover:text-[oklch(64.6%_0.222_41.116)] transition-colors`}
                        >
                          {player.name}
                        </Link>
                        <span className={`px-2 py-0.5 rounded text-xs border ${waveBadge(player.wave)}`}>
                          Wave {player.wave}
                        </span>
                      </div>
                      <div className="flex gap-4 text-sm text-gray-400 mb-5">
                        <span>{player.position}</span>
                        <span>{player.age} yrs</span>
                        <span>{player.overall} OVR</span>
                        <span>Prior: {formatSalary(player.priorSalary)}</span>
                      </div>

                      <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">Player Preferences</div>
                      <div className="space-y-2.5 mb-5">
                        {(
                          [
                            { label: 'Money', value: player.preferences.money },
                            { label: 'Winning', value: player.preferences.winning },
                            { label: 'Market', value: player.preferences.market },
                            { label: 'Role', value: player.preferences.role },
                          ] as const
                        ).map(pref => (
                          <div key={pref.label}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-gray-400">{pref.label}</span>
                              <span className="text-gray-500">{pref.value}</span>
                            </div>
                            <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full bg-[oklch(64.6%_0.222_41.116)]"
                                style={{ width: `${pref.value}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center gap-2 text-sm">
                        <div className="text-[10px] uppercase tracking-[2px] text-gray-600">Bird Rights</div>
                        <span className={`text-xs font-medium ${player.birdRights ? 'text-green-400' : 'text-gray-500'}`}>
                          {player.birdRights ? 'Yes' : 'No'}
                        </span>
                      </div>
                    </div>

                    {/* Right: Make Offer */}
                    <div className="lg:w-64">
                      <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">Make Offer</div>
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs text-gray-400 mb-1 block">Years</label>
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map(y => (
                              <button
                                key={y}
                                onClick={() => setOfferYears(prev => ({ ...prev, [player.id]: y }))}
                                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                                  years === y
                                    ? 'bg-[oklch(64.6%_0.222_41.116)]/15 text-[oklch(64.6%_0.222_41.116)] border border-[oklch(64.6%_0.222_41.116)]/30'
                                    : 'bg-white/[0.04] text-gray-500 border border-white/[0.06] hover:text-white'
                                }`}
                              >
                                {y}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-gray-400 mb-1 block">Annual Salary ($M)</label>
                          <input
                            type="text"
                            value={salaryStr}
                            onChange={(e) => setOfferSalary(prev => ({ ...prev, [player.id]: e.target.value }))}
                            placeholder="e.g. 12.5"
                            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-white/[0.15] transition-colors"
                          />
                        </div>
                        <Button
                          variant="primary"
                          size="sm"
                          className="w-full"
                          disabled={player.status !== 'Available' && player.status !== 'RFA'}
                        >
                          Submit Offer
                        </Button>
                        {player.status === 'Signed' && (
                          <p className="text-xs text-gray-600 text-center">This player has already signed</p>
                        )}
                      </div>
                    </div>
                  </div>
                </GlassCard>
              )
            })()}
          </div>
        )}

        {/* --- Tab 2: My Offers --- */}
        {activeTab === 'offers' && (
          <div>
            {/* Cap Space Banner */}
            <GlassCard className="p-5 mb-6" variant="medium">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-1">Cap Space Remaining</div>
                  <div className={`text-2xl font-semibold ${capSpace > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {capSpace > 0 ? formatSalary(capSpace) : `-${formatSalary(CURRENT_PAYROLL - SALARY_CAP)}`}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-1">Active Offers</div>
                  <div className="text-2xl font-semibold text-white">
                    {MOCK_OFFERS.filter(o => o.status === 'Pending').length}
                  </div>
                </div>
              </div>
            </GlassCard>

            {/* Offer Cards */}
            {MOCK_OFFERS.length === 0 ? (
              <GlassCard className="p-8">
                <p className="text-center text-gray-600">No offers made yet</p>
              </GlassCard>
            ) : (
              <div className="space-y-3">
                {MOCK_OFFERS.map(offer => (
                  <GlassCard key={offer.id} className="px-5 py-4">
                    <div className="flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <Link
                            to={`/league/${leagueId}/players/${offer.playerId}`}
                            className="text-white font-medium hover:text-[oklch(64.6%_0.222_41.116)] transition-colors"
                          >
                            {offer.playerName}
                          </Link>
                          <span className={`px-2 py-0.5 rounded text-xs border ${offerStatusBadge(offer.status)}`}>
                            {offer.status}
                          </span>
                        </div>
                        <div className="flex gap-4 text-xs text-gray-500">
                          <span>{offer.overall} OVR</span>
                          <span>{offer.years} yr{offer.years > 1 ? 's' : ''}</span>
                          <span>{formatSalary(offer.salary)}/yr</span>
                          <span>Total: {formatSalary(offer.salary * offer.years)}</span>
                        </div>
                      </div>
                      {offer.status === 'Pending' && (
                        <Button variant="danger" size="sm">
                          Withdraw
                        </Button>
                      )}
                    </div>
                  </GlassCard>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </PageTransition>
  )
}
