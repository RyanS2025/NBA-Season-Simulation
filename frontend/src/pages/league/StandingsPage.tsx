import PageTransition from '../../components/layout/PageTransition'
import DataTable from '../../components/common/DataTable'

interface TeamStanding {
  seed: number
  team: string
  w: number
  l: number
  pct: string
  gb: string
  home: string
  away: string
  streak: string
  l10: string
  isUser?: boolean
}

const eastTeams: TeamStanding[] = [
  { seed: 1, team: 'New York Titans', w: 52, l: 18, pct: '.743', gb: '—', home: '29-6', away: '23-12', streak: 'W5', l10: '8-2' },
  { seed: 2, team: 'Boston Ballers', w: 49, l: 21, pct: '.700', gb: '3.0', home: '27-8', away: '22-13', streak: 'W2', l10: '7-3' },
  { seed: 3, team: 'Miami Aces', w: 46, l: 24, pct: '.657', gb: '6.0', home: '25-10', away: '21-14', streak: 'L1', l10: '6-4' },
  { seed: 4, team: 'Philly Force', w: 44, l: 26, pct: '.629', gb: '8.0', home: '26-9', away: '18-17', streak: 'W3', l10: '7-3', isUser: true },
  { seed: 5, team: 'Chicago Storm', w: 42, l: 28, pct: '.600', gb: '10.0', home: '24-11', away: '18-17', streak: 'L2', l10: '5-5' },
  { seed: 6, team: 'Toronto Raptors', w: 40, l: 30, pct: '.571', gb: '12.0', home: '23-12', away: '17-18', streak: 'W1', l10: '6-4' },
  { seed: 7, team: 'Atlanta Hawks', w: 38, l: 32, pct: '.543', gb: '14.0', home: '22-13', away: '16-19', streak: 'L3', l10: '4-6' },
  { seed: 8, team: 'Cleveland Kings', w: 36, l: 34, pct: '.514', gb: '16.0', home: '21-14', away: '15-20', streak: 'W1', l10: '5-5' },
  { seed: 9, team: 'Detroit Pistons', w: 34, l: 36, pct: '.486', gb: '18.0', home: '20-15', away: '14-21', streak: 'L1', l10: '4-6' },
  { seed: 10, team: 'Indiana Wolves', w: 33, l: 37, pct: '.471', gb: '19.0', home: '19-16', away: '14-21', streak: 'W2', l10: '5-5' },
  { seed: 11, team: 'Charlotte Buzz', w: 30, l: 40, pct: '.429', gb: '22.0', home: '18-17', away: '12-23', streak: 'L4', l10: '3-7' },
  { seed: 12, team: 'Orlando Stars', w: 27, l: 43, pct: '.386', gb: '25.0', home: '16-19', away: '11-24', streak: 'L1', l10: '4-6' },
  { seed: 13, team: 'Washington Generals', w: 24, l: 46, pct: '.343', gb: '28.0', home: '15-20', away: '9-26', streak: 'W1', l10: '3-7' },
  { seed: 14, team: 'Brooklyn Nets', w: 20, l: 50, pct: '.286', gb: '32.0', home: '13-22', away: '7-28', streak: 'L5', l10: '2-8' },
  { seed: 15, team: 'Milwaukee Bucks', w: 17, l: 53, pct: '.243', gb: '35.0', home: '11-24', away: '6-29', streak: 'L2', l10: '2-8' },
]

const westTeams: TeamStanding[] = [
  { seed: 1, team: 'LA Vipers', w: 54, l: 16, pct: '.771', gb: '—', home: '30-5', away: '24-11', streak: 'W8', l10: '9-1' },
  { seed: 2, team: 'Phoenix Flames', w: 50, l: 20, pct: '.714', gb: '4.0', home: '28-7', away: '22-13', streak: 'W3', l10: '7-3' },
  { seed: 3, team: 'Denver Altitude', w: 48, l: 22, pct: '.686', gb: '6.0', home: '27-8', away: '21-14', streak: 'W1', l10: '6-4' },
  { seed: 4, team: 'Dallas Mavericks', w: 45, l: 25, pct: '.643', gb: '9.0', home: '25-10', away: '20-15', streak: 'L1', l10: '6-4' },
  { seed: 5, team: 'Golden State Warriors', w: 43, l: 27, pct: '.614', gb: '11.0', home: '24-11', away: '19-16', streak: 'W2', l10: '7-3' },
  { seed: 6, team: 'Sacramento Kings', w: 41, l: 29, pct: '.586', gb: '13.0', home: '23-12', away: '18-17', streak: 'L2', l10: '5-5' },
  { seed: 7, team: 'Portland Trail Blazers', w: 39, l: 31, pct: '.557', gb: '15.0', home: '22-13', away: '17-18', streak: 'W1', l10: '5-5' },
  { seed: 8, team: 'Minnesota Timberwolves', w: 37, l: 33, pct: '.529', gb: '17.0', home: '21-14', away: '16-19', streak: 'L1', l10: '4-6' },
  { seed: 9, team: 'OKC Thunder', w: 35, l: 35, pct: '.500', gb: '19.0', home: '20-15', away: '15-20', streak: 'W3', l10: '6-4' },
  { seed: 10, team: 'Utah Jazz', w: 34, l: 36, pct: '.486', gb: '20.0', home: '19-16', away: '15-20', streak: 'L3', l10: '4-6' },
  { seed: 11, team: 'New Orleans Pelicans', w: 31, l: 39, pct: '.443', gb: '23.0', home: '18-17', away: '13-22', streak: 'L1', l10: '3-7' },
  { seed: 12, team: 'San Antonio Spurs', w: 28, l: 42, pct: '.400', gb: '26.0', home: '17-18', away: '11-24', streak: 'W1', l10: '4-6' },
  { seed: 13, team: 'Houston Rockets', w: 25, l: 45, pct: '.357', gb: '29.0', home: '15-20', away: '10-25', streak: 'L2', l10: '3-7' },
  { seed: 14, team: 'Memphis Grizzlies', w: 21, l: 49, pct: '.300', gb: '33.0', home: '13-22', away: '8-27', streak: 'L4', l10: '2-8' },
  { seed: 15, team: 'LA Clippers', w: 18, l: 52, pct: '.257', gb: '36.0', home: '12-23', away: '6-29', streak: 'L1', l10: '3-7' },
]

const columns = (userTeam: string): {
  key: string
  label: string
  sortable?: boolean
  align?: 'left' | 'center' | 'right'
  render?: (row: TeamStanding, index: number) => React.ReactNode
}[] => [
  { key: 'seed', label: '#', align: 'center', width: '40px', render: (row) => <span className="text-gray-500">{row.seed}</span> },
  { key: 'team', label: 'Team', render: (row) => <span className={row.team === userTeam ? 'text-[oklch(64.6%_0.222_41.116)] font-semibold' : 'text-white'}>{row.team}</span> },
  { key: 'w', label: 'W', align: 'center', sortable: true },
  { key: 'l', label: 'L', align: 'center', sortable: true },
  { key: 'pct', label: 'PCT', align: 'center', sortable: true },
  { key: 'gb', label: 'GB', align: 'center' },
  { key: 'home', label: 'Home', align: 'center' },
  { key: 'away', label: 'Away', align: 'center' },
  { key: 'streak', label: 'Strk', align: 'center' },
  { key: 'l10', label: 'L10', align: 'center' },
]

function PlayoffBracket({ teams, conference }: { teams: TeamStanding[]; conference: string }) {
  const top10 = teams.slice(0, 10)
  return (
    <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-5">
      <h3 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-4">{conference} Playoff Picture</h3>
      <div className="space-y-1">
        {top10.map((t, i) => (
          <div key={t.team}>
            <div className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${t.isUser ? 'bg-[oklch(64.6%_0.222_41.116)]/10 border border-[oklch(64.6%_0.222_41.116)]/20' : 'hover:bg-white/[0.02]'}`}>
              <div className="flex items-center gap-3">
                <span className="text-gray-500 w-5 text-center text-xs">{i + 1}</span>
                <span className={t.isUser ? 'text-[oklch(64.6%_0.222_41.116)]' : 'text-white'}>{t.team}</span>
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
  const userTeam = 'Philly Force'
  const cols = columns(userTeam)

  return (
    <PageTransition>
      <div>
        <h1 className="font-display text-4xl tracking-wide text-white mb-6">Standings</h1>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div>
            <h2 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">Eastern Conference</h2>
            <DataTable columns={cols} data={eastTeams} keyExtractor={(row) => row.team} />
          </div>
          <div>
            <h2 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">Western Conference</h2>
            <DataTable columns={cols} data={westTeams} keyExtractor={(row) => row.team} />
          </div>
        </div>
        <h2 className="font-display text-2xl tracking-wide text-white mb-4">Playoff Picture</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PlayoffBracket teams={eastTeams} conference="Eastern" />
          <PlayoffBracket teams={westTeams} conference="Western" />
        </div>
      </div>
    </PageTransition>
  )
}
