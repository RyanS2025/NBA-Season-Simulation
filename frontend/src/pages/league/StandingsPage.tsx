import PageTransition from '../../components/layout/PageTransition'
import DataTable from '../../components/common/DataTable'
import { useLeague } from '../../hooks/useLeague'
import type { Team } from '../../types'

interface TeamStanding {
  seed: number
  teamId: string
  team: string
  w: number
  l: number
  pct: string
  gb: string
  home: string
  away: string
  streak: string
  conf: string
  isUser: boolean
}

function buildStandings(teams: Team[], conference: string, userTeamId: string): TeamStanding[] {
  const confTeams = teams.filter(t => t.info.conference === conference)

  const sorted = [...confTeams].sort((a, b) => {
    const winsA = a.seasonRecord.wins
    const winsB = b.seasonRecord.wins
    if (winsB !== winsA) return winsB - winsA
    const gamesA = winsA + a.seasonRecord.losses
    const gamesB = winsB + b.seasonRecord.losses
    const pctA = gamesA > 0 ? winsA / gamesA : 0
    const pctB = gamesB > 0 ? winsB / gamesB : 0
    if (pctB !== pctA) return pctB - pctA
    const diffA = a.seasonRecord.pointsFor - a.seasonRecord.pointsAgainst
    const diffB = b.seasonRecord.pointsFor - b.seasonRecord.pointsAgainst
    return diffB - diffA
  })

  const leader = sorted[0]
  const leaderWins = leader?.seasonRecord.wins ?? 0
  const leaderLosses = leader?.seasonRecord.losses ?? 0

  return sorted.map((t, i) => {
    const w = t.seasonRecord.wins
    const l = t.seasonRecord.losses
    const games = w + l
    const pct = games > 0 ? (w / games).toFixed(3) : '.000'
    const gbNum = ((leaderWins - w) + (l - leaderLosses)) / 2
    const gb = i === 0 ? '—' : gbNum === 0 ? '—' : gbNum.toFixed(1)
    const streak = t.seasonRecord.streak
    const streakStr = streak > 0 ? `W${streak}` : streak < 0 ? `L${Math.abs(streak)}` : '—'

    return {
      seed: i + 1,
      teamId: t.id,
      team: `${t.info.city} ${t.info.name}`,
      w,
      l,
      pct: pct.startsWith('0') ? pct.slice(1) : pct,
      gb,
      home: `${t.seasonRecord.homeWins}-${t.seasonRecord.homeLosses}`,
      away: `${t.seasonRecord.awayWins}-${t.seasonRecord.awayLosses}`,
      streak: streakStr,
      conf: `${t.seasonRecord.conferenceWins}-${t.seasonRecord.conferenceLosses}`,
      isUser: t.id === userTeamId,
    }
  })
}

const columns = (_userTeamId: string): {
  key: string
  label: string
  sortable?: boolean
  align?: 'left' | 'center' | 'right'
  render?: (row: TeamStanding, index: number) => React.ReactNode
}[] => [
  { key: 'seed', label: '#', align: 'center', render: (row) => <span className="text-gray-500">{row.seed}</span> },
  { key: 'team', label: 'Team', render: (row) => <span className={row.isUser ? 'text-accent font-semibold' : 'text-white'}>{row.team}</span> },
  { key: 'w', label: 'W', align: 'center', sortable: true },
  { key: 'l', label: 'L', align: 'center', sortable: true },
  { key: 'pct', label: 'PCT', align: 'center', sortable: true },
  { key: 'gb', label: 'GB', align: 'center' },
  { key: 'home', label: 'Home', align: 'center' },
  { key: 'away', label: 'Away', align: 'center' },
  { key: 'streak', label: 'Strk', align: 'center' },
  { key: 'conf', label: 'Conf', align: 'center' },
]

function PlayoffBracket({ standings, conference }: { standings: TeamStanding[]; conference: string }) {
  const top10 = standings.slice(0, 10)
  return (
    <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-5">
      <h3 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-4">{conference} Playoff Picture</h3>
      <div className="space-y-1">
        {top10.map((t, i) => (
          <div key={t.teamId}>
            <div className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${t.isUser ? 'bg-accent/10 border border-accent/20' : 'hover:bg-white/[0.02]'}`}>
              <div className="flex items-center gap-3">
                <span className="text-gray-500 w-5 text-center text-xs">{i + 1}</span>
                <span className={t.isUser ? 'text-accent' : 'text-white'}>{t.team}</span>
              </div>
              <span className="text-gray-400 text-xs">{t.w}-{t.l}</span>
            </div>
            {i === 5 && <div className="border-t border-dashed border-white/[0.12] my-2" />}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 text-[10px] text-gray-600">
        <span className="w-2 h-px bg-white/20 inline-block" />
        <span>Seeds 7-10: Play-In Tournament</span>
      </div>
    </div>
  )
}

export default function StandingsPage() {
  const { teams, state, loading } = useLeague()

  if (loading || !state) {
    return (
      <PageTransition>
        <div className="text-gray-400 text-center py-20">Loading standings...</div>
      </PageTransition>
    )
  }

  const userTeamId = state.userTeamId
  const east = buildStandings(teams, 'Eastern', userTeamId)
  const west = buildStandings(teams, 'Western', userTeamId)
  const cols = columns(userTeamId)

  return (
    <PageTransition>
      <div>
        <h1 className="font-display text-4xl tracking-wide text-white mb-6">Standings</h1>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div>
            <h2 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">Eastern Conference</h2>
            <DataTable columns={cols} data={east} keyExtractor={(row) => row.teamId} />
          </div>
          <div>
            <h2 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">Western Conference</h2>
            <DataTable columns={cols} data={west} keyExtractor={(row) => row.teamId} />
          </div>
        </div>
        <h2 className="font-display text-2xl tracking-wide text-white mb-4">Playoff Picture</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PlayoffBracket standings={east} conference="Eastern" />
          <PlayoffBracket standings={west} conference="Western" />
        </div>
      </div>
    </PageTransition>
  )
}
