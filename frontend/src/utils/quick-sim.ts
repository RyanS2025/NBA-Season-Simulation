import type { Game, GameResult, PlayerGameStats, TeamBoxScore, TeamGameStats } from '../types'
import type { Player } from '../types/player'
import type { StaffRoster } from '../types/staff'
import type { CoachingStaff, OffensiveScheme, DefensiveScheme } from '../types/team'
import { isAvailable } from './player-condition'

export interface CoachingContext {
  homeStaff: StaffRoster | null
  awayStaff: StaffRoster | null
  homeCoaching?: CoachingStaff | null
  awayCoaching?: CoachingStaff | null
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function gauss(): number {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

function weighted(pairs: [number, number][]): number {
  let sum = 0, wsum = 0
  for (const [value, weight] of pairs) {
    sum += value * weight
    wsum += weight
  }
  return wsum > 0 ? sum / wsum : 70
}

/**
 * Position-weighted composite built from raw individual skills. This is
 * the sim's measure of how good a player is — the cosmetic overall
 * rating is never consulted.
 */
export function playerComposite(p: Player): number {
  const r = p.ratings
  const pos = p.bio.position
  if (pos === 'PG' || pos === 'SG') {
    return weighted([
      [r.ballHandling, 1.2], [r.passingVision, 1.0], [r.threePoint, 1.1],
      [r.midRange, 0.8], [r.finishing, 0.9], [r.perimeterDefense, 0.7],
      [r.speed, 0.5], [r.basketballIq, 0.6],
    ])
  }
  if (pos === 'C') {
    return weighted([
      [r.finishing, 1.0], [r.postGame, 1.2], [r.rebounding, 1.3],
      [r.interiorDefense, 1.1], [r.shotBlocking, 0.9], [r.strength, 0.7],
      [r.basketballIq, 0.5],
    ])
  }
  return weighted([
    [r.finishing, 1.1], [r.midRange, 0.9], [r.threePoint, 0.8],
    [r.rebounding, 1.0], [r.interiorDefense, 0.8], [r.perimeterDefense, 0.7],
    [r.strength, 0.5], [r.basketballIq, 0.6],
  ])
}

function defensiveComposite(p: Player): number {
  const r = p.ratings
  const pos = p.bio.position
  if (pos === 'PG' || pos === 'SG') {
    return weighted([
      [r.perimeterDefense, 1.3], [r.lateralQuickness, 0.8], [r.stealing, 0.9],
      [r.defensiveIq, 1.0], [r.speed, 0.5],
    ])
  }
  if (pos === 'C' || pos === 'PF') {
    return weighted([
      [r.interiorDefense, 1.3], [r.shotBlocking, 1.1], [r.rebounding, 0.8],
      [r.strength, 0.6], [r.defensiveIq, 1.0],
    ])
  }
  return weighted([
    [r.perimeterDefense, 1.1], [r.interiorDefense, 0.7], [r.defensiveIq, 1.0],
    [r.stealing, 0.7], [r.lateralQuickness, 0.7],
  ])
}

function topEightAverage(players: Player[], score: (p: Player) => number): number {
  if (players.length === 0) return 70
  const sorted = [...players].sort((a, b) => score(b) - score(a))
  const top8 = sorted.slice(0, Math.min(8, sorted.length))
  const weights = [1.4, 1.3, 1.2, 1.1, 1.0, 0.9, 0.8, 0.7]
  let weightedSum = 0
  let weightTotal = 0
  for (let i = 0; i < top8.length; i++) {
    const w = weights[i] ?? 0.7
    weightedSum += score(top8[i]) * w
    weightTotal += w
  }
  return weightedSum / weightTotal
}

function teamStrength(players: Player[]): number {
  return topEightAverage(players, playerComposite)
}

function teamDefense(players: Player[]): number {
  return topEightAverage(players, defensiveComposite)
}

function coachingBonus(staff: StaffRoster | null, players: Player[]): number {
  if (!staff) return 0
  const hc = staff.headCoach
  const offBonus = (hc.offenseRating - 50) / 100 * 2.0
  const defBonus = (hc.defenseRating - 50) / 100 * 2.0
  const adaptBonus = (hc.adaptability - 50) / 100 * 0.5
  let assistBonus = 0
  for (const ac of staff.assistantCoaches) {
    assistBonus += (ac.generalRating - 50) / 100 * 0.3
  }

  let chemistryMod = 0
  if (players.length > 0) {
    const temperament = hc.personality.temperament
    let conflicts = 0
    for (const p of players) {
      const ego = p.character.ego ?? 50
      const coachability = p.character.coachability ?? 50
      if (temperament < 30 && ego > 80 && coachability < 40) conflicts++
      else if (temperament > 70 && coachability > 70) chemistryMod += 0.1
    }
    chemistryMod -= conflicts * 0.4
  }

  return offBonus + defBonus + adaptBonus + assistBonus + chemistryMod
}

/** Combined per-team stat modifiers from scheme, emphasis, and the opposing defense. */
interface TeamSimMods {
  fgaMult: number
  twoPctAdd: number
  threePctAdd: number
  threeRateAdd: number
  astMult: number
  tovMult: number
  ftRateMult: number
  paceAdd: number
  isoTopBoost: number
  pnrBoost: boolean
  guardFgaMult: number
  wingThreeAdd: number
}

function neutralMods(): TeamSimMods {
  return {
    fgaMult: 1, twoPctAdd: 0, threePctAdd: 0, threeRateAdd: 0,
    astMult: 1, tovMult: 1, ftRateMult: 1, paceAdd: 0,
    isoTopBoost: 1, pnrBoost: false, guardFgaMult: 1, wingThreeAdd: 0,
  }
}

function applyOffensiveScheme(mods: TeamSimMods, scheme: OffensiveScheme): void {
  switch (scheme) {
    case 'motion':
      mods.astMult *= 1.15
      mods.twoPctAdd += 0.010
      break
    case 'iso_heavy':
      mods.isoTopBoost = 1.15
      mods.astMult *= 0.88
      break
    case 'pick_and_roll':
      mods.pnrBoost = true
      mods.astMult *= 1.06
      break
    case 'triangle':
      mods.astMult *= 1.05
      mods.twoPctAdd += 0.005
      mods.paceAdd -= 1
      break
    case 'pace_and_space':
      mods.threeRateAdd += 0.05
      mods.paceAdd += 3
      break
    case 'princeton':
      mods.astMult *= 1.10
      mods.twoPctAdd += 0.005
      mods.paceAdd -= 3
      break
    case 'drive_and_kick':
      mods.guardFgaMult *= 1.06
      mods.wingThreeAdd += 0.04
      mods.ftRateMult *= 1.10
      break
  }
}

/** Effects the opponent's defensive scheme imposes on THIS team's offense. */
function applyOpponentDefense(mods: TeamSimMods, scheme: DefensiveScheme): void {
  switch (scheme) {
    case 'man_to_man':
      break
    case 'switching':
      mods.twoPctAdd -= 0.006
      mods.isoTopBoost *= 0.96
      break
    case 'drop_coverage':
      mods.twoPctAdd -= 0.003
      mods.threeRateAdd += 0.02
      break
    case 'blitz':
      mods.tovMult *= 1.15
      mods.twoPctAdd -= 0.005
      break
    case 'zone_2_3':
      mods.twoPctAdd -= 0.008
      mods.threeRateAdd += 0.04
      break
    case 'zone_3_2':
      mods.threePctAdd -= 0.012
      mods.twoPctAdd += 0.002
      break
    case 'pack_the_paint':
      mods.twoPctAdd -= 0.010
      mods.threeRateAdd += 0.05
      break
  }
}

function buildTeamMods(
  ownCoaching: CoachingStaff | null | undefined,
  oppCoaching: CoachingStaff | null | undefined,
  oppDefStrength: number,
): TeamSimMods {
  const mods = neutralMods()
  if (ownCoaching) {
    applyOffensiveScheme(mods, ownCoaching.offensiveScheme)
    mods.threeRateAdd += (ownCoaching.threePointEmphasis - 50) * 0.0012
    mods.paceAdd += (ownCoaching.pacePreference - 50) * 0.06
  }
  if (oppCoaching) {
    applyOpponentDefense(mods, oppCoaching.defensiveScheme)
  }
  // Better defenses shave shooting efficiency
  mods.twoPctAdd -= (oppDefStrength - 70) * 0.0009
  mods.threePctAdd -= (oppDefStrength - 70) * 0.0005
  return mods
}

interface PlayerRole {
  isTopUsage: boolean
}

function scoringSkill(p: Player): number {
  const r = p.ratings
  const pos = p.bio.position
  if (pos === 'C' || pos === 'PF') {
    return r.finishing * 0.35 + r.closeRange * 0.25 + r.postGame * 0.25 + r.midRange * 0.15
  }
  return r.finishing * 0.28 + r.midRange * 0.27 + r.threePoint * 0.30 + r.closeRange * 0.15
}

function interiorSkill(p: Player): number {
  const r = p.ratings
  return r.finishing * 0.45 + r.closeRange * 0.30 + r.midRange * 0.25
}

/**
 * Relative demand for team resources (shots, free throws, assists,
 * rebounds). Only ratios matter — absolute team totals come from
 * possession budgets, so the sim stays realistic no matter how inflated
 * or deflated a league's ratings are.
 */
interface PlayerDemands {
  fga: number
  fta: number
  ast: number
  reb: number
}

function computeDemands(
  player: Player,
  minutes: number,
  mods: TeamSimMods,
  role: PlayerRole,
): PlayerDemands {
  const r = player.ratings
  const t = player.tendencies
  const minuteFactor = minutes / 36
  const pos = player.bio.position
  const isGuard = pos === 'PG' || pos === 'SG'

  const usage = 0.85 + (t.usageDesire ?? 50) * 0.003
  const isoBoost = role.isTopUsage ? mods.isoTopBoost : 1
  const pnrFgaBoost = mods.pnrBoost && (pos === 'PG' || pos === 'C') ? 1.08 : 1
  const guardBoost = isGuard ? mods.guardFgaMult : 1
  const formBoost = 1 + (player.status.form ?? 0) * 0.02
  const hurtPenalty = player.status.currentInjury?.playingThrough ? 0.90 : 1
  const moraleBoost = 1 + ((player.status.morale ?? 72) - 70) * 0.0012
  const skill = scoringSkill(player)
  const fga = minuteFactor
    * (2 + Math.max(0, skill - 55) * 0.40)
    * usage * isoBoost * pnrFgaBoost * guardBoost * formBoost * hurtPenalty * moraleBoost

  const driveBoost = 1 + ((t.driveFrequency ?? 50) - 50) * 0.004
  const fta = minuteFactor * (0.4 + Math.max(0, r.drawFoul - 55) * 0.14) * driveBoost

  const astPosMult = pos === 'PG' ? 1.0 : pos === 'SG' ? 0.70 : pos === 'SF' ? 0.60 : pos === 'PF' ? 0.50 : 0.45
  const isoAstPenalty = 1 - ((t.isoFrequency ?? 50) - 50) * 0.003
  const pnrAstBoost = mods.pnrBoost && pos === 'PG' ? 1.12 : 1
  const ast = minuteFactor
    * (0.3 + Math.max(0, r.passingVision - 55) * 0.22 * astPosMult)
    * isoAstPenalty * pnrAstBoost

  const rebPosMult = pos === 'C' ? 1.0 : pos === 'PF' ? 0.85 : pos === 'SF' ? 0.55 : 0.40
  const boxOutBonus = ((t.boxOutRate ?? 50) - 50) * 0.015
  const reb = minuteFactor
    * (0.8 + (Math.max(0, r.rebounding - 55) * 0.17 + boxOutBonus) * rebPosMult)

  return { fga: Math.max(0.01, fga), fta: Math.max(0, fta), ast: Math.max(0, ast), reb: Math.max(0.01, reb) }
}

function playerThreeRate(player: Player, mods: TeamSimMods): number {
  const r = player.ratings
  const t = player.tendencies
  const pos = player.bio.position
  const isGuard = pos === 'PG' || pos === 'SG'
  const isBig = pos === 'C' || pos === 'PF'

  let threeRate = clamp(0.22 + (r.threePoint - 68) * 0.006, 0.02, 0.60)
  threeRate += (t.spotUpFrequency ?? 50) * 0.0008 + (t.catchAndShootFrequency ?? 50) * 0.0006
  threeRate += mods.threeRateAdd
  if (!isGuard && !isBig) threeRate += mods.wingThreeAdd
  if (isBig && r.threePoint < 65) threeRate = Math.min(threeRate, 0.12)
  return clamp(threeRate, 0.0, 0.65)
}

/** Largest-remainder allocation of an integer budget by demand share. */
function allocateBudget(demands: number[], budget: number): number[] {
  const total = demands.reduce((s, d) => s + d, 0)
  if (total <= 0 || budget <= 0) return demands.map(() => 0)
  const raw = demands.map(d => (d / total) * budget)
  const floors = raw.map(Math.floor)
  let remaining = budget - floors.reduce((s, f) => s + f, 0)
  const order = raw
    .map((v, i) => ({ frac: v - Math.floor(v), i }))
    .sort((a, b) => b.frac - a.frac)
  for (let k = 0; k < order.length && remaining > 0; k++, remaining--) {
    floors[order[k].i] += 1
  }
  return floors
}

function finalizePlayerStats(
  player: Player,
  minutes: number,
  fga: number,
  fta: number,
  ast: number,
  reb: number,
  isWinner: boolean,
  mods: TeamSimMods,
): PlayerGameStats {
  const r = player.ratings
  const t = player.tendencies
  const minuteFactor = minutes / 36

  const threeRate = playerThreeRate(player, mods)
  const tpa = Math.round(fga * threeRate)
  const twoA = fga - tpa

  // Hot/cold streaks, playing hurt, and locker-room mood nudge efficiency
  const conditionAdd = (player.status.form ?? 0) * 0.006
    + (player.status.currentInjury?.playingThrough ? -0.018 : 0)
    + ((player.status.morale ?? 72) - 70) * 0.0003

  const twoPct = clamp(
    0.53 + (interiorSkill(player) - 72) * 0.0035 + mods.twoPctAdd + conditionAdd + gauss() * 0.05,
    0.35, 0.70,
  )
  const threePct = tpa > 0
    ? clamp(0.34 + (r.threePoint - 74) * 0.003 + mods.threePctAdd + conditionAdd + gauss() * 0.07, 0.15, 0.48)
    : 0

  const twoM = Math.round(twoA * twoPct)
  const tpm = Math.round(tpa * threePct)
  const fgm = twoM + tpm

  const ftPct = clamp(0.72 + (r.freeThrow - 75) * 0.005 + gauss() * 0.05, 0.40, 0.95)
  const ftm = Math.round(fta * ftPct)

  const points = twoM * 2 + tpm * 3 + ftm

  const orebShare = clamp(0.18 + (r.offensiveRebounding - 60) * 0.004, 0.08, 0.45)
  const oreb = Math.round(reb * orebShare)
  const dreb = reb - oreb

  const gambleBonus = ((t.gambleForSteals ?? 50) - 50) * 0.008
  const stl = Math.round(clamp(
    minuteFactor * (0.2 + Math.max(0, r.stealing - 55) * 0.028 + gambleBonus) + gauss() * 0.5,
    0, 6,
  ))
  const blk = Math.round(clamp(
    minuteFactor * (0.05 + Math.max(0, r.shotBlocking - 55) * 0.035) + gauss() * 0.4,
    0, 7,
  ))

  const tov = Math.round(clamp(
    (fga * 0.09 + minuteFactor * Math.max(0, 85 - r.ballHandling) * 0.02) * mods.tovMult + gauss() * 0.6,
    0, 9,
  ))
  const pf = Math.round(clamp(
    minuteFactor * (1.0 + ((t.foulProneness ?? 50) - 50) * 0.02) + gauss() * 0.7,
    0, 6,
  ))

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

function generateMinutes(players: Player[], coaching?: CoachingStaff | null): number[] {
  const available = players.map(isAvailable)

  // User-managed rotation: use the saved minutes map when enabled.
  if (coaching?.manualRotation && coaching.rotationMinutes) {
    const manual = players.map((p, i) => available[i] ? (coaching.rotationMinutes![p.id] ?? 0) : 0)
    const total = manual.reduce((s, m) => s + m, 0)
    if (total > 0) {
      const scale = 240 / total
      return manual.map(m => Math.round(m * scale * 10) / 10)
    }
  }

  const sorted = players
    .map((p, i) => ({ score: playerComposite(p), idx: i }))
    .filter(x => available[x.idx])
    .sort((a, b) => b.score - a.score)

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

/**
 * Reconcile individual scoring against the team score by nudging the
 * top rotation players' free throws and field goals, keeping the box
 * score internally consistent (points always equal 2*2PM + 3*3PM + FTM).
 */
function reconcileScore(playerStats: PlayerGameStats[], teamScore: number): void {
  const rawTotal = playerStats.reduce((s, ps) => s + ps.points, 0)
  let residual = teamScore - rawTotal
  if (residual === 0) return

  const rotation = [...playerStats]
    .filter(ps => ps.minutes >= 8)
    .sort((a, b) => b.points - a.points)
  if (rotation.length === 0) return

  let i = 0
  let guard = 0
  while (residual !== 0 && guard < 500) {
    const ps = rotation[i % rotation.length]
    if (residual > 0) {
      if (residual >= 2) {
        ps.fieldGoalsMade += 1
        ps.fieldGoalsAttempted += 1
        ps.points += 2
        residual -= 2
      } else {
        ps.freeThrowsMade += 1
        ps.freeThrowsAttempted += 1
        ps.points += 1
        residual -= 1
      }
    } else {
      if (residual <= -2 && ps.fieldGoalsMade > ps.threePointersMade) {
        // A made two becomes a miss: attempts stay, so FG% dips naturally
        ps.fieldGoalsMade -= 1
        ps.points -= 2
        residual += 2
      } else if (ps.freeThrowsMade > 0) {
        ps.freeThrowsMade -= 1
        ps.points -= 1
        residual += 1
      }
    }
    i++
    guard++
  }
}

function buildBoxScore(
  teamId: string,
  players: Player[],
  teamScore: number,
  isWinner: boolean,
  pace: number,
  paceFactor: number,
  mods: TeamSimMods,
  coaching?: CoachingStaff | null,
): TeamBoxScore {
  const minutes = generateMinutes(players, coaching)

  // Top-2 composite players carry the offense (iso boosts, usage gravity)
  const byComposite = players
    .map((p, i) => ({ id: p.id, score: playerComposite(p), idx: i }))
    .sort((a, b) => b.score - a.score)
  const topUsageIds = new Set(byComposite.slice(0, 2).map(x => x.id))

  // Relative demands, then possession budgets keep totals NBA-realistic
  // regardless of a league's absolute rating levels.
  const demands = players.map((p, i) =>
    computeDemands(p, minutes[i], mods, { isTopUsage: topUsageIds.has(p.id) })
  )

  const fgaBudget = Math.max(60, Math.round(87 * paceFactor * mods.fgaMult + gauss() * 4))
  const ftaBudget = Math.max(8, Math.round(22 * mods.ftRateMult + gauss() * 4))
  const rebBudget = Math.max(30, Math.round(42 * paceFactor + gauss() * 3))

  // Superlinear demand concentrates shots in the best players (shot
  // hierarchies exist even on rosters where everyone rates well)
  const fgaAlloc = allocateBudget(demands.map(d => Math.pow(d.fga, 1.18)), fgaBudget)
    .map(v => Math.min(v, 24))
  const ftaAlloc = allocateBudget(demands.map(d => d.fta), ftaBudget)
    .map(v => Math.min(v, 16))
  const rebAlloc = allocateBudget(demands.map(d => d.reb), rebBudget)
    .map(v => Math.min(v, 15))

  // Assists track made baskets (~62% of NBA makes are assisted)
  const provisional = players.map((p, i) =>
    finalizePlayerStats(p, minutes[i], fgaAlloc[i], ftaAlloc[i], 0, rebAlloc[i], isWinner, mods)
  )
  const teamFgm = provisional.reduce((s, ps) => s + ps.fieldGoalsMade, 0)
  const astBudget = Math.max(10, Math.round(teamFgm * 0.62 * mods.astMult + gauss() * 2))
  const astAlloc = allocateBudget(demands.map(d => d.ast), astBudget)
  const playerStats = provisional.map((ps, i) => ({ ...ps, assists: astAlloc[i] }))

  reconcileScore(playerStats, teamScore)

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
  coaching?: CoachingContext,
): GameResult {
  const homeDef = teamDefense(homePlayers)
  const awayDef = teamDefense(awayPlayers)

  const homeStr = teamStrength(homePlayers) * 0.65 + homeDef * 0.35
    + coachingBonus(coaching?.homeStaff ?? null, homePlayers)
  const awayStr = teamStrength(awayPlayers) * 0.65 + awayDef * 0.35
    + coachingBonus(coaching?.awayStaff ?? null, awayPlayers)

  const homeMods = buildTeamMods(coaching?.homeCoaching, coaching?.awayCoaching, awayDef)
  const awayMods = buildTeamMods(coaching?.awayCoaching, coaching?.homeCoaching, homeDef)

  const homeAdv = 3.0
  const diff = homeStr - awayStr + homeAdv
  const spread = diff * 0.8 + gauss() * 12

  const pace = clamp(98 + (homeMods.paceAdd + awayMods.paceAdd) / 2 + gauss() * 3, 90, 108)
  const paceFactor = pace / 98
  const basePPG = 110 * paceFactor

  let homeScore = Math.round(basePPG + spread / 2 + gauss() * 5)
  let awayScore = Math.round(basePPG - spread / 2 + gauss() * 5)

  homeScore = Math.max(75, homeScore)
  awayScore = Math.max(75, awayScore)

  if (Math.abs(homeScore - awayScore) <= 5 && coaching) {
    const homeClutch = coaching.homeStaff?.headCoach.personality.clutchCoaching ?? 50
    const awayClutch = coaching.awayStaff?.headCoach.personality.clutchCoaching ?? 50
    const clutchDiff = (homeClutch - awayClutch) / 100 * 3
    homeScore += Math.round(clutchDiff + gauss() * 0.5)
    awayScore -= Math.round(clutchDiff * 0.5)
  }

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

  const homeBox = buildBoxScore(
    game.homeTeamId, homePlayers, homeScore, isHomeWinner,
    pace, paceFactor, homeMods, coaching?.homeCoaching,
  )
  const awayBox = buildBoxScore(
    game.awayTeamId, awayPlayers, awayScore, !isHomeWinner,
    pace, paceFactor, awayMods, coaching?.awayCoaching,
  )

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
