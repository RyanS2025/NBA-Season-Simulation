import type { Team, Game, PlayoffSeriesRef } from '../types'
import { v4 as uuid } from 'uuid'

export interface PlayoffSeries {
  id: string
  round: 1 | 2 | 3 | 4
  conference: 'Eastern' | 'Western' | 'Finals'
  higherSeed: { teamId: string; seed: number }
  lowerSeed: { teamId: string; seed: number }
  higherSeedWins: number
  lowerSeedWins: number
  games: Game[]
  winnerId: string | null
}

export interface PlayoffBracket {
  season: number
  series: PlayoffSeries[]
  championId: string | null
}

export function seedTeamsByConference(
  teams: Team[],
  conference: 'Eastern' | 'Western',
): { teamId: string; seed: number; wins: number; losses: number }[] {
  return teams
    .filter(t => t.info.conference === conference)
    .sort((a, b) => {
      const winPctA = a.seasonRecord.wins / Math.max(1, a.seasonRecord.wins + a.seasonRecord.losses)
      const winPctB = b.seasonRecord.wins / Math.max(1, b.seasonRecord.wins + b.seasonRecord.losses)
      if (winPctB !== winPctA) return winPctB - winPctA
      return b.seasonRecord.conferenceWins - a.seasonRecord.conferenceWins
    })
    .slice(0, 8)
    .map((t, i) => ({
      teamId: t.id,
      seed: i + 1,
      wins: t.seasonRecord.wins,
      losses: t.seasonRecord.losses,
    }))
}

export function generateFirstRound(
  seeds: { teamId: string; seed: number }[],
  conference: 'Eastern' | 'Western',
  seasonYear: number,
  startDate: string,
): PlayoffSeries[] {
  const matchups = [
    [0, 7], // 1 vs 8
    [3, 4], // 4 vs 5
    [2, 5], // 3 vs 6
    [1, 6], // 2 vs 7
  ]

  return matchups.map(([hiIdx, loIdx]) => {
    const hi = seeds[hiIdx]
    const lo = seeds[loIdx]
    const seriesId = uuid()

    const games = generateSeriesGames(
      seriesId, 1, hi.teamId, lo.teamId, seasonYear, startDate, conference,
    )

    return {
      id: seriesId,
      round: 1 as const,
      conference,
      higherSeed: hi,
      lowerSeed: lo,
      higherSeedWins: 0,
      lowerSeedWins: 0,
      games,
      winnerId: null,
    }
  })
}

export function generateNextRoundSeries(
  prevRoundWinners: { teamId: string; seed: number }[],
  round: 2 | 3 | 4,
  conference: 'Eastern' | 'Western' | 'Finals',
  seasonYear: number,
  startDate: string,
): PlayoffSeries[] {
  const sorted = [...prevRoundWinners].sort((a, b) => a.seed - b.seed)
  const series: PlayoffSeries[] = []

  for (let i = 0; i < sorted.length; i += 2) {
    const hi = sorted[i]
    const lo = sorted[i + 1]
    if (!hi || !lo) continue

    const seriesId = uuid()
    const games = generateSeriesGames(
      seriesId, round, hi.teamId, lo.teamId, seasonYear, startDate, conference,
    )

    series.push({
      id: seriesId,
      round,
      conference,
      higherSeed: hi,
      lowerSeed: lo,
      higherSeedWins: 0,
      lowerSeedWins: 0,
      games,
      winnerId: null,
    })
  }

  return series
}

function generateSeriesGames(
  seriesId: string,
  round: number,
  higherSeedTeamId: string,
  lowerSeedTeamId: string,
  seasonYear: number,
  startDate: string,
  _conference: string,
): Game[] {
  // 2-2-1-1-1 home court format
  const homePattern = [true, true, false, false, true, false, true]

  return homePattern.map((higherSeedHome, i) => {
    const gameDate = addDays(startDate, i * 2 + (round - 1) * 16)
    const homeTeamId = higherSeedHome ? higherSeedTeamId : lowerSeedTeamId
    const awayTeamId = higherSeedHome ? lowerSeedTeamId : higherSeedTeamId

    const ref: PlayoffSeriesRef = {
      seriesId,
      round: round as 1 | 2 | 3 | 4,
      higherSeedTeamId,
      lowerSeedTeamId,
      higherSeedWins: 0,
      lowerSeedWins: 0,
      gameNumberInSeries: i + 1,
    }

    return {
      id: uuid(),
      homeTeamId,
      awayTeamId,
      seasonYear,
      gameNumber: 1230 + round * 100 + i,
      gameType: 'playoff' as const,
      playoffSeries: ref,
      date: gameDate,
      status: 'scheduled' as const,
      result: null,
    }
  })
}

export function getSeriesStatus(series: PlayoffSeries): string {
  if (series.winnerId) {
    const winnerIsHigher = series.winnerId === series.higherSeed.teamId
    const wins = winnerIsHigher ? series.higherSeedWins : series.lowerSeedWins
    const losses = winnerIsHigher ? series.lowerSeedWins : series.higherSeedWins
    return `${wins}-${losses}`
  }
  if (series.higherSeedWins === 0 && series.lowerSeedWins === 0) {
    return 'Not Started'
  }
  return `${series.higherSeedWins}-${series.lowerSeedWins}`
}

export function isRegularSeasonComplete(teams: Team[], gamesPerSeason: number): boolean {
  const totalGamesPlayed = teams.reduce(
    (sum, t) => sum + t.seasonRecord.wins + t.seasonRecord.losses, 0,
  ) / 2
  const totalScheduled = (teams.length / 2) * gamesPerSeason
  return totalGamesPlayed >= totalScheduled * 0.95
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
