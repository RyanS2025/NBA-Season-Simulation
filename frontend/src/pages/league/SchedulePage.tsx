import { useState, useEffect, useCallback, useMemo } from 'react'
import PageTransition from '../../components/layout/PageTransition'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import Button from '../../components/common/Button'
import { useLeague } from '../../hooks/useLeague'
import { getSeasonMilestones, type SeasonMilestone, type MilestoneType } from '../../utils/season-dates'
import type { Game, Team } from '../../types'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const MILESTONE_STYLES: Record<MilestoneType, string> = {
  extension_deadline: 'text-sky-400',
  trade_deadline: 'text-amber-400',
  all_star: 'text-purple-400',
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

function fmtDate(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function teamName(teamId: string, teams: Team[]): string {
  const t = teams.find(x => x.id === teamId)
  return t ? `${t.info.city} ${t.info.name}` : teamId
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

  // The calendar mounts before league state loads, so snap to the
  // league's actual current month once it arrives (and after sims).
  useEffect(() => {
    if (!state?.currentDate) return
    const d = new Date(state.currentDate + 'T12:00:00')
    setYear(d.getFullYear())
    setMonth(d.getMonth())
  }, [state?.currentDate])

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

  const abbrMap = useMemo(
    () => new Map(teams.map(t => [t.id, t.info.abbreviation])),
    [teams],
  )

  const milestonesByDate = useMemo(() => {
    const map = new Map<string, SeasonMilestone>()
    if (state) {
      // Milestones for the current season plus neighbors, so browsing
      // across a season rollover still shows the right markers.
      for (const sy of [state.currentSeason - 1, state.currentSeason, state.currentSeason + 1]) {
        for (const m of getSeasonMilestones(sy)) {
          map.set(m.date, m)
        }
      }
    }
    return map
  }, [state])

  if (loading || !state) {
    return (
      <PageTransition>
        <LoadingSpinner message="Loading schedule..." />
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
              const userGame = dayGames?.find(g => g.homeTeamId === userTeamId || g.awayTeamId === userTeamId)
              const milestone = milestonesByDate.get(dateStr)

              let matchupLabel: string | null = null
              if (userGame) {
                const isHome = userGame.homeTeamId === userTeamId
                const oppId = isHome ? userGame.awayTeamId : userGame.homeTeamId
                matchupLabel = `${isHome ? 'vs' : '@'} ${abbrMap.get(oppId) ?? '???'}`
              }

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day === selectedDay ? null : day)}
                  className={`relative flex flex-col items-center justify-start gap-0.5 min-h-[52px] md:min-h-[60px] p-1.5 md:p-2 text-sm rounded-lg transition-all ${
                    isSelected
                      ? 'bg-accent/20 border border-accent/30 text-white'
                      : isToday
                        ? 'bg-accent/10 text-accent'
                        : isPast
                          ? 'text-gray-600'
                          : 'text-gray-400 hover:bg-white/[0.04]'
                  }`}
                >
                  <span>{day}</span>
                  {matchupLabel && (
                    <span className={`text-[9px] md:text-[10px] font-medium leading-tight whitespace-nowrap ${
                      isPast ? 'text-gray-600' : 'text-accent'
                    }`}>
                      {matchupLabel}
                    </span>
                  )}
                  {milestone && (
                    <span className={`text-[8px] md:text-[9px] uppercase tracking-wide leading-tight whitespace-nowrap ${MILESTONE_STYLES[milestone.type]}`}>
                      {milestone.shortLabel}
                    </span>
                  )}
                  {hasGames && !matchupLabel && (
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-500 mt-auto" />
                  )}
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-4 pt-3 border-t border-white/[0.06]">
            <span className="flex items-center gap-1.5 text-[10px] text-gray-500">
              <span className="text-accent font-medium">vs / @</span> Your games
            </span>
            <span className="flex items-center gap-1.5 text-[10px] text-gray-500">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-500 inline-block" /> League games
            </span>
            <span className="text-[10px] text-sky-400 uppercase tracking-wide">Ext DL — Extension Deadline</span>
            <span className="text-[10px] text-amber-400 uppercase tracking-wide">Trade DL — Trade Deadline</span>
            <span className="text-[10px] text-purple-400 uppercase tracking-wide">All-Star — All-Star Break</span>
          </div>
        </div>

        {selectedDay && (
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-5">
            <h3 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">
              {MONTHS[month]} {selectedDay}, {year}
              <span className="ml-3 text-gray-500">{selectedGames.length} game{selectedGames.length !== 1 ? 's' : ''}</span>
            </h3>
            {selectedDate && milestonesByDate.has(selectedDate) && (
              <div className={`mb-4 px-4 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-sm ${MILESTONE_STYLES[milestonesByDate.get(selectedDate)!.type]}`}>
                {milestonesByDate.get(selectedDate)!.label}
              </div>
            )}
            {selectedGames.length === 0 ? (
              <p className="text-gray-500 text-sm">No games scheduled — start a new season from the Dashboard to generate the schedule.</p>
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
                          {abbrMap.get(g.awayTeamId) ?? '???'}
                        </span>
                        <span className="text-gray-300">{teamName(g.awayTeamId, teams)}</span>
                        <span className="text-gray-600">@</span>
                        <span className={`font-mono text-xs ${isUserGame && g.homeTeamId === userTeamId ? 'text-accent' : 'text-gray-400'}`}>
                          {abbrMap.get(g.homeTeamId) ?? '???'}
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
