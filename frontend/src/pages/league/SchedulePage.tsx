import { useState } from 'react'
import PageTransition from '../../components/layout/PageTransition'
import Button from '../../components/common/Button'

interface GameEvent {
  date: string
  away: string
  home: string
  awayScore?: number
  homeScore?: number
}

const MOCK_GAMES: GameEvent[] = [
  { date: '2025-01-06', away: 'Boston Ballers', home: 'Philly Force', awayScore: 98, homeScore: 105 },
  { date: '2025-01-06', away: 'LA Vipers', home: 'Phoenix Flames', awayScore: 112, homeScore: 108 },
  { date: '2025-01-08', away: 'Philly Force', home: 'Miami Aces', awayScore: 101, homeScore: 99 },
  { date: '2025-01-08', away: 'Denver Altitude', home: 'Dallas Mavericks', awayScore: 95, homeScore: 102 },
  { date: '2025-01-10', away: 'Chicago Storm', home: 'Philly Force' },
  { date: '2025-01-12', away: 'Philly Force', home: 'New York Titans' },
  { date: '2025-01-15', away: 'Toronto Raptors', home: 'Philly Force' },
  { date: '2025-01-18', away: 'Philly Force', home: 'Cleveland Kings' },
  { date: '2025-01-20', away: 'Atlanta Hawks', home: 'Boston Ballers' },
  { date: '2025-01-22', away: 'Golden State Warriors', home: 'LA Vipers' },
  { date: '2025-01-25', away: 'Philly Force', home: 'Chicago Storm' },
]

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

function formatDate(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export default function SchedulePage() {
  const [year, setYear] = useState(2025)
  const [month, setMonth] = useState(0)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const today = '2025-01-10'

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)

  const gamesByDate = MOCK_GAMES.reduce<Record<string, GameEvent[]>>((acc, g) => {
    (acc[g.date] ??= []).push(g)
    return acc
  }, {})

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
    setSelectedDay(null)
  }

  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
    setSelectedDay(null)
  }

  const selectedDate = selectedDay ? formatDate(year, month, selectedDay) : null
  const selectedGames = selectedDate ? (gamesByDate[selectedDate] ?? []) : []

  return (
    <PageTransition>
      <div>
        <h1 className="font-display text-4xl tracking-wide text-white mb-6">Schedule</h1>

        <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-5 mb-6">
          <h2 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">Sim Controls</h2>
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" size="sm">Sim Day</Button>
            <Button variant="primary" size="sm">Sim Week</Button>
            <Button variant="secondary" size="sm">Sim to Date</Button>
            <Button variant="danger" size="sm">Sim All</Button>
          </div>
        </div>

        <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-5">
            <button onClick={prevMonth} className="text-gray-400 hover:text-white transition-colors text-lg px-2">&lt;</button>
            <h2 className="font-display text-xl tracking-wide text-white">{MONTHS[month]} {year}</h2>
            <button onClick={nextMonth} className="text-gray-400 hover:text-white transition-colors text-lg px-2">&gt;</button>
          </div>

          <div className="grid grid-cols-7 gap-px">
            {DAY_LABELS.map(d => (
              <div key={d} className="text-[10px] uppercase tracking-[2px] text-gray-600 text-center py-2">{d}</div>
            ))}
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const dateStr = formatDate(year, month, day)
              const hasGames = !!gamesByDate[dateStr]
              const isToday = dateStr === today
              const isSelected = day === selectedDay

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day === selectedDay ? null : day)}
                  className={`relative p-2 md:p-3 text-sm rounded-lg transition-all ${
                    isSelected
                      ? 'bg-[oklch(64.6%_0.222_41.116)]/20 border border-[oklch(64.6%_0.222_41.116)]/30 text-white'
                      : isToday
                        ? 'bg-[oklch(64.6%_0.222_41.116)]/10 text-[oklch(64.6%_0.222_41.116)]'
                        : 'text-gray-400 hover:bg-white/[0.04]'
                  }`}
                >
                  {day}
                  {hasGames && (
                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[oklch(64.6%_0.222_41.116)]" />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {selectedDay && (
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-5">
            <h3 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">
              {MONTHS[month]} {selectedDay}, {year}
            </h3>
            {selectedGames.length === 0 ? (
              <p className="text-gray-500 text-sm">No games scheduled</p>
            ) : (
              <div className="space-y-3">
                {selectedGames.map((g, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                    <div className="text-sm">
                      <span className="text-gray-300">{g.away}</span>
                      <span className="text-gray-600 mx-2">@</span>
                      <span className="text-white">{g.home}</span>
                    </div>
                    {g.awayScore != null && g.homeScore != null ? (
                      <span className="text-sm font-medium text-gray-300">{g.awayScore} — {g.homeScore}</span>
                    ) : (
                      <span className="text-xs text-gray-600 uppercase tracking-wider">Upcoming</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </PageTransition>
  )
}
