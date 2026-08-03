import { useState, useEffect, useMemo } from 'react'
import GlassCard from '../common/GlassCard'
import { useLeague } from '../../hooks/useLeague'
import type { Transaction } from '../../types'

interface NewsItem {
  date: string
  kind: 'game' | 'trade' | 'signing' | 'injury' | 'demand' | 'streak' | 'hotseat' | 'draft' | 'other'
  text: string
}

const KIND_STYLES: Record<NewsItem['kind'], { label: string; cls: string }> = {
  game: { label: 'Game', cls: 'bg-accent/15 text-accent border-accent/30' },
  trade: { label: 'Trade', cls: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  signing: { label: 'Signing', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  injury: { label: 'Injury', cls: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
  demand: { label: 'Drama', cls: 'bg-red-500/15 text-red-400 border-red-500/30' },
  streak: { label: 'Streak', cls: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
  hotseat: { label: 'Hot Seat', cls: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
  draft: { label: 'Draft', cls: 'bg-sky-500/15 text-sky-400 border-sky-500/30' },
  other: { label: 'News', cls: 'bg-gray-500/15 text-gray-400 border-gray-500/30' },
}

function txKind(t: Transaction): NewsItem['kind'] {
  switch (t.type) {
    case 'trade': return 'trade'
    case 'signing': case 'extension': return 'signing'
    case 'injury': return 'injury'
    case 'trade_request': return 'demand'
    case 'draft': return 'draft'
    default: return 'other'
  }
}

function addDays(date: string, days: number): string {
  const d = new Date(date + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmtShort(date: string): string {
  const d = new Date(date + 'T12:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/**
 * The league's front page: standout performances, streaks, coaching
 * drama, and the transaction wire, assembled from the last few days of
 * sim results.
 */
export default function NewsFeed() {
  const { db, state, teams, players, simming } = useLeague()
  const [items, setItems] = useState<NewsItem[]>([])

  const playerName = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of players) m.set(p.id, `${p.bio.firstName} ${p.bio.lastName}`)
    return m
  }, [players])

  useEffect(() => {
    if (!db || !state || simming) return
    let cancelled = false

    const teamName = (id: string) => {
      const t = teams.find(x => x.id === id)
      return t ? `${t.info.city} ${t.info.name}` : ''
    }

    const load = async () => {
      const news: NewsItem[] = []
      const since = addDays(state.currentDate, -5)

      // Standout performances from recent box scores
      const recentResults = await db.gameResults
        .where('date').aboveOrEqual(since)
        .limit(120)
        .toArray()
      for (const r of recentResults) {
        for (const box of [r.result.homeBoxScore, r.result.awayBoxScore]) {
          const oppId = box.teamId === r.result.homeBoxScore.teamId
            ? r.result.awayBoxScore.teamId : r.result.homeBoxScore.teamId
          for (const ps of box.playerStats) {
            const name = playerName.get(ps.playerId)
            if (!name) continue
            const cats = [ps.points, ps.totalRebounds, ps.assists, ps.steals, ps.blocks].filter(v => v >= 10).length
            if (ps.points >= 40) {
              news.push({ date: r.date, kind: 'game', text: `${name} erupts for ${ps.points} against the ${teamName(oppId)}` })
            } else if (cats >= 3) {
              news.push({ date: r.date, kind: 'game', text: `${name} posts a triple-double (${ps.points}/${ps.totalRebounds}/${ps.assists}) vs the ${teamName(oppId)}` })
            }
          }
        }
      }

      // Transaction wire
      const recentTx = await db.transactions
        .where('date').aboveOrEqual(addDays(state.currentDate, -8))
        .limit(40)
        .toArray()
      for (const t of recentTx) {
        news.push({ date: t.date, kind: txKind(t), text: t.description })
      }

      // Team streaks and coaching drama from live team state
      for (const t of teams) {
        const streak = t.seasonRecord.streak
        if (streak >= 6) {
          news.push({ date: state.currentDate, kind: 'streak', text: `The ${t.info.city} ${t.info.name} have won ${streak} straight` })
        } else if (streak <= -6) {
          news.push({ date: state.currentDate, kind: 'streak', text: `The ${t.info.city} ${t.info.name} have dropped ${-streak} in a row` })
        }
        const hotSeat = t.staff?.headCoach?.hotSeatLevel ?? 0
        if (hotSeat >= 55) {
          news.push({ date: state.currentDate, kind: 'hotseat', text: `${t.staff!.headCoach.name}'s seat is burning in ${t.info.city} (${t.seasonRecord.wins}-${t.seasonRecord.losses})` })
        }
      }

      news.sort((a, b) => b.date.localeCompare(a.date))
      if (!cancelled) setItems(news.slice(0, 10))
    }

    void load()
    return () => { cancelled = true }
  }, [db, state, teams, playerName, simming])

  if (items.length === 0) return null

  return (
    <div className="mb-8">
      <h2 className="text-[10px] uppercase tracking-[2px] text-gray-600 mb-3">Around the League</h2>
      <GlassCard className="divide-y divide-white/[0.05]">
        {items.map((item, i) => {
          const style = KIND_STYLES[item.kind]
          return (
            <div key={i} className="flex items-center gap-3 px-5 py-2.5">
              <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider border ${style.cls}`}>
                {style.label}
              </span>
              <span className="text-sm text-gray-300 flex-1 min-w-0">{item.text}</span>
              <span className="shrink-0 text-[10px] text-gray-600">{fmtShort(item.date)}</span>
            </div>
          )
        })}
      </GlassCard>
    </div>
  )
}
