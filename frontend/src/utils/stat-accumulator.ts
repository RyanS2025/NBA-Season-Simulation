import type { GameResult, PlayerGameStats } from '../types'
import type { Player, SeasonStats } from '../types/player'

function round1(v: number): number {
  return Math.round(v * 10) / 10
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000
}

function emptySeasonEntry(seasonYear: number, teamAbbr: string): SeasonStats {
  return {
    season: String(seasonYear),
    team: teamAbbr,
    gp: 0, gs: 0, mpg: 0,
    ppg: 0, rpg: 0, apg: 0, spg: 0, bpg: 0, topg: 0,
    fgm: 0, fga: 0, fg_pct: 0,
    three_pm: 0, three_pa: 0, three_pct: 0,
    ftm: 0, fta: 0, ft_pct: 0,
    orpg: 0, drpg: 0, pfpg: 0,
  }
}

function addGameToEntry(entry: SeasonStats, game: PlayerGameStats, started: boolean, teamAbbr: string): void {
  const prevGp = entry.gp

  // SeasonStats stores per-game averages, so rebuild running totals from
  // the existing averages before folding in the new game.
  const totalMin = entry.mpg * prevGp + game.minutes
  const totalPts = entry.ppg * prevGp + game.points
  const totalReb = entry.rpg * prevGp + game.totalRebounds
  const totalAst = entry.apg * prevGp + game.assists
  const totalStl = entry.spg * prevGp + game.steals
  const totalBlk = entry.bpg * prevGp + game.blocks
  const totalTov = entry.topg * prevGp + game.turnovers
  const totalFgm = entry.fgm * prevGp + game.fieldGoalsMade
  const totalFga = entry.fga * prevGp + game.fieldGoalsAttempted
  const total3pm = entry.three_pm * prevGp + game.threePointersMade
  const total3pa = entry.three_pa * prevGp + game.threePointersAttempted
  const totalFtm = entry.ftm * prevGp + game.freeThrowsMade
  const totalFta = entry.fta * prevGp + game.freeThrowsAttempted
  const totalOreb = entry.orpg * prevGp + game.offensiveRebounds
  const totalDreb = entry.drpg * prevGp + game.defensiveRebounds
  const totalPf = entry.pfpg * prevGp + game.personalFouls

  const gp = prevGp + 1
  entry.gp = gp
  if (started) entry.gs += 1
  entry.team = teamAbbr

  entry.mpg = round1(totalMin / gp)
  entry.ppg = round1(totalPts / gp)
  entry.rpg = round1(totalReb / gp)
  entry.apg = round1(totalAst / gp)
  entry.spg = round1(totalStl / gp)
  entry.bpg = round1(totalBlk / gp)
  entry.topg = round1(totalTov / gp)
  entry.fgm = round1(totalFgm / gp)
  entry.fga = round1(totalFga / gp)
  entry.fg_pct = totalFga > 0 ? round3(totalFgm / totalFga) : 0
  entry.three_pm = round1(total3pm / gp)
  entry.three_pa = round1(total3pa / gp)
  entry.three_pct = total3pa > 0 ? round3(total3pm / total3pa) : 0
  entry.ftm = round1(totalFtm / gp)
  entry.fta = round1(totalFta / gp)
  entry.ft_pct = totalFta > 0 ? round3(totalFtm / totalFta) : 0
  entry.orpg = round1(totalOreb / gp)
  entry.drpg = round1(totalDreb / gp)
  entry.pfpg = round1(totalPf / gp)
}

/**
 * Fold one team's box score from a completed game into each player's
 * careerStats entry for the current simulated season. A new SeasonStats
 * entry is appended the first time a player logs minutes in a season, so
 * imported real-NBA history is preserved untouched.
 *
 * Mutates the matched Player objects in place and returns them so callers
 * can batch-persist to IndexedDB.
 */
export function accumulateGameStats(
  players: Player[],
  gameResult: GameResult,
  seasonYear: number,
  teamId: string,
  teamAbbr: string,
): Player[] {
  const box = gameResult.homeBoxScore.teamId === teamId
    ? gameResult.homeBoxScore
    : gameResult.awayBoxScore.teamId === teamId
      ? gameResult.awayBoxScore
      : null
  if (!box) return []

  const playerMap = new Map(players.map(p => [p.id, p]))
  const season = String(seasonYear)

  // Starters = the five players who logged the most minutes in this game.
  const starterIds = new Set(
    [...box.playerStats]
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 5)
      .map(s => s.playerId),
  )

  const modified: Player[] = []

  for (const gameStats of box.playerStats) {
    if (gameStats.minutes <= 0) continue
    const player = playerMap.get(gameStats.playerId)
    if (!player) continue

    if (!player.careerStats) player.careerStats = []
    let entry = player.careerStats.find(s => s.season === season)
    if (!entry) {
      entry = emptySeasonEntry(seasonYear, teamAbbr)
      player.careerStats.push(entry)
    }

    addGameToEntry(entry, gameStats, starterIds.has(gameStats.playerId), teamAbbr)
    modified.push(player)
  }

  return modified
}
