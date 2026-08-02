import { useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import PageTransition from '../../components/layout/PageTransition'
import GlassCard from '../../components/common/GlassCard'
import DataTable from '../../components/common/DataTable'
import SearchInput from '../../components/common/SearchInput'
import { useLeague } from '../../hooks/useLeague'
import type { Player, Position } from '../../types'

type PositionFilter = Position | 'ALL'

const POSITION_FILTERS: PositionFilter[] = ['ALL', 'PG', 'SG', 'SF', 'PF', 'C']

interface FARow {
  id: string
  name: string
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

export default function FreeAgencyPage() {
  const { id: leagueId } = useParams()
  const { players, state, loading } = useLeague()
  const [search, setSearch] = useState('')
  const [posFilter, setPosFilter] = useState<PositionFilter>('ALL')

  const freeAgents: FARow[] = useMemo(() =>
    players
      .filter(p => p.status.isFreeAgent || !p.teamId)
      .map(p => {
        const { ppg, rpg, apg } = latestStats(p)
        return {
          id: p.id,
          name: `${p.bio.firstName} ${p.bio.lastName}`,
          lastName: p.bio.lastName,
          position: p.bio.position,
          age: p.bio.age,
          overall: p.ratings.overall,
          ppg, rpg, apg,
          priorSalary: p.contract?.annualSalary ?? 0,
        }
      })
      .sort((a, b) => b.overall - a.overall),
  [players])

  const filtered = useMemo(() =>
    freeAgents.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase())
      const matchesPos = posFilter === 'ALL' || p.position === posFilter
      return matchesSearch && matchesPos
    }),
  [freeAgents, search, posFilter])

  if (loading || !state) {
    return (
      <PageTransition>
        <div className="text-gray-400 text-center py-20">Loading free agency...</div>
      </PageTransition>
    )
  }

  const columns: {
    key: string
    label: string
    sortable?: boolean
    sortKey?: string
    align?: 'left' | 'center' | 'right'
    render?: (row: FARow) => React.ReactNode
  }[] = [
    {
      key: 'name',
      label: 'Player',
      sortable: true,
      sortKey: 'lastName',
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
        <span className={row.overall >= 85 ? 'text-[oklch(64.6%_0.222_41.116)] font-semibold' : row.overall >= 75 ? 'text-green-400' : 'text-gray-300'}>
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
  ]

  const isRegularSeason = state.currentPhase === 'regular_season' || state.currentPhase === 'preseason'

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

            <DataTable
              columns={columns}
              data={filtered}
              keyExtractor={(row) => row.id}
              emptyMessage="No free agents match your filters"
              defaultSortKey="overall"
              defaultSortAsc={false}
            />
          </>
        )}
      </div>
    </PageTransition>
  )
}
