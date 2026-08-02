import { useState, useEffect, useCallback } from 'react'
import PageTransition from '../../components/layout/PageTransition'
import Button from '../../components/common/Button'
import { useLeague } from '../../hooks/useLeague'
import type { Game } from '../../types'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

function fmtDate(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function teamName(teamId: string, teams: { id: string; info: { city: string; name: string } }[]): string {
  const t = teams.find(x => x.id === teamId)
  return t ? `${t.info.city} ${t.info.name}` : teamId
}

function teamAbbr(teamId: string): string {
  return teamId
}

export default function SchedulePage() {
  const { db, state, teams, simming, simProgress, simDay, simWeek, simToDate, loading } = useLeague()

  const currentDate = state?.currentDate ?? '2026-10-22'
  const initDate = new Date(currentDate + 'T12:00:00')

  const [year, setYear] = useState(initDate.getFullYear())
  const [month, setMonth] = useState(initDate.getMonth())
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [games, setGames] = useState<Game[]>([])
  const [simToTarget, setSimToTarget] = useState('')

  const loadMonthGames = useCallback(async () => {
    if (!db) return
    const startDate = fmtDate(year, month, 1)
    const endDate = fmtDate(year, month, getDaysInMonth(year, month))
    const monthGames = await db.games
      .where('date')
      .between(startDate, endDate, true, true)
      .toArray()
    setGames(monthGames)
  }, [db, year, month])

  useEffect(() => {
    loadMonthGames()
  }, [loadMonthGames])

  useEffect(() => {
    if (!simming) loadMonthGames()
  }, [simming, loadMonthGames])

  if (loading || !state) {
    return (
      <PageTransition>
        <div className="text-gray-400 text-center py-20">Loading schedule...</div>
      </PageTransition>
    )
  }

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)

  const gamesByDate: Record<string, Game[]> = {}
  for (const g of games) {
    (gamesByDate[g.date] ??= []).push(g)
  }

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

  const selectedDate = selectedDay ? fmtDate(year, month, selectedDay) : null
  const selectedGames = selectedDate ? (gamesByDate[selectedDate] ?? []) : []

  const handleSimToDate = async () => {
    if (!simToTarget) return
    await simToDate(simToTarget)
    setSimToTarget('')
  }

  const userTeamId = state.userTeamId

  return (
    <PageTransition>
      <div>
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-4xl tracking-wide text-white">Schedule</h1>
          <div className="text-sm text-gray-400">
            Current: <span className="text-white">{currentDate}</span>
          </div>
        </div>

        <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-5 mb-6">
          <h2 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">Sim Controls</h2>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" size="sm" onClick={simDay} disabled={simming}>
              {simming ? simProgress ?? 'Simming...' : 'Sim Day'}
            </Button>
            <Button variant="primary" size="sm" onClick={simWeek} disabled={simming}>
              Sim Week
            </Button>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={simToTarget}
                onChange={e => setSimToTarget(e.target.value)}
                min={currentDate}
                className="bg-white/[0.06] border border-white/[0.1] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-accent/50"
              />
              <Button variant="secondary" size="sm" onClick={handleSimToDate} disabled={simming || !simToTarget}>
                Sim to Date
              </Button>
            </div>
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
              const dateStr = fmtDate(year, month, day)
              const dayGames = gamesByDate[dateStr]
              const hasGames = !!dayGames?.length
              const isToday = dateStr === currentDate
              const isSelected = day === selectedDay
              const isPast = dateStr < currentDate
              const hasUserGame = dayGames?.some(g => g.homeTeamId === userTeamId || g.awayTeamId === userTeamId)

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day === selectedDay ? null : day)}
                  className={`relative p-2 md:p-3 text-sm rounded-lg transition-all ${
                    isSelected
                      ? 'bg-accent/20 border border-accent/30 text-white'
                      : isToday
                        ? 'bg-accent/10 text-accent'
                        : isPast
                          ? 'text-gray-600'
                          : 'text-gray-400 hover:bg-white/[0.04]'
                  }`}
                >
                  {day}
                  {hasGames && (
                    <span className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${
                      hasUserGame ? 'bg-accent' : 'bg-gray-500'
                    }`} />
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
              <span className="ml-3 text-gray-500">{selectedGames.length} game{selectedGames.length !== 1 ? 's' : ''}</span>
            </h3>
            {selectedGames.length === 0 ? (
              <p className="text-gray-500 text-sm">No games scheduled</p>
            ) : (
              <div className="space-y-3">
                {selectedGames.map(g => {
                  const isUserGame = g.homeTeamId === userTeamId || g.awayTeamId === userTeamId
                  return (
                    <div
                      key={g.id}
                      className={`flex items-center justify-between px-4 py-3 rounded-lg border ${
                        isUserGame
                          ? 'bg-accent/5 border-accent/15'
                          : 'bg-white/[0.02] border-white/[0.04]'
                      }`}
                    >
                      <div className="flex items-center gap-3 text-sm">
                        <span className={`font-mono text-xs ${isUserGame && g.awayTeamId === userTeamId ? 'text-accent' : 'text-gray-400'}`}>
                          {teamAbbr(g.awayTeamId)}
                        </span>
                        <span className="text-gray-300">{teamName(g.awayTeamId, teams)}</span>
                        <span className="text-gray-600">@</span>
                        <span className={`font-mono text-xs ${isUserGame && g.homeTeamId === userTeamId ? 'text-accent' : 'text-gray-400'}`}>
                          {teamAbbr(g.homeTeamId)}
                        </span>
                        <span className="text-white">{teamName(g.homeTeamId, teams)}</span>
                      </div>
                      {g.result ? (
                        <span className="text-sm font-medium text-gray-300">
                          {g.result.awayScore} — {g.result.homeScore}
                          <span className="ml-2 text-xs text-gray-500">Final</span>
                        </span>
                      ) : (
                        <span className="text-xs text-gray-600 uppercase tracking-wider">Scheduled</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </PageTransition>
  )
}
