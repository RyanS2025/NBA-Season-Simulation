import { useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import PageTransition from '../../components/layout/PageTransition'
import GlassCard from '../../components/common/GlassCard'
import DataTable from '../../components/common/DataTable'
import SearchInput from '../../components/common/SearchInput'
import { useLeague } from '../../hooks/useLeague'
import type { Position } from '../../types'

type PositionFilter = Position | 'ALL'

const POSITION_FILTERS: PositionFilter[] = ['ALL', 'PG', 'SG', 'SF', 'PF', 'C']

interface ProspectRow {
  id: string
  rank: number
  name: string
  position: string
  age: number
  school: string
  projRange: string
  ceiling: number
  floor: number
  scoutingLevel: number
}

const PROSPECTS: ProspectRow[] = [
  { id: 'd1', rank: 1, name: 'Jalen Crawford', position: 'PG', age: 19, school: 'Duke', projRange: '82-88', ceiling: 95, floor: 78, scoutingLevel: 3 },
  { id: 'd2', rank: 2, name: 'Marcus Webb', position: 'PF', age: 20, school: 'Kentucky', projRange: '80-86', ceiling: 93, floor: 76, scoutingLevel: 2 },
  { id: 'd3', rank: 3, name: 'Tobias Adebayo', position: 'C', age: 19, school: 'Overtime Elite', projRange: '79-85', ceiling: 92, floor: 74, scoutingLevel: 2 },
  { id: 'd4', rank: 4, name: 'Nikolai Petrovic', position: 'SG', age: 20, school: 'Partizan Belgrade', projRange: '78-84', ceiling: 91, floor: 73, scoutingLevel: 1 },
  { id: 'd5', rank: 5, name: 'Devin Okafor', position: 'SF', age: 20, school: 'North Carolina', projRange: '73-78', ceiling: 86, floor: 70, scoutingLevel: 3 },
  { id: 'd6', rank: 6, name: 'Jaylen Watkins', position: 'PG', age: 19, school: 'Gonzaga', projRange: '72-77', ceiling: 85, floor: 68, scoutingLevel: 2 },
  { id: 'd7', rank: 7, name: 'Andre Baptiste', position: 'PF', age: 21, school: 'Villanova', projRange: '71-76', ceiling: 84, floor: 69, scoutingLevel: 1 },
  { id: 'd8', rank: 8, name: 'Karl-Anthony Reed', position: 'C', age: 19, school: 'Michigan', projRange: '70-76', ceiling: 87, floor: 67, scoutingLevel: 2 },
  { id: 'd9', rank: 9, name: 'Zion Palmer', position: 'PF', age: 20, school: 'UCLA', projRange: '70-75', ceiling: 83, floor: 68, scoutingLevel: 1 },
  { id: 'd10', rank: 10, name: 'Damian Rhodes', position: 'SG', age: 21, school: 'Houston', projRange: '69-74', ceiling: 82, floor: 67, scoutingLevel: 2 },
  { id: 'd11', rank: 11, name: 'Santiago Reyes', position: 'SF', age: 19, school: 'Real Madrid', projRange: '68-74', ceiling: 84, floor: 65, scoutingLevel: 1 },
  { id: 'd12', rank: 12, name: 'Isaiah Thompson', position: 'PG', age: 20, school: 'Auburn', projRange: '68-73', ceiling: 80, floor: 66, scoutingLevel: 2 },
  { id: 'd13', rank: 13, name: 'Cam Boozer', position: 'PF', age: 19, school: 'Duke', projRange: '67-73', ceiling: 82, floor: 64, scoutingLevel: 1 },
  { id: 'd14', rank: 14, name: 'Tre Williams', position: 'SG', age: 21, school: 'Arizona', projRange: '67-72', ceiling: 79, floor: 65, scoutingLevel: 1 },
  { id: 'd15', rank: 15, name: 'Brandon Park', position: 'SF', age: 20, school: 'Kansas', projRange: '66-72', ceiling: 81, floor: 63, scoutingLevel: 1 },
]

export default function DraftPage() {
  const { id: leagueId } = useParams()
  const { state, teams, loading } = useLeague()
  const [search, setSearch] = useState('')
  const [posFilter, setPosFilter] = useState<PositionFilter>('ALL')

  const filtered = useMemo(() =>
    PROSPECTS.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase())
      const matchesPos = posFilter === 'ALL' || p.position === posFilter
      return matchesSearch && matchesPos
    }),
  [search, posFilter])

  if (loading || !state) {
    return (
      <PageTransition>
        <div className="text-gray-400 text-center py-20">Loading draft center...</div>
      </PageTransition>
    )
  }

  const userTeam = teams.find(t => t.id === state.userTeamId)

  const columns: {
    key: string
    label: string
    sortable?: boolean
    align?: 'left' | 'center' | 'right'
    render?: (row: ProspectRow) => React.ReactNode
  }[] = [
    {
      key: 'rank',
      label: '#',
      align: 'center',
      render: (row) => <span className="text-gray-500">{row.rank}</span>,
    },
    {
      key: 'name',
      label: 'Prospect',
      sortable: true,
      render: (row) => (
        <div>
          <span className="text-white font-medium">{row.name}</span>
          <span className="text-gray-500 text-xs ml-2">{row.school}</span>
        </div>
      ),
    },
    { key: 'position', label: 'Pos', align: 'center' },
    { key: 'age', label: 'Age', sortable: true, align: 'center' },
    {
      key: 'projRange',
      label: 'Proj OVR',
      align: 'center',
      render: (row) => <span className="text-gray-300">{row.projRange}</span>,
    },
    {
      key: 'ceiling',
      label: 'Ceiling',
      sortable: true,
      align: 'center',
      render: (row) => (
        <span className={row.ceiling >= 90 ? 'text-[oklch(64.6%_0.222_41.116)] font-semibold' : row.ceiling >= 85 ? 'text-green-400' : 'text-gray-300'}>
          {row.ceiling}
        </span>
      ),
    },
    {
      key: 'floor',
      label: 'Floor',
      sortable: true,
      align: 'center',
      render: (row) => (
        <span className={row.floor >= 75 ? 'text-green-400' : row.floor >= 65 ? 'text-gray-300' : 'text-red-400'}>
          {row.floor}
        </span>
      ),
    },
    {
      key: 'scoutingLevel',
      label: 'Scouted',
      align: 'center',
      render: (row) => (
        <div className="flex gap-0.5 justify-center">
          {[1, 2, 3].map(level => (
            <div
              key={level}
              className={`w-2 h-2 rounded-full ${
                level <= row.scoutingLevel ? 'bg-[oklch(64.6%_0.222_41.116)]' : 'bg-white/[0.08]'
              }`}
            />
          ))}
        </div>
      ),
    },
  ]

  return (
    <PageTransition>
      <div>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-6 gap-4">
          <div>
            <h1 className="font-display text-4xl tracking-wide text-white">Draft Center</h1>
            <p className="text-gray-500 text-sm mt-1">2027 NBA Draft — Scouting Board</p>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-1">Your Team</div>
            <div className="text-white text-sm font-medium">
              {userTeam ? `${userTeam.info.city} ${userTeam.info.name}` : state.userTeamId}
            </div>
          </div>
        </div>

        <GlassCard className="p-5 mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
            <h2 className="text-sm font-semibold text-white">Draft Status</h2>
          </div>
          <p className="text-gray-400 text-sm">
            The 2027 NBA Draft will take place after the season. Continue scouting prospects below.
            Draft order will be determined by the draft lottery for non-playoff teams.
          </p>
        </GlassCard>

        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <SearchInput
            placeholder="Search prospects..."
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
          emptyMessage="No prospects match your filters"
        />
      </div>
    </PageTransition>
  )
}
