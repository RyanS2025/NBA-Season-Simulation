import { useState } from 'react'
import PageTransition from '../../components/layout/PageTransition'
import GlassCard from '../../components/common/GlassCard'

interface GameResult {
  away: string
  home: string
  awayScore: number
  homeScore: number
}

const MOCK_SCORES: Record<string, GameResult[]> = {
  '2025-01-05': [
    { away: 'LA Vipers', home: 'Denver Altitude', awayScore: 118, homeScore: 112 },
    { away: 'New York Titans', home: 'Toronto Raptors', awayScore: 104, homeScore: 97 },
  ],
  '2025-01-06': [
    { away: 'Boston Ballers', home: 'Philly Force', awayScore: 98, homeScore: 105 },
    { away: 'LA Vipers', home: 'Phoenix Flames', awayScore: 112, homeScore: 108 },
    { away: 'Chicago Storm', home: 'Cleveland Kings', awayScore: 89, homeScore: 94 },
    { away: 'Dallas Mavericks', home: 'Sacramento Kings', awayScore: 110, homeScore: 103 },
  ],
  '2025-01-07': [
    { away: 'Miami Aces', home: 'Atlanta Hawks', awayScore: 106, homeScore: 101 },
    { away: 'Golden State Warriors', home: 'Portland Trail Blazers', awayScore: 121, homeScore: 115 },
  ],
  '2025-01-08': [
    { away: 'Philly Force', home: 'Miami Aces', awayScore: 101, homeScore: 99 },
    { away: 'Denver Altitude', home: 'Dallas Mavericks', awayScore: 95, homeScore: 102 },
  ],
}

const ORDERED_DATES = Object.keys(MOCK_SCORES).sort()

function formatDisplayDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

export default function ScoresPage() {
  const [dateIndex, setDateIndex] = useState(ORDERED_DATES.length - 1)
  const currentDate = ORDERED_DATES[dateIndex]
  const games = currentDate ? MOCK_SCORES[currentDate] ?? [] : []

  const goPrev = () => setDateIndex(i => Math.max(0, i - 1))
  const goNext = () => setDateIndex(i => Math.min(ORDERED_DATES.length - 1, i + 1))
  const goToday = () => {
    const todayIdx = ORDERED_DATES.findIndex(d => d === '2025-01-08')
    if (todayIdx !== -1) setDateIndex(todayIdx)
  }

  return (
    <PageTransition>
      <div>
        <h1 className="font-display text-4xl tracking-wide text-white mb-6">Scores</h1>

        <div className="flex items-center justify-center gap-4 mb-8">
          <button
            onClick={goPrev}
            disabled={dateIndex === 0}
            className="text-gray-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-sm"
          >
            &larr; Previous Day
          </button>
          <button
            onClick={goToday}
            className="text-[oklch(64.6%_0.222_41.116)] hover:brightness-110 transition-all text-sm font-medium px-3 py-1 rounded-lg bg-[oklch(64.6%_0.222_41.116)]/10"
          >
            Today
          </button>
          <button
            onClick={goNext}
            disabled={dateIndex === ORDERED_DATES.length - 1}
            className="text-gray-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-sm"
          >
            Next Day &rarr;
          </button>
        </div>

        <h2 className="text-center text-white font-display text-xl tracking-wide mb-6">
          {currentDate ? formatDisplayDate(currentDate) : 'No Date Selected'}
        </h2>

        {games.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500 text-sm">No games scheduled</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {games.map((g, i) => {
              const awayWon = g.awayScore > g.homeScore
              return (
                <GlassCard key={i} hover className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] uppercase tracking-[2px] text-gray-600">Final</span>
                    <span className="text-[10px] uppercase tracking-[2px] text-[oklch(64.6%_0.222_41.116)] cursor-pointer hover:brightness-125">
                      Box Score
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={`text-sm ${awayWon ? 'text-white font-semibold' : 'text-gray-400'}`}>{g.away}</span>
                      <span className={`text-lg tabular-nums ${awayWon ? 'text-white font-semibold' : 'text-gray-500'}`}>{g.awayScore}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`text-sm ${!awayWon ? 'text-white font-semibold' : 'text-gray-400'}`}>{g.home}</span>
                      <span className={`text-lg tabular-nums ${!awayWon ? 'text-white font-semibold' : 'text-gray-500'}`}>{g.homeScore}</span>
                    </div>
                  </div>
                </GlassCard>
              )
            })}
          </div>
        )}
      </div>
    </PageTransition>
  )
}
