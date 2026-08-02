import { useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import PageTransition from '../../components/layout/PageTransition'
import DataTable from '../../components/common/DataTable'
import SearchInput from '../../components/common/SearchInput'
import { useLeague } from '../../hooks/useLeague'
import type { Player, Position } from '../../types'

interface PlayerRow {
  id: string
  name: string
  lastName: string
  teamAbbr: string
  teamName: string
  position: Position
  age: number
  overall: number
  ppg: number
  rpg: number
  apg: number
  salary: number
  headshotUrl: string
}

const POSITION_FILTERS: (Position | 'ALL')[] = ['ALL', 'PG', 'SG', 'SF', 'PF', 'C']

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

export default function PlayersPage() {
  const { id: leagueId } = useParams()
  const { players, teams, loading } = useLeague()
  const [search, setSearch] = useState('')
  const [posFilter, setPosFilter] = useState<Position | 'ALL'>('ALL')

  const teamMap = useMemo(() => {
    const map = new Map<string, { abbr: string; name: string }>()
    for (const t of teams) {
      map.set(t.id, { abbr: t.id, name: `${t.info.city} ${t.info.name}` })
    }
    return map
  }, [teams])

  const rows: PlayerRow[] = useMemo(() =>
    players.map(p => {
      const { ppg, rpg, apg } = latestStats(p)
      const team = teamMap.get(p.teamId)
      return {
        id: p.id,
        name: `${p.bio.firstName} ${p.bio.lastName}`,
        lastName: p.bio.lastName,
        teamAbbr: team?.abbr ?? '—',
        teamName: team?.name ?? 'Free Agent',
        position: p.bio.position,
        age: p.bio.age,
        overall: p.ratings.overall,
        ppg, rpg, apg,
        salary: p.contract?.annualSalary ?? 0,
        headshotUrl: p.headshotUrl,
      }
    }),
  [players, teamMap])

  const filtered = useMemo(() =>
    rows.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase())
      const matchesPos = posFilter === 'ALL' || p.position === posFilter
      return matchesSearch && matchesPos
    }),
  [rows, search, posFilter])

  const columns: {
    key: string
    label: string
    sortable?: boolean
    sortKey?: string
    align?: 'left' | 'center' | 'right'
    render?: (row: PlayerRow) => React.ReactNode
  }[] = [
    {
      key: 'name',
      label: 'Player',
      sortable: true,
      sortKey: 'lastName',
      render: (row) => (
        <Link
          to={`/league/${leagueId}/players/${row.id}`}
          className="flex items-center gap-2 text-white font-medium hover:text-[oklch(64.6%_0.222_41.116)] transition-colors"
        >
          <img
            src={row.headshotUrl}
            alt=""
            className="w-8 h-8 rounded-full object-cover bg-slate-800"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
          {row.name}
        </Link>
      ),
    },
    {
      key: 'teamAbbr',
      label: 'Team',
      align: 'center',
      sortable: true,
      render: (row) => <span className="text-gray-400 text-xs font-mono">{row.teamAbbr}</span>,
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
      key: 'salary',
      label: 'Salary',
      sortable: true,
      align: 'right',
      render: (row) => <span className="text-gray-300">{formatSalary(row.salary)}</span>,
    },
  ]

  if (loading) {
    return (
      <PageTransition>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-400 text-sm">Loading players...</div>
        </div>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <div>
        <h1 className="font-display text-4xl tracking-wide text-white mb-1">Player Database</h1>
        <p className="text-gray-500 text-sm mb-6">{players.length} players across 30 teams</p>

        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <SearchInput
            placeholder="Search players..."
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
          emptyMessage="No players found"
          defaultSortKey="overall"
          defaultSortAsc={false}
        />
      </div>
    </PageTransition>
  )
}
