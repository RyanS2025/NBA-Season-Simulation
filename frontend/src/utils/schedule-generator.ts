import type { Game } from '../types'
import { v4 as uuid } from 'uuid'
import type { TeamInfo } from '../types'

interface MatchupPair {
  home: string
  away: string
}

const DIVISIONS: Record<string, string[]> = {
  Atlantic: ['BOS', 'NYT', 'PHI', 'TOR', 'BKN'],
  Central: ['CHI', 'CLE', 'MIL', 'IND', 'DET'],
  Southeast: ['MIA', 'ATL', 'CHA', 'WAS', 'ORL'],
  Northwest: ['DEN', 'POR', 'MIN', 'OKC', 'UTA'],
  Pacific: ['LAV', 'GSS', 'SAC', 'PHX', 'LAW'],
  Southwest: ['DAL', 'HOU', 'SAS', 'MEM', 'NOP'],
}

const CONFERENCE_DIVS: Record<string, string[]> = {
  Eastern: ['Atlantic', 'Central', 'Southeast'],
  Western: ['Northwest', 'Pacific', 'Southwest'],
}

function getDivision(teamId: string): string {
  for (const [div, teams] of Object.entries(DIVISIONS)) {
    if (teams.includes(teamId)) return div
  }
  return ''
}

function getConference(teamId: string): string {
  const div = getDivision(teamId)
  for (const [conf, divs] of Object.entries(CONFERENCE_DIVS)) {
    if (divs.includes(div)) return conf
  }
  return ''
}

function getConferenceTeams(conference: string): string[] {
  const teams: string[] = []
  for (const div of CONFERENCE_DIVS[conference] ?? []) {
    teams.push(...(DIVISIONS[div] ?? []))
  }
  return teams
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function generateMatchups(teamIds: string[]): MatchupPair[] {
  const fourGamePairs = new Set<string>()

  for (const confName of ['Eastern', 'Western']) {
    const confTeams = getConferenceTeams(confName)
    const nonDivPairs: [string, string][] = []

    for (let i = 0; i < confTeams.length; i++) {
      for (let j = i + 1; j < confTeams.length; j++) {
        if (getDivision(confTeams[i]) !== getDivision(confTeams[j])) {
          nonDivPairs.push([confTeams[i], confTeams[j]])
        }
      }
    }

    for (let attempt = 0; attempt < 50; attempt++) {
      const shuffled = shuffle(nonDivPairs)
      const extras: Record<string, number> = {}
      for (const t of confTeams) extras[t] = 6
      const trial = new Set<string>()

      for (const [t1, t2] of shuffled) {
        if (extras[t1] > 0 && extras[t2] > 0) {
          trial.add(`${t1}:${t2}`)
          extras[t1]--
          extras[t2]--
        }
      }

      if (Object.values(extras).every(v => v === 0)) {
        for (const key of trial) fourGamePairs.add(key)
        break
      }
      if (attempt === 49) {
        for (const key of trial) fourGamePairs.add(key)
      }
    }
  }

  const matchups: MatchupPair[] = []

  for (let i = 0; i < teamIds.length; i++) {
    for (let j = i + 1; j < teamIds.length; j++) {
      const t1 = teamIds[i]
      const t2 = teamIds[j]
      const conf1 = getConference(t1)
      const conf2 = getConference(t2)

      let total: number
      if (conf1 !== conf2) {
        total = 2
      } else if (getDivision(t1) === getDivision(t2)) {
        total = 4
      } else {
        const key = `${t1}:${t2}`
        const keyRev = `${t2}:${t1}`
        total = fourGamePairs.has(key) || fourGamePairs.has(keyRev) ? 4 : 3
      }

      let homeFirst = Math.floor(total / 2)
      let awayFirst = total - homeFirst
      if (Math.random() < 0.5) [homeFirst, awayFirst] = [awayFirst, homeFirst]

      for (let k = 0; k < homeFirst; k++) matchups.push({ home: t1, away: t2 })
      for (let k = 0; k < awayFirst; k++) matchups.push({ home: t2, away: t1 })
    }
  }

  return matchups
}

function generateDateSlots(seasonYear: number): string[] {
  const dates: string[] = []
  const start = new Date(seasonYear, 9, 22) // Oct 22
  const end = new Date(seasonYear + 1, 3, 13) // Apr 13

  // No games during the All-Star break (Feb 14-16)
  const allStarBreak = new Set([
    `${seasonYear + 1}-02-14`,
    `${seasonYear + 1}-02-15`,
    `${seasonYear + 1}-02-16`,
  ])

  const current = new Date(start)
  while (current <= end) {
    const y = current.getFullYear()
    const m = String(current.getMonth() + 1).padStart(2, '0')
    const d = String(current.getDate()).padStart(2, '0')
    const dateStr = `${y}-${m}-${d}`
    if (!allStarBreak.has(dateStr)) {
      dates.push(dateStr)
    }
    current.setDate(current.getDate() + 1)
  }
  return dates
}

function daysBetween(d1: string, d2: string): number {
  const a = new Date(d1 + 'T00:00:00')
  const b = new Date(d2 + 'T00:00:00')
  return Math.round(Math.abs(b.getTime() - a.getTime()) / 86400000)
}

interface ScheduledMatchup extends MatchupPair {
  date: string
}

function assignDates(matchups: MatchupPair[], dates: string[], teamIds: string[]): ScheduledMatchup[] {
  const result: ScheduledMatchup[] = []
  const teamDates: Record<string, Set<string>> = {}
  const teamRecent: Record<string, string[]> = {}
  for (const t of teamIds) {
    teamDates[t] = new Set()
    teamRecent[t] = []
  }

  const remaining = shuffle(matchups)
  const gamesPerDate = Math.ceil(remaining.length / dates.length) + 1

  for (const date of dates) {
    if (remaining.length === 0) break
    const used = new Set<string>()
    const toRemove: number[] = []

    const candidates = shuffle(remaining.map((m, i) => ({ ...m, idx: i })))

    for (const c of candidates) {
      if (toRemove.length >= gamesPerDate) break
      if (used.has(c.home) || used.has(c.away)) continue

      const homeRecent = teamRecent[c.home]
      const awayRecent = teamRecent[c.away]
      if (homeRecent.length >= 2) {
        const last2 = homeRecent.slice(-2)
        if (daysBetween(last2[0], date) <= 2 && daysBetween(last2[1], date) <= 1) continue
      }
      if (awayRecent.length >= 2) {
        const last2 = awayRecent.slice(-2)
        if (daysBetween(last2[0], date) <= 2 && daysBetween(last2[1], date) <= 1) continue
      }

      toRemove.push(c.idx)
      used.add(c.home)
      used.add(c.away)
      teamDates[c.home].add(date)
      teamDates[c.away].add(date)
      teamRecent[c.home].push(date)
      teamRecent[c.away].push(date)
      result.push({ home: c.home, away: c.away, date })
    }

    const removeSet = new Set(toRemove)
    let writeIdx = 0
    for (let i = 0; i < remaining.length; i++) {
      if (!removeSet.has(i)) remaining[writeIdx++] = remaining[i]
    }
    remaining.length = writeIdx
  }

  for (const m of remaining) {
    for (const date of dates) {
      if (!teamDates[m.home].has(date) && !teamDates[m.away].has(date)) {
        result.push({ home: m.home, away: m.away, date })
        teamDates[m.home].add(date)
        teamDates[m.away].add(date)
        break
      }
    }
  }

  result.sort((a, b) => a.date.localeCompare(b.date))
  return result
}

export function generateSeasonSchedule(teams: TeamInfo[], seasonYear: number): Game[] {
  const teamIds = teams.map(t => t.abbreviation)
  const matchups = generateMatchups(teamIds)
  const dates = generateDateSlots(seasonYear)
  const scheduled = assignDates(matchups, dates, teamIds)

  let gameNumber = 0
  return scheduled.map(g => ({
    id: uuid(),
    homeTeamId: g.home,
    awayTeamId: g.away,
    seasonYear,
    gameNumber: ++gameNumber,
    gameType: 'regular_season' as const,
    playoffSeries: null,
    date: g.date,
    status: 'scheduled' as const,
    result: null,
  }))
}
