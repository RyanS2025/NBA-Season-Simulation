import { useState } from 'react'
import { useParams } from 'react-router-dom'
import PageTransition from '../../components/layout/PageTransition'
import DataTable from '../../components/common/DataTable'
import SearchInput from '../../components/common/SearchInput'
import type { Position } from '../../types'

interface PlayerRow {
  id: string
  name: string
  team: string
  position: Position
  age: number
  overall: number
  ppg: number
  rpg: number
  apg: number
  salary: number
}

const MOCK_PLAYERS: PlayerRow[] = [
  { id: 'p1', name: 'Marcus Cole', team: 'PHI', position: 'PG', age: 27, overall: 93, ppg: 28.4, rpg: 5.1, apg: 9.2, salary: 42500000 },
  { id: 'p2', name: 'DeAndre Washington', team: 'PHI', position: 'SG', age: 25, overall: 87, ppg: 22.1, rpg: 4.8, apg: 3.5, salary: 32000000 },
  { id: 'p3', name: 'Jaylen Foster', team: 'PHI', position: 'SF', age: 24, overall: 84, ppg: 18.7, rpg: 6.3, apg: 2.9, salary: 28000000 },
  { id: 'p4', name: 'Tobias Green', team: 'PHI', position: 'PF', age: 30, overall: 82, ppg: 16.5, rpg: 8.2, apg: 2.1, salary: 25000000 },
  { id: 'p5', name: 'Andre Drummond Jr.', team: 'PHI', position: 'C', age: 26, overall: 85, ppg: 14.2, rpg: 11.4, apg: 1.8, salary: 22000000 },
  { id: 'p6', name: 'Jordan Mitchell', team: 'NYT', position: 'PG', age: 28, overall: 95, ppg: 31.2, rpg: 5.8, apg: 10.1, salary: 48000000 },
  { id: 'p7', name: 'Kevin Bridges', team: 'NYT', position: 'SF', age: 26, overall: 89, ppg: 24.3, rpg: 7.1, apg: 4.2, salary: 36000000 },
  { id: 'p8', name: 'Malik Thompson', team: 'BOS', position: 'SG', age: 25, overall: 91, ppg: 26.8, rpg: 4.5, apg: 5.3, salary: 38000000 },
  { id: 'p9', name: 'Chris Patterson', team: 'BOS', position: 'PF', age: 29, overall: 86, ppg: 19.4, rpg: 9.1, apg: 3.8, salary: 30000000 },
  { id: 'p10', name: 'Dante Williams', team: 'MIA', position: 'PG', age: 23, overall: 88, ppg: 23.6, rpg: 3.9, apg: 8.7, salary: 12200000 },
  { id: 'p11', name: 'Tyler Brooks', team: 'MIA', position: 'C', age: 27, overall: 84, ppg: 15.8, rpg: 10.9, apg: 1.5, salary: 20000000 },
  { id: 'p12', name: 'Jason Rivera', team: 'CHI', position: 'SF', age: 26, overall: 86, ppg: 20.1, rpg: 6.8, apg: 3.4, salary: 27000000 },
  { id: 'p13', name: 'Omar Hussain', team: 'LAV', position: 'PG', age: 24, overall: 94, ppg: 29.5, rpg: 4.6, apg: 11.2, salary: 44000000 },
  { id: 'p14', name: 'Brandon Park', team: 'LAV', position: 'PF', age: 28, overall: 90, ppg: 22.7, rpg: 9.8, apg: 3.1, salary: 35000000 },
  { id: 'p15', name: 'Luis Gutierrez', team: 'PHX', position: 'SG', age: 25, overall: 88, ppg: 25.1, rpg: 3.7, apg: 4.9, salary: 33000000 },
  { id: 'p16', name: 'Terrence Young', team: 'DEN', position: 'C', age: 27, overall: 89, ppg: 18.9, rpg: 12.3, apg: 3.6, salary: 34000000 },
  { id: 'p17', name: 'Ryan Hayes', team: 'DAL', position: 'PG', age: 30, overall: 87, ppg: 21.3, rpg: 4.2, apg: 8.9, salary: 31000000 },
  { id: 'p18', name: 'Isaiah Knox', team: 'GSS', position: 'SF', age: 22, overall: 83, ppg: 17.8, rpg: 5.5, apg: 2.7, salary: 9770000 },
  { id: 'p19', name: 'Cameron Drake', team: 'CLE', position: 'SG', age: 26, overall: 85, ppg: 21.9, rpg: 4.1, apg: 3.8, salary: 26000000 },
  { id: 'p20', name: 'Nathan Pierce', team: 'MIN', position: 'PF', age: 24, overall: 86, ppg: 19.6, rpg: 8.7, apg: 2.3, salary: 28500000 },
  { id: 'p21', name: 'Xavier Bell', team: 'PHI', position: 'SG', age: 28, overall: 78, ppg: 12.4, rpg: 3.2, apg: 2.8, salary: 14000000 },
  { id: 'p22', name: 'Jerome Watson', team: 'PHI', position: 'PF', age: 32, overall: 76, ppg: 9.8, rpg: 6.5, apg: 1.4, salary: 8000000 },
  { id: 'p23', name: 'Corey James', team: 'PHI', position: 'C', age: 23, overall: 73, ppg: 7.2, rpg: 5.8, apg: 0.9, salary: 4890000 },
  { id: 'p24', name: 'Miles Porter', team: 'PHI', position: 'PG', age: 30, overall: 75, ppg: 8.5, rpg: 2.1, apg: 5.4, salary: 6000000 },
]

const POSITION_FILTERS: (Position | 'ALL')[] = ['ALL', 'PG', 'SG', 'SF', 'PF', 'C']

function formatSalary(salary: number): string {
  return `$${(salary / 1_000_000).toFixed(1)}M`
}

export default function PlayersPage() {
  const { id: _leagueId } = useParams()
  const [search, setSearch] = useState('')
  const [posFilter, setPosFilter] = useState<Position | 'ALL'>('ALL')

  const filtered = MOCK_PLAYERS.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.team.toLowerCase().includes(search.toLowerCase())
    const matchesPos = posFilter === 'ALL' || p.position === posFilter
    return matchesSearch && matchesPos
  })

  const columns: {
    key: string
    label: string
    sortable?: boolean
    align?: 'left' | 'center' | 'right'
    render?: (row: PlayerRow) => React.ReactNode
  }[] = [
    {
      key: 'name',
      label: 'Player',
      sortable: true,
      render: (row) => <span className="text-white font-medium">{row.name}</span>,
    },
    { key: 'team', label: 'Team', sortable: true, align: 'center' },
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

  return (
    <PageTransition>
      <div>
        <h1 className="font-display text-4xl tracking-wide text-white mb-6">Player Database</h1>

        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <SearchInput
            placeholder="Search players or teams..."
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
        />
      </div>
    </PageTransition>
  )
}
