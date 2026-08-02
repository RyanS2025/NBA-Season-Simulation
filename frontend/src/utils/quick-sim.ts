import type { Game, GameResult, PlayerGameStats, TeamBoxScore, TeamGameStats } from '../types'
import type { Player } from '../types/player'

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function gauss(): number {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

function teamStrength(players: Player[]): number {
  if (players.length === 0) return 70
  const sorted = [...players].sort((a, b) => b.ratings.overall - a.ratings.overall)
  const top8 = sorted.slice(0, Math.min(8, sorted.length))
  const weights = [1.4, 1.3, 1.2, 1.1, 1.0, 0.9, 0.8, 0.7]
  let weightedSum = 0
  let weightTotal = 0
  for (let i = 0; i < top8.length; i++) {
    const w = weights[i] ?? 0.7
    weightedSum += top8[i].ratings.overall * w
    weightTotal += w
  }
  return weightedSum / weightTotal
}

function simulatePlayerStats(
  player: Player,
  minutes: number,
  _teamPace: number,
  isWinner: boolean,
): PlayerGameStats {
  const ovr = player.ratings.overall
  const minuteFactor = minutes / 36

  const fga = Math.round(clamp(minuteFactor * (6 + (ovr - 70) * 0.25 + gauss() * 2), 0, 30))
  const fgPct = clamp(0.38 + (ovr - 70) * 0.003 + gauss() * 0.05, 0.25, 0.65)
  const fgm = Math.round(fga * fgPct)

  const threeRate = clamp(0.25 + (player.ratings.threePoint - 70) * 0.005, 0.05, 0.55)
  const tpa = Math.round(fga * threeRate)
  const threePct = clamp(0.30 + (player.ratings.threePoint - 70) * 0.004 + gauss() * 0.06, 0.15, 0.55)
  const tpm = Math.round(tpa * threePct)

  const ftRate = clamp(minuteFactor * (1.5 + (ovr - 70) * 0.08 + gauss() * 1), 0, 12)
  const fta = Math.round(ftRate)
  const ftPct = clamp(0.70 + (player.ratings.freeThrow - 70) * 0.005 + gauss() * 0.04, 0.40, 0.95)
  const ftm = Math.round(fta * ftPct)

  const points = (fgm - tpm) * 2 + tpm * 3 + ftm

  const reb = Math.round(clamp(minuteFactor * (2 + (player.ratings.rebounding - 60) * 0.1 + gauss() * 1.5), 0, 20))
  const oreb = Math.round(reb * clamp(0.2 + (player.ratings.offensiveRebounding - 60) * 0.003, 0.1, 0.4))
  const dreb = reb - oreb

  const ast = Math.round(clamp(minuteFactor * (1 + (player.ratings.passingVision - 60) * 0.08 + gauss() * 1), 0, 15))
  const stl = Math.round(clamp(minuteFactor * (0.3 + (player.ratings.stealing - 60) * 0.02 + gauss() * 0.4), 0, 5))
  const blk = Math.round(clamp(minuteFactor * (0.1 + (player.ratings.shotBlocking - 60) * 0.02 + gauss() * 0.3), 0, 5))
  const tov = Math.round(clamp(minuteFactor * (0.8 + (90 - player.ratings.ballHandling) * 0.02 + gauss() * 0.5), 0, 8))
  const pf = Math.round(clamp(minuteFactor * (1.2 + gauss() * 0.5), 0, 6))

  return {
    playerId: player.id,
    minutes: Math.round(minutes * 10) / 10,
    points,
    fieldGoalsMade: fgm,
    fieldGoalsAttempted: fga,
    threePointersMade: tpm,
    threePointersAttempted: tpa,
    freeThrowsMade: ftm,
    freeThrowsAttempted: fta,
    offensiveRebounds: oreb,
    defensiveRebounds: dreb,
    totalRebounds: reb,
    assists: ast,
    steals: stl,
    blocks: blk,
    turnovers: tov,
    personalFouls: pf,
    plusMinus: isWinner ? Math.round(gauss() * 8 + 3) : Math.round(gauss() * 8 - 3),
    shotChart: [],
  }
}

function generateMinutes(players: Player[]): number[] {
  const sorted = [...players]
    .map((p, i) => ({ ovr: p.ratings.overall, idx: i }))
    .sort((a, b) => b.ovr - a.ovr)

  const targets = [34, 32, 31, 30, 28, 20, 16, 12, 8, 4, 2, 1, 1, 0, 0]
  const minutes = new Array(players.length).fill(0)

  for (let rank = 0; rank < sorted.length; rank++) {
    const base = targets[Math.min(rank, targets.length - 1)]
    minutes[sorted[rank].idx] = Math.max(0, base + Math.round(gauss() * 2))
  }

  const total = minutes.reduce((s, m) => s + m, 0)
  const target = 240
  if (total > 0) {
    const scale = target / total
    for (let i = 0; i < minutes.length; i++) {
      minutes[i] = Math.round(minutes[i] * scale * 10) / 10
    }
  }

  return minutes
}

function buildBoxScore(
  teamId: string,
  players: Player[],
  teamScore: number,
  isWinner: boolean,
  pace: number,
): TeamBoxScore {
  const minutes = generateMinutes(players)

  const playerStats = players.map((p, i) =>
    simulatePlayerStats(p, minutes[i], pace, isWinner)
  )

  const rawTotal = playerStats.reduce((s, ps) => s + ps.points, 0)
  if (rawTotal > 0 && rawTotal !== teamScore) {
    const topIdx = playerStats.reduce((best, ps, i) =>
      ps.points > playerStats[best].points ? i : best, 0)
    playerStats[topIdx].points += teamScore - rawTotal
  }

  const teamStats: TeamGameStats = {
    fastBreakPoints: Math.round(teamScore * clamp(0.08 + gauss() * 0.03, 0.03, 0.15)),
    pointsInPaint: Math.round(teamScore * clamp(0.40 + gauss() * 0.05, 0.30, 0.55)),
    secondChancePoints: Math.round(teamScore * clamp(0.10 + gauss() * 0.03, 0.04, 0.18)),
    benchPoints: Math.round(teamScore * clamp(0.30 + gauss() * 0.08, 0.15, 0.50)),
    turnovers: playerStats.reduce((s, ps) => s + ps.turnovers, 0),
    teamRebounds: Math.round(2 + gauss() * 1),
    biggestLead: isWinner ? Math.round(Math.abs(gauss()) * 12 + 5) : Math.round(Math.abs(gauss()) * 5),
    pace,
  }

  return { teamId, playerStats, teamStats }
}

export function quickSimGame(
  game: Game,
  homePlayers: Player[],
  awayPlayers: Player[],
): GameResult {
  const homeStr = teamStrength(homePlayers)
  const awayStr = teamStrength(awayPlayers)

  const homeAdv = 3.0
  const diff = homeStr - awayStr + homeAdv
  const spread = diff * 0.8 + gauss() * 12

  const pace = clamp(96 + gauss() * 4, 88, 108)
  const basePPG = 110

  let homeScore = Math.round(basePPG + spread / 2 + gauss() * 5)
  let awayScore = Math.round(basePPG - spread / 2 + gauss() * 5)

  homeScore = Math.max(75, homeScore)
  awayScore = Math.max(75, awayScore)

  let overtime = 0
  while (homeScore === awayScore) {
    overtime++
    const otHome = Math.round(5 + gauss() * 3)
    const otAway = Math.round(5 + gauss() * 3)
    homeScore += Math.max(0, otHome)
    awayScore += Math.max(0, otAway)
  }

  const isHomeWinner = homeScore > awayScore
  const winningTeamId = isHomeWinner ? game.homeTeamId : game.awayTeamId

  const homeBox = buildBoxScore(game.homeTeamId, homePlayers, homeScore, isHomeWinner, pace)
  const awayBox = buildBoxScore(game.awayTeamId, awayPlayers, awayScore, !isHomeWinner, pace)

  const q1h = Math.round(homeScore * (0.24 + gauss() * 0.02))
  const q2h = Math.round(homeScore * (0.25 + gauss() * 0.02))
  const q3h = Math.round(homeScore * (0.25 + gauss() * 0.02))
  const q4h = homeScore - q1h - q2h - q3h

  const q1a = Math.round(awayScore * (0.24 + gauss() * 0.02))
  const q2a = Math.round(awayScore * (0.25 + gauss() * 0.02))
  const q3a = Math.round(awayScore * (0.25 + gauss() * 0.02))
  const q4a = awayScore - q1a - q2a - q3a

  return {
    homeScore,
    awayScore,
    overtime,
    winningTeamId,
    homeBoxScore: homeBox,
    awayBoxScore: awayBox,
    quarterScores: {
      home: [q1h, q2h, q3h, q4h],
      away: [q1a, q2a, q3a, q4a],
    },
  }
}
