import type { Game, GameResult } from '../types'
import type { Player } from '../types/player'
import type { Team } from '../types'
import type { StaffRoster } from '../types/staff'
import type { PlayoffSeries, PlayoffBracket } from './playoff-engine'
import { quickSimGame, type CoachingContext } from './quick-sim'
import {
  conferenceStandings,
  generateFirstRound,
  generateNextRoundSeries,
} from './playoff-engine'

export interface PlayoffContext {
  restDays: number
  previousSeriesLength: number
  isEliminationGame: boolean
  isCloseoutGame: boolean
  gameNumberInSeries: number
  seriesDeficit: number
  opponentRestDays: number
  opponentPreviousSeriesLength: number
}

export interface PlayoffPlayerModifier {
  playoffRiser: number
  clutchBoost: number
  veteranBoost: number
  leadershipAura: number
}

export interface SeriesGameResult {
  gameNumber: number
  result: GameResult
  homeTeamId: string
  awayTeamId: string
}

export interface SeriesResult {
  seriesId: string
  winnerId: string
  loserId: string
  gamesPlayed: number
  higherSeedWins: number
  lowerSeedWins: number
  gameResults: SeriesGameResult[]
  mvpId: string | null
}

export interface PlayInGameResult {
  conference: 'Eastern' | 'Western'
  label: string
  homeTeamId: string
  awayTeamId: string
  homeScore: number
  awayScore: number
  winnerId: string
}

export interface PlayoffResults {
  bracket: PlayoffBracket
  seriesResults: SeriesResult[]
  championId: string
  finalsLoserId: string
  playoffMvpId: string | null
  playInResults?: PlayInGameResult[]
}

function seededRandom(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function seededGauss(rng: () => number): number {
  let u = 0, v = 0
  while (u === 0) u = rng()
  while (v === 0) v = rng()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

function computePlayoffPlayerModifier(
  player: Player,
  rng: () => number,
): PlayoffPlayerModifier {
  const clutch = player.character.clutch ?? 50
  const competitiveness = player.character.competitiveness ?? 50
  const leadership = player.character.leadership ?? 50
  const ego = player.character.ego ?? 50
  const coachability = player.character.coachability ?? 50
  const age = player.bio.yearsInLeague

  // Playoff riser/faller: high competitiveness + clutch = riser, high ego + low clutch = faller
  const riserBase = (competitiveness - 50) * 0.03 + (clutch - 50) * 0.02
  const fallerRisk = ego > 75 && clutch < 40 ? -2.0 : 0
  const variance = seededGauss(rng) * 1.5
  const playoffRiser = riserBase + fallerRisk + variance

  // Clutch boost: directly from character.clutch
  const clutchBoost = (clutch - 50) * 0.04

  // Veteran boost: experience matters in playoffs
  let veteranBoost = 0
  if (age >= 8) veteranBoost = 1.5
  else if (age >= 5) veteranBoost = 0.8
  else if (age <= 1) veteranBoost = -1.5
  else if (age <= 2) veteranBoost = -0.8

  // Leadership aura: high leadership players lift their teammates
  const leadershipAura = leadership >= 80 ? 0.5 : leadership >= 65 ? 0.2 : 0

  return { playoffRiser, clutchBoost, veteranBoost, leadershipAura }
}

function computeTeamPlayoffStrength(
  players: Player[],
  staff: StaffRoster | null,
  context: PlayoffContext,
  rng: () => number,
): number {
  if (players.length === 0) return 70

  const sorted = [...players].sort((a, b) => b.ratings.overall - a.ratings.overall)
  const top8 = sorted.slice(0, Math.min(8, sorted.length))
  const weights = [1.4, 1.3, 1.2, 1.1, 1.0, 0.9, 0.8, 0.7]

  let weightedSum = 0
  let weightTotal = 0
  let totalLeadershipAura = 0
  let totalVeteranBoost = 0

  for (let i = 0; i < top8.length; i++) {
    const w = weights[i] ?? 0.7
    const mod = computePlayoffPlayerModifier(top8[i], rng)

    const adjustedOvr = top8[i].ratings.overall + mod.playoffRiser + mod.veteranBoost
    weightedSum += adjustedOvr * w
    weightTotal += w
    totalLeadershipAura += mod.leadershipAura
    totalVeteranBoost += mod.veteranBoost
  }

  let strength = weightedSum / weightTotal

  // Leadership bonus (capped)
  strength += Math.min(totalLeadershipAura, 2.0)

  // Rest advantage: sweeps earn recovery, game 7s drain
  const restBonus = computeRestBonus(context.restDays, context.previousSeriesLength)
  strength += restBonus

  // Opponent fatigue comparison
  const oppRestBonus = computeRestBonus(context.opponentRestDays, context.opponentPreviousSeriesLength)
  strength += (restBonus - oppRestBonus) * 0.3

  // Elimination game intensity: down in series, backs against wall
  if (context.isEliminationGame) {
    const desperation = Math.min(context.seriesDeficit, 3) * 0.8
    const clutchAvg = top8.reduce((s, p) => s + (p.character.clutch ?? 50), 0) / top8.length
    strength += desperation * (clutchAvg / 50) * 0.5
  }

  // Closeout game pressure: teams trying to clinch can tighten up
  if (context.isCloseoutGame) {
    const leadershipAvg = top8.reduce((s, p) => s + (p.character.leadership ?? 50), 0) / top8.length
    strength += (leadershipAvg - 50) * 0.02
  }

  // Coaching: adaptability drives series adjustments
  if (staff) {
    const hc = staff.headCoach
    const baseCoaching = (hc.offenseRating - 50) / 100 * 2.0
      + (hc.defenseRating - 50) / 100 * 2.0
      + (hc.experience - 50) / 100 * 1.0

    // Adaptability: losing team's coach makes adjustments as series progresses
    const gameNum = context.gameNumberInSeries
    const adjustmentBonus = context.seriesDeficit > 0
      ? (hc.adaptability / 100) * Math.min(gameNum - 1, 4) * 0.4
      : 0

    // Clutch coaching amplified in playoffs
    const clutchCoachBoost = (hc.personality.clutchCoaching - 50) / 100 * 1.5

    // Coach chemistry with players
    let chemistryMod = 0
    for (const p of top8) {
      const ego = p.character.ego ?? 50
      const coachability = p.character.coachability ?? 50
      if (hc.personality.temperament > 70 && coachability > 70) chemistryMod += 0.08
      if (hc.personality.temperament < 30 && ego > 80 && coachability < 40) chemistryMod -= 0.3
    }

    strength += baseCoaching + adjustmentBonus + clutchCoachBoost + chemistryMod

    // Assistant coach playoff boost
    for (const ac of staff.assistantCoaches) {
      strength += (ac.generalRating - 50) / 100 * 0.2
    }
  }

  // Team chemistry: higher = more consistent, less variance in performance
  // Chemistry is already on the team object but we don't have it here,
  // so we approximate from player coachability and leadership averages
  const avgCoachability = top8.reduce((s, p) => s + (p.character.coachability ?? 50), 0) / top8.length
  const avgLeadership = top8.reduce((s, p) => s + (p.character.leadership ?? 50), 0) / top8.length
  const teamCohesion = (avgCoachability + avgLeadership) / 100
  strength += teamCohesion * 0.5

  return strength
}

function computeRestBonus(restDays: number, previousSeriesLength: number): number {
  // Quick series = well-rested = bonus
  // Long series = fatigued = penalty
  let restBonus = 0

  // Rest days between series
  if (restDays >= 5) restBonus += 1.5
  else if (restDays >= 3) restBonus += 0.8
  else if (restDays <= 1) restBonus -= 1.0

  // Previous series fatigue
  if (previousSeriesLength <= 4) restBonus += 1.2  // sweep
  else if (previousSeriesLength === 5) restBonus += 0.5
  else if (previousSeriesLength === 6) restBonus -= 0.3
  else if (previousSeriesLength >= 7) restBonus -= 1.5 // grueling 7-game

  return restBonus
}

function computePlayoffClutchScore(players: Player[]): number {
  const sorted = [...players].sort((a, b) => b.ratings.overall - a.ratings.overall)
  const top5 = sorted.slice(0, 5)
  return top5.reduce((s, p) => s + (p.character.clutch ?? 50), 0) / top5.length
}

export function simulatePlayoffGame(
  game: Game,
  homePlayers: Player[],
  awayPlayers: Player[],
  coaching: CoachingContext,
  homeContext: PlayoffContext,
  awayContext: PlayoffContext,
  seed: number,
): GameResult {
  const rng = seededRandom(seed)

  const homeStr = computeTeamPlayoffStrength(homePlayers, coaching.homeStaff, homeContext, rng)
  const awayStr = computeTeamPlayoffStrength(awayPlayers, coaching.awayStaff, awayContext, rng)

  // Home court advantage amplified in playoffs (especially for higher seed)
  const homeAdv = 4.0

  const diff = homeStr - awayStr + homeAdv
  const spread = diff * 0.85 + seededGauss(rng) * 10

  const basePPG = 106 // playoffs tend to be lower-scoring
  let homeScore = Math.round(basePPG + spread / 2 + seededGauss(rng) * 4)
  let awayScore = Math.round(basePPG - spread / 2 + seededGauss(rng) * 4)

  homeScore = Math.max(78, homeScore)
  awayScore = Math.max(78, awayScore)

  // Clutch factor in close games (within 6 points)
  if (Math.abs(homeScore - awayScore) <= 6) {
    const homeClutch = computePlayoffClutchScore(homePlayers)
    const awayClutch = computePlayoffClutchScore(awayPlayers)

    const coachClutchHome = coaching.homeStaff?.headCoach.personality.clutchCoaching ?? 50
    const coachClutchAway = coaching.awayStaff?.headCoach.personality.clutchCoaching ?? 50

    const clutchDiff = ((homeClutch - awayClutch) * 0.06) + ((coachClutchHome - coachClutchAway) / 100 * 2)
    homeScore += Math.round(clutchDiff + seededGauss(rng) * 0.3)
    awayScore -= Math.round(clutchDiff * 0.4)
  }

  // Elimination game intensity: facing elimination team gets adrenaline boost
  if (homeContext.isEliminationGame && !awayContext.isEliminationGame) {
    homeScore += Math.round(1.5 + seededGauss(rng) * 0.5)
  } else if (awayContext.isEliminationGame && !homeContext.isEliminationGame) {
    awayScore += Math.round(1.5 + seededGauss(rng) * 0.5)
  }

  homeScore = Math.max(78, homeScore)
  awayScore = Math.max(78, awayScore)

  // No ties in playoffs
  let overtime = 0
  while (homeScore === awayScore) {
    overtime++
    const otHome = Math.round(5 + seededGauss(rng) * 3)
    const otAway = Math.round(5 + seededGauss(rng) * 3)
    homeScore += Math.max(0, otHome)
    awayScore += Math.max(0, otAway)
  }

  // Use quickSimGame for box score generation but override scores
  const baseResult = quickSimGame(game, homePlayers, awayPlayers, coaching)

  return {
    ...baseResult,
    homeScore,
    awayScore,
    overtime,
    winningTeamId: homeScore > awayScore ? game.homeTeamId : game.awayTeamId,
  }
}

export function simulatePlayoffSeries(
  series: PlayoffSeries,
  getPlayers: (teamId: string) => Player[],
  getStaff: (teamId: string) => StaffRoster | null,
  previousSeriesLength: number,
  opponentPreviousSeriesLength: number,
  restDays: number,
  opponentRestDays: number,
  baseSeed: number,
): SeriesResult {
  let higherWins = 0
  let lowerWins = 0
  const gameResults: SeriesGameResult[] = []
  const playerPointTotals = new Map<string, number>()

  for (let gameIdx = 0; gameIdx < 7; gameIdx++) {
    if (higherWins >= 4 || lowerWins >= 4) break

    const game = series.games[gameIdx]
    if (!game) break

    const homeTeamId = game.homeTeamId
    const awayTeamId = game.awayTeamId
    const homePlayers = getPlayers(homeTeamId)
    const awayPlayers = getPlayers(awayTeamId)

    const homeIsHigherSeed = homeTeamId === series.higherSeed.teamId
    const homeWins = homeIsHigherSeed ? higherWins : lowerWins
    const homeLosses = homeIsHigherSeed ? lowerWins : higherWins
    const awayWins = homeIsHigherSeed ? lowerWins : higherWins
    const awayLosses = homeIsHigherSeed ? higherWins : lowerWins

    const homeContext: PlayoffContext = {
      restDays: gameIdx === 0 ? restDays : 2,
      previousSeriesLength: gameIdx === 0 ? previousSeriesLength : 0,
      isEliminationGame: homeLosses === 3,
      isCloseoutGame: homeWins === 3,
      gameNumberInSeries: gameIdx + 1,
      seriesDeficit: Math.max(0, awayWins - homeWins),
      opponentRestDays: gameIdx === 0 ? opponentRestDays : 2,
      opponentPreviousSeriesLength: gameIdx === 0 ? opponentPreviousSeriesLength : 0,
    }

    const awayContext: PlayoffContext = {
      restDays: gameIdx === 0 ? opponentRestDays : 2,
      previousSeriesLength: gameIdx === 0 ? opponentPreviousSeriesLength : 0,
      isEliminationGame: awayLosses === 3,
      isCloseoutGame: awayWins === 3,
      gameNumberInSeries: gameIdx + 1,
      seriesDeficit: Math.max(0, homeWins - awayWins),
      opponentRestDays: gameIdx === 0 ? restDays : 2,
      opponentPreviousSeriesLength: gameIdx === 0 ? previousSeriesLength : 0,
    }

    const coaching: CoachingContext = {
      homeStaff: getStaff(homeTeamId),
      awayStaff: getStaff(awayTeamId),
    }

    const result = simulatePlayoffGame(
      game, homePlayers, awayPlayers, coaching,
      homeContext, awayContext,
      baseSeed + gameIdx * 997,
    )

    // Track MVP stats
    const winnerBox = result.winningTeamId === homeTeamId
      ? result.homeBoxScore : result.awayBoxScore
    for (const ps of winnerBox.playerStats) {
      playerPointTotals.set(ps.playerId, (playerPointTotals.get(ps.playerId) ?? 0) + ps.points)
    }
    const loserBox = result.winningTeamId === homeTeamId
      ? result.awayBoxScore : result.homeBoxScore
    for (const ps of loserBox.playerStats) {
      playerPointTotals.set(ps.playerId, (playerPointTotals.get(ps.playerId) ?? 0) + ps.points)
    }

    if (result.winningTeamId === series.higherSeed.teamId) {
      higherWins++
    } else {
      lowerWins++
    }

    gameResults.push({
      gameNumber: gameIdx + 1,
      result,
      homeTeamId,
      awayTeamId,
    })
  }

  const winnerId = higherWins >= 4 ? series.higherSeed.teamId : series.lowerSeed.teamId
  const loserId = winnerId === series.higherSeed.teamId
    ? series.lowerSeed.teamId : series.higherSeed.teamId

  // Series MVP: highest total points from winning team
  const winnerPlayers = getPlayers(winnerId)
  const winnerIds = new Set(winnerPlayers.map(p => p.id))
  let mvpId: string | null = null
  let mvpPoints = 0
  for (const [pid, pts] of playerPointTotals) {
    if (winnerIds.has(pid) && pts > mvpPoints) {
      mvpPoints = pts
      mvpId = pid
    }
  }

  return {
    seriesId: series.id,
    winnerId,
    loserId,
    gamesPlayed: gameResults.length,
    higherSeedWins: higherWins,
    lowerSeedWins: lowerWins,
    gameResults,
    mvpId,
  }
}

/**
 * NBA-style play-in for one conference: 7 hosts 8 (winner takes the 7
 * seed), 9 hosts 10 (loser eliminated), and the 7/8 loser hosts the
 * 9/10 winner for the 8 seed. Single elimination games.
 */
function simulatePlayInForConference(
  standings: { teamId: string; seed: number; wins: number; losses: number }[],
  conference: 'Eastern' | 'Western',
  getPlayers: (teamId: string) => Player[],
  getStaff: (teamId: string) => StaffRoster | null,
  seasonYear: number,
  startDate: string,
): { finalSeeds: { teamId: string; seed: number; wins: number; losses: number }[]; games: PlayInGameResult[] } {
  if (standings.length < 10) {
    return { finalSeeds: standings.slice(0, 8), games: [] }
  }

  const games: PlayInGameResult[] = []

  const playGame = (homeId: string, awayId: string, label: string, dayOffset: number): PlayInGameResult => {
    const game: Game = {
      id: `play-in-${conference}-${label}-${seasonYear}`,
      homeTeamId: homeId,
      awayTeamId: awayId,
      seasonYear,
      gameNumber: 0,
      gameType: 'playoff',
      playoffSeries: null,
      date: addDays(startDate, dayOffset),
      status: 'scheduled',
      result: null,
    }
    const coaching: CoachingContext = {
      homeStaff: getStaff(homeId),
      awayStaff: getStaff(awayId),
    }
    const result = quickSimGame(game, getPlayers(homeId), getPlayers(awayId), coaching)
    const record: PlayInGameResult = {
      conference,
      label,
      homeTeamId: homeId,
      awayTeamId: awayId,
      homeScore: result.homeScore,
      awayScore: result.awayScore,
      winnerId: result.winningTeamId,
    }
    games.push(record)
    return record
  }

  const s7 = standings[6], s8 = standings[7], s9 = standings[8], s10 = standings[9]

  const g1 = playGame(s7.teamId, s8.teamId, '7th vs 8th', 0)
  const g2 = playGame(s9.teamId, s10.teamId, '9th vs 10th', 0)
  const g1Loser = g1.winnerId === s7.teamId ? s8 : s7
  const g3 = playGame(g1Loser.teamId, g2.winnerId, '8th Seed Game', 2)

  const byId = new Map(standings.map(s => [s.teamId, s]))
  const seed7Team = byId.get(g1.winnerId)!
  const seed8Team = byId.get(g3.winnerId)!

  const finalSeeds = [
    ...standings.slice(0, 6),
    { ...seed7Team, seed: 7 },
    { ...seed8Team, seed: 8 },
  ]

  return { finalSeeds, games }
}

export function simulateEntirePlayoffs(
  teams: Team[],
  players: Player[],
  seasonYear: number,
  startDate: string,
  seed: number,
  playoffFormat: 'traditional_16' | 'play_in' = 'play_in',
): PlayoffResults {
  const playersByTeam = new Map<string, Player[]>()
  for (const p of players) {
    const arr = playersByTeam.get(p.teamId) ?? []
    arr.push(p)
    playersByTeam.set(p.teamId, arr)
  }

  const staffByTeam = new Map<string, StaffRoster | null>()
  for (const t of teams) {
    staffByTeam.set(t.id, t.staff ?? null)
  }

  const getPlayers = (teamId: string) => playersByTeam.get(teamId) ?? []
  const getStaff = (teamId: string) => staffByTeam.get(teamId) ?? null

  let eastSeeds: { teamId: string; seed: number; wins: number; losses: number }[]
  let westSeeds: { teamId: string; seed: number; wins: number; losses: number }[]
  const playInResults: PlayInGameResult[] = []

  if (playoffFormat === 'play_in') {
    const eastPlayIn = simulatePlayInForConference(
      conferenceStandings(teams, 'Eastern', 10), 'Eastern', getPlayers, getStaff, seasonYear, startDate,
    )
    const westPlayIn = simulatePlayInForConference(
      conferenceStandings(teams, 'Western', 10), 'Western', getPlayers, getStaff, seasonYear, startDate,
    )
    eastSeeds = eastPlayIn.finalSeeds
    westSeeds = westPlayIn.finalSeeds
    playInResults.push(...eastPlayIn.games, ...westPlayIn.games)
  } else {
    eastSeeds = conferenceStandings(teams, 'Eastern', 8)
    westSeeds = conferenceStandings(teams, 'Western', 8)
  }

  const allSeries: PlayoffSeries[] = []
  const allResults: SeriesResult[] = []

  // Track rest/fatigue per team across rounds
  const teamPrevSeriesLength = new Map<string, number>()
  const teamRestDays = new Map<string, number>()

  function simRound(
    seriesList: PlayoffSeries[],
    roundSeed: number,
  ): { teamId: string; seed: number }[] {
    const winners: { teamId: string; seed: number }[] = []

    for (let si = 0; si < seriesList.length; si++) {
      const series = seriesList[si]
      allSeries.push(series)

      const hiPrevLen = teamPrevSeriesLength.get(series.higherSeed.teamId) ?? 0
      const loPrevLen = teamPrevSeriesLength.get(series.lowerSeed.teamId) ?? 0
      const hiRest = teamRestDays.get(series.higherSeed.teamId) ?? 5
      const loRest = teamRestDays.get(series.lowerSeed.teamId) ?? 5

      const result = simulatePlayoffSeries(
        series, getPlayers, getStaff,
        hiPrevLen, loPrevLen,
        hiRest, loRest,
        roundSeed + si * 31337,
      )
      allResults.push(result)

      // Update series state
      series.higherSeedWins = result.higherSeedWins
      series.lowerSeedWins = result.lowerSeedWins
      series.winnerId = result.winnerId

      // Track rest for next round
      teamPrevSeriesLength.set(result.winnerId, result.gamesPlayed)
      const restBetweenRounds = Math.max(2, 7 - result.gamesPlayed + 2)
      teamRestDays.set(result.winnerId, restBetweenRounds)

      const winnerSeed = result.winnerId === series.higherSeed.teamId
        ? series.higherSeed.seed : series.lowerSeed.seed
      winners.push({ teamId: result.winnerId, seed: winnerSeed })
    }

    return winners
  }

  // Round 1 (pushed back a few days when the play-in ran)
  const r1Start = playInResults.length > 0 ? addDays(startDate, 4) : startDate
  const eastR1 = generateFirstRound(eastSeeds, 'Eastern', seasonYear, r1Start)
  const westR1 = generateFirstRound(westSeeds, 'Western', seasonYear, r1Start)
  const eastR1Winners = simRound(eastR1, seed)
  const westR1Winners = simRound(westR1, seed + 100000)

  // Round 2 (Conference Semis)
  const r2Start = addDays(startDate, 18)
  const eastR2 = generateNextRoundSeries(eastR1Winners, 2, 'Eastern', seasonYear, r2Start)
  const westR2 = generateNextRoundSeries(westR1Winners, 2, 'Western', seasonYear, r2Start)
  const eastR2Winners = simRound(eastR2, seed + 200000)
  const westR2Winners = simRound(westR2, seed + 300000)

  // Conference Finals
  const r3Start = addDays(startDate, 36)
  const eastCF = generateNextRoundSeries(eastR2Winners, 3, 'Eastern', seasonYear, r3Start)
  const westCF = generateNextRoundSeries(westR2Winners, 3, 'Western', seasonYear, r3Start)
  const eastCFWinners = simRound(eastCF, seed + 400000)
  const westCFWinners = simRound(westCF, seed + 500000)

  // Finals
  const finalsStart = addDays(startDate, 54)
  const finalists = [...eastCFWinners, ...westCFWinners]
  const finals = generateNextRoundSeries(
    finalists, 4, 'Finals', seasonYear, finalsStart,
  )
  const champion = simRound(finals, seed + 600000)

  // Determine playoff MVP: player with most total points from finals winner
  const finalsResult = allResults[allResults.length - 1]
  const playoffMvpId = finalsResult?.mvpId ?? null

  const championId = champion[0]?.teamId ?? ''
  const finalsLoserId = finalsResult?.loserId ?? ''

  return {
    bracket: {
      season: seasonYear,
      series: allSeries,
      championId,
    },
    seriesResults: allResults,
    championId,
    finalsLoserId,
    playoffMvpId,
    playInResults: playInResults.length > 0 ? playInResults : undefined,
  }
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
