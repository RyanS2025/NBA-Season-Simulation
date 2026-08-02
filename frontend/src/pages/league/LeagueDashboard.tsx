import PageTransition from '../../components/layout/PageTransition'
import DataTable from '../../components/common/DataTable'

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

const TEAM_NAME = 'Philly Force'
const TEAM_RECORD = { w: 44, l: 26 }
const CONFERENCE_SEED = 4
const SEASON_PHASE = 'Regular Season — Game 70'

interface RecentGame {
  id: string
  result: 'W' | 'L'
  score: string
  opponent: string
}

const RECENT_GAMES: RecentGame[] = [
  { id: 'g1', result: 'W', score: '112-105', opponent: 'Boston Ballers' },
  { id: 'g2', result: 'W', score: '98-91', opponent: 'Cleveland Kings' },
  { id: 'g3', result: 'L', score: '101-109', opponent: 'Miami Aces' },
  { id: 'g4', result: 'W', score: '118-104', opponent: 'Orlando Stars' },
  { id: 'g5', result: 'W', score: '107-99', opponent: 'Charlotte Buzz' },
]

interface UpcomingGame {
  id: string
  date: string
  opponent: string
  location: 'Home' | 'Away'
  oppRecord: string
}

const UPCOMING_GAMES: UpcomingGame[] = [
  { id: 'u1', date: 'Mar 15', opponent: 'Chicago Storm', location: 'Home', oppRecord: '42-28' },
  { id: 'u2', date: 'Mar 17', opponent: 'Toronto Raptors', location: 'Away', oppRecord: '40-30' },
  { id: 'u3', date: 'Mar 19', opponent: 'Atlanta Hawks', location: 'Home', oppRecord: '38-32' },
  { id: 'u4', date: 'Mar 21', opponent: 'Indiana Wolves', location: 'Away', oppRecord: '33-37' },
  { id: 'u5', date: 'Mar 23', opponent: 'New York Titans', location: 'Home', oppRecord: '52-18' },
]

interface StandingRow {
  seed: number
  team: string
  w: number
  l: number
  pct: string
  gb: string
  isUser: boolean
}

const EAST_STANDINGS: StandingRow[] = [
  { seed: 1, team: 'New York Titans', w: 52, l: 18, pct: '.743', gb: '—', isUser: false },
  { seed: 2, team: 'Boston Ballers', w: 49, l: 21, pct: '.700', gb: '3.0', isUser: false },
  { seed: 3, team: 'Miami Aces', w: 46, l: 24, pct: '.657', gb: '6.0', isUser: false },
  { seed: 4, team: 'Philly Force', w: 44, l: 26, pct: '.629', gb: '8.0', isUser: true },
  { seed: 5, team: 'Chicago Storm', w: 42, l: 28, pct: '.600', gb: '10.0', isUser: false },
  { seed: 6, team: 'Toronto Raptors', w: 40, l: 30, pct: '.571', gb: '12.0', isUser: false },
  { seed: 7, team: 'Atlanta Hawks', w: 38, l: 32, pct: '.543', gb: '14.0', isUser: false },
  { seed: 8, team: 'Cleveland Kings', w: 36, l: 34, pct: '.514', gb: '16.0', isUser: false },
]

interface TransactionItem {
  id: string
  icon: string
  description: string
  date: string
}

const RECENT_TRANSACTIONS: TransactionItem[] = [
  { id: 'tx1', icon: '✍', description: 'Signed Marcus Rivera to 2-year deal', date: 'Mar 12' },
  { id: 'tx2', icon: '✂', description: 'Waived Darnell Brooks', date: 'Mar 10' },
  { id: 'tx3', icon: '🔄', description: 'Traded 2nd round pick to Denver', date: 'Mar 8' },
  { id: 'tx4', icon: '✅', description: 'Exercised team option on Jamal Foster', date: 'Mar 5' },
]

// ---------------------------------------------------------------------------
// Standings Table Columns
// ---------------------------------------------------------------------------

const STANDINGS_COLUMNS: {
  key: string
  label: string
  align?: 'left' | 'center' | 'right'
  render?: (row: StandingRow) => React.ReactNode
}[] = [
  {
    key: 'seed',
    label: '#',
    align: 'center',
    render: (row) => <span className="text-gray-500">{row.seed}</span>,
  },
  {
    key: 'team',
    label: 'Team',
    render: (row) => (
      <span className={row.isUser ? 'text-accent font-semibold' : 'text-white'}>
        {row.team}
      </span>
    ),
  },
  { key: 'w', label: 'W', align: 'center' },
  { key: 'l', label: 'L', align: 'center' },
  { key: 'pct', label: 'PCT', align: 'center' },
  { key: 'gb', label: 'GB', align: 'center' },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function LeagueDashboard() {
  const winPct = (TEAM_RECORD.w / (TEAM_RECORD.w + TEAM_RECORD.l)).toFixed(3)
  const capUsed = 127.8
  const capTotal = 136.0
  const capPct = (capUsed / capTotal) * 100

  return (
    <PageTransition>
      <div>
        {/* ---- Team Header ---- */}
        <div className="mb-8">
          <h1 className="font-display text-4xl tracking-wide text-white mb-1">
            {TEAM_NAME}
          </h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="text-2xl font-semibold text-white">
              {TEAM_RECORD.w}-{TEAM_RECORD.l}
            </span>
            <span className="text-gray-500 text-sm">
              {CONFERENCE_SEED}th in Eastern Conference
            </span>
            <span className="text-gray-600 text-sm">&middot;</span>
            <span className="text-gray-500 text-sm">{SEASON_PHASE}</span>
          </div>
        </div>

        {/* ---- 4-Card Stat Grid ---- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {/* Next Game */}
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-6">
            <h2 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">
              Next Game
            </h2>
            <p className="text-xl font-semibold text-white mb-1">
              vs Chicago Storm
            </p>
            <div className="flex items-center gap-3">
              <span className="text-gray-500 text-sm">Mar 15, 2025</span>
              <span className="px-2 py-0.5 rounded text-[10px] uppercase tracking-[1px] font-medium bg-accent/15 text-accent border border-accent/30">
                Home
              </span>
            </div>
          </div>

          {/* Season Record */}
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-6">
            <h2 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">
              Season Record
            </h2>
            <p className="text-3xl font-semibold text-white">
              {TEAM_RECORD.w}-{TEAM_RECORD.l}
            </p>
            <p className="text-gray-500 text-sm mt-1">{winPct} WIN%</p>
          </div>

          {/* Cap Space */}
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-6">
            <h2 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">
              Cap Space
            </h2>
            <p className="text-xl font-semibold text-white mb-1">
              $8.2M
              <span className="text-gray-500 text-sm font-normal ml-2">available</span>
            </p>
            <div className="mt-3">
              <div className="flex justify-between text-[10px] text-gray-600 mb-1">
                <span>${capUsed}M used</span>
                <span>${capTotal}M cap</span>
              </div>
              <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${capPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* League Rank */}
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-6">
            <h2 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">
              League Rank
            </h2>
            <div className="flex items-baseline gap-4">
              <div>
                <p className="text-3xl font-semibold text-accent">#{CONFERENCE_SEED}</p>
                <p className="text-gray-500 text-sm">Eastern</p>
              </div>
              <div className="border-l border-white/[0.08] pl-4">
                <p className="text-2xl font-semibold text-white">#7</p>
                <p className="text-gray-500 text-sm">Overall</p>
              </div>
            </div>
          </div>
        </div>

        {/* ---- Recent Results (horizontal scroll) ---- */}
        <div className="mb-8">
          <h2 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">
            Recent Results
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {RECENT_GAMES.map((game, idx) => {
              const isLatest = idx === 0
              return (
                <div
                  key={game.id}
                  className={`shrink-0 bg-white/[0.04] border rounded-xl p-4 ${
                    isLatest
                      ? 'border-accent/30 w-44'
                      : 'border-white/[0.08] w-36'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`text-xs font-bold ${
                        game.result === 'W' ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {game.result}
                    </span>
                    {isLatest && (
                      <span className="text-[9px] uppercase tracking-[1px] text-gray-600">
                        Latest
                      </span>
                    )}
                  </div>
                  <p className={`font-semibold text-white ${isLatest ? 'text-lg' : 'text-base'}`}>
                    {game.score}
                  </p>
                  <p className="text-gray-500 text-xs mt-1 truncate">
                    {game.opponent}
                  </p>
                </div>
              )
            })}
          </div>
        </div>

        {/* ---- Two-Column: Upcoming Schedule + Standings Snapshot ---- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Upcoming Schedule */}
          <div>
            <h2 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">
              Upcoming Schedule
            </h2>
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl divide-y divide-white/[0.06]">
              {UPCOMING_GAMES.map((game) => (
                <div key={game.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-4">
                    <span className="text-gray-500 text-xs w-12">{game.date}</span>
                    <span className="text-white text-sm">{game.opponent}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-600 text-xs">{game.oppRecord}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-[1px] font-medium ${
                        game.location === 'Home'
                          ? 'bg-accent/15 text-accent border border-accent/30'
                          : 'bg-white/[0.06] text-gray-400 border border-white/[0.08]'
                      }`}
                    >
                      {game.location === 'Home' ? 'Home' : 'Away'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Standings Snapshot */}
          <div>
            <h2 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">
              Eastern Conference Standings
            </h2>
            <DataTable
              columns={STANDINGS_COLUMNS}
              data={EAST_STANDINGS}
              keyExtractor={(row) => row.team}
            />
          </div>
        </div>

        {/* ---- Recent Transactions ---- */}
        <div className="mb-8">
          <h2 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">
            Recent Transactions
          </h2>
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl divide-y divide-white/[0.06]">
            {RECENT_TRANSACTIONS.map((tx) => (
              <div key={tx.id} className="flex items-center gap-4 px-5 py-3">
                <span className="text-lg w-8 text-center shrink-0">{tx.icon}</span>
                <span className="text-white text-sm flex-1">{tx.description}</span>
                <span className="text-gray-600 text-xs shrink-0">{tx.date}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ---- Quick Actions ---- */}
        <div className="mb-4">
          <h2 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">
            Quick Actions
          </h2>
          <div className="flex flex-wrap gap-3">
            <button className="bg-accent/10 hover:bg-accent/20 text-accent border border-accent/20 rounded-lg px-4 py-2 text-sm font-medium transition-colors">
              Sim Day
            </button>
            <button className="bg-accent/10 hover:bg-accent/20 text-accent border border-accent/20 rounded-lg px-4 py-2 text-sm font-medium transition-colors">
              Sim Week
            </button>
            <button className="bg-accent/10 hover:bg-accent/20 text-accent border border-accent/20 rounded-lg px-4 py-2 text-sm font-medium transition-colors">
              Sim to Date
            </button>
          </div>
        </div>
      </div>
    </PageTransition>
  )
}
