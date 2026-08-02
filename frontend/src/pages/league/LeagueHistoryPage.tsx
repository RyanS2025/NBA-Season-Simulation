import { useState } from 'react'
import { useParams } from 'react-router-dom'
import PageTransition from '../../components/layout/PageTransition'
import GlassCard from '../../components/common/GlassCard'
import DataTable from '../../components/common/DataTable'

type Season = '2024-25' | '2023-24'

interface Champion {
  team: string
  record: string
  seriesResult: string
  opponent: string
  finalsMvp: { name: string; statLine: string }
}

interface AwardWinner {
  award: string
  name: string
  team: string
}

interface StatLeader {
  id: string
  rank: number
  name: string
  team: string
  value: number
}

interface HofInductee {
  name: string
  career: string
  highlights: string
}

interface SeasonData {
  champion: Champion
  awards: AwardWinner[]
  statLeaders: {
    ppg: StatLeader[]
    rpg: StatLeader[]
    apg: StatLeader[]
    spg: StatLeader[]
    bpg: StatLeader[]
  }
  hallOfFame: HofInductee[]
}

const SEASON_DATA: Record<Season, SeasonData> = {
  '2024-25': {
    champion: {
      team: 'Chicago Storm',
      record: '58-24',
      seriesResult: '4-2',
      opponent: 'Denver Altitude',
      finalsMvp: { name: 'Damian Rhodes', statLine: '31.4 PPG / 6.2 RPG / 9.8 APG' },
    },
    awards: [
      { award: 'MVP', name: 'Damian Rhodes', team: 'CHI' },
      { award: 'DPOY', name: 'Tobias Adebayo', team: 'MIA' },
      { award: 'ROY', name: 'Jalen Crawford', team: 'MIN' },
      { award: '6MOY', name: 'Gary Trent IV', team: 'PHI' },
      { award: 'MIP', name: 'Darnell Brooks', team: 'DAL' },
      { award: 'COTY', name: 'Marcus Thompson', team: 'CHI' },
      { award: 'Clutch', name: 'Nikolai Petrovic', team: 'DAL' },
      { award: 'EOTY', name: 'Rachel Kim', team: 'MIN' },
    ],
    statLeaders: {
      ppg: [
        { id: 'pp1', rank: 1, name: 'Damian Rhodes', team: 'CHI', value: 28.4 },
        { id: 'pp2', rank: 2, name: 'Jayson Williams', team: 'BOS', value: 26.8 },
        { id: 'pp3', rank: 3, name: 'Karl-Anthony Reed', team: 'MIL', value: 25.1 },
        { id: 'pp4', rank: 4, name: 'Marcus Webb', team: 'PHI', value: 24.2 },
        { id: 'pp5', rank: 5, name: 'Nikolai Petrovic', team: 'DAL', value: 23.9 },
      ],
      rpg: [
        { id: 'rp1', rank: 1, name: 'Karl-Anthony Reed', team: 'MIL', value: 12.4 },
        { id: 'rp2', rank: 2, name: 'Tobias Adebayo', team: 'MIA', value: 12.1 },
        { id: 'rp3', rank: 3, name: 'Tyrell Jackson', team: 'ATL', value: 11.2 },
        { id: 'rp4', rank: 4, name: 'Wendell Carter IV', team: 'MIL', value: 10.2 },
        { id: 'rp5', rank: 5, name: 'Pascal Okafor', team: 'TOR', value: 9.4 },
      ],
      apg: [
        { id: 'ap1', rank: 1, name: 'Damian Rhodes', team: 'CHI', value: 10.2 },
        { id: 'ap2', rank: 2, name: 'Santiago Reyes', team: 'CLE', value: 9.1 },
        { id: 'ap3', rank: 3, name: 'Jaylen Watkins', team: 'DEN', value: 8.4 },
        { id: 'ap4', rank: 4, name: 'Jalen Suggs Jr.', team: 'GSW', value: 7.6 },
        { id: 'ap5', rank: 5, name: 'Jalen Crawford', team: 'MIN', value: 7.1 },
      ],
      spg: [
        { id: 'sp1', rank: 1, name: 'Devin Okafor', team: 'CLE', value: 1.9 },
        { id: 'sp2', rank: 2, name: 'Marcus Smart II', team: 'BOS', value: 1.8 },
        { id: 'sp3', rank: 3, name: 'Kentavious Pope', team: 'PHX', value: 1.6 },
        { id: 'sp4', rank: 4, name: 'Zion Palmer', team: 'GSW', value: 1.6 },
        { id: 'sp5', rank: 5, name: 'Santiago Reyes', team: 'CLE', value: 1.4 },
      ],
      bpg: [
        { id: 'bp1', rank: 1, name: 'Tobias Adebayo', team: 'MIA', value: 2.8 },
        { id: 'bp2', rank: 2, name: 'Tyrell Jackson', team: 'ATL', value: 2.4 },
        { id: 'bp3', rank: 3, name: 'Karl-Anthony Reed', team: 'MIL', value: 2.2 },
        { id: 'bp4', rank: 4, name: 'Zion Palmer', team: 'GSW', value: 2.1 },
        { id: 'bp5', rank: 5, name: 'Andre Baptiste', team: 'DEN', value: 1.8 },
      ],
    },
    hallOfFame: [
      { name: 'Terrence Davis Sr.', career: '18 seasons (2006-2024)', highlights: '5x All-Star, 2x Champion, 22,450 career points' },
      { name: 'Marcus Aldridge', career: '16 seasons (2008-2024)', highlights: '7x All-Star, 3x All-NBA, 19,800 career points' },
    ],
  },
  '2023-24': {
    champion: {
      team: 'Denver Altitude',
      record: '55-27',
      seriesResult: '4-3',
      opponent: 'Boston Ballers',
      finalsMvp: { name: 'Jaylen Watkins', statLine: '27.8 PPG / 4.1 RPG / 8.6 APG' },
    },
    awards: [
      { award: 'MVP', name: 'Karl-Anthony Reed', team: 'MIL' },
      { award: 'DPOY', name: 'Zion Palmer', team: 'GSW' },
      { award: 'ROY', name: 'Darnell Brooks', team: 'DAL' },
      { award: '6MOY', name: 'Jaylen Morris', team: 'PHX' },
      { award: 'MIP', name: 'Santiago Reyes', team: 'CLE' },
      { award: 'COTY', name: 'David Park', team: 'MIN' },
      { award: 'Clutch', name: 'Damian Rhodes', team: 'CHI' },
      { award: 'EOTY', name: 'Michael Torres', team: 'MIA' },
    ],
    statLeaders: {
      ppg: [
        { id: 'pp1b', rank: 1, name: 'Karl-Anthony Reed', team: 'MIL', value: 27.2 },
        { id: 'pp2b', rank: 2, name: 'Damian Rhodes', team: 'CHI', value: 26.1 },
        { id: 'pp3b', rank: 3, name: 'Jayson Williams', team: 'BOS', value: 25.4 },
        { id: 'pp4b', rank: 4, name: 'Nikolai Petrovic', team: 'DAL', value: 22.8 },
        { id: 'pp5b', rank: 5, name: 'Marcus Webb', team: 'PHI', value: 22.1 },
      ],
      rpg: [
        { id: 'rp1b', rank: 1, name: 'Karl-Anthony Reed', team: 'MIL', value: 13.1 },
        { id: 'rp2b', rank: 2, name: 'Tobias Adebayo', team: 'MIA', value: 11.8 },
        { id: 'rp3b', rank: 3, name: 'Tyrell Jackson', team: 'ATL', value: 10.9 },
        { id: 'rp4b', rank: 4, name: 'Pascal Okafor', team: 'TOR', value: 10.2 },
        { id: 'rp5b', rank: 5, name: 'Andre Baptiste', team: 'DEN', value: 9.8 },
      ],
      apg: [
        { id: 'ap1b', rank: 1, name: 'Damian Rhodes', team: 'CHI', value: 9.6 },
        { id: 'ap2b', rank: 2, name: 'Jaylen Watkins', team: 'DEN', value: 8.8 },
        { id: 'ap3b', rank: 3, name: 'Santiago Reyes', team: 'CLE', value: 7.9 },
        { id: 'ap4b', rank: 4, name: 'Jalen Suggs Jr.', team: 'GSW', value: 7.4 },
        { id: 'ap5b', rank: 5, name: 'Marcus Smart II', team: 'BOS', value: 6.2 },
      ],
      spg: [
        { id: 'sp1b', rank: 1, name: 'Devin Okafor', team: 'CLE', value: 2.1 },
        { id: 'sp2b', rank: 2, name: 'Marcus Smart II', team: 'BOS', value: 1.9 },
        { id: 'sp3b', rank: 3, name: 'Zion Palmer', team: 'GSW', value: 1.7 },
        { id: 'sp4b', rank: 4, name: 'Santiago Reyes', team: 'CLE', value: 1.5 },
        { id: 'sp5b', rank: 5, name: 'Kentavious Pope', team: 'PHX', value: 1.4 },
      ],
      bpg: [
        { id: 'bp1b', rank: 1, name: 'Zion Palmer', team: 'GSW', value: 2.6 },
        { id: 'bp2b', rank: 2, name: 'Tobias Adebayo', team: 'MIA', value: 2.4 },
        { id: 'bp3b', rank: 3, name: 'Karl-Anthony Reed', team: 'MIL', value: 2.0 },
        { id: 'bp4b', rank: 4, name: 'Andre Baptiste', team: 'DEN', value: 1.9 },
        { id: 'bp5b', rank: 5, name: 'Tyrell Jackson', team: 'ATL', value: 1.8 },
      ],
    },
    hallOfFame: [
      { name: 'Jason Mitchell', career: '20 seasons (2004-2024)', highlights: '10x All-Star, 3x Champion, Finals MVP, 28,100 career points' },
      { name: 'Andre Wallace', career: '15 seasons (2009-2024)', highlights: '4x All-Star, 2x DPOY, 9,400 career rebounds' },
      { name: 'Coach Bill Henderson', career: '30 seasons (1994-2024)', highlights: '2x Champion, 3x COTY, 1,200+ career wins' },
    ],
  },
}

const SEASONS: Season[] = ['2024-25', '2023-24']

const STAT_CATEGORIES = [
  { key: 'ppg' as const, label: 'Points Per Game' },
  { key: 'rpg' as const, label: 'Rebounds Per Game' },
  { key: 'apg' as const, label: 'Assists Per Game' },
  { key: 'spg' as const, label: 'Steals Per Game' },
  { key: 'bpg' as const, label: 'Blocks Per Game' },
]

export default function LeagueHistoryPage() {
  const { id: _leagueId } = useParams()
  const [selectedSeason, setSelectedSeason] = useState<Season>('2024-25')
  const [expandedStat, setExpandedStat] = useState<string | null>('ppg')

  const data = SEASON_DATA[selectedSeason]

  const leaderColumns: {
    key: string
    label: string
    sortable?: boolean
    align?: 'left' | 'center' | 'right'
    render?: (row: StatLeader) => React.ReactNode
  }[] = [
    {
      key: 'rank',
      label: '#',
      align: 'center',
      render: (row) => <span className="text-gray-500">{row.rank}</span>,
    },
    {
      key: 'name',
      label: 'Player',
      render: (row) => <span className="text-white font-medium">{row.name}</span>,
    },
    {
      key: 'team',
      label: 'Team',
      align: 'center',
      render: (row) => <span className="text-gray-400">{row.team}</span>,
    },
    {
      key: 'value',
      label: 'Stat',
      sortable: true,
      align: 'right',
      render: (row) => (
        <span className={row.rank === 1 ? 'text-[oklch(64.6%_0.222_41.116)] font-semibold' : 'text-gray-300'}>
          {row.value.toFixed(1)}
        </span>
      ),
    },
  ]

  return (
    <PageTransition>
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h1 className="font-display text-4xl tracking-wide text-white">League History</h1>

          {/* Season Selector */}
          <div className="relative">
            <select
              value={selectedSeason}
              onChange={(e) => setSelectedSeason(e.target.value as Season)}
              className="appearance-none bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-2 pr-8 text-sm text-white outline-none focus:border-white/[0.15] transition-colors cursor-pointer"
            >
              {SEASONS.map(s => (
                <option key={s} value={s} className="bg-slate-900 text-white">{s} Season</option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500 text-xs">
              &#9662;
            </div>
          </div>
        </div>

        {/* Champions Section */}
        <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">Champions</div>
        <GlassCard className="mb-8 overflow-hidden" variant="medium">
          {/* Gold champion border */}
          <div className="h-0.5 bg-gradient-to-r from-amber-500/60 via-yellow-400/80 to-amber-500/60" />
          <div className="p-6">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <span className="text-amber-400 text-2xl">&#9733;</span>
                </div>
                <div>
                  <div className="text-2xl font-display tracking-wide text-white">{data.champion.team}</div>
                  <div className="text-sm text-gray-400">{data.champion.record} ({selectedSeason})</div>
                </div>
              </div>
              <div className="md:ml-auto flex flex-col sm:flex-row gap-6">
                <div>
                  <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-1">Finals Result</div>
                  <div className="text-white font-medium">
                    {data.champion.seriesResult} vs {data.champion.opponent}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-1">Finals MVP</div>
                  <div className="text-amber-400 font-medium">{data.champion.finalsMvp.name}</div>
                  <div className="text-xs text-gray-500">{data.champion.finalsMvp.statLine}</div>
                </div>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Award Winners Section */}
        <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">Award Winners</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-8">
          {data.awards.map(a => (
            <GlassCard key={a.award} className="p-4">
              <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-2">{a.award}</div>
              <div className="text-sm font-medium text-white">{a.name}</div>
              <div className="text-xs text-gray-500 mt-0.5">{a.team}</div>
            </GlassCard>
          ))}
        </div>

        {/* Stat Leaders Section */}
        <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">Stat Leaders</div>
        <div className="mb-8">
          {/* Category Pills */}
          <div className="flex gap-1 flex-wrap mb-4">
            {STAT_CATEGORIES.map(cat => (
              <button
                key={cat.key}
                onClick={() => setExpandedStat(expandedStat === cat.key ? null : cat.key)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  expandedStat === cat.key
                    ? 'text-[oklch(64.6%_0.222_41.116)] bg-[oklch(64.6%_0.222_41.116)]/10'
                    : 'text-gray-500 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                {cat.key.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Leaders Table */}
          {expandedStat && (() => {
            const cat = STAT_CATEGORIES.find(c => c.key === expandedStat)
            if (!cat) return null
            const leaders = data.statLeaders[cat.key]
            return (
              <div>
                <div className="text-xs text-gray-500 mb-2">{cat.label}</div>
                <DataTable
                  columns={leaderColumns}
                  data={leaders}
                  keyExtractor={(row) => row.id}
                  emptyMessage="No stat leaders available"
                />
              </div>
            )
          })()}
        </div>

        {/* Hall of Fame Section */}
        <div className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">Hall of Fame Inductees</div>
        <div className="space-y-3">
          {data.hallOfFame.map(inductee => (
            <GlassCard key={inductee.name} className="p-5" variant="medium">
              <div className="flex items-start gap-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 shrink-0 mt-0.5">
                  <span className="text-amber-400 text-lg">&#9733;</span>
                </div>
                <div>
                  <div className="text-lg font-display tracking-wide text-white">{inductee.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{inductee.career}</div>
                  <div className="text-sm text-gray-400 mt-1">{inductee.highlights}</div>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>
    </PageTransition>
  )
}
